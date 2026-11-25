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
  censo2022: [10305, ['Total de pessoas', 'AREA_KM2', 'NM_BAIRRO', 'SITUACAO']],
  // auditoria GEO (25/11/2026): lotes só com a geometria; sistema viário completo; drenagem; faces de logradouro
  lotes: [7579, []],
  sistema_viario: [7287, ['Logradouro', 'Tipo_Pav', 'Gabarito', 'Larg_Total', 'Passeio_E', 'Passeio_D', 'Faixa_E', 'Faixa_D', 'Estacio_E', 'Estacio_D', 'Canteiro_C', 'Ciclovia_E', 'Ciclovia_D']],
  drenagem_caixas: [7546, ['Tipo', 'Sigla']],
  drenagem_rede: [7548, ['Tipo', 'Diametro_cm']],
  censo_faces_logradouro: [10814, ['NM_TIP_LOG', 'NM_LOG', 'TOT_RES', 'TOT_GERAL']],
};
const only = process.argv[2];
for (const [name, [id, keep]] of Object.entries(LAYERS)) {
  if (only && name !== only) continue;
  const r = await fetch(`${H}/api/resource/${id}/export?format=GeoJSON&srs=4326&zipped=false&fid=`, { signal: AbortSignal.timeout(900000) });
  const j = await r.json();
  for (const f of j.features) { const p = {}; for (const k of keep) if (f.properties[k] != null && f.properties[k] !== '') p[k] = f.properties[k]; f.properties = p; }
  fs.writeFileSync(`${OUT}/${name}.geojson`, JSON.stringify(j));
  console.log(name, j.features.length);
}
