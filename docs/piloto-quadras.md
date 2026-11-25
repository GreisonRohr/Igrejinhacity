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

## Resultados (25/11/2026)

| Medida (caixa piloto) | Centro 7 | Piloto |
|---|---|---|
| Eixo fora do centro do vão (mediana / P90) | 1,39 m / 4,56 m | 0,06 m / 0,55 m |
| Calçada dentro de lote | 22,2% | 0% (por construção) |
| Pista dentro de lote | 3,4% | 1,1% |
| Pista de dados passando sob a calçada real | — | 2,6% |
| Eixo corrigido sobre o asfalto gerado | — | 98,5% |
| Prédios do cadastro avançando sobre calçada/rua | 60 de 186 | 7 (> 4 m, mantidos) |
| Pedestres no meio da pista (suíte) | 0 / 2038 | 0 / 2039 |
| Chamadas de desenho / triângulos / heap | 704 / 2248k / 113 MB | 707 / 2288k / 115 MB |

Testes: as 14 suítes passam no modo estável (idêntico ao Centro 7) e com `TEST_QS=&piloto`; a suíte `piloto` anda a pé
pela Castelo Branco × João Corrêa, atravessa o canteiro, contorna a rótula e sobe 130 m da Dorneles pela calçada
(maior degrau 0,15–0,23 m = meio-fio).

Imagens: `docs/piloto/jogo-*.jpg` (antes × depois no jogo) e `docs/piloto/ortofoto-*.jpg` (Centro 7 × piloto sobre a
ortofoto de 0,2 m/px).

## Problemas restantes

1. Rótula: linhas de borda das pistas ainda cruzam o anel; muitas faixas de pedestre nos acessos.
2. 7 prédios avançam mais de 4 m sobre o espaço público (cadastro × quadras divergem): revisar um a um com a foto.
3. Pista dupla perto da João Corrêa: sem canteiro (vão estreito); o nariz de canteiro junto à rótula é serrilhado.
4. Larguras de pista vêm da lei (GEO); onde a rua real é mais estreita, a borda pintada fica sob a calçada (2,6%).
5. Calçadão: a Rua Coberta não é via de pedestre no OSM; o espaço sem quadra nem pista fica terreno.
6. Transição na borda da caixa piloto: a malha antiga recomeça fora dela (corte reto).
7. Os 3 DWG da Prefeitura seguem sem conversão (podem trazer meio-fio real e confirmar as larguras).
