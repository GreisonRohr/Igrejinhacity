// Transfere animações entre esqueletos diferentes (ex.: biblioteca Quaternius → modelo enviado pelo diretor).
// Método: para cada osso mapeado, a direção do osso (dele até o filho) segue a direção do osso de origem no mundo.
// Funciona mesmo com poses de descanso diferentes (T-pose × braços para baixo), pois alinha as direções de descanso.
import * as THREE from 'three';

/** map: { nomeOrigem: nomeDestino }; chain: pares [osso, filho] (nomes de origem) que definem a direção de cada osso. */
export function retargetClips(srcRoot, clips, tgtRoot, map, { fps = 30, hips = ['pelvis'] } = {}) {
  const findBone = (root, name) => { let r = null; root.traverse(o => { if (!r && o.name === name) r = o; }); return r; };
  const S = {}, T = {};
  for (const [s, t] of Object.entries(map)) { S[s] = findBone(srcRoot, s); T[s] = findBone(tgtRoot, t); if (!S[s] || !T[s]) delete S[s], delete T[s]; }
  const names = Object.keys(S);
  // filho mapeado de cada osso (primeiro descendente mapeado)
  const child = {};
  for (const n of names) { let c = null; S[n].traverse(o => { if (!c && o !== S[n] && names.includes(o.name)) c = o.name; }); child[n] = c; }
  // posições/rotações de descanso
  srcRoot.updateMatrixWorld(true); tgtRoot.updateMatrixWorld(true);
  const wq = o => o.getWorldQuaternion(new THREE.Quaternion()), wp = o => o.getWorldPosition(new THREE.Vector3());
  // frente: alinha o eixo esquerda→direita da origem ao do destino (giro em Y)
  const lr = (B, l, r) => wp(B[r]).sub(wp(B[l])).setY(0).normalize();
  const yaw = new THREE.Quaternion();
  if (S.thigh_l && S.thigh_r) yaw.setFromUnitVectors(lr(S, 'thigh_l', 'thigh_r'), lr(T, 'thigh_l', 'thigh_r'));
  const srcRest = {}, tgtRest = {}, align = {};
  for (const n of names) { srcRest[n] = yaw.clone().multiply(wq(S[n])); tgtRest[n] = wq(T[n]); }
  for (const n of names) {
    if (!child[n]) continue;
    const ds = wp(S[child[n]]).sub(wp(S[n])).applyQuaternion(yaw).normalize(), dt = wp(T[child[n]]).sub(wp(T[n])).normalize();
    align[n] = new THREE.Quaternion().setFromUnitVectors(ds, dt);
  }
  // ossos sem filho mapeado usam o alinhamento do pai mapeado
  for (const n of names) if (!align[n]) { let p = S[n].parent; while (p && !align[p.name]) p = p.parent; align[n] = p ? align[p.name].clone() : new THREE.Quaternion(); }
  const alignInv = Object.fromEntries(names.map(n => [n, align[n].clone().invert()]));
  const hipS = hips.find(h => S[h]), hipRestS = hipS && wp(S[hipS]).applyQuaternion(yaw), hipRestT = hipS && wp(T[hipS]);
  const ratio = hipS ? hipRestT.y / Math.max(1e-6, hipRestS.y) : 1;
  // ordem de cima para baixo (pai antes do filho) para calcular rotações locais
  const order = names.slice().sort((a, b) => depth(T[a]) - depth(T[b]));

  const mixer = new THREE.AnimationMixer(srcRoot), out = [];
  const tmpQ = new THREE.Quaternion(), pw = new THREE.Quaternion();
  for (const clip of clips) {
    const action = mixer.clipAction(clip); action.play();
    const n = Math.max(2, Math.ceil(clip.duration * fps) + 1), times = new Float32Array(n);
    const vals = Object.fromEntries(order.map(b => [b, new Float32Array(n * 4)])), hipVals = new Float32Array(n * 3);
    // guarda as rotações locais do destino para restaurar depois
    const saved = order.map(b => [T[b].quaternion.clone(), T[b].position.clone()]);
    for (let i = 0; i < n; i++) {
      const t = Math.min(clip.duration, i / fps); times[i] = t;
      mixer.setTime(t); srcRoot.updateMatrixWorld(true);
      for (const b of order) {
        // rotação no mundo desejada: delta da origem (com o giro de frente) aplicado ao descanso do destino
        const D = yaw.clone().multiply(wq(S[b])).multiply(srcRest[b].clone().invert());
        const want = D.multiply(alignInv[b]).multiply(tgtRest[b]);   // direção do osso = direção da origem
        T[b].parent.getWorldQuaternion(pw);
        tmpQ.copy(pw).invert().multiply(want);
        T[b].quaternion.copy(tmpQ); T[b].updateMatrixWorld(true);
        tmpQ.toArray(vals[b], i * 4);
      }
      if (hipS) {
        const p = wp(S[hipS]).applyQuaternion(yaw).sub(hipRestS).multiplyScalar(ratio).add(hipRestT);
        T[hipS].parent.worldToLocal(p); p.toArray(hipVals, i * 3);
      }
    }
    order.forEach((b, i) => { T[b].quaternion.copy(saved[i][0]); T[b].position.copy(saved[i][1]); });
    action.stop(); mixer.uncacheAction(clip);
    const tracks = order.map(b => new THREE.QuaternionKeyframeTrack(T[b].name + '.quaternion', times, vals[b]));
    if (hipS) tracks.push(new THREE.VectorKeyframeTrack(T[hipS].name + '.position', times, hipVals));
    out.push(new THREE.AnimationClip(clip.name, clip.duration, tracks));
  }
  tgtRoot.updateMatrixWorld(true);
  return out;
}
const depth = o => { let d = 0; while (o.parent) { d++; o = o.parent; } return d; };

/** Mapa da biblioteca Quaternius (UAL) para o "male_casual" enviado pelo diretor. */
export const MAP_MALE_CASUAL = {
  pelvis: 'pelvis', spine_01: 'spine', spine_03: 'chest', neck_01: 'neck', Head: 'head',
  clavicle_l: 'shoulder_left', upperarm_l: 'upper_arm_left', lowerarm_l: 'forearm_left', hand_l: 'hand_left',
  clavicle_r: 'shoulder_right', upperarm_r: 'upper_arm_right', lowerarm_r: 'forearm_right', hand_r: 'hand_right',
  thigh_l: 'thigh_left', calf_l: 'shinL', foot_l: 'foot_left', thigh_r: 'thigh_right', calf_r: 'shinR', foot_r: 'foot_right',
};
/** Mapa para a "female_secretary". */
export const MAP_SECRETARY = {
  pelvis: 'hips', spine_01: 'spine', spine_03: 'chest', neck_01: 'neck', Head: 'head',
  clavicle_l: 'shoulderL', upperarm_l: 'upper_armL', lowerarm_l: 'forearmL', hand_l: 'handL',
  clavicle_r: 'shoulderR', upperarm_r: 'upper_armR', lowerarm_r: 'forearmR', hand_r: 'handR',
  thigh_l: 'thighL', calf_l: 'shinL', foot_l: 'footL', ball_l: 'toeL', thigh_r: 'thighR', calf_r: 'shinR', foot_r: 'footR', ball_r: 'toeR',
};
