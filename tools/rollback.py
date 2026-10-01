"""Remove only worker-created controlled consumer/clone fixtures, never host data."""
import pathlib,json,shutil,sys
root=pathlib.Path('.').resolve();base=root/'.isolation';targets=sys.argv[1:] or ['package-install','artifact-consumer']
assert targets and all(x in ['package-install','artifact-consumer','clean-source'] for x in targets)
removed=[]
for name in targets:
    p=base/name
    assert p.parent==base and not p.is_symlink()
    before=sorted(str(x.relative_to(p)) for x in p.rglob('*') if x.is_file()) if p.exists() else []
    shutil.rmtree(p,ignore_errors=True);p.mkdir(parents=True,exist_ok=True)
    assert list(p.iterdir())==[]
    removed.append({'target':str(p.relative_to(root)),'baseline':'empty controlled directory','filesRemoved':len(before),'remainingFiles':[],'result':'EMPTY_BASELINE_RESTORED'})
report={'evidence':'PACKAGE_REAL_RUNTIME','scope':'worker-created temporary test directories only','actualSuccessfulNpmInstallBeforeRollback':False,'providerRollback':'NOT_RUN','realEnvironmentChanged':False,'targets':removed}
(root/'evidence/rollback.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
