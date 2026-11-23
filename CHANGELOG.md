# Changelog — Igrejinha City

Formato por data; o mais recente em cima. Detalhes técnicos nos commits do branch `ccr-4e60f86c-o43ab6`.

## 2026-11-23 — Chão dos terrenos: detalhe de perto (cidade toda)
- A foto aérea vista da rua era uma mancha escura e azulada (sombras de prédios/árvores pintadas na foto de 2016). No
  shader do terreno, perto da câmera (até ~260 m): onde a foto é sombra, o chão vira grama/terra de quintal; grão
  repetido em coordenadas de mundo (3 m, sem emenda) com variação de 37 m. Mesmo material: 0 chamadas de desenho a mais.
- Antes/depois nas mesmas posições: docs não versionados; capturas no relatório da sessão.

## 2026-11-23 — Upgrade visual: piloto do centro (até 650 m da praça)
- Asfalto novo (512 px): agregado, manchas de óleo, remendos, desgaste claro e trincas; cada rua com tom próprio (±8%).
- Sombra de contato ("oclusão ambiente assada") no chão junto às paredes dos prédios (visível até 400 m).
- Lojas no térreo dos prédios comerciais voltados para a rua: letreiro, vitrine, porta de enrolar, toldos coloridos;
  letreiros e vitrines acendem à noite. ~645 fachadas no piloto.
- Muro baixo ou grade com portão de ferro na frente das casas recuadas (sem invadir calçada nem outro prédio; com colisão).
- Rede elétrica (3 fios com catenária) entre os postes do centro; lixeiras junto a parte dos postes.
- Abrigos de ônibus nas paradas reais do GEO Igrejinha (61 de 80; as demais caem longe de rua ou sobre prédio).
- Custo medido no teste de orçamento: +12 chamadas de desenho (651 → 663 de 750), +76 mil triângulos, heap igual.

## 2026-11-23 — Piso da praça e passarela; fotos da Prefeitura
- O personagem afundava: pisava no terreno, mas o piso visível fica acima dele. Agora o chão segue o que se vê —
  lajotas da praça (+6 cm), canteiros elevados (+32 cm), margens do valão (o terreno ali é escavado; a margem fica na
  altura da rua), varanda do Erni Engelmann, e em toda a cidade a pista (+8 cm), a calçada (+23 cm) e os canteiros.
- Passarela de madeira da praça: anda-se por cima do tabuleiro; as paredes do valão e os guarda-corpos têm colisão
  (não se desce mais para o leito). O teste `pontes` agora atravessa a passarela nos dois sentidos (28/28).
- Fotos da Prefeitura (igrejinha.rs.gov.br, notícia 1188, 2026): Erni Engelmann com paredes de madeira cor de mel e o
  nome do oitão legível (estava espelhado); Feira do Produtor com base de tijolo, painéis de madeira com mãos-francesas
  em X e pérgola de metal preto com cobertura de vidro.
- Feira do Produtor refeita pelas fotos do diretor (Street View abr/2026): prédio comprido de paredes brancas, pilares
  e testeira de madeira clara, balcões de tijolo com as bancas abertas para a Rua Coberta, ponta leste branca com porta de
  madeira; árvore grande entre a feira e o Erni; canteiro redondo elevado com árvore perto da esquina da Ernesto Dorneles.
  (Os painéis em X e a pérgola preta da rodada anterior eram de outra foto e saíram.) Palmeiras e árvores sorteadas não
  nascem mais na cabeceira da passarela.
- Feira do Produtor movida para a esquerda do Erni Engelmann (de quem olha a fachada pela Rua Coberta; lado leste),
  como indicou o diretor; a ala baixa com o painel da bandeira passou para o outro lado.
- `?keepgeo` mantém os vértices na memória (para testes que medem a geometria, como a varredura do piso da praça).

## 2026-11-23 — Casa do Artesão
- Ao lado da Igreja Gabriel, do lado da R. Santos Dumont (fotos do diretor, Street View abr/2026 só como referência, e do
  site de turismo): casa branca de rodapé e molduras vermelhas, varanda em "A" de madeira escura com mãos-francesas,
  telhado de fibrocimento, ala comprida nos fundos, degraus vermelho e branco e a placa.
- Lateral pela R. Santos Dumont (fotos do diretor): prédio comprido rosado nos fundos, com janelas e ar-condicionado;
  canteiro com folhagens e quatro árvores grandes; vagas a 90° com carros de frente para o prédio.
- Calçada de lajotas em volta da casa com meio-fio amarelo; árvores (copas da imagem aérea) não nascem mais dentro de
  nenhum ponto marcante (antes só eram tiradas dos prédios genéricos).

## 2026-11-23 — Desempenho: −95 chamadas de desenho na praça (744 → 649)
- Sombras só onde aparecem: árvores e carros estacionados fazem sombra só nas células junto ao jogador; peças pequenas
  dos pontos (placas, plaquinhas) e dos personagens montados por peças (olhos, botões) não fazem mais sombra. O mapa de
  sombras caiu de 161 para ~90 desenhos. Sombras perto do jogador iguais.
- Prédios a mais de 1,5 km do centro em regiões de 1,5 km (eram 600 m); pontos marcantes juntados por região de 1 km.
- Medido com `?debug`/teste de orçamento: heap 148 → 141 MB, triângulos 2.370k → 2.341k.

## 2026-11-23 — Site de turismo da Prefeitura (igrejinha.tur.br)
- Mapa interativo do site: 34 pontos (atrativos, gastronomia, hospedagem, compras, eventos) com nome e posição oficiais
  no minimapa e em placas (`scripts/fetch-turismo.mjs` → `public/data/turismo.json`).
- Monte da Fé no lugar oficial do site e refeito pelas fotos: cruz sobre o prédio branco do mirante, terraço e
  escadaria com corrimão preto, letreiro colorido "MONTE DA FÉ".
- Cascata da Solitária refeita pela foto do site: degraus largos de arenito com lâminas d'água, seixos e poço raso,
  alinhada ao arroio do mapa.
- Novos: Casa de Pedra (Stein Haus), Kinder Park (castelo do Alles Blau), Morro Alto da Pedra (balanço, rampa de voo
  livre e biruta; antigo "Morro da Asa Delta").
- Loja Piccadilly com painel vermelho e a McBenett em enxaimel com duas torres (foto Commons "Rs115-igrejinha.jpg").
- Centro Administrativo Prefeito Lauri Auri Krause: 3 pavimentos com faixas de vidro, pórtico, nome e mastros.
- Fábricas (Beira Rio, Usaflex, Piccadilly) com letreiro; pavilhões industriais com parede lisa e janelas altas no
  lugar de fileiras de janelas de apartamento.
- Pórtico do Parque de Eventos Almiro Grings pela foto atual do site: torres amarelas em enxaimel com sacada, telhado
  de dois níveis em telha alaranjada, portão de grade branca e o arco "Parque Municipal de Eventos / Almiro Grings".
- Correção: telhados de duas águas do Heidelberg, Casa de Pedra e McBenett com a inclinação certa.

## 2026-11-23 — Pontos montados a partir de fotos livres (Wikimedia Commons)
- Igreja Gabriel (IECLB, "do Relógio"): cor creme e ocre das fotos, portas e janelas em arco pleno, medalhão "1900",
  agulha octogonal.
- Cascata da Solitária: paredão de arenito avermelhado em ferradura, poço e queda d'água animada.
- Monte da Fé: cruz branca de 35 m no topo (iluminada à noite), deque do mirante voltado para a cidade e café.
- Edifício Heidelberg: torre de 11 andares em estilo enxaimel (branco com madeiramento escuro, telhado íngreme com
  torreões e mansardas), no lugar do prédio genérico.
- Fotos de referência listadas em docs/referencias.md; ajuste fino depois, com as fotos do diretor.

## 2026-11-23 — Uber
- Ponto de Uber na praça e uma placa em cada ponto marcante; de qualquer lugar, tecla U ou botão "Uber" (no lugar do
  "Carro", que não fazia nada — B-001) abre a lista com distância e preço; a viagem deixa ao lado da placa do destino.

## 2026-11-23 — Cadastro e zoneamento do GEO Igrejinha
- Pavimentos reais: área construída das unidades do cadastro imobiliário ÷ área do térreo (unidades agrupadas por
  edifício/endereço; condomínios de vários blocos divididos). 84 prédios com 5+ andares, 27 com 10+.
- Nome dos edifícios (Heidelberg, Dom Vidal, Monaco, Vivalar…) em placa perto do topo.
- HUD mostra onde você está: rua, número e bairro (cadastro + bairros do PDDURA 2020).
- Zona industrial do PDDURA vira galpão; pontos turísticos, 122 imóveis do inventário do patrimônio histórico e as feiras
  do produtor no minimapa.
- Pedestres por bairro conforme a densidade de moradores do Censo 2022 (88 setores censitários).
- Mata: 7 mil copas reais da imagem aérea fora das árvores urbanas, leves (sem sombra, até 1,2 km).
- Memória: dados brutos do mapa liberados depois da montagem (154 → 147 MB).
- Só campos úteis ao jogo são baixados do cadastro (sem inscrição, matrícula, ficha ou dados pessoais).

## 2026-11-23 — Dados reais da imagem aérea
- Telhados: cor real de 17 mil prédios tirada da imagem aérea da Prefeitura (`scripts/build-roofs.py`).
- Árvores: 9 mil copas reais detectadas na imagem aérea (`scripts/build-trees.py`) substituem as árvores sorteadas
  nas calçadas; tamanho pela copa medida.
- Telhados: formato lido na imagem aérea (laje, duas águas, quatro águas — novo) para 11 mil prédios.
- Chão: uso do solo real (GEO Igrejinha "Uso e Ocupação do Solo 2023": mata, campo, solo exposto, silvicultura);
  a imagem aérea é combinada por cima, e as áreas sem foto (antes brancas, como "neve" no morro) mostram o uso do solo.
- Ruas: o relevo simplificado à distância não passa mais por cima do asfalto (aparecia grama/foto na pista);
  trechos de avenida de pista dupla sem a pista irmã agora são desenhados com a largura inteira.
- Desempenho: árvores até 600 m e carros parados até 450 m, células de 400 m (2,36 mi triângulos).
- Teste de navegação mede o percentil 95 do tempo de rota (o pior caso isolado varia com o carregamento).
- Arroio da praça como valão de paredes retas; passarela de troncos; João Corrêa sem canteiro junto à praça.

## 2026-11-23 — Centro pelas fotos: Dorneles, João Corrêa e o arroio
- Arroio Koetz (e todos os arroios urbanos): onde cruza uma rua, passa por bueiro — a rua não afunda mais; muro de
  concreto com a boca do canal e guarda-corpo dos dois lados. Na praça, três passarelas de madeira em arco.
- Esquina Osvaldo Cruz × Dorneles: Panvel no canto certo (SE), sobrado Levi/Casa de Carnes/Escola de Música,
  residencial 592, fachada da Piccadilly 577.
- João Corrêa: Farmácias São João (SW da Dorneles), torre do Mercadão dos Óculos, Jair Cabeleireiro, Hashtag
  Presentes, Agafarma, rótula com canteiro na Castelo Branco, abrigo de telha e placas de direção na esquina da praça.

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
