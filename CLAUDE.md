# Igrejinha City — instruções para o Claude Code

Jogo 3D de mundo aberto de Igrejinha-RS no navegador (computador e celular).

## Tecnologia (prevalece sobre qualquer skill genérica)
- Vite + Three.js, JavaScript puro (ES modules), sem engine. Nada de Godot/Unity/Unreal.
- Dados reais pré-processados em `public/data/` (relevo, OSM, GEO Igrejinha); o jogo não chama APIs ao rodar.
- Coordenadas: metros a partir da Praça Dona Luísa, x = leste, z = sul, y = altitude (`src/geo.js`).
- Celular primeiro: geometria mesclada/instanciada (`GeoBuilder`, `Kit`, `InstancedMesh`), sombra só perto do jogador,
  LOD por chunks, pixel ratio limitado. Medir draw calls/triângulos (`?debug`) antes e depois de mudanças pesadas.
- Visual: modelos procedurais no código, a partir de fotos de referência (`docs/referencias.md`). Sem assets externos
  sem licença clara.

## Ordem de prioridade quando instruções conflitarem
1. Pedido do usuário nesta conversa.
2. Este arquivo e a arquitetura existente do projeto.
3. Skills específicas da tecnologia: `threejs-*`, `performance-optimization`, `game-detail-bar`.
4. Skills gerais de design e processo (`gd-*` e as disciplinas).
Uma skill que pressupõe outra engine ou cria estrutura paralela (ex.: pastas de docs, novos sistemas) só é seguida
naquilo que se aplica a Three.js e com aprovação do usuário para criar arquivos novos de processo.

## Gestão do projeto (ler no início de cada sessão)
GAME_BIBLE.md (visão, pilares) · ROADMAP.md (prioridades P0–P3 e ciclos) · TASKS.md · BUGS.md · CHANGELOG.md ·
TECHNICAL_ARCHITECTURE.md (estrutura-alvo e orçamentos) · WORLD_DESIGN.md (zonas, marcos, vida por hora).
Ciclo: identificar → planejar → implementar → testar → revisar → documentar → atualizar roadmap → próxima prioridade.
Mudança estrutural (núcleo, arquitetura, sistemas existentes) só com aprovação do diretor e commit antes.

## Como trabalhar (equipe de jogo)
- Antes de implementar: ler o código envolvido, entender o que já funciona, avaliar impacto, planejar.
- Preservar sistemas que funcionam; não criar sistemas isolados que dupliquem os existentes
  (`src/world/city.js`, `landmarks3d.js`, `oktoberfest.js`, `player/`, `camera.js`, `input.js`).
- Especialistas por tarefa (carregar a skill antes de começar):
  | Tarefa | Skills |
  |---|---|
  | Luz, céu, sombras, tone mapping | `threejs-materials-lighting`, `gamedev-lighting` |
  | Materiais PBR e texturas | `gamedev-texture-authoring`, `threejs-materials-lighting` |
  | Modelo a partir de foto (marcos) | `gamedev-reference-reconstruction`, `gamedev-visual-iteration` (`tools/refmatch`) |
  | Construções e fachadas | `gamedev-modular-kit`, `gamedev-art-direction` |
  | Relevo, ruas, rio a partir de dados | `gamedev-world-from-data` |
  | Árvores e vegetação | `gamedev-foliage` |
  | Locomoção e peso do personagem | `gamedev-locomotion`, `physics-tuning` |
  | Animação humana | `animation-systems`, `game-detail-bar` (§4) |
  | Câmera | `camera-systems`, `game-detail-bar` (§1) |
  | Pedestres e IA | `game-ai`, `ai-behavior-trees-utility-ai`, `systemic-emergent-design`, `dialogue-systems` |
  | Trânsito e veículos | `game-ai` (navegação), `physics-tuning`, `systemic-emergent-design` |
  | Mundo aberto, streaming, marcos | `open-world-design`, `game-detail-bar` (guia open-world) |
  | Clima, dia/noite, VFX | `shaders-and-vfx`, `shader-programming`, `gamedev-lighting` |
  | Áudio | `audio-design`, `gamedev-audio-wire`, `game-asset-pipeline` |
  | Artefatos visuais (cintilação, acne, banding) | `gamedev-visual-artifacts` |
  | Desempenho | `performance-optimization`, `game-detail-bar` (§13 e guia 3d-scenes) |
  | Design de sistema novo | `gd-design-review`, `gd-feature-spec` |
- Depois de implementar: revisar o código, testar no navegador (Playwright: carregamento sem erros, capturas, testes
  automáticos de movimento como o das pontes), `npm run build`, e só então commitar e publicar.
- Não alterar dados, configuração ou funcionalidades fora do pedido sem autorização.
