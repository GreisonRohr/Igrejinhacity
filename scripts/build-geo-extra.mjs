// Junta dados do GEO Igrejinha aos prédios e lugares do jogo (rodar depois de scripts/fetch-geo-extra.mjs).
//  - pavimentos reais: soma da área construída das unidades do cadastro dentro de cada prédio ÷ área do térreo
//  - nome do edifício/condomínio; uso pelo zoneamento (zona industrial)
//  - endereços (rua + número) e bairros para o HUD; pontos turísticos, patrimônio histórico e feiras
// Saída: public/data/geoextra.data.json
import fs from 'node:fs';
import zlib from 'node:zlib';
import { toXZ } from '../src/geo.js';
const R = 'data/raw/geoigrejinha/';
const load = n => JSON.parse(fs.readFileSync(R + n + '.geojson', 'utf8')).features;
const raw = JSON.parse(fs.readFileSync('public/data/world.data.json'));
const world = JSON.parse(zlib.gunzipSync(Buffer.from(raw.gzip_base64, 'base64')));
const pt = g => { const c = g.type === 'Point' ? g.coordinates : g.type === 'MultiPoint' ? g.coordinates[0] : null; return c ? toXZ(c[1], c[0]).map(v => Math.round(v * 10) / 10) : null; };
const polys = g => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []).map(p => p[0].map(q => toXZ(q[1], q[0])));
const inPoly = (x, z, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > z) !== (p[j][1] > z) && x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
const area = p => { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return Math.abs(a / 2); };
const title = s => (s || '').toLowerCase().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Dos|Das|E)\b/g, w => w.toLowerCase());

// grade dos prédios
const G = new Map(), key = (x, z) => Math.floor(x / 40) + ',' + Math.floor(z / 40);
world.buildings.forEach((b, i) => { const xs = b.p.map(q => q[0]), zs = b.p.map(q => q[1]); for (let a = Math.floor(Math.min(...xs) / 40); a <= Math.floor(Math.max(...xs) / 40); a++) for (let c = Math.floor(Math.min(...zs) / 40); c <= Math.floor(Math.max(...zs) / 40); c++) { const k = a + ',' + c; (G.get(k) || G.set(k, []).get(k)).push(i); } });
const findB = (x, z) => { for (const i of G.get(key(x, z)) || []) if (inPoly(x, z, world.buildings[i].p)) return i; return -1; };
const findNear = (x, z, d) => { let best = -1, bd = d; for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) for (const i of G.get((Math.floor(x / 40) + a) + ',' + (Math.floor(z / 40) + c)) || []) { const b = world.buildings[i], cx = b.p.reduce((s, q) => s + q[0], 0) / b.p.length, cz = b.p.reduce((s, q) => s + q[1], 0) / b.p.length, dd = Math.hypot(cx - x, cz - z); if (dd < bd) { bd = dd; best = i; } } return best; };

// 1. cadastro → área construída, unidades e nome por prédio; endereços
const agg = new Map(), addr = [], groups = new Map();
for (const f of load('cadastro_enderecos')) {
  const p = f.properties, c = pt(f.geometry); if (!c) continue;
  const rua = p['Logradouro - Nome'], num = p['Número'];
  if (rua && num && num !== '0' && p.Tipo === 'Unidade') addr.push([c[0], c[1], title(rua), num]);
  if (p.Tipo !== 'Unidade') continue;
  // unidades do mesmo prédio: mesmo nome de edifício (ou mesmo endereço)
  const nm = p['Edifício/Condomínio - Descrição'], gk = nm ? 'N:' + nm + '|' + rua : 'A:' + rua + '|' + num + '|' + Math.round(c[0] / 30) + ',' + Math.round(c[1] / 30);
  const gr = groups.get(gk) || groups.set(gk, { x: 0, z: 0, n: 0, area: 0, name: nm, pts: [] }).get(gk);
  gr.x += c[0]; gr.z += c[1]; gr.n++; gr.area += parseFloat(p['Área Construída']) || 0; gr.pts.push(c);
}
// condomínio de vários blocos (unidades espalhadas por > 30 m): cada unidade vai para o seu bloco
for (const [k, gr] of [...groups]) {
  const x = gr.x / gr.n, z = gr.z / gr.n;
  if (gr.n < 2 || !gr.pts.some(q => Math.hypot(q[0] - x, q[1] - z) > 30)) continue;
  groups.delete(k); const per = gr.area / gr.n;
  gr.pts.forEach((q, j) => groups.set(k + '#' + j, { x: q[0], z: q[1], n: 1, area: per, name: null, pts: [q] }));
}
for (const gr of groups.values()) {
  const x = gr.x / gr.n, z = gr.z / gr.n;
  // prédio que contém o centro do grupo, ou algum ponto do grupo, ou o mais próximo até 20 m
  let i = findB(x, z); for (const q of gr.pts) { if (i >= 0) break; i = findB(q[0], q[1]); } if (i < 0) i = findNear(x, z, 20); if (i < 0) continue;
  const a = agg.get(i) || agg.set(i, { area: 0, n: 0, name: null }).get(i);
  a.area += gr.area; a.n += gr.n; if (gr.name && gr.n >= 6) a.name = gr.name;
}
const floors = new Array(world.buildings.length).fill(0), names = [];
for (const [i, a] of agg) {
  const b = world.buildings[i], fa = area(b.p);
  if (fa < 25) continue;
  // vários prédios no mesmo lote dividem a área (casa + anexo): só confia quando há várias unidades ou área > térreo
  // área construída das unidades (privativa) ÷ térreo; a planta do Google costuma ser menor que o prédio: ÷1,15
  let fl = Math.round(a.area / (fa * 1.15));
  // (contar unidades infla: boxes de garagem também são unidades no cadastro)
  floors[i] = Math.max(0, Math.min(18, fl));
  if (a.name && a.n >= 6) { const cx = b.p.reduce((s, q) => s + q[0], 0) / b.p.length, cz = b.p.reduce((s, q) => s + q[1], 0) / b.p.length; names.push([Math.round(cx), Math.round(cz), title(a.name).replace(/^Edificio\b/, 'Edifício').replace(/^Condominio\b/, 'Condomínio'), i]); }
}
// 2. zoneamento: prédios em zona industrial
const ind = new Array(world.buildings.length).fill(0);
for (const f of load('zoneamento')) if (/Industrial/.test(f.properties.zoneamento || '')) for (const pg of polys(f.geometry)) world.buildings.forEach((b, i) => { const q = b.p[0]; if (inPoly(q[0], q[1], pg)) ind[i] = 1; });
// 3. bairros (polígonos simplificados)
const bairros = [];
for (const f of load('bairros')) for (const pg of polys(f.geometry)) { const s = pg.filter((q, k) => k % 3 === 0).map(q => q.map(v => Math.round(v))); bairros.push([f.properties.Nome, s]); }
// 4. lugares: pontos turísticos, patrimônio histórico, feiras
const places = [];
for (const f of load('pontos_turisticos')) { const c = pt(f.geometry); if (c) places.push({ x: c[0], z: c[1], k: 'turismo', n: title(f.properties.Descric || f.properties.NOME).replace('Fe', 'Fé') }); }
for (const f of load('patrimonio_inventario')) { const c = pt(f.geometry); if (c) places.push({ x: c[0], z: c[1], k: 'patrimonio', n: f.properties['Identificação'] }); }
for (const f of load('feiras')) { const c = pt(f.geometry); if (c) places.push({ x: c[0], z: c[1], k: 'feira', n: f.properties.Nome || 'Feira do Produtor' }); }

const out = { floors, ind, names, addr, bairros, places };
fs.writeFileSync('public/data/geoextra.data.json', JSON.stringify({ gzip_base64: zlib.gzipSync(JSON.stringify(out), { level: 9 }).toString('base64') }));
const fc = floors.filter(v => v > 0);
console.log({ predios_com_pavimentos: fc.length, acima_4: fc.filter(v => v >= 4).length, max: Math.max(...fc), nomes: names.length, enderecos: addr.length, industriais: ind.filter(Boolean).length, bairros: bairros.length, lugares: places.length, KB: Math.round(fs.statSync('public/data/geoextra.data.json').size / 1024) });
console.log(names.slice(0, 12).map(n => n[2] + ' ' + floors[n[3]] + 'pav').join(' | '));
