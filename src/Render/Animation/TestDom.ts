/**
 * src/Render/Animation/TestDom.ts
 * 操作类型：新建
 *
 * Node 测试环境最小 DOM 替身
 *
 * 设计要点：
 * 1. Vitest 全局环境为 node，DOM 动画测试需要轻量 document 替身
 * 2. 只实现 createElement / appendChild / remove / getBoundingClientRect / style
 * 3. 不引入 jsdom/happy-dom 依赖，保持 devDependencies 精简
 */

export class FakeElement {
  readonly tagName: string;
  private _TextContent = '';
  readonly children: FakeElement[] = [];
  readonly style: Record<string, string> = {};
  private _Removed = false;
  private readonly _Rect: DOMRect;
  parentNode: FakeElement | null = null;

  constructor(Tag: string, Rect: Partial<DOMRect> = {}) {
    this.tagName = Tag;
    this._Rect = {
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      top: 0,
      left: 0,
      right: 100,
      bottom: 50,
      toJSON: () => '',
      ...Rect,
    } as DOMRect;
  }

  set textContent(Val: string) {
    this._TextContent = Val;
  }

  get textContent(): string {
    if (this.children.length === 0) return this._TextContent;
    return this.children.map((C) => C.textContent).join('');
  }

  appendChild(Child: FakeElement): FakeElement {
    this.children.push(Child);
    Child.parentNode = this;
    return Child;
  }

  remove(): void {
    this._Removed = true;
    if (this.parentNode) {
      const Idx = this.parentNode.children.indexOf(this);
      if (Idx >= 0) this.parentNode.children.splice(Idx, 1);
      this.parentNode = null;
    }
  }

  getBoundingClientRect(): DOMRect {
    return this._Rect;
  }

  get IsRemoved(): boolean {
    return this._Removed;
  }
}

export const FakeDocument = {
  body: new FakeElement('body'),
  createElement: (Tag: string) => new FakeElement(Tag),
};

/**
 * 在 Node 测试环境中注入全局 document 替身
 */
export function InstallFakeDom(): void {
  // 使用类型断言绕过 node 环境缺失 document 的问题
  (globalThis as unknown as { document: typeof FakeDocument }).document = FakeDocument;
}

/**
 * 重置 body，避免测试间 DOM 状态泄漏
 */
export function ResetFakeDom(): void {
  FakeDocument.body = new FakeElement('body');
  (globalThis as unknown as { document: typeof FakeDocument }).document = FakeDocument;
}
