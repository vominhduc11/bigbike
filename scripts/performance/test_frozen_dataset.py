import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import frozen_dataset as dataset


class FakeStack:
    project = 'bbperf-123-1-before'
    password = 'synthetic-private-ci-password'

    def compose_command(self, *arguments):
        return ['docker', 'compose', '--env-file', '/private/ci.env', '-p', self.project,
                '-f', '/isolated/compose.ci.yml', *arguments]


class FrozenDatasetTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.private = self.root / 'private'
        self.private.mkdir()
        self.environment = patch.dict(os.environ, {
            'RUNNER_TEMP': str(self.root), 'GITHUB_ACTIONS': 'true',
            'RUNNER_ENVIRONMENT': 'github-hosted', 'REAL_PROVIDER_SECRET': 'must-not-be-forwarded',
        })
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.stack = FakeStack()
        self.original = b'original stored image fixture'
        self.variant = b'smaller stored image fixture'
        self.storage = {
            '/bigbike-media/uploads/fixed-id/image.png': (self.original, 'image/png'),
            '/bigbike-media/uploads/fixed-id/image.thumb.png': (self.variant, 'image/png'),
        }
        self.fixtures = {'products': [{'id': 'fixed-product-id'}], 'media': {
            'id': 'fixed-media-id', 'filePath': 'uploads/fixed-id/image.png',
            'sizes': json.dumps({'thumb': '/media/uploads/fixed-id/image.thumb.png'}),
        }}
        self.archive = b'PGDMP synthetic database archive with fixed UUIDs/timestamps/sessions'
        self.restored_archives = []

    def fake_process(self, command, **kwargs):
        self.assertNotIn('REAL_PROVIDER_SECRET', kwargs['env'])
        self.assertEqual(command[command.index('-p') + 1], self.stack.project)
        if 'pg_dump' in command:
            self.assertIn('--format=custom', command)
            kwargs['stdout'].write(self.archive)
        if 'pg_restore' in command:
            self.assertIn('--clean', command)
            self.assertIn('--if-exists', command)
            self.assertIn('--exit-on-error', command)
            self.restored_archives.append(kwargs['stdin'].read())
        return SimpleNamespace(returncode=0, stdout=b'', stderr=b'')

    def fake_storage(self, origin, password, method, path, body=b'', content_type=None):
        self.assertEqual(origin, 'http://localhost:19000')
        self.assertEqual(password, self.stack.password)
        if method == 'PUT':
            self.storage[path] = (body, content_type)
            return b'', {}
        content, mime = self.storage[path]
        return content, {'Content-Type': mime, 'Last-Modified': 'different wall clock, not identity'}

    def capture(self):
        with patch.object(dataset.subprocess, 'run', side_effect=self.fake_process), \
                patch.object(dataset, 'signed_request', side_effect=self.fake_storage):
            return dataset.capture(self.stack, self.fixtures, self.private)

    def test_round_trip_reuses_exact_archive_keys_bytes_and_mime_privately(self):
        snapshot = self.capture()
        directory = Path(snapshot['private_directory'])
        self.assertEqual(directory.stat().st_mode & 0o777, 0o700)
        self.assertEqual((directory / 'database.dump').stat().st_mode & 0o777, 0o600)
        for record in snapshot['objects']:
            self.assertEqual((directory / record['filename']).stat().st_mode & 0o777, 0o600)
        self.storage.clear()
        self.stack.project = 'bbperf-123-1-after'
        with patch.object(dataset.subprocess, 'run', side_effect=self.fake_process), \
                patch.object(dataset, 'signed_request', side_effect=self.fake_storage):
            restored = dataset.restore(self.stack, snapshot)
        self.assertEqual(self.restored_archives, [self.archive])
        self.assertEqual(self.storage['/bigbike-media/uploads/fixed-id/image.png'], (self.original, 'image/png'))
        self.assertEqual(self.storage['/bigbike-media/uploads/fixed-id/image.thumb.png'], (self.variant, 'image/png'))
        self.assertEqual(restored, dataset.identity(snapshot))
        self.assertEqual(restored['media_objects'], 2)
        self.assertEqual(restored['database_archive_sha256'], hashlib.sha256(self.archive).hexdigest())
        public = json.dumps(restored)
        for sensitive in ('private', 'fixed-id', 'sessions', self.stack.password, str(self.root)):
            self.assertNotIn(sensitive, public)

    def test_accepts_multiple_media_records_and_deduplicates_shared_variant_keys(self):
        self.fixtures['media'] = [self.fixtures['media'], dict(self.fixtures['media'])]
        snapshot = self.capture()
        self.assertEqual(len(snapshot['objects']), 2)
        self.assertEqual(dataset.identity(snapshot)['fixture_media_records'], 2)

    def test_rejects_changed_private_files_before_any_restore_write(self):
        snapshot = self.capture()
        record = snapshot['objects'][0]
        (Path(snapshot['private_directory']) / record['filename']).write_bytes(b'tampered')
        with patch.object(dataset.subprocess, 'run') as process, patch.object(dataset, 'signed_request') as storage:
            with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
                dataset.restore(self.stack, snapshot)
            process.assert_not_called()
            storage.assert_not_called()

    def test_rejects_running_backend_before_restoring_database_or_media(self):
        snapshot = self.capture()
        with patch.object(dataset.subprocess, 'run', return_value=SimpleNamespace(returncode=0, stdout=b'backend-id', stderr=b'')) as process, \
                patch.object(dataset, 'signed_request') as storage:
            with self.assertRaisesRegex(ValueError, 'before starting'):
                dataset.restore(self.stack, snapshot)
            self.assertEqual(process.call_count, 1)
            self.assertNotIn('pg_restore', process.call_args.args[0])
            storage.assert_not_called()

    def test_refuses_local_execution_shared_projects_and_unsafe_paths(self):
        for environment in ({'GITHUB_ACTIONS': '', 'RUNNER_ENVIRONMENT': ''},
                            {'GITHUB_ACTIONS': 'true', 'RUNNER_ENVIRONMENT': 'self-hosted'}):
            with patch.dict(os.environ, environment), patch.object(dataset.subprocess, 'run') as process:
                with self.assertRaises(ValueError):
                    dataset.capture(self.stack, self.fixtures, self.private)
                process.assert_not_called()
        self.stack.project = 'bigbike'
        with self.assertRaises(ValueError):
            dataset.capture(self.stack, self.fixtures, self.private)
        self.stack.project = 'bbperf-123-1-before'
        with self.assertRaises(ValueError):
            dataset.capture(self.stack, self.fixtures, self.root.parent / 'outside')
        for path in ('https://bigbike.vn/media/uploads/image.png', '/media/uploads/../secret', '/media/uploads/x?token=value'):
            self.fixtures['media']['sizes'] = {'thumb': path}
            with self.subTest(path=path), patch.object(dataset.subprocess, 'run') as process:
                with self.assertRaises(ValueError):
                    dataset.capture(self.stack, self.fixtures, self.private)
                process.assert_not_called()

    def test_refuses_compose_command_for_another_project(self):
        with patch.object(self.stack, 'compose_command', return_value=['docker', 'compose', '-p', 'bigbike', 'exec']), \
                patch.object(dataset.subprocess, 'run') as process:
            with self.assertRaisesRegex(ValueError, 'exactly the job-owned'):
                dataset.capture(self.stack, self.fixtures, self.private)
            process.assert_not_called()

    def test_database_errors_are_sanitized(self):
        with patch.object(dataset.subprocess, 'run', return_value=SimpleNamespace(returncode=1, stderr=b'private session value')):
            with self.assertRaisesRegex(RuntimeError, '^Private CI dataset command failed$'):
                dataset.capture(self.stack, self.fixtures, self.private)


if __name__ == '__main__':
    unittest.main()
