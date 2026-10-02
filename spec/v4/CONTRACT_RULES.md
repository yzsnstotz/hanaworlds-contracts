# Stage 1 v0.1 — 候选合约规则

## History seam A · v4 response-only field

For history seam A, `world-adapter/v4` keeps the existing history operation set (rc.6 amendment: this sentence is scoped to seam A only; rc.6 separately adds the read-only `InspectRegion` operation, see #first-building-region-v4). `PrepareRecoverableTransactionResponse.result` and authorized `QueryPreparedTransactionResponse.result` use `PreparedTransactionResult`: the original seven-field `PreparedTransaction` plus required `beforeStateReadbackDigest`. Adapter computes `D(readback, readbackView(saved before image))` from the same complete before image and durably saves both before returning PREPARED; Query returns that same saved value after restart without recomputing from the live world. `ApplyCompiledTransactionRequest.preparedTransaction` retains the original seven-field type. Canvas projects those seven fields for Apply, durably binds the separate returned digest to the origin before Apply, and supplies it for same-author history. The Adapter still checks the source-private digest and expected current state before any history write. Unknown/missing fields, old-v3/new-v4 mismatches, revoked permission, unavailable saved state and altered digest fail before effect under the existing precedence. Seam A adds no new operation and no broader history scope.

当前候选身份 `3.0.0-rc.8 / DRAFT_PROPOSAL`；`approval=false / executable=false`。本文件与 `CONTRACT_SCHEMA_PROFILE.json`、`CONTRACT_SEMANTIC_CLOSURE.json` 及 `fixtures/candidate/` 是待完整验证的规范输入，证据仅 `SOURCE/FIXTURE`。目标合约包建议 `hanaworlds-contracts@0.3.0`，Stage 1 产品仍为 v0.1；摘要链尚未完整 conformance，不等于已批准、provider 已存在或 `ACCEPTED`。

## 1. Wire 与字段

本候选七公共协议为 `interaction-surface/v3`、`world-adapter/v4`、`canvas/v4`、`session/v2`、`painter/v3`、`ReferenceBrief/v2`、`BUILD/V2`（rc.7：painter 与 interaction-surface 因破坏性形状变化升主版本；BUILD/V2 接受的 TargetFacts 值集以 `target-facts/v3` 版本化并在 ContractHandshake.factProfiles 中协商）；编译产物保持 `operations/v2`。拒绝不匹配的旧 major、未知 guarantee/required fields；不能静默降级到 v3/v2 mutation。包版本与 wire major 不同。

规范 profile 的 type DSL 是精确 schema 输入：`=value` 为常量，`A|null` 为明确可空，object 的全部字段必填且递归不接受其他字段，map 仅按其声明接受键值，tuple 长度固定。不存在未声明默认值、任意 JSON 的 `any` 或 Worker 自选政策。除明确 `Metadata` 的显示字符串 map 外没有扩展口；metadata 不能承载授权、效果、失败状态或必需能力。所有需要的事实/profile/limits 必须来自真实 provider；null/unknown 不能默认为安全。

profile.operations 给出完整逐操作请求、响应、validationOrder、failureCodes 和成功语义，保留批准版的全部操作语义。它另外显式列出恢复所需的 prepare/query/restore，以及 Core 真删除和当前 Stage 1 产物必需资源存续消费 seam，均非现成 provider 声明。响应 result/error 恰有一个非 null。Painter 的确认不足返回 typed ClarificationNeed；不是猜一个 BUILD。

稳定 ref、revision、documentId、transactionId、materialRef、attachmentRef 和摘要前像内字符串按原码点比较，绝不 trim/lower/NFC。只有名称比较键采用第 4 条。rev 是 opaque token，不能用字符串大小/数值把不同系统 revision 混同。数组保序；声明为集合的数组先拒绝重复再要求规定排序，不静默去重。

## 2. 生产摘要与纯 JSON

既有 19 种摘要沿用原始生产算法和精确 v2 投影（不可因 envelope 升级改变旧摘要）：

`D(kind,payload)=lowerhex(SHA256(UTF8("HanaWorlds|contracts@0.1.0|"+kind+"\n") || UTF8(JCS(exactProjection(payload)))))`

域最后是单个 0A；无 BOM，JCS 后无换行。`canonicalize@5.1.0` 已发布实现直接复用，不自写 canonicalizer；库自身可调用 toJSON，因此先完成 strict UTF8、重复解码 key 拒绝、pure JSON 和领域/schema 校验。原始 `"a"` 与 `"\\u0061"` 重复也拒绝；无 lone surrogate、NaN/Infinity、溢出、undefined/function/prototype/toJSON 输入。数字 JCS 可使 1/1.0、0/-0 等价；坐标额外限制 safe integer，不把此限制冒充所有 RFC 数值规则。字符串签名不做 NFC。对象 key 用 UTF16 code-unit 排序。

19 个既有 kind 的精确字段和全部 nested types 以 profile.digest.projectionTypes 指向的类型为准：build、operations、reference-brief、intent、affected-analysis、authorization-binding、transaction-payload、receipt；frame、catalogue、safety-profile、compilation-config、final-effects、coverage、target-facts、surface-action、saved-work-resources；before-image、readback。新增 `history-operation` 使用 `HanaWorlds|contracts@0.2.0|history-operation\n` 域和精确 `HistoryOperationProjection`。只有各投影明列的自身摘要/metadata/secret envelope 被排除；不能递归删掉名叫 digest 的字段。NodeSpec、controls、confirmedIntent、witness predicate facts、portals、usableVolume、error、metadata/inventory/timer/stateProfile 均在 profile 中有完整字段定义。

所有投影字段存在；明确无值填 null，不用省略。refs 与 input operations/ordered targets/media/slots/path 数组保序；effects/positions 按数值 x,y,z；affected refs/unknownFields 按 UTF16；witnesses 按 witnessId；portal 按 portalRef；资源按 resourceId。set 不能排序洗掉重复。原研究 `contract-gap-audit-v2` 摘要只在 research 参考档，不能作为生产 golden。fixture production-goldens 给出19个完整 payload、JCS、UTF8前像hex与生产 SHA；其内容是自造 FIXTURE，无真实世界/权限证明。

raw JSON严格解码器仍由 Step 2 实现。本地 checker 只核对 published-library 数学、规范/fixture完整性及测试参考名称向量，不冒充 shipped decoder/provider 或完整 RFC 测试套件。

## 3. BUILD、事实、能力与安全

最小公共语言为有序非空 `set_box`，每项精确字段 `op,min,max,materialRef`；三轴 safe integer、min≤max、包含端点，size=max−min+1。单格 min=max；air 是实际 catalogue 显式材料。重叠后写覆盖，最终效果每格一个 NodeSpec、数值 x,y,z 排序。几何计数先 exact integer/BigInt 运算再比较真实 engine/host 能力，不引入通用体量上限、不截断。复杂有限曲面可用单格表达；不发明不同于上游的同名 sphere/cylinder。

节点必须精确解析到该运行世界 registered nodeName，无随机、content_id、时间、网络查材质或未声明 alias；方向 param2 必须由实际表允许。基础可变子集要求有固定 definitionRevision 的无callbacks/无persistent-state事实；必要属性未知或越界副作用未被完整支持时 `UNSUPPORTED_MUTATION_SEMANTICS/NONE`。Adapter 可合并等价最终效果后复用 WorldEdit set/set_param2，任何额外步骤同属恢复范围。Brush 纯编译，不连接/改世界。

Luanti frame 的真实 provider 投影明确整数节点中心、+X right、+Y up、+Z forward、left handed；inclusive cell物理边界 min−0.5 到 max+0.5。Frame gridUnit换米未知可以null，不能把像素猜成米。跨frame只允许明确精确网格映射，非整数不round。Catalogue 不含临时content_id或Lua函数；定义可验证revision与unknownFields不等于推测函数语义。

TargetFacts 是实际 air=knownEmpty、非air=occupied、unloaded/ignore/read failure=unknown 三值；walkable=false的植物仍不等于空。三集合不交且union精确等于覆盖；没有列出的格不能当air。portal/path只在实际6邻接及真实角色尺寸碰撞可通行事实下形成空腔；入口平面可按事实临时封口，天空不冒充室内。所需范围有unknown则usableVolume=null且内部增改 `TARGET_FACTS_INCOMPLETE/NONE`；空白格数、物理体积和站立面积分别保留。

PLANNED 使用前序 BUILD/planRevision，world/object及其revision为null；INSPECTED相反。计划引用图无环。新外形组合可先用PLANNED；已落地内部增改必须选真实对象INSPECTED。事实/安全的实际profile与来源在宿主管理界面可见；没有默认1×2、通用hazard/light阈值、任意图数/尺寸上限。Core/engine实际 cap必须带source/revision、kind、actual/limit；失败不silent crop/重试/降级。

Witness不能是 safe:true。全部predicate facts typed并入build摘要，绑定 final-effects/target-facts/safety-profile；geometry由完整facts/catalogue重算。PROTECTION与BODY_CLEARANCE还必须由真实 Adapter 输出验证 EvidenceBinding 的主体/世界/revision及每格状态；caller自己填providerRef不构成证据。运行时再次检查权限和身体占用，不能把FIXTURE true当真实证明。完整来源缺失 typed 拒绝。

## 4. 命名与对象选择

名称先按原字符串拒绝 U+0000..001F、007F..009F、2028、2029、061C、200E..200F、202A..202E、2066..2069、200B、2060、FEFF，再 trim Unicode17 White_Space两端。先拒绝换行不能把换行trim成合法。显示保留trimmed原文；比较键=ASCII A–Z转a–z(NFC(display))。不NFKC、不全Unicode casefold、不折叠内部空白；200C/200D、variation selectors和emoji tags保留。只含White_Space/连接符/variation selectors/emoji tags的不可见空名拒绝。无任意长度上限或自动截断。

实际NFC/White_Space provider固定Unicode17；宿主须验证并公开其Unicode兼容性。不兼容不能悄悄改变持久键。已核对本地Node24.13.1/ICU78.2/Unicode17.0是SOURCE/FIXTURE环境事实，不是目标DSH兼容证明。

世界内跨Session唯一键 `(stableWorldRef, fullNameComparisonKey)` 与registryRevision CAS同次登记，并发同名只有一个成功；hash bucket不能把碰撞当同名，需比较完整键。稳定objectRef由Canvas可信登记生成，不从名称hash或路径推导；改名保持选择/历史。ListObjects按creationSequence、objectRef稳定顺序。

SetObjectSelection一次替换完整ordered refs，[]清空，[B,A]保留B,A，无隐式toggle/add、排序或ref normalization。全局权限/revoke先于存在性；全shape/duplicate/scope/existence全部成功后才CAS selection。失败旧selection/revision完整不动。

## 5. 授权、replay、撤销

世界权限根是已认证引擎回调Player/operator与实时privilege/protection。Core模型OAuth/匿名home UUID/文本actorRef/Shell profile名都不能创建世界授权。公开VerifiedBinding只记录真实verifier结果，不是grant issuer。不存在完整HanaWorlds绑定链的已实现证据；Step 4必须证明配对/可信transport/public verifier。无真实可信binding零写拒绝。

验证绑定包括actor/authorizer/grantEpoch/binding/world/session/turn/intent/surfaceAction/action/transaction/operation/worldRevision/selection/analysis/decision，精确字段全进入authorization-binding摘要；secret/token/signature bytes在supported host lifecycle，不进契约、log、fixture。新world、target、config、selection、affected set、decision需要新绑定。读/列表/rename/history/undo/redo同样授权。

顺序 auth+current revoke/read permission→持久replay→current revisions→domain→effect。同world+transactionId且相同payload的终态返回原receipt，世界后来变化也不再apply；异payload REPLAY_MISMATCH。撤销优先于replay，不能借旧tx读取无权receipt。未终态/timeout只query/recover同交易，不生成新tx盲目重写。引擎每一实际写格重新检查worldedit privilege/is_protected，不能使用间距4采样冒充完整授权。

撤销后恢复由Adapter既有受信服务权限承担，不借模型token假冒用户新写；恢复权限缺失如实失败/unknown，保留范围和日志。远程链仍NOT_RUN，与本地要求同样可信，不因连接字符串存在声称可写。

## 6. 可恢复提交与历史

正式Canvas操作为 `ApplyRecoverableCommit`，响应名 `RecoverableCommitAppliedReceipt`，guarantee唯一值 `RECOVERABLE_VERIFIED`。允许施工暂态可见；普通建造直接放置，无强制预览。影响其他对象先完整analysis→BLOCK_AND_NOTIFY→用户继续绑定该operation/affected set/decision；取消零写。Canvas拥有世界/对象选择、命名、analysis/决定、提交编排、readback接受、linked持久history；Adapter拥有发现/配对/载荷/transport、引擎范围保护、完整前像/日志/恢复执行。

先保护实际影响范围并重核对state/authorization，完整前像与tx身份durable barrier后PREPARED，才APPLYING→APPLIED_PENDING_READBACK→VERIFIED_PENDING_HISTORY→VERIFIED。完整读回后linked history durable才产品成功。失败RESTORING→ROLLED_BACK或RESTORE_FAILED；崩溃/timeout或不可核对为RECOVERY_PENDING、mutationState UNKNOWN，保留现场/恢复记录并禁止同范围新写。ModStorage/set或schematic成功不能单独证明durable barrier。具体backend和重启恢复由Step4/5实证。

前像/readback包含air、nodeName/param1/param2、metadata、inventory（含空槽）、timer(timeout/elapsed)与固定state profile。光按profile recompute-with-readback，但raw param1不省略；timer推进/引擎光/callback外部副作用不满足profile时写前拒绝或如实UNKNOWN，不能称exact restored。范围保护只承诺经过所声明保护链的写者，不是全mod/engine全局锁。实际before reread与after readback防冲突，不声称彻底隔离TOCTOU。

恢复固定originTransactionId、operationDigest、beforeImageDigest、restoreAttemptIdentity；终态恢复重试不二次覆盖。RESTORE_FAILED外层保留apply/readback的causeCode和PARTIAL/UNKNOWN，不能报告NONE/完整撤回。readback完成但history持久失败停VERIFIED_PENDING_HISTORY；重启补同tx历史不重新写世界。

Undo/Redo是新的已授权tx，按整个linked交易比较当前expected after/before与全部对象head。外部玩家编辑冲突零写、全部head保持，生成当前Session proposal（取消或新修订intent）；用户确认后新analysis/authorization，不盲目撤回，也不以笼统failed结束。成功读回及history durable后全部linked heads同次移动；分支新编辑使redo失效。Session删除不清Canvas history。

## 7. Core媒体与Session存续

Workshop复用Core SessionPersistence/AttachmentStore/PiAiAdapter，不造Session系统/模型credential bridge。用户图文经公开授权attachment路径到gpt-5.6-luna，同一个currentSession持续跨对象/世界；不因改世界拆Session。source/stored/model projection bytes digest和variantId分离；source digest仅实际保有上传bytes才可记录，绝不能拿它代替stored/projection摘要。模型投影变化新briefRevision，不能原地改旧绑定。跨Session未授权先于图片存在性/腐败；坏图或digest错误明确失败，不能丢图纯文本成功。

实际Core imageLimits与route policy为attributed能力，发布源码默认不自动变成HanaWorlds政策。OAuth视频media store的7日/256MiB不是聊天图片或建筑资源保留规则。media refs/images禁止嵌聊天文本/进程参数/日志，公开error仅脱敏reason枚举。图像感知质量、真实model调用和restart均NOT_RUN。

删除Session保留已有BUILD payload、建筑及history必需已授权bytes；只保留明确manifest必要资源，资源+manifest durable后才报保存成功。旧attachment/turn作为可选metadata溯源，不成为重开读取条件。此处workId只指现有Stage1产物，不引入Stage2作品库UI/Registry/Entity/通用引用扫描/媒体库；不保存全部聊天，不定义新的作品删除或统一TTL。

固定Core无public true delete/retain/release。DeleteSession必须SESSION_DELETE_UNSUPPORTED，archive不替代。真正删除验收仍未关闭：本地集成协调者对DSH Core provider认领公开seam与受支持版本/另行授权的host扩展；Workshop消费/诚实拒绝。插件不得操作Core私有文件。没有向上游发送任务或实施host扩展。

## 8. 错误、保留与角色边界

错误精确 `code,phase,retryability,mutationState,transactionRef,causeCode,reason`；nullable只有明确字段。phase decode/authorize/replay/validate/apply/readback/restore/persist；固定retryability与mutationState见profile。公开reason脱敏枚举不含raw stack、路径、端点、secret或metadata/inventory私密内容。可公开attributed limit detail只能按Limit类型，不用原始异常自由文本。

严格优先级P0解码/envelope→P1权限/撤销→P2replay→P3world/object/selection/catalogue/targetFacts/analysis/decision revisions→P4明确逐操作domain→P5effect→P6恢复/读回。name syntax在uniqueness前；selection重复在存在性前；media scope在存在/损坏前；geometry在volume前；一旦可能写入不能回NONE validation error。restore失败优先但保留apply cause；timeout UNKNOWN/query，不成功也不假零写。

七协议的ownership/privacy/retention约束：
- Interaction由业务owner决定action，Shell/Luanti复用renderer；frames/receipts随Session，renderer缓存可丢，不能丢已提交Canvas receipt/history。
- Adapter保留connection profile到明确移除/迁移；transaction/preimage/recovery evidence随Canvas history，未终态不可清除；不决定对象/产品成功。
- Canvas保留world binding、稳定对象、linked journal/history到明确支持删除/迁移；不拥有engine transport/凭据。
- Session复用Core已声明retention，删除不得删现有建筑/BUILD/history必需资源；固定true deletion缺口不能伪造。
- Painter输入输出随Session/Canvas provenance；不持有通用store，不写世界，不能让structure图片变可选。
- ReferenceBrief是共享非运行contract，metadata随Session；被现有BUILD/history明确需要的resources独立存续，不能新增runtime owner。
- BUILD/compiled保留供现有BUILD/Canvas transaction/history的必要provenance；Brush仅纯编译，输出摘要不授予世界权限。

候选 closure 共 76 行：原 70 维中变更的 Canvas/Adapter 行已绑定 v3 envelope 案例，另有 6 行 A/B/C 新语义。`FROZEN`只表示当前候选有具体规范/oracle待批准；`SOURCE_BOUND`不声称runtime。任何真实新产品决定须`OPEN_USER_DECISION`且阻止dispatch。Stage2仍`PLANNED/NOT_APPROVED_FOR_EXECUTION`。后续验收须真实clean host/plugin入口、授权、restart/readback/uninstall/reinstall/rollback；脚本/HTTP/fixtures只诊断，不能代替REAL_UI/USER_VISIBLE，用户才assign ACCEPTED。

### Canvas事件信封（唯一有界修复）

profile.types 显式定义全部14个Canvas事件类型；每个精确信封为 contractVersion、event、operation、receipt，receipt复用该operation已经冻结的typed公共响应，error必须null、result必须非null。ObjectNameChanged按NameObject/RenameObject、HistoryPositionChanged按Undo/Redo构成有限discriminated union；operation明确所用receipt variant及Undo/Redo方向。无新digest kind或生产projection变更。

op.event是所属信号，不表示一次List/Inspect/HistoryQuery成功就必须发Changed/Invalidated。profile.canvasEventRules逐事件限定实际变化、持久CAS、analysis完成或交易阶段；snapshot事件携带新authorized snapshot，query本身不造变化。ObjectInspectionInvalidated例外：receipt是已失效的旧INSPECTED快照，另外必填原事件已有语义newWorldRevision，为真实观测且不同于旧worldRevision；消费者不得把旧snapshot视为新有效facts。

TransactionAppliedPendingReadback仅APPLIED_PENDING_READBACK且不声明产品成功/移动history；TransactionVerified和HistoryPositionChanged仅完整matched readback及linked history durable后的VERIFIED。AffectedObjectNotificationRequired仅BLOCK_AND_NOTIFY。失败、冲突proposal、无状态变化不得冒充对应成功变化事件。事件订阅须保持原response权限/脱敏scope；缺权限不发布。fixtures/candidate/canvas-events-v3.json有16个有效分支及14个拒绝例，仅FIXTURE；checker只核对类型/状态输入，真实change/durability/事件发送仍NOT_RUN。

## rc.2 erratum

历史 rc.2 修正仅 CA-02-INVALID projectionPatch 键名；具体见 ERRATUM.md。历史制品 hanaworlds-contracts@0.1.1，七 runtime 0.1.0；既有 19 种 digest domain contracts@0.1.0 在本候选仍不改。此段仅保留来源记录，不覆盖上面的 v3 版本和新历史摘要域。

## New candidate v3 scope · 2.0.0-rc.1

The versioned normative delta is CONTRACT_V3_DELTA.json and CONTRACT_SCHEMA_PROFILE.json. Canvas history selects only the same current trusted author’s HanaWorlds-origin transaction; WorldEdit edits are reused, while other players/native world undo remain outside this history. Canvas public Apply no longer accepts caller preparedTransaction; Canvas prepares internally and recovers the same transaction. Canvas generates and returns the stable objectRef after verified creation. Adapter retains only the exact private before/after state needed for that authored history and pending recovery, with no world-global journal or automatic TTL. These v3 semantics were approved in 2.0.0-rc.1; implementation and provider proof remain pending. Historical rc.5 evidence is unchanged.

此 rc.4 勘误只修正 history 三个 Adapter 操作的错误码 allowlist；发布包补丁号为 `0.2.1`，`HanaWorlds|contracts@0.2.0|history-operation\n` 的既定摘要域及全部已有 golden 不变。Apply 在 Prepare 后、写入前仍须复核完整当前状态与资源；这些响应许可本身不是引擎原子性的证据。

## Current inventory v4

The direct user decision permits a new-version, re-authorized, read-only query of the current Canvas named-object list after missed events. This candidate represents it as `ListObjectsRequest.expectedRevision: Revision|null` under `canvas/v4`: null requests a coherent committed current snapshot from Canvas's durable registry; a nonnull value keeps the old strict revision precondition. The query cannot mutate a world or registry and need not emit ObjectInventoryChanged. Current principal/world authorization and revocation are checked before the read and before releasing the inventory. A race returns one complete committed revision, never a mixed list. Workshop takes names and stable refs from `ObjectList.result`, presents names through Shell or in-world interaction-surface/v3 UI (rc.8 label update; behavior unchanged), and sends only the returned ref in `SetObjectSelectionRequest.objectRefs`. Neither WorldEdit nor a missed event log is treated as this registry query's provider.

## First building region v4 · 3.0.0-rc.6

Authority split. USER_DIRECTIVE (raw answers in `authority/first-placement-user-decision.md`): a first new building goes by default on free ground in front of a real online player along the player's facing direction with the entrance toward the player; the initiating player for a Luanti-started turn, the single online player for a Shell-started turn, otherwise ask; an unusable front area is explained and the user picks an in-game point, with no silent relocation; online player names (no positions) are listed only to a user authorized for the bound world; the four distances default to 2 / 16 / 8 / 4 and are visible and editable in the Shell management interface. Everything else in this section (names, shapes, order, tie rules, wire handling) is ENGINEERING_JUDGMENT adopted from audit option A (EXT-01-A, EXT-02-A, EXT-03-A, EXT-03b-A, EXT-RC5-A; `context/ext-first-building-audit/`, a RETURN_CLAIM) and is binding only through exact approval of this candidate.

Route. After Workshop has a confirmed `BUILD_STRUCTURE` intent with no selected object and a footprint, it calls `canvas/v4 InspectPlacementRegion`. Canvas is the only caller of `world-adapter/v4 InspectRegion`. The Adapter resolves the anchor, searches, inspects and returns either `REGION_INSPECTED` with a `RegionInspection` or a typed `PLACEMENT_CHOICE_REQUIRED` outcome. Canvas durably records the outcome under its own `inspectionId` before releasing it and relays it unchanged. Workshop copies `RegionInspection.targetFacts`, its digest and the whole `RegionInspection` into `painter/v3 CreateBuildPlanRequest` (`regionInspection`). The picture-blocks painter uses `regionInspection.frame` as `BUILD.coordinateFrame`, `regionInspection.evidence` in its PROTECTION and BODY_CLEARANCE witnesses, and places the entrance on the footprint face whose outward normal equals `entranceFacing`. Brush compiles unchanged projections. Canvas `ApplyRecoverableCommit` carries `regionInspectionBinding {inspectionId, build}`; Canvas internally prepares through the Adapter, which rechecks protection and bodies. After VERIFIED, Canvas creates the object with its own generated ref (CV3-C-IDENTITY unchanged). Both inspection operations are read-only: zero world and registry writes; Canvas writes only its inspection record.

Facts source. `FactsSource` gains `REGION_INSPECTED`, carried only with `TargetFacts.profileVersion: target-facts/v3` (INSPECTED and PLANNED keep `target-facts/v2`): worldRef and worldRevision nonnull; objectRef, objectRevision, buildDigest and planRevision null. TargetFacts fields and the `target-facts` digest projection are unchanged. Only picture-blocks may consume it for a first new building; interior rejects it with `TARGET_REQUIRED/validate/SCOPE_DENIED`. Brush binds it to the request world exactly as INSPECTED (Brush@49b74b5 `compile.mjs:43-44` currently treats every non-INSPECTED source as PLANNED; a brush-v4 continuation corrects this without touching any digest projection). A contracts@0.2.1 peer does not advertise `target-facts/v3`, so the pair already fails the ContractHandshake with `UNSUPPORTED_VERSION`; if such facts still reached a 0.2.1 decoder it rejects them at decode (`SCHEMA_INVALID/decode/INVALID_SHAPE`) and never treats them as PLANNED. A PLANNED source still requires a real preceding plan; a first BUILD claiming PLANNED without one is `TARGET_REQUIRED/validate/REQUIRED_FACT_UNKNOWN`. A first building cannot be expressed through a fictitious object: Canvas `InspectObject` keeps `OBJECT_NOT_FOUND`.

Anchor. `DEFAULT_PLAYER {invocationId}` names the Session input that confirmed the intent. The Adapter durably records every in-world invocation it relays (invocationId, sessionRef, worldRef, engine player name) before delivering it. If the named invocation is in that record for the same session and world, the anchor is that initiating player (Luanti-started turn), even when other players are online; if the player is no longer online in the bound world the outcome is `PLAYER_OFFLINE`. Otherwise the turn is Shell-started and the Adapter reads `core.get_connected_players()` in-engine: exactly one player is the anchor; none is `NO_ONLINE_PLAYER`; several is `MULTIPLE_ONLINE_PLAYERS` with `candidatePlayerNames` (names only, UTF16 sorted). An unreadable relay record is `INSPECTION_FAILED`, never Shell mode. `NAMED_PLAYER {engineActorName}` is the user's tap on a listed name, returned through the typed `SELECT_CHOICE` input below; offline is `PLAYER_OFFLINE`. `PICKED_POINT {pickRef}` is the in-world pick (below). A caller can never supply a position, facing or initiator name.

Facing. The Adapter reads `get_look_horizontal()` (yaw, counter-clockwise from +Z; lua_api.md@6c4c384:9290-9291) in-engine, normalizes `y = yaw − 2π·floor(yaw/2π)` and computes `q = y/(π/2)` in IEEE-754 binary64 with π the binary64 nearest value. If `q − floor(q)` is exactly 0.5 the outcome is `FACING_AMBIGUOUS`. Otherwise `k = floor(q + 0.5) mod 4` gives forward axis f = +Z, −X, −Z, +X for k = 0, 1, 2, 3 and right axis r = +X, +Z, −X, −Z. `entranceFacing = −f`.

Search. Feet cell F = (floor(x+0.5), floor(y+0.5), floor(z+0.5)) of `get_pos()`. Footprint W×D×H cells comes from the request; base cells are `F + a·f + b·r + c·Y` with a ∈ [G+1, G+D], b ∈ [−⌊(W−1)/2⌋, W−1−⌊(W−1)/2⌋], c ∈ [0, H−1], G = `placement.frontGapCells`. Candidates shift (a+s, b+t, c+v) with s = 0…`forwardSearchCells`, t in order 0, +1, −1, …, ±`lateralSearchCells`, v in order 0, −1, +1, …, ±`verticalSearchCells`; iteration is s outermost, then t, then v. A candidate is usable only when every footprint cell is known air, not protected for the acting principal, and not intersecting any connected player's actual collision box, and every cell of the support layer (c = v−1 under the footprint) is a known occupied node whose catalogue `walkable` is true. Every failing condition of every failed candidate contributes a reason: any occupied footprint cell → `FRONT_AREA_OCCUPIED`; protected → `FRONT_AREA_PROTECTED`; body → `FRONT_AREA_BODY_OCCUPIED`; support air or non-walkable → `FRONT_AREA_NO_GROUND`; any unknown/unloaded/unreadable cell or null walkable → `FRONT_AREA_UNKNOWN`. The first usable candidate is chosen. If none is usable the result is `PLACEMENT_CHOICE_REQUIRED` with the union of reasons and no bounds; space outside the window (behind the player, further away) is never used. Body overlap uses the closed cell box [p−0.5, p+0.5] and the player's open box `pos + get_properties().collisionbox`: overlap only with strictly positive volume on all three axes. The engine default collisionbox (player_sao.cpp@6c4c384:28) is never assumed. A window or footprint that exceeds an actual engine/host capacity is `LIMIT_EXCEEDED` with the attributed Limit; nothing is truncated.

Picked point. `ActionInputKind` gains `PICK_WORLD_POINT` with input `{kind, pickRef}` (interaction-surface/v3, contracts@0.3.0). Only the Luanti in-world renderer (Adapter origin) produces a pickRef: the invoking player points at a node (`core.raycast` along the look direction, lua_api.md@6c4c384:7248) and confirms; the Adapter privately records the node position, the picking player, that player's facing at pick time and the world. For `PICKED_POINT` the anchor cell is the cell above the picked node, f is the picker's facing at pick time, the footprint's near edge starts on the anchor cell (forward offsets a ∈ [0, D−1], same lateral and vertical offsets as above) and no search shift is applied; an unusable area is `PLACEMENT_CHOICE_REQUIRED` with the same reasons. The Shell renderer cannot pick; it shows the advertised action as "pick in game". A pickRef the Adapter did not issue for that world and session is `PERMISSION_DENIED/authorize/IDENTITY_UNVERIFIED`.

Region result. `RegionInspection.targetFacts.sampledBounds` is the bounding box of the chosen footprint plus its support layer; coverage, occupied/known-empty/unknown cells are exact three-valued facts. `protectedPositions` and `bodyOccupiedPositions` list every such cell inside sampledBounds for the acting principal at observation time. `evidence` is `{providerRef: Adapter PublicCapabilities.providerRef, sourceRevision: adapterExecutionRevision, worldRef, worldRevision}`. `frame` is the complete Luanti world frame (frame/v2, origin [0,0,0], axes [+X,+Y,+Z], left-handed, gridUnit node with `metersPerGridUnit: null` unless the Adapter cites a source, transformRevision = adapterExecutionRevision) and the Adapter computes `targetFacts.frameDigest = D(frame)` itself; it never takes a frame or frameDigest from a consumer. `ProtectionWitness.protectedPositions` (area protection evidence) and `PreparedTransaction.protectedPositions` (the Adapter's locked write range) are different values despite the shared name.

Settings. `placement.frontGapCells`, `placement.forwardSearchCells`, `placement.lateralSearchCells`, `placement.verticalSearchCells` are Canvas-owned, per bound world, NonNegativeInt, defaults 2 / 16 / 8 / 4 (user decided values), edited and shown in the Shell management interface (SETTINGS_AND_INVARIANTS.json). Canvas sends the current values and `settingsRevision` to the Adapter, which echoes them in both outcomes. An unset or invalid stored value is never defaulted: `InspectPlacementRegion` returns `CAPABILITY_UNAVAILABLE/validate/POLICY_UNAVAILABLE` and `unavailableSettings` lists every affected setting name; `unavailableSettings` is nonnull exactly in that case.

Evidence at Apply. `ApplyRecoverableCommitRequest.regionInspectionBinding: RegionApplyBinding|null`. When `operations.targetFactsDigest` equals the digest of any REGION_INSPECTED record Canvas holds, the binding is required. Canvas checks, in the authorize phase after current authorization/revocation: the inspectionId is a Canvas-issued record for the same world and session principal; `D(build) = operations.buildDigest`; `build.targetFactsDigest` and `operations.targetFactsDigest` equal the record; `build.coordinateFrame` digest equals `operations.frameDigest` and the record's frame; every PROTECTION and BODY_CLEARANCE witness `evidence` equals the record's evidence and their protected/body position lists equal the record's lists restricted to the witness positions. Any mismatch or a missing binding is `PERMISSION_DENIED/authorize/IDENTITY_UNVERIFIED/NONE` before any Adapter call. Afterwards, a record worldRevision different from the current world revision is `STALE_REVISION/validate/REVISION_CHANGED/NONE`. A null binding for non-region facts keeps rc.5 behavior unchanged.

Prepare recheck. `world-adapter/v4 PrepareRecoverableTransaction` keeps its per-cell `is_protected` recheck for the acting principal (`PERMISSION_DENIED/authorize/SCOPE_DENIED`) and adds, before the durable barrier, a recheck of every connected player's actual collision box against every effect cell: overlap is `SAFETY_INVARIANT_FAILED/validate/SCOPE_DENIED/NONE`. Canvas surfaces the same code from Apply. An Apply-time body recheck is DEFERRED_HARDENING (not in the frozen brief).

Privacy. Raw positions, yaw/look direction and collision boxes never leave the Luanti payload; they are not returned, persisted outside the Adapter's own engine state, or logged. Only the chosen region bounds and a cardinal `entranceFacing` leave the Adapter. `candidatePlayerNames` appears only in `MULTIPLE_ONLINE_PLAYERS` and only to a principal whose current authorization for the bound world includes INSPECT, with revocation checked before release; area owner names are never exported.

Player choice list (rc.7, user decision “列出在线玩家名字（推荐）”: list the names, the user taps one). interaction-surface/v3 `ActionDescriptor` gains `choices: ActionChoices|null` (`{value, label}`, unique by value) and `ActionInputKind` gains `SELECT_CHOICE` with input `{kind, value}`. `choices` is non-null exactly when `inputKinds` contains `SELECT_CHOICE`. For a `MULTIPLE_ONLINE_PLAYERS` ask, Workshop puts exactly the Canvas-released `candidatePlayerNames` into `choices` (value = label = engine player name; names only, no positions or other fields) in a frame rendered only to the principal Canvas released them to; renderers show each choice as a tappable option from the typed list and never parse frame text for options. The returned value must be one listed value of the same frameRef/frameRevision/actionId; anything else (unlisted, forged, or sent to an action without choices) is `INVALID_SELECTION/validate/SCOPE_DENIED` with zero downstream calls. Workshop maps the accepted value to `NAMED_PLAYER`. The free-text NAME input is not used for this ask.

Compatibility (rc.7). A breaking change gets a new major wire, as approved design §5 (`authority/approved-stage1-design.md`, “A breaking field, meaning, ownership or trust change requires a new major contract version”) and plugin gadget standard §6 require; this is PROJECT_RULE, not a brief instruction. painter/v2 → `painter/v3` (`regionInspection`) and interaction-surface/v2 → `interaction-surface/v3` (`PICK_WORLD_POINT`, `SELECT_CHOICE`, `ActionDescriptor.choices`). world-adapter/v4 and canvas/v4 are unreleased and absorb `InspectRegion`, `InspectPlacementRegion`, the Apply binding and the Prepare recheck. `BUILD/V2` keeps its wire name because the same constant is the document `contractVersion` inside the `build` digest projection and the nineteen production goldens; its accepted value-set change is versioned as `target-facts/v3`. Every provider/consumer pair exchanges a `ContractHandshake {contracts, wireVersions, compiledOperationsVersion, factProfiles}` before any request; a consumer whose required wire major or fact profile is not advertised fails with `UNSUPPORTED_VERSION/decode/VERSION_UNSUPPORTED/NONE`, sends zero requests and never falls back. contracts@0.3.0 advertises interaction-surface/v3, world-adapter/v4, canvas/v4, session/v2, painter/v3, ReferenceBrief/v2, BUILD/V2, operations/v2 and `target-facts/v2` + `target-facts/v3`; contracts@0.2.1 advertises the v2/v3 set and `target-facts/v2` only, so every mixed 0.2.1/0.3.0 pair fails at the handshake. Migration: Workshop, building-exterior-painter-v4, building-interior-painter, luanti-adapter-v4 (in-world renderer), canvas-v4 (interaction-surface provider actions) and brush-v4 move together to contracts@0.3.0; there is no v2/v3 coexistence inside one composition. Rollback restores the whole 0.2.1 consumer set together (admitted Brush 0.1.0, Exterior `a3156fc`, Adapter 0.1.1, Canvas v3; Interior has no released artifact and is simply not installed). Nested digest projections (ActionProjection `interaction-surface/v2`, IntentProjection `session/v2`, BuildProjection `BUILD/V2`, the TargetFacts field set) and all nineteen goldens are unchanged; no new digest kind. WAV4-SEAM-A and CAV4-CURRENT-INVENTORY are unchanged.
