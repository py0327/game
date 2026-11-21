import * as THREE from 'three';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07131d);
scene.fog = new THREE.Fog(0x07131d, 20, 90);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 1.7, 6);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xb8dbff, 0x16202b, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 2.5);
sun.position.set(8, 16, 5); scene.add(sun);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: 0x24323a, roughness: 0.9 }));
floor.rotation.x = -Math.PI / 2; scene.add(floor);
for (let i = 0; i < 20; i += 1) {
  const height = 1 + (i % 2);
  const box = new THREE.Mesh(new THREE.BoxGeometry(2 + (i % 3), height, 2), new THREE.MeshStandardMaterial({ color: 0x40515a }));
  box.position.set((i % 5) * 8 - 16, height / 2, Math.floor(i / 5) * -8 - 4); scene.add(box);
}

const remoteMeshes = new Map(); const keys = new Set();
let yaw = 0; let pitch = 0; let socket; let playerId = '';
const status = document.querySelector('#status'); const playersLabel = document.querySelector('#players'); const healthLabel = document.querySelector('#health');
addEventListener('keydown', (event) => keys.add(event.code));
addEventListener('keyup', (event) => keys.delete(event.code));
document.body.addEventListener('click', () => document.body.requestPointerLock());
addEventListener('mousemove', (event) => { if (document.pointerLockElement !== document.body) return; yaw -= event.movementX * 0.0022; pitch = Math.max(-1.45, Math.min(1.45, pitch - event.movementY * 0.0022)); });
let firing = false; addEventListener('mousedown', () => { firing = true; }); addEventListener('mouseup', () => { firing = false; });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

function connect() {
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:3100`;
  socket = new WebSocket(url);
  socket.addEventListener('open', () => { status.textContent = '已连接'; socket.send(JSON.stringify({ type: 'join_room', roomId: 'default', playerName: `Player-${Math.floor(Math.random() * 9999)}` })); });
  socket.addEventListener('close', () => { status.textContent = '连接断开，正在重试…'; setTimeout(connect, 1500); });
  socket.addEventListener('message', ({ data }) => { const message = JSON.parse(data); if (message.type === 'welcome') playerId = message.playerId; if (message.type === 'snapshot') renderSnapshot(message.players); if (message.type === 'combat') status.textContent = message.targetId === playerId ? '受到攻击' : '交火中'; });
}

function renderSnapshot(players) {
  playersLabel.textContent = `队伍 ${players.length}`;
  const local = players.find((player) => player.id === playerId); if (local) healthLabel.textContent = `护甲 ${local.health}`;
  for (const player of players) {
    if (player.id === playerId) continue;
    let mesh = remoteMeshes.get(player.id);
    if (!mesh) { mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.1, 4, 8), new THREE.MeshStandardMaterial({ color: 0xd65a48 })); scene.add(mesh); remoteMeshes.set(player.id, mesh); }
    mesh.position.lerp(new THREE.Vector3(player.x, player.y - 0.8, player.z), 0.35);
  }
  for (const [id, mesh] of remoteMeshes) if (!players.some((player) => player.id === id)) { scene.remove(mesh); remoteMeshes.delete(id); }
}

let sequence = 0;
function tick() {
  const forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS')); const strafe = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
  const direction = new THREE.Vector3(strafe, 0, -forward).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  camera.position.addScaledVector(direction, 0.12); camera.rotation.set(pitch, yaw, 0, 'YXZ');
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'input', sequence: sequence++, moveX: strafe, moveZ: forward, yaw, pitch, fire: firing }));
  renderer.render(scene, camera); requestAnimationFrame(tick);
}
connect(); tick();
