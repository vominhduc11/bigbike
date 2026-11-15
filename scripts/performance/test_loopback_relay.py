"""Guard and native TCP tests using only temporary, test-owned loopback sockets."""
import copy
import hashlib
import os
import socket
import threading
import time
import unittest
from unittest.mock import patch

from loopback_relay import LoopbackRelays, _Relay, _checked_target


PROJECT = 'bbperf-123-1-before'
CI_ENV = {'GITHUB_ACTIONS': 'true', 'RUNNER_ENVIRONMENT': 'github-hosted'}


def metadata(service='minio'):
    network = {'Name': PROJECT + '_default', 'Id': 'owned-network', 'Driver': 'bridge',
               'Internal': True, 'Labels': {'com.docker.compose.project': PROJECT,
                                          'com.docker.compose.network': 'default'},
               'IPAM': {'Config': [{'Subnet': '172.29.239.0/24', 'Gateway': '172.29.239.1'}]}}
    container = {'Config': {'Labels': {'com.docker.compose.project': PROJECT,
                                     'com.docker.compose.service': service}},
                 'State': {'Running': True}, 'NetworkSettings': {'Networks': {
                     PROJECT + '_default': {'IPAddress': '172.29.239.5', 'NetworkID': 'owned-network'}}}}
    return container, network


class _Server:
    def __init__(self, handle):
        self.socket = socket.socket()
        self.socket.bind(('127.0.0.1', 0))
        self.socket.listen(4)
        self.socket.settimeout(.1)
        self.address = self.socket.getsockname()
        self.stop = threading.Event()
        self.errors = []
        self.clients, self.workers = [], []
        self.handle = handle
        self.thread = threading.Thread(target=self.serve)
        self.thread.start()

    def serve(self):
        while not self.stop.is_set():
            try:
                client, _ = self.socket.accept()
            except socket.timeout:
                continue
            except OSError:
                return
            self.clients.append(client)
            thread = threading.Thread(target=self.process, args=(client,))
            self.workers.append(thread)
            thread.start()

    def process(self, client):
        try:
            with client:
                client.settimeout(3)
                self.handle(client)
        except OSError as error:
            if not self.stop.is_set():
                self.errors.append(type(error).__name__)

    def close(self):
        self.stop.set()
        self.socket.close()
        for client in self.clients:
            try:
                client.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
        self.thread.join(2)
        for worker in self.workers:
            worker.join(2)
        if self.thread.is_alive() or any(t.is_alive() for t in self.workers):
            raise AssertionError('Owned TCP fixture did not stop')


def read_exact(stream, count):
    result = bytearray()
    while len(result) < count:
        part = stream.recv(count - len(result))
        if not part:
            raise AssertionError('Unexpected EOF in native TCP fixture')
        result.extend(part)
    return bytes(result)


class LoopbackGuardTest(unittest.TestCase):
    def test_public_controller_refuses_local_and_wrong_project(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ValueError):
                LoopbackRelays(PROJECT, lambda _: {}, lambda _: {})
        with patch.dict(os.environ, CI_ENV, clear=True):
            for project in ('bigbike', PROJECT + ';echo', 'bbperf-1-1-prod'):
                with self.assertRaises(ValueError):
                    LoopbackRelays(project, lambda _: {}, lambda _: {})

    def test_only_owned_running_single_internal_attachment(self):
        container, network = metadata()
        self.assertEqual(_checked_target(PROJECT, 'minio', [container], [network]), '172.29.239.5')
        mutations = [
            lambda c, n: c['Config']['Labels'].update({'com.docker.compose.project': 'bigbike'}),
            lambda c, n: c['Config']['Labels'].update({'com.docker.compose.service': 'postgres'}),
            lambda c, n: c['State'].update(Running=False),
            lambda c, n: c['NetworkSettings']['Networks'].update({'bridge': {}}),
            lambda c, n: n.update(Internal=False),
            lambda c, n: n.update(Driver='host'),
            lambda c, n: n.update(Name='bigbike_default'),
            lambda c, n: n['Labels'].update({'com.docker.compose.project': 'bigbike'}),
            lambda c, n: n['IPAM']['Config'][0].update(Subnet='172.29.0.0/16'),
            lambda c, n: c['NetworkSettings']['Networks'][PROJECT + '_default'].update(NetworkID='foreign'),
        ]
        for mutation in mutations:
            c, n = copy.deepcopy(container), copy.deepcopy(network)
            mutation(c, n)
            with self.subTest(mutation=mutation):
                with self.assertRaises(ValueError):
                    _checked_target(PROJECT, 'minio', c, n)

    def test_rejects_gateway_external_loopback_and_reserved_addresses(self):
        for address in ('172.29.239.1', '172.29.239.0', '172.29.239.255', '172.29.238.2',
                        '127.0.0.1', '8.8.8.8', '::1', '', 'bad'):
            container, network = metadata()
            container['NetworkSettings']['Networks'][PROJECT + '_default']['IPAddress'] = address
            with self.subTest(address=address):
                with self.assertRaises(ValueError):
                    _checked_target(PROJECT, 'minio', container, network)

    def test_fixed_mappings_and_retarget_after_recreate(self):
        container, network = metadata('api-proxy')
        with patch.dict(os.environ, CI_ENV, clear=True), patch('loopback_relay._Relay') as relay:
            manager = LoopbackRelays(PROJECT, lambda _: container, lambda _: network)
            manager.refresh('api-proxy')
            self.assertEqual([(call.args[0], call.args[1]) for call in relay.call_args_list],
                             [(18080, ('172.29.239.5', 80)), (13000, ('172.29.239.5', 81)),
                              (14000, ('172.29.239.5', 82))])
            container['NetworkSettings']['Networks'][PROJECT + '_default']['IPAddress'] = '172.29.239.7'
            manager.refresh('api-proxy')
            self.assertEqual(relay.call_count, 3)
            self.assertEqual(relay.return_value.retarget.call_count, 3)
            with self.assertRaises(ValueError):
                manager.refresh('postgres')
            manager.close()
            with self.assertRaises(ValueError):
                manager.refresh('api-proxy')


class NativeLoopbackTransportTest(unittest.TestCase):
    def test_streaming_binary_full_duplex_and_half_close(self):
        # Arbitrary binary bytes include NUL/CRLF/0xff; no HTTP/parser assumptions.
        chunk = bytes(range(256)) * 1024
        payload = chunk * 4
        digest = hashlib.sha256(payload).digest()

        def peer(connection):
            received = bytearray()
            connection.sendall(b'\x00ready\xff')
            while True:
                data = connection.recv(65536)
                if not data:
                    break
                received.extend(data)
                connection.sendall(data)
            connection.sendall(hashlib.sha256(received).digest())

        server = _Server(peer)
        relay = _Relay(0, server.address)
        try:
            with socket.create_connection(('127.0.0.1', relay.port), timeout=3) as client:
                self.assertEqual(read_exact(client, 7), b'\x00ready\xff')
                # Response is visible before the request completes, as required by
                # upgraded WebSockets and streaming HTTP rather than buffered RPC.
                for part in (chunk,) * 4:
                    client.sendall(part)
                    self.assertEqual(read_exact(client, len(part)), part)
                client.shutdown(socket.SHUT_WR)
                self.assertEqual(read_exact(client, len(digest)), digest)
                self.assertEqual(client.recv(1), b'')
        finally:
            relay.close()
            server.close()
        self.assertFalse(server.errors)
        self.assertEqual(relay.stats()['transport_failed'], 0)
        self.assertEqual(relay.stats()['active'], 0)

    def test_close_interrupts_idle_connection_and_joins_workers(self):
        connected = threading.Event()
        def peer(connection):
            connected.set()
            connection.recv(1)
        server = _Server(peer)
        relay = _Relay(0, server.address)
        client = socket.create_connection(('127.0.0.1', relay.port), timeout=3)
        try:
            self.assertTrue(connected.wait(2))
            started = time.monotonic()
            relay.close()
            self.assertLess(time.monotonic() - started, 3)
            self.assertEqual(client.recv(1), b'')
            self.assertEqual(relay.stats()['active'], 0)
            self.assertFalse(relay._thread.is_alive())
        finally:
            client.close()
            relay.close()
            server.close()

    def test_capacity_is_bounded_and_rejection_contains_no_payload(self):
        connected = threading.Event()
        def peer(connection):
            connected.set()
            connection.recv(1)
        server = _Server(peer)
        relay = _Relay(0, server.address, threading.BoundedSemaphore(1))
        first = socket.create_connection(('127.0.0.1', relay.port), timeout=3)
        try:
            self.assertTrue(connected.wait(2))
            with socket.create_connection(('127.0.0.1', relay.port), timeout=3) as second:
                self.assertEqual(second.recv(1), b'')
            self.assertEqual(relay.stats()['capacity_rejected'], 1)
            self.assertLessEqual(relay.stats()['active'], 1)
        finally:
            first.close()
            relay.close()
            server.close()

    def test_retarget_uses_new_endpoint_and_preserves_bytes(self):
        def peer(prefix):
            def serve(connection):
                connection.sendall(prefix + read_exact(connection, 3))
            return serve
        old, new = _Server(peer(b'old:')), _Server(peer(b'new:'))
        relay = _Relay(0, old.address)
        try:
            with socket.create_connection(('127.0.0.1', relay.port), timeout=3) as client:
                client.sendall(b'one')
                self.assertEqual(read_exact(client, 7), b'old:one')
            relay.retarget(new.address)
            with socket.create_connection(('127.0.0.1', relay.port), timeout=3) as client:
                client.sendall(b'two')
                self.assertEqual(read_exact(client, 7), b'new:two')
        finally:
            relay.close()
            old.close()
            new.close()


if __name__ == '__main__':
    unittest.main()
