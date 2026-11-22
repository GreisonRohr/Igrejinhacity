# Changelog — Igrejinha City

Formato por data; o mais recente em cima. Detalhes técnicos nos commits do branch `ccr-4e60f86c-o43ab6`.

## 2026-11-22 — Ciclo 2 (núcleo de simulação)
- Simulação em passo fixo de 60 Hz com interpolação: andar, pular e subir ladeira dão o mesmo resultado em qualquer
  taxa de quadros (testado a 20, 30, 60 e 144 fps).
- Consulta espacial única para prédios, árvores, carros parados e pontos marcantes (antes eram estruturas separadas,
  e os marcos eram uma lista percorrida inteira). Memória 140 → 129 MB.
- Grafo de navegação das ruas: 2.530 cruzamentos, 3.344 trechos, mão única, velocidade por tipo de via; rotas A*
  para carro e a pé. Visualizador em `?debug&nav`.
- Gerador aleatório com semente e barramento de eventos (base para pedestres e trânsito).
- `npm test` com 8 suítes (novas: `passo-fixo`, `navegacao`).

## 2026-11-22 — Ciclo 1 (rede de segurança e carregamento)
- `npm test`: 6 suítes no build de produção (carga, orçamento, 26 travessias de ponte, colisão, Waldir, capturas);
  orçamentos em `tests/budget.json`.
- Carregamento em etapas com barra de progresso; geometria enviada à GPU em lotes; shaders pré-compilados
  (`compileAsync`). Maior travamento 7,2 s → 0,82 s.
- Memória 214 → 140 MB (orçamento de celular 150 MB).
- `?debug` com medidor para aparelho real: fps, tempo de quadro mediano e pior, draw calls, triângulos, memória, resolução.
- Menu: créditos dos dados no lugar de texto antigo.

## 2026-11-22
### Gestão
- Estrutura de projeto: GAME_BIBLE, ROADMAP (P0–P3), TASKS, BUGS, CHANGELOG, TECHNICAL_ARCHITECTURE, WORLD_DESIGN.
- 35 skills de desenvolvimento de jogos instaladas em `.claude/skills/`; `CLAUDE.md` com prioridades.

### Realismo e desempenho
- Árvores nas calçadas (7,6 mil: sibipirunas, ipês, jerivás) e carros estacionados (6,4 mil), com colisão.
- Céu físico, sol/lua/estrelas, nuvens, névoa exponencial, tone mapping ACES, luz por hora, sombra de contato,
  luz dos postes no chão.
- Desempenho: heap 327 → 214 MB, draw calls 1.109 → ~660 (merge estático, materiais compartilhados, liberação da cópia CPU).

### Mundo
- Parque da Oktoberfest (renders da 37ª edição): pórtico, Festhalle, Kerb, Oktoberzelt, Essenplatz, Bierplatz,
  Restaurant, Vila Germânica com Maibaum, Biergarten, Lichterwinkel, Spielplatz com roda-gigante.
- Ruas: asfalto, sinalização brasileira, faixas de pedestre, calçadas, postes; pontes com laje, pilares, guarda-corpo,
  caminháveis.
- Pontos marcantes a partir de fotos: Igreja Gabriel com relógio, Rua Coberta, Praça Dona Luiza com Arroio Koetz,
  Bar do Waldir com o Waldir.
- Relevo de 5 m pelas curvas de nível da Prefeitura; dados do GEO Igrejinha (30 mil prédios, pavimento, praças,
  escolas, saúde); lugares do OSM; área ampliada 1 km a leste.

### Personagem
- Protagonista Greison Rohr (barba, cabelo degradê, bomber, cargo, relógio); andar, correr, sprint, pulo;
  passada ligada à velocidade; suporte a modelo `.glb`.

### Base
- Vite + Three.js, relevo em chunks com LOD, câmera orbital, dia/noite, minimapa, controles de toque.
- Dados offline em JSON compactado; build estático publicado.
