/**
 * src/Store/PlayerPalette.test.ts
 * 操作类型：新建
 *
 * PlayerPalette 单元测试
 */
import { describe, it, expect } from 'vitest';
import { PlayerPalette } from './PlayerPalette';

describe('PlayerPalette', () => {
  it('Color 返回各玩家阵营色', () => {
    expect(PlayerPalette.Color(0)).toBe('#3B82F6');
    expect(PlayerPalette.Color(1)).toBe('#8B5CF6');
    expect(PlayerPalette.Color(2)).toBe('#F59E0B');
    expect(PlayerPalette.Color(3)).toBe('#EC4899');
  });

  it('Color 越界返回中性灰', () => {
    expect(PlayerPalette.Color(4)).toBe('#888888');
    expect(PlayerPalette.Color(-1)).toBe('#888888');
  });

  it('ColorDim 返回暗色', () => {
    expect(PlayerPalette.ColorDim(0)).toBe('#1E40AF');
    expect(PlayerPalette.ColorDim(3)).toBe('#9D174D');
  });

  it('LabelShort 返回 P1-P4', () => {
    expect(PlayerPalette.LabelShort(0)).toBe('P1');
    expect(PlayerPalette.LabelShort(1)).toBe('P2');
    expect(PlayerPalette.LabelShort(2)).toBe('P3');
    expect(PlayerPalette.LabelShort(3)).toBe('P4');
  });

  it('LabelLong 返回玩家1-4', () => {
    expect(PlayerPalette.LabelLong(0)).toBe('玩家1');
    expect(PlayerPalette.LabelLong(3)).toBe('玩家4');
  });

  it('Codename 返回阵营代号', () => {
    expect(PlayerPalette.Codename(0)).toBe('蔚蓝协定');
    expect(PlayerPalette.Codename(1)).toBe('紫晶议会');
    expect(PlayerPalette.Codename(2)).toBe('琥珀远征');
    expect(PlayerPalette.Codename(3)).toBe('绯红同盟');
  });

  it('ComboLabel 由 ConsecutiveDoubles 推导', () => {
    expect(PlayerPalette.ComboLabel(0)).toBe('');
    expect(PlayerPalette.ComboLabel(1)).toBe('2x');
    expect(PlayerPalette.ComboLabel(2)).toBe('3x');
    // 第3次连续对子触发开发过度，不返回倍率
    expect(PlayerPalette.ComboLabel(3)).toBe('');
  });

  it('IsInCombo 判断是否处于连击状态', () => {
    expect(PlayerPalette.IsInCombo(0)).toBe(false);
    expect(PlayerPalette.IsInCombo(1)).toBe(true);
    expect(PlayerPalette.IsInCombo(2)).toBe(true);
    // 第3次开发过度，不算连击
    expect(PlayerPalette.IsInCombo(3)).toBe(false);
  });
});
