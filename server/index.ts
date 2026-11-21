import { randomUUID } from "node:crypto";
import { WebSocketServer, type WebSocket } from "ws";
import type { ClientMessage, PlayerState, ServerMessage } from "./protocol.js";

const port = Number(process.env.GAME_PORT ?? 3100);
const tickRate = 20;
const rooms = new Map<string, Map<string, PlayerState>>();
const sockets = new Map<string, WebSocket>();
const lastShot = new Map<string, number>();
const roomObjectives = new Map<string, { nodes: { x: number; z: number; done: boolean }[]; phase: "recover" | "extract" | "complete"; extractStarted: number }>();

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
      if (!roomObjectives.has(roomId)) roomObjectives.set(roomId, { nodes: [{ x: 5, z: -5, done: false }, { x: -7, z: -12, done: false }, { x: 10, z: -18, done: false }], phase: "recover", extractStarted: 0 });
      if (room.size === 0) {
        room.set(`${roomId}-crawler-1`, { id: `${roomId}-crawler-1`, kind: "enemy", name: "维护爬行机", x: 8, y: 1.2, z: -10, yaw: 0, pitch: 0, health: 100 });
        room.set(`${roomId}-crawler-2`, { id: `${roomId}-crawler-2`, kind: "enemy", name: "维护爬行机", x: -8, y: 1.2, z: -14, yaw: 0, pitch: 0, health: 100 });
      }
      room.set(playerId, { id: playerId, name, x: 0, y: 1.7, z: 0, yaw: 0, pitch: 0, health: 100 });
      rooms.set(roomId, room);
      sockets.set(playerId, socket);
      send(socket, { type: "welcome", playerId, roomId, tickRate });
      return;
    }

    if (message.type === "input" && roomId) {
      const room = rooms.get(roomId);
      if (!room) return;
      const player = room.get(playerId);
      if (!player) return;
      const length = Math.hypot(message.moveX, message.moveZ) || 1;
      const speed = 0.12;
      player.x += (message.moveX / length) * speed;
      player.z += (message.moveZ / length) * speed;
      player.yaw = Number.isFinite(message.yaw) ? message.yaw : player.yaw;
      player.pitch = Number.isFinite(message.pitch) ? message.pitch : player.pitch;
      const objective = roomObjectives.get(roomId);
      if (message.interact && objective?.phase === "recover") {
        const node = objective.nodes.find((candidate) => !candidate.done && Math.hypot(candidate.x - player.x, candidate.z - player.z) < 3);
        if (node) node.done = true;
        if (objective.nodes.every((candidate) => candidate.done)) { objective.phase = "extract"; objective.extractStarted = Date.now(); }
      }
      if (message.fire) {
        const now = Date.now();
        if (now - (lastShot.get(playerId) ?? 0) >= 250) {
          lastShot.set(playerId, now);
          let target: PlayerState | undefined;
          let bestDistance = 12;
          for (const candidate of room.values()) {
            if (candidate.id === playerId || candidate.health <= 0) continue;
            const distance = Math.hypot(candidate.x - player.x, candidate.z - player.z);
            if (distance < bestDistance) { bestDistance = distance; target = candidate; }
          }
          if (target) {
            target.health = Math.max(0, target.health - 25);
            broadcast(roomId, { type: "combat", attackerId: playerId, targetId: target.id, damage: 25 });
          }
        }
      }
    }
  });

  socket.on("close", () => {
    if (!roomId) return;
    const room = rooms.get(roomId);
    room?.delete(playerId);
    sockets.delete(playerId);
    lastShot.delete(playerId);
    if (room && room.size === 0) { rooms.delete(roomId); roomObjectives.delete(roomId); }
  });
});

let tick = 0;
setInterval(() => {
  tick += 1;
  for (const [roomId, room] of rooms) {
    const objective = roomObjectives.get(roomId) ?? { nodes: [], phase: "recover" as const, extractStarted: 0 };
    const players = [...room.values()].filter((player) => player.kind !== "enemy" && player.health > 0);
    for (const enemy of [...room.values()].filter((player) => player.kind === "enemy" && player.health > 0)) {
      const target = players[0];
      if (!target) continue;
      const dx = target.x - enemy.x; const dz = target.z - enemy.z; const distance = Math.hypot(dx, dz);
      if (distance > 1.8) { enemy.x += (dx / Math.max(distance, 1)) * 0.035; enemy.z += (dz / Math.max(distance, 1)) * 0.035; }
      if (distance < 2.2 && tick % 20 === 0) target.health = Math.max(0, target.health - 10);
    }
    if (objective.phase === "extract" && Date.now() - objective.extractStarted > 15000) objective.phase = "complete";
    broadcast(roomId, { type: "snapshot", tick, players: [...room.values()], objective: { completed: objective.nodes.filter((node) => node.done).length, total: objective.nodes.length, phase: objective.phase, remaining: objective.phase === "extract" ? Math.max(0, 15 - Math.floor((Date.now() - objective.extractStarted) / 1000)) : 0 } });
  }
}, 1000 / tickRate);

console.log(`Game service listening on ws://0.0.0.0:${port}`);
