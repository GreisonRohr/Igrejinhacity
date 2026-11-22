# Changelog — Igrejinha City

Formato por data; o mais recente em cima. Detalhes técnicos nos commits do branch `ccr-4e60f86c-o43ab6`.

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
