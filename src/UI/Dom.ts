/**
 * src/UI/Dom.ts
 * 操作类型：新建
 *
 * DOM 工具集
 * 关联：B 阶段架构方案 §5
 *
 * 设计要点：
 * 1. el() 工厂函数：声明式创建元素，替代冗长的 createElement 链
 * 2. 事件委托辅助：on() 返回取消函数
 * 3. 批量操作：clear() 清空子节点、toggleClass()
 * 4. 零依赖，纯 DOM API 封装
 */

/**
 * 元素属性描述
 * el() 接受的配置对象类型
 */
export interface ElProps {
  /** 标签（默认 div） */
  Tag?: keyof HTMLElementTagNameMap;
  /** class 列表 */
  Class?: string | string[];
  /** 文本内容 */
  Text?: string;
  /** HTML 内容（谨慎使用） */
  Html?: string;
  /** 行内 style 字符串 */
  Style?: string;
  /** 数据属性（data-xxx） */
  Data?: Record<string, string>;
  /** 属性（如 role/tabindex） */
  Attrs?: Record<string, string>;
  /** 子元素 */
  Children?: (Node | string | null | undefined)[];
  /** 挂载到的父元素（可选） */
  Parent?: HTMLElement | null;
  /** 插入到某元素之前（可选） */
  Before?: Node | null;
}

/**
 * 声明式创建 DOM 元素
 * 用法：El({ Tag:'button', Class:'pixel-btn', Text:'开始', Parent:root })
 */
export function El<Props extends ElProps>(P: Props): HTMLElement {
  const Tag = P.Tag ?? 'div';
  const Node = document.createElement(Tag);

  // class
  if (P.Class !== undefined) {
    if (typeof P.Class === 'string') {
      Node.className = P.Class;
    } else {
      Node.className = P.Class.join(' ');
    }
  }

  // 文本
  if (P.Text !== undefined) {
    Node.textContent = P.Text;
  }

  // HTML
  if (P.Html !== undefined) {
    Node.innerHTML = P.Html;
  }

  // style
  if (P.Style !== undefined) {
    Node.setAttribute('style', P.Style);
  }

  // data-*
  if (P.Data) {
    for (const [Key, Val] of Object.entries(P.Data)) {
      Node.dataset[Key] = Val;
    }
  }

  // 属性
  if (P.Attrs) {
    for (const [Key, Val] of Object.entries(P.Attrs)) {
      Node.setAttribute(Key, Val);
    }
  }

  // 子元素
  if (P.Children) {
    for (const Child of P.Children) {
      if (Child === null || Child === undefined) continue;
      Node.append(Child);
    }
  }

  // 挂载
  if (P.Parent) {
    if (P.Before) {
      P.Parent.insertBefore(Node, P.Before);
    } else {
      P.Parent.appendChild(Node);
    }
  }

  return Node;
}

/**
 * 事件监听辅助，返回取消函数
 */
export function On(
  Target: EventTarget,
  Type: string,
  Handler: EventListenerOrEventListenerObject,
  Options?: AddEventListenerOptions,
): () => void {
  Target.addEventListener(Type, Handler, Options);
  return () => Target.removeEventListener(Type, Handler, Options);
}

/**
 * 清空元素所有子节点
 */
export function Clear(Node: HTMLElement): void {
  while (Node.firstChild) {
    Node.removeChild(Node.firstChild);
  }
}

/**
 * 切换 class（存在则移除，不存在则添加）
 */
export function ToggleClass(Node: HTMLElement, ClassName: string, Force?: boolean): void {
  if (!Node || !ClassName) return;
  if (Force === undefined) {
    Node.classList.toggle(ClassName);
  } else {
    if (Force) {
      Node.classList.add(ClassName);
    } else {
      Node.classList.remove(ClassName);
    }
  }
}

/**
 * 查询首个匹配元素
 */
export function Qs<T extends HTMLElement = HTMLElement>(
  Selector: string,
  Root: ParentNode = document,
): T | null {
  return Root.querySelector<T>(Selector);
}

/**
 * 查询所有匹配元素
 */
export function Qsa<T extends HTMLElement = HTMLElement>(
  Selector: string,
  Root: ParentNode = document,
): T[] {
  return Array.from(Root.querySelectorAll<T>(Selector));
}

/**
 * 等待元素出现在 DOM 中（MutationObserver 轮询）
 * 用于异步挂载场景
 */
export function WaitForElement(Selector: string, Timeout = 5000): Promise<HTMLElement> {
  return new Promise((Resolve, Reject) => {
    const Found = Qs<HTMLElement>(Selector);
    if (Found) {
      Resolve(Found);
      return;
    }
    const Observer = new MutationObserver(() => {
      const Node = Qs<HTMLElement>(Selector);
      if (Node) {
        Observer.disconnect();
        Resolve(Node);
      }
    });
    Observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      Observer.disconnect();
      Reject(new Error(`等待元素 "${Selector}" 超时`));
    }, Timeout);
  });
}
