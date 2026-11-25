# Auditoria do GEO Igrejinha — o que existe, o que usamos, o que dá para automatizar

Data: 25/11/2026 · Base: Centro 7 (versão estável, não alterada) · Testes em `?quadras` e `?quadras=eixo`.

Fontes verificadas (todas abertas nesta auditoria, não presumidas):

- **Geoportal NextGIS da Prefeitura** (`pmirs.nextgis.com`): árvore completa de recursos percorrida —
  **380 camadas (203 vetoriais, 177 raster)** em 19 grupos. Lista em `docs/geo-camadas.txt`.
- **Google Drive "Dados para Download"** (`sites.google.com/view/geoigrejinha/dados-para-download`):
  pasta *Imagens Aéreas* (1989, 2013, 2016, Lajeadinho 2021, Planta Cadastral 1989) e pasta *CAD* com 3 DWG.
- Fontes externas já usadas: OpenStreetMap, AWS Terrain Tiles (relevo de satélite), Google Open Buildings 2024
  (servido pelo próprio geoportal).

## 1. Inventário

### Arquivos baixados (`data/raw/geoigrejinha/`)

| Arquivo | Feições | Usado? | Onde / para quê |
|---|---|---|---|
| edificacoes | 11.091 | sim | `geo-igrejinha.mjs`: contorno de todos os prédios da Prefeitura |
| open_buildings_google_2024 | 36.341 | sim | prédios que a Prefeitura não tem (rural, novos) |
| ruas_estradas (PDDURA 2020) | 1.112 | sim | pavimento, largura de faixas, passeio e canteiro por rua (`enrichRoads`) |
| curvas_1m / 4m / 10m | 19.222 / 3.674 / 1.468 | sim | relevo (`build-terrain.mjs`, grade de 5 m) |
| uso_solo_2023 | 72.969 | sim | cor do chão (`landuse.webp`) |
| cadastro_enderecos | 17.630 | sim | área construída → pavimentos (prédios grandes), nomes de edifícios, endereços |
| zoneamento | 58 | sim | prédios industriais |
| rio_paranhana, lagos, hidro_urbana | 1 / 350 / 498 | sim | rio, lagos e arroios |
| pracas_lazer, cemiterios_poligonal, escolas, saude, pontes, pontos_referencia, localidades, paradas_onibus, ciclovias, pontos_turisticos, patrimonio_inventario, feiras, censo2022, bairros | — | sim | áreas, lugares, rótulos, HUD |
| **quadras** | 861 | **não** (baixado e nunca lido) | — |
| hidro_trechos, hidro_urbana_projetada | 14 / 51 | não | — |
| linhas_onibus | 2.454 | não | — |
| patrimonio_historico (pontos) | — | não (usa-se o inventário) | — |
| limite_municipal | 1 | não | — |
| Imagem Aérea 2016 (TIFF 0,2 m/px, 95 MB) | — | sim, **reduzida a 0,625 m/px** | chão perto da câmera, cor e forma dos telhados, árvores |

### Baixados nesta auditoria (antes não estavam no projeto)

| Camada (id) | Feições | Conteúdo real (aberto) |
|---|---|---|
| Lotes (7579) | 13.465 | polígono de cada lote — gravado **só a geometria** (inscrição/setor/quadra/lote removidos) |
| Sistema Viário Igrejinha (7287) | 2.540 | eixos com gabarito, largura total, faixas, passeio, estacionamento, canteiro (2,3× mais trechos que `ruas_estradas`) |
| Drenagem — caixas (7546) e rede (7548) | 2.469 / 1.561 | bocas de lobo e tubos (diâmetro); **nenhuma no centro** |
| Mapa Original Diretrizes Viárias (9028) | 15.346 | polígonos vetorizados de um mapa antigo (só `DN=0`): pouco útil |
| Censo 2022 — Faces de Logradouros (10814) | 2.912 | face de quadra com nº de domicílios |
| **3 DWG da Prefeitura** (Cadastrais 11 MB, Relevo 85 MB, Temáticos 34 MB) | — | baixados, formato AutoCAD 2013–2017; **não foi possível abrir aqui** (ver §4) |

### Disponível e não baixado (por que importa ou não)

| Grupo | Camadas | Valor para o jogo |
|---|---|---|
| Relevo | Relevo Urbano / Rural (raster), Declividades | baixo: as curvas de 1 m já estão no terreno |
| Hidrografia | Hidrografia CPRM 1:12.500, IEDE 1:25.000, Banhados, Nascentes, Sub-bacias, canais e cabeceiras (morfometria) | médio fora do centro (arroios na serra) |
| Defesa Civil | manchas de inundação 2020/2023/2024/2026, cotas de enchente 1982, deslizamentos | futuro (eventos de clima), não para geometria |
| Imagens Aéreas 1989 / 2013, Plantas Cadastrais 1989 | raster | 2013: alternativa sem sombra/árvore diferente; 1989: histórico |
| Loteamentos digitalizados | 148 plantas raster | baixo |
| Plano Diretor | recuos (4 m comércio/residencial, 6 m indústria, 8 m rodovia), faixa de domínio | **médio**: recuo legal para posicionar casas automaticamente |
| Censo 2022 | setores, densidade, domicílios | médio: densidade de pedestres e de casas por bairro |
| Mobilidade | Rede viária PD Mobilidade (anexos), Pontes PD (19) | médio: hierarquia de vias para trânsito |

### O que os dados NÃO têm (verificado)

- **Altura dos prédios**: o campo `Pavimento` das edificações está zerado em 11.020 de 11.091 prédios (só 6 têm valor);
  `Nro de Pavimentos` do cadastro está zerado em 17.615 de 17.630 registros. A Prefeitura não publica altura.
  Hoje: área construída do cadastro ÷ área do térreo (prédios grandes) e **sorteio** no resto (`heightFor`).
- **Drenagem no centro**: zero bocas de lobo cadastradas na caixa do centro.

## 2. Origem de cada elemento do jogo hoje

| Elemento | Origem | Dado / procedural / manual |
|---|---|---|
| Coordenadas | projeção local a partir da Praça Dona Luísa (`src/geo.js`) | dado |
| Ruas (eixo) | **OSM** | dado (OSM, não Prefeitura) |
| Ruas (largura, pavimento, canteiro) | GEO `ruas_estradas` casado ao eixo OSM | dado |
| Calçadas | largura do GEO (`Passeio`), desenhada **paralela ao eixo OSM** | dado + procedural |
| Esquinas, faixas de pedestre, meio-fio | regras no código (Centro 7) | procedural |
| Terreno / altitude | curvas 1/4/10 m + satélite, grade 5 m, remendos sob as ruas | dado + procedural |
| Edificações (contorno) | Prefeitura → Google → OSM | dado |
| Edificações (altura) | cadastro (só prédios grandes) + **sorteio** | procedural |
| Telhados | cor e forma lidas da ortofoto | dado (imagem) |
| Fachadas, letreiros, sacadas | código + nomes do cadastro/OSM | procedural + manual (centro) |
| Rio, lagos, arroios | GEO | dado |
| Pontes | OSM + pontos de ponte do GEO | dado + procedural |
| Quadras e lotes | **não usados** | — |
| Árvores | ortofoto + uso do solo | dado + procedural |
| Texturas do chão | uso do solo 2023 + ortofoto 0,625 m/px | dado |
| Praça, Rua Coberta, Igreja, pórticos | modelados à mão a partir de fotos | manual |

## 3. Subutilizado

1. **Quadras** (baixadas, nunca usadas): são o alinhamento predial oficial — o limite exato entre rua e lote.
2. **Lotes**: divisão real dos terrenos; os prédios da Prefeitura caem dentro deles (verificado na sobreposição).
3. **Eixo das ruas**: usamos OSM; medido contra as quadras, o eixo fica deslocado 0,3–2,2 m na maioria das ruas do
   centro e **4,8–7,5 m na Castelo Branco** (tabela abaixo).
4. **Ortofoto**: temos 0,2 m/px e usamos 0,625 m/px (faixas, vagas e meio-fio ficam legíveis no original).
5. **Sistema Viário completo** (2.540 trechos) em vez de `ruas_estradas` (1.112).
6. **Recuos do Plano Diretor** para posicionar casas no lote sem ajuste manual.

Faixa de domínio real (quadra a quadra) × largura que o jogo desenha, no centro (`docs/geo-larguras.txt`):

| Rua | Real (m) | Jogo (m) | Eixo OSM deslocado (m) |
|---|---|---|---|
| Castelo Branco (cada pista) | 25,7 | 12,0 | −4,8 |
| Castelo Branco (trecho simples) | 24,3 | 16,0 | −7,5 |
| Independência | 15,1 | 16,0 | 1,2 |
| Gen. Ernesto Dorneles | 16,3 | 16,0 | −0,4 |
| João Corrêa | 13,1 | 16,0 | 0,3 |
| João Lourenço Schaefer | 17,8 | 18,0 | −0,7 |
| Oswaldo Cruz | 17,8 | 18,0 | −2,2 |
| Benjamin Constant | 14,9 | 16,0 | −1,1 |
| Ary Delmar Koppe | 21,3 | 18,0 | −1,8 |

## 4. Testes práticos

| Teste | Resultado |
|---|---|
| Relevo do jogo × curvas de 1 m (1.661 vértices de curva no centro) | viés 0,01 m, **RMS 0,29 m**, P90 0,49 m, máx 1,63 m → no centro o relevo já está fiel; refinar a grade não compensa ali |
| Sobreposição na ortofoto 0,2 m: quadras, lotes, edificações, malha do jogo | quadras e lotes batem com o chão da foto; a borda de calçada do jogo invade a praça (lado leste) e lotes em vários trechos |
| **Calçada pela quadra** (`?quadras`, caixa piloto em volta da praça) | calçada e meio-fio saem da borda real da quadra, **esquina arredondada automática** (arco em volta da quina), asfalto até a quadra (sem terra entre pista e calçada) |
| **Quadra + eixo centrado** (`?quadras=eixo`) | eixo OSM movido para o meio do vão entre quadras; resolve a calçada que invadia a pista (só 2 vértices movidos: precisa reamostrar o eixo antes — próximo passo) |
| Desempenho do piloto | 708 → 708 chamadas de desenho; 2.203k → 2.207k triângulos |
| Abrir os DWG | **bloqueado**: não há conversor DWG instalado e compilar o LibreDWG não foi permitido neste ambiente. Precisa de autorização para compilar, ou de um DXF exportado pela Prefeitura/diretor |

Capturas: `docs/auditoria-geo/` (antes × calçada pela quadra × eixo centrado, sobreposições na ortofoto).

## 5. As 5 melhores oportunidades

1. **Malha viária pelas quadras** — faixa de domínio = espaço entre quadras; eixo = linha média desse espaço;
   pista pela largura do GEO; calçada = da quadra até o meio-fio (Passeio do GEO). Esquinas arredondadas, canteiros
   e larguras saem sozinhos. Substitui boa parte das regras manuais do Centro 5–7 e do módulo de cruzamentos em
   andamento.
2. **Prédios por lote** — cada prédio da Prefeitura é associado ao lote; frente = aresta do lote voltada para a rua;
   recuo do Plano Diretor quando a foto mostra recuo. Elimina o "empurra prédio para fora da rua" (Centro 6).
3. **Ortofoto em 0,2 m/px no centro** — textura de chão fiel (faixas, vagas, canteiros) e detecção automática de
   faixas de pedestre e vagas a partir da imagem.
4. **Altura estimada pela sombra na ortofoto** (o GEO não tem altura) — comprimento da sombra × ângulo do sol da
   foto; testar no centro contra os prédios que conhecemos (Heidelberg, 11 pavimentos).
5. **DWG cadastral/relevo** — se trouxer meio-fio, calçada ou cotas de soleira, vira a fonte mais precisa de todas
   (depende de converter o arquivo).

## 6. Trabalho manual que dá para eliminar (estimativa)

| Hoje à mão / por regra | Com o pipeline novo |
|---|---|
| Ajuste de largura e exceções por rua (João Corrêa sem canteiro etc.) | largura vem da quadra + GEO |
| Esquinas, recortes de cruzamento, faixas fora da calçada (Centro 5–7, ~400 linhas) | geometria da quadra; regras só para faixas de pedestre |
| Empurrar prédios para fora da rua, `fitBox` do entorno | prédio dentro do lote por construção |
| Ajuste de calçada na praça e na Rua Coberta | borda da quadra da praça |

Ordem de grandeza: **60–70% do ajuste manual de malha urbana** do centro, e o mesmo código serve para a cidade inteira
(861 quadras, 13.465 lotes), em vez de repetir o ajuste quadra a quadra.

## 7. Pipeline proposto

1. `fetch` — camadas do GEO (já automatizado) + Sistema Viário + Lotes (geometria) + ortofoto 0,2 m.
2. `faixa de domínio` — área urbana menos quadras = espaço público (ruas e praças).
3. `eixos` — eixo OSM reamostrado a cada 2 m e centrado no vão entre quadras (ou eixo do Sistema Viário da
   Prefeitura); nomes e hierarquia do OSM/GEO.
4. `seção transversal` — pista (Faixa + Estacionamento do GEO), calçada (da quadra até o meio-fio), canteiro.
5. `cruzamentos` — asfalto único na interseção das faixas de domínio; meio-fio em arco (vem da quadra).
6. `lotes → prédios` — prédio da Prefeitura no seu lote; frente para a rua; altura = cadastro → sombra → sorteio.
7. `relevo` — curvas de 1 m (já), aplainado sob a faixa de domínio inteira.
8. `textura` — ortofoto 0,2 m no centro, 0,625 m no resto; uso do solo longe.
9. `validação automática` — sobreposição na ortofoto + testes: nenhum prédio fora do lote, nenhuma calçada na pista,
   eixo a menos de 0,5 m do centro do vão.

Piloto sugerido: aplicar os passos 2–5 na caixa da praça (já testada), comparar, e só então estender ao centro.
