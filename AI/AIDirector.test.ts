/**
 * src/AI/AIDirector.test.ts
 * 操作类型：新建
 *
 * AI 总控测试
 * 使用 vitest globals
 */
import { GameStore } from '@/Store/GameStore';
import { CreateDefaultConfig } from '@/Types/GameConfig';
import { InputGate } from '@/App/InputGate';
import { AIDifficulty } from '@/Types/AI';
import { GamePhase } from '@/Types/GamePhase';
import { DiceMode } from '@/Types/Dice';
import { CreateAIGameConfig } from './AIConfig';
import { AIDirector } from './AIDirector';

describe('AIDirector', () => {
  const MakeConfig = () =>
    CreateAIGameConfig(2, 12345, [
      { Name: 'H1', Color: '#fff', IsAI: false },
      { Name: 'AI-1', Color: '#f00', IsAI: true, Difficulty: AIDifficulty.Novice },
    ]);

  function PatchSetTimeout(): () => void {
    const Original = global.setTimeout;
    global.setTimeout = ((Fn: (...args: unknown[]) => void, _Ms?: number) => {
      Fn();
      return 0;
    }) as unknown as typeof global.setTimeout;
    return () => {
      global.setTimeout = Original;
    };
  }

  /**
   * 让 P0 手动发射成功并走一步，把当前玩家推进到 P1（AI）的发射阶段
   */
  function AdvanceToAI(Store: GameStore): void {
    Store.Start();
    // P0 发射
    Store.AttemptLaunch();
    // P0 发射成功后进入 SelectMode，手动帮他走一步
    if (Store.Phase === GamePhase.SelectMode && Store.CurrentPlayer === 0) {
      Store.PlayTurn(DiceMode.Steady);
    }
    // 现在应轮到 P1，且 P1 未发射 → LaunchPhase
  }

  it('应正确识别 AI 席位', () => {
    const Director = new AIDirector(MakeConfig());
    expect(Director.IsAI(0)).toBe(false);
    expect(Director.IsAI(1)).toBe(true);
  });

  it('应能获取 AI 玩家配置', () => {
    const Director = new AIDirector(MakeConfig());
    const AI = Director.GetAIPlayer(1);
    expect(AI).not.toBeNull();
    expect(AI!.Name).toBe('AI-1');
  });

  it('应在发射阶段自动提交发射', async () => {
    const Store = new GameStore(CreateDefaultConfig(2, 12345));
    const Input = new InputGate();
    const Director = new AIDirector(MakeConfig());

    let Submitted = false;
    const Restore = PatchSetTimeout();

    try {
      AdvanceToAI(Store);
      expect(Store.CurrentPlayer).toBe(1);
      expect(Store.Phase).toBe(GamePhase.LaunchPhase);

      const PromiseLaunch = Input.RequestLaunch();
      const PromiseAI = Director.PlayForCurrentPlayer(Store, Input);
      await Promise.all([PromiseLaunch, PromiseAI]);
      Store.AttemptLaunch();
      Submitted = true;
    } finally {
      Restore();
    }

    expect(Submitted).toBe(true);
  });

  it('应在选择模式阶段自动提交模式', async () => {
    const Store = new GameStore(CreateDefaultConfig(2, 12345));
    const Input = new InputGate();
    const Director = new AIDirector(MakeConfig());

    let ReceivedMode = '';
    const Restore = PatchSetTimeout();

    try {
      // 推进到 P1 的发射阶段并让它自动发射，直到成功（带上限防挂）
      AdvanceToAI(Store);
      let Attempts = 0;
      while (
        Store.Phase === GamePhase.LaunchPhase &&
        Store.CurrentPlayer === 1 &&
        Attempts < 50
      ) {
        const P1Launch = Input.RequestLaunch();
        const AILaunch = Director.PlayForCurrentPlayer(Store, Input);
        await Promise.all([P1Launch, AILaunch]);
        Store.AttemptLaunch(); // 实际执行发射
        Attempts += 1;
      }

      // 此时 P1 应已发射成功，进入 SelectMode
      expect(Store.Phase).toBe(GamePhase.SelectMode);
      expect(Store.CurrentPlayer).toBe(1);

      const P1Mode = Input.RequestMode();
      const AIMode = Director.PlayForCurrentPlayer(Store, Input);
      const [Mode] = await Promise.all([P1Mode, AIMode]);
      ReceivedMode = Mode;
    } finally {
      Restore();
    }

    expect(ReceivedMode).toBeTruthy();
  });

  it('应发射 Decision 事件', async () => {
    const Store = new GameStore(CreateDefaultConfig(2, 12345));
    const Input = new InputGate();
    const Director = new AIDirector(MakeConfig());

    let DecisionReceived = false;
    Director.On('Decision', () => {
      DecisionReceived = true;
    });

    const Restore = PatchSetTimeout();

    try {
      AdvanceToAI(Store);
      const P1Launch = Input.RequestLaunch();
      const AILaunch = Director.PlayForCurrentPlayer(Store, Input);
      await Promise.all([P1Launch, AILaunch]);
      Store.AttemptLaunch();
    } finally {
      Restore();
    }

    expect(DecisionReceived).toBe(true);
  });
});
