# Auditoria visual — Bah City × Igrejinha City

Data: 24/11/2026 · Fontes: partidas no Bah City (navegador automatizado, capturas em jogo e da tela de carga), créditos
do próprio jogo, nomes dos arquivos que ele baixa (só a lista de rede — nenhum arquivo dele foi baixado ou reutilizado),
capturas do Igrejinha City (`tests/out/`, versão "Personagens da Oktoberfest").

## O que faz o Bah City bonito (resumo)

1. **Superfícies fotográficas com relevo** em tudo que o jogador vê de perto: 15 texturas de chão com mapa normal
   (asfalto, remendo, paralelepípedo, calçada, petit-pavé, basalto, grama, grama seca, terra, areia, chão de mata,
   concreto, ciclovia, cimentado, lajota, tijolo), 4 de telhado (cerâmica, laje, fibrocimento, metal) e uma imagem de
   uso do solo que decide qual vai onde.
2. **Fachadas por foto**: 20 fachadas típicas de Porto Alegre (prédio bege, pastilha azul/ocre/verde, art déco,
   eclético, comércio de vidro/aço, institucional, industrial, obra) com máscara de janelas (acendem à noite) e de
   material.
3. **Árvores por espécie local** (jacarandá, tipuana, ipê, figueira, jerivá, araucária, eucalipto, extremosa): copa
   de cartões com recorte de folhas fotográfico, casca própria, mato rasteiro (capim, arbusto, ervas, mamona, samambaia).
4. **Modelos reais de veículos e pessoas** (Sketchfab, a maioria CC BY 4.0), adaptados.
5. **Densidade de vida urbana**: carros estacionados em fila, motos, patinetes, bancas, outdoors, postos, grafite,
   vitrines por tipo de loja, fiação, postes.
6. **Atmosfera**: névoa azulada na distância, céu claro, sombra suave, noite com postes quentes e janelas acesas.

## Comparação por elemento

| Elemento | Bah City | Igrejinha City (hoje) | Inferior em quê | Melhoria | Asset/tecnologia (licença) |
|---|---|---|---|---|---|
| Carros | ~30 modelos reais BR (Onix, HB20, Argo, Uno, Hilux, ônibus Marcopolo…) | Honda City e Peugeot 206 reais (CC BY) perto; caixas simplificadas longe | pouca variedade; longe = caixas | mais 2–4 modelos por etapa; LOD distante com o nível leve real | os 23 originais CC BY já baixados (lista em `docs/estudo-bahcity.md`); conversor `scripts/convert-car.mjs` |
| Personagens | 20 avatares Ready Player Me com roupa modelada | Quaternius CC0 com roupa pintada; protagonistas com traje típico | roupa sem volume; pedestres distantes são bonecos | pedestres com avatares reais de roupa modelada | 13 avatares CC BY baixados (Sketchfab, créditos do Bah City); animações CC0 já no jogo (redirecionar) |
| Árvores | copas de cartões fotográficos por espécie, casca real | troncos curvos + cartões de folha gerados em código | folhas sem foto, poucas espécies | cartões de copa com foto de folhas recortadas por espécie de Igrejinha (ipê, jacarandá, extremosa, jerivá, figueira, pinus) | texturas de folhas/casca CC0 (Poly Haven) ou fotos próprias; recriar (as do Bah City não têm licença) |
| Vegetação rasteira | 5 tipos de mato fotográfico | tufos em código, grama do relevo | pouco variada | cartões de capim/arbusto com foto | Poly Haven CC0 |
| Casas e prédios | 20 fachadas fotográficas + máscaras | fachada em código (atlas de janelas, cores) | sem textura de reboco, janelas iguais | reboco/pastilha/tijolo reais + janelas por estilo | Poly Haven CC0 (plaster, brick, concrete) + janelas desenhadas; fotos de Igrejinha só como referência |
| Telhados | 4 materiais com relevo | **agora:** telha de barro real com relevo; laje lisa | fibrocimento/metal ainda iguais à telha | variar por tipo de prédio | Poly Haven CC0 (`corrugated_iron`, `grey_roof_tiles`) |
| Praças | praças com piso real e mobiliário | Praça Dona Luísa reconstruída (dossiê), pisos em código | pisos sem foto | piso real (petit-pavé, basalto, lajota) | Poly Haven CC0 |
| Calçadas | basalto escuro, petit-pavé, lajota | **agora:** bloquete de concreto real com relevo | um só tipo | variar por rua (basalto no centro, concreto nos bairros) | Poly Haven CC0 |
| Ruas | asfalto escuro + remendos + faixas | **agora:** asfalto real com trincas e relevo; paralelepípedo de basalto real | asfalto ainda claro, sem remendos | tom mais escuro, remendos, faixas mais nítidas | Poly Haven CC0 (`asphalt_02`, `road_damaged`) |
| Mobiliário urbano | bancas, outdoors, postes, fiação, lixeiras | bancos, postes, lixeiras, fiação em código | detalhe baixo | modelos reais para banco, lixeira, hidrante, abrigo de ônibus | Poly Haven modelos CC0; Sketchfab CC BY |
| Texturas de chão (relevo) | 15 com mapa normal + mapa de uso do solo | relevo com ortofoto + sombreamento | grama sem textura próxima | textura de grama/terra real perto da câmera | Poly Haven CC0 |
| Iluminação | sol + céu, tone mapping, noite com luz quente | sol, céu, névoa, postes; já bom | névoa menos densa | névoa azulada mais forte na distância | ajuste de shader (sem asset) |
| Sombras | sombra suave em tudo perto | sombra perto do jogador (orçamento) | semelhante | manter | — |
| Câmera | terceira pessoa, câmera de foto | terceira pessoa, capô | sem modo foto | modo foto (já no plano, Etapa 8) | — |
| Interface/HUD | dinheiro, celular, câmera, rua/bairro, minimapa quadrado | objetivo, rua/bairro, relógio, radar, velocímetro, menu | sem dinheiro/celular (Etapa 3–5) | seguir o plano de etapas | — |
| Densidade | muito alta no centro | média; centro melhorado | menos objetos por quadra | carros em fila, motos, placas, toldos, vitrines por tipo | modelos acima |
| Estilo | realista "mobile" | realista simples | texturas e modelos | — | — |

## O que pode vir do Bah City (e o que não pode)

- **Pode (são de terceiros, com licença aberta, e foram baixados dos originais dos autores):** os veículos e pessoas
  dos créditos com **CC BY 4.0** (23 veículos e 13 pessoas encontrados; atribuição obrigatória). Já em uso: Honda City
  2017 (dewa) e Peugeot 206 (DisneyCars).
- **Com restrição:** CC BY-NC / NC-SA (Creta, Beetle, Polo, Dolphin, T-Cross, Gol G2, F100, cabelo "Martin", avatares
  RPM oficiais) — só se o jogo nunca for comercial; deixados de fora. "Sketchfab Free Standard" (Toro, CG 125) — não
  permite redistribuir o arquivo; deixados de fora.
- **Não pode:** texturas de chão, fachadas, árvores, mapas e interface do Bah City (sem licença publicada) — recriados
  com material CC0 equivalente, com a mesma proposta estética.

## Plano (uma melhoria por vez, cada uma testada e publicada)

1. ✅ **Chão e telhados reais** (esta versão): asfalto, paralelepípedo de basalto, calçada de bloquete e telha de
   barro do Poly Haven (CC0) com mapa normal; laje lisa. Sem custo de triângulos ou chamadas de desenho.
2. **Grama e terra reais perto da câmera** + asfalto mais escuro com remendos + variação de calçada por rua.
3. **Árvores por espécie** com cartões de folha fotográficos (ipê, jacarandá, extremosa, jerivá, figueira).
4. **Fachadas**: reboco/pastilha/tijolo reais e janelas por estilo, mantendo as cores e o GEO.
5. **Pedestres com avatares reais** (13 CC BY) no lugar dos bonecos distantes, com as animações CC0.
6. **Mais carros** (2–4 por etapa, dos 23 CC BY) e ônibus Marcopolo para a etapa de trânsito.
7. **Mobiliário urbano real** (banco, lixeira, abrigo, hidrante, placas).
8. **Atmosfera**: névoa e cor do céu, sem custo de asset.

Regras mantidas: mapa real, ruas, geografia e sistemas preservados; uma melhoria por vez; orçamento de celular
(`tests/budget.json`) respeitado; atribuição de todo asset CC BY na tela inicial.
