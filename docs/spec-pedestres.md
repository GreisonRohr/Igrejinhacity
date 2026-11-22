# Spec — Pedestres (Ciclo 3) · WIP

Changelog: 22/11 v0.1 escrita e aprovada pelo diretor ("Pode começar").

## 1. Intenção
- **Problema:** a cidade tem prédios, carros parados e árvores, mas ninguém. Pilar 2 ("cidade viva, não cenário")
  é o maior buraco do jogo hoje.
- **Pilares:** 2 (cidade viva), 3 (identidade: chimarrão, "Bah, tchê!"), 4 (roda no celular), 5 (acolhedor).
- **Experiência:** andar pelo centro às 10 h e sentir que as pessoas têm para onde ir: saem das lojas, esperam para
  atravessar, param para conversar, sentam na praça, olham quando o jogador chega perto, respondem quando ele fala.
- **Comportamento incentivado:** explorar a pé e conversar.
- **Sistemas existentes reaproveitados (nada duplicado):** grafo `nav` (rotas a pé), `spatial` (colisão + agentes),
  `FixedLoop` (passo de 60 Hz), `RNG.game`, `events`, `sky.hours` (hora), `city.deckAt` (pontes), Waldir/`act`.

## 2. Funcionamento
**Ciclo:** jogador anda → pessoas ao redor seguem rotinas → jogador se aproxima → a pessoa olha/desvia → E/Falar →
fala por perfil e hora (Waldir continua com as falas dele).

**Estados do pedestre (FSM; um estado por vez):**
| Estado | Entra quando | Faz | Sai para |
|---|---|---|---|
| `andar` | tem rota | segue a calçada (lado direito ou esquerdo do trecho), desvia de pessoas/jogador | `esquina`, `chegou` |
| `esquina` | a próxima perna atravessa a rua | para no meio-fio, olha para os dois lados 0,6–2 s | `atravessar` |
| `atravessar` | terminou de olhar | cruza a rua 15% mais rápido | `andar` |
| `chegou` | fim da rota | escolhe atividade pelo lugar | `atividade`, `entrar` |
| `atividade` | praça/vitrine/encontro | sentar, olhar vitrine, conversar em grupo, tomar chimarrão (6–40 s) | `andar` (novo destino) |
| `entrar` | destino é prédio | caminha até a fachada e some (entrou) | removido |
| `conversar` | jogador fala | para, vira para o jogador, fala (5 s) | estado anterior |
| `desviar` | jogador em sprint a < 2 m | passo lateral rápido + reclamação educada | estado anterior |

**Escolha de destino (utility simples):** pontuação = interesse do perfil × curva da hora × 1/distância.
Destinos: praças (35), comércio (1.185 prédios comerciais + lojas, bancos, farmácia), escolas (35), igrejas,
Bar do Waldir (fim de tarde), casa (prédio residencial). Perfis: morador, trabalhador, estudante, idoso (anda devagar,
muitas vezes com cuia de chimarrão), criança acompanhada (v0.6).

**População:** mantém N pessoas num raio de 200 m do jogador; nascem fora da vista (60–200 m, atrás da câmera ou
saindo de portas) e somem acima de 240 m. N = densidade local (comércio ao redor) × curva da hora (tabela
"Vida planejada" do WORLD_DESIGN) × teto de qualidade.

**Reações (prioridade sobre a rotina):** olhar o jogador quando ele passa a < 4 m; desviar dele e uns dos outros
(separação via `spatial.agentsNear`); o jogador também não atravessa pessoas.

**Feedback:** pequeno = cabeça vira; médio = desvio + fala curta; grande = conversa com toast.

**Fica visível:** quem é (perfil pela roupa/acessório). **Fica oculto:** destino e pontuação (só no `?debug&nav`).

## 3. Parâmetros (`src/sim/pedestrians.js`, objeto `PED`)
| Parâmetro | Valor | Faixa | Unidade |
|---|---|---|---|
| teto de pessoas (alta/média/baixa) | 140 / 90 / 50 | 20–200 | pessoas |
| raio de população / remoção | 200 / 240 | 120–400 | m |
| velocidade andar (adulto / idoso) | 1,35 ± 0,15 / 0,95 | 0,6–1,8 | m/s |
| espera na esquina | 0,6–2 | 0–5 | s |
| atividade | 6–40 | 2–120 | s |
| raio de olhar o jogador | 4 | 1–10 | m |
| distância de desvio (separação) | 0,9 | 0,4–2 | m |
| raio de conversa (E) | 2,5 | 1,5–4 | m |
| rotas A* por quadro | 2 | 1–8 | — |
| animação completa até / visível até | 70 / 160 | — | m |

## 4. Dependências e riscos
| Sistema | Mudança | Risco |
|---|---|---|
| `main.js` laço | `pedestrians.step(h)` no passo fixo, `present()` no quadro | baixo |
| `core/spatial` | agentes dinâmicos reconstruídos a cada passo | baixo |
| `player.blocked` | passa a incluir pessoas | médio (teste de colisão e pontes cobrem) |
| `input act` / prompt | Waldir + pessoa mais próxima numa lista de interagíveis | médio (teste waldir cobre) |
| Desempenho | +10 draw calls (partes instanciadas) + sombras próximas | médio → teste de orçamento |
| Save | nada persiste (população é efêmera) | — |
- **Como o jogador "otimiza" contra a intenção:** empurrar multidões → as pessoas são sólidas e desviam.

## 5. Validação
| Hipótese | Teste | Limite |
|---|---|---|
| ninguém dentro de prédio | suíte `pedestres`: 30 s simulados no centro | 0 casos |
| ninguém andando no meio da pista fora de travessia | idem | 0 casos |
| centro movimentado às 10 h, vazio às 3 h | contagem por hora | ≥ 40 / ≤ 10 |
| custo | passo da simulação | < 2 ms (SwiftShader) |
| orçamento | draw calls/triângulos na praça | dentro de `tests/budget.json` |
| conversa | E perto de pessoa | toast com fala |

**Iterações:** v0.1 andar na calçada + esquina + população; v0.3 destinos/atividades/reações/conversa;
v0.6 grupos, crianças, guarda-chuva com clima; v1.0 rotinas completas por zona + Oktoberfest lotada.
