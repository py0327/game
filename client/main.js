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
const extraction = new THREE.Mesh(new THREE.RingGeometry(3, 3.3, 32), new THREE.MeshBasicMaterial({ color: 0x43d6b4, side: THREE.DoubleSide }));
extraction.rotation.x = -Math.PI / 2; extraction.position.set(0, 0.02, -25); scene.add(extraction);
for (let i = 0; i < 20; i += 1) {
  const height = 1 + (i % 2);
  const box = new THREE.Mesh(new THREE.BoxGeometry(2 + (i % 3), height, 2), new THREE.MeshStandardMaterial({ color: 0x40515a }));
  box.position.set((i % 5) * 8 - 16, height / 2, Math.floor(i / 5) * -8 - 4); scene.add(box);
}

const remoteMeshes = new Map(); const keys = new Set();
let yaw = 0; let pitch = 0; let socket; let playerId = ''; let roomId = localStorage.getItem('fracture.room') || 'default'; let playerName = localStorage.getItem('fracture.name') || `回收员-${Math.floor(Math.random() * 9999)}`;
const status = document.querySelector('#status'); const playersLabel = document.querySelector('#players'); const healthLabel = document.querySelector('#health'); const creditsLabel = document.querySelector('#credits'); const weaponLabel = document.querySelector('#weapon'); const objectiveLabel = document.querySelector('#objective');
let aimMode = localStorage.getItem('fracture.aimMode') || 'hold'; let aiming = false;
let weapon = localStorage.getItem('fracture.weapon') || 'rifle';
addEventListener('keydown', (event) => keys.add(event.code));
addEventListener('keyup', (event) => keys.delete(event.code));
document.body.addEventListener('click', () => document.body.requestPointerLock());
addEventListener('mousemove', (event) => { if (document.pointerLockElement !== document.body) return; yaw -= event.movementX * 0.0022; pitch = Math.max(-1.45, Math.min(1.45, pitch - event.movementY * 0.0022)); });
let firing = false; addEventListener('mousedown', () => { firing = true; }); addEventListener('mouseup', () => { firing = false; });
addEventListener('contextmenu', (event) => event.preventDefault());
addEventListener('mousedown', (event) => { if (event.button === 2) aiming = aimMode === 'toggle' ? !aiming : true; });
addEventListener('mouseup', (event) => { if (event.button === 2 && aimMode === 'hold') aiming = false; });
addEventListener('keydown', (event) => { if (event.code === 'KeyV') { aimMode = aimMode === 'hold' ? 'toggle' : 'hold'; localStorage.setItem('fracture.aimMode', aimMode); status.textContent = aimMode === 'hold' ? '按住右键开镜' : '点击右键切换开镜'; } });
addEventListener('keydown', (event) => { const choices = { Digit1: ['rifle', '武器 1 短突击步枪'], Digit2: ['scatter', '武器 2 脉冲霰射器'], Digit3: ['repair', '武器 3 维修手枪'] }; const choice = choices[event.code]; if (choice) { weapon = choice[0]; localStorage.setItem('fracture.weapon', weapon); if (weaponLabel) weaponLabel.textContent = choice[1]; } });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

function connect() {
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:3100`;
  socket = new WebSocket(url);
  socket.addEventListener('open', () => { status.textContent = '已连接'; socket.send(JSON.stringify({ type: 'list_rooms' })); socket.send(JSON.stringify({ type: 'join_room', roomId, playerName })); });
  socket.addEventListener('close', () => { status.textContent = '连接断开，正在重试…'; setTimeout(connect, 1500); });
  socket.addEventListener('message', ({ data }) => { const message = JSON.parse(data); if (message.type === 'room_list') status.textContent = `大厅 ${message.rooms.length} 个房间`; if (message.type === 'welcome') playerId = message.playerId; if (message.type === 'snapshot') { renderSnapshot(message.players); if (objectiveLabel) objectiveLabel.textContent = message.objective.phase === 'recover' ? `目标：激活数据节点 ${message.objective.completed}/${message.objective.total}（靠近后按 E）` : message.objective.phase === 'extract' ? `目标：前往撤离点（${message.objective.remaining}s）` : '任务完成：奖励已发放'; } if (message.type === 'combat') status.textContent = message.targetId === playerId ? '受到攻击' : '交火中'; });
}

function renderSnapshot(players) {
  playersLabel.textContent = `队伍 ${players.length}`;
  const local = players.find((player) => player.id === playerId); if (local) { healthLabel.textContent = local.downed ? '倒地：靠近队友按 E' : `护甲 ${local.health}`; if (creditsLabel) creditsLabel.textContent = `积分 ${local.credits ?? 0}`; }
  for (const player of players) {
    if (player.id === playerId) continue;
    let mesh = remoteMeshes.get(player.id);
    if (!mesh) { mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.1, 4, 8), new THREE.MeshStandardMaterial({ color: player.kind === 'enemy' ? 0xe2a52b : 0xd65a48 })); scene.add(mesh); remoteMeshes.set(player.id, mesh); }
    mesh.position.lerp(new THREE.Vector3(player.x, player.y - 0.8, player.z), 0.35);
  }
  for (const [id, mesh] of remoteMeshes) if (!players.some((player) => player.id === id)) { scene.remove(mesh); remoteMeshes.delete(id); }
}

let sequence = 0;
function tick() {
  const forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS')); const strafe = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
  const direction = new THREE.Vector3(strafe, 0, -forward).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  camera.position.addScaledVector(direction, aiming ? 0.07 : 0.12); camera.fov += ((aiming ? 52 : 72) - camera.fov) * 0.2; camera.updateProjectionMatrix(); camera.rotation.set(pitch, yaw, 0, 'YXZ');
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'input', sequence: sequence++, moveX: strafe, moveZ: forward, yaw, pitch, fire: firing, ads: aiming, weapon, interact: keys.has('KeyE') }));
  renderer.render(scene, camera); requestAnimationFrame(tick);
}
connect(); tick();

const roomInput=document.querySelector('#room-input'); const joinButton=document.querySelector('#room-join'); const createButton=document.querySelector('#room-create'); if(roomInput){roomInput.value=roomId; joinButton.onclick=()=>{localStorage.setItem('fracture.room',roomInput.value.trim()||'default'); location.reload()}; createButton.onclick=()=>{roomInput.value='room-'+Math.floor(Math.random()*9000+1000); localStorage.setItem('fracture.room',roomInput.value); location.reload()};}

const nameInput=document.querySelector('#name-input'); const saveName=document.querySelector('#save-name'); if(nameInput){nameInput.value=playerName; saveName.onclick=()=>{playerName=nameInput.value.trim()||'回收员'; localStorage.setItem('fracture.name',playerName); location.reload()};}
