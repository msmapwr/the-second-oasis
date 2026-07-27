/**
 * src/AI/AIIntegration.test.ts
 * 操作类型：新建
 *
 * AI 集成测试：纯 AI 自动跑完一整局，验证状态机与 AI 导演的协同
 * 关联：D 优先级 AI 对手模块 §Phase 6
 *
 * 设计要点：
 * 1. 用 FastAIDirector 覆盖思考延迟，保证测试在毫秒级完成
 * 2. 通过 InputGate 真实提交，和人类玩家走同一通道
 * 3. 每步先挂起 InputGate 请求，再触发 AI 提交，避免提交发生在 resolver 建立前
 * 4. 每步后调用 AIDirector.Observe*，让 AI 记忆随局推进
 * 5. 验证终局条件、不变量、决策事件轨迹
 */
import { GameStore } from '@/Store/GameStore';
import { CreateDefaultConfig } from '@/Types/GameConfig';
import { GamePhase } from '@/Types/GamePhase';
import { InputGate } from '@/App/InputGate';
import { AIDirector, CreateAIGameConfig, AIDifficulty } from '@/AI';
import type { AIGameConfig } from '@/AI';
import type { PlayerConfig } from '@/Store/PlayerPalette';
import type { DecisionTrace } from '@/AI/TransparentLog';

/**
 * 测试用快速 AI 导演：取消思考延迟，避免测试耗时
 */
class FastAIDirector extends AIDirector {
  protected override _ThinkDelay(): Promise<void> {
    return Promise.resolve();
  }
}

/**
 * 构造一个全 AI 局配置
 */
function MakeAllAIConfig(
  PlayerCount: 2 | 3 | 4,
  Seed: number,
  Difficulty: AIDifficulty,
): AIGameConfig {
  const Colors = ['#0e7c86', '#8b5cf6', '#f59e0b', '#ec4899'];
  const Players: PlayerConfig[] = [];
  for (let I = 0; I < PlayerCount; I++) {
    Players.push({
      Name: `AI-${I + 1}`,
      Color: Colors[I] ?? '#ffffff',
      IsAI: true,
      Difficulty,
    });
  }
  return CreateAIGameConfig(PlayerCount, Seed, Players);
}

describe('AI 集成对局', () => {
  it('2 人 Novice AI 应能自动跑完一整局并满足终局条件', async () => {
    const Seed = 12345;
    const Store = new GameStore(CreateDefaultConfig(2, Seed));
    const Input = new InputGate();
    const Config = MakeAllAIConfig(2, Seed, AIDifficulty.Novice);
    const Director = new FastAIDirector(Config);

    const Traces: DecisionTrace[] = [];
    Director.On('Decision', (Trace) => Traces.push(Trace));

    Store.Start();

    let TurnCount = 0;
    const MaxTurns = 500;

    while (!Store.IsOver && TurnCount < MaxTurns) {
      const Phase = Store.Phase;
      const PlayerId = Store.CurrentPlayer;

      if (Phase === GamePhase.LaunchPhase) {
        const LaunchReq = Input.RequestLaunch();
        const AIAct = Director.PlayForCurrentPlayer(Store, Input);
        await Promise.all([LaunchReq, AIAct]);
        const Result = Store.AttemptLaunch();
        Director.ObserveLaunch(Result, PlayerId);
      } else if (Phase === GamePhase.SelectMode) {
        const ModeReq = Input.RequestMode();
        const AIAct = Director.PlayForCurrentPlayer(Store, Input);
        const [Mode] = await Promise.all([ModeReq, AIAct]);
        const Result = Store.PlayTurn(Mode);
        Director.ObserveTurn(Result, Store.Snapshot);
      } else if (Phase === GamePhase.Tiebreaker) {
        const TieReq = Input.RequestTiebreaker();
        const AIAct = Director.PlayForCurrentPlayer(Store, Input);
        await Promise.all([TieReq, AIAct]);
        const Round = Store.RunTiebreaker();
        Director.ObserveTiebreaker(Round);
      } else {
        throw new Error(`未处理阶段: ${Phase}`);
      }

      // 每步不变量：非负
      expect(Store.Snapshot.PublicTerritory).toBeGreaterThanOrEqual(0);
      for (const P of Store.Snapshot.Players) {
        expect(P.PrivateTerritory).toBeGreaterThanOrEqual(0);
      }

      TurnCount += 1;
    }

    expect(Store.IsOver).toBe(true);
    expect(Store.Result).not.toBeNull();
    expect(Store.Result!.Winners.length).toBeGreaterThanOrEqual(1);
    expect(TurnCount).toBeLessThan(MaxTurns);
    expect(Traces.length).toBeGreaterThan(0);
  });

  it('4 人混合难度 AI 应能自动跑完并产生决策轨迹', async () => {
    const Seed = 67890;
    const Store = new GameStore(CreateDefaultConfig(4, Seed));
    const Input = new InputGate();
    const Players: PlayerConfig[] = [
      { Name: 'AI-Rookie', Color: '#0e7c86', IsAI: true, Difficulty: AIDifficulty.Rookie },
      { Name: 'AI-Novice', Color: '#8b5cf6', IsAI: true, Difficulty: AIDifficulty.Novice },
      { Name: 'AI-Advanced', Color: '#f59e0b', IsAI: true, Difficulty: AIDifficulty.Advanced },
      { Name: 'AI-Master', Color: '#ec4899', IsAI: true, Difficulty: AIDifficulty.Master },
    ];
    const Config = CreateAIGameConfig(4, Seed, Players);
    const Director = new FastAIDirector(Config);

    const Traces: DecisionTrace[] = [];
    Director.On('Decision', (Trace) => Traces.push(Trace));

    Store.Start();

    let TurnCount = 0;
    const MaxTurns = 800;

    while (!Store.IsOver && TurnCount < MaxTurns) {
      const Phase = Store.Phase;
      const PlayerId = Store.CurrentPlayer;

      if (Phase === GamePhase.LaunchPhase) {
        const LaunchReq = Input.RequestLaunch();
        const AIAct = Director.PlayForCurrentPlayer(Store, Input);
        await Promise.all([LaunchReq, AIAct]);
        const Result = Store.AttemptLaunch();
        Director.ObserveLaunch(Result, PlayerId);
      } else if (Phase === GamePhase.SelectMode) {
        const ModeReq = Input.RequestMode();
        const AIAct = Director.PlayForCurrentPlayer(Store, Input);
        const [Mode] = await Promise.all([ModeReq, AIAct]);
        const Result = Store.PlayTurn(Mode);
        Director.ObserveTurn(Result, Store.Snapshot);
      } else if (Phase === GamePhase.Tiebreaker) {
        const TieReq = Input.RequestTiebreaker();
        const AIAct = Director.PlayForCurrentPlayer(Store, Input);
        await Promise.all([TieReq, AIAct]);
        const Round = Store.RunTiebreaker();
        Director.ObserveTiebreaker(Round);
      } else {
        throw new Error(`未处理阶段: ${Phase}`);
      }

      TurnCount += 1;
    }

    expect(Store.IsOver).toBe(true);
    expect(Store.Result).not.toBeNull();
    expect(TurnCount).toBeLessThan(MaxTurns);
    expect(Traces.length).toBeGreaterThan(0);
  });
});
