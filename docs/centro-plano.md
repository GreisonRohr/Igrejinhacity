# Centro de Igrejinha — levantamento e plano (região-padrão de qualidade)

Região (`src/world/centro.js`): x −190…170, z −175…200 (m a partir da praça) — Praça Dona Luísa, Rua Coberta e uma
quadra em volta: Av. Pres. Castelo Branco (O), R. Gen. Ernesto Dorneles (L), R. Oswaldo Cruz/Rua Coberta (N),
R. João Corrêa (S), incluindo Casa do Artesão, Igreja do Relógio, Feira do Produtor e os sobrados do patrimônio.
Referências: 117 fotos enviadas pelo diretor (Street View abr/2026, TripAdvisor, turismo; fora do repositório),
cadastro de lugares (37 no centro, 21 do patrimônio histórico), dossiê da praça (`docs/dossie-praca-dona-luisa.md`),
Bah City como referência de acabamento.

## Levantamento (jogo × fotos, mesmos pontos)
| Elemento | Real (fotos) | Jogo antes | Situação |
|---|---|---|---|
| Asfalto | cinza-grafite, faixas brancas/amarelas que param na faixa de pedestre | claro; faixas atravessavam o cruzamento ("V") | **C1 feito** |
| Calçadas | lajota de concreto cinza em placas; meio-fio amarelo nas esquinas | bloquete claro, quase branco; meio-fio branco | **C1 feito** |
| Térreo | comércio em quase todo o térreo, toldos, letreiros grandes coloridos | lojas só em prédios "comerciais", letreiro sem texto | **C2 feito** (texto legível, nomes reais do cadastro) |
| Prédios altos | sacadas, pastilha, faixas | caixas lisas | **C2 feito** (sacadas) — pastilha: próxima etapa |
| Sobrados históricos | casas teuto-brasileiras em cores pastel, janelas em arco | cor genérica | **C2 feito** (21 do cadastro) |
| Reboco | manchas, base suja | parede lisa | **C2 feito** (shader só no centro) |
| Árvores de rua | figueiras enormes avançando sobre a rua (praça), ipês | poucas, algumas de baixa qualidade | **C3** |
| Praça | lajota, canteiros, bancos, lampiões, bambu, pérgola, parquinho | base boa (dossiê) | **C3** (paisagismo, copa, iluminação) |
| Rua Coberta | treliça, telha translúcida, vagas a 45°, lojas e Feira dos lados | estrutura fiel; laterais com paredes brancas lisas | **C4** |
| Mobiliário | postes de concreto com muita fiação, placas, lixeiras, floreiras | fiação, placas de rua, lixeiras | **C5** (placas PARE, floreiras, bancos de rua) |
| Noite | postes quentes, vitrines acesas | postes, janelas | **C5** (letreiros acendem — feito) |

## Etapas
1. **C1 — Ruas e calçadas** ✅ asfalto grafite, lajota cinza (Poly Haven CC0), meio-fio amarelo nas esquinas, faixas
   param antes do cruzamento.
2. **C2 — Fachadas** ✅ térreo comercial com letreiros legíveis (nomes reais: Banco do Brasil, Supermercado Dia,
   Casa do Artesão…; demais: tipo de comércio, sem inventar marcas), sacadas, sobrados do patrimônio, reboco.
   Desempenho: postes de iluminação só até 380 m (−361 mil triângulos) — folga para o detalhe do centro.
3. **C3 — Praça Dona Luísa** ✅ figueiras nas posições da ortofoto (espécie de copa fechada), palmeiras na pérgola,
   trepadeira de folhas, gramado à sombra, luz dos lampiões no piso à noite.
4. **C4 — Rua Coberta**: fachadas laterais (Feira do Produtor, Erni Engelmann, lojas), luminárias sob a cobertura, noite.
5. **C5 — Ambientação**: árvores de rua, floreiras, placas (PARE, sentido), bancos de rua, pastilha nos prédios altos,
   revisão de noite e desempenho no celular.
