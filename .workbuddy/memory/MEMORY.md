# 《第二绿洲》项目长期记忆

## 项目身份
- 网页策略桌游，2-4人，掷骰驱动零和争夺
- 开发者：温睿（14岁），单人独立开发，WorkBuddy全程参与
- 作品集展示项目，需交付完整可玩产品

## 技术栈
- TypeScript(strict全开) + Vite + Vitest + Canvas 2D + DOM
- 包管理器：npm（pnpm未预装，用npm替代）
- Core层零第三方运行时依赖

## 代码规范要点
- 命名：大驼峰（类/函数/变量），全大写下划线（常量），_前缀（私有），is/has/can前缀（布尔）
- 2空格缩进，单引号，分号，K&R花括号，行宽≤100，尾逗号
- 测试就近放置：Foo.ts → Foo.test.ts
- Core层禁依赖Render/UI/Net
- 自定义错误继承GameError(带Code)
- 全文件交付，文件头标注路径+操作类型

## 已确认的规则决定（8项§15 + 6处冲突点）
- Q1: 抢夺阈值m=0，公共被打到负数时触发；公共恰好=0=终局
- Q2: 5记录位=1公共+4私有
- Q3: "不开发"=完全不掷骰、不占领、无直接效果
- Q4: 翻倍基数=本回合应得领土n的倍率（非私有总额）
- Q5: 抢夺平手双方都重掷，直至分高低
- Q6: 崩坏非发起者独立随机损失[0,floor((x·m2)/4)]，发起者承担剩余
- Q7: 终局平局加赛（仅平手者，双骰，高者胜，仍平手继续）
- Q8: 任何非对子结果都清零连击，含"不开发"模式
- 冲突点1: m2=(n×Multiplier)−公共（逻辑必然）
- 冲突点2: 激进≤6倒扣与对子独立结算，倍率作用于负RawGain
- 冲突点3: 抢夺低者私有不足按方案E守恒
- 冲突点4: 崩坏非发起者私有不足clamp+缺口转发起者+IsConserved标记
- 冲突点5: 崩坏公共max(0,公共−x)，=0则终局
- 冲突点6: 抢夺用单骰1~6，加赛用双骰2~12

## 关键设计决策
- 随机源抽象IRandomSource：Core层不直接用Math.random，联机种子同步关键
- None模式不消耗随机源：保证联机调用序列一致
- 负零问题：用`0 - x`代替`-x`避免Object.is(-0,0)=false
- Phase类型收窄：测试中用`as GamePhase`绕过TS control flow analysis
- SeededRandom用mulberry32算法（确定性、零依赖）

## A优先级核心逻辑状态：已完成
- 8个Core模块 + Errors + Constants + MonteCarloSimulation
- 115个单元测试全部通过，tsc --noEmit零错误
- 蒙特卡洛模拟：2人局平均32回合，抢夺触发率~90%，崩坏~84%

## 后续优先级
- B: 界面（像素风UI、动效、响应式）已完成
- C: 联机（WebSocket房间+服务端权威）
- D: AI对手
- E: 音效动画 已完成

## E 阶段架构决策
- 音频引擎：原生 Web Audio API，零第三方运行时依赖，AudioContext 在用户首次 pointerdown/keydown 后 Resume。
- 音效合成：14 个程序化预设（DiceRoll/DiceSettle/OccupyUp/Down/ChainX2/X3/Break/RobberyStart/Win/Lose/Collapse/LaunchSuccess/Fail/GameOver）。
- 外部资源建议（可选）：ChainBreak 碎玻璃采样、Collapse 低频轰鸣、GameOver 太空尾音，wav/ogg 格式。
- 动画系统：AnimationManager 统一挂载到 LayeredCanvas fx 层 rAF；Animation 基类 + Dispose 钩子支持 DOM 动画清理。
- 核心反馈动画：NumberPop（领土增减弹出）、SeatPulse（当前玩家席位脉冲）、ChainBadge（开发链 ×2/×3/断链）。
- 可访问性：AccessibilitySettings 单例（Mute + ReducedMotion），localStorage 持久化，设置 UI 后续直接接入。
- 事件编排：AnimationCoordinator 订阅 GameStore（Launch/Turn/Tiebreaker/GameOver），不直接依赖 Core。

## 代码索引

- `docs/code-index.xml` — 全部 117 个 .ts 文件的关键变量/类/函数定义位置、文件作用简述、数据流、依赖关系，专为节省 Token 扫描设计。需要快速定位代码时直接查 XML 的 `<hotkeys>` 部分。

## 部署配置
- 目标地址：`https://msmapwr.github.io/the-second-oasis/`
- Vite base：`npm run build:gh` 使用 `--base=/the-second-oasis/`
- 自动部署：`.github/workflows/deploy.yml` 在 push 到 `main` 时触发，构建后复制 `404.html` 作为 SPA fallback
- 本地验证命令：`npm run build:gh` → `npm run preview:gh`
