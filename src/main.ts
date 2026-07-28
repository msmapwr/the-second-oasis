/**
 * src/main.ts
 * 操作类型：修改
 *
 * 应用入口：创建 AppController 并启动
 * B 优先级（界面层）：挂载渲染层到 index.html 的 #app
 *
 * 关联：B 阶段架构方案 §1.4
 */
import { AppController } from './App/AppController';

// 等待 DOM 就绪（module 脚本默认 defer，此时 DOM 已加载，但防御性检查）
function Bootstrap(): void {
  const MountPoint = document.getElementById('app');
  if (!MountPoint) {
    console.error('[main] 未找到 #app 挂载点');
    return;
  }
  // 创建主控制器并启动主循环（不 await，后台运行）
  const App = new AppController({ MountPoint });
  void App.Run();
}

// DOMContentLoaded 已触发（defer）或等待触发
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', Bootstrap);
} else {
  Bootstrap();
}
