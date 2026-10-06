import {validateMaterialSources,digestValue,validateStaticMaterials} from 'hanaworlds-contracts';
import type {Catalogue,MaterialSourceFactsPort,MaterialSourceConnection,MaterialSourcesProjection,MaterialSources,MaterialMap} from 'hanaworlds-contracts';
export async function read(port:MaterialSourceFactsPort,cat:Catalogue,current:MaterialSourceConnection):Promise<MaterialSources>{
 const verified=validateMaterialSources(await port.readMaterialSources(current.worldRef),cat,current);
 const {sourceRevision,...projection}=verified.snapshot;
 const exact:MaterialSourcesProjection=projection;
 const digest:string=digestValue('material-sources',exact).sha256;
 const statics:MaterialMap={stone:{nodeName:'fixture:stone',param2:0}};
 validateStaticMaterials(statics,cat);
 for(const row of verified.snapshot.materials){
  if(row.availability==='KNOWN'){const hash:string=row.texture.bytesDigest;const p:number=row.param2;void hash;void p;}
  else{const unavailable:null=row.texture;const reason:string=row.reason;void unavailable;void reason;}
 }
 const bytes:Uint8Array|undefined=verified.textures[0]?.bytes;void bytes;void digest;void sourceRevision;
 return verified;
}
// @ts-expect-error MediaBinding and JSON arrays are not actual texture bytes.
const jsonBytes:MaterialSources['textures']=[{bytesDigest:'0'.repeat(64),bytes:[1,2,3]}];
void jsonBytes;
