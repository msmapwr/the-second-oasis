# 《第二绿洲》CodeBuddy 代码编写规范

> **版本**：v1.0
> **适用项目**：《第二绿洲》(The Second Oasis) 网页策略桌游
> **适用范围**：开发者与 CodeBuddy 协作编写本项目所有源码、测试、配置文件
> **项目根目录**：`D:\Project Regolith\Code`

---

## 0. 总则

本规范是《第二绿洲》项目提示词中"代码规范"章节的**细化补充**。当两者冲突时，**以本规范为准**；本规范未覆盖的部分，回退到项目提示词的约定。

核心原则三条：

1. **核心逻辑零 Bug 优先于一切**——游戏规则正确性是第一优先级。
2. **职责单一**——每个文件、类、函数只做一件事，CodeBuddy 主动判断是否该拆分，不靠行数硬指标。
3. **可回溯**——每次提交对应一个可独立运行的功能模块，历史清晰可回溯。

---

## 1. 项目目录结构

项目根目录 `D:\Project Regolith\Code` 下结构如下：

```
D:\Project Regolith\Code\
├── index.html              # Vite 入口
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .gitignore
├── CodeBuddy代码规范.md     # 本文档
├── 第二绿洲_游戏计划书.html # 规则权威来源
├── public/
│   └── Assets/             # 静态资源（图片、字体、音效）
├── src/
│   ├── Core/               # 游戏核心逻辑（纯逻辑，无 DOM 依赖）
│   ├── Render/             # Canvas 2D 渲染层
│   ├── UI/                 # DOM UI 面板层
│   ├── Net/                # 联机层（WebSocket）
│   ├── Store/              # 轻量状态管理（EventEmitter + 状态对象）
│   ├── Types/              # 全局共享类型定义
│   ├── Utils/              # 工具函数
│   └── main.ts             # 应用入口
└── Docs/                   # 设计文档、数值模拟报告
```

**关键约定**：

- 测试文件**就近放置**，与源码同目录。例如 `src/Core/Dice.ts` 对应 `src/Core/Dice.test.ts`。
- 不单独建 `Tests/` 顶层目录（项目提示词中的 `Tests/` 约定被本规范覆盖为就近放置）。
- `Core/` 层**严禁**依赖 `Render/`、`UI/`、`Net/`，保证逻辑可独立测试。

---

## 2. Git 工作流

### 2.1 分支策略

采用 **main + dev 双分支**模型：

| 分支 | 角色 | 稳定性 |
|---|---|---|
| `main` | 稳定可玩版本，作品集展示用 | 任何时候都应可运行 |
| `dev` | 开发主干，集成各功能分�� | 可能不稳定 |
| `feature/*` | 功能分支，从 dev 拉出，完成后合回 dev | 临时 |

**合并方向**：`feature/* → dev`，`dev → main`（定期合并，合并前确保 dev 可运行）。

### 2.2 分支命名

```
feature/dice-roll          # 掷骰模块
feature/occupation          # 占领结算
feature/dev-chain           # 开发链状态机
feature/robbery             # 抢夺裁决
feature/collapse            # 崩坏结算
feature/ui-board            # 棋盘 UI
```

用小写中划线分隔，名称表意清晰。

### 2.3 提交粒度

**按功能模块提交**。每完成一个可独立运行的小功能即提交一次，例如：

- 完成"掷骰模块（稳健/激进两种模式）+ 对应测试" → 一次提交
- 完成"占领结算逻辑 + 测试" → 一次提交

禁止把多个不相关功能塞进一次提交；也禁止一个功能拆成零碎的半成品提交。

### 2.4 Commit Message

中文，清楚描述**改了什么模块**、**为何改**。无固定格式，但须包含模块名。示例：

```
实现掷骰模块：稳健单骰与激进双骰，含倒扣回公共逻辑
修复开发链第三次对子未清零的 Bug
补充抢夺裁决的边界测试用例
```

### 2.5 .gitignore

项目根目录必须包含 `.gitignore`，至少忽略：

```
node_modules/
dist/
.DS_Store
*.log
.env
.env.local
.vite/
coverage/
```

---

## 3. TypeScript 配置

`tsconfig.json` 必须 **strict 全开**，关键配置：

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "sourceMap": true
  }
}
```

**禁止**用 `any` 绕过类型检查。确需不确定类型时，用 `unknown` 并做类型收窄，或定义明确的联合类型。

---

## 4. 命名规范

| 对象 | 规则 | 示例 |
|---|---|---|
| 类、组件、函数、变量 | 大驼峰 | `GameState`、`RollDice()`、`PlayerScore` |
| 文件名 | 大驼峰 | `DiceRoller.ts`、`GameState.ts` |
| 类型、接口 | 大驼峰，带语义 | `GameState`、`PlayerId`、`DiceMode` |
| 常量（全局/枚举值） | 全大写下划线 | `MAX_PUBLIC_TERRITORY = 100` |
| 私有成员 | 前缀下划线 + 大驼峰 | `_internalState` |
| 布尔变量 | is/has/can 前缀 | `IsCollapsed`、`HasRolled` |

---

## 5. 代码风格

不强制使用 Prettier/ESLint 工具，靠以下文字约定保持一致：

| 项 | 约定 |
|---|---|
| 缩进 | 2 空格，禁止 Tab |
| 引号 | 单引号 `'`，JSX 用双引号 `"` |
| 分号 | 结尾加分号 |
| 花括号 | K&R 风格，左括号不换行 |
| 行宽 | 建议 ≤ 100 字符，超出换行 |
| 尾逗号 | 多行对象/数组最后一项加尾逗号 |
| 空行 | 函数之间 1 空行；类内方法之间 1 空行；逻辑段落间可加 1 空行 |

**import 顺序**：

1. Node / 浏览器内置
2. 第三方库（如 `ws`）
3. 项目内模块（`@/` 别名或相对路径）
4. 类型导入（`import type`）

```typescript
import { EventEmitter } from 'events';
import ws from 'ws';
import { GameState } from '@/Core/GameState';
import type { PlayerId } from '@/Types/Player';
```

**单文件行数**：不设硬性上限。但 CodeBuddy 须遵守职责单一原则，当文件承担多个职责时主动拆分，并在交付说明中告知拆分理由。

---

## 6. 错误处理

采用**分层抛出捕获**模型：

```
Core 层（纯逻辑）    →  定义自定义错误类，抛出异常
Store 层（状态）     →  透传或包装为状态错误
Render/UI/Net 层    →  捕获异常，转化为用户可见反馈或网络重试
```

### 6.1 自定义错误类

所有 Core 层错误继承统一的基类：

```typescript
// src/Core/Errors/GameError.ts
export class GameError extends Error {
  constructor(message: string, public readonly Code: string) {
    super(message);
    this.name = 'GameError';
  }
}

export class InvalidDiceModeError extends GameError { ... }
export class DevChainOverflowError extends GameError { ... }
export class RobberyThresholdError extends GameError { ... }
```

### 6.2 禁止事项

- **禁止 Core 层吞异常**（catch 后不处理也不抛出）。
- **禁止用 `any` 绕过错误类型**。
- **禁止 UI 层直接处理业务逻辑错误**——应交给 Core 层判断后抛出，UI 仅负责展示。

### 6.3 边界处理

- 输入校验放在 Core 层入口（如 `RollDice` 函数开头校验 mode 合法性），不合法即抛出对应错误。
- 网络层（Net/）捕获异常后，区分**可重试**（连接断开）与**不可重试**（规则违规），分别处理。

---

## 7. 注释规范

### 7.1 文件头注释

每个 `.ts` 文件顶部必须有文件头：

```typescript
/**
 * 掷骰模块——处理稳健/激进两种掷骰模式与倒扣逻辑
 * 关联规则：计划书 §3 掷骰机制
 */
```

### 7.2 JSDoc

类与公有方法必须用 JSDoc 注明职责、参数、返回值：

```typescript
/**
 * 执行掷骰
 * @param Mode 掷骰模式：'steady' 稳健单骰 | 'aggressive' 激进双骰
 * @returns 掷骰结果与领土变化
 * @throws InvalidDiceModeError 当 Mode 非法时
 */
function RollDice(Mode: DiceMode): DiceResult { ... }
```

### 7.3 行内注释

复杂逻辑用**中文行内注释**解释"为什么"，不解释"是什么"：

```typescript
// 激进模式双骰 ≤6 时倒扣回公共，模拟高风险失败的代价
if (Mode === 'aggressive' && Sum <= 6) {
  PublicTerritory -= (6 - Sum);
}
```

### 7.4 禁止

- 禁止废话注释（如 `// 设置分数` 紧跟 `Score = 10`）。
- 禁止用注释掉的代码留历史版本，交给 Git 管理。

---

## 8. 测试规范

### 8.1 框架与位置

- 框架：**Vitest**（与 Vite 原生集成）。
- 位置：**就近放置**，`Foo.ts` 对应 `Foo.test.ts`，同目录。

### 8.2 必须覆盖的核心逻辑

以下模块必须有测试，且测试与源码**同一次提交**：

| 模块 | 关键测试点 |
|---|---|
| 掷骰 | 稳健单骰范围 1-6；激进双骰范围 2-12；≤6 倒扣回公共；边界值 |
| 占领结算 | 公共领土扣减、私有领土增加、公共不足时的处理 |
| 开发链状态机 | 1 次对子 ×2、2 次 ×3、3 次清零+荒地；非对子重置计数 |
| 抢夺裁决 | 发起者 vs 最高者掷骰；仅触发 1 次；平手处理 |
| 崩坏结算 | 第 2 次抢夺触发；全员受损；系数递增（初值 2 每次 +1） |
| 发射序章 | 双骰 ≥7 成功 +2 领土；全员成功才进主循环 |
| 终局判定 | 公共归零即终局；私有最高者获胜；平局处理 |

### 8.3 测试风格

- 用 `describe` / `it` 组织，描述用中文。
- 测试名说明"在什么场景下应该怎样"。
- 命中分支覆盖，不仅测正常路径，也要测边界与异常。

```typescript
describe('掷骰模块', () => {
  it('激进模式双骰结果 ≤6 时应倒扣公共领土', () => {
    // ...
  });
});
```

---

## 9. CodeBuddy 交付约定

CodeBuddy 每次交付代码时遵守以下规则：

1. **全文件交付**：给完整可运行文件，**不给代码片段**。即使只改一行也输出整个文件。
2. **文件头标注**：每个文件代码块前注明：
   - 文件路径（相对项目根 `D:\Project Regolith\Code`）
   - 操作类型：`【新建】` 或 `【修改】`
   - 修改文件需简述改动点
3. **附简短解释**：交付后用 2-3 句话说明这个文件做了什么、为什么这么设计、关联规则章节。
4. **不省略 import 与类型**：完整文件必须包含所有 import、类型定义、导出。

交付示例格式：

```
【新建】src/Core/DiceRoller.ts

```typescript
/**
 * 掷骰模块...
 */
import ...;

export class DiceRoller { ... }
```

> 说明：实现掷骰核心逻辑，关联计划书 §3。激进模式 ≤6 倒扣回公共的代价设计在于...
```

---

## 10. 依赖管理

- 包管理器：默认 **pnpm**（项目预装）。如开发者指定其他工具则遵循其 lock 文件。
- 新增依赖时：
  - 必须在 commit message 中说明用途。
  - 运行时依赖进 `dependencies`，构建/测试依赖进 `devDependencies`，**严格区分**。
  - 核心游戏逻辑（Core 层）尽量**零第三方运行时依赖**，保持纯 TS 可独立测试。

---

## 11. 待澄清问题处理纪律

计划书 §15 列出的 8 项待澄清问题（Q1-Q8），CodeBuddy 在编码过程中**一旦涉及**必须：

1. **立即暂停**该部分实现。
2. **先问用户**该问题的处理方式。
3. **同时给出专业意见和推荐方案**，含数据支撑（如适用蒙特卡洛模拟）。
4. **不得擅自按推断走**。

8 项问题速查：

| 编号 | 问题 |
|---|---|
| Q1 | 抢夺阈值 m |
| Q2 | 记录物用途 |
| Q3 | "不开发"与"稳健"关系 |
| Q4 | 翻倍基数 |
| Q5 | 平手重掷 |
| Q6 | 崩坏随机分配 |
| Q7 | 终局平局裁决 |
| Q8 | 开发链计数清零条件 |

---

## 12. 性能与质量底线

| 指标 | 要求 |
|---|---|
| 单局首次加载 | < 3 秒 |
| 动画帧率 | 稳定 60fps |
| 移动端 | 不卡顿 |
| 核心逻辑测试覆盖 | 100% 关键路径 |
| 数值平衡 | 提供蒙特卡洛模拟脚本验证 |

---

## 附：与项目提示词的差异说明

| 项 | 项目提示词 | 本规范 | 说明 |
|---|---|---|---|
| 测试目录 | `Tests/` 顶层目录 | 就近放置 | 本规范覆盖，便于查找 |
| 格式化工具 | 未提及 | 文字约定，不强制工具 | 遵循用户选择 |
| 单文件行数 | 未提及 | 不设上限，职责单一 | 遵循用户选择 |

---

**文档结束。** 本规范随项目演进持续更新，重大变更需在 commit message 中注明"规范变更"。
