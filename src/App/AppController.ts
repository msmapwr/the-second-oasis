/**
 * src/App/AppController.ts
 * 操作类型：新建
 *
 * 主控制器：async 主循环 + Phase 路由
 * 关联：B 阶段架构方案 §4.1
 *
 * 设计要点：
 * 1. async/await 主循环：用 InputGate 的 Promise 阻塞等用户输入
 * 2. 铁律：状态先推进（Store.PlayTurn 同步），后回放（日志/动画读不可变 Result）
 * 3. 本地热座：每次玩家切换显示过渡幕（可点击跳过）
 * 4. 支持重新开始 / 返回菜单（外层 loop）
 */
import { GameStore } from '@/Store/GameStore';
import type { IGameStore } from '@/Store/GameStore';
import { CreateVariantConfig } from '@/Types/GameConfig';
import { GamePhase } from '@/Types/GamePhase';
import type { DiceMode } from '@/Types/Dice';
import type { LaunchResult } from '@/Types/Launch';
import type { TurnResult } from '@/Types/Turn';
import type { TiebreakerRound, GameResult } from '@/Types/GameResult';
import type { PlayerId } from '@/Types/Player';
import { InputGate } from './InputGate';
import { LayoutManager } from '@/UI/Layout/LayoutManager';
import { LayeredCanvas } from '@/Render/LayeredCanvas';
import { StarfieldRenderer } from '@/Render/StarfieldRenderer';
import { OasisBoardRenderer } from '@/Render/OasisBoardRenderer';
import { DiceStage } from '@/Render/DiceStage';
import { InjectGlobalStyles } from '@/UI/StyleInjector';
import { El } from '@/UI/Dom';
import { MainMenu, type StartConfig, type MainMenuAction } from '@/UI/Components/MainMenu';
import { MultiplayerLobby, type LobbyResult } from '@/UI/Components/MultiplayerLobby';
import { GameStageView } from '@/UI/Components/GameStageView';
import { GameOverScreen } from '@/UI/Components/GameOverScreen';
import { PlayerPalette } from '@/Store/PlayerPalette';
import { NetworkGameStore } from '@/Net/NetworkGameStore';
import { COLORS } from '@/UI/Theme';
import { AIDirector, CreateAIGameConfig, CreateNullAIDirector } from '@/AI';
import type { AIGameConfig } from '@/AI';
import { AccessibilitySettings } from '@/Audio/AccessibilitySettings';
import { AudioEngine } from '@/Audio/AudioEngine';
import { AnimationManager } from '@/Render/Animation/AnimationManager';
import { AnimationCoordinator } from '@/Render/Animation/AnimationCoordinator';
import { SettingsPanel } from '@/UI/Components/SettingsPanel';
import { On } from '@/UI/Dom';

/**
 * AppController 配置
 */
export interface AppControllerOptions {
  /** 挂载点（默认 #app） */
  MountPoint?: HTMLElement;
}

/**
 * 主控制器
 *
 * 用法：
 *   const App = new AppController();
 *   App.Run();  // 不 await，后台运行
 */
export class AppController {
  private readonly _MountPoint: HTMLElement;
  private readonly _Layout: LayoutManager;
  private _Canvas: LayeredCanvas | null = null;
  private _Starfield: StarfieldRenderer | null = null;
  private _Board: OasisBoardRenderer | null = null;
  private _Dice: DiceStage | null = null;
  private _UiLayer: HTMLElement | null = null;
  /** 可访问性设置（静音 + 减少动画） */
  private readonly _Accessibility: AccessibilitySettings;
  /** 音频引擎 */
  private readonly _Audio: AudioEngine;
  /** 动画管理器 */
  private readonly _AnimManager: AnimationManager;
  /** 动画编排器（每局单独创建/销毁） */
  private _AnimCoordinator: AnimationCoordinator | null = null;
  /** 设置面板（单例，复用） */
  private _SettingsPanel: SettingsPanel | null = null;
  /** 设置齿轮按钮 */
  private readonly _SettingsGear: HTMLElement;
  /** FPS 显示器 */
  private readonly _FpsDisplay: HTMLElement;
  /** FPS 计算：上一帧时间戳 */
  private _LastFpsTs = 0;
  private _FpsFrameCount = 0;
  private _CurrentFps = 60;
  /** 急速模式：跳过全部动画 */
  private _SpeedMode = false;
  private _SpeedIndicator: HTMLElement;
  private _QuitRequested = false;
  private _CurrentInput: InputGate | null = null;
  private _EscapeHandler: ((E: KeyboardEvent) => void) | null = null;

  constructor(Opts: AppControllerOptions = {}) {
    this._MountPoint = Opts.MountPoint ?? document.getElementById('app')!;
    // 注入全局样式
    InjectGlobalStyles();
    // 创建布局管理器
    this._Layout = new LayoutManager();
    // 可访问性设置：先埋接口，后续设置 UI 直接读写
    this._Accessibility = new AccessibilitySettings();
    // 动画管理器：统一管理 Canvas + DOM 动画时间线
    this._AnimManager = new AnimationManager(this._Accessibility);
    // 音频引擎：零第三方依赖，用户首次交互后 Resume
    this._Audio = new AudioEngine({ Settings: this._Accessibility });
    // 创建分层 Canvas
    this._Canvas = new LayeredCanvas(this._MountPoint, this._Layout, {
      OnBgFrame: (Ts) => {
        // 背景层：舷窗外的星空（~30fps 降帧）
        this._Starfield?.Render(Ts);
      },
      OnBoardFrame: (Ts, Dt) => {
        this._Board?.Render(Ts, Dt);
        this._CountFps(Ts);
      },
      OnFxFrame: (Ts, Dt) => {
        // 特效层：像素骰子翻滚动画 + 其它动画
        this._Dice?.Render(Ts, Dt);
        this._AnimManager?.UpdateAndRender(Ts, Dt, this._Canvas!.FxCtx);
      },
    });
    // 星空渲染器绑定背景层上下文
    this._Starfield = new StarfieldRenderer(this._Canvas.BgCtx);
    // 月球看板渲染器绑定主层上下文
    this._Board = new OasisBoardRenderer(this._Canvas.BoardCtx);
    // 骰子舞台绑定特效层上下文
    this._Dice = new DiceStage(this._Canvas.FxCtx);
    this._Canvas.Start();
    // 创建 UI overlay 层
    this._UiLayer = El({
      Tag: 'div',
      Parent: this._MountPoint,
      Class: 'ui-layer',
      Style: 'position:absolute;inset:0;z-index:30;pointer-events:none;',
    });
    // 加载保存的设置项
    this._LoadSavedSettings();
    // 创建设置齿轮按钮（固定在右上角）
    this._SettingsGear = El({
      Tag: 'button',
      Class: 'settings-gear',
      Parent: this._MountPoint,
      Title: '设置',
      Html: '<span class="gear-icon">⚙</span>',
    });
    On(this._SettingsGear, 'click', () => this._OpenSettings());
    // 创建 FPS 显示器
    this._FpsDisplay = El({
      Tag: 'div',
      Class: 'fps-display',
      Parent: this._MountPoint,
      Text: 'FPS: 60',
    });
    // 每 500ms 更新一次 FPS 显示（降低更新频率避免闪烁）
    window.setInterval(() => this._UpdateFpsDisplay(), 500);
    this._LastFpsTs = performance.now();
    // 急速模式指示器（默认隐藏）
    this._SpeedIndicator = El({
      Tag: 'div',
      Class: 'speed-indicator',
      Parent: this._MountPoint,
      Text: '⚡ 急速模式',
    });
    // 启动后默认在菜单态：暂停主层+特效层，仅保留星空背景低频渲染
    this._Canvas.PauseLayers();
    // 用户首次交互后恢复 AudioContext（浏览器策略要求手势）
    this._RequestAudioResume();
  }

  /**
   * 监听一次用户交互，然后恢复 AudioContext
   */
  private _RequestAudioResume(): void {
    const Handler = (): void => {
      void this._Audio.Resume();
      this._MountPoint.removeEventListener('pointerdown', Handler);
      this._MountPoint.removeEventListener('keydown', Handler);
    };
    this._MountPoint.addEventListener('pointerdown', Handler, { once: true });
    this._MountPoint.addEventListener('keydown', Handler, { once: true });
  }

  /**
   * 主入口：显示主菜单，开始游戏循环
   *
   * 循环结构：
   *   - 主菜单：用户选择本地热座 或 联机
   *     - Local：热座模式（带 StartConfig）
   *     - Multiplayer：进入联机大厅
   *   - 玩一局（内部显示终局界面）
   *   - 等用户选择：menu→返回主菜单；restart→本地热座同配置再玩
   */
  async Run(): Promise<void> {
    let LastLocalConfig: StartConfig | null = null;
    let LastWasLocal = false;
    while (true) {
      if (!LastWasLocal || LastLocalConfig === null) {
        const Action = await this._ShowMenuAndWait();
        if (Action.Kind === 'Local') {
          LastLocalConfig = Action.Config;
          LastWasLocal = true;
          await this._PlayGame(LastLocalConfig);
        } else {
          LastWasLocal = false;
          const Played = await this._PlayMultiplayer();
          if (!Played) {
            // 用户从大厅直接返回，未开局，跳过终局等待直接回到主菜单
            continue;
          }
        }
      } else {
        // 本地热座重玩
        await this._PlayGame(LastLocalConfig);
      }
      const Choice = await this._WaitGameOverChoice();
      if (Choice === 'menu') {
        LastLocalConfig = null;
        LastWasLocal = false;
      }
    }
  }

  /**
   * 显示主菜单，返回用户选择的动作
   */
  private _ShowMenuAndWait(): Promise<MainMenuAction> {
    return new Promise<MainMenuAction>((Resolve) => {
      // 回到菜单时恢复默认页面主题与默认玩家配置
      this._ResetPageTheme();
      PlayerPalette.ResetConfig();
      this._SettingsGear.style.display = '';
      const Menu = new MainMenu((Action) => {
        Menu.Unmount();
        Resolve(Action);
      }, () => this._OpenSettings());
      Menu.Mount(this._UiLayer!);
    });
  }

  /**
   * 联机流程：显示大厅 → 创建/加入房间 → 等待开局 → 进入对局
   * @returns 是否实际开局（true=玩了，false=用户返回菜单）
   */
  private async _PlayMultiplayer(): Promise<boolean> {
    // 用数组持引用以规避 TS 在 Promise 闭包中对 null 的 narrow 推断
    const Ref: { Lobby: MultiplayerLobby | null; NetStore: NetworkGameStore | null } = {
      Lobby: null,
      NetStore: null,
    };

    try {
      const Result = await new Promise<LobbyResult>((Resolve) => {
        Ref.Lobby = new MultiplayerLobby((R) => Resolve(R));
        Ref.Lobby.Mount(this._UiLayer!);
      });

      if (Result.Kind === 'BackToMenu') {
        Ref.Lobby?.Unmount();
        Ref.Lobby = null;
        return false;
      }

      // 联机开局
      Ref.NetStore = Result.Store;
      const PlayerCount = Result.PlayerCount;
      const Seed = Result.Seed;
      Ref.Lobby?.Unmount();
      Ref.Lobby = null;

      // NetworkGameStore 已在 MultiplayerLobby 中 InitFromGameStarting，
      // 直接走统一 _PlayGame 路径（不再调 StartAsync）
      await this._PlayGame(
        {
          PlayerCount: PlayerCount as 2 | 3 | 4,
          Seed,
          Players: this._DefaultPlayers(PlayerCount as 2 | 3 | 4),
        },
        Ref.NetStore,
      );

      return true;
    } finally {
      // 联机对局结束，断开 WebSocket
      if (Ref.NetStore) {
        Ref.NetStore.LeaveRoom();
      }
      Ref.Lobby?.Unmount();
    }
  }

  /**
   * 运行一局完整游戏
   * @param Config 游戏配置
   * @param ExistingStore 可选的外部 Store（联机模式传入 NetworkGameStore，热座模式不传则自动创建）
   */
  private async _PlayGame(Config: StartConfig, ExistingStore?: IGameStore): Promise<void> {
    PlayerPalette.SetConfig(Config.Players);
    const Store = ExistingStore ?? new GameStore(
      CreateVariantConfig(Config.PlayerCount, Config.Seed),
    );
    const Input = new InputGate();
    this._CurrentInput = Input;
    this._QuitRequested = false;

    this._EscapeHandler = (E: KeyboardEvent): void => {
      if (E.key === 'Escape') {
        E.preventDefault();
        this.RequestQuit();
      }
    };
    document.addEventListener('keydown', this._EscapeHandler);

    // 本地对局才创建 AI 导演；联机模式下不创建，避免 AI 向服务器发送决策
    const AIGameConfig: AIGameConfig = CreateAIGameConfig(
      Config.PlayerCount,
      Config.Seed,
      Config.Players,
    );
    const HasAI = AIGameConfig.Players.some((P) => P.IsAI);
    const AIDirectorInstance = HasAI ? new AIDirector(AIGameConfig) : CreateNullAIDirector();

    // 绑定键盘快捷键（免鼠标操作），游戏结束/退出时解绑
    Input.BindKeyboard();
    this._SettingsGear.style.display = 'none';

    // 创建游戏舞台视图
    const Stage = new GameStageView({
      Store, Input, AIDirector: AIDirectorInstance,
      Mode: ExistingStore ? 'multiplayer' : 'single',
      MyPlayerId: ExistingStore ? (ExistingStore as { MyPlayerId?: number }).MyPlayerId ?? 0 : 0,
      IsAI: (Pid: number) => AIDirectorInstance.IsAI(Pid),
      OnRequestSettings: () => this._OpenSettings(),
      OnRequestQuit: () => this.RequestQuit(),
    });
    Stage.Mount(this._UiLayer!);
    Stage.ClearLog();

    // 清空上一局残留动画，并绑定本局动画编排器
    this._AnimManager.Clear();
    this._AnimCoordinator?.Dispose();
    this._AnimCoordinator = new AnimationCoordinator(
      Store,
      this._AnimManager,
      this._Audio,
      Stage,
    );

    // 启动游戏（联机模式下 NetworkGameStore 已在 MultiplayerLobby 中 InitFromGameStarting，
    // StartAsync 会再次向服务端请求 GAME_STARTING，房主会重复触发——故仅本地热座调用）
    if (ExistingStore === undefined) {
      await Store.StartAsync();
    }
    // 看板数据源绑定到当前对局（菜单/终局时清空）
    this._Board?.SetSource(Store);
    // 进入对局：恢复主层+特效层渲染
    this._Canvas?.ResumeLayers();
    Stage.SetPhase(Store.Phase);
    Stage.AppendLog('Info', `游戏开始 · ${Config.PlayerCount} 人局 · 种子 ${Config.Seed}`);
    if (HasAI) {
      Stage.AppendLog('Info', '本局包含 AI 对手');
    }
    // 初始主题色为首回合玩家色
    this._ApplyTurnTheme(Store.CurrentPlayer);

    // 主循环
    while (!Store.IsOver && !this._QuitRequested) {
      const Phase = Store.Phase;

      if (Phase === GamePhase.LaunchPhase) {
        await this._HandleLaunch(Store, Input, Stage, AIDirectorInstance);
      } else if (Phase === GamePhase.SelectMode) {
        await this._HandleSelectMode(Store, Input, Stage, AIDirectorInstance);
      } else if (Phase === GamePhase.Tiebreaker) {
        await this._HandleTiebreaker(Store, Input, Stage, AIDirectorInstance);
      } else {
        break;
      }
    }

    AIDirectorInstance.Reset();

    const QuitEarly = this._QuitRequested;

    if (QuitEarly && !Store.IsOver) {
      Input.UnbindKeyboard();
      if (this._EscapeHandler) {
        document.removeEventListener('keydown', this._EscapeHandler);
        this._EscapeHandler = null;
      }
      Stage.Unmount();
      this._AnimCoordinator?.Dispose();
      this._AnimCoordinator = null;
      this._Board?.SetSource(null);
      this._Canvas?.PauseLayers();
      this._CurrentInput = null;
      return;
    }

    // 终局
    const Result = Store.Result!;
    this._LogGameOver(Stage, Result);

    // 解绑键盘快捷键
    Input.UnbindKeyboard();
    if (this._EscapeHandler) {
      document.removeEventListener('keydown', this._EscapeHandler);
      this._EscapeHandler = null;
    }
    this._CurrentInput = null;
    // 卸载舞台，显示终局界面
    Stage.Unmount();
    // 销毁本局动画编排器
    this._AnimCoordinator?.Dispose();
    this._AnimCoordinator = null;
    // 清空看板数据源（终局界面为全屏覆盖层，停画省资源）
    this._Board?.SetSource(null);
    // 终局态：暂停主层+特效层渲染，省 CPU/GPU
    this._Canvas?.PauseLayers();
    this._ShowGameOver(Result);
  }

  /**
   * 处理发射阶段
   */
  private async _HandleLaunch(
    Store: IGameStore,
    Input: InputGate,
    Stage: GameStageView,
    AIDirectorInstance: AIDirector,
  ): Promise<void> {
    const PlayerId = Store.CurrentPlayer;
    this._ApplyTurnTheme(PlayerId);
    if (!this._SpeedMode) Stage.AnnounceTurn(PlayerId, '发射');
    Stage.SetPhase(Store.Phase);

    // 先挂起输入请求，再让 AI 在思考后提交；保证提交落在等待中的 resolver 上
    const LaunchPromise = Input.RequestLaunch();
    if (AIDirectorInstance.IsAI(PlayerId)) {
      await Promise.all([
        LaunchPromise,
        AIDirectorInstance.PlayForCurrentPlayer(Store, Input),
      ]);
    } else {
      await LaunchPromise;
    }

    if (this._QuitRequested) return;

    // 冻结看板（急速模式跳过）
    if (!this._SpeedMode) this._Board?.Freeze();
    // 推进状态（同步）
    const Result = await Store.AttemptLaunchAsync();
    AIDirectorInstance.ObserveLaunch(Result, PlayerId);

    // 收起按钮 → 播放骰子翻滚 → 回放
    Stage.ShowBusy('发射结算中…');
    await this._PlayDice([Array.from(Result.Dice)], PlayerPalette.Color(PlayerId));
    // 急速模式：直接解冻；正常模式：骰子落定后解冻
    if (!this._SpeedMode) {
      this._Board?.Unfreeze();
      this._Board?.ShowDiceResult(PlayerId, Array.from(Result.Dice), PlayerPalette.Color(PlayerId));
    }
    this._LogLaunch(Stage, Result, PlayerId);
    Stage.SetPhase(Store.Phase);
  }

  /**
   * 处理模式选择阶段
   */
  private async _HandleSelectMode(
    Store: IGameStore,
    Input: InputGate,
    Stage: GameStageView,
    AIDirectorInstance: AIDirector,
  ): Promise<void> {
    const PlayerId = Store.CurrentPlayer;
    this._ApplyTurnTheme(PlayerId);
    if (!this._SpeedMode) Stage.AnnounceTurn(PlayerId, '回合');
    Stage.SetPhase(Store.Phase);

    let UnsubCard: (() => void) | null = null;
    if (Store.CardEnabled) {
      UnsubCard = Input.On('CardUsed', (InstanceId: number) => {
        Store.UseCard(PlayerId, InstanceId, null);
      });
    }

    const ModePromise = Input.RequestMode();

    let Mode: DiceMode;
    if (AIDirectorInstance.IsAI(PlayerId)) {
      [Mode] = await Promise.all([
        ModePromise,
        AIDirectorInstance.PlayForCurrentPlayer(Store, Input),
      ]);
    } else {
      Mode = await ModePromise;
    }

    if (this._QuitRequested) return;

    if (UnsubCard) UnsubCard();

    // 冻结看板（急速模式跳过）
    if (!this._SpeedMode) this._Board?.Freeze();
    const Result = await Store.PlayTurnAsync(Mode);
    AIDirectorInstance.ObserveTurn(Result, Store.Snapshot);

    Stage.ShowBusy('回合结算中…');
    if (Result.Dice && Result.Dice.Dice.length > 0) {
      await this._PlayDice([Array.from(Result.Dice.Dice)], PlayerPalette.Color(PlayerId));
    }
    if (!this._SpeedMode) {
      this._Board?.Unfreeze();
      this._Board?.ApplyEvent(Result);
      if (Result.Dice && Result.Dice.Dice.length > 0) {
        this._Board?.ShowDiceResult(PlayerId, Array.from(Result.Dice.Dice), PlayerPalette.Color(PlayerId));
      }
    } else {
      this._Board?.ApplyEvent(Result);
    }
    this._LogTurn(Stage, Result, PlayerId);
    if (!this._SpeedMode) {
      if (Result.Robbery) {
        Stage.FlashSeats([PlayerId, Result.Robbery.Defender as number]);
      }
      if (Result.Collapse) {
        this._TriggerCollapseFx();
        Stage.FlashSeats(Store.Snapshot.Players.map((P) => P.Id as number));
      }
    }
    Stage.SetPhase(Store.Phase);
  }

  /**
   * 处理加赛阶段
   */
  private async _HandleTiebreaker(
    Store: IGameStore,
    Input: InputGate,
    Stage: GameStageView,
    AIDirectorInstance: AIDirector,
  ): Promise<void> {
    Stage.SetPhase(Store.Phase);
    Stage.AppendLog('Tiebreaker', '— 加赛开始 —');
    const PlayerId = Store.CurrentPlayer;
    this._ApplyTurnTheme(PlayerId);
    if (!this._SpeedMode) Stage.AnnounceTurn(PlayerId, '加赛');

    const TiebreakerPromise = Input.RequestTiebreaker();
    if (AIDirectorInstance.IsAI(PlayerId)) {
      await Promise.all([
        TiebreakerPromise,
        AIDirectorInstance.PlayForCurrentPlayer(Store, Input),
      ]);
    } else {
      await TiebreakerPromise;
    }

    if (this._QuitRequested) return;

    // 冻结看板（急速模式跳过）
    if (!this._SpeedMode) this._Board?.Freeze();
    const Round = await Store.RunTiebreakerAsync();
    AIDirectorInstance.ObserveTiebreaker(Round);
    Stage.ShowBusy('加赛掷骰中…');
    const Groups = Round.Rolls.map((R) => Array.from(R.Dice) as number[]);
    await this._PlayDice(Groups, PlayerPalette.Color(Store.CurrentPlayer));
    if (!this._SpeedMode) {
      this._Board?.Unfreeze();
      for (const R of Round.Rolls) {
        this._Board?.ShowDiceResult(R.Id, Array.from(R.Dice), PlayerPalette.Color(R.Id));
      }
    }
    this._LogTiebreaker(Stage, Round);
    Stage.SetPhase(Store.Phase);
  }

  // ===== 动画辅助 =====

  /**
   * 根据当前玩家主题色切换整个页面强调色（CSS 变量）
   * Canvas 看板使用 JS 常量不受影响，DOM 边框/描边/辉光随玩家色变化。
   */
  private _ApplyTurnTheme(PlayerId: PlayerId): void {
    const Color = PlayerPalette.Color(PlayerId);
    const Dim = PlayerPalette.ColorDim(PlayerId);
    const Glow = `${Color}66`; // 40% 透明度
    this._MountPoint.style.setProperty('--oasis', Color);
    this._MountPoint.style.setProperty('--oasis-dim', Dim);
    this._MountPoint.style.setProperty('--oasis-glow', Glow);
  }

  /**
   * 恢复默认页面主题色（菜单/终局用）
   */
  private _ResetPageTheme(): void {
    // 主题色由 data-theme 属性 + CSS 变量自动管理，无需 JS 干预
  }

  /**
   * 生成默认玩家配置（联机/快速开始用）
   */
  private _DefaultPlayers(PlayerCount: 2 | 3 | 4): { Name: string; Color: string }[] {
    const Defaults: { Name: string; Color: string }[] = [
      { Name: '玩家1', Color: COLORS.Faction0 },
      { Name: '玩家2', Color: COLORS.Faction1 },
      { Name: '玩家3', Color: COLORS.Faction2 },
      { Name: '玩家4', Color: COLORS.Faction3 },
    ];
    return Defaults.slice(0, PlayerCount);
  }

  /**
   * 播放骰子翻滚动画（在 fx 特效层），落到最终点数后 resolve
   */
  private async _PlayDice(Groups: number[][], Color: string): Promise<void> {
    if (Groups.length === 0) return;
    if (this._SpeedMode) return;
    await this._Dice?.Play(Groups, { Color });
  }

  /**
   * 触发崩坏特效：主视口震屏 + 红警叠加层闪烁
   */
  private _TriggerCollapseFx(): void {
    if (this._SpeedMode) return;
    this._MountPoint.classList.add('is-shaking');
    window.setTimeout(() => {
      this._MountPoint.classList.remove('is-shaking');
    }, 1000);
  }

  // ===== 日志辅助 =====

  /**
   * 记录发射结果日志
   */
  private _LogLaunch(Stage: GameStageView, Result: LaunchResult, PlayerId: PlayerId): void {
    const Label = PlayerPalette.LabelLong(PlayerId);
    const DiceStr = `${Result.Dice[0]}+${Result.Dice[1]}=${Result.Sum}`;
    if (Result.Status === 'Success') {
      Stage.AppendLog('Launch', `${Label} 发射成功 ${DiceStr} +${Result.PrivateDelta}`);
    } else {
      Stage.AppendLog('Launch', `${Label} 发射失败 ${DiceStr}（需 ≥7）`);
    }
  }

  /**
   * 记录一回合结果日志（按动画编排顺序）
   */
  private _LogTurn(Stage: GameStageView, Result: TurnResult, PlayerId: PlayerId): void {
    const Label = PlayerPalette.LabelLong(PlayerId);
    const ModeLabel = this._ModeLabel(Result.Mode);

    // 1. 掷骰
    if (Result.Dice) {
      const DiceStr = Result.Dice.Dice.join('+');
      Stage.AppendLog('Dice', `${Label} ${ModeLabel} 掷出 ${DiceStr}=${Result.Dice.Sum}`);
    } else {
      Stage.AppendLog('Info', `${Label} 选择不开发`);
    }

    // 2. 开发链
    if (Result.DevOutcome) {
      if (Result.IsOverload) {
        Stage.AppendLog('Overload', `${Label} 开发过度！私有清零，进入荒地`);
      } else if (Result.DevOutcome.Multiplier > 1) {
        Stage.AppendLog('Info', `${Label} 连击 ${Result.DevOutcome.Multiplier}x！`);
      }
    }

    // 3. 占领
    if (Result.OccupationDelta) {
      const Occ = Result.OccupationDelta;
      if (Occ.PrivateDelta >= 0) {
        Stage.AppendLog('Occupy', `${Label} 占领 +${Occ.PrivateDelta}（公共 ${Occ.PublicDelta}）`);
      } else {
        Stage.AppendLog('Occupy', `${Label} 倒扣 ${Occ.PrivateDelta}（公共 ${Occ.PublicDelta}）`);
      }
    }

    // 4. 抢夺
    if (Result.Robbery) {
      const R = Result.Robbery;
      const DefenderLabel = PlayerPalette.LabelLong(R.Defender);
      const WinnerLabel = R.Winner === 'Initiator' ? Label : DefenderLabel;
      Stage.AppendLog('Robbery', `抢夺！${Label} vs ${DefenderLabel} → ${WinnerLabel} 胜`);
      Stage.AppendLog('Robbery', `  发起者 ${R.InitiatorDelta >= 0 ? '+' : ''}${R.InitiatorDelta}，防守者 ${R.DefenderDelta >= 0 ? '+' : ''}${R.DefenderDelta}`);
    }

    // 5. 崩坏
    if (Result.Collapse) {
      const C = Result.Collapse;
      Stage.AppendLog('Collapse', `崩坏 x${C.CoefficientX}！总损失 ${C.TotalLoss}（守恒: ${C.IsConserved ? '是' : '否'}）`);
      for (const Loss of C.PlayerLosses) {
        const LL = PlayerPalette.LabelLong(Loss.Id);
        Stage.AppendLog('Collapse', `  ${LL} -${Loss.ActualLoss}（${Loss.BeforePrivate}→${Loss.AfterPrivate}）`);
      }
    }

    // 6. 枯竭冲刺
    if (Result.SprintBonus > 0) {
      Stage.AppendLog('Sprint', `枯竭冲刺生效！正向收益 +${Result.SprintBonus}`);
    }

    // 7. 公敌税
    if (Result.LeaderTax) {
      const T = Result.LeaderTax;
      Stage.AppendLog('Tax', `公敌税：${PlayerPalette.LabelLong(T.PlayerId)} 缴纳 ${T.Amount}`);
    }

    // 8. 复仇突袭
    if (Result.Revenge) {
      const R = Result.Revenge;
      const TargetLabel = PlayerPalette.LabelLong(R.TargetId);
      if (R.Roll.IsSuccess) {
        Stage.AppendLog('Revenge', `${Label} 对 ${TargetLabel} 复仇成功，夺取 ${R.SelfDelta}`);
      } else {
        Stage.AppendLog('Revenge', `${Label} 复仇失败，损失 ${-R.SelfDelta} 到公共池`);
      }
    }
  }

  /**
   * 记录加赛日志
   */
  private _LogTiebreaker(Stage: GameStageView, Round: TiebreakerRound): void {
    for (const Roll of Round.Rolls) {
      const Label = PlayerPalette.LabelLong(Roll.Id);
      Stage.AppendLog('Tiebreaker', `${Label} 加赛掷出 ${Roll.Dice[0]}+${Roll.Dice[1]}=${Roll.Sum}`);
    }
    if (Round.IsFinal) {
      const Winner = Round.WinnersThisRound[0];
      Stage.AppendLog('GameOver', `加赛结束！胜者：${PlayerPalette.LabelLong(Winner)}`);
    } else {
      Stage.AppendLog('Tiebreaker', `本轮仍平手，继续加赛...`);
    }
  }

  /**
   * 记录终局日志
   */
  private _LogGameOver(Stage: GameStageView, Result: GameResult): void {
    const Winners = Result.Winners.map((W) => PlayerPalette.LabelLong(W.Id));
    Stage.AppendLog('GameOver', `游戏结束！胜者：${Winners.join('、')}`);
  }

  /**
   * 模式标签
   */
  private _ModeLabel(Mode: DiceMode): string {
    switch (Mode) {
      case 'Steady' as DiceMode:
        return '[稳健]';
      case 'Aggressive' as DiceMode:
        return '[激进]';
      case 'None' as DiceMode:
        return '[不开发]';
      case 'Revenge' as DiceMode:
        return '[复仇]';
      default:
        return '[?]';
    }
  }

  // ===== 终局界面 =====

  private _GameOverScreen: GameOverScreen | null = null;
  private _GameOverResolver: ((Choice: 'restart' | 'menu') => void) | null = null;

  /**
   * 显示终局界面
   */
  private _ShowGameOver(Result: GameResult): void {
    if (this._GameOverScreen) {
      this._GameOverScreen.Unmount();
    }
    this._GameOverScreen = new GameOverScreen({
      OnRestart: () => this._ResolveGameOver('restart'),
      OnBackToMenu: () => this._ResolveGameOver('menu'),
    });
    this._GameOverScreen.Mount(this._UiLayer!);
    this._GameOverScreen.ShowResult(Result);
  }

  /**
   * 等待终局选择
   */
  private _WaitGameOverChoice(): Promise<'restart' | 'menu'> {
    return new Promise<'restart' | 'menu'>((Resolve) => {
      this._GameOverResolver = Resolve;
    });
  }

  private _ResolveGameOver(Choice: 'restart' | 'menu'): void {
    if (this._GameOverResolver) {
      const R = this._GameOverResolver;
      this._GameOverResolver = null;
      if (this._GameOverScreen) {
        this._GameOverScreen.Unmount();
        this._GameOverScreen = null;
      }
      R(Choice);
    }
  }

  /**
   * 销毁：停止渲染循环 + 清理
   */
  Dispose(): void {
    this._Canvas?.Dispose();
    this._Canvas = null;
    this._Layout.Dispose();
    this._AnimCoordinator?.Dispose();
    this._AnimCoordinator = null;
    this._Audio.Dispose();
    this._GameOverScreen?.Unmount();
    this._GameOverScreen = null;
    this._SettingsPanel?.Unmount();
    this._SettingsPanel = null;
  }

  /**
   * 加载保存的设置项并应用
   */
  private _LoadSavedSettings(): void {
    try {
      const AnimSpeed = localStorage.getItem('second-oasis-anim-speed') || 'normal';
      document.documentElement.setAttribute('data-anim-speed', AnimSpeed);
      if (AnimSpeed === 'off') this._Accessibility.SetReducedMotion(true);
      const FontSize = localStorage.getItem('second-oasis-font-size') || 'normal';
      document.documentElement.setAttribute('data-font-size', FontSize);
      const ShowFps = localStorage.getItem('second-oasis-show-fps') === 'true';
      document.documentElement.setAttribute('data-show-fps', String(ShowFps));
      const SpeedMode = localStorage.getItem('second-oasis-speed-mode') === 'true';
      if (SpeedMode) this.SetSpeedMode(true);
    } catch {
      // 静默失败
    }
  }

  /**
   * 打开设置面板
   */
  RequestQuit(): void {
    if (this._QuitRequested) return;
    this._QuitRequested = true;
    if (this._CurrentInput) {
      this._CurrentInput.CancelAll();
    }
  }

  private _OpenSettings(): void {
    if (this._SettingsPanel) {
      this._SettingsPanel.Unmount();
      this._SettingsPanel = null;
    }
    this._SettingsPanel = new SettingsPanel(
      {
        OnClose: () => this._CloseSettings(),
        OnSpeedModeChange: (V) => this.SetSpeedMode(V),
        IsSpeedMode: () => this._SpeedMode,
        OnRequestQuit: () => this.RequestQuit(),
      },
      this._Accessibility,
    );
    this._SettingsPanel.Mount(this._MountPoint);
  }

  /**
   * 关闭设置面板
   */
  private _CloseSettings(): void {
    this._SettingsPanel?.Unmount();
    this._SettingsPanel = null;
  }

  /** 设置急速模式 */
  SetSpeedMode(On: boolean): void {
    this._SpeedMode = On;
    this._SpeedIndicator.style.display = On ? '' : 'none';
    try { localStorage.setItem('second-oasis-speed-mode', String(On)); } catch { /* noop */ }
  }

  get IsSpeedMode(): boolean {
    return this._SpeedMode;
  }

  /**
   * 更新 FPS 显示
   */
  private _UpdateFpsDisplay(): void {
    this._FpsDisplay.textContent = `FPS: ${this._CurrentFps}`;
  }

  /**
   * FPS 计数（每帧调用）
   */
  private _CountFps(Ts: number): void {
    this._FpsFrameCount++;
    const Elapsed = Ts - this._LastFpsTs;
    if (Elapsed >= 1000) {
      this._CurrentFps = Math.round((this._FpsFrameCount * 1000) / Elapsed);
      this._FpsFrameCount = 0;
      this._LastFpsTs = Ts;
    }
  }
}