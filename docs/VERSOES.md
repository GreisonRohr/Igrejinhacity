# Versões de teste publicadas

Link principal (sempre a versão mais nova): https://claude.ai/artifact/CNZdd4ZmBTbs9efaZmNJzF
Cada etapa também fica congelada num link próprio (rollback: abrir o link da etapa anterior; o código fica no commit
indicado e no tag local `etapa-N-*`).

| Etapa | Link congelado | Commit | Status |
|---|---|---|---|
| 1 · Mapa com GPS | https://claude.ai/artifact/DRwE91z3PLaSP5Edb8QgM5 | f8100f7 | estável (testes ok) |
| 2 · Veículos e direção | https://claude.ai/artifact/SMCCawX2FLJ8JdeFD61RPX | 6d0775f | estável (11/11 testes) |

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
