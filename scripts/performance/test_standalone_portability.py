from pathlib import Path
import tempfile
import unittest

from check_standalone import host_anchor_count, inspect


class StandalonePortabilityTest(unittest.TestCase):
    def test_build_host_css_require_is_detected_before_native_probe(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / '.next/standalone'
            root.mkdir(parents=True)
            (root / 'server.js').write_text('server')
            (root / 'chunk.js').write_text('createRequire("file:///build/source/node_modules/css-tree/lib/data-patch.js")("../data/patch.json")')
            result = inspect(tmp)
            self.assertFalse(result['portable'])
            self.assertEqual(result['failure_code'], 'STANDALONE_BUILD_HOST_CSS_ANCHOR')
            self.assertNotIn('/build/source', str(result))

    def test_normal_package_sources_and_source_maps_are_not_deployable_chunks(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'node_modules/css-tree/lib').mkdir(parents=True)
            text = '"file:///build/source/node_modules/css-tree/lib/data.js"'
            (root / 'node_modules/css-tree/lib/data.js').write_text(text)
            (root / 'chunk.js.map').write_text(text)
            (root / 'chunk.js').write_text('module.exports=require("css-tree")')
            self.assertEqual(host_anchor_count(root), 0)

    def test_relative_symlink_cannot_restore_access_to_original_build_data(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / '.next/standalone'
            root.mkdir(parents=True)
            (root / 'server.js').write_text('server')
            (Path(tmp) / 'private-data.json').write_text('private-build-value')
            (root / 'patch.json').symlink_to('../../private-data.json')
            result = inspect(tmp)
            self.assertEqual(result['failure_code'], 'STANDALONE_NONPORTABLE_SYMLINK')
            self.assertFalse(result['portable'])
            self.assertNotIn('private-build-value', str(result))
