/**
 * src/AI/AIDirector.ts
 * 操作类型：新建
 *
 * AI 总控：调度思考、自动提交、延迟控制、决策透明日志
 * 关联：D 优先级 AI 对手模块 §Phase 5
 *
 * 设计要点：
 * 1. 持有全部 AIPlayer 实例，按席位索引
 * 2. 走 InputGate 自动提交，和人类玩家完全同一通道
 * 3. 思考延迟用 setTimeout 模拟，区间由难度决定
 * 4. 每回合结束后调用 ObserveTurn，更新所有 AI 记忆
 * 5. 提供 OnDecision 事件，UI 可订阅展示 AI 思考过程
 */
import type { PlayerId } from '@/Types/Player';
import type { IGameStore } from '@/Store/GameStore';
import { GamePhase } from '@/Types/GamePhase';
import type { IRandomSource } from '@/Utils/Random/IRandomSource';
import { SeededRandom } from '@/Utils/Random/SeededRandom';
import { InputGate } from '@/App/InputGate';
import type { AIGameConfig } from './AIConfig';
import { AIPlayer } from './AIPlayer';
import { GetDifficultyProfile } from './Difficulty';
import { EventEmitter } from '@/Store/EventEmitter';
import type { TerritorySnapshot } from '@/Types/Territory';
import type { DecisionTrace } from './TransparentLog';
import { EvaluateCardHand } from './CardStrategist';

/**
 * AIDirector 事件
 */
export type AIDirectorEvents = {
  /** AI 完成一次决策 */
  Decision: DecisionTrace;
  /** AI 开始思考 */
  Thinking: { PlayerId: PlayerId };
};

/**
 * 模拟用独立随机源，避免消耗主游戏随机序列
 */
function CreateSimRandom(Seed: number, PlayerId: PlayerId, TurnNumber: number): IRandomSource {
  // 用派生种子，保证同一局面下模拟可复现但不影响主状态
  return new SeededRandom(Seed + PlayerId * 10000 + TurnNumber * 100000);
}

/**
 * AI 总控
 */
export class AIDirector extends EventEmitter<AIDirectorEvents> {
  private readonly _Players: (AIPlayer | null)[];
  private readonly _Config: AIGameConfig;
  private readonly _Random: IRandomSource;
  private _TurnNumber = 0;

  constructor(Config: AIGameConfig, Random?: IRandomSource) {
    super();
    this._Config = Config;
    this._Random = Random ?? new SeededRandom(Config.Seed + 999);
    this._Players = Config.Players.map((P) =>
      P.IsAI ? new AIPlayer(P) : null,
    );
  }

  /**
   * 某席位是否为 AI
   */
  IsAI(PlayerId: PlayerId): boolean {
    return this._Players[PlayerId] !== null;
  }

  /**
   * 获取某席位的 AI 玩家实例
   */
  GetAIPlayer(PlayerId: PlayerId): AIPlayer | null {
    return this._Players[PlayerId];
  }

  /**
   * 为当前玩家自动执行决策
   */
  async PlayForCurrentPlayer(Store: IGameStore, Input: InputGate): Promise<void> {
    const PlayerId = Store.CurrentPlayer;
    if (!this.IsAI(PlayerId)) return;

    const Phase = Store.Phase;
    if (Phase === GamePhase.SelectMode) {
      await this._AutoSelectMode(Store, Input, PlayerId);
    } else if (Phase === GamePhase.LaunchPhase) {
      await this._AutoLaunch(Store, Input, PlayerId);
    } else if (Phase === GamePhase.Tiebreaker) {
      await this._AutoTiebreaker(Store, Input, PlayerId);
    }
  }

  /**
   * 观察一次发射尝试，更新所有 AI 的发射统计
   */
  ObserveLaunch(Result: ReturnType<IGameStore['AttemptLaunch']>, PlayerId: PlayerId): void {
    for (const AI of this._Players) {
      if (AI) AI.ObserveLaunch(Result, PlayerId);
    }
  }

  /**
   * 观察一次回合结算，更新所有 AI 的记忆
   */
  ObserveTurn(Result: ReturnType<IGameStore['PlayTurn']>, Snapshot: TerritorySnapshot): void {
    this._TurnNumber += 1;
    for (const AI of this._Players) {
      if (AI) AI.ObserveTurn(Result, Snapshot, this._TurnNumber);
    }
  }

  /**
   * 观察一次加赛，更新所有 AI
   */
  ObserveTiebreaker(Result: ReturnType<IGameStore['RunTiebreaker']>): void {
    for (const AI of this._Players) {
      if (AI) AI.ObserveTiebreaker(Result);
    }
  }

  /**
   * 获取当前回合数
   */
  get TurnNumber(): number {
    return this._TurnNumber;
  }

  /**
   * 新局重置所有 AI 状态
   */
  Reset(): void {
    this._TurnNumber = 0;
    for (const AI of this._Players) {
      if (AI) AI.Reset();
    }
  }

  /**
   * 自动选择模式
   */
  private async _AutoSelectMode(
    Store: IGameStore,
    Input: InputGate,
    PlayerId: PlayerId,
  ): Promise<void> {
    const AI = this._Players[PlayerId]!;
    this.Emit('Thinking', { PlayerId });

    const CardDecisions = EvaluateCardHand(Store, PlayerId, AI.Difficulty);
    for (const Decision of CardDecisions) {
      Input.SubmitCard(Decision.InstanceId);
    }

    await this._ThinkDelay(PlayerId);

    const SimRandom = CreateSimRandom(
      this._Config.Seed,
      PlayerId,
      this._TurnNumber,
    );
    const { Mode, Trace } = AI.DecideMode(
      Store.Snapshot,
      Store.GetConsecutiveDoubles(PlayerId),
      Store.RobberyTriggeredCount,
      Store.CollapseX,
      SimRandom,
    );

    this.Emit('Decision', Trace);
    Input.SubmitMode(Mode);
  }

  /**
   * 自动发射
   */
  private async _AutoLaunch(
    Store: IGameStore,
    Input: InputGate,
    PlayerId: PlayerId,
  ): Promise<void> {
    const AI = this._Players[PlayerId]!;
    this.Emit('Thinking', { PlayerId });

    const CardDecisions = EvaluateCardHand(Store, PlayerId, AI.Difficulty);
    for (const Decision of CardDecisions) {
      Input.SubmitCard(Decision.InstanceId);
    }

    await this._ThinkDelay(PlayerId);

    const { Trace } = AI.DecideLaunch(Store.Snapshot);
    this.Emit('Decision', Trace);
    Input.SubmitLaunch();
  }

  /**
   * 自动加赛
   */
  private async _AutoTiebreaker(
    Store: IGameStore,
    Input: InputGate,
    PlayerId: PlayerId,
  ): Promise<void> {
    const AI = this._Players[PlayerId]!;
    this.Emit('Thinking', { PlayerId });

    await this._ThinkDelay(PlayerId);

    const { Trace } = AI.DecideTiebreaker(Store.Snapshot);
    this.Emit('Decision', Trace);
    Input.SubmitTiebreaker();
  }

  /**
   * 模拟思考延迟（protected 以允许测试子类覆盖）
   */
  protected _ThinkDelay(PlayerId: PlayerId): Promise<void> {
    const AI = this._Players[PlayerId]!;
    const Profile = GetDifficultyProfile(AI.Difficulty);
    const [Min, Max] = Profile.ThinkingDelayMs;
    const Ms = Min + this._Random.NextInt(0, Max - Min);
    return new Promise((Resolve) => setTimeout(Resolve, Ms));
  }
}

/**
 * 构造一个空 AIDirector（用于无 AI 的对局）
 */
export function CreateNullAIDirector(): AIDirector {
  return new AIDirector({
    PlayerCount: 2,
    Seed: 0,
    Players: [
      { Id: 0, Name: 'P1', Color: '#fff', IsAI: false, Difficulty: 0, Personality: { Aggressiveness: 0.5, RiskTolerance: 0.5, Vengefulness: 0.5, Patience: 0.5 } },
      { Id: 1, Name: 'P2', Color: '#fff', IsAI: false, Difficulty: 0, Personality: { Aggressiveness: 0.5, RiskTolerance: 0.5, Vengefulness: 0.5, Patience: 0.5 } },
    ],
  });
}
