from copy import deepcopy
import unittest
from reuse_frontend_gates import ANCHOR, REPOSITORY, WORKFLOW, frontend_block, successful_jobs


class ReuseProofTest(unittest.TestCase):
    def setUp(self):
        self.run = {'head_sha': ANCHOR, 'path': WORKFLOW, 'status': 'completed',
                    'repository': {'full_name': REPOSITORY, 'private': False}}
        self.jobs = {'jobs': [{'name': f'Frontend regression gates ({app})', 'conclusion': 'success',
            'steps': [{'name': name, 'conclusion': 'success'} for name in (
                'Unit regressions', 'Preserve only sanitized counts and enforce no skips',
                'Run npm run lint > private', 'Run npm run build > private')]}
            for app in ('bigbike-web', 'bigbike-admin')]}

    def test_can_reuse_successful_frontends_even_when_unrelated_backend_failed(self):
        self.run['conclusion'] = 'failure'
        self.assertTrue(successful_jobs(self.run, self.jobs))

    def test_refuses_changed_revision_missing_job_and_skipped_or_failed_required_step(self):
        changed = deepcopy(self.run)
        changed['head_sha'] = 'b' * 40
        self.assertFalse(successful_jobs(changed, self.jobs))
        self.assertFalse(successful_jobs(self.run, {'jobs': self.jobs['jobs'][:1]}))
        for conclusion in ('skipped', 'failure'):
            jobs = deepcopy(self.jobs)
            jobs['jobs'][0]['steps'][1]['conclusion'] = conclusion
            self.assertFalse(successful_jobs(self.run, jobs))

    def test_definition_guard_ignores_only_the_resume_condition(self):
        original = '\n  frontend:\n    needs: boundary\n    env: original\n  backend:\n'
        resumed = original.replace('    needs: boundary', "    if: needs.boundary.outputs.reuse_frontend != 'true'\n    needs: boundary")
        self.assertEqual(frontend_block(original), frontend_block(resumed))
        self.assertNotEqual(frontend_block(original), frontend_block(resumed.replace('env: original', 'env: changed')))
