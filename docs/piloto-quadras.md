# Piloto de reconstrução urbana pelas quadras da Prefeitura

Data: 25/11/2026 · Base: Centro 7 (intacto) · Versão experimental separada (`?piloto` ou `npm run build:piloto`).

## O que faz

A rua inteira passa a ser derivada do **alinhamento predial oficial** (camada Quadras do GEO Igrejinha):

| Etapa | Como |
|---|---|
| Eixo de pista simples | raios perpendiculares do eixo OSM até as quadras dos dois lados (a cada 2 m); eixo no centro do vão; amostras com vão fora de 55–170% da largura de lei são descartadas (entrada de cruzamento, recuo), mediana móvel de ±8 m tira o que destoa |
| Eixo de pista dupla | cada pista ancorada na quadra do **seu** lado (calçada + meia pista da lei, `Passeio` do GEO); o canteiro é o que sobra entre as pistas (avenida assimétrica continua assimétrica) |
| Cruzamentos | o vértice compartilhado se move uma vez só: mínimos quadrados com as normais de todos os braços (cada braço "puxa" na sua direção); em volta do nó o deslocamento passa suavemente do nó ao da rua (4–16 m) |
| Curvas | a correção é um campo vetorial ao longo da via, suavizado (±6 m); vértices extras só onde o desvio passa de 15 cm (Douglas–Peucker) |
| Rótulas, pontes | anel de mão única detectado automaticamente e cabeceiras de ponte ficam fixos; acessos e retornos (`*_link`, serviço) seguem os nós |
| Inclinação | o piso é levantado vértice a vértice sobre o terreno (ladrilhos de 5 m alinhados à grade do relevo) |
| Calçada | borda da quadra deslocada pela largura da calçada da rua de frente (lei, sem chegar a menos de 2,6 m do eixo); aresta sem rua de frente não tem calçada |
| Esquina | arco tangente às duas linhas do meio-fio (raio 4 m, reduzido se a aresta for curta) |
| Canteiro central | entre as pistas da avenida, aberto onde outra via cruza (cruzamentos e retornos), nariz em quarto de círculo; gramado se for largo (> 2,6 m), concreto se estreito; ilha gramada no centro da rótula |
| Sem sobreposição nem vazio | todo ponto da caixa é classificado uma vez só: lote > canteiro > calçada > asfalto (varredura em faixas, por ladrilho); meio-fio só onde calçada/canteiro encontram o asfalto |
| Prédios | prédio do cadastro que passa da linha da quadra até 4 m volta para dentro do lote (vértice projetado na borda) |

Os dados originais (`world.data.json`, quadras) não mudam: a correção sai em `public/data/piloto.data.json`
(e `nav-piloto.data.json` para pedestres e trânsito) e só é aplicada com o piloto ligado.

Caixa piloto: x −190…60, z −60…410 (250 × 470 m) — Castelo Branco × João Corrêa (cruzamento complexo), avenida
dupla com canteiro e retornos até a rótula norte, cruzamentos simples da Dorneles, Dorneles em ladeira (4,5–5,4%),
rua curva a oeste, quadras irregulares ao longo da avenida, Praça Dona Luísa.

## Validação

Ver `docs/piloto-validacao.json` (gerado pelo build) e as imagens em `docs/piloto/`.

## Reaproveitar na cidade

Nada no código depende do centro: muda-se a caixa (`BOX` em `scripts/build-piloto.mjs`) ou se processa por regiões.
As 861 quadras da cidade passam pelo mesmo caminho; o que precisa de atenção antes de expandir está na seção de
problemas restantes do relatório.
