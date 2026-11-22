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

## Como trabalhar (equipe de jogo)
- Antes de implementar: ler o código envolvido, entender o que já funciona, avaliar impacto, planejar.
- Preservar sistemas que funcionam; não criar sistemas isolados que dupliquem os existentes
  (`src/world/city.js`, `landmarks3d.js`, `oktoberfest.js`, `player/`, `camera.js`, `input.js`).
- Especialistas por tarefa: design (`gd-design-review`, `gd-feature-spec`), câmera/controle (`camera-systems`,
  `input-systems`, `game-feel`), NPCs (`game-ai`, `ai-behavior-trees-utility-ai`, `dialogue-systems`), visual
  (`threejs-materials-lighting`, `shader-programming`), desempenho (`performance-optimization`), UI (`game-ui-ux`).
- Depois de implementar: revisar o código, testar no navegador (Playwright: carregamento sem erros, capturas, testes
  automáticos de movimento como o das pontes), `npm run build`, e só então commitar e publicar.
- Não alterar dados, configuração ou funcionalidades fora do pedido sem autorização.
