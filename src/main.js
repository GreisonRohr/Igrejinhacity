import * as THREE from 'three';
import './style.css';
import { Terrain } from './world/terrain.js';
import { Sky } from './world/sky.js';
import { makeLabel } from './world/labels.js';
import { Input, isTouch } from './input.js';
import { Walker } from './player/walker.js';
import { FollowCam } from './camera.js';
import { Minimap } from './ui/minimap.js';
import { LANDMARKS, byId } from './landmarks.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

/* ---------- qualidade (celular x computador) ---------- */
const Q = isTouch
  ? { pixelRatio: 1.25, shadowSize: 1024, shadowRange: 45, fogFar: 5000, antialias: false }
  : { pixelRatio: 1.5, shadowSize: 2048, shadowRange: 60, fogFar: 8000, antialias: true };

const renderer = new THREE.WebGLRenderer({ antialias: Q.antialias, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, Q.pixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
$('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.5, Q.fogFar * 1.2);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

if (isTouch) {
  document.body.classList.add('touch');
  $('keysDesk').innerHTML = '<kbd>Joystick</kbd><span>andar (empurre tudo para correr)</span><kbd>Arrastar a tela</kbd><span>girar a câmera</span>';
}

/* ---------- toast e HUD ---------- */
let toastT = 0;
function toast(title, txt = '', sec = 4) {
  const el = $('toast'); el.textContent = '';
  const b = document.createElement('b'); b.textContent = title;
  el.append(b, document.createTextNode(txt)); el.classList.add('on'); toastT = sec;
}

/* ---------- carregamento ---------- */
const BASE = import.meta.env.BASE_URL;
const terrain = await Terrain.load(BASE);
scene.add(terrain.build());
const sky = new Sky(scene, Q);

// placas dos pontos marcantes
const labels = [];
for (const l of LANDMARKS) {
  if (l.id === 'ruacoberta') continue;              // muito perto da praça; ganha placa própria no modelo
  const far = l.id === 'cruz' || l.id === 'asadelta';
  const s = makeLabel(l.nome, far ? 120 : 22);
  s.position.set(l.x, terrain.heightAt(l.x, l.z) + (far ? 90 : 22), l.z);
  s.userData.maxDist = far ? 1e9 : 2500;
  scene.add(s); labels.push(s);
}

/* ---------- jogador ---------- */
let spawn = byId.praca;
if (params.get('spawn') && byId[params.get('spawn')]) spawn = byId[params.get('spawn')];
const player = new Walker(scene, terrain, spawn.x + 6, spawn.z + 6);
if (params.has('x')) { player.x = +params.get('x'); player.z = +params.get('z'); }
const input = new Input(renderer.domElement);
const cam = new FollowCam(camera, terrain);
cam.yaw = Math.PI;                                   // começa olhando para o norte (morros)
const minimap = new Minimap($('map'), terrain);

/* ---------- laço ---------- */
let running = false, last = performance.now(), lodT = 0, lastMin = -1;
let fpsN = 0, fpsT = 0;
if (DEBUG) $('fps').hidden = false;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const look = input.takeLook();
  const ax = running ? input.axes() : { f: 0, t: 0, run: false };
  player.update(dt, ax, cam.yaw);
  const moving = Math.hypot(ax.f, ax.t) > 0.1;
  cam.update(dt, { x: player.x, y: player.y, z: player.z }, running ? look : { dx: dt * 6, dy: 0, zoom: 0 },
    { followYaw: moving && ax.f > 0.5 ? player.ang : null, height: 1.6 });
  sky.update(running ? dt : 0, { x: player.x, y: player.y, z: player.z });

  lodT -= dt;
  if (lodT <= 0) {
    lodT = 0.3;
    terrain.update(camera.position.x, camera.position.z);
    for (const s of labels) s.visible = s.position.distanceTo(camera.position) < s.userData.maxDist;
  }

  if (running) {
    const h = Math.floor(sky.hours), m = Math.floor((sky.hours - h) * 60);
    if (m !== lastMin) { lastMin = m; $('clockT').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
    $('spd').textContent = `A pé · ${Math.round(player.y)} m`;
    minimap.draw(player.x, player.z, cam.yaw, player.ang);
    // ponto mais próximo
    let near = null, nd = 1e9;
    for (const l of LANDMARKS) { const d = Math.hypot(l.x - player.x, l.z - player.z); if (d < nd) { nd = d; near = l; } }
    $('objS').textContent = near.nome;
    $('objD').textContent = `${nd < 1000 ? Math.round(nd) + ' m' : (nd / 1000).toFixed(1) + ' km'} daqui`;
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('on'); }
  }

  renderer.render(scene, camera);
  if (DEBUG) {
    fpsN++; fpsT += dt;
    if (fpsT > 0.5) { const i = renderer.info.render; $('fps').textContent = `${Math.round(fpsN / fpsT)} fps · ${i.calls} draws · ${(i.triangles / 1000).toFixed(0)}k tris`; fpsN = fpsT = 0; }
  }
  requestAnimationFrame(frame);
}

$('play').disabled = false; $('play').textContent = 'Jogar';
$('play').addEventListener('click', () => {
  $('start').hidden = true; $('hud').hidden = false; running = true;
  toast('Bem-vindo a Igrejinha!', isTouch ? ' Use o joystick para andar e arraste a tela para olhar.' : ' WASD para andar, Shift corre, arraste o mouse para olhar.', 6);
});
if (params.has('autostart')) $('play').click();
requestAnimationFrame(frame);

// acesso para testes automatizados
window.__game = { scene, camera, renderer, terrain, player, cam, sky };
