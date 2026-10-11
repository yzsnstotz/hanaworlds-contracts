import {
 pluginRoles,derivePluginRoles,pluginRolesResponse,pluginRolesUnavailable,createPluginRolesMock,validateBoundResponse,
 type ReadPluginRolesRequest,type ReadPluginRolesResponse,type PluginRoles,type PluginRole,type PluginRolesStatus,type RegisteredPluginService
} from 'hanaworlds-contracts';
const request:ReadPluginRolesRequest={contractVersion:'world-inspection/v1',requestId:'r'};
const services:RegisteredPluginService[]=[{name:'hanaworldsCanvasV5',moduleName:'hanaworlds-canvas'}];
const roles:PluginRoles=derivePluginRoles({services,skills:[{name:'hanaworlds-building',provider:'hanaworlds-skills'}]});
const status:PluginRolesStatus=roles.status;
const canvas:ReadonlyArray<string>=roles.providers.canvas;
const missing:ReadonlyArray<PluginRole>=roles.missingRoles;
const ok:ReadPluginRolesResponse=pluginRolesResponse(request,roles);
const failed:ReadPluginRolesResponse=pluginRolesUnavailable(request);
validateBoundResponse('world-inspection/v1','ReadPluginRoles',request,ok);
const mock=createPluginRolesMock({services});
const answered:ReadPluginRolesResponse=mock('world-inspection/v1','ReadPluginRoles',request);
const unreadable=createPluginRolesMock({unreadable:true});
const all:ReadonlyArray<PluginRole>=pluginRoles.requiredRoles;
// @ts-expect-error an undeclared role is not a PluginRole.
const model:PluginRole='model';
// @ts-expect-error providers carry no versions.
const versioned:PluginRoles={...roles,versions:{}};
// @ts-expect-error the mock answers only ReadPluginRoles.
mock('world-inspection/v1','ReadInspectionContext',request);
void [status,canvas,missing,failed,answered,unreadable,all,model,versioned];
