# Malha urbana — referência Bah City e correções no centro (25/11/2026)

## O que foi possível analisar do Bah City
- **Código-fonte: não há repositório público** (busca no GitHub sem resultado; perfil da Jogada Studio inacessível) e
  o jogo publicado não declara licença. Por isso **não foi clonado nem copiado** nenhum código ou asset.
- Analisado: o jogo rodando (capturas em jogo de sessões anteriores), o **índice público de dados**
  (`data/manifest.json`) e os nomes dos arquivos que o jogo carrega. O índice mostra a abordagem:
  - cidade pré-processada em blocos de 256 m (`tiles_t/b/d.bin`);
  - relevo da cidade em blocos próprios (`height_city.bin`), **remendos de altura** sob o pavimento
    (`height_patches.bin`) e **alturas de tabuleiro** de pontes/viadutos (`height_decks.bin`) — pavimento, ponte e
    terreno no mesmo modelo de altura, por isso não há chão furando a rua nem vão nas cabeceiras;
  - cruzamentos como uma superfície única, calçada contornando a esquina, faixa de pedestre na borda da via.

## Soluções adaptadas ao nosso código (mapa real de Igrejinha preservado)
| Problema no centro | Solução (inspirada no Bah City) | Onde |
|---|---|---|
| Terreno furando pista/calçada, desníveis | remendos de altura: terreno sob pista+calçada = perfil suavizado do eixo da rua, transição de 2 m (antes de montar o relevo) | `City.flattenStreets` |
| Pista larga abaixo do terreno (bueiro João Corrêa) | pista em faixas de até 3,5 m | `buildRoads` |
| Calçada/meio-fio atravessando a rua transversal | índice das pistas do centro; calçada, meio-fio e marcas somem dentro de pista transversal | `crossHalf` |
| Pavimento duplicado no cruzamento | asfalto sobreposto fica só com a via mais larga | `posFilt` |
| Faixa de pedestre dentro da outra via / no canteiro | faixa a (largura total da via transversal + 2,6 m); descarte se cair em outra via ou canteiro de pista dupla | `inCrossFull` |
| Vão/buraco entre ponte e rua | encontro de concreto sob cada ponta do tabuleiro | `buildBridge` |
| Prédios sobre a rua | contorno afastado para fora da calçada; blocos do entorno encaixados no lote | Centro 6 |
Zona de cuidado: centro + 45–75 m em volta das cabeceiras de ponte perto da cidade (Ponte Edmundo Kichler).

## Verificação
Suíte nova `malha` (nenhum prédio grande do centro sobre a pista) + `pontes` (28/28 travessias no tabuleiro).
