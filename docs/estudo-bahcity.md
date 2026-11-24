# Estudo do Bah City e plano de reconstrução para o Igrejinha City

Data: 24/11/2026 · Referência: https://bahcity.jogada.studio/game/ (Porto Alegre em mundo aberto)

## Como o estudo foi feito (e o que NÃO foi feito)

- **Craft Anything** (github.com/storytold/craft-anything, v0.6.1, compilado do código-fonte neste ambiente; `doctor`
  saudável). Usado em **modo sala limpa** pelo servidor MCP: `web_site_open`, `web_site_capture` (capturas a 1280 e
  390 px, fontes, cores, espaçamentos, texto visível) e `web_page_states_capture` (abas do menu: Som, Personagem,
  Teclas, créditos). O gravador de sessão (`web_walkthrough_record`), que permitiria jogar com o Craft Anything, é
  **recusado em sala limpa** (lê DOM/acessibilidade) e tem limite de 10 min por sessão — o jogo leva mais que isso para
  carregar neste ambiente sem placa de vídeo. O modo Deep (que lê o código do jogo) **não foi usado**, por pedido seu.
  O `rebuild` do Craft Anything gera projetos em Unity/Unreal/Godot e dirige o Claude Code — não se aplica a um projeto
  Three.js existente; a reconstrução é feita aqui, no seu código.
- **Partida real, só pela tela**: navegador automatizado (Playwright) jogando com o teclado como um jogador — escolha
  de personagem, andar, correr, pular, mapa (M), câmera de foto (C), montar no veículo próximo (F), rádio (Q), buzina
  (H), soco (E), troca de arma (X). 22 capturas + texto visível. Sem ler código, sem baixar assets.
- **Limites honestos**: navegador sem GPU → ~1 quadro por segundo; não deu para dirigir carro, ver trânsito em
  movimento, polícia, missões, lojas, celular, helicóptero/avião, nem ouvir o áudio. Esc não abriu a pausa
  (o jogo provavelmente exige o mouse capturado). Esses itens abaixo estão marcados **"só no menu"** (o jogo descreve,
  eu não vi funcionando) ou **"não verificado"**.

Legenda: ✅ visto funcionando · 📄 descrito no menu/dicas do próprio jogo · ❓ não verificado

## 1. O que o Bah City tem

### Entrada, carga e menus
- ✅ Tela inicial: logo, **6 personagens** para escolher (rostos), botão JOGAR, "Entrar / Salvar na nuvem" — por
  padrão "Teu jogo está salvo só neste aparelho" (save local + nuvem opcional).
- ✅ Carga ~1 min (2 min sem GPU) em etapas: "Carregando texturas", "Construindo a cidade **n/85**" (cidade em 85
  blocos), "Preparando os materiais". Câmera passeia por marcos reais com legendas (Gasômetro, Beira-Rio, Mercado
  Público, CAFF, Redenção, Viaduto Otávio Rocha…). **Truco jogável enquanto carrega**.
- ✅ Dicas da carga revelam sistemas: "Três estrelas — a Brigada na tua cola… some da vista pra despistar" (procurado
  por estrelas), "Quero Frete — caminhão carregado na Freeway" (trabalho de entrega), "BahCar — corrida na Padre
  Cacique" (trabalho de motorista/corrida).
- ✅ Configurações (pausa): Imagem (Auto/Baixa/Média/Alta/Ultra; **Modo leve** Não/Leve/Mínimo, recarrega), Som (geral,
  rádio, **rádios de POA ao vivo**, ambiente, vozes), Personagem (troca na hora, até dirigindo), Teclas, **Cheats**
  (hora: manhã/meio-dia/pôr do sol/noite; clima: limpo/nublado…), "Estou preso: voltar pra rua".
- ✅ Estilo: fundo escuro translúcido (#160d1e com transparência), laranja/coral em degradê no logo e botões, fonte
  Inter + Bricolage Grotesque, cantos de 8–14 px.

### HUD (em jogo)
- ✅ Relógio (canto superior direito) e **dinheiro "P$ 60"**.
- ✅ Atalhos na tela: "Tab Celular" (com **3 notificações**) e "C Câmera".
- ✅ Minimapa quadrado de cantos arredondados, norte marcado, seta do jogador; **duas barras** embaixo (verde e azul —
  provavelmente vida e fôlego/energia ❓).
- ✅ Faixa com **nome da rua + bairro** (muda ao andar: Praia de Belas → Centro Histórico).
- ✅ Velocímetro redondo em km/h com o nome do veículo ("PATINETE BAH!").

### Mapa (M)
- ✅ Tela cheia, mapa vetorial escuro estilizado; título da cidade, bairro e rua atuais, relógio.
- ✅ **Busca** "rua, número, esquina ou lugar"; legenda: vias expressas, avenidas, ruas, **corredores de ônibus**,
  ciclovias, parques, água, **rota do GPS**, destino, você.
- ✅ Clique marca destino (GPS), arrastar move, roda dá zoom, botão direito remove; botões de zoom.
- 📄 No celular: toque duplo no mapa **teleporta**.

### Movimento e câmera
- ✅ Terceira pessoa, mouse gira a câmera; andar, correr (Shift), pular.
- ✅ **Câmera de foto** a pé (C): "Foto livre (vai para o álbum)", zoom 1,0×, clique fotografa.
- 📄 Câmera da frente no carro (C); mira por cima do ombro (botão direito).

### Veículos
- ✅ Carros e motos estacionados; **patinete** montável (F) com velocímetro.
- 📄 F: entrar / **roubar** / sair do carro; Espaço freio de mão; H buzina; R desvirar; **rádio** Q (rádios próprias
  com músicas originais + rádios reais de POA ao vivo).
- 📄 **Helicópteros** (Gasômetro e aeroporto) e **aviões** (Salgado Filho) com controles próprios.
- 📄 Celular: pedais Acelerar e Freio/Ré; deslizar para virar.
- ❓ Trânsito com IA, física de direção, danos.

### Pessoas, combate e economia
- ✅ Pedestres andando nas calçadas.
- ✅ **Soco** (animação vista); 📄 armas "funda" e "boleadeira" compradas no **Brique Online** (loja no celular do jogo).
- 📄 Polícia ("Brigada") com estrelas de procurado.
- ✅ Dinheiro (P$); 📄 trabalhos de frete e de corrida; ❓ lojas físicas, casas, roupas.
- 📄 Monetização real: "Plano Vitrine" — lojas reais pagam para aparecer na cidade do jogo.

### Noite (verificado depois, pelo cheat "Noite" do menu)
- ✅ A hora pula para 21:00: céu com estrelas, postes acesos com manchas de luz na calçada e no asfalto, janelas
  acesas, pedestres continuam na rua; o HUD não muda.

### Mundo e dados
- 📄 Créditos: OpenStreetMap, estabelecimentos do OSM + Overture Maps, **alturas por LiDAR**, **linhas de ônibus
  GTFS**; vozes e efeitos com IA (ElevenLabs), músicas das rádios com IA (Suno).
- ✅ Marcos modelados (Gasômetro, Beira-Rio, Arena, Mercado Público), Guaíba, ilhas, árvores densas, postes e fiação.

## 2. Comparação com o Igrejinha City hoje

| Sistema (Bah City) | Como funciona lá | No Igrejinha City | Falta / reconstruir | Dific. | Prior. |
|---|---|---|---|---|---|
| Menu inicial + escolha de personagem | 6 rostos, JOGAR, save local/nuvem | Tela de carga e início; 1 protagonista | Tela de escolha (2–6 personagens com os modelos que já temos) | M | P1 |
| Carga com marcos e minijogo | legendas de marcos reais, truco | barra de etapas | Câmera passeando por marcos de Igrejinha com legendas; minijogo opcional (truco) | M | P3 |
| Save | local + nuvem | **não tem** | Save local (posição, dinheiro, álbum, ajustes) | B | P1 |
| HUD | relógio, dinheiro, celular, minimapa, barras, rua/bairro, velocímetro | relógio, rua/bairro, minimapa | Dinheiro em "pila", barras, atalhos, velocímetro | B | P1 |
| Mapa M | tela cheia, busca, legenda, GPS, teleporte (celular) | tecla M sem tela; Uber com lista | **Mapa em tela cheia com GPS e busca** (ruas/números do cadastro GEO); viagem pelo Uber | M | **P0** |
| Câmera de foto | modo foto + álbum | não tem | Modo foto, álbum salvo | B | P2 |
| Dirigir | entrar/roubar, freio de mão, buzina, desvirar, rádio, câmera frontal | carros só estacionados; Uber teleporta | **Dirigir carro** (física arcade sobre as ruas reais), patinete/bicicleta | A | **P0** |
| Trânsito | ❓ (carros circulando nas capturas de carga) | grafo de navegação de carros pronto (testado), sem carros andando | Carros andando pelo grafo, respeitando mão e esquinas | A | P1 |
| Rádio | rádios próprias + POA ao vivo | sem áudio | Áudio ambiente + rádio (músicas livres/próprias; rádio local real se houver stream aberto) | M | P2 |
| Pedestres | andam nas calçadas | 136 pedestres com rotina, conversa (E) | Reações (desviar do carro, correr de buzina) | M | P2 |
| Celular do jogo | Tab, notificações, loja Brique | não tem | Celular: mapa, Uber, missões, álbum, mensagens | M | P1 |
| Trabalhos/missões | frete, corrida (BahCar) | não tem (Passeio do protótipo antigo foi perdido) | **Missões**: entrega a pé/carro, corrida de "Uber" com passageiro, passeio turístico pelos pontos | M | **P0** |
| Economia | P$, compras | pipoca do tio sem dinheiro | Pila: ganhar nas missões, gastar (pipoca, Uber, café, roupas) | M | P1 |
| Polícia/procurado/armas | estrelas, Brigada, funda, boleadeira, soco | — | **Fora do escopo** (regra do projeto: sem crime nem violência). Alternativa: multa de trânsito/“fiscal”, corrida contra o tempo | — | — |
| Helicóptero/avião | Gasômetro, aeroporto | asa delta existia no protótipo | Asa-delta no Morro Alto da Pedra (voo livre real de Igrejinha) | A | P2 |
| Configurações | qualidade, modo leve, som, cheats de hora/clima | perfil celular automático | Menu de pausa: qualidade, som, hora do dia, clima | B | P2 |
| Clima | limpo/nublado… | céu com nuvens, sem chuva | Nublado/chuva | M | P3 |
| Dados reais | OSM, Overture, LiDAR, GTFS | OSM + GEO Igrejinha (relevo, cadastro, paradas, zoneamento, ortofoto) | Linhas de ônibus (temos as linhas municipais no GEO) → ônibus circulando | M | P2 |

## 3. Plano de reconstrução (Igrejinha City)

Regras mantidas: GEO, ruas e movimentação atuais preservados; sem crime/violência; tudo procedural e com assets
próprios; testes automáticos e orçamento de desempenho a cada etapa; commit antes de cada mudança estrutural.

1. **Etapa A — Mapa em tela cheia (M) com GPS** (P0): mapa vetorial das ruas reais, busca por rua/número (cadastro
   GEO) e lugares, destino com rota pelo grafo de navegação existente, seta no minimapa. Reaproveita: minimapa, `nav`,
   `geoextra`, Uber.
2. **Etapa B — Dirigir** (P0): entrar em carro estacionado (F), física arcade (aceleração, freio, ré, curva, freio de
   mão), câmera de perseguição, velocímetro, buzina; colisão com prédios; pedais no celular. Depois patinete/bicicleta.
3. **Etapa C — HUD, pila e save** (P1): dinheiro em pila, barras, atalhos; save local.
4. **Etapa D — Missões** (P0/P1): "Corrida Uber" (buscar passageiro e levar ao destino com GPS), entregas da Feira do
   Produtor / Casa do Artesão, Passeio turístico pelos pontos do site de turismo; recompensas em pila.
5. **Etapa E — Celular** (P1): Tab abre apps: Mapa, Uber, Missões, Álbum, Mensagens.
6. **Etapa F — Trânsito** (P1): carros circulando pelo grafo (já testado: 129 rotas, sem contramão), ônibus nas
   linhas municipais.
7. **Etapa G — Escolha de personagem, menu de pausa e configurações** (P1/P2).
8. **Etapa H — Áudio e rádio, modo foto, asa-delta, clima** (P2/P3).

Cada etapa termina com: testes, capturas comparadas com o Bah City nos mesmos tipos de tela, medição de desempenho,
CHANGELOG e publicação.
