# Auditoria de realismo — Igrejinha City

Data: 22/11/2026. Base: código do branch `ccr-4e60f86c-o43ab6` e medições em Chromium headless (renderização por
software, 844×390, perfil de celular). Critérios: skills `game-detail-bar` (+ guias *open-world* e *3d-scenes*),
`threejs-materials-lighting`, `performance-optimization`, `camera-systems`, `game-ai`.

Impacto: **A** = muda a percepção do jogo inteiro · **M** = perceptível em várias situações · **B** = detalhe.
Custo: esforço de implementação e custo em desempenho.

## Medições de partida

| Métrica | Valor | Alvo (skills) |
|---|---|---|
| Heap JS em uso (após GC) | 321–329 MB | < 150 MB (celular mata a aba em ~200–300 MB) |
| Draw calls por quadro (praça) | 1.109 | “centenas baixas” |
| Triângulos por quadro | 1,4–1,6 M | — |
| Malhas visíveis: terreno / cidade / pontos marcantes | 195 / 368 / 620 | — |
| Cópia CPU de geometria da cidade | 118 MB | 0 (liberar após enviar à GPU) |
| Carregamento até jogar | 6,5–11 s | menu em 1–2 s |

## Pontos fracos, por área

### Desempenho e otimização
1. **[A] Memória alta (321 MB).** Cópias CPU das geometrias da cidade (118 MB) e do terreno ficam vivas depois do envio à GPU.
2. **[A] 1.100 draw calls.** Pontos marcantes viraram 620 malhas soltas (cada casinha/pavilhão = 5–10 malhas), sem corte por distância; marcações viárias e calçadas desenhadas até 950 m.
3. **[M] Sem passo fixo de simulação** (lógica por `dt` do quadro; regra 11 da skill).
4. **[M] Montagem de 30 mil prédios na thread principal** (2,5–4 s de tela travada no celular).

### Iluminação e realismo gráfico
5. **[A] Sem tone mapping** (cores lavadas ou estouradas; `threejs-materials-lighting` pede ACES/AgX).
6. **[A] Céu de cor sólida**: sem gradiente, sol, nuvens, estrelas ou lua; o horizonte não tem profundidade.
7. **[M] Névoa linear** que corta o relevo de forma artificial; sem perspectiva aérea na Serra.
8. **[M] Iluminação sem luz de ambiente** (só hemisférica + sol); materiais Lambert iguais em tudo.
9. **[M] Personagens sem sombra de contato** quando a sombra real não alcança.

### Construções e cenários
10. **[A] Cidade sem árvores** fora da praça e do parque — Igrejinha é muito arborizada; ruas parecem desertas.
11. **[A] Ruas sem mobiliário nem vida:** nenhum carro estacionado, lixeira, placa, semáforo, ponto de ônibus.
12. **[M] Fachadas repetidas** (uma textura de janela; altura estimada; sem térreo comercial com vitrine/toldo).

### NPCs e IA
13. **[A] Cidade vazia:** só o Waldir, parado. O protótipo original tinha pedestres (regressão).

### Trânsito e veículos
14. **[A] Nenhum veículo.** O botão “Carro” não faz nada (regressão do protótipo); sem trânsito no grafo do OSM.

### Movimentação, animação, câmera
15. **[M] Câmera volta sozinha para trás** do jogador após 2 s — a skill pede que câmera controlada pelo jogador não seja movida por ele.
16. **[B] Sem look-ahead / FOV dinâmico** na corrida; sem tremida/impacto no pulo.
17. **[B] Animação sem pose de pouso nem passos com som.**

### Interação com o ambiente
18. **[M] Poucas interações:** só falar com o Waldir e pular. Sem portas, bancos para sentar, bebedouros, compras.

### Áudio e ambientação
19. **[A] Silêncio total.** Sem passos, vento, pássaros, trânsito, sinos da igreja, música na Oktoberfest.

### Ciclo dia/noite
20. **[M] Noite pouco convincente:** postes acendem mas não iluminam o chão; todas as janelas acendem juntas; sem estrelas/lua; sem pôr do sol no céu.

### Clima
21. **[M] Sem clima:** nem nuvens, nem chuva, nem neblina da Serra (característica da região).

## Roadmap (ordem = mais realismo por custo, sem quebrar o que existe)

| Etapa | Conteúdo | Itens | Situação |
|---|---|---|---|
| 1 | **Fundação de desempenho**: liberar cópias CPU, mesclar e cortar por distância os pontos marcantes, distâncias por camada | 1, 2 | feito (heap 327→214 MB, calls 1.109→~660) |
| 2 | **Luz e atmosfera**: ACES, céu com gradiente, sol/lua/estrelas, nuvens, névoa exponencial, cores por hora, sombra de contato | 5–9, 20 (parte) | feito |
| 3 | **Arborização e mobiliário urbano** instanciados: árvores nas calçadas, carros estacionados, lixeiras, placas | 10, 11 | feito: 7,6 mil árvores, 6,4 mil carros (falta mobiliário) |
| 4 | **Pedestres** com rotina (calçadas, praça, parque), conversa com gíria gaúcha | 13 | próximo |
| 5 | **Carro do jogador + trânsito** no grafo do OSM (aceleração, freio, colisão, semáforos) | 14 | próximo |
| 6 | **Áudio ambiente** gravado (precisa liberar o banco de sons Pixabay) | 19 | depende de rede |
| 7 | **Clima**: nublado, chuva, neblina da Serra, poças | 21 | depois |
| 8 | **Fachadas e interação**: térreo comercial, variação de janelas, bancos, portas | 12, 18 | depois |
| 9 | **Câmera e game feel**: sem auto-recentrar, FOV na corrida, impacto no pouso, passo fixo | 3, 15–17 | depois |
| 10 | **Carregamento**: montagem da cidade em Web Worker, menu imediato | 4 | depois |

Cada etapa: medir antes/depois (heap, draw calls, ms de render), capturas, teste automático do que existia
(travessia das pontes, colisão, Waldir), build e publicação.
