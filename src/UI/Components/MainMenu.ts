/**
 * src/UI/Components/MainMenu.ts
 * 操作类型：重写
 */
import { El, On, Clear } from '../Dom';
import { Component } from './Component';
import { MenuViewportRenderer } from '@/Render/MenuViewportRenderer';
import { PlayerPalette, type PlayerConfig, PLAYER_LABELS_SHORT, PLAYER_LABELS_LONG } from '@/Store/PlayerPalette';
import { FACTION_COLORS, COLORS } from '@/UI/Theme';
import { AIDifficulty, type AIPersonality, type PersonalityArchetype } from '@/Types/AI';
import { GetDifficultyLabel, GetAllArchetypes, GetArchetypeDisplayName, CreatePersonality, GetArchetypeLabel } from '@/AI';

export interface StartConfig {
  readonly PlayerCount: 2 | 3 | 4;
  readonly Seed: number;
  readonly Players: PlayerConfig[];
  readonly UseVariant: boolean;
}

export type MainMenuAction =
  | { Kind: 'Local'; Config: StartConfig }
  | { Kind: 'Multiplayer' }
  | { Kind: 'Replays' }
  | { Kind: 'Profile' };

const COLOR_PRESETS = [
  { Label: '亮', Color: COLORS.NmText },
  { Label: '暗', Color: '#1F2937' },
  { Label: 'P1', Color: FACTION_COLORS[0] },
  { Label: 'P2', Color: FACTION_COLORS[1] },
  { Label: 'P3', Color: FACTION_COLORS[2] },
  { Label: 'P4', Color: FACTION_COLORS[3] },
] as const;

export class MainMenu extends Component {
  private readonly _OnAction: (Action: MainMenuAction) => void;
  private _SelectedCount: 2 | 3 | 4 = 2;
  private _ViewportRenderer: MenuViewportRenderer | null = null;
  private _CleanupFns: (() => void)[] = [];
  private _PlayerConfigs: PlayerConfig[] = [];
  private _ConfigDialog: HTMLElement | null = null;
  private _UseVariant: boolean = true;
  private readonly _OnRequestSettings: () => void;

  constructor(OnAction: (Action: MainMenuAction) => void, OnRequestSettings?: () => void) {
    super();
    this._OnAction = OnAction;
    this._OnRequestSettings = OnRequestSettings ?? (() => {});
    this._ResetPlayerConfigs(2);
  }

  Mount(Parent: HTMLElement): void {
    const Root = El({
      Tag: 'div',
      Class: 'cockpit main-menu',
      Parent,
      Style: 'position:absolute;inset:0;z-index:100;',
    });
    this.SetRoot(Root);

    const Frame = El({ Tag: 'div', Class: 'cockpit-frame', Parent: Root });
    El({ Tag: 'div', Class: 'cf-corner tl', Parent: Frame });
    El({ Tag: 'div', Class: 'cf-corner tr', Parent: Frame });
    El({ Tag: 'div', Class: 'cf-corner bl', Parent: Frame });
    El({ Tag: 'div', Class: 'cf-corner br', Parent: Frame });

    this._BuildTopbar(Root);
    this._BuildMain(Root);
    this._BuildConsole(Root);
  }

  private _BuildTopbar(Root: HTMLElement): void {
    const Top = El({
      Tag: 'div',
      Class: 'cockpit-topbar',
      Parent: Root,
    });

    El({
      Tag: 'div',
      Class: 'cockpit-title font-display',
      Parent: Top,
      Html:
        '第二绿洲<span class="sub">THE SECOND OASIS · BRIDGE CONTROL</span>',
    });

    El({
      Tag: 'div',
      Class: 'telemetry',
      Parent: Top,
      Html:
        '<span class="led on"></span>SYS ONLINE' +
        '<span class="sep">|</span>O2 <b>98%</b>' +
        '<span class="sep">|</span>PWR <b>100%</b>' +
        '<span class="sep">|</span>NAV <b>LOCK</b>',
    });
  }

  private _BuildMain(Root: HTMLElement): void {
    const Main = El({ Tag: 'div', Class: 'cockpit-main', Parent: Root });

    const Left = El({ Tag: 'div', Class: 'cockpit-panel', Parent: Main });
    El({ Tag: 'div', Class: 'panel-label', Parent: Left, Text: 'MISSION · 任务简介' });
    El({
      Tag: 'div',
      Parent: Left,
      Style: 'font-size:12px;color:var(--text-dim);line-height:1.8;',
      Html:
        '月球公共领土 100→0 即终局。<br>' +
        '稳健：单骰 1-6，永不崩坏。<br>' +
        '激进：双骰 2-12，≤6 倒扣。<br>' +
        '对子连击：×2 → ×3 → 清零。<br>' +
        '公共不足触发抢夺与崩坏。<br>' +
        '私有领土最高者获胜。',
    });

    const Viewport = El({ Tag: 'div', Class: 'cockpit-viewport', Parent: Main });
    El({ Tag: 'div', Class: 'vp-ring', Parent: Viewport });
    El({
      Tag: 'div',
      Class: 'vp-tag',
      Parent: Viewport,
      Text: 'LUNAR COLONY · 月球殖民地',
    });
    this._ViewportRenderer = new MenuViewportRenderer();
    this._ViewportRenderer.Mount(Viewport);
    this._ViewportRenderer.Start();

    const Right = El({ Tag: 'div', Class: 'cockpit-panel', Parent: Main });
    El({ Tag: 'div', Class: 'panel-label', Parent: Right, Text: 'BRIEFING · 作战指令' });
    El({
      Tag: 'div',
      Parent: Right,
      Style: 'font-size:12px;color:var(--text-dim);line-height:1.8;',
      Html:
        '这是你的登月第一天。<br>' +
        '四个国家（或 AI 代理）<br>' +
        '将争夺月球殖民地。<br>' +
        '点击下方「点火」按钮<br>' +
        '配置乘员后开始作战。',
    });
  }

  private _BuildConsole(Root: HTMLElement): void {
    const Console = El({ Tag: 'div', Class: 'cockpit-console', Parent: Root });

    const Ignite = El({
      Tag: 'button',
      Class: 'ignition font-display',
      Parent: Console,
      Text: '点火 IGNITE',
    }) as HTMLButtonElement;
    this._CleanupFns.push(On(Ignite, 'click', () => this._ShowConfigDialog()));

    const Link = El({
      Tag: 'button',
      Class: 'link-btn font-display',
      Parent: Console,
      Text: '联机 LINK',
      Title: '创建或加入联机房间',
    }) as HTMLButtonElement;
    this._CleanupFns.push(On(Link, 'click', () => this._StartMultiplayer()));

    const SettingsBtn = El({
      Tag: 'button',
      Class: 'link-btn font-display',
      Parent: Console,
      Text: '设置 ⚙',
      Title: '游戏设置',
    }) as HTMLButtonElement;
    this._CleanupFns.push(On(SettingsBtn, 'click', () => this._OnRequestSettings()));

    const ReplaysBtn = El({
      Tag: 'button',
      Class: 'link-btn font-display',
      Parent: Console,
      Text: '回放 REPLAYS',
      Title: '观看已保存的对局回放',
    }) as HTMLButtonElement;
    this._CleanupFns.push(On(ReplaysBtn, 'click', () => this._StartReplays()));

    const ProfileBtn = El({
      Tag: 'button',
      Class: 'link-btn font-display',
      Parent: Console,
      Text: '档案 PROFILE',
      Title: '查看玩家统计与游戏记录',
    }) as HTMLButtonElement;
    this._CleanupFns.push(On(ProfileBtn, 'click', () => this._StartProfile()));

    El({
      Tag: 'div',
      Class: 'telemetry',
      Parent: Console,
      Html: '<span class="led on"></span>STANDBY · 准备发射',
    });
  }

  private _ShowConfigDialog(): void {
    if (this._ConfigDialog) return;
    const Root = this.Root;
    const Backdrop = El({
      Tag: 'div',
      Class: 'config-dialog-backdrop',
      Parent: Root,
    });
    const Card = El({
      Tag: 'div',
      Class: 'config-dialog-card',
      Parent: Backdrop,
    });

    El({
      Tag: 'div',
      Class: 'font-display',
      Parent: Card,
      Style: 'font-size:22px;font-weight:700;color:var(--oasis);letter-spacing:2px;margin-bottom:6px;text-align:center;',
      Text: '乘员配置 CREW CONFIG',
    });
    El({
      Tag: 'div',
      Parent: Card,
      Style: 'font-size:11px;color:var(--text-dim);text-align:center;margin-bottom:16px;letter-spacing:1px;',
      Text: '选择乘员数量与 AI 代理设置',
    });

    const Seg = El({ Tag: 'div', Class: 'seg', Parent: Card, Style: 'margin-bottom:16px;' });
    let CountBtns: HTMLButtonElement[] = [];
    for (const N of [2, 3, 4] as const) {
      const Btn = El({
        Tag: 'button',
        Class: 'seg-btn' + (N === this._SelectedCount ? ' sel' : ''),
        Parent: Seg,
        Text: `${N} 人`,
      }) as HTMLButtonElement;
      CountBtns.push(Btn);
      this._CleanupFns.push(On(Btn, 'click', () => {
        this._SelectedCount = N;
        this._ResetPlayerConfigs(N);
        CountBtns.forEach((B, I) => B.classList.toggle('sel', (I + 2) === N));
        this._RebuildDialogPlayerRows(PlayerRowsContainer);
      }));
    }

    const PlayerRowsContainer = El({
      Tag: 'div',
      Parent: Card,
      Style: 'display:flex;flex-direction:column;gap:10px;max-height:50vh;overflow-y:auto;padding-right:4px;',
    });
    this._BuildDialogPlayerRows(PlayerRowsContainer);

    const SeedRow = El({
      Tag: 'div',
      Parent: Card,
      Style: 'display:flex;gap:8px;align-items:center;margin-top:14px;',
    });
    El({
      Tag: 'span',
      Parent: SeedRow,
      Style: 'font-size:12px;color:var(--text-dim);flex-shrink:0;',
      Text: '导航坐标（种子）',
    });
    const SeedInput = El({
      Tag: 'input',
      Class: 'cockpit-input',
      Parent: SeedRow,
      Style: 'flex:1;font-size:13px;padding:10px;',
    }) as HTMLInputElement;
    SeedInput.type = 'number';
    SeedInput.value = String(this._RandomSeed());

    const RandomBtn = El({
      Tag: 'button',
      Class: 'cockpit-icon-btn',
      Parent: SeedRow,
      Text: '🎲',
    }) as HTMLButtonElement;
    this._CleanupFns.push(On(RandomBtn, 'click', () => {
      SeedInput.value = String(this._RandomSeed());
    }));

    const ModeRow = El({
      Tag: 'div',
      Parent: Card,
      Style: 'display:flex;gap:8px;align-items:center;margin-top:10px;',
    });
    El({
      Tag: 'span',
      Parent: ModeRow,
      Style: 'font-size:12px;color:var(--text-dim);flex-shrink:0;',
      Text: '游戏模式',
    });
    const ModeSeg = El({
      Tag: 'div',
      Parent: ModeRow,
      Class: 'seg-group',
    });
    const ModernBtn = El({
      Tag: 'button',
      Class: 'seg-btn' + (this._UseVariant ? ' sel' : ''),
      Parent: ModeSeg,
      Text: '⚡ 现代模式',
    }) as HTMLButtonElement;
    const ClassicBtn = El({
      Tag: 'button',
      Class: 'seg-btn' + (this._UseVariant ? '' : ' sel'),
      Parent: ModeSeg,
      Text: '📜 传统模式',
    }) as HTMLButtonElement;

    const UpdateModeSelection = () => {
      if (this._UseVariant) {
        ModernBtn.classList.add('sel');
        ClassicBtn.classList.remove('sel');
      } else {
        ClassicBtn.classList.add('sel');
        ModernBtn.classList.remove('sel');
      }
    };
    this._CleanupFns.push(On(ModernBtn, 'click', () => {
      this._UseVariant = true;
      UpdateModeSelection();
    }));
    this._CleanupFns.push(On(ClassicBtn, 'click', () => {
      this._UseVariant = false;
      UpdateModeSelection();
    }));

    const Actions = El({
      Tag: 'div',
      Parent: Card,
      Style: 'display:flex;gap:14px;justify-content:center;margin-top:18px;',
    });

    const ConfirmBtn = El({
      Tag: 'button',
      Class: 'ignition',
      Parent: Actions,
      Style: 'padding:16px 40px;font-size:14px;letter-spacing:2px;',
      Text: '确认 CONFIRM',
    }) as HTMLButtonElement;
    this._CleanupFns.push(On(ConfirmBtn, 'click', () => {
      const SeedStr = SeedInput.value;
      let Seed = parseInt(SeedStr, 10);
      if (isNaN(Seed) || Seed < 1) Seed = this._RandomSeed();
      this._DismissConfigDialog();
      this._OnAction({
        Kind: 'Local',
        Config: {
          PlayerCount: this._SelectedCount,
          Seed,
          Players: this._PlayerConfigs.slice(0, this._SelectedCount),
          UseVariant: this._UseVariant,
        },
      });
    }));

    const CancelBtn = El({
      Tag: 'button',
      Class: 'link-btn',
      Parent: Actions,
      Style: 'padding:14px 32px;font-size:13px;letter-spacing:2px;',
      Text: '取消 CANCEL',
    }) as HTMLButtonElement;
    this._CleanupFns.push(On(CancelBtn, 'click', () => {
      this._DismissConfigDialog();
    }));

    this._CleanupFns.push(On(Backdrop, 'click', (E: Event) => {
      if (E.target === Backdrop) this._DismissConfigDialog();
    }));

    this._ConfigDialog = Backdrop;
  }

  private _DismissConfigDialog(): void {
    if (this._ConfigDialog) {
      this._ConfigDialog.remove();
      this._ConfigDialog = null;
    }
  }

  private _BuildDialogPlayerRows(Container: HTMLElement): void {
    Clear(Container);
    for (let I = 0; I < this._SelectedCount; I++) {
      const Row = El({
        Tag: 'div',
        Parent: Container,
        Class: 'player-config-row',
      });

      const Header = El({ Tag: 'div', Parent: Row, Class: 'player-config-header' });
      const Dot = El({
        Tag: 'span',
        Parent: Header,
        Class: 'player-config-dot',
        Style: `background:${this._PlayerConfigs[I].Color};`,
      });
      El({
        Tag: 'span',
        Parent: Header,
        Text: `${PLAYER_LABELS_SHORT[I]} · ${PlayerPalette.Codename(I)}`,
      });

      const NameInput = El({
        Tag: 'input',
        Class: 'cockpit-input',
        Parent: Row,
        Style: 'padding:8px 10px;font-size:12px;',
      }) as HTMLInputElement;
      NameInput.type = 'text';
      NameInput.value = this._PlayerConfigs[I].Name;
      NameInput.placeholder = '输入玩家名字';
      this._CleanupFns.push(
        On(NameInput, 'input', () => {
          this._PlayerConfigs[I].Name = NameInput.value || PLAYER_LABELS_LONG[I];
        }),
      );

      const CodenameInput = El({
        Tag: 'input',
        Class: 'cockpit-input',
        Parent: Row,
        Style: 'padding:8px 10px;font-size:12px;width:120px;',
      }) as HTMLInputElement;
      CodenameInput.type = 'text';
      CodenameInput.value = this._PlayerConfigs[I].Codename ?? PlayerPalette.Codename(I);
      CodenameInput.placeholder = '阵营名';
      this._CleanupFns.push(
        On(CodenameInput, 'input', () => {
          this._PlayerConfigs[I].Codename = CodenameInput.value;
        }),
      );

      const Chips = El({
        Tag: 'div',
        Parent: Row,
        Style: 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;',
      });
      for (const Preset of COLOR_PRESETS) {
        const Chip = El({
          Tag: 'button',
          Parent: Chips,
          Class: 'color-chip',
          Style: `background:${Preset.Color};`,
          Title: Preset.Label,
        }) as HTMLButtonElement;
        this._CleanupFns.push(
          On(Chip, 'click', () => this._SetPlayerColor(I, Preset.Color, Dot, ColorInput)),
        );
      }
      const ColorInput = El({
        Tag: 'input',
        Parent: Chips,
        Class: 'color-input',
      }) as HTMLInputElement;
      ColorInput.type = 'color';
      ColorInput.value = this._ToHexColor(this._PlayerConfigs[I].Color);
      this._CleanupFns.push(
        On(ColorInput, 'input', () => {
          this._SetPlayerColor(I, ColorInput.value, Dot, ColorInput);
        }),
      );

      const AIControls = El({
        Tag: 'div',
        Parent: Row,
        Style: 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:4px;',
      });

      const AILabel = El({
        Tag: 'label',
        Parent: AIControls,
        Style: 'display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text-dim);cursor:pointer;',
        Text: 'AI 控制',
      }) as HTMLLabelElement;
      const AIToggle = El({
        Tag: 'input',
        Parent: AILabel,
      }) as HTMLInputElement;
      AIToggle.type = 'checkbox';
      AIToggle.checked = this._PlayerConfigs[I].IsAI ?? false;

      const DifficultySelect = El({
        Tag: 'select',
        Parent: AIControls,
        Class: 'cockpit-select',
        Style: `font-size:11px;padding:4px 6px;border-radius:4px;${AIToggle.checked ? '' : 'display:none;'}`,
      }) as HTMLSelectElement;
      for (let D = AIDifficulty.Rookie; D <= AIDifficulty.Master; D++) {
        const Opt = document.createElement('option');
        Opt.value = String(D);
        Opt.textContent = GetDifficultyLabel(D);
        DifficultySelect.appendChild(Opt);
      }
      DifficultySelect.value = String(this._PlayerConfigs[I].Difficulty ?? AIDifficulty.Novice);

      const ArchetypeSelect = El({
        Tag: 'select',
        Parent: AIControls,
        Class: 'cockpit-select',
        Style: `font-size:11px;padding:4px 6px;border-radius:4px;${AIToggle.checked ? '' : 'display:none;'}`,
      }) as HTMLSelectElement;
      for (const Arc of GetAllArchetypes()) {
        const Opt = document.createElement('option');
        Opt.value = Arc;
        Opt.textContent = GetArchetypeDisplayName(Arc);
        ArchetypeSelect.appendChild(Opt);
      }
      ArchetypeSelect.value = this._GuessArchetype(this._PlayerConfigs[I].Personality);

      this._CleanupFns.push(
        On(AIToggle, 'change', () => {
          this._PlayerConfigs[I].IsAI = AIToggle.checked;
          DifficultySelect.style.display = AIToggle.checked ? '' : 'none';
          ArchetypeSelect.style.display = AIToggle.checked ? '' : 'none';
          if (AIToggle.checked) {
            this._PlayerConfigs[I].Name = `AI·${PlayerPalette.Codename(I)}`;
          } else {
            this._PlayerConfigs[I].Name = PLAYER_LABELS_LONG[I];
          }
          NameInput.value = this._PlayerConfigs[I].Name;
        }),
      );
      this._CleanupFns.push(
        On(DifficultySelect, 'change', () => {
          this._PlayerConfigs[I].Difficulty = parseInt(DifficultySelect.value, 10) as AIDifficulty;
        }),
      );
      this._CleanupFns.push(
        On(ArchetypeSelect, 'change', () => {
          const Arc = ArchetypeSelect.value as PersonalityArchetype;
          this._PlayerConfigs[I].Personality = CreatePersonality(
            this._PlayerConfigs[I].Difficulty ?? AIDifficulty.Novice,
            Arc,
          );
        }),
      );
    }
  }

  private _RebuildDialogPlayerRows(Container: HTMLElement): void {
    this._BuildDialogPlayerRows(Container);
  }

  private _ResetPlayerConfigs(N: 2 | 3 | 4): void {
    const Current = this._PlayerConfigs.slice();
    this._PlayerConfigs = [];
    for (let I = 0; I < N; I++) {
      const Existing = Current[I];
      this._PlayerConfigs.push({
        Name: Existing?.Name ?? PLAYER_LABELS_LONG[I],
        Color: Existing?.Color ?? FACTION_COLORS[I],
        IsAI: Existing?.IsAI ?? false,
        Difficulty: Existing?.Difficulty ?? AIDifficulty.Novice,
        Personality: Existing?.Personality,
      });
    }
  }

  private _SetPlayerColor(
    Id: number,
    Color: string,
    Dot: HTMLElement,
    ColorInput: HTMLInputElement,
  ): void {
    this._PlayerConfigs[Id].Color = Color;
    Dot.style.background = Color;
    ColorInput.value = this._ToHexColor(Color);
  }

  private _GuessArchetype(Personality: AIPersonality | undefined): PersonalityArchetype {
    if (!Personality) return 'Random';
    return GetArchetypeLabel(Personality);
  }

  private _ToHexColor(Color: string): string {
    if (Color.startsWith('#')) return Color;
    return Color;
  }

  private _RandomSeed(): number {
    return Math.floor(Math.random() * 1_000_000) + 1;
  }

  private _StartMultiplayer(): void {
    this._OnAction({ Kind: 'Multiplayer' });
  }

  private _StartReplays(): void {
    this._OnAction({ Kind: 'Replays' });
  }

  private _StartProfile(): void {
    this._OnAction({ Kind: 'Profile' });
  }

  protected _OnUnmount(): void {
    this._CleanupFns.forEach((Fn) => Fn());
    this._CleanupFns = [];
    this._ViewportRenderer?.Dispose();
    this._ViewportRenderer = null;
  }
}
