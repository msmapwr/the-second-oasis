/**
 * src/UI/Components/Component.ts
 * 操作类型：新建
 *
 * DOM 组件基类
 * 关联：B 阶段架构方案 §5
 *
 * 设计要点：
 * 1. 抽象基类，所有 DOM 组件继承
 * 2. 生命周期：Mount → Update(多次) → Unmount
 * 3. 持有 Root 元素，子类负责填充内容
 * 4. Unmount 时清理事件监听（子类应在 _OnUnmount 中解绑）
 * 5. 提供 El() 快捷创建子元素的方法
 */
import { El, type ElProps } from '../Dom';

/**
 * DOM 组件抽象基类
 *
 * 子类需实现：
 * - Mount(Parent)：创建 Root 并挂载
 * - 可选 _OnUnmount()：清理事件监听
 */
export abstract class Component {
  /** 根元素（Mount 后非 null） */
  protected _Root: HTMLElement | null = null;

  /** 是否已挂载 */
  private _IsMounted = false;

  get IsMounted(): boolean {
    return this._IsMounted;
  }

  /**
   * 根元素（挂载后可访问）
   */
  get Root(): HTMLElement {
    if (!this._Root) {
      throw new Error(`组件 ${this.constructor.name} 尚未 Mount`);
    }
    return this._Root;
  }

  /**
   * 挂载到父元素
   * 子类应在此创建 _Root 并填充初始内容
   */
  abstract Mount(Parent: HTMLElement): void;

  /**
   * 卸载：从 DOM 移除 + 调用子类清理
   */
  Unmount(): void {
    if (!this._IsMounted || !this._Root) return;
    this._OnUnmount();
    this._Root.remove();
    this._Root = null;
    this._IsMounted = false;
  }

  /**
   * 子类重写：卸载时清理（移除事件监听、定时器等）
   */
  protected _OnUnmount(): void {
    // 默认空实现
  }

  /**
   * 创建并挂载子元素到 Root
   * 语法糖，减少子类样板代码
   */
  protected El(P: ElProps): HTMLElement {
    return El({ ...P, Parent: this.Root });
  }

  /**
   * 设置根元素（子类在 Mount 中调用）
   */
  protected SetRoot(Node: HTMLElement): void {
    this._Root = Node;
    this._IsMounted = true;
    // UI 浮层容器（_UiLayer）设了 pointer-events:none 以便底层画布透传点击，
    // 但交互组件自身必须恢复 auto，否则整层继承 none 导致按钮全部点不动
    Node.style.pointerEvents = 'auto';
  }

  /**
   * 显示
   */
  Show(): void {
    if (this._Root) this._Root.style.display = '';
  }

  /**
   * 隐藏
   */
  Hide(): void {
    if (this._Root) this._Root.style.display = 'none';
  }
}
