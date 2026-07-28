/**
 * server/AIController.ts
 * 操作类型：新建
 *
 * 断线玩家 AI 接管控制器——当玩家断线时，AI 自动代为执行回合操作。
 * 关联：联机架构方案 §3 阶段 7
 *
 * 设计要点：
 * 1. 策略极简：70% 稳健 / 30% 激进，不选"不开发"（避免卡死）
 * 2. 发射阶段自动尝试发射
 * 3. 加赛阶段自动参与
 * 4. 无状态——每次调用的决策仅依赖当前游戏状态（不记忆历史）
 * 5. 可替换：接口设计允许未来替换为更复杂的 AI
 */
import { DiceMode } from './Types';
import type { GameState } from './Types';

/**
 * AI 控制器接口——支持未来替换为不同策略的 AI
 */
export interface IAIController {
  /** 获取 AI 为玩家选择的掷骰模式 */
  SelectDiceMode(State: GameState, PlayerId: number): DiceMode;
  /** AI 是否需要发射（永远需要，除非已发射） */
  ShouldAttemptLaunch(State: GameState, PlayerId: number): boolean;
  /** AI 是否需要参与加赛（永远需要） */
  ShouldRunTiebreaker(_State: GameState, _PlayerId: number): boolean;
}

/**
 * 默认 AI 控制器：简单随机策略
 *
 * 策略逻辑：
 * - 发射阶段：始终尝试发射
 * - 选择模式：70% 稳健（单骰，安全），30% 激进（双骰，可能倒扣但有机会对子连击）
 *   - 不选"不开发"，因为它会让游戏停滞
 * - 加赛：自动参与
 */
export class AIController implements IAIController {
  /**
   * 选择掷骰模式
   * 70% 稳健，30% 激进
   */
  SelectDiceMode(_State: GameState, _PlayerId: number): DiceMode {
    return Math.random() < 0.7 ? DiceMode.Steady : DiceMode.Aggressive;
  }

  /**
   * 发射阶段始终尝试
   */
  ShouldAttemptLaunch(_State: GameState, _PlayerId: number): boolean {
    return true;
  }

  /**
   * 加赛阶段始终参与
   */
  ShouldRunTiebreaker(_State: GameState, _PlayerId: number): boolean {
    return true;
  }
}
