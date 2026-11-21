# Game network foundation

这是多人联机 FPS 的第一版网络基础层，目标是把 Saltline 的浏览器客户端接入桌面客户端和本地游戏服务。

## 当前内容

- Node.js + TypeScript WebSocket 游戏服务
- 房间加入和退出
- 服务器权威的基础位置更新
- 20 tick/s 的玩家状态快照
- 客户端输入与服务器状态的消息协议

## 本地运行

```bash
npm install
npm run check
npm run dev:server
```

默认监听 `3100`。可以通过 `GAME_PORT` 指定端口。第一阶段不会连接或修改任何外部数据库。

## 下一步

1. 把 Saltline 的 Three.js 渲染层接入 `server/protocol.ts`。
2. 增加客户端预测、其他玩家插值和断线重连。
3. 将碰撞、射击、弹药和伤害判定迁移到服务器。
4. 增加房间发现服务和 NAT 穿透，中继端口与现有服务隔离。
5. 再接入账号、战绩和经过服务器签名的链上奖励。
