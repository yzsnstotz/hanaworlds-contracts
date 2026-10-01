"""Inventory the actual npm artifact, and optionally extract into a controlled
empty diagnostic directory. Extraction is never called an npm installation.
"""
import pathlib,hashlib,base64,json,tarfile,sys
r=pathlib.Path('.').resolve();pkg=json.loads((r/'package.json').read_text());files=sorted((r/'artifacts').glob(pkg['name']+'-'+pkg['version']+'.tgz'))
assert len(files)==1
p=files[0];data=p.read_bytes();inventory=[];seen=set();folded=set()
with tarfile.open(p,'r:gz') as tar:
    for m in tar.getmembers():
        path=pathlib.PurePosixPath(m.name)
        assert not path.is_absolute() and path.parts[0]=='package' and '..' not in path.parts and '\\' not in m.name
        assert m.isfile(), 'No link/device/special archive members permitted'
        rel=pathlib.PurePosixPath(*path.parts[1:]).as_posix()
        assert rel not in seen and rel.casefold() not in folded
        seen.add(rel);folded.add(rel.casefold());content=tar.extractfile(m).read()
        inventory.append({'path':rel,'bytes':len(content),'sha256':hashlib.sha256(content).hexdigest()})
        if len(sys.argv)>1:
            dest=r/sys.argv[1]/'node_modules/hanaworlds-contracts'/rel
            assert dest.is_relative_to(r/'.isolation')
            dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(content)
result={'path':str(p.relative_to(r)),'version':pkg['version'],'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'packageIntegrity':'sha512-'+base64.b64encode(hashlib.sha512(data).digest()).decode(),'packageFileInventory':sorted(inventory,key=lambda x:x['path'].encode()),'installedByNpm':False,'bundledDependencies':[]}
(r/'evidence/artifact-inventory.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='packageFileInventory'}));print(json.dumps({'packageFileCount':len(inventory),'uniquePackageRoot':True,'links':0,'pathCollisions':0}))
