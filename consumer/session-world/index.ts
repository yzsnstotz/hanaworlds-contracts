// Typed consumer of session-world-seam/v1 from the installed package root (compile-only).
import {validateBoundResponse,requireSessionDeleteSupported,requireWorldRetirable,describeSelectionConnection,sessionWorldSeam} from 'hanaworlds-contracts';
import type {SessionIdentity,SessionDirectory,WorldSelectionInventory,WorldRetirementReservation,WorldRetirementOutcome,SessionSelectionRetirement,SelectionConnectionState,UnselectWorldConnectionRequest,OperationMap} from 'hanaworlds-contracts';
type Read=OperationMap['session/v4']['ReadSessionIdentity'];
type Unselect=OperationMap['canvas/v6']['UnselectWorldConnection'];
const identity:SessionIdentity={sessionRef:'s',sessionRevision:'1'};
const directory:SessionDirectory={directoryRevision:'d',sessions:[identity]};
const inventory:WorldSelectionInventory={worldRef:'w',inventoryRevision:'1',sessionRefs:[],retirementReservationRef:null};
const outcome:WorldRetirementOutcome='ABORTED';
const reservation:WorldRetirementReservation={worldRef:'w',reservationRef:'r',inventoryRevision:'1'};
const retirement:SessionSelectionRetirement={sessionRef:'s',releasedWorldRef:null,selectionRevision:'2'};
const req:UnselectWorldConnectionRequest={contractVersion:'canvas/v6',sessionRef:'s',requestId:'q',worldRef:'w',expectedRevision:'1',expectedContext:{connectionRef:'c',connectionIncarnationRef:'i',worldRef:'w',selectionRevision:'1'}};
const r:Read['request']={contractVersion:'session/v4',requestId:'q',sessionRef:'s'};
const u:Unselect['request']=req;
const checked:WorldSelectionInventory=requireWorldRetirable(inventory);
const state:SelectionConnectionState=describeSelectionConnection({sessionRef:'s',sessionRevision:'1',status:'UNBOUND'},{capabilityRevision:'1',connections:[]});
const c1:string=sessionWorldSeam.clarifications.C1;
void [requireSessionDeleteSupported,directory,outcome,reservation,retirement,r,u,checked,state,c1,validateBoundResponse];
