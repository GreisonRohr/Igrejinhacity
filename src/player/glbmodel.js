// Modelo 3D realista opcional do protagonista: se existir public/models/protagonista.glb
// (com esqueleto e animações, ex.: exportado do Blender, Character Creator ou Mixamo),
// ele substitui o personagem procedural. Nomes das animações reconhecidos (sem diferenciar maiúsculas):
//   idle/parado, walk/andar, run/correr, sprint, jump/pular.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const MATCH = { idle: /idle|parad/i, walk: /walk|andar/i, run: /run|corr/i, sprint: /sprint/i, jump: /jump|pul/i };
const NOMINAL = { walk: 1.4, run: 4.5, sprint: 7.5 };       // velocidade (m/s) em que cada animação foi gravada

export async function tryLoadGLB(url, height = 1.8) {
  try {
    const head = await fetch(url, { method: 'HEAD' });
    if (!head.ok || !/model|octet|gltf/.test(head.headers.get('content-type') || 'model')) return null;
    const gltf = await new GLTFLoader().loadAsync(url);
    const model = gltf.scene;
    // escala para a altura desejada e pés no chão
    const box = new THREE.Box3().setFromObject(model), h = box.max.y - box.min.y;
    model.scale.setScalar(height / h);
    model.position.y = -box.min.y * height / h;
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const mixer = new THREE.AnimationMixer(model), actions = {};
    for (const [k, re] of Object.entries(MATCH)) {
      const clip = gltf.animations.find(c => re.test(c.name));
      if (clip) { actions[k] = mixer.clipAction(clip); actions[k].play(); actions[k].setEffectiveWeight(0); }
    }
    if (actions.jump) { actions.jump.setLoop(THREE.LoopOnce); actions.jump.clampWhenFinished = true; }
    let current = null;
    const set = (k) => { if (!actions[k]) k = k === 'sprint' ? 'run' : k === 'run' ? 'walk' : 'idle'; return k; };
    return {
      model,
      animate(dt, speed, mode, air) {
        let want = air > 0.5 && actions.jump ? 'jump' : set(speed < 0.15 ? 'idle' : mode === 'sprint' ? 'sprint' : mode === 'run' ? 'run' : 'walk');
        if (!actions[want]) want = Object.keys(actions)[0];
        if (want !== current) {
          if (want === 'jump') actions.jump.reset();
          current = want;
        }
        for (const [k, a] of Object.entries(actions)) {
          const w = a.getEffectiveWeight(), target = k === current ? 1 : 0;
          a.setEffectiveWeight(w + (target - w) * Math.min(1, dt * 8));   // transição suave
          if (NOMINAL[k]) a.timeScale = Math.max(0.5, speed / NOMINAL[k]);  // casa o passo com a velocidade
        }
        mixer.update(dt);
      },
    };
  } catch (e) { console.warn('modelo .glb não carregado:', e.message); return null; }
}
