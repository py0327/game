import { randomUUID } from "node:crypto";
import { WebSocketServer, type WebSocket } from "ws";
import type { ClientMessage, PlayerState, ServerMessage } from "./protocol.js";

const port = Number(process.env.GAME_PORT ?? 3100);
const tickRate = 20;
const rooms = new Map<string, Map<string, PlayerState>>();
const sockets = new Map<string, WebSocket>();

function send(socket: WebSocket, message: ServerMessage) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
}

function broadcast(roomId: string, message: ServerMessage) {
  const room = rooms.get(roomId);
  if (!room) return;
  for (const playerId of room.keys()) {
    const socket = sockets.get(playerId);
    if (socket) send(socket, message);
  }
}

function parseMessage(value: string): ClientMessage | undefined {
  try {
    const message = JSON.parse(value) as ClientMessage;
    if (typeof message?.type !== "string") return undefined;
    return message;
  } catch {
    return undefined;
  }
}

const server = new WebSocketServer({ port });
server.on("connection", (socket) => {
  const playerId = randomUUID();
  let roomId: string | undefined;

  socket.on("message", (raw) => {
    const message = parseMessage(raw.toString());
    if (!message) return send(socket, { type: "error", message: "Invalid message" });

    if (message.type === "join_room") {
      const name = message.playerName.trim().slice(0, 24) || "Player";
      roomId = message.roomId.trim().slice(0, 48) || "default";
      const room = rooms.get(roomId) ?? new Map<string, PlayerState>();
      room.set(playerId, { id: playerId, name, x: 0, y: 1.7, z: 0, yaw: 0, pitch: 0, health: 100 });
      rooms.set(roomId, room);
      sockets.set(playerId, socket);
      send(socket, { type: "welcome", playerId, roomId, tickRate });
      return;
    }

    if (message.type === "input" && roomId) {
      const player = rooms.get(roomId)?.get(playerId);
      if (!player) return;
      const length = Math.hypot(message.moveX, message.moveZ) || 1;
      const speed = 0.12;
      player.x += (message.moveX / length) * speed;
      player.z += (message.moveZ / length) * speed;
      player.yaw = Number.isFinite(message.yaw) ? message.yaw : player.yaw;
      player.pitch = Number.isFinite(message.pitch) ? message.pitch : player.pitch;
    }
  });

  socket.on("close", () => {
    if (!roomId) return;
    const room = rooms.get(roomId);
    room?.delete(playerId);
    sockets.delete(playerId);
    if (room && room.size === 0) rooms.delete(roomId);
  });
});

let tick = 0;
setInterval(() => {
  tick += 1;
  for (const [roomId, room] of rooms) {
    broadcast(roomId, { type: "snapshot", tick, players: [...room.values()] });
  }
}, 1000 / tickRate);

console.log(`Game service listening on ws://0.0.0.0:${port}`);
