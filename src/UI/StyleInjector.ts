/**
 * src/UI/StyleInjector.ts
 * 操作类型：重写（新拟态UI重构）
 *
 * CSS-in-TS 注入器：一次性注入全局样式
 *
 * 设计要点：
 * 1. 纯粹新拟态：同色系双阴影模拟凸起/凹陷
 * 2. 暗色 #202020 / 亮色 #e0e0e0，双主题 CSS 变量驱动
 * 3. 删除所有 pixel/CRT/clip-path/glow/gradient
 * 4. 所有按钮：凸起→hover上浮→active凹陷
 * 5. 所有输入框：凹陷
 * 6. 圆角：容器8px / 元素4px
 */
import { CSS_VARIABLES } from './Theme';
import { FONT_STACK } from '@/Config/UiConstants';

const GLOBAL_CSS = `
${CSS_VARIABLES}

/* ===== Reset ===== */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--nm-bg);
  color: var(--nm-text);
  font-family: ${FONT_STACK.Body};
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

#app {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

/* ===== 新拟态按钮系统 ===== */

/* 标准凸起按钮 */
.nm-btn {
  background: var(--nm-bg);
  border: none;
  cursor: pointer;
  box-shadow: var(--nm-raised-sm);
  border-radius: var(--nm-radius-element);
  transition: box-shadow 0.2s ease, transform 0.15s ease;
}
.nm-btn:hover:not(:disabled) {
  box-shadow: var(--nm-raised-md);
  transform: translateY(-2px);
}
.nm-btn:active:not(:disabled) {
  box-shadow: var(--nm-pressed-sm);
  transform: translateY(0);
}
.nm-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 凹陷态（用于选中/激活） */
.nm-pressed {
  box-shadow: var(--nm-pressed-sm);
}

/* 新拟态卡片 */
.nm-card {
  background: var(--nm-bg);
  box-shadow: var(--nm-raised-md);
  border-radius: var(--nm-radius-container);
}

/* 新拟态输入框（凹陷） */
.nm-input {
  background: var(--nm-bg);
  color: var(--nm-text);
  border: none;
  box-shadow: var(--nm-pressed-sm);
  border-radius: var(--nm-radius-element);
  outline: none;
  transition: box-shadow 0.2s ease;
}
.nm-input:focus {
  box-shadow: var(--nm-pressed-md);
  border: 1px solid var(--oasis-accent);
}

/* ===== 文本工具 ===== */
.font-display {
  font-family: ${FONT_STACK.Display};
}
.font-mono {
  font-family: ${FONT_STACK.Mono};
}
.text-oasis {
  color: var(--oasis-accent);
}
.text-alert {
  color: var(--alert);
}
.text-safe {
  color: var(--safe);
}
.text-hazard {
  color: var(--hazard);
}
.text-dim {
  color: var(--nm-text-dim);
}

/* ===== 通用动画 ===== */
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.fade-in {
  animation: fade-in 0.3s ease both;
}

@keyframes combo-pop {
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
.combo-badge {
  font-size: 12px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid currentColor;
  background: var(--nm-bg);
  animation: combo-pop 0.3s cubic-bezier(0.2, 0.9, 0.3, 1) both;
}

@keyframes screen-shake {
  0%, 100% { transform: translate(0, 0); }
  10% { transform: translate(-4px, -2px); }
  20% { transform: translate(4px, 2px); }
  30% { transform: translate(-3px, 3px); }
  40% { transform: translate(3px, -3px); }
  50% { transform: translate(-2px, 2px); }
  60% { transform: translate(2px, -2px); }
  70% { transform: translate(-1px, 1px); }
  80% { transform: translate(1px, -1px); }
  90% { transform: translate(-1px, 0); }
}
.is-shaking {
  animation: screen-shake 0.5s ease-in-out;
}

/* ===== 主菜单 ===== */
.cockpit {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  background: var(--nm-bg);
}

.cockpit-topbar {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 20px;
  background: var(--nm-bg);
  box-shadow: var(--nm-raised-sm);
}

.cockpit-title {
  font-size: 18px;
  font-weight: 900;
  letter-spacing: 3px;
  color: var(--oasis-accent);
}
.cockpit-title .sub {
  font-size: 9px;
  font-weight: 400;
  color: var(--nm-text-dim);
  letter-spacing: 4px;
}

.telemetry {
  font-size: 11px;
  color: var(--nm-text-dim);
  letter-spacing: 1px;
}
.telemetry b {
  color: var(--oasis-accent);
  font-weight: 600;
}
.telemetry .sep {
  margin: 0 8px;
  color: var(--nm-text-dim);
}

.cockpit-main {
  flex: 1;
  display: grid;
  grid-template-columns: 248px 1fr 248px;
  gap: 14px;
  padding: 14px;
  min-height: 0;
  overflow: hidden;
}

.cockpit-panel {
  position: relative;
  background: var(--nm-bg);
  box-shadow: var(--nm-raised-md);
  border-radius: var(--nm-radius-container);
  padding: 16px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.panel-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
  color: var(--oasis-accent);
  text-transform: uppercase;
  border-bottom: 1px solid var(--nm-text-dim);
  padding-bottom: 6px;
}

.cockpit-viewport {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.menu-viewport-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.cockpit-viewport .vp-tag {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  letter-spacing: 3px;
  color: var(--oasis-accent);
  opacity: 0.5;
}

.cockpit-console {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 14px 20px;
  background: var(--nm-bg);
  box-shadow: var(--nm-raised-sm);
}

/* 点��按钮 */
.ignition {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 3px;
  color: var(--oasis-accent);
  background: var(--nm-bg);
  border: none;
  padding: 24px 72px;
  cursor: pointer;
  box-shadow: var(--nm-raised-md);
  border-radius: var(--nm-radius-element);
  transition: box-shadow 0.2s ease, transform 0.15s ease;
}
.ignition:hover {
  box-shadow: var(--nm-raised-lg);
  transform: translateY(-2px);
}
.ignition:active {
  box-shadow: var(--nm-pressed-sm);
  transform: translateY(0);
}
.ignition:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 次要按钮 */
.link-btn {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 2px;
  color: var(--nm-text);
  background: var(--nm-bg);
  border: none;
  padding: 22px 44px;
  cursor: pointer;
  box-shadow: var(--nm-raised-sm);
  border-radius: var(--nm-radius-element);
  transition: box-shadow 0.2s ease, transform 0.15s ease;
}
.link-btn:hover {
  box-shadow: var(--nm-raised-md);
  transform: translateY(-2px);
}
.link-btn:active {
  box-shadow: var(--nm-pressed-sm);
  transform: translateY(0);
}
.link-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 配置对话框 */
.config-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  animation: fade-in 0.25s ease both;
}

.config-dialog-card {
  width: 480px;
  max-height: 88vh;
  overflow-y: auto;
  padding: 28px 32px;
  background: var(--nm-bg);
  box-shadow: var(--nm-raised-lg);
  border-radius: var(--nm-radius-container);
  animation: card-in 0.3s cubic-bezier(0.2, 0.9, 0.3, 1) both;
}

@keyframes card-in {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 分段选择器 */
.seg { display: flex; gap: 8px; }
.seg-btn {
  flex: 1;
  padding: 20px 0;
  font-size: 16px;
  font-weight: 600;
  background: var(--nm-bg);
  color: var(--nm-text-secondary);
  box-shadow: var(--nm-raised-sm);
  border-radius: var(--nm-radius-element);
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}
.seg-btn:hover {
  color: var(--nm-text);
  box-shadow: var(--nm-raised-md);
  transform: translateY(-2px);
}
.seg-btn.sel {
  color: var(--oasis-accent);
  box-shadow: var(--nm-pressed-sm);
  border: 1px solid var(--oasis-accent);
}

/* 输入框 */
.cockpit-input {
  width: 100%;
  padding: 12px;
  font-size: 15px;
  background: var(--nm-bg);
  color: var(--nm-text);
  border: none;
  box-shadow: var(--nm-pressed-sm);
  border-radius: var(--nm-radius-element);
  outline: none;
  letter-spacing: 1px;
  transition: box-shadow 0.2s ease;
}
.cockpit-input:focus {
  box-shadow: var(--nm-pressed-md);
  border: 1px solid var(--oasis-accent);
}

/* 图标按钮 */
.cockpit-icon-btn {
  padding: 14px 18px;
  background: var(--nm-bg);
  color: var(--nm-text);
  border: none;
  cursor: pointer;
  font-size: 16px;
  box-shadow: var(--nm-raised-sm);
  border-radius: var(--nm-radius-element);
  transition: all 0.2s ease;
}
.cockpit-icon-btn:hover {
  box-shadow: var(--nm-raised-md);
  transform: translateY(-2px);
}

.cockpit-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* LED 状态灯 */
.led {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--pass);
  vertical-align: middle;
  margin-right: 4px;
  transition: background 0.3s;
}
.led.on {
  background: var(--oasis-accent);
  color: var(--oasis-accent);
  animation: led-blink 1.6s ease-in-out infinite;
}
.led.warn {
  background: var(--hazard);
  color: var(--hazard);
}
.led.alert {
  background: var(--alert);
  color: var(--alert);
  animation: led-blink 0.7s ease-in-out infinite;
}

@keyframes led-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.led-label {
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--nm-text-dim);
}

/* 规则折叠面板 */
.cockpit-rules {
  border-top: 1px solid var(--nm-shadow-light);
  margin-top: 6px;
}
.cockpit-rules .rules-toggle {
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--nm-text-dim);
  cursor: pointer;
  padding: 6px 0;
}
.cockpit-rules .rules-body {
  display: none;
  font-size: 11px;
  color: var(--nm-text-secondary);
  background: var(--nm-bg);
  box-shadow: var(--nm-pressed-sm);
  border-radius: var(--nm-radius-element);
  border-left: 2px solid var(--oasis-accent);
  padding: 8px 12px;
}
.cockpit-rules.open .rules-body {
  display: block;
}

/* 入场动画 */
@keyframes cockpit-rise {
  from {
    opacity: 0;
    transform: translateY(18px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.cockpit > * {
  animation: cockpit-rise 0.5s cubic-bezier(0.2, 0.9, 0.3, 1) both;
}
.cockpit > :nth-child(1) { animation-delay: 0s; }
.cockpit > :nth-child(2) { animation-delay: 0.08s; }
.cockpit > :nth-child(3) { animation-delay: 0.16s; }
.cockpit > :nth-child(4) { animation-delay: 0.24s; }

/* ===== 游戏舞台 ===== */
.game-stage {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.panel-surface {
  background: var(--nm-bg);
  box-shadow: var(--nm-raised-sm);
  border-radius: var(--nm-radius-container);
}

/* 顶部状态栏 */
.stage-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  gap: 16px;
  background: var(--nm-bg);
  box-shadow: var(--nm-raised-sm);
}

.stage-stats {
  display: flex;
  gap: 20px;
}

/* 玩家席位 */
.player-seat {
  position: absolute;
  width: 178px;
  background: var(--nm-bg);
  box-shadow: var(--nm-raised-md);
  border-radius: var(--nm-radius-container);
  border-top: 3px solid var(--c, var(--oasis-accent));
  padding: 8px 12px 10px;
  z-index: 5;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.player-seat.is-current {
  box-shadow: var(--nm-raised-lg);
  transform: scale(1.04);
  z-index: 7;
}
.player-seat.seat-0 { top: 58px; left: 8px; }
.player-seat.seat-1 { top: 58px; right: 8px; }
.player-seat.seat-2 { bottom: 96px; left: 8px; }
.player-seat.seat-3 { bottom: 96px; right: 8px; }

@keyframes turn-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.is-current-turn {
  border-color: var(--oasis-accent);
  animation: turn-pulse 2s ease-in-out infinite;
}

.seat-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}

.seat-value {
  line-height: 1;
}

.seat-flags {
  margin-top: 4px;
}

/* 操作台 */
.control-console {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 5;
  display: flex;
  gap: 12px;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  min-height: 76px;
  padding: 14px 20px;
  background: var(--nm-bg);
  box-shadow: var(--nm-raised-sm);
}

/* 操作按钮 */
.console-btn {
  min-width: 130px;
  padding: 18px 36px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 1px;
  background: var(--nm-bg);
  box-shadow: var(--nm-raised-md);
  border-radius: var(--nm-radius-element);
  border: none;
  cursor: pointer;
  transition: box-shadow 0.2s ease, transform 0.15s ease;
  position: relative;
  overflow: hidden;
  animation: btn-in 0.26s cubic-bezier(0.2, 0.9, 0.3, 1) both;
}
.console-btn.steady { color: var(--safe); }
.console-btn.aggressive { color: var(--hazard); }
.console-btn.pass { color: var(--nm-text-secondary); }
.console-btn.launch { color: var(--faction-0); }
.console-btn.tiebreak { color: var(--faction-2); }
.console-btn.revenge { color: var(--faction-3); }
.console-btn:hover:not(:disabled) {
  box-shadow: var(--nm-raised-lg);
  transform: translateY(-2px);
}
.console-btn:active:not(:disabled) {
  box-shadow: var(--nm-pressed-md);
  transform: translateY(0);
}
.console-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@keyframes btn-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 点击波纹 */
.btn-ripple {
  position: absolute;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.35);
  pointer-events: none;
  animation: ripple 0.55s ease-out forwards;
}

@keyframes ripple {
  to {
    transform: scale(8);
    opacity: 0;
  }
}

.btn-hint {
  position: absolute;
  right: 8px;
  bottom: 8px;
  font-size: 9px;
  letter-spacing: 1px;
  background: var(--nm-bg);
  color: var(--nm-text-dim);
  box-shadow: var(--nm-pressed-sm);
  border-radius: 3px;
  padding: 1px 4px;
  pointer-events: none;
}

/* 回合横幅 */
.turn-banner {
  position: absolute;
  top: 70px;
  left: 50%;
  transform: translate(-50%, -22px);
  z-index: 40;
  padding: 12px 28px;
  font-size: 22px;
  font-weight: 900;
  letter-spacing: 3px;
  color: var(--c, var(--oasis-accent));
  background: var(--nm-bg);
  box-shadow: var(--nm-raised-lg);
  border-radius: var(--nm-radius-container);
  border-left: 5px solid var(--c, var(--oasis-accent));
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.28s ease, transform 0.28s cubic-bezier(0.2, 0.9, 0.3, 1);
}

.turn-banner.show {
  opacity: 1;
  transform: translate(-50%, 0);
}

/* 冲刺横幅 */
.sprint-banner {
  position: absolute;
  top: 70px;
  left: 50%;
  transform: translate(-50%, -22px);
  z-index: 39;
  padding: 8px 24px;
  font-size: 16px;
  font-weight: 900;
  letter-spacing: 6px;
  color: var(--alert);
  background: var(--nm-bg);
  box-shadow: var(--nm-raised-lg);
  border-radius: var(--nm-radius-container);
  border-left: 5px solid var(--alert);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.28s ease, transform 0.28s cubic-bezier(0.2, 0.9, 0.3, 1);
}

.sprint-banner.show {
  opacity: 1;
  transform: translate(-50%, 0);
}

/* 战斗日志 */
.battle-log {
  position: absolute;
  top: 156px;
  right: 14px;
  bottom: 96px;
  width: 280px;
  z-index: 4;
  display: flex;
  flex-direction: column;
  padding: 10px 12px;
  background: var(--nm-bg);
  box-shadow: var(--nm-raised-md);
  border-radius: var(--nm-radius-container);
}

.log-terminal {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  background: var(--nm-bg);
  box-shadow: var(--nm-pressed-sm);
  border-radius: var(--nm-radius-element);
  font-family: ${FONT_STACK.Mono};
  font-size: 12px;
  line-height: 1.6;
}

.log-line {
  display: flex;
  gap: 6px;
  align-items: baseline;
  opacity: 0.9;
}

/* 热座过渡卡片 */
.hotseat-card.cockpit {
  position: relative;
  padding: 48px 64px;
  text-align: center;
  background: var(--nm-bg);
  box-shadow: var(--nm-raised-lg);
  border-radius: var(--nm-radius-container);
  border-top: 6px solid var(--c, var(--oasis-accent));
}

/* 终局卡片 */
.gameover-card.cockpit {
  position: relative;
  padding: 48px 64px;
  max-width: 520px;
  width: 90%;
  text-align: center;
  background: var(--nm-bg);
  box-shadow: var(--nm-raised-lg);
  border-radius: var(--nm-radius-container);
  border-top: 6px solid var(--c, var(--oasis-accent));
  animation: card-in 0.4s cubic-bezier(0.2, 0.9, 0.3, 1) both;
}

/* 终局按钮 */
.go-btn {
  flex: 1;
  padding: 14px;
  font-size: 12px;
  letter-spacing: 1px;
  border: none;
  cursor: pointer;
  border-radius: var(--nm-radius-element);
  transition: box-shadow 0.2s ease, transform 0.15s ease;
  color: var(--nm-text);
  background: var(--nm-bg);
  box-shadow: var(--nm-raised-sm);
}
.go-btn.restart {
  color: var(--oasis-accent);
  box-shadow: var(--nm-raised-md);
}
.go-btn.menu {
  color: var(--nm-text-secondary);
}
.go-btn:hover {
  box-shadow: var(--nm-raised-md);
  transform: translateY(-2px);
}
.go-btn:active {
  box-shadow: var(--nm-pressed-sm);
  transform: translateY(0);
}

/* 终局遮罩 */
.gameover-screen {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.65);
  animation: go-in 0.35s ease both;
}

@keyframes go-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* 数值闪烁 */
@keyframes val-up {
  0%, 100% { color: var(--safe); }
  50% { color: var(--nm-text); }
}

@keyframes val-down {
  0%, 100% { color: var(--alert); }
  50% { color: var(--nm-text); }
}

.seat-value.flash-up {
  animation: val-up 0.35s ease;
}

.seat-value.flash-down {
  animation: val-down 0.35s ease;
}

/* 抢夺闪烁 */
@keyframes seat-flash {
  0%, 100% { box-shadow: var(--nm-raised-md); }
  50% { box-shadow: var(--nm-raised-lg); }
}

.flash-robbery {
  animation: seat-flash 0.4s ease-in-out 3;
}

/* AI 思考中 */
.ai-thinking {
  animation: ai-pulse 1.6s ease-in-out infinite;
}

@keyframes ai-pulse {
  0%, 100% { opacity: 0.92; }
  50% { opacity: 1; }
}

/* 结算呼吸 */
@keyframes busy-breathe {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 0.85; }
}

/* 席位层 */
.seat-layer {
  position: static;
}

.board-spacer {
  display: none;
}

/* ===== 联机大厅 ===== */
.mp-lobby {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 20px;
  gap: 16px;
}

.mp-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.mp-section-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 3px;
  color: var(--oasis-accent);
  text-transform: uppercase;
  opacity: 0.6;
}

.mp-card {
  width: 100%;
  max-width: 520px;
  background: var(--nm-bg);
  box-shadow: var(--nm-raised-md);
  border-radius: var(--nm-radius-container);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mp-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.mp-badge {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--oasis-accent);
  background: var(--nm-bg);
  box-shadow: var(--nm-pressed-sm);
  border-radius: 3px;
  padding: 2px 8px;
}

.mp-card-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--nm-text);
}

.mp-card-desc {
  font-size: 12px;
  color: var(--nm-text-dim);
  line-height: 1.6;
}

.mp-form {
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--nm-bg);
  box-shadow: var(--nm-raised-md);
  border-radius: var(--nm-radius-container);
  padding: 22px;
}

.mp-field-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 2px;
  color: var(--oasis-accent);
}

.mp-action-row {
  display: flex;
  gap: 12px;
}

.mp-back {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 13px;
  color: var(--nm-text-dim);
  transition: color 0.2s;
}
.mp-back:hover {
  color: var(--oasis-accent);
}

.mp-code-card {
  width: 100%;
  max-width: 480px;
  background: var(--nm-bg);
  box-shadow: var(--nm-raised-md);
  border-radius: var(--nm-radius-container);
  padding: 24px;
  text-align: center;
}

.mp-room-code {
  font-size: 48px;
  font-weight: 900;
  letter-spacing: 12px;
  color: var(--oasis-accent);
}

.mp-hint {
  font-size: 11px;
  color: var(--nm-text-dim);
  margin-top: 4px;
}

.mp-player-list {
  width: 100%;
  max-width: 480px;
}

.mp-player-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mp-player-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  font-size: 13px;
  background: var(--nm-bg);
  box-shadow: var(--nm-raised-sm);
  border-radius: var(--nm-radius-element);
}
.mp-player-row.local {
  box-shadow: var(--nm-raised-md);
  border: 1px solid var(--oasis-accent);
}
.mp-player-row.local .mp-player-name {
  color: var(--oasis-accent);
}

.mp-player-name {
  font-weight: 600;
}

.mp-player-tags {
  display: flex;
  gap: 4px;
}

.mp-tag {
  font-size: 9px;
  letter-spacing: 1px;
  color: var(--nm-text-dim);
  background: var(--nm-bg);
  box-shadow: var(--nm-pressed-sm);
  border-radius: 2px;
  padding: 1px 6px;
}

.mp-waiting {
  font-size: 12px;
  color: var(--nm-text-dim);
}

.mp-status {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 16px;
  font-size: 13px;
  background: var(--nm-bg);
  box-shadow: var(--nm-raised-sm);
  border-radius: var(--nm-radius-element);
  gap: 8px;
}

.mp-status.busy {
  color: var(--oasis-accent);
  box-shadow: var(--nm-raised-md);
  border: 1px solid var(--oasis-accent);
}

.mp-status.error {
  color: var(--alert);
  box-shadow: var(--nm-raised-md);
  border: 1px solid var(--alert);
}

/* ===== 玩家配置 ===== */
.player-config-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: var(--nm-bg);
  box-shadow: var(--nm-raised-sm);
  border-radius: var(--nm-radius-element);
}

.player-config-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--nm-text-secondary);
  font-weight: 600;
  min-width: 50px;
}

.player-config-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.color-chip {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  transition: transform 0.15s ease;
}
.color-chip:hover {
  transform: scale(1.15);
  box-shadow: var(--nm-raised-md);
}
.color-chip.active {
  box-shadow: 0 0 0 2px var(--oasis-accent);
}

.color-input {
  width: 32px;
  height: 24px;
  border: none;
  cursor: pointer;
  background: transparent;
  padding: 0;
}

.cockpit-select {
  padding: 8px 12px;
  font-size: 13px;
  background: var(--nm-bg);
  color: var(--nm-text);
  box-shadow: var(--nm-raised-sm);
  border-radius: var(--nm-radius-element);
  border: none;
  cursor: pointer;
  outline: none;
  transition: box-shadow 0.2s;
}
.cockpit-select:focus {
  box-shadow: var(--nm-raised-md);
  border: 1px solid var(--oasis-accent);
}

/* AI 复选框 */
.ai-controls label {
  color: var(--nm-text-secondary);
  font-size: 12px;
}
.ai-controls label input[type='checkbox'] {
  accent-color: var(--oasis-accent);
}

/* ===== 设置面板 ===== */
.settings-gear {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 400;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--nm-bg);
  box-shadow: var(--nm-raised-sm);
  border-radius: var(--nm-radius-element);
  border: none;
  cursor: pointer;
  font-size: 20px;
  color: var(--nm-text-secondary);
  transition: all 0.2s ease;
}
.settings-gear:hover {
  color: var(--oasis-accent);
  box-shadow: var(--nm-raised-md);
  transform: rotate(45deg);
}
.settings-gear:active {
  transform: rotate(90deg) scale(0.95);
  box-shadow: var(--nm-pressed-sm);
}

.settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 500;
  background: rgba(0, 0, 0, 0.35);
  animation: settings-fade-in 0.2s ease both;
}

@keyframes settings-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.settings-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 360px;
  max-width: 90vw;
  height: 100%;
  background: var(--nm-bg);
  box-shadow: var(--nm-raised-lg);
  border-radius: var(--nm-radius-container);
  display: flex;
  flex-direction: column;
  animation: settings-slide-in 0.3s cubic-bezier(0.2, 0.9, 0.3, 1);
  overflow-y: auto;
  z-index: 510;
}

@keyframes settings-slide-in {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  font-size: 18px;
  font-weight: 700;
  border-bottom: 1px solid var(--nm-shadow-light);
}

.settings-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--nm-bg);
  box-shadow: var(--nm-raised-sm);
  border-radius: var(--nm-radius-element);
  border: none;
  cursor: pointer;
  font-size: 18px;
  color: var(--nm-text-dim);
  transition: all 0.15s ease;
}
.settings-close:hover {
  color: var(--alert);
  box-shadow: var(--nm-raised-md);
}

.settings-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 16px;
  overflow-y: auto;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  background: var(--nm-bg);
  box-shadow: var(--nm-pressed-sm);
  border-radius: var(--nm-radius-container);
  border-left: 3px solid var(--oasis-accent);
}

.settings-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--nm-text);
  letter-spacing: 1px;
}

.settings-desc {
  font-size: 11px;
  color: var(--nm-text-dim);
  line-height: 1.5;
}

.theme-toggle-row {
  display: flex;
  gap: 8px;
}

.theme-opt {
  flex: 1;
  padding: 10px 14px;
  font-size: 13px;
  background: var(--nm-bg);
  color: var(--nm-text-secondary);
  box-shadow: var(--nm-raised-sm);
  border-radius: var(--nm-radius-element);
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}
.theme-opt:hover {
  box-shadow: var(--nm-raised-md);
  transform: translateY(-2px);
}
.theme-opt.active {
  color: var(--oasis-accent);
  box-shadow: var(--nm-pressed-sm);
  border: 1px solid var(--oasis-accent);
}

.settings-option-row {
  display: flex;
  gap: 6px;
}

.settings-opt-btn {
  flex: 1;
  padding: 8px 10px;
  font-size: 12px;
  background: var(--nm-bg);
  color: var(--nm-text-secondary);
  box-shadow: var(--nm-raised-sm);
  border-radius: var(--nm-radius-element);
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}
.settings-opt-btn:hover {
  box-shadow: var(--nm-raised-md);
  color: var(--nm-text);
  transform: translateY(-1px);
}
.settings-opt-btn.active {
  color: var(--oasis-accent);
  box-shadow: var(--nm-pressed-sm);
}

.settings-quit-btn {
  margin-top: 8px;
  padding: 10px;
  font-size: 13px;
  font-weight: 600;
  background: var(--nm-bg);
  color: var(--alert);
  box-shadow: var(--nm-raised-sm);
  border-radius: var(--nm-radius-element);
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}
.settings-quit-btn:hover {
  box-shadow: var(--nm-raised-md);
  transform: translateY(-1px);
}

/* 开关滑块 */
.settings-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 26px;
}

.settings-switch input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.switch-slider {
  position: absolute;
  inset: 0;
  cursor: pointer;
  background: var(--nm-bg);
  box-shadow: var(--nm-pressed-sm);
  border-radius: 13px;
  transition: all 0.2s ease;
}

.switch-slider::before {
  content: '';
  position: absolute;
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background: var(--nm-bg);
  box-shadow: var(--nm-raised-sm);
  border-radius: 50%;
  transition: transform 0.2s ease;
}

.settings-switch input:checked + .switch-slider {
  background: var(--oasis-accent);
}

.settings-switch input:checked + .switch-slider::before {
  transform: translateX(22px);
}

/* ===== FPS / 速度指示器 ===== */
.fps-display {
  position: fixed;
  bottom: 8px;
  left: 8px;
  z-index: 200;
  font-family: ${FONT_STACK.Mono};
  font-size: 11px;
  color: var(--oasis-accent);
  background: var(--nm-bg);
  box-shadow: var(--nm-pressed-sm);
  border-radius: 3px;
  padding: 2px 6px;
  display: none;
}
.fps-display.show {
  display: block;
}

.speed-indicator {
  position: fixed;
  bottom: 8px;
  left: 60px;
  z-index: 200;
  font-family: ${FONT_STACK.Mono};
  font-size: 10px;
  color: var(--hazard);
  font-weight: 700;
  background: var(--nm-bg);
  box-shadow: var(--nm-pressed-sm);
  border-radius: 3px;
  padding: 2px 6px;
  display: none;
  animation: speed-pulse 1.5s ease-in-out infinite;
}
.speed-indicator.show {
  display: block;
}

@keyframes speed-pulse {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; }
}

/* ===== 动画速度控制 ===== */
[data-anim-speed="fast"] *, [data-anim-speed="fast"] *::before, [data-anim-speed="fast"] *::after {
  animation-duration: calc(var(--a-dur, 1) * 0.4) !important;
  transition-duration: calc(var(--t-dur, 1) * 0.4) !important;
}

[data-anim-speed="off"] *, [data-anim-speed="off"] *::before, [data-anim-speed="off"] *::after {
  animation-duration: 0s !important;
  transition-duration: 0s !important;
}

[data-anim-speed="normal"] *, [data-anim-speed="normal"] *::before, [data-anim-speed="normal"] *::after {
  animation-duration: var(--a-dur, 1) !important;
  transition-duration: var(--t-dur, 1) !important;
}

[data-font-size="small"] {
  font-size: 90% !important;
}

[data-font-size="large"] {
  font-size: 115% !important;
}

/* ===== 技能卡牌 ===== */
#card-hand-container {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
  animation: card-bar-rise 0.4s cubic-bezier(0.2, 0.9, 0.3, 1) both;
}

@keyframes card-bar-rise {
  from {
    opacity: 0;
    transform: translateY(80px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

#card-ap-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--nm-bg);
  box-shadow: var(--nm-raised-sm);
  border-radius: var(--nm-radius-container);
  padding: 4px 12px;
  margin-bottom: 4px;
  font-family: ${FONT_STACK.Mono};
}

.card-ap-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--oasis-accent);
}

.card-ap-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--hazard);
}

.card-ap-hint {
  font-size: 10px;
  color: var(--nm-text-dim);
}

#card-hand-row {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  background: var(--nm-bg);
  box-shadow: var(--nm-raised-md);
  border-radius: var(--nm-radius-container);
  overflow-x: auto;
  max-width: 95vw;
}

.card-face {
  width: 130px;
  min-width: 130px;
  height: 182px;
  display: flex;
  flex-direction: column;
  background: var(--nm-bg);
  box-shadow: var(--nm-raised-sm);
  border-radius: var(--nm-radius-element);
  padding: 8px;
  gap: 4px;
  transition: box-shadow 0.2s ease, transform 0.15s ease;
  position: relative;
}
.card-face.card-playable {
  cursor: pointer;
}
.card-face.card-playable:hover {
  box-shadow: var(--nm-raised-lg);
  transform: translateY(-4px);
}
.card-face.card-locked {
  opacity: 0.5;
  filter: grayscale(0.6);
  cursor: not-allowed;
}
.card-face.legendary {
  box-shadow: var(--nm-raised-md);
}
.card-face.rare {
  background: var(--nm-bg);
}

.card-suit {
  font-size: 16px;
}

.card-name {
  font-size: 11px;
  font-weight: 700;
  color: var(--nm-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-type-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-type-tag {
  font-size: 9px;
  color: var(--nm-text-dim);
  background: var(--nm-bg);
  box-shadow: var(--nm-pressed-sm);
  border-radius: 2px;
  padding: 1px 5px;
}

.card-cost {
  font-size: 12px;
  font-weight: 700;
  font-family: ${FONT_STACK.Mono};
}

.card-effect {
  font-size: 10px;
  color: var(--nm-text-secondary);
  flex: 1;
  min-height: 28px;
  overflow: hidden;
}

.card-keywords {
  font-size: 9px;
  color: var(--nm-text-dim);
  opacity: 0.25;
}

.card-play-btn {
  padding: 4px 0;
  font-size: 10px;
  font-weight: 700;
  text-align: center;
  background: var(--nm-bg);
  color: var(--oasis-accent);
  box-shadow: var(--nm-raised-sm);
  border-radius: var(--nm-radius-element);
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}
.card-play-btn:hover {
  box-shadow: var(--nm-raised-md);
}

.card-back {
  border: 1px solid var(--hazard);
  background: var(--nm-bg);
  box-shadow: var(--nm-raised-md);
}

.card-play-btn-mini {
  position: absolute;
  bottom: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  border-radius: 3px;
  background: var(--nm-bg);
  color: var(--oasis-accent);
  box-shadow: var(--nm-raised-sm);
  border: none;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}
.card-play-btn-mini:hover {
  box-shadow: var(--nm-raised-md);
}

.card-tooltip {
  display: none;
}

.card-cost-hint {
  position: absolute;
  bottom: 4px;
  right: 4px;
  font-size: 10px;
  font-weight: 700;
  font-family: ${FONT_STACK.Mono};
  pointer-events: none;
}

/* ===== 隐藏滚动条 ===== */
::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}
* {
  scrollbar-width: thin;
  scrollbar-color: var(--nm-text-dim) transparent;
}

/* ===== Canvas ===== */
canvas {
  display: block;
}

/* ===== 亮色主题覆盖 ===== */
[data-theme="light"] .config-dialog-backdrop {
  background: rgba(0, 0, 0, 0.25);
}

[data-theme="light"] .settings-overlay {
  background: rgba(0, 0, 0, 0.15);
}

[data-theme="light"] .gameover-screen {
  background: rgba(0, 0, 0, 0.35);
}

[data-theme="light"] .btn-ripple {
  background: rgba(0, 0, 0, 0.15);
}
`;

let _Injected = false;

/**
 * 注入全局样式
 * 必须在使用任何组件前调用
 */
export function InjectGlobalStyles(): void {
  if (_Injected) return;
  const Style = document.createElement('style');
  Style.id = 'global-styles';
  Style.textContent = GLOBAL_CSS;
  document.head.appendChild(Style);
  _Injected = true;
}

/**
 * 注入自定义样式字符串（用于测试或动态样式）
 */
export function InjectStyle(Css: string): HTMLStyleElement {
  const Style = document.createElement('style');
  Style.textContent = Css;
  document.head.appendChild(Style);
  return Style;
}

/**
 * 重置注入状态（仅测试用）
 */
export function _ResetInjectionForTest(): void {
  _Injected = false;
}
