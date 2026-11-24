// Trajes típicos da Oktoberfest de Igrejinha para os personagens jogáveis (sobre o corpo CC0 da Quaternius).
// A parte justa (camisa xadrez, lederhosen, suspensórios, meião, blusa, corpete) é pintada pelo shader de roupa
// (humans.js, uCostume); aqui ficam as peças com volume próprio, presas aos ossos: chapéu tirolês (cabeça) e saia
// rodada com avental e laço (pelve). Medidas em metros na pose de referência do corpo (y para cima, z para a frente).
import * as THREE from 'three';

export const PERSONAGENS = {
  m: {
    nome: 'Lukas', desc: 'Camisa xadrez, lederhosen de couro, chapéu tirolês',
    look: { female: false, skin: 0xf3cdb0, hair: 'buzzed', hairColor: 0x3b2a1c, beard: true, height: 1.80, slim: 0.9,
      costume: 'lederhosen', k: [0xf2efe6, 0x2f5f9e, 0x5a3a22, 0xe9e1d0], top: 0, pants: 0, shoes: 0 },
  },
  f: {
    nome: 'Anna', desc: 'Dirndl com blusa branca, corpete e avental',
    look: { female: true, skin: 0xf6d3bb, hair: 'buns', hairColor: 0x6b4a2a, height: 1.68, slim: 0.95,
      costume: 'dirndl', k: [0x1e4d3c, 0x7c1f2c, 0xf6f3ec, 0xe8b7c4], top: 0, pants: 0, shoes: 0 },
  },
};

const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

/** Chapéu tirolês de feltro: copa afunilada com vinco, aba virada atrás, cordão e pena. Origem = base da copa. */
function hatGeometry() {
  const felt = new THREE.MeshStandardMaterial({ color: 0x2e3d2c, roughness: 0.95 });
  const cord = new THREE.MeshStandardMaterial({ color: 0x9e2a22, roughness: 0.7 });
  const feather = new THREE.MeshStandardMaterial({ color: 0x3b4a3a, roughness: 0.8, side: THREE.DoubleSide });
  const g = new THREE.Group();
  const crown = lathe([[0.001, 0.125], [0.05, 0.123], [0.075, 0.11], [0.088, 0.07], [0.098, 0.02], [0.102, 0]], 24);
  { const p = crown.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i); const a = Math.atan2(z, x);
    p.setZ(i, z * 1.12); if (y > 0.1) p.setY(i, y - 0.018 * Math.max(0, Math.cos(a - Math.PI / 2)) * (y - 0.1) / 0.025); } crown.computeVertexNormals(); }
  const brim = lathe([[0.1, 0.004], [0.13, 0.002], [0.165, 0.012], [0.17, 0.02], [0.166, 0.016], [0.13, -0.004], [0.1, -0.004]], 32);
  { const p = brim.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z), a = Math.atan2(z, x);
    p.setZ(i, z * 1.12); p.setY(i, p.getY(i) + Math.max(0, r - 0.11) * (Math.max(0, -Math.sin(a)) * 0.9 + 0.25)); } brim.computeVertexNormals(); }
  const band = new THREE.TorusGeometry(0.1, 0.008, 6, 32); band.rotateX(Math.PI / 2); band.scale(1, 1, 1.12); band.translate(0, 0.012, 0);
  const fShape = new THREE.Shape(); fShape.moveTo(0, 0); fShape.quadraticCurveTo(0.02, 0.06, 0.004, 0.13); fShape.quadraticCurveTo(-0.012, 0.06, 0, 0);
  const fGeo = new THREE.ShapeGeometry(fShape, 6); fGeo.rotateZ(-0.5); fGeo.rotateY(Math.PI / 2); fGeo.translate(-0.095, 0.02, -0.03);
  g.add(new THREE.Mesh(crown, felt), new THREE.Mesh(brim, felt), new THREE.Mesh(band, cord), new THREE.Mesh(fGeo, feather));
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Saia rodada franzida (do corpete até a canela), avental e laço. Origem = cintura. */
function skirtGeometry(colSkirt, colApron) {
  const g = new THREE.Group();
  const H = 0.62, seg = 48;
  const prof = []; for (let i = 0; i <= 10; i++) { const t = i / 10; prof.push([0.135 + 0.2 * Math.pow(t, 0.75) + 0.02 * t * t, -H * t]); }
  const mk = (pts, a0, a1, push = 0, folds = 1) => {
    const geo = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r + push, y)), seg, a0, a1 - a0);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = p.getY(i), a = Math.atan2(x, z), d = -y / H;
      const k = 1 + folds * 0.06 * d * Math.sin(a * 16);                 // pregas que abrem para baixo
      p.setX(i, x * k * 1.08); p.setZ(i, z * k * 0.92 + 0.012);
    }
    geo.computeVertexNormals(); return geo;
  };
  const skirt = new THREE.Mesh(mk(prof, 0, Math.PI * 2), new THREE.MeshStandardMaterial({ color: colSkirt, roughness: 0.85, side: THREE.DoubleSide }));
  // avental: frente, um pouco mais curto e por cima
  const apronProf = prof.slice(0, 10).map(([r, y]) => [r, y * 0.93]);
  const apron = new THREE.Mesh(mk(apronProf, -0.62, 0.62, 0.012, 0.4), new THREE.MeshStandardMaterial({ color: colApron, roughness: 0.8, side: THREE.DoubleSide }));
  // cós e laço (do lado esquerdo, como de costume)
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.012, 6, 40).rotateX(Math.PI / 2).scale(1.08, 1, 0.92).translate(0, -0.005, 0.012), apron.material);
  const bow = new THREE.Group();
  for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.009, 6, 14).scale(1, 0.6, 0.5), apron.material); l.position.set(s * 0.032, 0, 0); l.rotation.z = s * 0.4; bow.add(l); }
  for (const s of [-1, 1]) { const tail = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.16, 0.006), apron.material); tail.position.set(s * 0.018, -0.085, 0); tail.rotation.z = s * 0.12; bow.add(tail); }
  bow.position.set(0.1, -0.005, 0.12); bow.rotation.y = 0.75;
  g.add(skirt, apron, belt, bow);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Prende `obj` (em coordenadas da pose de referência do corpo) a um osso, pela matriz inversa de ligação. */
function bindTo(obj, skeleton, boneName, at) {
  const i = skeleton.bones.findIndex(b => b.name === boneName); if (i < 0) return null;
  const holder = new THREE.Group(); holder.matrixAutoUpdate = false;
  holder.matrix.copy(skeleton.boneInverses[i]).multiply(new THREE.Matrix4().makeTranslation(at[0], at[1], at[2]));
  holder.add(obj); skeleton.bones[i].add(holder); return holder;
}

/** Peças do traje para o corpo `body` (SkinnedMesh). Devolve o nó a mostrar/esconder. */
export function buildCostume(kind, body, look) {
  const sk = body.skeleton, pos = body.geometry.attributes.position;
  let top = 0; for (let i = 0; i < pos.count; i++) top = Math.max(top, pos.getY(i));
  const root = new THREE.Group(); root.name = 'traje_' + kind;
  if (kind === 'lederhosen') {
    const hat = hatGeometry(); hat.scale.setScalar(1.02);
    const h = bindTo(hat, sk, 'Head', [0, top - 0.06, -0.012]); if (h) root.userData.parts = [h];
  } else if (kind === 'dirndl') {
    const sk2 = skirtGeometry(look.k?.[1] ?? 0x7c1f2c, look.k?.[3] ?? 0xe8b7c4);
    const h = bindTo(sk2, sk, 'pelvis', [0, 1.0, 0]); if (h) root.userData.parts = [h];
  }
  return root;
}
