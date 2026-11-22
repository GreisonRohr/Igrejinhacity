# Roadmap — Igrejinha City

Prioridades: **P0** crítico (impede funcionar) · **P1** essencial para a experiência · **P2** grande melhoria
de qualidade · **P3** polimento. Cada ciclo segue: identificar → planejar → implementar → testar → revisar →
documentar → atualizar roadmap → definir próxima prioridade. Mudança estrutural só com aprovação e com commit antes.

## Auditoria (22/11/2026)

### Já funciona
- Mundo real de 7,8 × 9,4 km: relevo de 5 m (curvas da Prefeitura), rio pelo polígono oficial, 1.638 vias com
  pavimento/largura reais, 30 mil prédios reais com colisão, 13 pontes caminháveis (teste automático 26/26).
- Pontos marcantes modelados: Igreja com relógio, Rua Coberta, Praça Dona Luiza, Bar do Waldir, Parque da Oktoberfest.
- Protagonista com aparência do autor, andar/correr/sprint/pulo, passada ligada à velocidade; câmera com colisão.
- Céu físico, sol/lua/estrelas, nuvens, névoa, ACES, dia/noite com janelas e postes acesos e luz no chão.
- 7,6 mil árvores e 6,4 mil carros estacionados; minimapa com 239 lugares; celular com joystick/botões.
- Build estático publicado; dados offline.

### Incompleto / regressões do protótipo original
- Botão **Carro** sem função; **asa delta**, **missões** (Passeio com cronômetro), **mapa M com viagem rápida**,
  **pedestres** e **trânsito** existiam no protótipo e ainda não foram reconstruídos.
- Oktoberfest e centro sem nenhuma pessoa; só o Waldir (parado).

### Problemas de gameplay
- Não há objetivo nem motivo para explorar além de olhar; só 1 interação (falar com o Waldir).
- Câmera volta sozinha para trás do jogador (contra a regra "câmera do jogador é dele").
- Pulo sem uso no mundo (nada para subir); colisão só bloqueia (sem deslizar suave em quinas).

### Falhas visuais
- Chão de perto borrado (textura do mapa ≈1,9 m/pixel); fachadas todas iguais (uma textura de janela, altura
  estimada); 18 mil prédios do Google sem distinção de uso; carros "caixa"; placas de nome se sobrepõem.

### Performance (medido em Chromium headless, perfil celular)
- Heap 140 MB ✓ (alvo 150), ~645 draw calls (alvo 300), ~2,3 M triângulos (alvo 1 M), carregamento ~13 s com barra, maior travamento 0,8 s.
- Não testado em celular real.

### Arquitetura
Ver TECHNICAL_ARCHITECTURE.md (A1–A9): sem passo fixo, sem consulta espacial única, sem grafo de navegação,
`main.js` concentrado, sem sistema de interação, testes fora do repo, sem save.

## Itens priorizados

### P0 — crítico
| ID | Item | Por quê |
|---|---|---|
| P0-1 | **Teste em celular real** (Android intermediário + iPhone) com leitura de fps/heap | todos os números atuais são de emulação; risco de a aba fechar por memória |
| P0-2 | **Carregamento sem congelar** + tela de progresso (montagem em etapas com `await`/idle, depois Worker) | 6–11 s de tela travada pode ser fechado pelo navegador/usuário |
| P0-3 | **Memória ≤ 150 MB** (dados do mundo em arrays tipados, liberar JSON após montar) | celulares fecham abas entre 200–300 MB |

### P1 — essencial
| ID | Item |
|---|---|
| P1-1 | Testes automatizados no repositório (`tests/`, `npm test`) — base para não regredir |
| P1-2 | Núcleo de simulação: passo fixo 60 Hz, eventos, consulta espacial única, RNG com semente |
| P1-3 | Grafo viário e grafo de calçadas gerados no build-world |
| P1-4 | **Pedestres inteligentes**: rotina por hora, destinos reais (bar, praça, escola, fábrica), desvio, olhar o jogador, falas |
| P1-5 | **Carro do jogador** com física convincente (aceleração, freio, atrito lateral, colisão, entrar/sair/chamar) |
| P1-6 | **Trânsito IA** nas ruas reais: faixas, sentido, distância segura, preferência, reagir a pedestre e jogador |
| P1-7 | Sistema de interação unificado (prompt, alcance, ação) |
| P1-8 | Áudio ambiente e de ações (gravado; precisa liberar banco de sons) |
| P1-9 | Missões do protótipo + mapa M + viagem rápida + recordes salvos |

### P2 — grande melhoria
| ID | Item |
|---|---|
| P2-1 | Clima (nublado, chuva, neblina da Serra, poças, céu acompanhando) |
| P2-2 | Asa delta com física de planeio e térmicas, rampa e biruta do Alto da Pedra |
| P2-3 | Fachadas variadas: térreo comercial com vitrine/toldo/placa nos eixos comerciais; tipos de janela; cores |
| P2-4 | Textura de detalhe do chão de perto (grama, calçada, terra) |
| P2-5 | Oktoberfest viva: multidão, música, garçons, entregas de chope |
| P2-6 | Câmera: sem auto-recentralizar, FOV na corrida, impacto no pouso, framing de retrato |
| P2-7 | Morro da Cruz, Cascata da Solitária, Prefeitura, fábricas e lojas com modelo próprio |
| P2-8 | Personagem realista (.glb com esqueleto) se o diretor fornecer o modelo |
| P2-9 | Save versionado (posição, hora, recordes, configurações) |

### P3 — polimento
| ID | Item |
|---|---|
| P3-1 | Placas de nome sem sobreposição (prioridade e ocultação) |
| P3-2 | Fontes empacotadas no jogo (hoje vêm do Google Fonts) |
| P3-3 | Arcos de guirlanda, Farmácias São João, Praça do XV (aguardam dados) |
| P3-4 | Bundle JS dividido (hoje 804 kB) |
| P3-5 | Dados brutos grandes fora do git |
| P3-6 | Acessibilidade: tamanho de texto, tremida, redução de movimento |

## Ciclos (ordem proposta)

| Ciclo | Conteúdo | Itens | Estrutural? | Situação |
|---|---|---|---|---|
| 0 | Auditoria, documentos de gestão | — | não | **feito** |
| — | Etapas de realismo anteriores (desempenho, céu e luz, árvores e carros) | — | — | feito (22/11) |
| 1 | Testes no repo + carregamento sem congelar + memória | P1-1, P0-2, P0-3 | sim (loading) | **feito** (22/11) |
| 2 | Núcleo de simulação + consulta espacial + grafos viário/calçada | P1-2, P1-3 | **sim** | **feito** (22/11) |
| 3 | Pedestres inteligentes (centro e praça primeiro) | P1-4, P1-7 | sim | **v0.3 feita** (22/11); v0.6 depois do trânsito |
| 4 | Carro do jogador | P1-5 | sim | aguarda |
| 5 | Trânsito IA | P1-6 | sim | aguarda |
| 6 | Áudio | P1-8 | não (novo módulo) | depende de rede (Pixabay) |
| 7 | Missões, mapa, viagem rápida, save | P1-9, P2-9 | sim | aguarda |
| 8 | Clima | P2-1 | não | — |
| 9 | Oktoberfest viva | P2-5 | não | — |
| 10 | Asa delta e Serra | P2-2, P2-7 | não | — |
| 11 | Fachadas, chão de perto, câmera | P2-3, P2-4, P2-6 | não | — |
| contínuo | Teste em celular real | P0-1 | — | **depende do diretor** |

**Ciclo 1 concluído.** Heap 214 → 140 MB (orçamento 150 ✓), maior travamento na carga 7,2 s → 0,82 s, barra de progresso,
`npm test` com 6 suítes. P0-2 e P0-3 resolvidos; P0-1 (celular real) depende do diretor com `?debug`.

**Ciclo 2 concluído.** Simulação em passo fixo de 60 Hz com interpolação (mesmo resultado a 20, 30, 60 e 144 fps),
consulta espacial única (heap 140 → 129 MB), RNG com semente, eventos, grafo de navegação (2.530 nós, 353 km de ruas
para carro, 614 trechos de mão única) com A* em até 6 ms. `npm test` com 8 suítes.

**Ciclo 3 (v0.3) concluído.** Pedestres com rotinas, calçadas, travessias, bancos e conversa; protagonista melhorado.
`npm test` com 9 suítes.

**Próxima prioridade:** Ciclo 4 (carro do jogador), depois Ciclo 5 (trânsito IA), quando os pedestres passam a esperar
os carros na faixa.

~~Próxima prioridade:~~ Ciclo 3 (pedestres inteligentes no centro e na praça).

~~Próxima prioridade:~~ Ciclo 2 (núcleo de simulação + grafos), fundação de pedestres e trânsito.

~~Próxima prioridade recomendada:~~ Ciclo 1 (rede de testes + carregamento + memória). É o que protege tudo o
que vem depois e remove os riscos P0. Em seguida o Ciclo 2, fundação obrigatória para NPCs e trânsito de verdade.
