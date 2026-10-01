"""Verify a return source directory or safely fresh-extract and verify its ZIP.
No network, credentials, providers or source changes are performed.
"""
import pathlib,json,hashlib,zipfile,tempfile,unicodedata,stat,sys
EXCLUDE={'.git','.isolation','node_modules'}
TOP='hanaworlds-contracts-0.1.0-v2-return'
def sha(data):return hashlib.sha256(data).hexdigest()
def verify(root):
    manifest=json.loads((root/'RETURN_MANIFEST.json').read_text())
    required=['identity','disposition','repositories','commands','artifacts','acceptanceResults','limitations','reportOnlyClaims','unresolvedFindings','omittedRequestedItems','crossLineRequests','dependencyClosure','offlineClosure','isolationEnvironment','rollback','reviewOrder','repairBudgetUsed','externalActions']
    assert all(k in manifest for k in required)
    assert manifest['identity']['inputZipSha256']=='b82331e1c74b21c6ed9d131f99d19b2b78c76982e88a90e875568cb365d372fb'
    assert manifest['identity']['inputBaselineDigest']=='089672880d50719efbdacd60e8d96fffd2603d2a5c352742822accade9cf51d4'
    assert len(manifest['repositories'])==1 and manifest['repositories'][0]['origin'] is None
    assert all(manifest['externalActions'][key] is False for key in ['originCreated','pushed','published','deployed','loggedIn','credentialsRead','eulaAccepted','liveWorldTouched','nonLoopbackExposed'])
    repo=manifest['repositories'][0]
    assert (root/'SOURCE_REVISION').read_text().strip()==repo['returnCommit']
    checks={}
    for line in (root/'FILE_SHA256SUMS').read_text().splitlines():
        digest,rel=line.split('  ',1);p=pathlib.PurePosixPath(rel)
        assert len(digest)==64 and not p.is_absolute() and '..' not in p.parts and rel not in checks
        checks[rel]=digest
    actual={p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() and not any(x in EXCLUDE for x in p.relative_to(root).parts) and p.relative_to(root).as_posix()!='FILE_SHA256SUMS'}
    assert set(checks)==actual, {'missing':sorted(actual-set(checks)),'extra':sorted(set(checks)-actual)}
    for rel,digest in checks.items():assert sha((root/rel).read_bytes())==digest,rel
    source=json.loads((root/'evidence/source-tree.json').read_text())
    ordered=sorted(source['files'],key=lambda x:x['path'].encode('utf8'));preimage=b''
    for item in ordered:
        assert sha((root/item['path']).read_bytes())==item['sha256'],item['path']
        preimage+=item['path'].encode()+b'\0'+item['sha256'].encode('ascii')+b'\n'
    assert sha(preimage)==repo['sourceTreeDigest']
    for item in manifest['artifacts']:
        assert sha((root/item['path']).read_bytes())==item['sha256']
    for command in manifest['commands']:
        assert sha((root/command['rawOutputPath']).read_bytes())==command['rawOutputSha256'],command['id']
    for filename in ['RETURN_SUMMARY.md','REMOTE_REPORT.md','SELF_VALIDATION.md','reports/SPEC_REVIEW.md','reports/QUALITY_REVIEW.md','reports/UNRESOLVED.md','reports/CROSS_LINE_REQUESTS.md']:
        assert (root/filename).is_file() and (root/filename).stat().st_size>0
    if manifest['disposition']['status']=='CONTRACT_GAP':
        for filename in ['reports/CONTRACT_GAPS.json','reports/CONTRACT_GAP_PROPOSALS.json']:assert (root/filename).is_file()
    return {'result':'PASS','evidence':'SOURCE','filesIncludingChecksum':len(checks)+1,'checksumVerified':True,'sourceFilesVerified':len(ordered),'sourceTreeDigest':repo['sourceTreeDigest'],'sourceCommit':repo['returnCommit'],'artifactCount':len(manifest['artifacts']),'commandLogsVerified':len(manifest['commands']),'providerRuntime':'NOT_RUN'}
if len(sys.argv)>2 and sys.argv[1]=='--zip':
    with tempfile.TemporaryDirectory(prefix='hanaworlds-fresh-') as tmp:
        base=pathlib.Path(tmp);seen=set();folded=set()
        with zipfile.ZipFile(sys.argv[2]) as z:
            for i in z.infolist():
                p=pathlib.PurePosixPath(i.filename);assert not p.is_absolute() and p.parts[0]==TOP and '..' not in p.parts and '\\' not in i.filename
                mode=i.external_attr>>16;assert not stat.S_ISLNK(mode)
                if i.is_dir():continue
                key=unicodedata.normalize('NFC',i.filename).casefold();assert i.filename not in seen and key not in folded
                seen.add(i.filename);folded.add(key);dest=base.joinpath(*p.parts);dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(z.read(i))
        result=verify(base/TOP);result.update({'freshExtraction':True,'uniqueTopLevel':TOP,'pathCollisions':0,'links':0});print(json.dumps(result))
else:print(json.dumps(verify(pathlib.Path(sys.argv[1] if len(sys.argv)>1 else '.').resolve())))
