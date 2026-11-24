// Pessoas realistas com esqueleto (Quaternius Universal Base Characters + Universal Animation Library, CC0;
// convertidos por scripts/build-characters.mjs). Usadas no protagonista e nos pedestres perto da câmera.
//
// Roupa sem malha extra: o corpo base vem só de roupa de baixo, então a roupa é "pintada" por um shader conforme o
// osso dominante de cada vértice (tronco = camiseta/jaqueta, coxa/canela = calça, pé = tênis, braço = manga curta ou
// comprida). O tecido ganha um pouco de volume (vértice empurrado pela normal) e perde o relevo dos músculos.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { retargetClips } from './retarget.js';
import { buildCostume } from './costumes.js';

// índices dos ossos no esqueleto (mesma ordem nos dois corpos e na biblioteca de animações)
const B = { pelvis: 1, spine: [2, 3, 4], neck: 5, head: 6, clav: [7, 31], upper: [8, 32], lower: [9, 33], thigh: [55, 60], calf: [56, 61], foot: [57, 58, 59, 62, 63, 64] };
const HAIRS = ['buzzed', 'simpleparted', 'long', 'buns', 'buzzedfemale', 'beard'];
// velocidade (m/s) em que cada ciclo foi gravado (passada casa com o chão)
const NOMINAL = { Walk_Loop: 1.35, Walk_Formal_Loop: 1.15, Jog_Fwd_Loop: 3.4, Sprint_Loop: 6.2 };

/** Shader de roupa por osso dominante. Uniforms por pessoa (cores, mangas, volume). */
function clothe(mat) {
  const u = {
    uTop: { value: new THREE.Color(0x2a3550) }, uPants: { value: new THREE.Color(0x2f4a6e) }, uShoes: { value: new THREE.Color(0xf2f2f2) },
    uSkin: { value: new THREE.Color(1, 1, 1) }, uSleeve: { value: 1 }, uPuff: { value: 0.012 }, uPuffP: { value: 0.01 }, uShorts: { value: 0 }, uSkirt: { value: 0 },
    // traje típico (0 nenhum, 1 lederhosen, 2 dirndl) e suas 4 cores
    uCostume: { value: 0 }, uK1: { value: new THREE.Color() }, uK2: { value: new THREE.Color() }, uK3: { value: new THREE.Color() }, uK4: { value: new THREE.Color() },
  };
  mat.userData.cloth = u;
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = `uniform float uSleeve; uniform float uPuff; uniform float uPuffP; uniform float uShorts; uniform float uSkirt; uniform float uCostume;
      varying float vTop; varying float vPants; varying float vShoes; varying vec3 vBind; varying float vPart;
      float isAny(float i, float a, float b) { return float(abs(i - a) < 0.5 || abs(i - b) < 0.5); }
      ` + sh.vertexShader.replace('#include <skinbase_vertex>', `#include <skinbase_vertex>
      {
        // osso com maior peso neste vértice
        float w = skinWeight.x; float bi = skinIndex.x;
        if (skinWeight.y > w) { w = skinWeight.y; bi = skinIndex.y; }
        if (skinWeight.z > w) { w = skinWeight.z; bi = skinIndex.z; }
        if (skinWeight.w > w) { w = skinWeight.w; bi = skinIndex.w; }
        float torso = float(bi > 1.5 && bi < 4.5) + isAny(bi, 7.0, 31.0);
        float upper = isAny(bi, 8.0, 32.0), lower = isAny(bi, 9.0, 33.0);
        float pelvis = float(abs(bi - 1.0) < 0.5), thigh = isAny(bi, 55.0, 60.0), calf = isAny(bi, 56.0, 61.0);
        float foot = float(abs(bi - 57.0) < 0.5 || abs(bi - 58.0) < 0.5 || abs(bi - 59.0) < 0.5 || abs(bi - 62.0) < 0.5 || abs(bi - 63.0) < 0.5 || abs(bi - 64.0) < 0.5);
        vTop = min(1.0, torso + upper * step(0.5, uSleeve) + lower * step(1.5, uSleeve));
        vPants = min(1.0, pelvis + thigh * (1.0 - 0.0 * uShorts) + calf * (1.0 - max(uShorts, uSkirt)));
        vShoes = foot;
        // pose de referência (metros, y para cima, z para a frente, braços em T) e parte do corpo, para o traje
        vBind = position;
        vPart = torso * 1.0 + upper * 2.0 + lower * 3.0 + pelvis * 4.0 + thigh * 5.0 + calf * 6.0 + foot * 7.0;
      }`).replace('#include <begin_vertex>', `#include <begin_vertex>
        if (uCostume < 0.5) transformed += normal * (vTop * uPuff + vPants * (1.0 - vTop) * uPuffP + vShoes * 0.02);
        else if (uCostume < 1.5) {
          // lederhosen: camisa com folga, couro grosso até acima do joelho, meião, sapato
          float leg = step(3.5, vPart) * step(vPart, 5.5) * step(0.56, position.y);
          float sleeve = (step(0.5, vPart) * step(vPart, 1.5)) + step(1.5, vPart) * step(vPart, 3.5) * step(abs(position.x), 0.56);
          float sock = step(5.5, vPart) * step(vPart, 6.5) * step(position.y, 0.43);
          transformed += normal * (sleeve * uPuff + leg * uPuffP + sock * 0.006 + vShoes * 0.022);
        } else {
          // dirndl: blusa e manga bufante, corpete justo, sapato
          float torsoF = step(0.5, vPart) * step(vPart, 1.5);
          float puffS = step(1.5, vPart) * step(vPart, 2.5) * step(abs(position.x), 0.36) * (0.035 * smoothstep(0.36, 0.22, abs(position.x)) + 0.01);
          transformed += normal * (torsoF * (position.y > 1.3 ? 0.014 : 0.006) + puffS + vShoes * 0.018);
        }`);
    sh.fragmentShader = `uniform vec3 uTop; uniform vec3 uPants; uniform vec3 uShoes; uniform vec3 uSkin;
      uniform float uCostume; uniform vec3 uK1; uniform vec3 uK2; uniform vec3 uK3; uniform vec3 uK4;
      varying float vTop; varying float vPants; varying float vShoes; varying vec3 vBind; varying float vPart;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float noise2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      float is(float a) { return step(abs(vPart - a), 0.5); }
      // xadrez (vichy/xadrez bávaro): faixas cruzadas com fio fino
      vec3 plaid(vec2 q, vec3 base, vec3 check) {
        float sx = step(0.5, fract(q.x / 0.032)), sy = step(0.5, fract(q.y / 0.032));
        float th = step(0.9, fract(q.x / 0.032 * 2.0)) + step(0.9, fract(q.y / 0.032 * 2.0));
        vec3 c = mix(base, check, (sx + sy) * 0.42);
        return mix(c, check * 0.7, min(1.0, th) * 0.25);
      }
      vec3 leather(vec3 p, vec3 base) { float g = noise2(p.xy * 90.0) * 0.5 + noise2(p.zy * 23.0) * 0.5; return base * (0.82 + 0.3 * g); }
      /** Traje: devolve (cor, máscara de tecido). Fora das regiões do traje, pele. */
      vec4 costume(vec3 p) {
        float ax = abs(p.x);
        if (uCostume < 1.5) {
          // ---- masculino: camisa xadrez, lederhosen com suspensórios e peitilho, meião, sapato de couro
          if (is(1.0) > 0.5 || is(2.0) > 0.5 || (is(3.0) > 0.5 && ax < 0.56)) {
            if (is(3.0) > 0.5 && ax > 0.52) return vec4(uK1 * 0.95, 1.0);                 // punho dobrado
            if (p.y > 1.5 && is(1.0) > 0.5 && p.z > 0.0 && ax < 0.045) return vec4(0.0);    // colarinho aberto
            vec3 c = plaid(is(1.0) > 0.5 ? vec2(p.x + p.z, p.y) : vec2(p.x, p.y + p.z), uK1, uK2);
            if (is(1.0) > 0.5 && p.y < 1.47) {
              float sus = step(abs(ax - 0.085), 0.017);                                      // alças
              float bar = step(p.z, 0.2) * step(0.02, p.z) * step(abs(p.y - 1.24), 0.035) * step(ax, 0.1);   // peitilho
              if (sus + bar > 0.5) { vec3 l = leather(p, uK3); float st = step(0.85, fract((p.y + ax) * 60.0)) * 0.2; return vec4(l * (1.0 + st), 1.0); }
              if (p.y < 1.0) return vec4(leather(p, uK3), 1.0);                             // cós da calça
            }
            return vec4(c, 1.0);
          }
          if ((is(4.0) > 0.5 || is(5.0) > 0.5) && p.y > 0.56) {
            vec3 l = leather(p, uK3);
            if (p.y < 0.61 && p.y > 0.585) l *= 0.65;                                        // barra
            if (ax > 0.14 && abs(fract(p.y * 26.0) - 0.5) < 0.05 && p.y > 0.68 && p.y < 0.84) l = mix(l, vec3(0.32, 0.5, 0.32), 0.5);   // bordado lateral (verde)
            return vec4(l, 1.0);
          }
          if (is(6.0) > 0.5 && p.y < 0.43 && p.y > 0.1) {
            vec3 s = uK4 * (0.9 + 0.1 * step(0.5, fract(atan(p.z, p.x - sign(p.x) * 0.1) * 9.0)));   // canelado
            if (p.y > 0.395) s = mix(s, vec3(0.18, 0.36, 0.22), 0.8);                         // faixa verde do meião
            return vec4(s, 1.0);
          }
          if (is(7.0) > 0.5) return vec4(leather(p, uK3 * 0.55), 1.0);
          return vec4(0.0);
        }
        // ---- feminino: blusa branca (decote quadrado, manga bufante), corpete com amarração, saia (malha), sapato
        if (is(1.0) > 0.5) {
          if (p.z > 0.0 && p.y > 1.4 && ax < 0.115) return vec4(0.0);                        // decote
          if (p.y > 1.3) return vec4(uK3 * (0.96 + 0.04 * noise2(p.xy * 200.0)), 1.0);
          vec3 b = uK1 * (0.9 + 0.12 * noise2(p.xy * 60.0));
          if (p.y > 1.27) b = mix(b, uK4, 0.75);                                            // fita da borda
          if (p.z > 0.05 && ax < 0.03) { float zz = abs(fract(p.y * 22.0) - 0.5) * 2.0; if (abs(ax / 0.03 - zz) < 0.18) b = vec3(0.92, 0.85, 0.6); }   // cordão
          if (p.z > 0.05 && abs(ax - 0.032) < 0.004 && fract(p.y * 22.0) < 0.15) b = vec3(0.8, 0.75, 0.55);   // ilhós
          return vec4(b, 1.0);
        }
        if (is(2.0) > 0.5 && ax < 0.36) return vec4(uK3 * (0.95 + 0.05 * noise2(p.xy * 150.0)), 1.0);
        if (is(4.0) > 0.5 || (is(5.0) > 0.5 && p.y > 0.5)) return vec4(uK2, 1.0);
        if (is(7.0) > 0.5) return vec4(vec3(0.07), 1.0);
        return vec4(0.0);
      }
      ` + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float clothMask = 0.0;
      {
        float top = step(0.5, vTop), pants = step(0.5, vPants) * (1.0 - top), shoes = step(0.5, vShoes);
        float cloth = max(max(top, pants), shoes);
        float weave = 0.93 + 0.07 * hash(floor(vMapUv * 900.0));
        vec3 c = uTop * top + uPants * pants + uShoes * shoes * (1.0 - top - pants);
        if (uCostume > 0.5) { vec4 k = costume(vBind); c = k.rgb; cloth = k.a; weave = 0.97 + 0.03 * weave; }
        diffuseColor.rgb = mix(diffuseColor.rgb * uSkin, c * weave, cloth);
        clothMask = cloth;
      }`).replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(mix(normal, nonPerturbedNormal, 0.85 * clothMask));`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, uCostume > 0.5 && vPart > 3.5 && vPart < 5.5 && uCostume < 1.5 ? 0.62 : 0.9, clothMask);`);
  };
  mat.customProgramCacheKey = () => 'cloth2';
  return u;
}

/** Bytes de um modelo: tenta a cópia JSON base64 (hospedagem que só serve tipos comuns) e depois o arquivo. */
async function modelBytes(url) {
  try { const r = await fetch(url + '.b64.json'); if (r.ok) { const j = await r.json(); return Uint8Array.from(atob(j.base64), c => c.charCodeAt(0)).buffer; } } catch { /* sem cópia */ }
  const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status); return r.arrayBuffer();
}
const dirOf = url => url.slice(0, url.lastIndexOf('/') + 1);

/** Carrega corpos, cabelos e animações. Devolve a fábrica de pessoas. */
export async function loadHumans(base) {
  const L = new GLTFLoader(), dir = base + 'models/people/';
  const load = async url => L.parseAsync(await modelBytes(url), dirOf(url));
  const [male, female, anims, ...hairs] = await Promise.all([load(dir + 'male.glb'), load(dir + 'female.glb'), load(dir + 'anims.glb'),
    ...HAIRS.map(h => load(dir + 'hair_' + h + '.glb').catch(() => null))]);
  const clips = Object.fromEntries(anims.animations.map(c => [c.name, c]));
  // materiais com metalness 0: o mapa de metal não muda nada (só ocupa memória de vídeo e uma leitura de textura)
  for (const gl of [male, female, ...hairs]) gl?.scene.traverse(o => { const m = o.material; if (m && m.metalnessMap && m.metalness === 0) { m.metalnessMap.dispose(); m.metalnessMap = null; m.needsUpdate = true; } });
  const hairSrc = {}; HAIRS.forEach((h, i) => { let m = null; hairs[i]?.scene.traverse(o => { if (o.isSkinnedMesh) m = o; }); hairSrc[h] = m; });
  // altura do modelo (para escalar à altura de cada pessoa)
  const heightOf = g => { const b = new THREE.Box3().setFromObject(g.scene); return b.max.y - b.min.y; };
  const H = { m: heightOf(male), f: heightOf(female) };

  /**
   * look: { female, skin (hex), top, pants, shoes (hex), sleeve (0 regata, 1 curta, 2 comprida), puff (volume do tecido),
   *         shorts, hair ('buzzed'|...|null), hairColor, beard, height (m) }
   */
  function make(look) {
    const src = look.female ? female : male;
    const root = cloneSkinned(src.scene);
    let skeleton = null, body = null;
    root.traverse(o => {
      if (o.isSkinnedMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        o.material = o.material.clone();
        if (/Superhero/.test(o.material.name) || o.geometry.attributes.position.count > 5000) { body = o; skeleton = o.skeleton; }
        else if (/Hair/.test(o.material.name)) o.userData.brows = true;     // sobrancelhas: tingidas com a cor do cabelo
      }
    });
    const cloth = clothe(body.material);
    const bones = {}; for (const b of skeleton.bones) bones[b.name] = b;
    // cabelo / barba religados ao esqueleto deste corpo pelos nomes dos ossos
    const attach = (key, color) => {
      const s = hairSrc[key]; if (!s) return null;
      const m = s.clone(); m.material = s.material.clone(); m.material.color.setHex(color);
      const sk = new THREE.Skeleton(s.skeleton.bones.map(b => bones[b.name] || skeleton.bones[0]), s.skeleton.boneInverses);
      m.bind(sk, s.bindMatrix); m.castShadow = true; m.frustumCulled = false;
      root.add(m); return m;
    };
    const parts = {}, costumeParts = {};
    const mixer = new THREE.AnimationMixer(root), actions = setupActions(mixer, Object.values(clips));
    const person = {
      root, mixer, actions, bones, cloth, look: null, current: 'Idle_Loop', phase: 0,
      /** Troca a aparência (roupa, pele, cabelo, altura). */
      dress(l) {
        this.look = l;
        cloth.uTop.value.setHex(l.top); cloth.uPants.value.setHex(l.pants); cloth.uShoes.value.setHex(l.shoes);
        cloth.uSkin.value.setHex(l.skin ?? 0xffffff).multiplyScalar(1.35);   // textura base é morena: o ganho permite peles claras
        cloth.uSleeve.value = l.sleeve ?? 1; cloth.uPuff.value = l.puff ?? 0.014; cloth.uPuffP.value = l.puffP ?? 0.01; cloth.uShorts.value = l.shorts ? 1 : 0;
        for (const p of Object.values(parts)) if (p) p.visible = false;
        root.traverse(o => { if (o.userData.brows) o.material.color.setHex(l.hairColor ?? 0x3a2a1e); });
        for (const key of [l.hair, l.beard ? 'beard' : null]) {
          if (!key) continue;
          if (!(key in parts)) parts[key] = attach(key, l.hairColor ?? 0x3a2a1e);
          if (parts[key]) { parts[key].visible = true; parts[key].material.color.setHex(l.hairColor ?? 0x3a2a1e); }
        }
        // traje típico (Oktoberfest): pintura do shader + peças presas aos ossos (chapéu, saia)
        cloth.uCostume.value = l.costume === 'lederhosen' ? 1 : l.costume === 'dirndl' ? 2 : 0;
        if (l.k) [cloth.uK1, cloth.uK2, cloth.uK3, cloth.uK4].forEach((u, i) => u.value.setHex(l.k[i]));
        for (const [k, v] of Object.entries(costumeParts)) for (const h of v.userData.parts || []) h.visible = k === l.costume;
        if (l.costume && !costumeParts[l.costume]) costumeParts[l.costume] = buildCostume(l.costume, body, l);
        root.scale.setScalar((l.height || (l.female ? 1.66 : 1.76)) / H[l.female ? 'f' : 'm']);
        // corpo base é de super-herói: afina braços e coxas (escala só na largura; o eixo do osso é y)
        const k = l.slim ?? (l.female ? 0.95 : 0.88);
        for (const [n, f] of [['upperarm_l', 1], ['upperarm_r', 1], ['thigh_l', 0.5], ['thigh_r', 0.5]]) { const b = bones[n]; if (b) { const s = 1 - (1 - k) * f; b.scale.set(s, 1, s); } }
        // tórax e trapézio menos largos; pescoço/cabeça e braços devolvem a escala (sem afinar a cabeça)
        const c = 1 - (1 - k) * 0.9;
        if (bones.spine_03) bones.spine_03.scale.set(c, 1, c);
        for (const n of ['neck_01', 'clavicle_l', 'clavicle_r']) if (bones[n]) bones[n].scale.set(1 / c, 1, 1 / c);
        return this;
      },
      /** Escolhe a animação: s = { speed, mode ('idle'|'walk'|'run'|'sprint'), air (0..1), vy, sit, talk, formal } */
      play(dt, s) {
        playClips(this, dt, s);
        // corpo base é atlético: braços um pouco mais junto do corpo e ombros menos erguidos (por cima da animação)
        const arm = this.armsIn ?? 0.1;
        for (const [n, sgn] of [['upperarm_l', -1], ['upperarm_r', 1]]) { const b = bones[n]; if (b) b.rotateZ(sgn * arm); }
        for (const [n, sgn] of [['clavicle_l', -1], ['clavicle_r', 1]]) { const b = bones[n]; if (b) b.rotateZ(sgn * arm * 0.3); }
      },
    };
    return person.dress(look);
  }
  /**
   * Personagem de outro esqueleto (ex.: FBX enviado pelo diretor): carrega, troca o material para o da cena,
   * transfere as animações da biblioteca e devolve a mesma interface de make() (play, bones, root).
   */
  async function makeFromFBX(url, map, { height = 1.78, rough = 0.8 } = {}) {
    const obj = new FBXLoader().parse(await modelBytes(url), dirOf(url));
    obj.traverse(o => {
      if (!o.isMesh) return;
      const old = Array.isArray(o.material) ? o.material[0] : o.material;
      o.material = new THREE.MeshStandardMaterial({ map: old.map, color: 0xffffff, roughness: rough, metalness: 0 });
      if (old.map) { old.map.colorSpace = THREE.SRGBColorSpace; old.map.anisotropy = 4; }
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    });
    const box = new THREE.Box3().setFromObject(obj), h = box.max.y - box.min.y;
    const root = new THREE.Group(); root.add(obj); obj.scale.multiplyScalar(height / h); obj.position.y = -box.min.y * height / h;
    const src = anims.scene; src.updateMatrixWorld(true); root.updateMatrixWorld(true);
    const rt = retargetClips(src, Object.values(clips), obj, map);
    const bones = {}; obj.traverse(o => { if (o.isBone) bones[o.name] = o; });
    const mixer = new THREE.AnimationMixer(obj), actions = setupActions(mixer, rt);
    const person = { root, mixer, actions, bones, current: 'Idle_Loop', phase: 0, play: null };
    person.play = function (dt, s) { playClips(this, dt, s); };
    return person;
  }
  return { make, makeFromFBX, heights: H };
}

const LOCO = ['Walk_Loop', 'Walk_Formal_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop'];
/** Ações do mixer: todas tocando com peso 0; as de locomoção têm o tempo guiado à mão (fase comum). */
function setupActions(mixer, list) {
  const actions = {};
  for (const c of list) { const a = actions[c.name] = mixer.clipAction(c); a.setEffectiveWeight(c.name === 'Idle_Loop' ? 1 : 0); a.play(); if (LOCO.includes(c.name)) a.timeScale = 0; }
  for (const k of ['Jump_Start', 'Jump_Land', 'Interact']) if (actions[k]) { actions[k].setLoop(THREE.LoopOnce); actions[k].clampWhenFinished = true; }
  return actions;
}

/**
 * Escolha e mistura das animações (comum ao protagonista e aos pedestres).
 * Locomoção como espaço de mistura 1D pela velocidade: parado → andar (1,35 m/s) → trote (3,4) → corrida (6,2);
 * entre dois pontos os dois ciclos tocam juntos na mesma fase da passada (o pé não "pula" ao trocar de ritmo).
 * Sentar, pular e falar parado são estados próprios, com transição suave de peso.
 */
function playClips(p, dt, s) {
  const A = p.actions, tw = p._tw || (p._tw = {});
  for (const n in A) tw[n] = 0;
  let state = null;
  if (s.sit) state = s.talk ? 'Sitting_Talking_Loop' : 'Sitting_Idle_Loop';
  else if (s.air > 0.5) state = s.vy > 0.5 ? 'Jump_Start' : 'Jump_Loop';
  if (state && !A[state]) state = null;
  if (state) {
    if (p.current !== state && A[state].loop === THREE.LoopOnce) A[state].reset();
    tw[state] = 1; p.current = state;
  } else {
    const walk = s.formal && A.Walk_Formal_Loop ? 'Walk_Formal_Loop' : 'Walk_Loop';
    const idle = s.talk && A.Idle_Talking_Loop ? 'Idle_Talking_Loop' : 'Idle_Loop';
    const v = s.speed < 0.12 ? 0 : s.speed;
    const pts = [[idle, 0], [walk, NOMINAL[walk]], ['Jog_Fwd_Loop', NOMINAL.Jog_Fwd_Loop], ['Sprint_Loop', NOMINAL.Sprint_Loop]].filter(q => A[q[0]]);
    let i = 0; while (i < pts.length - 2 && v > pts[i + 1][1]) i++;
    const [na, va] = pts[i], [nb, vb] = pts[i + 1] || pts[i];
    const t = vb > va ? Math.max(0, Math.min(1, (v - va) / (vb - va))) : 1;
    tw[na] += 1 - t; tw[nb] += t;
    p.current = t < 0.5 ? na : nb;
  }
  // pesos seguem o alvo com suavização (no ar, mais rápido)
  const k = Math.min(1, dt * (s.air > 0.5 ? 14 : 7));
  for (const n in A) {
    const a = A[n], w = a.getEffectiveWeight(), t = tw[n];
    if (w === 0 && t === 0) continue;
    let nw = w + (t - w) * k; if (t === 0 && nw < 0.003) nw = 0;
    a.setEffectiveWeight(nw);
  }
  // fase única da passada: avança pela média ponderada dos ritmos dos ciclos ativos
  let num = 0, den = 0;
  for (const n of LOCO) {
    const a = A[n]; if (!a) continue; const w = a.getEffectiveWeight(); if (w <= 0) continue;
    const sc = Math.max(0.6, Math.min(1.6, (s.speed || 0.0001) / NOMINAL[n]));
    num += w * sc / a.getClip().duration; den += w;
  }
  if (den > 0) {
    p.phase = ((p.phase || 0) + dt * num / den) % 1;
    for (const n of LOCO) { const a = A[n]; if (a) a.time = p.phase * a.getClip().duration; }
  }
  p.mixer.update(dt);
}
