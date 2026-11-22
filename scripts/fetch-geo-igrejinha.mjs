// Baixa camadas do GEO Igrejinha (geoportal da Prefeitura, NextGIS Web) em GeoJSON (WGS84).
// https://pmirs.nextgis.com/resource/4673/display
// Uso: NODE_USE_ENV_PROXY=1 node scripts/fetch-geo-igrejinha.mjs
// Não baixa camadas de cadastro imobiliário, CNEFE ou dados pessoais: só geometria útil ao jogo.
import fs from 'node:fs';

const HOST = 'https://pmirs.nextgis.com';
// id do estilo no mapa → nome do arquivo
const LAYERS = {
  9630: 'edificacoes', 10140: 'open_buildings_google_2024', 7578: 'quadras',
  10224: 'ruas_estradas', 10978: 'vias_tipo_pavimento', 4480: 'pontes', 10172: 'escolas', 9393: 'saude',
  6413: 'pracas_lazer', 5329: 'pontos_referencia', 8355: 'patrimonio_historico', 5844: 'paradas_onibus',
  7684: 'ciclovias', 7857: 'localidades_toponimos', 7264: 'bairros', 7042: 'rio_paranhana', 7044: 'lagos',
  6594: 'cemiterios', 6598: 'cemiterios_poligonal', 4482: 'linhas_onibus', 5960: 'limite_municipal',
};
const OUT = 'data/raw/geoigrejinha'; fs.mkdirSync(OUT, { recursive: true });
const get = async (url, tries = 3) => {
  for (let i = 0; ; i++) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(300000) }); if (!r.ok) throw new Error('HTTP ' + r.status); return r; }
    catch (e) { if (i >= tries - 1) throw e; await new Promise(s => setTimeout(s, 3000)); }
  }
};
const meta = [];
for (const [style, name] of Object.entries(LAYERS)) {
  const s = await (await get(`${HOST}/api/resource/${style}`)).json();
  const layer = s.resource.cls.endsWith('_style') ? s.resource.parent.id : +style;
  const info = await (await get(`${HOST}/api/resource/${layer}`)).json();
  const url = `${HOST}/api/resource/${layer}/export?format=GeoJSON&srs=4326&zipped=false&fid=`;
  const txt = await (await get(url)).text();
  const j = JSON.parse(txt);
  // remove campos de cadastro (número de inscrição) que não servem ao jogo
  for (const f of j.features) for (const k of Object.keys(f.properties || {})) if (/cadastro|inscri|propriet|cpf|cnpj/i.test(k)) delete f.properties[k];
  fs.writeFileSync(`${OUT}/${name}.geojson`, JSON.stringify(j));
  meta.push({ name, layer, titulo: info.resource.display_name, features: j.features.length });
  console.log(name.padEnd(28), layer, j.features.length, 'feições');
}
fs.writeFileSync(`${OUT}/_camadas.json`, JSON.stringify({ fonte: HOST + '/resource/4673/display', baixado: new Date().toISOString(), camadas: meta }, null, 1));
