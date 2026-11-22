# Bugs conhecidos — Igrejinha City

Severidade: **S1** quebra o jogo · **S2** quebra uma função · **S3** visual/incômodo · **S4** cosmético.

| ID | Sev | Descrição | Onde | Status |
|---|---|---|---|---|
| B-001 | S2 | Botão "Carro"/tecla E longe do Waldir e de pessoas não faz nada (carro ainda não implementado) | `main.js` input `act` | aberto → Ciclo 4 |
| B-003 | S3 | Placas de nome se sobrepõem no centro ("Rua Coberta" × "Piccadilly (fábrica)") | `labels.js` | aberto |
| B-004 | S3 | Câmera volta sozinha para trás do jogador após 2 s andando | `camera.js` | aberto → P2-6 |
| B-005 | S3 | Chão de perto borrado (textura ≈1,9 m/px) | `ground.js` | aberto → P2-4 |
| B-007 | S3 | Mesas e bancos da Oktoberfest/praça sem colisão (atravessáveis) | `oktoberfest.js`, `landmarks3d.js` | aberto |
| B-008 | S4 | HUD de hora pode mostrar a hora anterior por 1 quadro após mudar a hora via teste | `main.js` | aberto |
| B-009 | S3 | Carros estacionados são caixas (sem para-choques, faróis, rodas embutidas) | `streetlife.js` | aberto → P2 |
| B-012 | S4 | Pedestres ainda não esperam carros (não há trânsito); atravessam após olhar | `pedestrians.js` | aberto → Ciclo 5 |
| B-013 | S4 | Algumas avenidas largas (GEO: 22 m por sentido) sobrepõem as calçadas da outra pista; pedestres às vezes andam pela borda | dados / `city.js` | aberto |
| B-011 | S3 | Carregamento ainda leva ~13 s em emulação (sem congelar); alvo 5 s | carga | aberto → Worker (P2) |

## Resolvidos
| ID | Descrição | Como |
|---|---|---|
| B-002 | Tela congelava 4–8 s na carga (até 7,2 s num bloco) | montagem em etapas com barra; envio à GPU em lotes; shaders pré-compilados com compileAsync (maior bloco 0,82 s) |
| B-010 | Heap 214 MB (acima de 150) | 119 MB de geometria nunca enviada à GPU ficava em memória: envio em lotes na carga → 140 MB |
| B-R01 | Jogador caía no rio ao atravessar pontes | cabeceiras sem escavação, tabuleiro no nível da rua, chão de ponte por cabeceira (26/26) |
| B-R02 | "Prédio" do Google sobre a Ponte do Centro | remoção de prédios sobre pontes e no leito do rio |
| B-R03 | Água "subindo" nas curvas do rio | nível = mínimo da linha central num raio de 45 m |
| B-R04 | 954 MB de heap (lixo não coletado) / 327 MB retidos | cópias CPU liberadas após envio à GPU |
| B-R05 | 547 draw calls só de pontos marcantes | materiais compartilhados + merge por célula |
| B-R06 | Carros quase pretos (material metálico sem ambiente) | metalness 0,05 |
| B-006 | Cobertura da Rua Coberta azulada/transparente | policarbonato bege fosco com nervuras e sombra (fotos abr/2026) |
| B-R08 | Pista dupla com calçada no canteiro central (sentido do OSM ignorado) | calçada à direita do sentido, canteiro gramado à esquerda; pedestres e árvores corrigidos |
| B-R07 | Carro estacionado na cabeceira bloqueava ponte | zona livre de 25 m nas cabeceiras |
