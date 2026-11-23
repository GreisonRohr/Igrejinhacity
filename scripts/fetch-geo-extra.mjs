// Camadas extras do GEO Igrejinha (uso autorizado pelo diretor). Só campos úteis ao jogo: nada de inscrição,
// matrícula, ficha cadastral, datas ou identificação de pessoas.
// Uso: NODE_USE_ENV_PROXY=1 node scripts/fetch-geo-extra.mjs  →  data/raw/geoigrejinha/*.geojson
import fs from 'node:fs';
const H = 'https://pmirs.nextgis.com', OUT = 'data/raw/geoigrejinha';
const LAYERS = {
  cadastro_enderecos: [10161, ['Logradouro - Nome', 'Número', 'Edifício/Condomínio - Descrição', 'Nro de Pavimentos', 'Sala', 'Loja', 'Bairro - Nome', 'Tipo', 'Área Construída']],
  zoneamento: [8830, ['zoneamento', 'sigla', 'macrozona', 'H Maxima']],
  pontos_turisticos: [5330, ['NOME', 'Descric']],
  patrimonio_inventario: [8354, ['Identificação', 'Local', 'Pontuação']],
  feiras: [6591, ['Nome']],
};
for (const [name, [id, keep]] of Object.entries(LAYERS)) {
  const r = await fetch(`${H}/api/resource/${id}/export?format=GeoJSON&srs=4326&zipped=false&fid=`, { signal: AbortSignal.timeout(900000) });
  const j = await r.json();
  for (const f of j.features) { const p = {}; for (const k of keep) if (f.properties[k] != null && f.properties[k] !== '') p[k] = f.properties[k]; f.properties = p; }
  fs.writeFileSync(`${OUT}/${name}.geojson`, JSON.stringify(j));
  console.log(name, j.features.length);
}
