# Codex MCP 与技能配置说明

更新时间：2026-09-09 16:01

## 目的

这份文件记录本项目目前会用到的主要 Codex MCP 服务和技能，方便在其他电脑上快速恢复同样的开发环境。

不要把本机的完整 `~/.codex/config.toml` 或 `auth.json` 直接上传到 GitHub，因为里面可能包含登录凭证或服务密钥。上传的是配置思路和说明，不是本机私有配置。

## 当前主要使用的能力

| 名称 | 用途 | 跨电脑恢复方式 |
| --- | --- | --- |
| documents | 创建和修改 Word、文档类内容 | 在 Codex 插件/技能中启用 |
| pdf | 阅读、生成和检查 PDF | 在 Codex 插件/技能中启用 |
| spreadsheets | 表格数据处理 | 在 Codex 插件/技能中启用 |
| presentations | 演示文稿创建和修改 | 在 Codex 插件/技能中启用 |
| figma | Figma 设计读取和设计转代码 | 在 Codex 插件/技能中启用 |
| figma-mcp-express | Figma 批量读取、节点操作、截图和导出 | 安装对应插件 |
| browser / chrome | 浏览器操作、网页验证 | 在 Codex 插件/技能中启用 |
| computer-use | 桌面应用自动化操作 | 在 Codex 插件/技能中启用 |
| linear | 项目或任务管理 | 登录并授权 Linear |
| mixpanel-headless | 数据分析、漏斗、留存、用户行为 | 配置 Mixpanel 凭证 |
| rdc | 公司需求排期和需求管理 | 需要公司访问令牌，手工添加 |

## 新电脑配置步骤

1. 安装 Codex 桌面版并登录账号。
2. 打开 Codex 的插件或 MCP 设置。
3. 按上表启用常用插件和技能。
4. 对需要账号的服务，如 Figma、Linear、Mixpanel、微信开发者工具、RDC，分别登录或填入对应凭证。
5. 打开本项目目录，让 Codex 读取：
   - `README.md`
   - `AGENTS.md`
   - `记忆.md`
   - `docs/codex-mcp-skills.md`

## 敏感信息规则

- 密钥、访问令牌、登录凭证不写入 Git。
- 如果必须使用令牌，优先放在本机环境变量或私有配置文件中。
- 示例配置可以上传，但真实值要替换成 `<TOKEN>`、`<APPID>` 这类占位符。
- 每台电脑首次配置后，确认 Codex 能识别所需 MCP 服务，再继续开发。

## 维护规则

- 后续新增 MCP 服务或技能时，更新本表。
- 同时更新文档顶部或对应条目的「更新时间」，格式为：`YYYY-MM-DD HH:MM`。
- 提交信息建议使用「更新 MCP 技能说明」或类似描述。
