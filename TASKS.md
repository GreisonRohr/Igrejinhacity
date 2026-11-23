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

## Ciclo 3 — Pedestres (v0.3 feita 22/11)
- [x] [P1-4] Spec `docs/spec-pedestres.md`
- [x] [P1-4] Multidão de partes rígidas instanciadas (13 draw calls para todos) com pele, cabelo (curto, comprido,
      careca), roupa, saia, altura e porte variados; idosos com cuia de chimarrão; só quem está na vista é desenhado
- [x] [P1-4] Calçadas a partir do grafo (cortadas no meio-fio da esquina), espera no meio-fio olhando para os dois
      lados, travessia, meio-fio como parede fora da travessia, desvio de pessoas/jogador/árvores/postes
- [x] [P1-4] Destinos por perfil e hora (comércio, praça, escola, igreja, casa, Bar do Waldir), bancos da praça,
      entrar em prédios, conversa em dupla, olhar o jogador, desviar e reclamar de sprint
- [x] [P1-4] População por densidade de comércio/casas × curva da hora (WORLD_DESIGN), nasce fora da vista
- [x] [P1-7] Falar com qualquer pedestre (falas por perfil e hora); `src/interact` com Waldir e pedestres
- [x] Teste `pedestres` (ninguém em prédio, < 1% no meio da pista, centro cheio às 10 h e vazio às 3 h, conversa)
- [ ] v0.6: grupos andando juntos, crianças acompanhadas, guarda-chuva com o clima (Ciclo 8), esperar carros (Ciclo 5)
- [ ] v1.0: Oktoberfest lotada, rotinas completas por zona

## Personagens realistas (23/11)
- [x] Modelos CC0 Quaternius (corpos, cabelos, animações) convertidos; pool de pedestres realistas perto da câmera
- [x] Protagonista = "male_casual" do diretor com animações transferidas
- [ ] Diretor: confirmar origem/licença de male_casual e female_secretary
- [ ] Usar female_secretary como pedestre (trabalhadora do centro)
- [ ] Corpo base Quaternius é atlético: trocar por corpos com roupa real (pacote "Ultimate Modular Characters")

## Protagonista (pedido do diretor, 22/11)
- [x] Tons de preto separados (jaqueta acetinada, camiseta fosca, cargo grafite), barba aparada, dedos, joelho embutido,
      manga sem ver o braço por dentro, braços rentes ao corpo
- [x] Olha para quem está perto (pessoa, Waldir); inclina ao arrancar/frear e em ladeira; amortece o pouso
- [x] Parado: olha o relógio de vez em quando, olha em volta, troca o peso

## Pendências que dependem do diretor
- [ ] Confirmar: sem crime/violência (GAME_BIBLE)
- [ ] Fotos: Igreja atual, Prefeitura, fábricas, Morro da Cruz, Alto da Pedra, Ponte do Centro
- [ ] Localização: arcos de guirlanda, Praça do XV (Farmácias São João: esquina Gen. Ernesto Dorneles × João Corrêa ✓)
- [ ] Confirmar papéis dos pavilhões da Oktoberfest e posição de Biergarten/Spielplatz
- [ ] Liberar `pixabay.com` na rede (áudio, Ciclo 6)
- [x] Uso dos dados do GEO Igrejinha autorizado pelo diretor (23/11; página de downloads da Prefeitura)
