# C-world-inspection · plugin roles in 2.9.0

`world-inspection/v1 ReadPluginRoles` answers, for the running host, which plugins
currently fill each HanaWorlds role. Provider: desktop-bridge. Consumer: shell-ui.
Before 2.9.0 the Shell had only a hand-written `roleProviders` configuration; a renamed
or added plugin was invisible until someone edited it.

Request: `{contractVersion: 'world-inspection/v1', requestId}`.
Result `PluginRoles`:

| field | meaning |
| --- | --- |
| `providers: PluginRoleProviders` | every role → plugins providing it (`moduleName[]`, sorted by code unit, no duplicates; `[]` = no provider) |
| `missingRoles: PluginRole[]` | exactly the required roles with `[]`, in role order |
| `status` | `COMPLETE` (none missing) · `PARTIAL` · `UNAVAILABLE` (every required role missing) |

Roles: `shell-ui`, `world-source`, `canvas`, `brush`, `painter`, `workshop`, `skills`,
`desktop-bridge`, `local-runtime`; all are required. One role may list several plugins and
one plugin may fill several roles. No versions: read them from
`remote.pluginManager.listBundles`.

## How a provider is determined

Only through the published table `pluginRoles.evidence` (role → evidence):

| role | evidence |
| --- | --- |
| shell-ui | service `hanaworldsShellUi` |
| world-source | services `hanaworldsWorldAdapterV6`, `hanaworldsWorldAdapterRegionV1`, `hanaworldsWorldFacts` |
| canvas | services `hanaworldsCanvasV5`, `hanaworldsCanvasRegionV1` |
| brush | service `hanaworldsBrushV3` |
| painter | service `hanaworldsPainterV2PictureBlocks` |
| workshop | services `hanaworldsWorkshop`, `hanaworldsWorkshopV3` |
| skills | skill `hanaworlds-building` (C-skill `buildingSkill.name`) |
| desktop-bridge | services `hanaworldsDesktopBridge`, `hanaworldsWorldInspectionContext` |
| local-runtime | services `hanaworldsWorldLifecycle`, `hanaworldsEngineRuntime` |

* **service** — the provider is the plugin that registered the Cordis service in the running
  host: the loader module specifier (`moduleName`) of the nearest fiber, from the providing
  fiber upward, that carries a loader entry. Only active providing fibers count.
* **skill** — the provider is `SkillSummary.provider` of every live `ctx.skills` catalog entry
  with that name. The DSH skill registry does not expose which plugin registered a skill
  provider, so for this role the identity is the registered skill provider name.

Never inferred from package or bundle names, hand-written configuration or seeds.
`derivePluginRoles({services, skills})` is the pure mapping; the provider only collects the
registrations.

## Failure

A read that cannot be completed (service store unreadable, a providing fiber without a
loader entry, a skill catalog that throws or is incomplete) is the response error
`CAPABILITY_UNAVAILABLE/validate/REQUIRED_FACT_UNKNOWN` with `result: null`; never empty
providers, never a status (`pluginRolesUnavailable`).

## Binding (validateBoundResponse)

| check | refusal |
| --- | --- |
| exactly one of `result`/`error`; the error is a declared one | `SCHEMA_INVALID` |
| `status` and `missingRoles` follow from `providers` | `SCHEMA_INVALID` |
| providers sorted, no duplicates | `NON_CANONICAL_AMBIGUITY` |
| every role key present, no other key, no versions | `SCHEMA_INVALID` / `UNKNOWN_REQUIRED_FIELD` |

## Compatibility

Same package major; `world-inspection` protocol minor 0 → 1. A new operation and new types
only; every old type, operation and digest is unchanged. A 2.8.0 SDK refuses the operation
(`UNSUPPORTED_OPERATION`). Fixture `hanaworlds-contracts/fixtures/plugin-roles`, mock
`createPluginRolesMock`, gate `consumer/plugin-roles` (`npm run test:plugin-roles-consumer -- <abs run dir>`).
