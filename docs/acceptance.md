# hanaworlds-contracts · 插件级验收

真实运行时：**无，纯 fixture**。全部条目在本仓 CI 用 `npm ci && npm test` 及 `npm pack` 跑完。
证据上限：`FIXTURE`。本仓不是运行时插件；任何条目通过都不证明产品路径。

| ID | 验收条目 | 可见结果 | 怎么跑 | 证据上限 |
| --- | --- | --- | --- | --- |
| CT-01 | 全部 valid / invalid / ambiguity oracle 通过 | `npm test` 输出 conformance、v3、v4、v4-chains 四套全部 `FAIL:0`，closure 行表 `failed:[]` | `npm test` | FIXTURE |
| CT-02 | 一个消费者包能从打包产物安装并解码样例 | 用 `npm pack` 的 tarball 在临时目录 `npm i <tgz>` 后，解码一个 valid 样例得到与 fixture 相同的规范化对象 | `npm run pack:artifact` → 临时目录安装 → 执行 `consumer/` 示例 | FIXTURE |
| CT-03 | 旧 major 被类型化拒绝，而不是被当成新语义解析 | 0.2.1 风格的 `world-adapter/v3` 与 0.3.0 的 `v4` 配对在 ContractHandshake 失败，返回 `UNSUPPORTED_VERSION/decode/VERSION_UNSUPPORTED`，零写 | `npm test`（retired-major 与 handshake 用例） | FIXTURE |
| CT-04 | 19 个摘要 golden 字节不变 | 全部 digest golden 与历史 golden 逐字节相等；任何变动必须伴随 major 升版 | `npm test`（golden 用例） | FIXTURE |
| CT-05 | 打包产物与源一致 | `npm run verify:source` 通过；tarball 内文件清单与 `dist/` 一致 | `npm run build && npm run verify:source` | SOURCE |
