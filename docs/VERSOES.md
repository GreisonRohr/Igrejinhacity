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
