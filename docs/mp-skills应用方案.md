# mp-skills 应用方案 — 奶茶计算器

## 一句话理解

微信小程序 AI 开发模式让用户在对话里说「帮我看看今天还能喝多少奶茶」，AI 就自动帮你查余额、记奶茶、推荐运动——不用一页一页点菜单。

## 我做了什么

已经在项目里创建好了 Skill 脚手架：

```
/Users/admin/WeChatProjects/miniprogram-1/miniprogram/skills/milkTeaSkill/
```

它自动完成了以下配置：
- 在 `app.json` 里注册了 `agent.skills` 入口
- 生成 `SKILL.md`、`mcp.json`、`index.js`、`apis/`、`components/` 目录结构

目前里面只有模板示例代码，需要下一步把真实业务逻辑填进去。

## 项目现状与 AI 模式的对应关系

| 现有功能 | 用户在页面上怎么操作 | AI 模式下怎么说 | 对应的原子接口 |
|---|---|---|---|
| 查看今日热量余额 | 打开首页看数字 | 「我今天还能喝多少奶茶？」 | `getDailySummary` |
| 记录一杯奶茶 | 奶茶推荐页 → 点「喝一杯」 | 「帮我记一杯珍珠奶茶」 | `recordDrink` |
| 记录正餐 | 添加饮食页 → 搜索选份量 | 「午餐吃了一碗牛肉面」 | `recordFood` |
| 记录运动 | 添加运动页 → 选类型和时长 | 「跑步半小时消耗了多少」 | `recordExercise` |
| 推荐奶茶 | 奶茶推荐页看推荐卡 | 「推荐一杯我能喝的奶茶」 | `recommendMilkTea` |
| 运动建议 | 首页看运动换奶茶卡片 | 「我需要跑多久才能喝一杯珍珠奶茶？」 | `suggestExercise` |
| 历史趋势 | 我的页看条形图 | 「这周我记录了几杯奶茶？」 | `getHistory` |

## 用户体验示例

**用户**：「我今天吃了两个鸡蛋和一碗牛肉面，还能喝奶茶吗？」

**AI 做的事**：
1. 调用 `recordFood` → 记录鸡蛋和牛肉面
2. 调用 `getDailySummary` → 计算出 TDEE、摄入、剩余热量
3. 调用 `recommendMilkTea` → 从奶茶库中找最合适的一款
4. 渲染「今日摘要卡片」+「奶茶推荐卡片」

**用户看到**：
> ✅ 已记录：鸡蛋 ×2（156 kcal）、牛肉面 1 碗（350 kcal）
> 📊 今日摄入 506 kcal / TDEE 1800 kcal
> 🧋 还能喝：约 3.4 杯纯茶（20 kcal/杯）
> 💡 推荐：茉莉绿茶（25 kcal）—— 无糖茶香，几乎不占热量预算

## 需要实现的原子接口

### 已有逻辑可直接复用的

| 接口 | 复用文件 | 说明 |
|---|---|---|
| `getDailySummary` | `utils/calc.js` → `calculateSummary` | 直接调用现有计算逻辑 |
| `recordFood` | `utils/storage.js` → `addRecord` | 调用现有的记录写入 |
| `recordExercise` | `utils/calc.js` → `estimateExerciseCalories` | 复用 MET 估算 |
| `recordDrink` | `utils/storage.js` + `utils/milkTea.js` | 查奶茶库 → 记录饮食 |
| `recommendMilkTea` | `utils/milkTea.js` → `recommend` | 复用现有推荐逻辑 |
| `suggestExercise` | `utils/calc.js` → `suggestExercises` | 复用运动建议逻辑 |

### 需要新写的

| 接口 | 说明 |
|---|---|
| `getHistory` | 从 `storage.loadDiary` 读取最近 7 天，统计杯数和热量趋势 |

## 需要实现的原子组件

| 组件 | 功能 |
|---|---|
| `daily-summary-card` | 展示今日余额、摄入、TDEE 进度条 |
| `milk-tea-recommend-card` | 展示推荐奶茶的名称、热量、品牌 |
| `exercise-suggestion-card` | 展示运动方案（类型/时长/消耗） |
| `drink-record-card` | 展示已记录的奶茶和热量 |
| `history-chart-card` | 展示最近 7 天简单条形趋势 |

## 实施步骤

### 第一步：改造 SKILL.md
把模板内容替换为奶茶计算器的业务描述，让 AI 知道它能帮用户做什么、什么时候调用哪个接口。

### 第二步：编写 mcp.json
定义 7 个原子接口的输入输出参数，并声明每个接口对应的组件。

### 第三步：实现 apis/ 目录
每个接口一个文件，内部调用已有的 `utils/calc.js`、`utils/storage.js`、`utils/milkTea.js`。

### 第四步：实现 components/ 目录
每个组件一个子目录（wxml + js + wxss + json），接收接口返回的 `structuredContent` 并渲染 UI。

### 第五步：本地测试
在微信开发者工具中打开项目，进入 AI 对话入口，用自然语言测试每个接口。

### 第六步：质量评估
```bash
npx mp-skills validate
npx mp-skills eval -c 3
```

## 风险与注意事项

1. **AI 开发模式需要新版微信客户端** — 用户需更新到支持 AI 模式的版本
2. **对话入口的展示** — 需要确认 AI 对话入口在小程序里如何呈现（浮动按钮？导航栏？）
3. **Skill 分包体积** — 加入 Skill 后会增加小程序包体积，需注意主包 2MB 限制
4. **数据安全** — AI 调用接口时能读取用户档案和记录，需确保无隐私泄露风险
5. **云端依赖** — 部分接口（如奶茶库刷新）依赖云函数，需确保云函数已部署
6. **LLM 配置** — `eval` 质量评估需要配置 LLM API Key（BYOK），可用 DeepSeek 等国产模型

## 与现有项目改造的关系

mp-skills 不改变现有页面功能，而是在旁边叠加一个「AI 对话入口」。用户可以选择：
- 继续用传统页面逐页操作（兼容老用户）
- 或者用自然语言一句话完成操作（吸引新用户、提升便利性）

两个入口共存，互不影响。
