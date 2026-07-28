/**
 * src/UI/Anim/Tween.ts
 * 操作类型：新建
 *
 * 数值 / 通用过渡动画工具（零运行时依赖，requestAnimationFrame 驱动）
 * 关联：B 阶段「全操作丝滑过渡」需求
 *
 * 设计要点：
 * 1. TweenNumber 把元素文本内的整数从当前显示值平滑过渡到目标值（缓出）
 * 2. 多次调用会取消上一段、从当前显示值续接，避免中途被打断时数值跳变
 * 3. 不依赖任何第三方动画库，符合项目「零运行时依赖」约束
 */
const EASE_OUT_CUBIC = (T: number): number => 1 - Math.pow(1 - T, 3);

/**
 * 单元素数值过渡状态
 */
interface NumAnim {
  /** requestAnimationFrame 句柄，用于取消 */
  Raf: number;
  /** 起始值 */
  From: number;
  /** 目标值 */
  To: number;
  /** 起始时间戳 */
  Start: number;
  /** 时长 ms */
  Dur: number;
}

/** 活跃过渡表（按元素弱引用，避免泄漏） */
const _Anims = new WeakMap<HTMLElement, NumAnim>();

/**
 * 读取元素当前显示的整数（解析失败回退 0）
 */
function _ReadNum(El: HTMLElement): number {
  const N = parseInt(El.textContent ?? '0', 10);
  return Number.isNaN(N) ? 0 : N;
}

/**
 * 把元素文本内的整数从当前值平滑过渡到 To（ease-out-cubic）。
 *
 * 调用时机：每次快照刷新（领土/公共变化）时调用，元素自动从旧显示值
 * 缓动到新值；若上一段动画未完成会被取消并从当前显示值续接。
 *
 * @param El 目标元素（其 textContent 为整数文本）
 * @param To 目标整数值
 * @param Dur 过渡时长（ms），默认 550
 */
export function TweenNumber(El: HTMLElement, To: number, Dur = 550): void {
  const From = _ReadNum(El);
  const Start = performance.now();
  // 取消上一段同元素过渡，避免叠加
  const Prev = _Anims.get(El);
  if (Prev !== undefined) {
    cancelAnimationFrame(Prev.Raf);
  }
  const Tick = (Now: number): void => {
    const T = Math.min(1, (Now - Start) / Dur);
    const V = From + (To - From) * EASE_OUT_CUBIC(T);
    El.textContent = String(Math.round(V));
    if (T < 1) {
      const A = _Anims.get(El);
      if (A !== undefined) {
        A.Raf = requestAnimationFrame(Tick);
      }
    } else {
      El.textContent = String(To);
      _Anims.delete(El);
    }
  };
  const Id = requestAnimationFrame(Tick);
  _Anims.set(El, { Raf: Id, From, To, Start, Dur });
}
