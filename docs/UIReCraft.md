
## 《第二绿洲》新拟态 UI 重构 —— 完整实施计划

### 问卷结果汇总

| 维度 | 决定 |
|---|---|
| 风格纯度 | **纯粹新拟态**——全面替换，不留 pixel/CRT/glow |
| 圆角规则 | 容器 8px / 内元素 4px / 相交边 0px |
| Canvas | 也新拟态化 |
| 动画 | 全部重写为新拟态风格（阴影渐变过渡） |
| 暗色背景 | `#202020` |
| 强调色 | 绿洲青 `#00F5D4` 仅文字/按钮强调 |
| 阵营色 | 降低饱和度（S×0.7） |
| 亮色主题 | `#e0e0e0` 背景 |
| 按钮 | 标准三态：凸起 → hover上浮 → active凹陷 |
| 输入框 | 内阴影凹陷 |
| 玩家席位 | 凸起卡片 + 阵营降饱和描边 |
| 骰子 | Canvas 新拟态渲染 |
| 看板 | 新拟态：公共数值凸起卡 + 领土格凸起/凹陷 |
| 日志 | 新拟态终端 |
| 暗色文字 | `#d0d0d0` 柔和白 |
| 月球 | 新拟态渲染 |

---

## 一、色彩系统设计

```
暗色主题 (#202020)
├── 主背景:        #202020
├── 凸起面:        #202020 (与背景同色，靠阴影区分)
├── 暗阴影:        #141414  (ΔL ≈ -5, 用于右下)
├── 亮阴影:        #2c2c2c  (ΔL ≈ +5, 用于左上)
├── 凹陷面:        #1c1c1c  (微调，用于输入框槽底)
├── 正文:          #d0d0d0
├── 辅助文字:      #909090
├── 禁用文字:      #606060
├── 强调色(绿洲):   #00F5D4 → 仅按钮主色 / 链接 / 关键数值
├── 阵营色:
│   ├── 蓝   #2563EB (原 #3B82F6, S打7折)
│   ├── 紫   #7C3AED (原 #8B5CF6)
│   ├── 橙   #D97706 (原 #F59E0B)
│   └── 粉   #DB2777 (原 #EC4899)
├── 战术色:
│   ├── 安全绿:    #059669
│   ├── 激进橙:    #EA580C
│   ├── 警报红:    #DC2626
│   └── 不开发灰:  #6B7280

亮色主题 (#e0e0e0)
├── 主背景:        #e0e0e0
├── 暗阴影:        #bebebe
├── 亮阴影:        #ffffff
├── 正文:          #202020
├── 辅助文字:      #606060
├── 其余同上
```

## 二、CSS 阴影变量系统

```css
[data-theme="dark"] {
  /* 核心阴影参数 */
  --nm-bg:           #202020;
  --nm-shadow-dark:  #141414;
  --nm-shadow-light: #2c2c2c;
  --nm-text:         #d0d0d0;
  --nm-text-secondary: #909090;
  --nm-text-dim:     #606060;

  /* 凸起 — 按钮/卡片默认态 */
  --nm-raised-sm:    4px 4px 8px var(--nm-shadow-dark),
                    -4px -4px 8px var(--nm-shadow-light);
  --nm-raised-md:    8px 8px 16px var(--nm-shadow-dark),
                    -8px -8px 16px var(--nm-shadow-light);
  --nm-raised-lg:    12px 12px 24px var(--nm-shadow-dark),
                    -12px -12px 24px var(--nm-shadow-light);

  /* 凹陷 — 输入框/激活态 */
  --nm-pressed-sm:   inset 3px 3px 6px var(--nm-shadow-dark),
                     inset -3px -3px 6px var(--nm-shadow-light);
  --nm-pressed-md:   inset 6px 6px 12px var(--nm-shadow-dark),
                     inset -6px -6px 12px var(--nm-shadow-light);
}

[data-theme="light"] {
  --nm-bg:           #e0e0e0;
  --nm-shadow-dark:  #bebebe;
  --nm-shadow-light: #ffffff;
  --nm-text:         #202020;
  --nm-text-secondary: #606060;
  --nm-text-dim:     #909090;

  --nm-raised-sm:    4px 4px 8px var(--nm-shadow-dark),
                    -4px -4px 8px var(--nm-shadow-light);
  --nm-raised-md:    8px 8px 16px var(--nm-shadow-dark),
                    -8px -8px 16px var(--nm-shadow-light);
  --nm-raised-lg:    12px 12px 24px var(--nm-shadow-dark),
                    -12px -12px 24px var(--nm-shadow-light);

  --nm-pressed-sm:   inset 3px 3px 6px var(--nm-shadow-dark),
                     inset -3px -3px 6px var(--nm-shadow-light);
  --nm-pressed-md:   inset 6px 6px 12px var(--nm-shadow-dark),
                     inset -6px -6px 12px var(--nm-shadow-light);
}
```

## 三、控件规格

### 3.1 按钮

```
默认态:  background: var(--nm-bg);
         box-shadow: var(--nm-raised-sm);
         border: none;
         border-radius: 4px;
         transition: all 0.2s ease;

hover:   transform: translateY(-2px);
         box-shadow: var(--nm-raised-md);  /* 更深阴影 */

active:  transform: translateY(0);
         box-shadow: var(--nm-pressed-sm);  /* 凹陷 */

focus:   outline: none;
         box-shadow: var(--nm-raised-sm), 0 0 0 2px var(--oasis);

disabled: opacity: 0.4; cursor: not-allowed;
```

### 3.2 输入框

```
默认态:  background: var(--nm-bg);
         box-shadow: var(--nm-pressed-sm);  /* 凹陷 */
         border: none;
         border-radius: 4px;

focus:   box-shadow: var(--nm-pressed-md), 0 0 0 1px var(--oasis);
```

### 3.3 卡片/面板

```
容器 (8px圆角):
         background: var(--nm-bg);
         box-shadow: var(--nm-raised-lg);
         border-radius: 8px;

嵌套子面板 (4px圆角):
         background: var(--nm-bg);
         box-shadow: var(--nm-raised-sm);
         border-radius: 4px;
```

### 3.4 开关 Toggle

```
轨道:    width: 48px; height: 24px;
         border-radius: 12px;
         background: var(--nm-bg);
         box-shadow: var(--nm-pressed-sm);

滑块:    width: 20px; height: 20px;
         border-radius: 50%;
         background: var(--nm-bg);
         box-shadow: var(--nm-raised-sm);
         transition: transform 0.2s ease;

active:  滑块 translateX(24px) + 绿洲青背景
```

### 3.5 进度条（AP 条）

```
轨道:    height: 8px; border-radius: 4px;
         background: var(--nm-bg);
         box-shadow: var(--nm-pressed-sm);

填充:    height: 8px; border-radius: 4px;
         background: var(--oasis);
         box-shadow: var(--nm-raised-sm);
```

### 3.6 玩家席位

```
席位卡:  background: var(--nm-bg);
         box-shadow: var(--nm-raised-md);
         border-radius: 8px;
         border-left: 3px solid var(--faction-N);  /* 降饱和阵营色 */

高亮态:  box-shadow: var(--nm-raised-lg),
          0 0 0 1px var(--faction-N);
```

## 四、Canvas 渲染重设计划

### 4.1 看板 (OasisBoardRenderer)

```
公共领土大数字 → 独立的新拟态凸起卡片（Canvas 绘制 rounded rect + 双阴影边框）
领土格阵列:
  - 荒地格: 凹陷效果（inset shadow 模拟）
  - 已占领格: 凸起效果 + 阵营色填充
  - 当前高亮格: 更深的凸起阴影 + 加粗描边
```

### 4.2 骰子 (DiceStage)

```
骰面:  圆角矩形 (4px) + 凸起阴影
点数:  小圆凹陷，暗色填充
骰子体: 凸起立方体，面与面之间用阴影区分深度
```

### 4.3 月球 (MenuViewportRenderer)

```
球体:  径向渐变模拟半球光影，不再是硬边阴阳
环形山: 凹陷圆（inset 阴影）+ 微凸边缘
经纬线: 极淡的微凸线或微凹线
```

## 五、文件变更清单

| # | 文件 | 操作 | 工作量 |
|---|---|---|---|
| 1 | `src/UI/Theme.ts` | 重写 | 中 |
| 2 | `src/UI/StyleInjector.ts` | 重写 | 大 |
| 3 | `src/UI/theme.css` | 重写 | 大 |
| 4 | `src/UI/CanvasTheme.ts` | 重写 | 中 |
| 5 | `src/UI/ThemeManager.ts` | 微调 | 小 |
| 6 | `src/Config/UiConstants.ts` | 微调 | 小 |
| 7 | `src/UI/Components/HeaderHud.ts` | 修改 class/style | 小 |
| 8 | `src/UI/Components/PlayerHudGrid.ts` | 修改 class/style | 中 |
| 9 | `src/UI/Components/ControlConsole.ts` | 修改 class/style | 中 |
| 10 | `src/UI/Components/GameStageView.ts` | 修改 class/style | 小 |
| 11 | `src/UI/Components/MainMenu.ts` | 修改 class/style | 大 |
| 12 | `src/UI/Components/BattleLogTerminal.ts` | 修改 class/style | 中 |
| 13 | `src/UI/Components/CardHandView.ts` | 修改 class/style | 中 |
| 14 | `src/UI/Components/GameOverScreen.ts` | 修改 class/style | 中 |
| 15 | `src/UI/Components/SettingsPanel.ts` | 修改 class/style | 中 |
| 16 | `src/UI/Components/MultiplayerLobby.ts` | 修改 class/style | 中 |
| 17 | `src/UI/Components/StatsPanel.ts` | 修改 class/style | 小 |
| 18 | `src/UI/Components/RulebookPanel.ts` | 修改 class/style | 小 |
| 19 | `src/UI/Components/ReplayPanel.ts` | 修改 class/style | 小 |
| 20 | `src/UI/Components/Component.ts` | 微调 | 小 |
| 21 | `src/Render/OasisBoardRenderer.ts` | Canvas 重绘 | 大 |
| 22 | `src/Render/DiceStage.ts` | Canvas 重绘 | 大 |
| 23 | `src/Render/MenuViewportRenderer.ts` | Canvas 重绘 | 中 |
| 24 | `src/Render/StarfieldRenderer.ts` | Canvas 重绘 | 小 |
| 25 | `src/Render/TerritoryMap.ts` | Canvas 重绘 | 中 |
| 26 | `src/Render/RenderContext.ts` | 微调 | 小 |
| 27 | `src/UI/Layout/Breakpoints.ts` | 不动 | - |
| 28 | `src/UI/Layout/LayoutManager.ts` | 不动 | - |
| 29 | `src/index.html` / 入口 | 微调 | 小 |

## 六、执行顺序

```
Phase 1 — 基础设施（CSS 变量 + 全局样式）
  ├── Theme.ts: 重写色彩系统 + CSS_VARIABLES
  ├── theme.css: 重写 @theme 变量 + 全局样式
  └── UiConstants.ts: 确认字体栈

Phase 2 — DOM 控件层（StyleInjector.ts）
  ├── 定义所有新拟态 CSS class
  ├── 按钮 / 输入框 / 卡片 / 开关 / 进度条 / 滑块
  └── 移除 pixel / CRT / glow / clip-path 相关代码

Phase 3 — 组件适配（逐个组件修改）
  ├── Component.ts 基类 → 确保兼容
  ├── MainMenu / GameOverScreen / SettingsPanel / MultiplayerLobby
  ├── GameStageView / HeaderHud / PlayerHudGrid / ControlConsole
  ├── BattleLogTerminal / CardHandView
  └── StatsPanel / RulebookPanel / ReplayPanel

Phase 4 — Canvas 渲染层
  ├── CanvasTheme.ts: 新调色板
  ├── StarfieldRenderer: 适配背景色
  ├── DiceStage: 新拟态骰子
  ├── OasisBoardRenderer: 新拟态看板
  ├── TerritoryMap: 新拟态领土格
  └── MenuViewportRenderer: 新拟态月球

Phase 5 — 验证
  ├── tsc --noEmit
  ├── npm test
  └── npm run build:gh
```

---

## 七、待确认的边界情况

1. **404.html 和部署**：不需要动，只是样式变了。
2. **Audio + AccessibilitySettings**：不动，音效和可访问性与视觉无关。
3. **Core 层**：完全不动。
4. **AI / Net / Store 层**：完全不动。

---
