"""CI-only byte transport from localhost into the job's internal Docker bridge.

Docker does not publish ports on an internal-only bridge. This relay preserves
that network boundary and never interprets HTTP, credentials or application data.
"""
import errno
import ipaddress
import select
import socket
import threading
import time

from ci_guard import project_name, require_ci


_SUBNET = ipaddress.ip_network('172.29.239.0/24')
_MAPPINGS = {'minio': ((19000, 9000),),
             'api-proxy': ((18080, 80), (13000, 81), (14000, 82))}


class _Relay:
    """Private TCP primitive; tests use only their own ephemeral loopback server."""

    def __init__(self, listen_port, target, capacity=None):
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._capacity = capacity if capacity is not None else threading.BoundedSemaphore(64)
        self._target, self._generation = target, 0
        self._sockets, self._workers = set(), set()
        self._counts = {name: 0 for name in ('accepted', 'capacity_rejected', 'connect_failed',
                                            'transport_failed', 'idle_timeout')}
        self._listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            self._listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self._listener.bind(('127.0.0.1', listen_port))
            self._listener.listen(64)
            self._listener.settimeout(.1)
            self.port = self._listener.getsockname()[1]
            self._thread = threading.Thread(target=self._accept, name='bbperf-loopback-accept')
            self._thread.start()
        except BaseException:
            self._listener.close()
            raise

    def _count(self, name):
        with self._lock:
            self._counts[name] += 1

    def _accept(self):
        while not self._stop.is_set():
            try:
                client, _ = self._listener.accept()
            except socket.timeout:
                continue
            except OSError:
                break
            if not self._capacity.acquire(blocking=False):
                self._count('capacity_rejected')
                client.close()
                continue
            with self._lock:
                if self._stop.is_set():
                    client.close()
                    self._capacity.release()
                    break
                self._counts['accepted'] += 1
                self._sockets.add(client)
                worker = threading.Thread(target=self._transfer,
                    args=(client, self._target, self._generation), name='bbperf-loopback-transfer')
                self._workers.add(worker)
                worker.start()

    def _connect(self, upstream, target):
        code = upstream.connect_ex(target)
        pending = (errno.EINPROGRESS, errno.EWOULDBLOCK, errno.EALREADY)
        if code not in (0, *pending):
            return False
        deadline = time.monotonic() + 5
        while code and not self._stop.is_set() and time.monotonic() < deadline:
            _, writable, exceptional = select.select([], [upstream], [upstream], .1)
            if writable or exceptional:
                return upstream.getsockopt(socket.SOL_SOCKET, socket.SO_ERROR) == 0
        return code == 0 and not self._stop.is_set()

    def _transfer(self, client, target, generation):
        upstream = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            with self._lock:
                if self._stop.is_set() or generation != self._generation:
                    return
                self._sockets.add(upstream)
            client.setblocking(False)
            upstream.setblocking(False)
            if not self._connect(upstream, target):
                if not self._stop.is_set():
                    self._count('connect_failed')
                return
            peers = {client: upstream, upstream: client}
            pending = {client: bytearray(), upstream: bytearray()}
            reading = {client: True, upstream: True}
            write_closed = {client: False, upstream: False}
            last_activity = time.monotonic()
            while not self._stop.is_set():
                # Propagate EOF only after every preceding byte reaches its peer.
                for source, destination in peers.items():
                    if not reading[source] and not pending[destination] and not write_closed[destination]:
                        destination.shutdown(socket.SHUT_WR)
                        write_closed[destination] = True
                if not any(reading.values()) and not any(pending.values()):
                    return
                if time.monotonic() - last_activity > 300:
                    self._count('idle_timeout')
                    return
                readers = [s for s in peers if reading[s] and len(pending[peers[s]]) < 262144]
                writers = [s for s in peers if pending[s]]
                ready_read, ready_write, exceptional = select.select(readers, writers, list(peers), .1)
                if exceptional:
                    raise OSError('TCP transport failed')
                for source in ready_read:
                    try:
                        data = source.recv(65536)
                    except BlockingIOError:
                        continue
                    if data:
                        pending[peers[source]].extend(data)
                    else:
                        reading[source] = False
                    last_activity = time.monotonic()
                for destination in ready_write:
                    try:
                        sent = destination.send(pending[destination])
                    except BlockingIOError:
                        continue
                    if not sent:
                        raise OSError('TCP transport failed')
                    del pending[destination][:sent]
                    last_activity = time.monotonic()
        except (OSError, ValueError):
            if not self._stop.is_set():
                self._count('transport_failed')
        finally:
            client.close()
            upstream.close()
            with self._lock:
                self._sockets.discard(client)
                self._sockets.discard(upstream)
                self._workers.discard(threading.current_thread())
            self._capacity.release()

    def retarget(self, target):
        with self._lock:
            if self._stop.is_set():
                raise ValueError('Relay already closed')
            if self._target == target:
                return
            self._target = target
            self._generation += 1
            active = list(self._sockets)
        for connection in active:
            try:
                connection.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass

    def stats(self):
        with self._lock:
            return {**self._counts, 'active': len(self._workers)}

    def close(self):
        self._stop.set()
        self._listener.close()
        with self._lock:
            active = list(self._sockets)
        for connection in active:
            try:
                connection.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
        deadline = time.monotonic() + 3
        self._thread.join(max(0, deadline - time.monotonic()))
        with self._lock:
            workers = list(self._workers)
        for worker in workers:
            worker.join(max(0, deadline - time.monotonic()))
        if self._thread.is_alive() or any(worker.is_alive() for worker in workers):
            raise RuntimeError('Relay shutdown incomplete')


def _object(value):
    if isinstance(value, list) and len(value) == 1:
        value = value[0]
    if not isinstance(value, dict):
        raise ValueError('Expected one inspected Docker resource')
    return value


def _checked_target(project, service, container, network):
    """Reject a foreign container, extra attachment or noninternal bridge."""
    project_name(project)
    if service not in _MAPPINGS:
        raise ValueError('Service outside the loopback transport allowlist')
    container, network = _object(container), _object(network)
    name = project + '_default'
    labels = container.get('Config', {}).get('Labels') or {}
    if (labels.get('com.docker.compose.project') != project
            or labels.get('com.docker.compose.service') != service
            or container.get('State', {}).get('Running') is not True):
        raise ValueError('Container ownership or running state invalid')
    attachments = container.get('NetworkSettings', {}).get('Networks') or {}
    network_labels = network.get('Labels') or {}
    ipam = network.get('IPAM', {}).get('Config') or []
    if (set(attachments) != {name} or network.get('Name') != name
            or network.get('Driver') != 'bridge' or network.get('Internal') is not True
            or network_labels.get('com.docker.compose.project') != project
            or network_labels.get('com.docker.compose.network') != 'default'
            or len(ipam) != 1 or ipam[0].get('Subnet') != str(_SUBNET)):
        raise ValueError('Network ownership or internal boundary invalid')
    endpoint = attachments[name]
    try:
        address = ipaddress.ip_address(endpoint.get('IPAddress', ''))
        gateway = ipaddress.ip_address(ipam[0].get('Gateway', str(_SUBNET.network_address + 1)))
    except ValueError:
        raise ValueError('Invalid internal bridge endpoint') from None
    if (not isinstance(address, ipaddress.IPv4Address) or address not in _SUBNET
            or address in (_SUBNET.network_address, _SUBNET.broadcast_address, gateway)
            or endpoint.get('NetworkID') != network.get('Id') or not network.get('Id')):
        raise ValueError('Endpoint outside the owned internal bridge')
    return str(address)


class LoopbackRelays:
    def __init__(self, project, inspect_container, inspect_network, max_connections=64):
        require_ci()
        self.project = project_name(project)
        if max_connections not in (64, 128):
            raise ValueError('Bounded relay capacity must be 64 or 128')
        if not callable(inspect_container) or not callable(inspect_network):
            raise ValueError('Docker inspection callbacks required')
        self._container, self._network = inspect_container, inspect_network
        self._capacity = threading.BoundedSemaphore(max_connections)
        self._relays, self._closed = {}, False

    def refresh(self, service):
        require_ci()
        if self._closed or service not in _MAPPINGS:
            raise ValueError('Relay closed or service outside allowlist')
        address = _checked_target(self.project, service, self._container(service),
                                  self._network(self.project + '_default'))
        for local_port, remote_port in _MAPPINGS[service]:
            if local_port in self._relays:
                self._relays[local_port].retarget((address, remote_port))
            else:
                self._relays[local_port] = _Relay(local_port, (address, remote_port), self._capacity)

    def stats(self):
        return {str(port): relay.stats() for port, relay in self._relays.items()}

    def close(self):
        self._closed = True
        failed = False
        for relay in self._relays.values():
            try:
                relay.close()
            except RuntimeError:
                failed = True
        if failed:
            raise RuntimeError('Relay shutdown incomplete')

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()
