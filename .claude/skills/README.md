# Skills de desenvolvimento de jogos (Igrejinha City)

Skills no formato Agent Skills (`<nome>/SKILL.md`), carregadas pelo Claude Code ao abrir uma sessão neste projeto.
Ative escrevendo `/<nome>` (ex.: `/game-feel`) ou apenas descreva a tarefa: o Claude escolhe a skill pela descrição.

Copiadas das fontes abaixo (pastas inteiras, sem alterações). Licenças em `_licencas/`.

| Fonte | Licença | Skills instaladas |
|---|---|---|
| gamedev-skills/awesome-gamedev-agent-skills | Apache-2.0 | ai-behavior-trees-utility-ai, audio-design, camera-systems, dialogue-systems, game-ai, game-feel, game-ui-ux, input-systems, level-design, performance-optimization, physics-tuning, procedural-gen, save-systems, shader-programming, threejs-scene-setup, threejs-materials-lighting, threejs-gltf-loading |
| Xyloforge/claude-game-skills | MIT | game-detail-bar, game-asset-pipeline |
| setcodes/gamedev-skills | MIT | blender-game-assets |
| minh190902/gd-skills | MIT | gd-core, gd-status, gd-pipeline, gd-design-review, gd-feature-spec, gd-feature-audit, gd-prototype, gd-playtest, gd-economy-balance, gd-pacing-progression, gd-narrative-design, gd-ux-audit, gd-production-plan, gd-game-analysis, gd-unstuck |

## Não instaladas (e por quê)
- Skills de Godot, Unity, Unreal, Roblox, Bevy, Defold, LÖVE, Pygame, Ebitengine, Phaser e PixiJS: o jogo é Three.js.
- `create-game-assets` (awesome): coberta por `game-asset-pipeline`.
- `game-docs` e `prototype-fast` (awesome) e `game-designer` (setcodes): cobertas pelas skills `gd-*`.
- `router` (awesome): encaminha para as 80 skills da coleção, a maioria não instalada.
- `game-jam`, `steam-publish`, `itch-publish`, `gd-go-to-market`: publicação em lojas/jams; o jogo é publicado como site estático.
- `godot-gamedev` (setcodes).
- reason-machines/claude-code-game-studios: repositório não encontrado (privado ou nome diferente).

## Atualizar
Repita a cópia a partir do repositório de origem (`git clone --depth 1`), revisando o diff antes de commitar.
