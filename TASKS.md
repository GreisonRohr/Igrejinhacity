# Tarefas — Igrejinha City

Formato: `[ ]` a fazer · `[~]` em andamento · `[x]` feito. ID do roadmap entre colchetes.

## Ciclo 1 — Rede de segurança e carregamento (feito 22/11)
- [x] [P1-1] Criar `tests/` com Playwright headless e `npm test`: carga sem erros, 26 travessias de ponte,
      colisão com prédio/carro/árvore, Waldir responde ao E, capturas de referência (praça, rua, Oktoberfest, noite)
- [x] [P1-1] Teste de orçamento: heap após GC, draw calls e triângulos nas 3 views de referência (falha se piorar >10%)
- [x] [P0-2] Tela de carregamento com barra por etapa; montagem fatiada (cede a thread entre chunks)
- [x] [P0-3] Memória: geometria enviada à GPU em lotes na carga (cópia CPU liberada) → 140 MB. (Liberar o JSON do mundo fica para quando os grafos do Ciclo 2 substituírem seu uso.)
- [x] [P0-1] Página `?debug` com leitura de fps/heap para o diretor testar no celular e mandar print

## Ciclo 2 — Núcleo de simulação (próximo, autorizado)
- [ ] [P1-2] `core/loop.js` passo fixo + interpolação; migrar walker e câmera
- [ ] [P1-2] `core/spatial.js` com prédios, marcos, árvores, carros parados, pontes; substituir `blocked`
- [ ] [P1-2] `core/rng.js`, `core/events.js`
- [ ] [P1-3] build-world: grafo viário (nós, faixas com sentido, velocidade por tipo) e grafo de calçadas/travessias
- [ ] [P1-3] Visualizador de grafo no `?debug`

## Ciclo 3 — Pedestres
- [ ] [P1-4] Spec (gd-feature-spec): rotinas, população por zona/hora, comportamentos, orçamento
- [ ] [P1-4] Personagem de multidão de partes rígidas instanciadas + variação de roupa/pele/cabelo
- [ ] [P1-4] Navegação no grafo de calçadas, desvio (steering), espera em faixa de pedestre
- [ ] [P1-4] Utility AI: ir ao destino, sentar em banco, conversar em grupo, olhar o jogador, fugir de carro
- [ ] [P1-7] Interação: falar com qualquer pedestre (falas por perfil e hora)

## Pendências que dependem do diretor
- [ ] Confirmar: sem crime/violência (GAME_BIBLE)
- [ ] Fotos: Igreja atual, Prefeitura, fábricas, Morro da Cruz, Alto da Pedra, Ponte do Centro
- [ ] Localização: arcos de guirlanda, Farmácias São João, Praça do XV
- [ ] Confirmar papéis dos pavilhões da Oktoberfest e posição de Biergarten/Spielplatz
- [ ] Liberar `pixabay.com` na rede (áudio, Ciclo 6)
- [ ] Autorização da Prefeitura para uso dos dados do GEO Igrejinha (publicação)
