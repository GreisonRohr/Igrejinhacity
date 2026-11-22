// Baixa ruas, rio, quadras e prédios do OpenStreetMap (Overpass API) para data/raw/osm.json.
// Uso: node scripts/fetch-osm.mjs   (pode rodar em qualquer computador com Node 18+)
import fs from 'node:fs'; import { BBOX } from './geo.mjs';
const b = `${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}`;
const q = `[out:json][timeout:180];
(
  way["highway"](${b});
  way["waterway"](${b});
  relation["waterway"](${b});
  way["natural"="water"](${b});
  way["building"](${b});
  relation["building"](${b});
  way["landuse"](${b});
  way["leisure"~"park|pitch|playground|garden"](${b});
  way["amenity"~"place_of_worship|parking|townhall"](${b});
);
out body geom;`;
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
fs.mkdirSync('data/raw', { recursive: true });
for (const url of MIRRORS) {
  try {
    console.log('consultando', url);
    const r = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: q }), headers: { 'User-Agent': 'igrejinha-city-game/1.0' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    fs.writeFileSync('data/raw/osm.json', JSON.stringify(j));
    console.log('ok:', j.elements.length, 'elementos → data/raw/osm.json'); process.exit(0);
  } catch (e) { console.warn('falhou:', e.message); }
}
process.exit(1);
