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
- `npm run data:preview` — visão de cima em `preview/mapa.png`

Coordenadas: metros a partir da Praça Dona Luísa (-29.5730284, -50.7919383); x = leste, z = sul, y = altitude.

`prototipo/igrejinha.html` é o protótipo original, guardado como referência.

## Créditos
- Mapa: © OpenStreetMap contributors (ODbL) — https://www.openstreetmap.org/copyright
- Relevo: Terrain Tiles (formato Terrarium) da AWS Open Data / Mapzen (https://registry.opendata.aws/terrain-tiles/), derivados de SRTM, GMTED, ETOPO1 e outras fontes públicas.
