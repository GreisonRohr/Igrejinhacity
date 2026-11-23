// Baixa "Uso e Ocupação do Solo 2023 - PMMA" (GEO Igrejinha, camada 10129) em GeoJSON WGS84.
// Uso: node scripts/fetch-usosolo.mjs   →  data/raw/geoigrejinha/uso_solo_2023.geojson
import fs from 'node:fs';
const url = 'https://pmirs.nextgis.com/api/resource/10129/export?format=GeoJSON&srs=4326&zipped=false&fid=';
const r = await fetch(url, { signal: AbortSignal.timeout(900000) });
if (!r.ok) throw new Error('HTTP ' + r.status);
fs.mkdirSync('data/raw/geoigrejinha', { recursive: true });
fs.writeFileSync('data/raw/geoigrejinha/uso_solo_2023.geojson', await r.text());
const j = JSON.parse(fs.readFileSync('data/raw/geoigrejinha/uso_solo_2023.geojson'));
const c = {}; for (const f of j.features) c[f.properties['Classe Uso']] = (c[f.properties['Classe Uso']] || 0) + 1;
console.log(j.features.length, c, (fs.statSync('data/raw/geoigrejinha/uso_solo_2023.geojson').size / 1048576).toFixed(1), 'MB');
