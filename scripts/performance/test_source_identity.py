from pathlib import Path
import subprocess
import tempfile
import unittest
from run_ci import tracked_identities


class SourceIdentityTest(unittest.TestCase):
    def test_gitlink_is_preserved_by_oid_without_reading_directory(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            subprocess.run(['git', 'init', '-q', tmp], check=True)
            Path(tmp, 'source.txt').write_text('source')
            subprocess.run(['git', '-C', tmp, 'add', 'source.txt'], check=True)
            oid = 'a' * 40
            subprocess.run(['git', '-C', tmp, 'update-index', '--add', '--cacheinfo',
                            '160000,' + oid + ',editor-worktree'], check=True)
            result = tracked_identities(root)
            self.assertEqual(result['editor-worktree'], 'gitlink:' + oid)
            self.assertEqual(len(result['source.txt']), 64)
