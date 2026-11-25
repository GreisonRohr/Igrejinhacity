# Versões de teste publicadas

Link principal (sempre a versão mais nova): https://claude.ai/artifact/CNZdd4ZmBTbs9efaZmNJzF
Cada etapa também fica congelada num link próprio (rollback: abrir o link da etapa anterior; o código fica no commit
indicado e no tag local `etapa-N-*`).

| Etapa | Link congelado | Commit | Status |
|---|---|---|---|
| 1 · Mapa com GPS | https://claude.ai/artifact/DRwE91z3PLaSP5Edb8QgM5 | f8100f7 | estável (testes ok) |
| 2 · Veículos e direção | https://claude.ai/artifact/SMCCawX2FLJ8JdeFD61RPX | 6d0775f | estável (11/11 testes) |
| Visual 1 · Carros 3D | https://claude.ai/artifact/N8TYCwn3UiPPMnD6uewzaY | f5ab102 | estável (11/11 testes) |
| Visual 2 · Personagens | https://claude.ai/artifact/PgvJTL1rzVxBTMr9UfZXs3 | 41ad70f | estável (12/12 testes) |
| Visual 3 · Carros reais | https://claude.ai/artifact/PeWkb3ghazynRuQxwBHbmu | a18cf1b | estável (12/12 testes) |
| Personagens da Oktoberfest | https://claude.ai/artifact/FNyG7b5F3j6Wz4YnvbYixs | 7e7ac8e | estável (12/12 testes) |
| Visual 4 · Chão e telhados reais | https://claude.ai/artifact/9odsEdHhFY4c79UNpk7xLy | bd54d14 | estável (12/12 testes) |
| Centro 1 · Ruas, calçadas e fachadas | https://claude.ai/artifact/7H2tG2xK6d4koe4nCUR9zp | a8df1d4 | estável (12/12 testes) |
| Centro 2 · Praça Dona Luiza | https://claude.ai/artifact/DW2bhXro7T11fTsLFVTueG | 99d0167 | estável (12/12 testes) |
| Centro 3 · Rua Coberta | https://claude.ai/artifact/AJuFpoPFNtGZj1EjVJ5Qam | 4d54a2b | estável (12/12 testes) |
| Centro 4 · Ambientação | https://claude.ai/artifact/4Keok1dgnzp8W5CWiEr1KS | 16bdd00 | estável (12/12 testes) |
| Centro 5 · Bordas da praça e do arroio | https://claude.ai/artifact/C1N2haTFV5BDLifGrd5A61 | 45dd3e7 | estável (12/12 testes) |

## O que testar

### Etapa 1 — Mapa com GPS
- M (ou toque no radar) abre/fecha; arrastar, zoom (roda/pinça/botões), ◎ volta para você.
- Buscar "Independência 478", "Casa de Pedra", "Oktoberfest", uma rua sua; tocar num resultado marca o destino.
- Rota roxa no mapa e no radar, distância no painel de cima; andar e ver a distância cair; chegar e ver o aviso.
- Toque/clique no mapa marca destino; botão direito remove; toque duplo/duplo clique leva até lá.

### Etapa 2 — Veículos e direção
- Chegar perto de um carro estacionado: aparece "F · entrar no carro" / botão CARRO.
- Acelerar (W / joystick para cima), frear e dar ré (S / joystick para baixo), virar, freio de mão (Espaço).
- Buzina (H), câmera do capô (C), desvirar/desatolar (R), velocímetro.
- Bater num prédio (repica), subir ladeira, sair da rua (fica mais lento).
- Sair (F / CARRO) parado; voltar ao carro deixado e entrar de novo; com o GPS ligado, a rota passa a ser de carro.
- No celular: os botões de pedal ainda não existem (usa o joystick) — ver problemas conhecidos.

### Visual 1 — Carros 3D (Kenney Car Kit, CC0)
- Entrar num carro (F): o carro dirigido é um modelo 3D (sedã, hatch, SUV, táxi, van, picape…); rodas giram e esterçam.
- Andar pela rua: os carros estacionados perto (até ~50 m) são os mesmos modelos 3D; longe, os simplificados.
- Comparar com o link da Etapa 2. No celular: ver se a carga e o FPS ficaram iguais.
- Conhecido: a troca do carro simplificado para o 3D aparece ao se aproximar (≈50 m); a cor vem da textura do pacote.

### Visual 2 — Personagens (Quaternius CC0)
- Protagonista novo: andar (joystick/WASD), correr (Shift / joystick no fim), parar — a passada muda de ritmo sem
  "pulo" entre andar, trote e corrida; ao virar, o corpo gira aos poucos (correndo, a curva é mais aberta).
- Pular, sentar perto de alguém (pedestres sentados), conversar (E): transições suaves.
- Pedestres próximos: mangas, shorts e roupa mais solta (correção); comparar com o link da Visual 1.
- No celular: carga, FPS e aquecimento do aparelho em 5 min de passeio pela praça.
- Conhecido: roupa é pintada sobre o corpo base (sem malha de roupa); pedestres a mais de ~25–30 m ainda são os
  bonecos feitos em código; uma pausa única de coleta de memória pode ocorrer logo após a carga.

### Visual 3 — Carros reais (Honda City 2017 e Peugeot 206, Sketchfab CC BY 4.0)
- Estacionados perto (até ~42 m; 35 m no celular): os dois modelos em 10 cores; mais longe, os simplificados.
- F para entrar: o carro dirigido é o mesmo modelo e a mesma cor; rodas giram e esterçam; faróis à noite, luz de freio.
- Bater, frear, ré, sair; comparar com a Visual 2.

### Personagens da Oktoberfest (Lukas e Anna)
- Tela inicial: escolher Lukas (lederhosen) ou Anna (dirndl), girar arrastando, Jogar.
- Andar, correr, pular, entrar no carro com cada um; câmera perto para ver o traje.
- Esc ou ☰: menu → Trocar personagem (troca na hora). Fechar e reabrir o jogo: a escolha vem marcada.

### Visual 4 — Chão e telhados reais (Poly Haven CC0)
- Andar pelas ruas do centro: asfalto com trincas e relevo, calçada de bloquete, ruas de paralelepípedo de basalto.
- Olhar os telhados de cima (câmera alta ou ponte): telha de barro com relevo; lajes lisas.
- Comparar com o link anterior (Personagens da Oktoberfest); conferir no celular se a carga continua igual.

### Centro 1 — ruas, calçadas e fachadas da região central
- Andar pelas 4 ruas da praça (Castelo Branco, Dorneles, Oswaldo Cruz/Rua Coberta, João Corrêa): asfalto grafite,
  calçada de lajota cinza, meio-fio amarelo nas esquinas, faixas que param antes da faixa de pedestre.
- Térreos com letreiros legíveis (Banco do Brasil, Supermercado Dia, Casa do Artesão e tipos de comércio),
  sacadas nos prédios altos, sobrados históricos coloridos; à noite, letreiros acesos.
- Sair do centro: o resto da cidade fica como antes.

### Centro 2 — Praça Dona Luiza
- Andar pela praça: copa fechada de figueiras nas posições reais (ortofoto), chão sombreado; vista de cima parecida
  com a foto aérea.
- Pérgola com trepadeira e palmeiras ao longo dela; parquinho, arroio e passarela como antes.
- À noite: luz quente dos lampiões no piso dos caminhos.
- No celular: conferir fluidez dentro da praça (mais árvores detalhadas).

### Centro 3 — Rua Coberta e lojas da Dorneles
- Rua Coberta de dia e à noite: luminárias sob os arcos, luz no asfalto; fábrica Piccadilly ao lado com faixas e marquises.
- R. Gen. Ernesto Dorneles: Farmácias São João, Kosmus, Trilegal, Hashtag Presentes com letreiro e cores próprias.

### Centro 4 — ambientação (fotos de 24/11)
- Esquina Castelo Branco × João Corrêa: floreira redonda (pedra, anel amarelo, flores).
- (Correção posterior no link principal: removidas as floreiras/bancos da João Corrêa — lá é o estacionamento da São João.)
- R. Gen. Ernesto Dorneles, lado da Rua Coberta: letreiro PICCADILLY vertical no pavilhão.

### Centro 5 — bordas da praça e do arroio
- Contorno da praça nas 4 ruas: o piso, a grama e as árvores param na calçada; nada sobre o asfalto.
- Travessias do arroio (João Corrêa e Dorneles): sem bambu/mato/paredes na rua; canal termina no nível da calçada.
- Dirigir pela João Corrêa sobre o bueiro: pista lisa, sem manchas de chão.
