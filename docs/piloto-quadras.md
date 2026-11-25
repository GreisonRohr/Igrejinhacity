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

## Correções antes da expansão (25/11/2026)

1. **Rótula**: sem pintura de faixa dentro do anel e até 12 m em volta; uma faixa de pedestre por acesso (nenhuma sobre o
   anel, nenhuma fora do asfalto, mínimo de 10 m entre elas perto da rótula); ilha central gramada.
2. **Borda da região**: onde cada via sai, o build mede meio-fio e borda da calçada do piloto; fora, a malha antiga começa
   com essas medidas, volta às do dado em 25 m e entra 3 m na região (sem fresta nem degrau).
3. **7 prédios > 4 m** (revisados na ortofoto, `docs/piloto/predios-7-revisao.jpg`, nenhum movido):
   - #290 (−156,183), #292 (−147,192), #5545 (−150,100), #18960 (−110,400): casas reais; a linha da quadra corta o telhado
     (quadra desenhada para dentro do que foi construído);
   - #2679 (−1,−92): galpão real, avanço numa quina;
   - #11039 (13,172): contorno do Google ~5 m deslocado para a rua (o telhado real está dentro do lote) — corrigir à mão;
   - #29404 (4,−53): a própria cobertura da Rua Coberta (fica sobre a rua mesmo).
4. **Canteiro**: largura suavizada (mediana + média), sem pontas finas; **pista dupla detectada pela geometria** (mão única,
   mesmo nome, paralela e oposta a até 25 m) — o trecho da Castelo Branco ao sul da João Corrêa vinha sem marcação de
   canteiro no OSM e era centrado no vão da avenida inteira (7 m fora). Canteiro ao sul da João Corrêa: a foto mostra uma
   floreira estreita, mas a seção oficial (R-24) diz "canteiro 0" e as larguras de lei não cabem no vão real (21 m): fica
   sem canteiro até haver medida (DWG ou levantamento).
5. **Rua Coberta**: identificada pela camada Praças e Espaços de Lazer da Prefeitura (polígono "Rua Coberta", 100% fora de
   quadra) → calçadão, sem depender do OSM; sem vagas de carro sobre ela.

## Expansão por etapas (cada uma validada e publicada à parte)

| Etapa | Área (x0,z0,x1,z1) | Link congelado | Suítes | Chamadas / triângulos / heap |
|---|---|---|---|---|
| 1 Piloto revisado | −190,−60,60,410 | https://claude.ai/artifact/E9eTcVH8nxiJDnAS8gA31z | 14/14 | 702 / 2286k / 115 MB |
| 2 Centro leste | + 60,−60,360,410 | https://claude.ai/artifact/W9w5HUJjAoqqvYT4swftPd | 14/14 | 707 / 2317k / 117 MB |
| 3 Centro norte | + −130,−480,360,−60 | https://claude.ai/artifact/UYGVFacDMaXZf3FkYVNRFL | 14/14 | 703 / 2336k / 117 MB |
| 4 Centro inteiro | + 360,−300,640,330 | https://claude.ai/artifact/4KiPGeX2W93wtJexKqtQUf | 14/14 | 703 / 2347k / 118 MB |
| Centro 7 (estável) | — | link principal (inalterado) | 14/14 | 704 / 2248k / 113 MB |

Validação numérica de cada etapa (build): eixo fora do centro P90 0,21–0,34 m (antes 2,6–3,6 m); calçada dentro de lote
0% (antes 22–27%); pista dentro de lote 0,8–2,3% (antes 2,3–3,4%). Imagens: `docs/piloto/etapa*-ortofoto.jpg`.

**Rollback**: cada etapa tem os dados congelados (`public/data/piloto-e<n>.data.json`), o build reproduzível
(`sh scripts/etapa-piloto.sh <n>`) e o link publicado acima; o Centro 7 não depende de nada disso (o piloto só liga com
`?piloto` ou no build experimental).

## Problemas restantes

1. Vias urbanas sem calçada no cadastro recebem 2,2 m por padrão: rodovia junto à mata (leste) ganhou calçada onde há grama.
2. Floreira da Castelo Branco ao sul da João Corrêa e larguras reais menores que as da lei (pista de dado sob a calçada 2,6–3,8%).
3. Prédio #11039 (contorno do Google deslocado): corrigir à mão.
4. Trevo leste da rodovia: ilhas aproximadas (o OSM tem poucos vértices ali).
5. Os 3 DWG da Prefeitura continuam sem conversão.
