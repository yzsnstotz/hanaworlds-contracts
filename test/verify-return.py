"""Regression fixtures for the original return verifier; never approval proof."""
import hashlib
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest
import zipfile

REPO = pathlib.Path(__file__).resolve().parents[1]
VERIFIER = REPO / 'tools/verify-return.py'
TOP = 'hanaworlds-contracts-0.1.0-v2-return'

def sha(data):
    return hashlib.sha256(data).hexdigest()

class NestedChecksumRegression(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='contracts-return-regression-')
        self.base = pathlib.Path(self.tmp.name)
        self.root = self.base / TOP
        self.root.mkdir()
        self.files = {
            'SOURCE_REVISION': b'fixture-source-revision\n',
            'spec/FILE_SHA256SUMS': b'fixture nested authority checksum\n',
            'artifacts/fixture.tgz': b'fixture artifact bytes',
            'evidence/command.log': b'fixture command output\n',
        }
        for name in ['RETURN_SUMMARY.md', 'REMOTE_REPORT.md', 'SELF_VALIDATION.md',
                     'reports/SPEC_REVIEW.md', 'reports/QUALITY_REVIEW.md',
                     'reports/UNRESOLVED.md', 'reports/CROSS_LINE_REQUESTS.md']:
            self.files[name] = b'FIXTURE ONLY; no approval or runtime claim.\n'
        source_files = [{'path': 'spec/FILE_SHA256SUMS', 'sha256': sha(self.files['spec/FILE_SHA256SUMS'])}]
        source_digest = sha(b''.join(x['path'].encode() + b'\0' + x['sha256'].encode() + b'\n' for x in source_files))
        self.files['evidence/source-tree.json'] = json.dumps({'files': source_files}).encode()
        required = ['dependencyClosure', 'offlineClosure', 'isolationEnvironment', 'rollback', 'reviewOrder',
                    'repairBudgetUsed', 'limitations', 'acceptanceResults', 'reportOnlyClaims',
                    'unresolvedFindings', 'omittedRequestedItems', 'crossLineRequests']
        manifest = {key: {} for key in required}
        manifest.update({
            'identity': {'inputZipSha256': 'b82331e1c74b21c6ed9d131f99d19b2b78c76982e88a90e875568cb365d372fb',
                         'inputBaselineDigest': '089672880d50719efbdacd60e8d96fffd2603d2a5c352742822accade9cf51d4'},
            'disposition': {'status': 'FIXTURE'},
            'repositories': [{'origin': None, 'returnCommit': 'fixture-source-revision', 'sourceTreeDigest': source_digest}],
            'commands': [{'id': 'fixture', 'rawOutputPath': 'evidence/command.log', 'rawOutputSha256': sha(self.files['evidence/command.log'])}],
            'artifacts': [{'path': 'artifacts/fixture.tgz', 'sha256': sha(self.files['artifacts/fixture.tgz'])}],
            'externalActions': {key: False for key in ['originCreated', 'pushed', 'published', 'deployed', 'loggedIn',
                               'credentialsRead', 'eulaAccepted', 'liveWorldTouched', 'nonLoopbackExposed']},
        })
        self.files['RETURN_MANIFEST.json'] = json.dumps(manifest).encode()
        self.files['FILE_SHA256SUMS'] = ''.join(sha(content) + '  ' + path + '\n' for path, content in sorted(self.files.items())).encode()
        for path, content in self.files.items():
            dest = self.root / path
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(content)

    def tearDown(self):
        self.tmp.cleanup()

    def run_verifier(self, zipped=False):
        args = [sys.executable, str(VERIFIER)]
        if zipped:
            archive = self.base / 'fixture.zip'
            with zipfile.ZipFile(archive, 'w') as z:
                for path in sorted(self.root.rglob('*')):
                    if path.is_file():
                        z.write(path, TOP + '/' + path.relative_to(self.root).as_posix())
            args += ['--zip', str(archive)]
        else:
            args += [str(self.root)]
        return subprocess.run(args, capture_output=True, text=True)

    def assert_accepted(self, result):
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual(report['result'], 'PASS')
        self.assertEqual(report['filesIncludingChecksum'], len(self.files))
        self.assertTrue(report['checksumVerified'])
        self.assertEqual(report['sourceFilesVerified'], 1)

    def test_directory_keeps_nested_checksum_and_excludes_only_root(self):
        self.assert_accepted(self.run_verifier())

    def test_zip_keeps_nested_checksum_and_excludes_only_root(self):
        result = self.run_verifier(zipped=True)
        self.assert_accepted(result)
        self.assertTrue(json.loads(result.stdout)['freshExtraction'])

    def assert_nested_tamper_rejected(self, zipped):
        (self.root / 'spec/FILE_SHA256SUMS').write_bytes(b'tampered nested authority checksum\n')
        result = self.run_verifier(zipped=zipped)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('AssertionError: spec/FILE_SHA256SUMS', result.stderr)

    def test_directory_nested_checksum_tamper_is_rejected(self):
        self.assert_nested_tamper_rejected(zipped=False)

    def test_zip_nested_checksum_tamper_is_rejected(self):
        self.assert_nested_tamper_rejected(zipped=True)

if __name__ == '__main__':
    unittest.main(verbosity=2)
