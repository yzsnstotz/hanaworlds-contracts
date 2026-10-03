"""Independent installed Python Draft7 validator, not the production JS walker.
No remote $ref retrieval: each schema is a self-contained document.
"""
import json, pathlib, sys, importlib.metadata
try:
    import jsonschema
except ImportError:
    print(json.dumps({'status':'BLOCKED','reason':'Independent jsonschema tool unavailable'})); sys.exit(1)
r=pathlib.Path('.')
samples=json.loads((r/'evidence/schema-samples.json').read_text())['samples']
results=[]
for item in samples:
    schema=json.loads((r/f"schemas/{item['name']}.schema.json").read_text())
    try:
        jsonschema.Draft7Validator.check_schema(schema)
        jsonschema.Draft7Validator(schema).validate(item['value'])
        results.append({'type':item['name'],'status':'PASS'})
    except Exception as e: results.append({'type':item['name'],'status':'FAIL','error':str(e)[:1800]})
report={'evidence':'FIXTURE','tool':'python-jsonschema','toolVersion':importlib.metadata.version('jsonschema'),'schemaOnly':True,'noDomainOrProviderClaim':True,'samples':len(samples),'results':results}
(r/'evidence/independent-schema-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='results'}))
print(json.dumps({'PASS':sum(x['status']=='PASS' for x in results),'FAIL':sum(x['status']=='FAIL' for x in results)}))
if any(x['status']!='PASS' for x in results):sys.exit(1)
