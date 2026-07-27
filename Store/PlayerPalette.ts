/**
 * src/Store/PlayerPalette.ts
 * 操作类型：新建
 *
 * PlayerId → 阵营色/名称/连击标签映射
 * 关联：B 阶段架构方案 §3.5
 *
 * 设计要点：
 * 1. Core 层无玩家颜色概念，UI 层在此自建映射
 * 2. 阵营色与 Theme.FACTION_COLORS 一致
 * 3. 连击标签由 ConsecutiveDoubles 推导：1→'2x', 2→'3x'
 * 4. 纯静态工具类，无状态
 */
import type { PlayerId } from '@/Types/Player';
import { FACTION_COLORS, FACTION_COLORS_DIM } from '@/UI/Theme';
import type { AIDifficulty, AIPersonality } from '@/Types/AI';

/**
 * 玩家显示标签（短/长两种）
 * 短：用于 HUD 紧凑布局；长：用于日志/终局
 */
export const PLAYER_LABELS_SHORT = ['P1', 'P2', 'P3', 'P4'] as const;
export const PLAYER_LABELS_LONG = ['玩家1', '玩家2', '玩家3', '玩家4'] as const;

/**
 * 阵营代号（赛博风命名，增强作品集质感）
 * 仅作视觉点缀，不影响规则
 */
export const FACTION_CODENAMES = [
  '蔚蓝协定',
  '紫晶议会',
  '琥珀远征',
  '绯红同盟',
] as const;

/**
 * 连击标签类型
 * '' 表示无连击；'2x'/'3x' 表示开发链倍率
 */
export type ComboLabel = '' | '2x' | '3x';

/**
 * 玩家显示配置（进游戏前由主菜单设定）
 * AI 字段为可选，人类玩家不填即可保持原有行为
 */
export interface PlayerConfig {
  Name: string;
  Color: string;
  /** 是否为 AI 对手 */
  IsAI?: boolean;
  /** AI 难度 */
  Difficulty?: AIDifficulty;
  /** AI 性格（不填则随机生成） */
  Personality?: AIPersonality;
}

/** 当前对局的玩家配置（静态，每局重置） */
let _Config: PlayerConfig[] = [];

/**
 * 解析十六进制颜色为 RGB 三元组
 */
function ParseHex(Hex: string): [number, number, number] {
  const Clean = Hex.replace('#', '');
  const Full =
    Clean.length === 3
      ? Clean.split('').map((C) => C + C).join('')
      : Clean;
  const N = parseInt(Full, 16);
  return [(N >> 16) & 255, (N >> 8) & 255, N & 255];
}

/**
 * 把 RGB 三元组转回 #RRGGBB
 */
function ToHex(R: number, G: number, B: number): string {
  return (
    '#' +
    [R, G, B]
      .map((V) => Math.max(0, Math.min(255, Math.round(V))).toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * 与黑色混合得到暗色（用于阴影/渐变）
 */
function DimColor(Hex: string, Factor = 0.5): string {
  const [R, G, B] = ParseHex(Hex);
  return ToHex(R * (1 - Factor), G * (1 - Factor), B * (1 - Factor));
}

/**
 * 玩家 ID → 显示标签/颜色/代号映射
 *
 * 默认使用 4 阵营色与固定代号；开局前可通过 SetConfig 注入玩家自定义名字与主题色。
 * 该配置是静态单例，由 AppController 在每局开始时设定；返回菜单后会自动覆盖。
 */
export class PlayerPalette {
  /**
   * 设定本局玩家显示配置（名字 + 颜色）
   * 须在创建 GameStageView / 开始渲染前调用
   */
  static SetConfig(Configs: PlayerConfig[]): void {
    _Config = Configs.slice();
  }

  /**
   * 重置为默认配置（用于测试隔离或返回菜单）
   */
  static ResetConfig(): void {
    _Config = [];
  }

  /**
   * 获取玩家阵营色（主色）
   * 越界返回中性灰，防御性
   */
  static Color(Id: PlayerId): string {
    return _Config[Id]?.Color ?? FACTION_COLORS[Id] ?? '#888888';
  }

  /**
   * 获取玩家阵营暗色（用于阴影/渐变/辉光 dim）
   * 自定义颜色时按 50% 与黑色混合生成；默认色保持原 hardcoded dim 不变，避免单测漂移。
   */
  static ColorDim(Id: PlayerId): string {
    const Color = this.Color(Id);
    const Idx = FACTION_COLORS.indexOf(Color);
    if (Idx >= 0) return FACTION_COLORS_DIM[Idx] ?? '#444444';
    return DimColor(Color, 0.5);
  }

  /**
   * 获取玩家短标签（紧凑布局用）
   * 自定义名字时取首 2 字；默认 P1/P2/P3/P4
   */
  static LabelShort(Id: PlayerId): string {
    const Name = _Config[Id]?.Name;
    if (Name) return Name.slice(0, 2);
    return PLAYER_LABELS_SHORT[Id] ?? `P${Id + 1}`;
  }

  /**
   * 获取玩家长标签（日志/终局用）
   */
  static LabelLong(Id: PlayerId): string {
    return _Config[Id]?.Name ?? PLAYER_LABELS_LONG[Id] ?? `玩家${Id + 1}`;
  }

  /**
   * 获取阵营代号
   */
  static Codename(Id: PlayerId): string {
    return FACTION_CODENAMES[Id] ?? `派系${Id + 1}`;
  }

  /**
   * 由 ConsecutiveDoubles 推导连击标签
   * 1 → '2x'（第一次连续对子，倍率×2）
   * 2 → '3x'（第二次连续对子，倍率×3）
   * 0 或其他 → ''（无连击）
   *
   * 注意：第 3 次连续对子触发开发过度，由 IsOverload 处理，不在此返回倍率
   */
  static ComboLabel(ConsecutiveDoubles: number): ComboLabel {
    if (ConsecutiveDoubles === 1) return '2x';
    if (ConsecutiveDoubles === 2) return '3x';
    return '';
  }

  /**
   * 判断该玩家是否处于连击状态（用于 UI 高亮）
   */
  static IsInCombo(ConsecutiveDoubles: number): boolean {
    return ConsecutiveDoubles > 0 && ConsecutiveDoubles < 3;
  }
}
