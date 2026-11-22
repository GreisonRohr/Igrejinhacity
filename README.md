# Igrejinha City

Jogo 3D de mundo aberto de Igrejinha-RS, rodando no navegador (computador e celular). Vite + Three.js.

## Rodar
```
npm install
npm run dev        # desenvolvimento
npm run build      # gera dist/ estático (GitHub Pages, Netlify, Vercel)
```

## Dados
Os dados ficam gravados no repositório; o jogo não consulta nenhuma API ao rodar.
- `npm run data:terrain` — relevo → `public/data/terrain.bin` + `terrain.json` (grade de 10 m, Int16 em decímetros)
- `npm run data:osm` — OpenStreetMap via Overpass → `data/raw/osm.json`
- `npm run data:geo` — camadas do GEO Igrejinha (geoportal da Prefeitura) → `data/raw/geoigrejinha/`
- `npm run data:world` — converte o OSM em `public/data/world.json` (ruas, rio, áreas e prédios reais)
- `npm run data:preview` — visão de cima em `preview/mapa.png`

O jogo mostra **só prédios reais**: levantamento da Prefeitura (GEO Igrejinha), completado pelo Google Open Buildings 2024 e pelo OpenStreetMap. Onde o OSM ainda não tem o contorno das casas, o terreno fica livre.
Quem mapear prédios de Igrejinha no OSM (https://www.openstreetmap.org, editor iD) faz eles aparecerem no jogo:
basta rodar `npm run data:osm && npm run data:world` de novo.
(Existe um gerador de casas ao longo das ruas, desligado: `node scripts/build-world.mjs --gerar-casas`.)

Coordenadas: metros a partir da Praça Dona Luísa (-29.5730284, -50.7919383); x = leste, z = sul, y = altitude.

`prototipo/igrejinha.html` é o protótipo original, guardado como referência.

## Créditos
- Prédios, ruas (pavimento e perfil), rio, praças, escolas e saúde: GEO Igrejinha – Prefeitura Municipal de Igrejinha (https://pmirs.nextgis.com/resource/4673/display)
- Contornos de prédios complementares: Google Open Buildings 2024 (CC BY 4.0 / ODbL)
- Mapa: © OpenStreetMap contributors (ODbL) — https://www.openstreetmap.org/copyright
- Relevo: Terrain Tiles (formato Terrarium) da AWS Open Data / Mapzen (https://registry.opendata.aws/terrain-tiles/), derivados de SRTM, GMTED, ETOPO1 e outras fontes públicas.
