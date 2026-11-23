# Changelog — Igrejinha City

Formato por data; o mais recente em cima. Detalhes técnicos nos commits do branch `ccr-4e60f86c-o43ab6`.

## 2026-11-23 — Foto aérea real no chão e entorno da praça
- Chão: imagem aérea da Prefeitura (GEO Igrejinha 2016, 0,2 m/px) reprojetada por bloco de terreno de 640 m
  (54 blocos, raio de 2,6 km, 4,8 MB WebP), carregada sob demanda perto da câmera (`scripts/build-ortho.py`).
- Entorno da praça a partir das fotos do diretor: torre Athos (24 andares, base de losangos laranja e pretos),
  Caixa, Panvel e Farmácias São João.
- Praça: feira do produtor com telhado de uma água de madeira, banheiro público, pedras e cerca no arroio,
  meio-fio amarelo.
- Dados do GEO Igrejinha: uso autorizado pelo diretor (pendência encerrada).

## 2026-11-23 — Personagens realistas
- Protagonista: modelo "homem casual" enviado pelo diretor (camiseta, jeans, barba), animado com a biblioteca
  Quaternius (parado, andar, correr, sprint, pular, sentar) transferida para o esqueleto dele (`src/player/retarget.js`).
- Pedestres perto da câmera (até 28 m; 10 no computador, 8 no celular) viram pessoas realistas com esqueleto e
  animação (Quaternius Universal Base Characters, CC0): roupa pintada por shader conforme a parte do corpo
  (camiseta/manga curta/comprida, calça/bermuda, tênis), pele, cabelos (curto, repartido, comprido, coque), barba,
  altura; sentam nos bancos, conversam, olham o jogador. Longe, continua a multidão leve.
- `scripts/build-characters.mjs`: converte os pacotes (texturas WebP, malha −50%, só as animações usadas) → 3 MB.
- Desempenho: só os 4 pedestres realistas mais próximos fazem sombra; a multidão distante usa mancha de contato.

## 2026-11-22 — Centro real: Praça Dona Luísa, Rua Coberta, Av. Castelo Branco e árvores
- Praça refeita a partir das fotos do diretor (Street View abr/2026, TripAdvisor): piso de lajotas de pedra, canteiros
  elevados com árvores grandes, pérgola de madeira com trepadeira e bancos, monumento com 4 mastros sobre canteiro
  revestido de madeira, totem do relógio, prédio enxaimel Erni Engelmann (oitão de madeira, varanda com guarda-corpo em
  X, faixa do festival, painel preto-vermelho-amarelo, chaminé de pedra), feira do produtor com balcão de tijolo e
  frutas, lampiões pretos, pedra grande com banco vermelho, floreiras redondas, parquinho.
- O tio da pipoca na esquina com a Castelo Branco ("PIPOCA E BATATA"): conversa e vende pipoca (E / Falar).
- Rua Coberta: cobertura bege fosca com nervuras e sombra embaixo (era azulada e transparente); vagas em ângulo com carros.
- Av. Castelo Branco: canteiro central gramado com meio-fio amarelo, casinhas enxaimel (telhado de telha, oitão de
  tábuas com treliça e floreira de gerânios) nas faixas de pedestre, palmeiras em vaso.
- Corrigido: em todas as avenidas de pista dupla a calçada era desenhada no canteiro central (e os pedestres andavam
  nele); agora calçada fica do lado de fora e o canteiro no meio.
- Árvores: perto da câmera, tronco com galhos e copa de folhas recortadas com sombreamento de volume e vento; longe,
  a copa simples. Ipês continuam rosa e amarelo.
- Desempenho: peças de cor lisa dos marcos agora são uma malha só (−90 draw calls); orçamento mantido (747/750).

## 2026-11-22 — Ciclo 3 (pedestres) e protagonista
- Pessoas na cidade: moradores, trabalhadores, estudantes e idosos (muitos com cuia de chimarrão) andando nas calçadas
  até destinos reais (lojas, praças, escolas, igrejas, casas, Bar do Waldir) conforme a hora; centro cheio de dia,
  vazio de madrugada.
- Esperam no meio-fio olhando para os dois lados antes de atravessar; sentam nos bancos da praça; entram nos prédios;
  param para conversar; olham para o jogador; desviam dele e reclamam se ele vem correndo ("Ô, cuidado aí, tchê!").
- E / Falar perto de qualquer pessoa: fala por perfil e hora do dia.
- Custo: ~0,5 ms por passo de simulação, +12 draw calls; `?debug` mostra quantas pessoas existem e quantas estão na tela.
- Protagonista: roupa com tons de preto distintos, barba aparada, mãos com dedos; olha para quem está perto, inclina o
  corpo ao arrancar, frear e subir ladeira, amortece o pouso do pulo e, parado, olha o relógio de vez em quando.

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
