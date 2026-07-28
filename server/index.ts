/**
 * server/index.ts
 * 操作类型：新建
 *
 * 服务端入口——启动 WebSocket 服务。
 * 用法：
 *   npx tsx server/index.ts          # 默认端口 9528
 *   npx tsx server/index.ts 8080     # 自定义端口
 */
import { GameWebSocketServer } from './WebSocketServer';

const Port = parseInt(process.argv[2] || '9528', 10);

const Server = new GameWebSocketServer(Port);

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n[GameServer] 正在关闭...');
  Server.Dispose();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[GameServer] 正在关闭...');
  Server.Dispose();
  process.exit(0);
});

console.log(`[GameServer] 第二绿洲联机服务端已启动 ws://localhost:${Port}`);
