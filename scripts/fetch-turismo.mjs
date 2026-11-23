// Pontos do mapa interativo do site de turismo da Prefeitura (https://igrejinha.tur.br/mapa/) → public/data/turismo.json
// Guarda só o útil para o jogo: nome, categoria e posição (metros a partir da praça, src/geo.js). Sem telefone nem preço.
// Uso: NODE_USE_ENV_PROXY=1 node scripts/fetch-turismo.mjs
import { writeFileSync } from 'node:fs';
import { toXZ } from '../src/geo.js';
const html = await (await fetch('https://igrejinha.tur.br/mapa/', { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
const i = html.indexOf('markersData = ['), j = html.indexOf('];', i);
const data = JSON.parse(html.slice(i + 'markersData = '.length, j + 1));
const K = { 'Atrativos': 'turismo', 'Gastronomia': 'gastro', 'Estadia': 'hotel', 'Compras': 'loja', 'Agenda de eventos': 'evento', 'Eventos': 'evento' };
const dec = s => s.replace(/&#8211;/g, '–').replace(/&#8217;/g, '’').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const out = [];
for (const m of data) {
  const [x, z] = toXZ(m.lat, m.lng);
  if (x < -5600 || x > 2100 || z < -5880 || z > 3530) continue;          // fora do relevo do jogo
  out.push({ x: Math.round(x), z: Math.round(z), k: K[m.category_names[0]] || 'turismo', n: dec(m.title) });
}
writeFileSync('public/data/turismo.json', JSON.stringify({ fonte: 'igrejinha.tur.br/mapa (Prefeitura de Igrejinha)', places: out }));
console.log(out.length, 'pontos');
