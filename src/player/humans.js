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

// índices dos ossos no esqueleto (mesma ordem nos dois corpos e na biblioteca de animações)
const B = { pelvis: 1, spine: [2, 3, 4], neck: 5, head: 6, clav: [7, 31], upper: [8, 32], lower: [9, 33], thigh: [55, 60], calf: [56, 61], foot: [57, 58, 59, 62, 63, 64] };
const HAIRS = ['buzzed', 'simpleparted', 'long', 'buns', 'buzzedfemale', 'beard'];
// velocidade (m/s) em que cada ciclo foi gravado (passada casa com o chão)
const NOMINAL = { Walk_Loop: 1.35, Walk_Formal_Loop: 1.15, Jog_Fwd_Loop: 3.4, Sprint_Loop: 6.2 };

/** Shader de roupa por osso dominante. Uniforms por pessoa (cores, mangas, volume). */
function clothe(mat) {
  const u = {
    uTop: { value: new THREE.Color(0x2a3550) }, uPants: { value: new THREE.Color(0x2f4a6e) }, uShoes: { value: new THREE.Color(0xf2f2f2) },
    uSkin: { value: new THREE.Color(1, 1, 1) }, uSleeve: { value: 1 }, uPuff: { value: 0.012 }, uShorts: { value: 0 }, uSkirt: { value: 0 },
  };
  mat.userData.cloth = u;
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = `uniform float uSleeve; uniform float uPuff; uniform float uShorts; uniform float uSkirt;
      varying float vTop; varying float vPants; varying float vShoes;
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
      }`).replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed += normal * (vTop * uPuff + vPants * 0.006 + vShoes * 0.01);`);
    sh.fragmentShader = `uniform vec3 uTop; uniform vec3 uPants; uniform vec3 uShoes; uniform vec3 uSkin;
      varying float vTop; varying float vPants; varying float vShoes;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      ` + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      {
        float top = step(0.5, vTop), pants = step(0.5, vPants) * (1.0 - top), shoes = step(0.5, vShoes);
        float cloth = max(max(top, pants), shoes);
        float weave = 0.93 + 0.07 * hash(floor(vMapUv * 900.0));
        vec3 c = uTop * top + uPants * pants + uShoes * shoes * (1.0 - top - pants);
        diffuseColor.rgb = mix(diffuseColor.rgb * uSkin, c * weave, cloth);
      }`).replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(mix(normal, nonPerturbedNormal, 0.85 * step(0.5, max(max(vTop, vPants), vShoes))));`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.9, step(0.5, max(max(vTop, vPants), vShoes)));`);
  };
  mat.customProgramCacheKey = () => 'cloth1';
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
    const parts = {};
    const mixer = new THREE.AnimationMixer(root), actions = {};
    for (const [k, c] of Object.entries(clips)) { actions[k] = mixer.clipAction(c); actions[k].setEffectiveWeight(0); actions[k].play(); }
    for (const k of ['Jump_Start', 'Jump_Land', 'Interact']) if (actions[k]) { actions[k].setLoop(THREE.LoopOnce); actions[k].clampWhenFinished = true; }
    const person = {
      root, mixer, actions, bones, cloth, look: null, current: 'Idle_Loop', weights: {},
      /** Troca a aparência (roupa, pele, cabelo, altura). */
      dress(l) {
        this.look = l;
        cloth.uTop.value.setHex(l.top); cloth.uPants.value.setHex(l.pants); cloth.uShoes.value.setHex(l.shoes);
        cloth.uSkin.value.setHex(l.skin ?? 0xffffff).multiplyScalar(1.35);   // textura base é morena: o ganho permite peles claras cloth.uSleeve.value = l.sleeve ?? 1; cloth.uPuff.value = l.puff ?? 0.01; cloth.uShorts.value = l.shorts ? 1 : 0;
        for (const p of Object.values(parts)) if (p) p.visible = false;
        root.traverse(o => { if (o.userData.brows) o.material.color.setHex(l.hairColor ?? 0x3a2a1e); });
        for (const key of [l.hair, l.beard ? 'beard' : null]) {
          if (!key) continue;
          if (!(key in parts)) parts[key] = attach(key, l.hairColor ?? 0x3a2a1e);
          if (parts[key]) { parts[key].visible = true; parts[key].material.color.setHex(l.hairColor ?? 0x3a2a1e); }
        }
        root.scale.setScalar((l.height || (l.female ? 1.66 : 1.76)) / H[l.female ? 'f' : 'm']);
        return this;
      },
      /** Escolhe a animação: s = { speed, mode ('idle'|'walk'|'run'|'sprint'), air (0..1), vy, sit, talk, formal } */
      play(dt, s) {
        let want = 'Idle_Loop';
        if (s.sit) want = s.talk ? 'Sitting_Talking_Loop' : 'Sitting_Idle_Loop';
        else if (s.air > 0.5) want = s.vy > 0.5 ? 'Jump_Start' : 'Jump_Loop';
        else if (s.speed > 4.8 || s.mode === 'sprint') want = 'Sprint_Loop';
        else if (s.speed > 2.4) want = 'Jog_Fwd_Loop';
        else if (s.speed > 0.15) want = s.formal ? 'Walk_Formal_Loop' : 'Walk_Loop';
        else if (s.talk) want = 'Idle_Talking_Loop';
        if (!actions[want]) want = 'Idle_Loop';
        if (want !== this.current) { if (actions[want].loop === THREE.LoopOnce) actions[want].reset(); this.current = want; }
        const k = Math.min(1, dt * (s.air > 0.5 ? 14 : 8));
        for (const [name, a] of Object.entries(actions)) {
          const w = a.getEffectiveWeight(), t = name === this.current ? 1 : 0;
          if (w === 0 && t === 0) continue;
          a.setEffectiveWeight(w + (t - w) * k);
          if (NOMINAL[name]) a.timeScale = Math.max(0.6, Math.min(1.6, s.speed / NOMINAL[name]));
        }
        mixer.update(dt);
        // corpo base é atlético: braços um pouco mais junto do corpo e ombros menos erguidos (por cima da animação)
        const arm = this.armsIn ?? 0.22;
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
    const mixer = new THREE.AnimationMixer(obj), actions = {};
    for (const c of rt) { actions[c.name] = mixer.clipAction(c); actions[c.name].setEffectiveWeight(0); actions[c.name].play(); }
    for (const k of ['Jump_Start', 'Jump_Land', 'Interact']) if (actions[k]) { actions[k].setLoop(THREE.LoopOnce); actions[k].clampWhenFinished = true; }
    const person = { root, mixer, actions, bones, current: 'Idle_Loop', play: null };
    person.play = function (dt, s) { playClips(this, dt, s); };
    return person;
  }
  return { make, makeFromFBX, heights: H };
}

/** Escolha e mistura das animações (comum a todos os personagens). */
function playClips(p, dt, s) {
  const actions = p.actions;
  let want = 'Idle_Loop';
  if (s.sit) want = s.talk ? 'Sitting_Talking_Loop' : 'Sitting_Idle_Loop';
  else if (s.air > 0.5) want = s.vy > 0.5 ? 'Jump_Start' : 'Jump_Loop';
  else if (s.speed > 4.8 || s.mode === 'sprint') want = 'Sprint_Loop';
  else if (s.speed > 2.4) want = 'Jog_Fwd_Loop';
  else if (s.speed > 0.15) want = s.formal ? 'Walk_Formal_Loop' : 'Walk_Loop';
  else if (s.talk) want = 'Idle_Talking_Loop';
  if (!actions[want]) want = 'Idle_Loop';
  if (want !== p.current) { if (actions[want].loop === THREE.LoopOnce) actions[want].reset(); p.current = want; }
  const k = Math.min(1, dt * (s.air > 0.5 ? 14 : 8));
  for (const [name, a] of Object.entries(actions)) {
    const w = a.getEffectiveWeight(), t = name === p.current ? 1 : 0;
    if (w === 0 && t === 0) continue;
    a.setEffectiveWeight(w + (t - w) * k);
    if (NOMINAL[name]) a.timeScale = Math.max(0.6, Math.min(1.6, s.speed / NOMINAL[name]));
  }
  p.mixer.update(dt);
}
