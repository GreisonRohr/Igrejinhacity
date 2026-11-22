# Bugs conhecidos — Igrejinha City

Severidade: **S1** quebra o jogo · **S2** quebra uma função · **S3** visual/incômodo · **S4** cosmético.

| ID | Sev | Descrição | Onde | Status |
|---|---|---|---|---|
| B-001 | S2 | Botão "Carro"/tecla E longe do Waldir não faz nada (carro ainda não implementado) | `main.js` input `act` | aberto → Ciclo 4 |
| B-002 | S2 | Tela congela 4–8 s ao carregar (montagem síncrona) | `main.js`, `city.build` | aberto → Ciclo 1 |
| B-003 | S3 | Placas de nome se sobrepõem no centro ("Rua Coberta" × "Piccadilly (fábrica)") | `labels.js` | aberto |
| B-004 | S3 | Câmera volta sozinha para trás do jogador após 2 s andando | `camera.js` | aberto → P2-6 |
| B-005 | S3 | Chão de perto borrado (textura ≈1,9 m/px) | `ground.js` | aberto → P2-4 |
| B-006 | S3 | Cobertura da Rua Coberta azulada/transparente; real é bege opaca | `landmarks3d.js` | aberto (fotos já recebidas) |
| B-007 | S3 | Mesas e bancos da Oktoberfest/praça sem colisão (atravessáveis) | `oktoberfest.js`, `landmarks3d.js` | aberto |
| B-008 | S4 | HUD de hora pode mostrar a hora anterior por 1 quadro após mudar a hora via teste | `main.js` | aberto |
| B-009 | S3 | Carros estacionados são caixas (sem para-choques, faróis, rodas embutidas) | `streetlife.js` | aberto → P2 |
| B-010 | S2 | Heap 214 MB acima do orçamento de celular (150 MB) | geral | aberto → Ciclo 1 |

## Resolvidos
| ID | Descrição | Como |
|---|---|---|
| B-R01 | Jogador caía no rio ao atravessar pontes | cabeceiras sem escavação, tabuleiro no nível da rua, chão de ponte por cabeceira (26/26) |
| B-R02 | "Prédio" do Google sobre a Ponte do Centro | remoção de prédios sobre pontes e no leito do rio |
| B-R03 | Água "subindo" nas curvas do rio | nível = mínimo da linha central num raio de 45 m |
| B-R04 | 954 MB de heap (lixo não coletado) / 327 MB retidos | cópias CPU liberadas após envio à GPU |
| B-R05 | 547 draw calls só de pontos marcantes | materiais compartilhados + merge por célula |
| B-R06 | Carros quase pretos (material metálico sem ambiente) | metalness 0,05 |
| B-R07 | Carro estacionado na cabeceira bloqueava ponte | zona livre de 25 m nas cabeceiras |
