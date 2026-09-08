import importlib.util
from pathlib import Path
import unittest
import argparse
import copy
import hashlib
import json
import tempfile
import contextlib
import io
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('image_migration', Path(__file__).with_name('migrate-product-images.py'))
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)
OLD = 'https://legacy.example.test/wp-content/uploads/glove.jpg'
NEW = {'id': 'registered-id', 'url': '/media/uploads/glove.webp', 'mimeType': 'image/webp', 'width': 800, 'height': 600}


class ImageMigrationTest(unittest.TestCase):
    def replacement(self, value):
        return NEW if value == OLD else None

    def test_only_image_fields_change_and_both_languages_keep_copy(self):
        original = {'image_url': OLD, 'image_id': '123', 'image_mime_type': 'image/jpeg',
                    'description': f'<p>Găng tay có lót</p><img src="{OLD}" alt="Găng tay">',
                    'description_en': f'<img src="{OLD}"><p>Lined gloves</p>',
                    'gallery': [{'mediaType': 'image', 'image': {'id': '123', 'url': OLD, 'alt': 'Gloves'}},
                                {'mediaType': 'video', 'videoUrl': OLD, 'title': 'Do not change', 'image': {'url': OLD}}]}
        changed = migration.rewrite_fields(original, self.replacement)
        self.assertEqual(changed['image_id'], 'registered-id')
        self.assertIn('<p>Găng tay có lót</p>', changed['description'])
        self.assertIn('<p>Lined gloves</p>', changed['description_en'])
        self.assertEqual(changed['gallery'][1], original['gallery'][1])
        self.assertEqual(changed['gallery'][0]['image']['alt'], 'Gloves')
        self.assertEqual(original['image_url'], OLD)

    def test_html_srcset_and_structured_sections_are_rewritten_without_video_urls(self):
        value = {'description_blocks': [{'type': 'image', 'url': OLD}, {'type': 'video', 'url': OLD}],
                 'size_guide_section': {'html': f'<img srcset="{OLD} 1x, {OLD} 2x">'},
                 'description': f'<video src="{OLD}"><source src="{OLD}"></video>'}
        changed = migration.rewrite_fields(value, self.replacement)
        self.assertEqual(changed['description'], value['description'])
        self.assertEqual(changed['description_blocks'][1], value['description_blocks'][1])
        self.assertEqual(set(changed['description_blocks'][0]), {'type', 'url'})
        self.assertNotIn(OLD, changed['size_guide_section']['html'])

    def test_source_scope_rejects_other_hosts_and_skips_managed_images(self):
        origins = ['https://legacy.example.test']
        self.assertEqual(migration.legacy_url('/wp-content/uploads/glove.jpg', origins), OLD)
        for value in ['data:image/png;base64,abc', 'https://other.example.test/wp-content/uploads/glove.jpg',
                      '/media/wp-content/uploads/glove.jpg', '/wp-content/uploads/video.mp4']:
            self.assertIsNone(migration.legacy_url(value, origins))
        with self.assertRaises(ValueError):
            migration.legacy_url('/wp-content/uploads/%2e%2e/secret.jpg', origins)

    def test_private_and_mixed_dns_answers_are_blocked_before_network(self):
        from urllib.parse import urlsplit
        addresses = [(2, 1, 6, '', ('93.184.216.34', 443)), (2, 1, 6, '', ('127.0.0.1', 443))]
        with patch.object(migration.socket, 'getaddrinfo', return_value=addresses):
            with self.assertRaises(ValueError):
                migration.public_address(urlsplit(OLD))

    def test_sql_values_are_quoted_and_conflicts_do_not_overwrite_later_edits(self):
        self.assertEqual(migration.sql_text("x'; DROP TABLE products; --"), "'x''; DROP TABLE products; --'")
        row = {'table': 'products', 'id': 'fixture', 'productId': 'fixture', 'before': {'image_url': OLD}}
        with patch.object(migration, 'database', side_effect=[[{'image_url': OLD}], ['fixture', 0]]) as db:
            with self.assertRaisesRegex(RuntimeError, 'CONFLICT'):
                migration.compare_and_swap(row, row['before'], {'image_url': NEW['url']})
            self.assertIn('jsonb_build_object', db.call_args.args[0])
            self.assertIn('FOR UPDATE', db.call_args.args[0])


class ImageMigrationResumeTest(unittest.TestCase):
    def test_resume_and_rollback_keep_the_manifest_and_avoid_second_upload_or_write(self):
        identity = ['isolated-test', '127.0.0.1', 5432]
        before = {'image_url': OLD, 'description': '<p>Găng tay</p>'}
        current = copy.deepcopy(before)
        with tempfile.TemporaryDirectory(prefix='bigbike-image-test-') as directory:
            manifest = Path(directory) / 'manifest.json'
            migration.atomic_save(manifest, {'version': migration.VERSION,
                'databaseIdentity': hashlib.sha256(json.dumps(identity).encode()).hexdigest(),
                'origins': ['https://legacy.example.test'], 'media': {},
                'rows': [{'table': 'products', 'id': 'fixture', 'productId': 'fixture', 'before': before, 'sources': [OLD], 'state': 'PLANNED'}]})
            self.assertEqual(manifest.stat().st_mode & 0o777, 0o600)
            def cas(row, expected, replacement):
                self.assertEqual(current, expected)
                # Before/after are already durable at the moment of the first DB write.
                saved = json.loads(manifest.read_text())['rows'][0]
                self.assertEqual(saved['before'], before)
                self.assertIn('after', saved)
                current.clear()
                current.update(copy.deepcopy(replacement))
            args = argparse.Namespace(command='apply', manifest=str(manifest), api_base='https://api.example.test/api/v1', source_origin=[])
            with patch.object(migration, 'database', return_value=[identity]), patch.object(migration, 'row_current', side_effect=lambda row: [copy.deepcopy(current)]), patch.object(migration, 'compare_and_swap', side_effect=cas) as write, patch.object(migration, 'import_media', return_value=NEW) as upload, patch.object(migration, 'api_request', side_effect=[RuntimeError('temporary refresh failure'), {}, {}]), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(migration.run(args), 1)
                self.assertEqual(json.loads(manifest.read_text())['rows'][0]['state'], 'REFRESH_PENDING')
                self.assertEqual(migration.run(args), 0)
                self.assertEqual(upload.call_count, 1)
                self.assertEqual(write.call_count, 1)
                self.assertEqual(current['description'], before['description'])
                args.command = 'rollback'
                self.assertEqual(migration.run(args), 0)
                self.assertEqual(current, before)
                self.assertEqual(write.call_count, 2)
                self.assertEqual(json.loads(manifest.read_text())['rows'][0]['state'], 'ROLLED_BACK')

    def test_rollback_conflict_preserves_a_later_image_edit(self):
        identity = ['isolated-test', '127.0.0.1', 5432]
        with tempfile.TemporaryDirectory(prefix='bigbike-image-test-') as directory:
            path = Path(directory) / 'manifest.json'
            migration.atomic_save(path, {'version': migration.VERSION,
                'databaseIdentity': hashlib.sha256(json.dumps(identity).encode()).hexdigest(), 'media': {},
                'rows': [{'table': 'products', 'id': 'fixture', 'productId': 'fixture', 'state': 'APPLIED',
                          'before': {'image_url': OLD}, 'after': {'image_url': NEW['url']}}]})
            args = argparse.Namespace(command='rollback', manifest=str(path), api_base='https://api.example.test/api/v1')
            with patch.object(migration, 'database', return_value=[identity]), patch.object(migration, 'row_current', return_value=[{'image_url': '/media/later.webp'}]), patch.object(migration, 'compare_and_swap') as write, patch.object(migration, 'api_request') as api, contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(migration.run(args), 1)
                write.assert_not_called()
                api.assert_not_called()
                self.assertIn('CONFLICT', json.loads(path.read_text())['rows'][0]['error'])


if __name__ == '__main__':
    unittest.main()
