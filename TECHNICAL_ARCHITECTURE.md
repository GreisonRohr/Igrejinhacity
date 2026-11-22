# Arquitetura técnica — Igrejinha City

## Stack
Vite 8 + three.js r187, JavaScript ES modules puro, sem engine. Build estático (`dist/`), dados pré-processados
em `public/data/` (JSON com gzip+base64). Testes de navegador com Playwright (headless).

## Estado atual (3.137 linhas em `src/`)

```
scripts/            pipeline de dados (Node): fetch-osm, fetch-terrain, fetch-geo-igrejinha, build-terrain,
                    build-world (+ geo-igrejinha.mjs, gen-buildings.mjs), preview
public/data/        terrain.json + terrain.data.json (grade 5 m), world.data.json (ruas, prédios, áreas, lugares)
src/core/           loop (passo fixo 60 Hz + interpolação), spatial (consulta única de colisão + agentes),
                    rng (mulberry32 com semente), events (barramento)
src/nav/graph.js    grafo de ruas/calçadas (public/data/nav.data.json, gerado por scripts/build-nav.mjs), A*
src/main.js         (≈270) inicialização, qualidade por dispositivo, laço do jogo, HUD, Waldir, interação
src/geo.js          projeção lat/lon → metros (origem Praça Dona Luísa; x leste, z sul)
src/landmarks.js    pontos marcantes (coordenadas), estilos de ícone
src/input.js        teclado, joystick, arrastar câmera, botões
src/camera.js       câmera orbital com colisão
src/player/         walker (física a pé, pontes, pulo), person (personagem procedural + animação),
                    glbmodel (substituto .glb opcional)
src/world/terrain   terreno em chunks de 640 m com 5 LODs
src/world/city      rio, ruas (calçada, meio-fio, sinalização, faixas), pontes (tabuleiro, pilares), postes,
                    30 mil prédios mesclados por chunk de 600 m, colisão em grade de 50 m
src/world/ground    textura do chão do mapa inteiro (canvas 4096)
src/world/sky       céu físico, sol/lua/estrelas, nuvens, névoa, luzes por hora
src/world/landmarks3d + oktoberfest   modelos dos pontos marcantes; merge estático por célula de 500 m
src/world/streetlife   árvores e carros estacionados instanciados por célula de 800 m
src/world/merge     merge estático e liberação da cópia CPU das geometrias
src/ui/minimap      minimapa girando
```

## Problemas arquiteturais identificados
| # | Problema | Consequência | Prioridade |
|---|---|---|---|
| A1 | ✅ resolvido no Ciclo 2 (`core/loop.js`) — **Sem passo fixo de simulação**: lógica avança com o `dt` do quadro | física e IA mudam com o FPS; impossível testar de forma determinística; carros e NPCs vão divergir | P1 |
| A2 | ✅ resolvido no Ciclo 2 (`core/spatial.js`) — **Sem consulta espacial comum**: colisão de prédios (city.colGrid), pontos marcantes (lista linear), árvores/carros (city), pontes (decks) em estruturas separadas | NPCs e carros precisariam consultar 4 lugares; `landmarkBlocked` é O(n) | P1 |
| A3 | ✅ resolvido no Ciclo 2 (`nav/graph.js`) — **Sem grafo de navegação**: ruas existem só como polilinhas de desenho | impossível trânsito e pedestres seguindo ruas/calçadas | P1 |
| A4 | **`main.js` concentra tudo** (HUD, Waldir, interações, laço) | cada sistema novo aumenta o acoplamento | P1 |
| A5 | **Sem sistema de interação**: o "E" é tratado caso a caso | não escala para dezenas de interações | P1 |
| A6 | ✅ mitigado no Ciclo 1 (etapas + envio em lotes) — **Construção síncrona na thread principal** (≈4–8 s) | tela congela no carregamento, risco de "página não responde" no celular | P0 (risco) |
| A7 | ✅ resolvido no Ciclo 1 (`tests/`, `npm test`) — **Testes fora do repositório** (scripts em pasta temporária) | regressões não são verificáveis por outra sessão | P1 |
| A8 | **Sem sistema de save** | recordes e progresso não persistem | P2 |
| A9 | **Dados brutos grandes no git** (Open Buildings 16 MB, edificações 7 MB) | repositório cresce a cada atualização | P3 |

## Arquitetura-alvo (introduzida em ciclos, sem reescrever o que funciona)

```
src/core/
  loop.js          passo fixo 60 Hz + interpolação; teto de 5 passos/quadro (skill game-detail-bar §11)
  events.js        barramento de eventos (hora mudou, entrou no carro, missão concluída…)
  spatial.js       grade espacial única: colisores estáticos (prédios, marcos, árvores, carros parados),
                   agentes dinâmicos (NPCs, veículos, jogador); consultas por raio/segmento
  rng.js           gerador com semente (mulberry32) — jogo e cosmético separados
src/nav/
  graph.js         ✅ grafo único com flags carro/pedestre (nós = cruzamentos; trechos com sentido, velocidade,
                   faixas, largura, ponte). A pé: deslocamento para a calçada e travessias entram no Ciclo 3.
src/sim/
  agents.js        pedestres: rotina por hora (casa/trabalho/praça/bar/festa), utility AI, desvio (steering)
  traffic.js       veículos IA: seguir faixa, distância segura, preferência em cruzamento, reagir a pedestre
  vehicle.js       física de veículo (bicicleta/raycast: aceleração, freio, atrito lateral, colisão)
src/interact/      registro de interagíveis (prompt, alcance, ação) + diálogos
src/audio/         barramentos, ambiência por zona/hora, voz de passos/motor
src/game/          missões, recordes, save versionado
```

### Regras
- Mundo estático é **dado pré-calculado** (build-world gera grafos); nada de gerar rede viária em tempo real.
- Agentes dinâmicos: **dados planos** em arrays (struct-of-arrays), um sistema atualiza todos; render instanciado
  por tipo (personagens de partes rígidas instanciadas — guia *3d-scenes*, "crowds without skinning").
- Simulação por **LOD de distância**: perto = completa; média = tick reduzido; longe = só estatística (spawn/despawn
  ao redor do jogador, população coerente com a hora).
- Toda consulta de colisão passa por `spatial.js`.

## Orçamentos (celular intermediário)
| Recurso | Orçamento | Atual (medido) |
|---|---|---|
| Heap JS após GC | ≤ 150 MB | 214 MB |
| Draw calls (view mais cheia) | ≤ 300 | ~660 |
| Triângulos por quadro | ≤ 1,0 M | ~2,2 M |
| Lógica por quadro (300 agentes) | ≤ 2 ms | — |
| Carregamento até controle | ≤ 5 s, sem congelar | 6–11 s, congela |

## Medição e testes
- `?debug`: fps, draw calls, triângulos; tempos e heap por etapa de carregamento no console.
- `npm test` (Playwright no build de produção), 8 suítes: carga, orçamento (heap após GC, draw calls, triângulos),
  pontes (26 travessias), colisão, passo-fixo (determinismo a 20/30/60/144 fps), navegação (A* sem contramão),
  Waldir, capturas de referência. `?debug&nav` mostra o grafo.
