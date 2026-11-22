# Tarefas — Igrejinha City

Formato: `[ ]` a fazer · `[~]` em andamento · `[x]` feito. ID do roadmap entre colchetes.

## Ciclo 1 — Rede de segurança e carregamento (feito 22/11)
- [x] [P1-1] Criar `tests/` com Playwright headless e `npm test`: carga sem erros, 26 travessias de ponte,
      colisão com prédio/carro/árvore, Waldir responde ao E, capturas de referência (praça, rua, Oktoberfest, noite)
- [x] [P1-1] Teste de orçamento: heap após GC, draw calls e triângulos nas 3 views de referência (falha se piorar >10%)
- [x] [P0-2] Tela de carregamento com barra por etapa; montagem fatiada (cede a thread entre chunks)
- [x] [P0-3] Memória: geometria enviada à GPU em lotes na carga (cópia CPU liberada) → 140 MB. (Liberar o JSON do mundo fica para quando os grafos do Ciclo 2 substituírem seu uso.)
- [x] [P0-1] Página `?debug` com leitura de fps/heap para o diretor testar no celular e mandar print

## Ciclo 2 — Núcleo de simulação (feito 22/11)
- [x] [P1-2] `core/loop.js` passo fixo + interpolação; walker dividido em `step()` (simulação) e `present()` (desenho);
      câmera segue a posição interpolada
- [x] [P1-2] `core/spatial.js` com prédios, marcos, árvores e carros parados numa grade só; `blocked`/`roofAt` do
      jogador e da câmera passam por ela (pontes continuam em `city.deckAt`, que já é por cabeceira)
- [x] [P1-2] `core/rng.js` (fluxos de jogo e cosmético), `core/events.js` (evento `step` a cada passo)
- [x] [P1-3] `scripts/build-nav.mjs` → `public/data/nav.data.json`: nós nos cruzamentos, trechos com tipo, mão única,
      velocidade (CTB urbano), faixas estimadas pela largura, ponte, flags carro/pedestre; maior componente conectado
- [x] [P1-3] `src/nav/graph.js`: vizinho mais próximo, A* por tempo (carro, respeita mão única) e por distância (a pé)
- [x] [P1-3] Visualizador `?debug&nav` (azul = carro, laranja = mão única, verde = só pedestre)
- [x] Testes `passo-fixo` (20/30/60/144 fps → mesma posição) e `navegacao` (rotas sem contramão, < 60 ms)
- Fica para o Ciclo 3: deslocar as rotas a pé para a calçada (meio-fio + largura) e usar as faixas de pedestre
  de `city.findCrossings` como pontos de travessia.

## Ciclo 3 — Pedestres (próximo, aguarda autorização)
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
