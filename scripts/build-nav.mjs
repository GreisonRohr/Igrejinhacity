// Grafo de navegação a partir das ruas já processadas (public/data/world.data.json).
// Nós = cruzamentos (vértice compartilhado por 2+ vias) e pontas; arestas = trechos entre nós.
// Saída: public/data/nav.data.json (não altera world.data.json).
import fs from 'node:fs';
import zlib from 'node:zlib';

const raw = JSON.parse(fs.readFileSync('public/data/world.data.json', 'utf8'));
const world = JSON.parse(zlib.gunzipSync(Buffer.from(raw.gzip_base64, 'base64')).toString());

// tipos de via: velocidade máxima (km/h, padrão urbano do CTB) e quem pode usar
const KINDS = ['motorway', 'trunk', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link',
  'residential', 'unclassified', 'living_street', 'service', 'track', 'construction', 'pedestrian', 'footway', 'path', 'cycleway', 'steps'];
const SPEED = { motorway: 80, trunk: 80, primary: 60, primary_link: 40, secondary: 50, secondary_link: 40, tertiary: 40, tertiary_link: 30,
  residential: 30, unclassified: 30, living_street: 10, service: 20, track: 20 };
const CAR = 1, PED = 2;
// mesmas regras de calçada do desenho das ruas (src/world/city.js buildRoads)
const URBAN = new Set(['primary', 'secondary', 'tertiary', 'residential', 'living_street', 'primary_link', 'secondary_link', 'tertiary_link']);
const unpaved = r => r.pav === 'terra' || (!r.pav && (r.k === 'track' || ['unpaved', 'gravel', 'dirt', 'ground', 'compacted'].includes(r.sf)));
const sidewalk = r => { const urban = URBAN.has(r.k) && !unpaved(r); const sw = r.sw ? (r.sw[0] + r.sw[1]) / 2 : (urban ? 2.2 : 0); return r.br ? (urban ? 1.5 : 0.4) : sw; };
const flags = k => (SPEED[k] ? CAR : 0) | (k === 'motorway' || k === 'trunk' || k === 'construction' ? 0 : PED);

const key = q => q[0] + ',' + q[1];
const uses = new Map();
for (const r of world.roads) { const seen = new Set(); for (const q of r.p) { const k = key(q); if (seen.has(k)) continue; seen.add(k); uses.set(k, (uses.get(k) || 0) + 1); } }

const nodeId = new Map(), nodes = [];
const node = q => { const k = key(q); let id = nodeId.get(k); if (id === undefined) { id = nodes.length / 2; nodeId.set(k, id); nodes.push(q[0], q[1]); } return id; };
const edges = [];
for (const r of world.roads) {
  const f = flags(r.k); if (!f || r.p.length < 2) continue;
  let start = 0;
  for (let i = 1; i < r.p.length; i++) {
    if (i < r.p.length - 1 && uses.get(key(r.p[i])) < 2) continue;
    const seg = r.p.slice(start, i + 1);
    let len = 0; for (let j = 1; j < seg.length; j++) len += Math.hypot(seg[j][0] - seg[j - 1][0], seg[j][1] - seg[j - 1][1]);
    if (len > 0.05) {
      const lanesTotal = Math.max(1, Math.round(r.w / 3.3));
      edges.push({ a: node(seg[0]), b: node(seg[seg.length - 1]), k: KINDS.indexOf(r.k), f, len: Math.round(len * 10) / 10,
        ow: r.ow ? 1 : 0, sp: SPEED[r.k] || 5, ln: r.ow ? lanesTotal : Math.max(1, lanesTotal >> 1), w: r.w, br: r.br ? 1 : 0, sw: Math.round(sidewalk(r) * 10) / 10, med: r.ow && r.med ? r.med : 0,
        n: r.n || undefined, m: seg.slice(1, -1).flat() });
    }
    start = i;
  }
}

// mantém o maior componente conectado (ignora pedaços soltos de dados)
const N = nodes.length / 2, adj = Array.from({ length: N }, () => []);
edges.forEach((e, i) => { adj[e.a].push(e.b); adj[e.b].push(e.a); });
const comp = new Int32Array(N).fill(-1); let best = -1, bestN = 0;
for (let s = 0, c = 0; s < N; s++) {
  if (comp[s] >= 0) continue;
  let n = 0; const st = [s]; comp[s] = c;
  while (st.length) { const u = st.pop(); n++; for (const v of adj[u]) if (comp[v] < 0) { comp[v] = c; st.push(v); } }
  if (n > bestN) { bestN = n; best = c; } c++;
}
const remap = new Int32Array(N).fill(-1), outNodes = [];
for (let i = 0; i < N; i++) if (comp[i] === best) { remap[i] = outNodes.length / 2; outNodes.push(nodes[2 * i], nodes[2 * i + 1]); }
const outEdges = edges.filter(e => comp[e.a] === best).map(e => ({ ...e, a: remap[e.a], b: remap[e.b] }));

const nav = { v: 1, kinds: KINDS, CAR, PED, nodes: outNodes, edges: outEdges };
fs.writeFileSync('public/data/nav.data.json', JSON.stringify({ gzip_base64: zlib.gzipSync(JSON.stringify(nav), { level: 9 }).toString('base64') }));
const km = f => (outEdges.filter(e => e.f & f).reduce((s, e) => s + e.len, 0) / 1000).toFixed(1);
console.log({ nos: outNodes.length / 2, arestas: outEdges.length, descartados: N - bestN, kmCarro: km(CAR), kmPedestre: km(PED),
  maoUnica: outEdges.filter(e => e.ow).length, tamanhoKB: Math.round(fs.statSync('public/data/nav.data.json').size / 1024) });
