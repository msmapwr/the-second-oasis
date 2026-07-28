/**
 * src/Audio/SoundMap.ts
 * 操作类型：新建
 *
 * 音效预设与事件映射
 *
 * 设计要点：
 * 1. 所有音效按情绪命名，不绑定业务事件，便于复用
 * 2. 复杂音效（碎裂、轰鸣、终局音乐）建议外部资源，标注用途与理由
 * 3. 事件到音效的转换由 AnimationCoordinator 根据游戏结果完成
 */

/** 所有程序合成音效预设 */
export type SoundPreset =
  | 'DiceRoll'
  | 'DiceSettle'
  | 'OccupyUp'
  | 'OccupyDown'
  | 'ChainX2'
  | 'ChainX3'
  | 'ChainBreak'
  | 'RobberyStart'
  | 'RobberyWin'
  | 'RobberyLose'
  | 'Collapse'
  | 'LaunchSuccess'
  | 'LaunchFail'
  | 'GameOver';

/** 外部资源建议：哪些音效可考虑替换为采样 */
export const EXTERNAL_SOUND_ADVICE: {
  Preset: SoundPreset;
  Reason: string;
  Recommended: string;
  Optional: boolean;
}[] = [
  {
    Preset: 'ChainBreak',
    Reason: '开发过度清零是情绪低谷，程序合成只能近似玻璃碎裂感。',
    Recommended: '0.2–0.4s 短碎玻璃/电路崩解采样，wav/ogg，体积小。',
    Optional: true,
  },
  {
    Preset: 'Collapse',
    Reason: '崩坏是全局大事件，程序合成足够危险但缺乏电影级压迫感。',
    Recommended: '1s 左右低频撞击/轰鸣采样，作为 layer 与合成告警音叠加。',
    Optional: true,
  },
  {
    Preset: 'GameOver',
    Reason: '终局是作品门面，程序合成 Pad 和弦偏素。',
    Recommended: '5–8s 太空感尾音/简短胜利主题，可循环或不循环。',
    Optional: true,
  },
];
