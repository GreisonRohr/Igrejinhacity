# GAME BIBLE — Igrejinha City

Documento de referência do que o jogo **é**. Mudanças aqui só com aprovação do diretor do projeto (Greison Rohr).

## Visão
Um mundo aberto 3D de **Igrejinha-RS real**, jogável no navegador do celular e do computador, onde a cidade
**parece viva**: gente indo e vindo conforme a hora, trânsito que respeita as ruas, bar cheio no fim da tarde,
Oktoberfest lotada em outubro, neblina na Serra de manhã. O jogador reconhece a própria cidade e se diverte nela.

## Pilares (toda decisão é testada contra eles)
1. **É Igrejinha de verdade.** Ruas, relevo, rio e prédios vêm de dados reais (OSM, Prefeitura, curvas de nível);
   pontos marcantes são modelados a partir de fotos. Nada inventado que contradiga a cidade real.
2. **Cidade viva, não cenário.** Todo sistema existe para fazer o mundo reagir: pessoas, carros, horários, clima,
   eventos. Um sistema raso que só "aparece" não entra.
3. **Identidade gaúcha e teuto-brasileira.** Enxaimel, Oktoberfest, chope, chimarrão, gíria ("Bah, tchê!"), Serra.
4. **Roda no celular.** 60 fps em aparelho intermediário é requisito, não polimento. Nenhum recurso entra se
   quebrar o orçamento (ver TECHNICAL_ARCHITECTURE.md).
5. **Leve e acolhedor.** Explorar, conversar, dirigir, voar, participar da festa. Sem violência gráfica.

## Fantasia do jogador
"Passear por Igrejinha como se estivesse lá — e ver a cidade acontecer em volta."

## Loop principal
Explorar → encontrar algo vivo (pessoa, evento, lugar) → interagir (conversar, ajudar, entregar, dirigir, voar)
→ ganhar algo que muda o mundo ou o personagem (recorde, item, acesso, reputação) → explorar mais.

## Modos de locomoção
A pé (andar, correr, sprint, pular) · carro próprio (chamar quando longe) · asa delta saindo do Alto da Pedra.

## Tom e estética
- Estilizado-realista: proporções reais, formas limpas, cores claras de cidade de colonização alemã,
  iluminação física (céu de espalhamento, tone mapping ACES).
- Personagens humanos estilizados; protagonista com a aparência de Greison Rohr (jaqueta bomber, barba, cargo).
- Linguagem do jogo: português do RS, gíria leve e carinhosa.

## O que o jogo NÃO é (a confirmar pelo diretor)
- Não é simulador de crime (sem armas, roubo de carro, polícia perseguindo).
- Não é jogo online/multiplayer na versão 1.
- Não usa assets de terceiros sem licença clara nem imita outro jogo.

## Personagens fixos
| Nome | Onde | Papel |
|---|---|---|
| Greison Rohr | — | Protagonista jogável |
| Waldir | Bar do Waldir (R. Benjamin Constant) | Dono do bar; conversa, dará missões de entrega |

## Conteúdo-chave
Passeio por Igrejinha (cronometrado) · entregas de chope na Oktoberfest · corrida até o Morro da Cruz ·
voo de asa delta com pouso na praça · Oktoberfest viva (outubro do calendário do jogo).

## Créditos de dados
© OpenStreetMap contributors · GEO Igrejinha (Prefeitura) · Google Open Buildings 2024 · AWS Terrain Tiles.
