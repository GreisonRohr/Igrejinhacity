// Converte data/raw/osm.json em public/data/world.json (metros locais, x = leste, z = sul).
import fs from 'node:fs';
import { toXZ } from '../src/geo.js';
import { LANDMARKS } from '../src/landmarks.js';
import { generateBuildings, loadTerrain } from './gen-buildings.mjs';

const raw = JSON.parse(fs.readFileSync('data/raw/osm.json'));
const r1 = v => Math.round(v * 10) / 10;
const pts = g => g.map(p => toXZ(p.lat, p.lon).map(r1));

// largura total da pista (m) por tipo de via
const ROAD_W = {
  motorway: 12, trunk: 11, primary: 10, primary_link: 7, secondary: 8.5, secondary_link: 6.5,
  tertiary: 7.5, tertiary_link: 6, residential: 6.5, unclassified: 6, living_street: 5, service: 4,
  track: 3.5, construction: 6, pedestrian: 5, footway: 2, path: 1.6, cycleway: 2, steps: 2,
};
const MAIN = /Castelo Branco/i;

const roads = [], water = [], areas = [], buildings = [], pois = [], places = [];
// lugares com ícone no minimapa e placa (escolas, bancos, postos, farmácias, saúde, cascatas…)
const CAT = t => /school|kindergarten|college/.test(t.amenity) ? 'escola' : t.amenity === 'bank' ? 'banco' : t.amenity === 'fuel' ? 'posto'
  : t.amenity === 'pharmacy' || t.healthcare === 'pharmacy' ? 'farmacia' : /hospital|clinic/.test(t.amenity) ? 'saude'
  : t.waterway === 'waterfall' ? 'cascata' : t.amenity === 'community_centre' ? 'social' : t.shop && t.name ? 'loja' : null;
const center = e => e.lat ? [e.lat, e.lon] : [e.geometry.reduce((s, q) => s + q.lat, 0) / e.geometry.length, e.geometry.reduce((s, q) => s + q.lon, 0) / e.geometry.length];
for (const e of raw.elements) {
  const t = e.tags || {}, k = CAT(t);
  if (!k || (e.type === 'way' && !e.geometry?.length) || e.type === 'relation') continue;
  const [x, z] = toXZ(...center(e)).map(r1);
  const nome = t.name || { posto: 'Posto de combustível', banco: 'Banco', escola: 'Escola', farmacia: 'Farmácia' }[k];
  if (!places.some(p => p.n === nome && Math.hypot(p.x - x, p.z - z) < 60)) places.push({ x, z, k, n: nome });
}

function areaKind(t) {
  if (t.natural === 'water' || t.water || t.waterway === 'riverbank') return 'water';
  if (t.leisure === 'park' || t.leisure === 'garden') return 'park';
  if (t.leisure === 'pitch' || t.leisure === 'stadium' || t.leisure === 'sports_centre') return 'pitch';
  if (t.leisure === 'swimming_pool') return 'pool';
  if (t.natural === 'wood' || t.landuse === 'forest') return 'forest';
  if (t.landuse === 'grass' || t.landuse === 'meadow' || t.landuse === 'cemetery') return t.landuse === 'cemetery' ? 'cemetery' : 'grass';
  if (t.landuse) return t.landuse;                  // residential, industrial, retail, quarry…
  if (t.amenity === 'parking') return 'parking';
  return null;
}

function buildingInfo(e) {
  const t = e.tags;
  let lv = parseFloat(t['building:levels']);
  let h = parseFloat(t.height);
  const kind = t.building === 'yes' ? (t.amenity || t.shop ? 'commercial' : 'house') : t.building;
  if (!(lv > 0)) {
    // sem tag: casas com 1–2 andares, comércio 2–3, galpões 1 andar alto (estável pelo id)
    const rnd = ((e.id * 2654435761) >>> 0) / 4294967296;
    lv = /industrial|warehouse|shed|garage|roof/.test(kind) ? 1
      : /commercial|retail|office|apartments|hotel/.test(kind) ? 2 + (rnd < 0.4 ? 1 : 0)
      : /church|chapel/.test(kind) ? 2 : 1 + (rnd < 0.35 ? 1 : 0) + (rnd < 0.06 ? 1 : 0);
  }
  if (!(h > 0)) h = /industrial|warehouse/.test(kind) ? 8 : lv * 3.1 + 0.4;
  return { kind, lv, h: r1(h) };
}

const ringArea = p => { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return a / 2; };

for (const e of raw.elements) {
  const t = e.tags || {};
  if (e.type === 'node') {
    if (t.name || t.highway === 'street_lamp') pois.push({ x: r1(toXZ(e.lat, e.lon)[0]), z: r1(toXZ(e.lat, e.lon)[1]), k: t.amenity || t.shop || t.tourism || t.highway, n: t.name });
    continue;
  }
  if (e.type === 'way') {
    if (!e.geometry || e.geometry.length < 2) continue;
    const p = pts(e.geometry);
    const closed = e.geometry.length > 3 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1];
    if (t.building) {
      if (!closed) continue;
      p.pop();
      if (ringArea(p) < 0) p.reverse();             // todos no mesmo sentido
      buildings.push({ id: e.id, p, ...buildingInfo(e), n: t.name });
    } else if (t.highway && ROAD_W[t.highway] !== undefined && !(t.area === 'yes')) {
      roads.push({ id: e.id, p, k: t.highway, w: ROAD_W[t.highway], n: t.name, main: MAIN.test(t.name || '') || undefined,
        br: t.bridge && t.bridge !== 'no' ? 1 : undefined, ow: t.oneway === 'yes' ? 1 : undefined, sf: t.surface });
    } else if (t.waterway && !closed) {
      water.push({ p, k: t.waterway, w: t.waterway === 'river' ? 22 : t.waterway === 'stream' ? 3 : 2, n: t.name });
    } else if (closed) {
      const k = areaKind(t);
      if (k) { p.pop(); areas.push({ p, k, n: t.name }); }
    }
  } else if (e.type === 'relation') {
    const k = t.building ? null : areaKind(t);
    if (!k && !t.waterway) continue;
    // junta os membros "outer" em anéis
    const segs = e.members.filter(m => m.role !== 'inner' && m.geometry?.length > 1).map(m => pts(m.geometry));
    if (t.waterway) { for (const s of segs) water.push({ p: s, k: t.waterway, w: t.waterway === 'river' ? 22 : 3, n: t.name }); continue; }
    const key = q => q[0] + ',' + q[1];
    while (segs.length) {
      let ring = segs.shift();
      for (let guard = 0; guard < 500 && key(ring[0]) !== key(ring[ring.length - 1]); guard++) {
        const end = key(ring[ring.length - 1]);
        const i = segs.findIndex(s => key(s[0]) === end || key(s[s.length - 1]) === end);
        if (i < 0) break;
        let s = segs.splice(i, 1)[0]; if (key(s[0]) !== end) s = s.reverse();
        ring = ring.concat(s.slice(1));
      }
      if (ring.length > 3) { ring.pop(); areas.push({ p: ring, k, n: t.name }); }
    }
  }
}

// estatísticas para conferência
const named = n => roads.filter(r => r.n && r.n.includes(n)).reduce((s, r) => s + r.p.slice(1).reduce((a, q, i) => a + Math.hypot(q[0] - r.p[i][0], q[1] - r.p[i][1]), 0), 0);
const world = { fonte: raw.fonte, baixado: raw.baixado, roads, water, areas, buildings, pois, places };
// casas geradas: [x, z, y, largura, profundidade, rotação, altura, tipo(h casa | c comércio | i indústria)]
const t0 = Date.now();
// Por decisão do projeto, só prédios reais do OSM. O gerador fica disponível com --gerar-casas.
world.gen = process.argv.includes('--gerar-casas') ? generateBuildings(world, LANDMARKS, loadTerrain()) : [];
console.log('geradas', world.gen.length, 'construções em', Date.now() - t0, 'ms');
fs.writeFileSync('public/data/world.json', JSON.stringify(world));
console.log({ roads: roads.length, water: water.length, areas: areas.length, buildings: buildings.length, pois: pois.length, places: places.length, geradas: world.gen.length,
  kmCasteloBranco: (named('Castelo Branco') / 1000).toFixed(2), kmRios: (water.filter(w => w.k === 'river').reduce((s, w) => s + w.p.length, 0)),
  tamanhoKB: Math.round(fs.statSync('public/data/world.json').size / 1024) });
