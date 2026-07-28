/**
 * 随机源测试
 * 重点验证 SeededRandom 的确定性（联机种子同步关键）
 */
import { describe, it, expect } from 'vitest';
import { SeededRandom } from './SeededRandom';
import { DefaultRandom } from './DefaultRandom';

describe('随机源', () => {
  describe('SeededRandom', () => {
    it('相同 Seed 两次构造、相同调用序列应产生完全相同输出', () => {
      // 联机同步的核心保证
      const A = new SeededRandom(42);
      const B = new SeededRandom(42);

      const SeqA: number[] = [];
      const SeqB: number[] = [];
      for (let I = 0; I < 100; I++) {
        SeqA.push(A.NextDie());
        SeqB.push(B.NextDie());
      }

      expect(SeqA).toEqual(SeqB);
    });

    it('不同 Seed 应产生不同序列', () => {
      const A = new SeededRandom(1);
      const B = new SeededRandom(2);

      const SeqA = Array.from({ length: 10 }, () => A.NextDie());
      const SeqB = Array.from({ length: 10 }, () => B.NextDie());

      expect(SeqA).not.toEqual(SeqB);
    });

    it('NextDie 应始终返回 1..6', () => {
      const R = new SeededRandom(12345);
      for (let I = 0; I < 1000; I++) {
        const V = R.NextDie();
        expect(V).toBeGreaterThanOrEqual(1);
        expect(V).toBeLessThanOrEqual(6);
      }
    });

    it('NextInt(0, 10) 应始终返回 0..10（含两端）', () => {
      const R = new SeededRandom(999);
      for (let I = 0; I < 1000; I++) {
        const V = R.NextInt(0, 10);
        expect(V).toBeGreaterThanOrEqual(0);
        expect(V).toBeLessThanOrEqual(10);
      }
    });

    it('NextInt(5, 5) 应恒返回 5（Min==Max 边界）', () => {
      const R = new SeededRandom(7);
      for (let I = 0; I < 10; I++) {
        expect(R.NextInt(5, 5)).toBe(5);
      }
    });

    it('NextInt 应覆盖闭区间两端（10000 次采样统计）', () => {
      // 验证分布包含边界值，避免 off-by-one
      const R = new SeededRandom(314);
      const Seen = new Set<number>();
      for (let I = 0; I < 10000; I++) {
        Seen.add(R.NextInt(1, 6));
      }
      // 1..6 都应出现
      for (let V = 1; V <= 6; V++) {
        expect(Seen.has(V)).toBe(true);
      }
    });
  });

  describe('DefaultRandom', () => {
    it('NextDie 应返回 1..6', () => {
      const R = new DefaultRandom();
      for (let I = 0; I < 100; I++) {
        const V = R.NextDie();
        expect(V).toBeGreaterThanOrEqual(1);
        expect(V).toBeLessThanOrEqual(6);
      }
    });

    it('NextInt 应返回闭区间内', () => {
      const R = new DefaultRandom();
      for (let I = 0; I < 100; I++) {
        const V = R.NextInt(0, 100);
        expect(V).toBeGreaterThanOrEqual(0);
        expect(V).toBeLessThanOrEqual(100);
      }
    });
  });
});
