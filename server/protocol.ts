export type ClientMessage =
  | { type: "join_room"; roomId: string; playerName: string }
  | { type: "input"; sequence: number; moveX: number; moveZ: number; yaw: number; pitch: number; fire: boolean; interact?: boolean };

export type ServerMessage =
  | { type: "welcome"; playerId: string; roomId: string; tickRate: number }
  | { type: "snapshot"; tick: number; players: PlayerState[]; objective: { completed: number; total: number; phase: "recover" | "extract" | "complete"; remaining: number } }
  | { type: "combat"; attackerId: string; targetId: string; damage: number }
  | { type: "error"; message: string };

export type PlayerState = {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  health: number;
};
