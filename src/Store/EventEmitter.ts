/**
 * src/Store/EventEmitter.ts
 * 操作类型：新建
 *
 * 通用事件发射器
 * 关联：B 阶段架构方案 §3.2
 *
 * 设计要点：
 * 1. 类型安全：泛型 E 约束事件名与载荷的映射
 * 2. On 返回取消订阅函数，避免手动管理 Set
 * 3. Emit 时拷贝监听器集合，防止回调中增删导致的迭代错乱
 * 4. 零依赖，Core 层也可复用（虽然 Core 当前未用）
 */

/**
 * 事件映射类型约束：事件名 → 载荷类型
 * 用法：class Foo extends EventEmitter<{ Bar: string; Baz: number }> {}
 *
 * 注意：必须是 type alias 而非 interface，否则不满足 Record 约束
 * （interface 可被声明合并扩展，TypeScript 不保证无额外属性）
 */
export type EventMap = Record<string, unknown>;

/**
 * 监听器函数类型
 */
export type Listener<T> = (Payload: T) => void;

export class EventEmitter<E extends EventMap> {
  /** 事件名 → 监听器集合 */
  private readonly _Listeners = new Map<keyof E, Set<Listener<unknown>>>();

  /**
   * 订阅事件
   * @returns 取消订阅函数（调用即移除该监听器）
   */
  On<K extends keyof E>(Type: K, Fn: Listener<E[K]>): () => void {
    let Subs = this._Listeners.get(Type);
    if (!Subs) {
      Subs = new Set();
      this._Listeners.set(Type, Subs);
    }
    // 捕获非 undefined 引用，闭包安全
    const SubsRef = Subs;
    SubsRef.add(Fn as Listener<unknown>);
    return () => {
      SubsRef.delete(Fn as Listener<unknown>);
    };
  }

  /**
   * 订阅事件（仅触发一次后自动移除）
   */
  Once<K extends keyof E>(Type: K, Fn: Listener<E[K]>): () => void {
    const Unsub = this.On(Type, (Payload) => {
      Unsub();
      Fn(Payload);
    });
    return Unsub;
  }

  /**
   * 发射事件
   * 拷贝监听器集合后遍历，避免回调中增删订阅导致迭代错乱
   */
  Emit<K extends keyof E>(Type: K, Payload: E[K]): void {
    const Subs = this._Listeners.get(Type);
    if (!Subs || Subs.size === 0) return;
    // 拷贝一份再遍历，防止回调内 On/Off 导致当前迭代异常
    const Snapshot = Array.from(Subs);
    for (const Fn of Snapshot) {
      try {
        (Fn as Listener<E[K]>)(Payload);
      } catch (Err) {
        // 单个监听器抛错不应中断其他监听器
        console.error('[EventEmitter] 监听器执行异常:', Err);
      }
    }
  }

  /**
   * 移除某事件的所有监听器（或全部事件）
   */
  Off<K extends keyof E>(Type?: K): void {
    if (Type === undefined) {
      this._Listeners.clear();
    } else {
      this._Listeners.delete(Type);
    }
  }
}
