# 合约检查器

同 hanaworlds-contracts origin 的只读开发面板。Host 精确复用 **hanaworlds-contracts 0.5.2** 公共 exports；不包含、修改或替换 Contracts，不调用其他 HanaWorlds 插件。

构建：在 origin 根执行 `node tools/build-contract-inspector.mjs`。安装：统一客户端左侧「插件」→「添加插件」→填写本面板包的绝对本地路径或本地 tarball，安装后「立即启用」。左侧出现「合约检查器」。已安装的官方 Harness 0.2.0-rc.2 和 Contracts 0.5.2 提供 peer dependencies；npm 元数据把它们标为 optional，以免安装器从注册表拉取另一份运行时。实际激活必须解析这些公开模块，且 Host 拒绝非 0.5.2 的 Contracts；缺失时没有替代实现。

选择样例或粘贴 JSON，选建筑、区域或显式协议声明，点击「检查」。建筑使用 `admitType('BuildProjection', utf8)`；区域使用 `admitType('RegionVoxelBlock', utf8)`；协议演示使用 `decodeRawJSON` 和 `checkProtocolCompatibility`。全部在本机 Host 中运行。浏览器仅展示结果。

样例均标明 fixture；协议列表和能力声明从实际公共 `contractProtocols` / `regionCapabilities` 读取，未读取任何 peer 的状态或推定实时兼容。区域的 air 与未指定 null 具有不同含义。通过只表示所选纯合约检查通过，不代表 Catalogue 材料有效、世界安全、已写入或产品全链路验收。

出错字段是展示诊断：缺失或多余字段来自公共 schema；有 `$ref` 的字段调用公共 `validateType` 独立定位；固定值来自公共 schema。完整输入的通过/拒绝只由公共准入决定。跨字段、几何、编码域等没有公共精确路径的错误显示「整体输入约束」，不伪造精确路径。原公共错误 code/phase/reason 如实展示。严格解码失败定位为整体 JSON。协议演示错误显示声明/要求字段组。

Host 使用公开 `TypertRemoteService`、`Remote` 和 Gateway 的 SRC 模式；Client 使用公开 Connection RPC 与 root `main` / `sidebar.panellist` seats。没有独立 HTTP 服务、世界读写或后台重试。

许可：本面板 0.1.0 MIT；hanaworlds-contracts 0.5.2 MIT（本 origin，纯校验）；Cordis 4.0.4 MIT、官方 DeepSeek Harness 0.2.0-rc.2 MIT（来源 github.com/deepseek-ai/deepseek-harness 与客户端公开包 manifest，服务与面板承载）。React 来自客户端已提供的 baseline，用于渲染，不复制或打包 React；其具体运行版本在实际面板安装验证时记录。
