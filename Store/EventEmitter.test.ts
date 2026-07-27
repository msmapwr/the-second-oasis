/**
 * src/Store/EventEmitter.test.ts
 * 操作类型：新建
 *
 * EventEmitter 单元测试
 */
import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from './EventEmitter';

type TestEvents = {
  Foo: string;
  Bar: number;
  Baz: void;
};

describe('EventEmitter', () => {
  it('On + Emit 基本订阅', () => {
    const Ee = new EventEmitter<TestEvents>();
    const Fn = vi.fn();
    Ee.On('Foo', Fn);
    Ee.Emit('Foo', 'hello');
    expect(Fn).toHaveBeenCalledWith('hello');
  });

  it('On 返回取消函数', () => {
    const Ee = new EventEmitter<TestEvents>();
    const Fn = vi.fn();
    const Unsub = Ee.On('Foo', Fn);
    Unsub();
    Ee.Emit('Foo', 'hello');
    expect(Fn).not.toHaveBeenCalled();
  });

  it('多个监听器按注册顺序触发', () => {
    const Ee = new EventEmitter<TestEvents>();
    const Order: string[] = [];
    Ee.On('Foo', () => Order.push('A'));
    Ee.On('Foo', () => Order.push('B'));
    Ee.On('Foo', () => Order.push('C'));
    Ee.Emit('Foo', 'x');
    expect(Order).toEqual(['A', 'B', 'C']);
  });

  it('Once 只触发一次后自动移除', () => {
    const Ee = new EventEmitter<TestEvents>();
    const Fn = vi.fn();
    Ee.Once('Foo', Fn);
    Ee.Emit('Foo', 'first');
    Ee.Emit('Foo', 'second');
    expect(Fn).toHaveBeenCalledTimes(1);
    expect(Fn).toHaveBeenCalledWith('first');
  });

  it('不同事件互不干扰', () => {
    const Ee = new EventEmitter<TestEvents>();
    const FooFn = vi.fn();
    const BarFn = vi.fn();
    Ee.On('Foo', FooFn);
    Ee.On('Bar', BarFn);
    Ee.Emit('Foo', 'x');
    expect(FooFn).toHaveBeenCalledTimes(1);
    expect(BarFn).not.toHaveBeenCalled();
  });

  it('Emit 无订阅者时不报错', () => {
    const Ee = new EventEmitter<TestEvents>();
    expect(() => Ee.Emit('Foo', 'x')).not.toThrow();
  });

  it('void 载荷事件', () => {
    const Ee = new EventEmitter<TestEvents>();
    const Fn = vi.fn();
    Ee.On('Baz', Fn);
    Ee.Emit('Baz', undefined);
    expect(Fn).toHaveBeenCalledWith(undefined);
  });

  it('回调中 On 新监听器不会在当前 Emit 中触发', () => {
    const Ee = new EventEmitter<TestEvents>();
    const Order: string[] = [];
    Ee.On('Foo', () => {
      Order.push('A');
      Ee.On('Foo', () => Order.push('NEW'));
    });
    Ee.Emit('Foo', 'x');
    expect(Order).toEqual(['A']); // NEW 不会在当前 Emit 触发
    Ee.Emit('Foo', 'y');
    expect(Order).toEqual(['A', 'A', 'NEW']); // 第二次 Emit 才触发 NEW
  });

  it('回调中 Off 当前事件不影响其他监听器', () => {
    const Ee = new EventEmitter<TestEvents>();
    const Order: string[] = [];
    const UnsubB = Ee.On('Foo', () => Order.push('A'));
    Ee.On('Foo', () => {
      Order.push('B');
      UnsubB(); // 移除 A
    });
    Ee.On('Foo', () => Order.push('C'));
    Ee.Emit('Foo', 'x');
    // A 已在拷贝中，仍会触发；B 移除 A；C 正常触发
    expect(Order).toContain('B');
    expect(Order).toContain('C');
  });

  it('单个监听器抛错不中断其他', () => {
    const Ee = new EventEmitter<TestEvents>();
    const Fn2 = vi.fn();
    Ee.On('Foo', () => {
      throw new Error('boom');
    });
    Ee.On('Foo', Fn2);
    Ee.Emit('Foo', 'x');
    expect(Fn2).toHaveBeenCalled();
  });

  it('Off 移除某事件所有监听器', () => {
    const Ee = new EventEmitter<TestEvents>();
    const Fn = vi.fn();
    Ee.On('Foo', Fn);
    Ee.Off('Foo');
    Ee.Emit('Foo', 'x');
    expect(Fn).not.toHaveBeenCalled();
  });

  it('Off() 无参移除所有事件监听器', () => {
    const Ee = new EventEmitter<TestEvents>();
    const FooFn = vi.fn();
    const BarFn = vi.fn();
    Ee.On('Foo', FooFn);
    Ee.On('Bar', BarFn);
    Ee.Off();
    Ee.Emit('Foo', 'x');
    Ee.Emit('Bar', 1);
    expect(FooFn).not.toHaveBeenCalled();
    expect(BarFn).not.toHaveBeenCalled();
  });
});
