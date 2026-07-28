/**
 * src/AI/AIPlayer.ts
 * 操作类型：新建
 *
 * 单个 AI 玩家实例
 * 关联：D 优先级 AI 对手模块 §Phase 5
 *
 * 设计要点：
 * 1. 封装性格、记忆、难度，负责从 Snapshot 构建决策上下文
 * 2. 观察每回合结果，更新记仇记忆
 * 3. 生成三种场景的决策轨迹（模式/发射/加赛）
 * 4. 发射阶段记录“观察到的其他玩家发射失败次数”，用于叙事调整
 */
import type { PlayerId } from '@/Types/Player';
import type { TerritorySnapshot } from '@/Types/Territory';
import type { DiceMode } from '@/Types/Dice';
import type { LaunchResult } from '@/Types/Launch';
import { LaunchStatus } from '@/Types/Launch';
import type { TurnResult } from '@/Types/Turn';
import type { TiebreakerRound } from '@/Types/GameResult';
import type { IRandomSource } from '@/Utils/Random/IRandomSource';
import type { AIPlayerConfig } from './AIConfig';
import { GrudgeRegistry, GRUDGE_SCORES } from './Memory';
import { DecideMode, type DecideModeContext } from './DecisionMaker';
import type {
  ModeDecisionTrace,
  LaunchDecisionTrace,
  TiebreakerDecisionTrace,
} from './TransparentLog';

export class AIPlayer {
  readonly Id: PlayerId;
  readonly Name: string;
  readonly Color: string;
  readonly Difficulty: AIPlayerConfig['Difficulty'];
  readonly Personality: AIPlayerConfig['Personality'];
  readonly Memory: GrudgeRegistry;

  /** 观察到的其他玩家发射失败次数（当前发射阶段累计） */
  private _ObservedLaunchFailures = 0;
  /** 当前回合数 */
  private _TurnNumber = 0;

  constructor(Config: AIPlayerConfig) {
    this.Id = Config.Id;
    this.Name = Config.Name;
    this.Color = Config.Color;
    this.Difficulty = Config.Difficulty;
    this.Personality = Config.Personality;
    this.Memory = new GrudgeRegistry();
  }

  /**
   * 选择本回合模式
   */
  DecideMode(
    Snapshot: TerritorySnapshot,
    ConsecutiveDoubles: number,
    RobberyTriggeredCount: number,
    CollapseX: number,
    Random: IRandomSource,
  ): { Mode: DiceMode; Trace: ModeDecisionTrace } {
    const Grudges = this.Memory.Snapshot(this._TurnNumber);
    const Ctx: DecideModeContext = {
      PlayerId: this.Id,
      Snapshot,
      ConsecutiveDoubles,
      RobberyTriggeredCount,
      CollapseX,
      Grudges,
      Personality: this.Personality,
      Difficulty: this.Difficulty,
      TurnNumber: this._TurnNumber,
    };
    return DecideMode(Ctx, Random);
  }

  /**
   * 发射阶段决策（当前游戏无分支选择，仅生成叙事日志）
   */
  DecideLaunch(
    _Snapshot: TerritorySnapshot,
  ): { ShouldAttempt: true; Trace: LaunchDecisionTrace } {
    const AllFailures = this._ObservedLaunchFailures;
    let Reason = '尝试发射，抢占先机';
    if (AllFailures > 0) {
      Reason = `已有 ${AllFailures} 名玩家发射失败，成功率较高，尝试发射`;
    }
    const Start = performance.now();
    const Trace: LaunchDecisionTrace = {
      Type: 'Launch',
      PlayerId: this.Id,
      Difficulty: this.Difficulty,
      Personality: this.Personality,
      Reason,
      ObservedLaunchFailures: AllFailures,
      ThinkingTimeMs: Math.round(performance.now() - Start),
    };
    return { ShouldAttempt: true, Trace };
  }

  /**
   * 加赛阶段决策（仅生成叙事日志）
   */
  DecideTiebreaker(
    _Snapshot: TerritorySnapshot,
  ): { ShouldAttempt: true; Trace: TiebreakerDecisionTrace } {
    const Me = _Snapshot.Players[this.Id];
    const BestOpp = _Snapshot.Players
      .filter((P) => P.Id !== this.Id)
      .reduce((Max, P) => Math.max(Max, P.PrivateTerritory), 0);
    let Reason = '加赛一掷，争夺胜利';
    if (Me.PrivateTerritory > BestOpp) {
      Reason = '加赛中保持领先，掷出高点锁定胜局';
    } else {
      Reason = '加赛必须反超，只能全力一搏';
    }
    const Start = performance.now();
    const Trace: TiebreakerDecisionTrace = {
      Type: 'Tiebreaker',
      PlayerId: this.Id,
      Difficulty: this.Difficulty,
      Personality: this.Personality,
      Reason,
      OwnPrivate: Me.PrivateTerritory,
      BestOpponentPrivate: BestOpp,
      ThinkingTimeMs: Math.round(performance.now() - Start),
    };
    return { ShouldAttempt: true, Trace };
  }

  /**
   * 观察回合结果，更新记忆
   */
  ObserveTurn(Result: TurnResult, _Snapshot: TerritorySnapshot, TurnNumber: number): void {
    this._TurnNumber = TurnNumber;
    this.Memory.Decay(TurnNumber);

    // 自己被抢
    if (Result.Robbery && Result.Robbery.Defender === this.Id) {
      const Loss = -Result.Robbery.DefenderDelta;
      if (Loss > 0) {
        this.Memory.Record(
          {
            TargetId: Result.PlayerId,
            BaseScore: GRUDGE_SCORES.RobberyVictim * (Loss / 10),
            IncidentType: 'robbery',
          },
          TurnNumber,
        );
      }
    }

    // 自己被发起者（崩坏中承担剩余）坑
    if (Result.Collapse) {
      const MyLoss = Result.Collapse.PlayerLosses.find((L) => L.Id === this.Id);
      if (MyLoss && MyLoss.ActualLoss > 0) {
        this.Memory.Record(
          {
            TargetId: Result.PlayerId,
            BaseScore: GRUDGE_SCORES.CollapseDamage * (MyLoss.ActualLoss / 10),
            IncidentType: 'collapse',
          },
          TurnNumber,
        );
      }
    }

    // 观察到其他玩家开发过度（喜闻乐见）
    if (Result.IsOverload) {
      this.Memory.Record(
        {
          TargetId: Result.PlayerId,
          BaseScore: GRUDGE_SCORES.OverloadBenefit,
          IncidentType: 'overload-benefit',
        },
        TurnNumber,
      );
    }
  }

  /**
   * 观察发射结果，统计其他玩家失败次数
   */
  ObserveLaunch(Result: LaunchResult, PlayerId: PlayerId): void {
    if (PlayerId !== this.Id && Result.Status === LaunchStatus.Failure) {
      this._ObservedLaunchFailures += 1;
    }
  }

  /**
   * 观察加赛（仅更新回合数）
   */
  ObserveTiebreaker(_Round: TiebreakerRound): void {
    // 加赛无记仇事件，仅用于未来扩展
  }

  /**
   * 新局重置
   */
  Reset(): void {
    this.Memory.Clear();
    this._ObservedLaunchFailures = 0;
    this._TurnNumber = 0;
  }

  /**
   * 获取当前回合数（用于测试）
   */
  GetTurnNumber(): number {
    return this._TurnNumber;
  }
}
