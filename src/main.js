import * as THREE from 'three';
import './style.css';
import { Terrain } from './world/terrain.js';
import { Sky } from './world/sky.js';
import { makeLabel } from './world/labels.js';
import { Input, isTouch } from './input.js';
import { Walker, makePerson } from './player/walker.js';
import { FollowCam } from './camera.js';
import { Minimap } from './ui/minimap.js';
import { LANDMARKS, byId, PLACE_STYLE } from './landmarks.js';
import { City } from './world/city.js';
import { buildGroundCanvas, groundTexture } from './world/ground.js';
import { fetchJSON } from './util/load.js';
import { placeLandmarks, buildLandmarks, landmarkBlocked } from './world/landmarks3d.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

/* ---------- qualidade (celular x computador) ---------- */
const Q = isTouch
  ? { pixelRatio: 1.25, shadowSize: 1024, shadowRange: 45, fogFar: 4000, antialias: false, ground: 2048, buildDist: 1700, roadDist: 600 }
  : { pixelRatio: 1.5, shadowSize: 2048, shadowRange: 60, fogFar: 8000, antialias: true, ground: 4096, buildDist: 4000, roadDist: 950 };

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
const [terrain, world] = await Promise.all([Terrain.load(BASE), fetchJSON(BASE + 'data/world.json.gz')]);
const T = (name, fn) => { const t0 = performance.now(); const r = fn(); if (DEBUG) console.log(name, Math.round(performance.now() - t0) + ' ms'); return r; };
const LM = placeLandmarks(world, terrain);
const city = new City(world, terrain, Q, LM.exclusions);
T('rio', () => city.carveWater());                   // escava o leito do rio antes de montar a malha
const groundCanvas = T('textura do chão', () => buildGroundCanvas(terrain, world, Math.min(Q.ground, renderer.capabilities.maxTextureSize)));
terrain.material.map = groundTexture(groundCanvas, renderer);
T('terreno', () => scene.add(terrain.build()));
T('cidade', () => scene.add(city.build()));
const landmarks = T('pontos marcantes', () => buildLandmarks(LM, world, terrain, scene));
const sky = new Sky(scene, Q);

// placas dos pontos marcantes
const labels = [];
for (const l of LANDMARKS) {
  if (['ruacoberta', 'igreja', 'waldir'].includes(l.id)) continue;   // têm placa no próprio modelo
  const far = l.id === 'cruz' || l.id === 'asadelta';
  const s = makeLabel(l.nome, far ? 120 : 22);
  s.position.set(l.x, terrain.heightAt(l.x, l.z) + (far ? 90 : 22), l.z);
  s.userData.maxDist = far ? 1e9 : 2500;
  scene.add(s); labels.push(s);
}

// lugares do OSM (escolas, bancos, postos…): placa pequena, visível de perto, e ícone no minimapa
const places = world.places
  .filter(p => !LANDMARKS.some(l => Math.hypot(l.x - p.x, l.z - p.z) < 60))
  .map(p => ({ ...p, ...PLACE_STYLE[p.k], nome: p.n }));
for (const p of places) {
  if (p.k === 'onibus') continue;                      // paradas: só o ícone no minimapa
  const big = p.k === 'localidade';                    // morros e localidades: placa grande, vista de longe
  const s = makeLabel(p.n, big ? 60 : 9);
  s.position.set(p.x, terrain.heightAt(p.x, p.z) + (big ? 60 : 12), p.z);
  s.userData.maxDist = big ? 6000 : 350;
  scene.add(s); labels.push(s);
}

/* ---------- jogador ---------- */
let spawn = byId.praca;
if (params.get('spawn') && byId[params.get('spawn')]) spawn = byId[params.get('spawn')];
const player = new Walker(scene, terrain, spawn.x + 6, spawn.z + 6);
player.blocked = (x, z, r) => city.blocked(x, z, r) || landmarkBlocked(landmarks.colliders, x, z, r);
// se nasceu dentro de um prédio, procura um lugar livre em espiral
for (let k = 0; k < 400 && player.blocked(player.x, player.z, 0.6); k++) { const a = k * 0.7, r = 1 + k * 0.25; player.x = spawn.x + Math.cos(a) * r; player.z = spawn.z + Math.sin(a) * r; }
if (params.has('x')) { player.x = +params.get('x'); player.z = +params.get('z'); }
const input = new Input(renderer.domElement);
const cam = new FollowCam(camera, terrain);
cam.blocked = (x, z, r) => city.blocked(x, z, r);
cam.roofAt = (x, z) => { const h = city.roofAt(x, z); return h === -Infinity ? -Infinity : h; };
cam.yaw = Math.PI;                                   // começa olhando para o norte (morros)
const minimap = new Minimap($('map'), terrain, groundCanvas);

/* ---------- o Waldir ---------- */
const FALAS_WALDIR = [
  'Bah, tchê! Chega mais, a Brahma tá trincando de gelada!',
  'Tri legal te ver por aqui! Senta aí na calçada que eu já levo.',
  'Bah, na Oktoberfest isso aqui lota, guri. Não tem nem onde estacionar!',
  'Tu já subiu no Morro da Cruz? De noite a cruz acende, é tri bonito.',
  'Aqui é o ponto de encontro do centro, desde sempre. Bah!',
  'Capaz que tu vai embora sem tomar um chope? Nem pensar, tchê!',
];
let waldir = null, falaI = 0;
if (landmarks.waldir) {
  const w = landmarks.waldir;
  waldir = makePerson({ shirt: 0xf6f6f6, pants: 0x3b3b3b, skin: 0xdcae86, hair: 0x9c9c9c, shoes: 0x2b2b2b, mustache: true, apron: 0xd9161e, build: 1.18 });
  waldir.position.set(w.x, w.y, w.z); waldir.rotation.y = w.face + Math.PI / 2;
  scene.add(waldir);
  const tag = makeLabel('Waldir', 3); tag.position.set(w.x, w.y + 2.9, w.z); tag.userData.maxDist = 40; scene.add(tag); labels.push(tag);
}
input.on('act', () => {
  if (!running || !waldir) return;
  if (Math.hypot(player.x - waldir.position.x, player.z - waldir.position.z) < 4) {
    toast('Waldir', ': “' + FALAS_WALDIR[falaI++ % FALAS_WALDIR.length] + '”', 5);
    waldir.rotation.y = Math.atan2(player.x - waldir.position.x, player.z - waldir.position.z);
  }
});

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
  landmarks.update(dt, sky);
  if (waldir) waldir.userData.animate(dt, 0);

  lodT -= dt;
  if (lodT <= 0) {
    lodT = 0.3;
    terrain.update(camera.position.x, camera.position.z);
    city.update(camera.position.x, camera.position.z);
    city.setNight(sky.night);
    for (const s of labels) s.visible = s.position.distanceTo(camera.position) < s.userData.maxDist;
  }

  if (running) {
    const h = Math.floor(sky.hours), m = Math.floor((sky.hours - h) * 60);
    if (m !== lastMin) { lastMin = m; $('clockT').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
    $('spd').textContent = `A pé · ${Math.round(player.y)} m`;
    const pertoWaldir = waldir && Math.hypot(player.x - waldir.position.x, player.z - waldir.position.z) < 4;
    $('prompt').style.display = pertoWaldir ? 'block' : 'none';
    if (pertoWaldir) $('prompt').textContent = isTouch ? 'Toque em FALAR para conversar com o Waldir' : 'E · conversar com o Waldir';
    $('bAct').textContent = pertoWaldir ? 'Falar' : 'Carro';
    minimap.draw(player.x, player.z, cam.yaw, player.ang, places);
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
window.__game = { scene, camera, renderer, terrain, player, cam, sky, city, world, landmarks, LM };
