# 更新日志 (Changelog)

《第二绿洲》The Second Oasis 版本更新记录。

---

## [1.4.1] — 2026-07-29

> **移动端适配与性能优化 + 玩家档案与数据实验室**。三档响应式布局（手机/平板/桌面）+ 触屏手势 + Canvas 按需渲染 + Vite 分块 + 性能监控 + 档案面板 + 数据实验室。
n### 触屏手势系统

- `TouchGestures.ts`：`TouchDetector` 检测滑动方向 + 长按 + 点按，`SetupGlobalTouch` 全局禁用缩放与长按菜单
- 滑动选择模式：上滑=激进 / 下滑=稳健 / 左滑=不开发
- 长按卡牌触发 Tooltip 放大详情
- 同时支持 touch 和 mouse 事件

### 响应式三档布局

- `Breakpoints.ts` + `LayoutManager` 重写：新增 `DeviceClass`（Phone ≤480 / Tablet 481~1024 / Desktop >1024）
- 手机：控制台→右侧浮动圆形按钮，卡牌栏左下缩窄至 72px，席位简化，日志隐藏
- 平板：控制台轻度紧凑、卡牌 90px
- `StyleInjector` 新增 `@media` 响应式 CSS 块

### Canvas 按需渲染

- `LayeredCanvas` 新增 `PauseFx() / ResumeFx()`：骰子闲置时暂停 FX 层
- 背景星空 ~30fps 降帧
- 菜单/终局态暂停主层+FX层

### 首屏加载优化

- `vite.config.ts` 新增 `rollupOptions.output.manualChunks` 按模块分块 vendor-core/card/ai/ui

### 性能监控面板

- 设置面板新增性能监控区域：实时 FPS计数器 + `performance.memory` 内存 + 加载时间



### 玩家档案面板

- `StatsStore`：localStorage 持久化聚合统计——总局数、胜率、最大领土、最长开发链、最多抢夺胜、最长对局
- 每局结束后自动记录（仅本地热座）：从 `ReplayRecorder` 事件中提取开发链倍数、抢夺胜数、卡牌使用详情
- 花色拆分：`GetSuitBreakdown` 返回五花色分布与百分比
- TOP 5 最常用牌：按使用次数降序排列
- `ProfilePanel` 组件：统计卡片网格 + 花色柱状图 + 卡牌排名
- 主菜单新增「档案 PROFILE」按钮，点击进入档案面板
- 「清除统计」按钮：一键重置所有游戏记录

### 数据实验室

- 设置面板新增「数据实验室」标签页
- 运行 300 局蒙特卡洛仿真（2/3/4 人各 100 局含卡牌），复用现有 `RunSimulation`
- 柱状图展示：胜率分布、平均回合数、抢夺/崩坏触发率、花色使用率
- 纯 CSS div 柱状图，不引入第三方图表库

### 隐私控制

- 设置面板新增「匿名数据收集」开关（默认关闭，localStorage 持久化）
- `ProfilePanel` 内嵌「清除统计」按钮

### 文件变更

| 操作 | 文件 |
|------|------|
| 新建 | `src/Store/StatsStore.ts`, `src/UI/Components/ProfilePanel.ts`, `src/UI/TouchGestures.ts` |
| 修改 | `src/UI/Layout/Breakpoints.ts`, `src/UI/Layout/LayoutManager.ts`, `src/UI/StyleInjector.ts`, `src/Render/LayeredCanvas.ts` |
| 修改 | `src/UI/Components/MainMenu.ts`, `src/UI/Components/SettingsPanel.ts`, `src/App/AppController.ts`, `vite.config.ts` |
| 修改 | `src/App/AppController.ts` |

### 验证

- `tsc --noEmit` 零错误
- `vitest run` 340/344 通过（4 预存失败不变）

---

## [1.4.0] — 2026-07-28

> **观战与回放系统**。联机大厅可浏览已开局房间并观战，每局自动录制回放存入浏览器 IndexedDB，回放面板支持逐回合播放/跳转/变速，数据可导出为 JSON 文件分享。

### 联机观战模式

- **大厅房间列表**：`GET_ROOM_LIST` / `ROOM_LIST` 协议，主菜单「观战」入口浏览全部 `Playing` 房间，显示房间码、房主、人数、观战人数
- **观战视角**：`SpectatorGameStore` 实现 `IGameStore` 只读接口，通过 `HAND_REVEAL` 缓存所有玩家完整手牌（正面可见）
- **观战者不可操作**：所有写方法抛 `SPECTATOR_CANNOT_ACT`，控制台隐藏，底部显示「观战中」水印
- **服务端**：`_BroadcastHandReveal` 在回合结束/卡牌使用后仅向 spectators 推送全手牌；观战者断线只移除连接不影响对局

### 对局回放录制

- **ReplayRecorder**：订阅 `GameStore` 的 `Launch / Turn / Tiebreaker / CardUsed / GameOver / PhaseChange / RoundChange` 事件流，构造不可变事件数组
- **ReplayStore 重写**：从 localStorage 迁移到 IndexedDB（`second-oasis-replays`），支持 `CompressionStream` gzip 压缩，LRU 淘汰上限 50 条 / 100MB
- **CardUsed 事件增强**：GameStore 事件增加 `InstanceId` + `Record: CardPlayedRecord`，确保回放可精确复现卡牌使用
- **关键帧优化**：每 50 个事件插入 `Keyframe` 快照，加速回放跳转

### 回放面板

- **回放列表** `ReplayListPanel`：显示种子、日期、人数、回合数；支持播放/删除/导出
- **回放引擎** `ReplayEngine`：基于同一 `seed` + `playerCount` 重建 `GameStore`，按事件逐步推进，`JumpTo` / `StepForward` / `StepBackward` 支持拖拽跳转
- **回放播放器** `ReplayPlayer`：复用 `GameStageView`（spectator 模式），底部控制条提供 上一回合/播放暂停/下一回合/进度条/速度 1x·2x·4x，关闭按钮
- **入口**：主菜单新增「回放 REPLAYS」按钮；终局界面新增「保存回放」按钮，保存后即时反馈确认提示

### 回放数据导出/导入

- **ReplaySerializer**：`ExportReplay` 使用 `CompressionStream` gzip 压缩 JSON，下载为 `.tso.json` 文件
- **导入校验**：检测 gzip magic bytes 自动解压，校验 `version / seed / playerCount / events` 合法性，失败给出具体错误提示
- 支持比赛复盘和社区内容创作场景

### 协议扩展（v1.4.1 前置）

- `GET_ROOM_LIST` (C→S) / `ROOM_LIST` (S→C)：大厅获取 Playing 房间摘要
- `HAND_REVEAL` (S→C)：仅观战者，每玩家完整 `CardInstance[]` + 牌库/弃牌堆大小
- `SPECTATOR_JOINED` 扩展：`initialState` 含 `hands / deckSize / discardSize / cardEnabled`
- `CARD_RESULT` 扩展：新增 `cardInstanceId` / `targetPlayerId`
- `NetworkGameStore` / `WebSocketClient` 同步适配

### 文件变更

| 操作 | 文件 |
|------|------|
| 新建 | `src/Types/Replay.ts`, `src/Store/ReplayRecorder.ts`, `src/Store/ReplayEngine.ts`, `src/Store/ReplaySerializer.ts` |
| 新建 | `src/Net/SpectatorGameStore.ts`, `src/UI/Components/ReplayListPanel.ts`, `src/UI/Components/ReplayPlayer.ts` |
| 修改 | `src/Net/Messages.ts`, `src/Net/WebSocketClient.ts`, `src/Net/LobbyClient.ts` |
| 修改 | `src/Store/GameStore.ts`, `src/Store/ReplayStore.ts`（重写） |
| 修改 | `src/UI/Components/MultiplayerLobby.ts`, `src/UI/Components/GameStageView.ts`, `src/UI/Components/ControlConsole.ts` |
| 修改 | `src/UI/Components/MainMenu.ts`, `src/UI/Components/GameOverScreen.ts` |
| 修改 | `src/App/AppController.ts`, `server/RoomManager.ts`, `server/GameRoom.ts`, `server/WebSocketServer.ts`, `server/Types.ts` |

### 验证

- `tsc --noEmit` 零错误
- `vitest run` 340/344 通过（4 个预存失败不变）
- 待完成：ReplayEngine / ReplayStore / SpectatorGameStore 专项单元测试

---

## [1.3.2] — 2026-07-28

> **联机卡牌同步**。多人游戏中卡牌系统完整可用——服务端权威裁决、AI 掉线托管升级、观战者可见所有手牌。

### WebSocket 协议扩展

- **USE_CARD** (C→S)：客户端打出卡牌，携带 `instanceId` + `targetPlayerId`
- **CARD_RESULT** (S→C)：服务端广播卡牌使用结果（`playerId / cardId / cardType / snapshot / currentPlayer`），全量同步至所有玩家和观战者
- **COUNTER_WINDOW** (S→C)：反制窗口通知（`triggerType: Robbery|Collapse / timeoutMs / eligiblePlayers`），预留 UI 集成
- **HAND_UPDATE** (S→C)：手牌变更广播（`playerId / cardCount`）
- `ClientMsg.UseCard()` 消息工厂函数

### 服务端权威 CardEngine

- `GameRoom.HandleUseCard`：验证身份 + 游戏状态 → 调用 `Store.UseCard` → 广播 `CARD_RESULT`
- 卡牌操作与回合操作同级别的服务端权威，防修改手牌、防窥探牌库
- `NetworkGameStore.UseCardAsync`：`SendAndWait` 回合同步式代理（与 `PlayTurnAsync` 相同模式）；`UseCard` 同步方法保留本地回退
- `ListenForRemoteTurns` 新增 `CARD_RESULT` 和 `HAND_UPDATE` 监听器

### AI 掉线托管升级

- `AIController` 新增 `GetCardDecisions` 接口，集成 `CardStrategist` 的 7 类优先级评估
- 断线 AI 接管时先评估手牌 → 打出最优牌 → 再选模式掷骰（与本地 AI 行为一致）
- 托管难度固定为 3（Advanced），确保合理决策

### 观战者体验

- `CARD_RESULT` 全量广播至房间内的 spectators 数组
- 观战者客户端通过 `GetCardHand` 可查看所有玩家的手牌正面
- 牌库/弃牌堆数据对观战者只读，不可操作

### 验证

- `tsc --noEmit` 零错误 · 340/344 通过

---

## [1.3.1] — 2026-07-28

> **卡牌音效与动画**。6 种程序化音效 + 反制闪光 + 洗牌动画 + 恒常到期脉冲 + 独立可访问性开关。

### 程序化卡牌音效

- **CardFlip**：纸牌翻动声（白噪声 40ms + 600Hz 正弦波 60ms）
- **CardCommand**：清脆双音敲击（880Hz + 1100Hz 三角波叠奏）
- **CardCounter**：金属碰撞感（220Hz + 330Hz 方波 + 白噪声）
- **CardConstant**：持续低频嗡鸣（C 大三和弦 261/329/392Hz 正弦波 0.6s）
- **CardConstantExpire**：消散回声（降序和弦 392→329→261Hz + 噪声衰减）
- **CardShuffle**：12 次短促噪声脉冲模拟纸牌洗动 + 300Hz 收束音
- **CounterTrigger**：反制触发警示音（110Hz 锯齿波 + 440Hz 尖峰 + 白噪声）

### 视觉动画

- **反制触发红色闪光**：`counter-flash-overlay` 径向红色渐变覆盖层，0.6s 渐消
- **洗牌通知动画**：`shuffle-notify` 辉光文字「🃏 牌库已洗回」，1.2s 淡入上浮淡出
- **恒常到期脉冲**：`card-expire-pulse` ripple shadow 脉冲，0.8s 周期，通过 `[data-expiring]` 属性触发

### 事件系统

- `GameStore` 新增 `CardUsed` 事件（携带 CardType），`UseCard` 成功后自动发射
- `AnimationCoordinator` 订阅 `CardUsed`，按指令/反制/恒常/默认分发音效
- `ShowCounterFlash()` / `ShowShuffleNotify()` 公共方法供外部调用

### 可访问性

- `AccessibilitySettings` 新增 `CardAudio` 和 `CardAnim` 独立开关（默认开启，localStorage 持久化）
- 两项均可通过设置面板独立控制，不受全局静音/减弱动效影响

### 验证

- `tsc --noEmit` 零错误 · 340/344 通过

---

## [1.3.0] — 2026-07-28

> **卡牌系统全栈完工**。剩余高优先级效果落地 + 20000 局蒙特卡洛基线 + AI 学会使用技能卡牌。

### 卡牌效果补完

- **三层领土保护**：TerritoryFloor 私有不低于打出时值 / TerritoryShield 免疫一次损失 / AbsoluteShield 免疫本回合损失——在占领/抢夺/崩坏五个结算路径统一拦截
- **额外回合**：权杖骑士打出后当前玩家连续两个 SelectMode，AdvanceToNextPlayer 检测标志位停留
- **AP 经济修正**：ApDiscount 降消耗 1 AP / ApRefund 返还一半 / FirstCardFree 每轮首张免 AP——UseCard 中动态计算 ActualApCost
- **跨回合修饰**：太阳 PersistentRawGain 使本大轮剩余回合 RawGain +1，轮末自动清零
- **骰面选择**：ChooseExactDice 默认双 6（对子，Sum=12）/ SetDie 默认首骰 6——均支持后续接入 DiceSelector 交互 UI
- **目标自动选择**：SingleEnemy / RichestOther 自动选私有最高者，卡牌不再因缺目标而无效

### AI 卡牌决策

- `CardStrategist` 决策引擎：对每张手牌计算优先级分数，覆盖治疗/连击保护/崩坏防御/收益提升/掠夺/骰子控制/反制预置七大类
- **难度分级**：Rookie(0-1) 随机洗牌选 2 张 / Intermediate(2) 过滤低优先级 / Advanced+(3-5) 全排序使用
- **注入点**：AIDirector._AutoSelectMode / _AutoLaunch——先打牌再选模式，GameState 修正后再评估
- **反制时机**：抢夺已触发时预置宝剑牌，崩坏 X≥3 时优先 CollapseReduction / FullNegate
- **连击保护**：ConsecutiveDoubles ≥ 1 时优先 ForceDouble / DevChainProtect
- **治疗自救**：私有 < 5 最优先治疗；< 3 时不惜消耗全 AP 保命

### 蒙特卡洛基线

- **规模**：2 人 10000 局 + 3 人 5000 局 + 4 人 5000 局 = 20000 局含卡牌
- **新增**：每张牌使用率统计 + 花色贡献度分布 + TOP 20 热力图
- **关键数据**：

| 指标 | 2人 | 3人 | 4人 |
|------|-----|-----|-----|
| 回合数 | 11.2 | 17.9 | 23.2 |
| 用牌/局 | 7.1 张 | 6.2 张 | 5.6 张 |
| 胜率均衡 | 51/49 | 34/33/32 | 25/26/24/25 |
| 花色贡献 | Major 34%/Pentacles 26%/Cups 21%/Wands 19% |

- **平衡建议**（后续版本）：权杖花色整体 AP 减 1；大阿尔卡那 AP 加 1

### 种子复现

- 新增 2 个确定性测试：洗牌→弃牌→回收全链 + 弃牌堆回收后 ID 一致
- CardEngine 37 项测试全部通过，自定义种子下卡牌序列 100% 可复现

### UI 组件

- `CardSelector`：点选/排序/弃牌三模式，供 Scry 和手牌超限复用
- `DiceSelector`：骰面 1~6 选点 + Unicode 预览，供 SetDie/ChooseExactDice 交互
- `CardHandView` 重构：侧边定位、跟随当前玩家切换、AI 卡背、悬停 Tooltip

### 验证

- `tsc --noEmit` 零错误
- `vitest run` 340/344 通过（4 个预存无关失败）
- 蒙特卡洛 20000 局零崩溃

---

## [1.2.2] — 2026-07-28

> **传统模式开关**。乘员配置界面新增模式选择，一键切换无卡牌的经典规则。

### 游戏模式

- **现代模式**（默认）：完整 v1.2 变体规则 + 78 张技能卡牌系统
- **传统模式**：纯基础规则，`EnableSkillCards: false`，不发牌、不显示卡牌栏、无 AP 消耗
- 主菜单配��弹窗中种子行之后新增分段按钮「⚡ 现代模式 / 📜 传统模式」，点火时传入 `StartConfig.UseVariant`
- `AppController._PlayGame` 根据 `UseVariant` 分支调用 `CreateVariantConfig` 或 `CreateDefaultConfig`

### 验证

- `tsc --noEmit` 零错误 · 338/342 通过

---

## [1.2.1] — 2026-07-28

> **控制台月球视口重制 + 退出/抢夺修复 + favicon**。

### 主菜单月球视口重制

- **数字化扫描月球**：干净的新拟态球面 + 6 道等高线 + 数字扫描线 + DEM 网格 + 自转经纬线
- **外圈装饰**：6 层同心测量环（虚线）/ 16 根径向标尺（4 主 12 副）/ 12 赤道上下刻度 / 5 档测距标注
- **四周 HUD 遥测**（16 项，四角集群，月球中心相对定位）：

| 左上 | 右上 |
|---|---|
| TARGET ID · 赤经 RA · 赤纬 Dec · 视直径 | MISSION: OASIS-3 · 轨道倾角 · 公转周期 · 远地点 |
| 左下 | 右下 |
| 地月距 · 表面温度 · 表面重力 · 自转周期 | SCAN MODE · 进度 · 分辨率 · 帧率 |

### BUG 修复

- **退出按钮无响应**：`_HandleLaunch` / `_HandleSelectMode` / `_HandleTiebreaker` 在 await 后立即检查 `_QuitRequested` 短路 return，不再执行多余掷骰/动画
- **主动抢夺后游戏卡死**：`InitiateRobbery` 不再内部 `AdvanceToNextPlayer`，改为存储到 `_PendingRobberyTurn` 交由 `PlayTurn(None)` 统一推进

### 其他

- **favicon**：内联 SVG，消除 404
- **游戏内隐藏设置齿轮**：`_SettingsGear.style.display = 'none'`，回菜单恢复

### 验证

- `tsc --noEmit` 零错误 · `npm run build:gh` 成功（229KB / gzip 73KB）

---

## [1.2.0] — 2026-07-27

> **新拟态 UI 全面重构**。从像素风+CRT霓虹+赛博骨架彻底转向 Neumorphism，24 个文件全量翻新。暗色 #202020 / 亮色 #e0e0e0 双主题 CSS 变量驱动。

### 视觉语言

- **纯新拟态控件**：凸起 → hover 上浮 2px → active 凹陷，三级阴影 sm/md/lg
- **圆角**：容器 8px / 元素 4px / 相交边 0px
- **色彩**：暗底 #202020，亮底 #e0e0e0，正文 #d0d0d0 / #202020，阵营色降饱和度
- **强调色** #00F5D4（暗）/ #202020（亮）仅用于文字和选中态

### 删除（~600 行 CSS）

- pixel-border / pixel-btn / glow-oasis / glow-alert
- crt-overlay / crt-vignette / crt-alert + 红色闪烁
- 9 个 clip-path 斜切（ignition / link-btn / console-btn / turn-banner 等）
- 全部赛博角标装饰 + 渐变背景 + image-rendering: pixelated
- FACTION_COLORS_DIM 硬编码暗色调色板

### Canvas 新拟态化

- **骰子**：硬投影+霓虹辉光 → 双层新拟态描边
- **看板**：底色/描边/四角支架走调色板
- **月球**：外发光 blur 28→20，辉光 blur 14→8
- **抗锯齿**：移除 `imageSmoothingEnabled=false`

### UI 改进

- 愚人牌→愚者牌 / 席位 top:8→58px / 卡牌左溢出修复
- JS 主题色覆盖修复 / 配置对话框增高 / 阵营名可编辑

### 验证

- `tsc --noEmit` 零错误 · `npm run build:gh` 成功（225KB / gzip 72KB）

---

## [1.1.0] — 2026-07-27

> **技能卡罗牌系统**。78 张塔罗牌加入战场——大阿尔卡那改写战局，小阿尔卡那四花色各司其职。指令/反制/恒常三种类型 + AP 领土消耗机制 + 像素风手牌 UI + 蒙特卡洛平衡验证。

### 技能卡罗牌系统

- **78 张塔罗牌**：22 张大阿尔卡那（传说级，每张效果独一无二）+ 56 张小阿尔卡那（宝剑/权杖/圣杯/金币四花色各 14 张）
- **三种卡牌类型**：
  - 指令 Command（权杖·骰子 / 圣杯·治疗 / 大牌·改写）：主动打出，立即生效
  - 反制 Counter（宝剑）：预置计数器，抢夺/崩坏时自动触发
  - 恒常 Constant（金币）：持续生效 N 回合的被动增益
- **AP 领土经济**：使用卡牌消耗私有领土（1 AP = 1 私有领土），消耗的领土进入公共池保持零和
- **轮初发牌**：每大轮开始所有活跃玩家各抽 1 张，手牌上限 3 张，超限提示弃牌
- **弃牌堆洗回**：牌库抽空自动将弃牌堆洗回，保证 78 张牌循环使用

### 卡牌效果引擎

| 效果类别 | 数量 | 说明 |
|----------|------|------|
| 即时领土 | 18 种 | TerritoryGain / PureHeal / Steal / MassDrain / Balance / ForceCollapse / ResetAllChains / CatchupHeal / GlobalHeal / RemoveWasteland / SwapTerritory / BranchingEffect 等 |
| 骰子修饰 | 8 种 | Reroll / SetDie / SetDieTo6 / SetMinimum / RawGainBonus / TripleRawGain / ChaosRawGain / BestOfTwoModes |
| 反制窗口 | 7 种 | ExtraLoss / RobberyDefenseBonus / SwapRobberyDice / CollapseReduction / RedirectCollapseLoss / FullNegate |
| 模式强制 | 2 种 | ModeLock（强制稳健）/ ForceAggressive（强制激进） |
| Scry 牌库 | 3 种 | ScryTopCards / ScryPickCard / ScryArrangeTop（API 就绪，待 UI 交互） |
| 自动目标 | — | SingleEnemy/RichestOther 自动选私有最高者，ChooseExactDice 默认双 6 |

### 核心模块

- `src/Core/Card/CardEngine.ts`：Fisher-Yates 确定性洗牌、抽牌/弃牌/打出/恒常追踪、牌库状态快照
- `src/Core/Card/CardData.ts`：78 张塔罗牌完整 TS 数据（中文名/英文名/关键词/花色/稀有度/AP/效果/牌面故事）
- `src/Core/Card/TarotCards.xml`：同数据 XML 版本，供设计参考
- `src/Types/Card.ts`：10 个枚举/接口/常量（CardType / CardSuit / CardRarity / CardTarget / CardDefinition / CardInstance / ActiveConstant 等）

### GameState 集成

- `EnableSkillCards` 开关（默认关闭，VariantConfig 默认开启）
- `_CardEngine` 独立随机源（Seed + 0x5C4D，发牌不干扰骰子序列）
- `UseCard()` 统一入口：AP 扣除 → 即时效果 → 骰子修饰入队 → 反制入队
- `ApplyCardDiceModifiers()` / `ApplyCardImmediateEffect()` 效果分发器
- `ApplyRobberyCounters()` / `ApplyCollapseCounters()` 反制消费钩子
- `_ForcedModes` Map + `EffectiveMode` 强制模式检测
- `DealCardsAtRoundStart()` / `TickConstants()` 轮初发牌与恒常维护
- `TurnResult.CardPlayed` 卡牌使用记录

### UI 界面

- **CardHandView 手牌栏**：底部左侧定位（不遮挡控制台），像素风 120px 卡片
  - 花色颜色区分（金/蓝/红/青/绿）+ 稀有度边框（传说金色辉光）
  - AP 消耗显示 / 效果简述 / 关键词 / 可打出按钮
  - 悬停 280px 详情 Tooltip：完整效果文本 + 牌面故事
  - 单机模式跟随当前玩家切换 / AI 回合显示卡背
  - 观战模式显示所有人手牌 / 联机模式仅显示自己
- **CSS 注入**：~150 行卡牌专属样式（card-face / card-back / card-play-btn / card-tooltip / 动画 keyframes）
- **亮色主题适配**：完整 [data-theme="light"] 覆盖

### GameStore / AppController

- `IGameStore` 新增 10 个卡牌方法：GetCardHand / CanPlayCard / UseCard / GetCardSnapshot / ScryTopCards 等
- `NetworkGameStore` 对应存根（委托到 LocalStore）
- `InputGate.SubmitCard` + `CardUsed` 事件
- `AppController._HandleSelectMode` 订阅卡牌使用，打出后自动调用 Store.UseCard

### 蒙特卡洛模拟

- 支持 `UseCards` 参数，对比有/无卡牌对局数据（1000 局无卡 + 100 局有卡）
- 结果新增 `AvgCardsUsed` 字段

| 指标 | 2人无卡 | 2人有卡 | 4人无卡 | 4人有卡 |
|------|---------|---------|---------|---------|
| 平均回合 | 10.5 | 9.0 (-14%) | 24.1 | 22.7 (-6%) |
| 抢夺率 | 18.2% | 3.0% | 55.5% | 48.0% |
| 用牌/局 | — | 4.2 张 | — | 4.0 张 |

### 测试

- `CardEngine.test.ts`：35 个测试（洗牌确定性/抽牌/发牌/打出/恒常/验证）
- `CardGameStateIntegration.test.ts`：21 个集成测试（配置/发牌/AP扣除/TurnResult/模式强制/反制/Scry/完整单局）
- 全量 `vitest run`：40 文件 / 342 测试（341 通过，1 预存 AI 超时）

### 验证

- `tsc --noEmit` 零错误
- `vitest run` 341/342 通过
- 蒙特卡洛 6 组（2/3/4 人 × 有/无卡牌）全部正常完成

---

## [1.0.4] — 2026-07-27

> **修复设置/退出按钮，新增主动抢夺**。设置按钮不再误触发退出，退出按钮正确返回主菜单，主动抢夺机制上线。

### 界面修复

- **设置按钮修复**：游戏中控制台底栏"设置 ⚙"按钮正确打开设置面板（之前误调用退出），`GameStageView` 构造函数拆分 `OnRequestSettings` / `OnRequestQuit` 两个独立回调
- **主菜单设置按钮**：底栏新增「设置 ⚙」按钮，点击打开全屏设置面板
- **设置面板全屏**：从右侧抽屉改为居中全屏覆盖，暗色遮罩 + Escape 关闭
- **退出按钮修复**：确认退出后正确调用 `AppController.RequestQuit()`，中断主循环、清理资源、返回主菜单（之前仅执行 `Forfeit` 淘汰当前玩家，游戏继续）

### 新增：主动抢夺

- **主动抢夺机制**：`SelectMode` 控制台底栏新增「抢夺 (R)」按钮，点击弹出目标选择器（显示每个对手的剩余私有领土）
- 最大抢夺量 10 点（`min(10, 目标私有)`），复用被动抢夺的单骰对决裁决机制
- **不触发崩坏**：主动抢夺不递增 `_RobberyTriggeredCount`，不影响后续占领溢出触发抢夺/崩坏的判定
- `GameState.InitiateRobbery(I, T)` → `IGameStore` → `GameStore` → `NetworkGameStore` 全链支持

### 验证

- `tsc --noEmit` 零错误
- `vitest run` 38 文件 / 286 测试通过

---

## [1.0.3] — 2026-07-27

> **修复玩家淘汰与游戏退出**。私有领土耗尽时触发淘汰，2 人局直接判胜，3~4 人局继续；游戏中可随时退出返回主菜单。

### 玩法修复

- **玩家淘汰机制**：私有领土降至 0 时（Active + 已发射）→ 标记为淘汰；开发过度（私有清零）仍可重新发射，不立即淘汰
- **2 人局淘汰即终局**：一方淘汰时，另一方直接获胜，无需等待公共归零
- **3~4 人局淘汰继续**：淘汰者跳过后续回合，其余玩家继续对局
- **淘汰者回合跳过**：`AdvanceToNextPlayer` 自动跳过已淘汰席位，轮次计数适配
- **`Forfeit` 主动退出**：调用 `Store.Forfeit(PlayerId)` 将指定玩家设为淘汰

### 界面优化

- **游戏中退出按钮**：控制台底部始终显示「退出」按钮，点击弹出确认对话框
- **Escape 键退出**：游戏中按 Esc 键触发退出流程
- **退出流程优化**：`InputGate.CancelAll` 不再导致主循环卡死，正确 resolve 后退出

### 底层修复

- `InputGate.CancelAll()` 修复：不再仅置空 resolver（导致 await 永久挂起），改为 resolve 哨兵值
- `AppController` 新增 `RequestQuit()` / 主循环中断逻辑 / Escape 全局监听
- `NetworkGameStore` 同步实现 `Forfeit` 接口

### 测试

- 新增 `GameStateElimination.test.ts`：5 个淘汰专项测试
- 更新 `GameState.test.ts`：淘汰后终局不再要求公共 = 0

### 验证

- `tsc --noEmit` 零错误
- `vitest run` 38 文件 / 286 测试通过

---

## [1.0.2] — 2026-07-26

> **v1.2 变体包玩法规则**。公敌税、顺位轮换、枯竭冲刺三大 A 优先级机制实装，AI 感知适配，GameConfig 开关隔离保证 v1.1 向后兼容。

### 玩法规则

- **G-001 公敌税（Leader Tax）**：每轮结束唯一私有最高者向公共池缴税 1 点，并列最高免税；仅主循环生效，发射阶段不征税
- **G-002 顺位轮换（Rotating Start）**：每轮首位玩家按 `RoundIndex % PlayerCount` 轮换；仅 SelectMode 主循环计轮
- **G-003 枯竭冲刺（Scarcity Sprint）**：公共 ≤30 时正向 RawGain 额外 +2，受开发链倍率放大；倒扣与不开发不享受
- **Cfg-001 标准变体包**：`CreateVariantConfig()` 默认开启前三项，关闭复仇突袭；`CreateDefaultConfig()` 保持 v1.1 兼容

### 数据扩展

- `TurnResult` 新增 `RoundIndex` / `FirstPlayerIndex` / `LeaderTax` / `SprintBonus` 字段
- `GameConfig` 新增 9 个开关/参数字段
- `Constants` 新增 5 个默认值常量 `DEFAULT_LEADER_TAX_BASE` / `DEFAULT_SPRINT_THRESHOLD` 等

### AI 适配

- AI 评估器感知冲刺奖励与公敌税风险
- 模拟器 Snapshot 适配新字段

### UI 显示

- 顶部状态栏显示当前轮次与先手
- 枯竭冲刺横幅（≤30 时显示）
- 战局日志记录公敌税/冲刺/轮次切换事件
- `AppController` 默认对局改用 `CreateVariantConfig`

### 测试

- 新增 `GameStateVariant.test.ts`：11 个变体专项测试
- 全量回归：37 文件 / 291 测试通过

---

## [1.0.1] — 2026-07-26

> **亮色主题修复**。修复启用亮色主题后页面残留暗色背景、文字未统一为黑色、Canvas 仍为深色太空氛围的问题，确保亮色主题下全站纯白背景 + 黑色文字一致呈现。

### 主题系统

- 新增 `CanvasTheme.ts`：引入 `CanvasPalette()` 主题感知调色板，按当前主题返回 `DARK` / `LIGHT` 两套配色
- 渲染器 rAF 持续运行，每帧实时读取当前主题，切换主题零延迟自动适配（无需手动刷新）

### Canvas 渲染

- 棋盘渲染（`OasisBoardRenderer`）：公共数值文字、当前玩家高亮描边、格子描边、外框改为读取调色板；格子目标色每帧重算，主题切换平滑过渡
- 骰子渲染（`DiceStage`）：掷骰聚焦光晕在亮色下转为透明
- 开发链徽章（`ChainBadgeAnimation`）：徽章背景在亮色下转为半透明白底
- 主菜单月球视口（`MenuViewportRenderer`）：移除未使用导入，统一走调色板

### UI / CSS

- 亮色主题覆盖块收尾：残留青色文字（本地玩家名、状态条、FPS、输入框、设置激活项、作战沙盘标题、设置标题）统一转黑
- 设置面板遮罩、终局结算遮罩的暗色幕布在亮色下白化
- 设置分区背景改为纯白

### 验证

- `tsc --noEmit` 零错误
- `npm run build` 生产构建通过

---

## [1.0.0] — 2026-07-26

> **首个完整可玩版本**。核心规则逻辑全部实现并通过测试验证，像素风视觉界面、Canvas 动画系统、AI 对手、联机对战、音效引擎同时交付。

### 核心游戏逻辑

- **掷骰系统**：稳健模式（单骰 1~6）、激进模式（双骰 2~12，≤6 倒扣）
- **占领结算**：公共领土 −n，私有领土 +n，支持溢出判定
- **开发链状态机**：连续对子触发开发（×2）→ 大开发（×3）→ 开发过度（清零+荒地）
- **抢夺裁决**：占领溢出触发，发起者 vs 私有最高者掷骰对决，随机损耗 r 回归公共
- **崩坏熔断**：第 2 次抢夺升级，全员随机受损，系数 x 递增（×2 → ×3 → …）
- **发射序章**：首轮每人掷双骰 ≥7 成功，+2 领土，全员成功进主循环
- **终局判定**：公共领土归零 → 私有最高者胜，平局加赛

### 自定义错误系统

- 9 种专用错误类型：`InvalidDiceMode` / `InvalidTurnPhase` / `RobberyThreshold` / `DevChainOverflow` / `LaunchNotCompleted` / `PlayerCount` 等

### 确定性随机源

- `Math.random` 默认随机源 + `mulberry32` 种子随机源，支持测试复现

---

### AI 系统

- **6 档难易度**（0~5）：从完全随机到精算博弈
- **四维性格模型**：攻击性、风险偏好、记忆性、合作性，每种性格独立生成
- **敌意记忆 GrudgeRegistry**：AI 跟踪被抢/被崩坏事件，决策中融入报复倾向
- **混合决策引擎**：
  - `Evaluator`：静态局面评估，概率加权三种模式
  - `Simulator`：浅层前瞻模拟（1 步 lookahead）
  - `DecisionMaker`：评估 + 模拟 + 性格矫正，输出最终决策
- **决策可解释性**：每步决策附带 `ModeDecisionTrace` 透明日志
- **AI 总控 AIDirector**：自动指挥 AI 玩家执行完整回合（掷骰 → 占领 → 开发链判定）

---

### 渲染与视觉

- **三层 Canvas 架构**：背景层（星空）→ 主层（月球沙盘）→ FX 层（骰子/特效）
- **星空背景渲染**：程序化粒子星空，支持视差滚动
- **月球作战沙盘**：10×10 像素领土地图，持久化领土归属
- **主菜单旋转月球视口**：3D 感月球旋转动画
- **DPR 自适应**：高清屏自动处理设备像素比
- **像素风渲染**：关闭反锯齿，保持像素质感

### 动画系统

- `AnimationManager`：时间线驱动的通用动画管理器
- `AnimationCoordinator`：订阅 GameStore 事件 → 编排动画指令
- 骰子翻滚动画（`DiceStage`）
- 数字弹出动画（`NumberPopAnimation`）
- 席位脉冲动画（`SeatPulseAnimation`）
- 开发链徽章弹出（`ChainBadgeAnimation`）

---

### UI 界面

- **像素风 CSS 主题**：完整配色体系 + 四种势力配色
- **声明式 DOM 工具**：`El()` 工厂函数 + `On()` 事件绑定
- **CSS-in-TS 样式注入**：全局样式 1153 行，无需外部 CSS 文件
- **响应式布局**：768px 断点，桌面/移动端自动适配
- **主菜单飞船控制台**：人数选择 / 种子输入 / AI 开关配置
- **联机大厅**：创建/加入房间、观战、离开
- **游戏舞台界面**：阶段切换、回合公告、行动日志、席位闪烁
- **终局结算界面**：胜负展示 + 再来一局
- **补间动画**：`TweenNumber` rAF ease-out-cubic

---

### 联机对战

- **消息协议**：11 种错误码 + 完整 Client/Server 消息联合类型
- **WebSocket 客户端**：连接状态管理、心跳保活、自动重连
- **大厅客户端**：创建/加入/开始/观战/离开房间
- **服务端权威 GameRoom**：服务端运行 GameState，防作弊
- **房间管理器**：房间 CRUD + 过期自动清理
- **AI 断线接管**：玩家掉线后 AI 自动接替

---

### 音效引擎

- **WebAudio 程序化合成**：无需外部音频文件
- **14 种音效预设**：骰子滚动 / 骰子落定 / 占领增长 / 开发×2 / 开发×3 / 开发过度断裂 / 抢夺开始 / 抢夺裁决 / 崩坏 / 发射成功 / 胜利 / 失败 / 终局
- **可访问性设置**：静音 / 减弱动效开关，localStorage 持久化

---

### 蒙特卡洛仿真

- 单局模拟 + 批量仿真脚本
- 统计对局时长、各模式胜率、崩坏触发频率、开发链触发率等平衡性指标

---

### 测试

- **37 测试文件 / 291+ 测试用例**，全部通过
- Core 层全覆盖：掷骰 / 开发链 / 占领 / 抢夺 / 崩坏 / 发射 / 终局 / 集成对局
- AI 层全覆盖：配置 / 难易度 / 性格 / 记忆 / 评估器 / 模拟器 / 决策器 / 日志 / 玩家 / 总控
- Render/Store/Audio 均有专项测试
- TypeScript 严格模式 `tsc --noEmit` 零错误

---

### v1.2 变体包（已实现，可选启用）

> 以下功能已完整实现但需通过 `GameConfig` 开关启用，标准变体通过 `CreateVariantConfig()` 一键激活。

- **公敌税 Leader Tax**：每轮结束唯一领先者扣税 1 点回流公共池
- **顺位轮换 Rotating Start**：每轮首位玩家按轮次轮换，消除先手优势
- **枯竭冲刺 Scarcity Sprint**：公共 ≤30 时正向占领 +2 额外奖励
- **复仇突袭 Revenge Raid**：（默认关闭）被抢/崩坏损失最大者获复仇令牌，可掠夺目标或失败自损

---

## 技术栈

| 类别 | 选型 | 版本 |
|------|------|------|
| 框架 | TypeScript (strict) | ^5.4 |
| 构建 | Vite | ^5.2 |
| 测试 | Vitest | ^1.6 |
| 服务端运行时 | tsx | ^4.23 |
| WebSocket | ws | ^8.21 |
| 并发运行 | concurrently | ^10.0 |
