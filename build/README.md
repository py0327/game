# 桌面客户端

项目使用 Electron 打包桌面客户端。客户端默认连接线上游戏服务，也可以用 `GAME_URL` 指向其他环境。

## 开发运行

```bash
npm install
npm run desktop:dev
```

## 生成可分发目录

```bash
npm run desktop:package
```

输出位于 `dist/`。当前桌面壳连接远程游戏服务，后续可以把本地房主服务作为子进程一并打包。
