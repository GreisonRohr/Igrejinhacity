// Baixa ruas, rio, quadras e prédios do OpenStreetMap para data/raw/osm.json.
// 1º tenta a Overpass API; se não responder, usa a API oficial do OSM (/api/0.6/map) em blocos
// e converte para o mesmo formato ("out geom" da Overpass).
// Uso: node scripts/fetch-osm.mjs   (Node 18+; atrás de proxy: NODE_USE_ENV_PROXY=1)
import fs from 'node:fs'; import { BBOX } from '../src/geo.js';

const UA = { 'User-Agent': 'igrejinha-city-game/1.0 (open source game data build)' };
const KEEP = ['highway', 'waterway', 'natural', 'water', 'building', 'landuse', 'leisure', 'amenity'];
fs.mkdirSync('data/raw', { recursive: true });
const save = (elements, fonte) => {
  fs.writeFileSync('data/raw/osm.json', JSON.stringify({ fonte, baixado: new Date().toISOString(), elements }));
  console.log('ok:', elements.length, 'elementos (' + fonte + ') → data/raw/osm.json');
};

async function viaOverpass() {
  const b = `${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}`;
  const q = `[out:json][timeout:180];
(
  way["highway"](${b}); way["waterway"](${b}); relation["waterway"](${b}); way["natural"="water"](${b});
  way["building"](${b}); relation["building"](${b}); way["landuse"](${b});
  way["leisure"~"park|pitch|playground|garden"](${b}); way["amenity"~"place_of_worship|parking|townhall"](${b});
  relation["natural"="water"](${b}); relation["landuse"](${b});
);
out body geom;`;
  for (const url of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter']) {
    try {
      console.log('Overpass:', url);
      const r = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: q }), headers: UA, signal: AbortSignal.timeout(120000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return (await r.json()).elements;
    } catch (e) { console.warn('  falhou:', e.message); }
  }
  return null;
}

async function viaOsmApi() {
  const nodes = new Map(), ways = new Map(), rels = new Map();
  async function tile(w, s, e, n, depth = 0) {
    const url = `https://api.openstreetmap.org/api/0.6/map.json?bbox=${w},${s},${e},${n}`;
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(120000) });
    if (r.status === 400 && depth < 4) {             // muitos nós: divide o bloco em 4
      const mx = (w + e) / 2, my = (s + n) / 2;
      for (const [a, b, c, d] of [[w, s, mx, my], [mx, s, e, my], [w, my, mx, n], [mx, my, e, n]]) await tile(a, b, c, d, depth + 1);
      return;
    }
    if (!r.ok) throw new Error(url + ' HTTP ' + r.status);
    const j = await r.json();
    for (const el of j.elements) (el.type === 'node' ? nodes : el.type === 'way' ? ways : rels).set(el.id, el);
    process.stdout.write('.');
  }
  const NX = 4, NY = 5, dx = (BBOX.east - BBOX.west) / NX, dy = (BBOX.north - BBOX.south) / NY;
  console.log(`API do OSM: ${NX * NY} blocos`);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const w = +(BBOX.west + i * dx).toFixed(6), s = +(BBOX.south + j * dy).toFixed(6);
    await tile(w, s, +(w + dx).toFixed(6), +(s + dy).toFixed(6));
  }
  console.log(`\n${nodes.size} nós, ${ways.size} ways, ${rels.size} relações`);
  const useful = t => t && KEEP.some(k => k in t);
  const geom = w => w.nodes.map(id => nodes.get(id)).filter(Boolean).map(n => ({ lat: n.lat, lon: n.lon }));
  const out = [];
  for (const w of ways.values()) if (useful(w.tags)) out.push({ type: 'way', id: w.id, tags: w.tags, geometry: geom(w) });
  for (const r of rels.values()) {
    if (!useful(r.tags)) continue;
    const members = r.members.filter(m => m.type === 'way' && ways.has(m.ref))
      .map(m => ({ type: 'way', ref: m.ref, role: m.role, geometry: geom(ways.get(m.ref)) }));
    out.push({ type: 'relation', id: r.id, tags: r.tags, members });
  }
  // pontos com nome (comércio, igrejas…) servem para placas e decoração
  for (const n of nodes.values()) if (n.tags && (n.tags.amenity || n.tags.shop || n.tags.tourism || n.tags.highway === 'street_lamp'))
    out.push({ type: 'node', id: n.id, lat: n.lat, lon: n.lon, tags: n.tags });
  return out;
}

const viaApiOnly = process.argv.includes('--api');
let els = viaApiOnly ? null : await viaOverpass();
if (els) save(els, 'overpass');
else save(await viaOsmApi(), 'osm-api-0.6');
