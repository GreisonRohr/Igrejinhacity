# Skills de desenvolvimento de jogos (Igrejinha City)

Skills no formato Agent Skills (`<nome>/SKILL.md`), carregadas pelo Claude Code ao abrir uma sessão neste projeto.
Ative escrevendo `/<nome>` (ex.: `/game-feel`) ou apenas descreva a tarefa: o Claude escolhe a skill pela descrição.

Copiadas das fontes abaixo (pastas inteiras, sem alterações). Licenças em `_licencas/`.

| Fonte | Licença | Skills instaladas |
|---|---|---|
| gamedev-skills/awesome-gamedev-agent-skills | Apache-2.0 | ai-behavior-trees-utility-ai, audio-design, camera-systems, dialogue-systems, game-ai, game-feel, game-ui-ux, input-systems, level-design, performance-optimization, physics-tuning, procedural-gen, save-systems, shader-programming, threejs-scene-setup, threejs-materials-lighting, threejs-gltf-loading |
| Xyloforge/claude-game-skills | MIT | game-detail-bar, game-asset-pipeline |
| setcodes/gamedev-skills | MIT | blender-game-assets |
| sekaikx/ForgeSkills | Apache-2.0 | gamedev-lighting, gamedev-texture-authoring, gamedev-foliage, gamedev-locomotion, gamedev-visual-artifacts, gamedev-visual-iteration, gamedev-reference-reconstruction, gamedev-world-from-data, gamedev-modular-kit, gamedev-art-direction, gamedev-audio-wire (+ ferramentas em `tools/refmatch` e `tools/texture`, Python com Pillow/numpy) |
| rondorkerin/gamestack | MIT | animation-systems, open-world-design, systemic-emergent-design, shaders-and-vfx (cada uma com GUIDE.md e CHECKLIST.md) |
| minh190902/gd-skills | MIT | gd-core, gd-status, gd-pipeline, gd-design-review, gd-feature-spec, gd-feature-audit, gd-prototype, gd-playtest, gd-economy-balance, gd-pacing-progression, gd-narrative-design, gd-ux-audit, gd-production-plan, gd-game-analysis, gd-unstuck |

## Não instaladas (e por quê)
- Skills de Godot, Unity, Unreal, Roblox, Bevy, Defold, LÖVE, Pygame, Ebitengine, Phaser e PixiJS: o jogo é Three.js.
- `create-game-assets` (awesome): coberta por `game-asset-pipeline`.
- `game-docs` e `prototype-fast` (awesome) e `game-designer` (setcodes): cobertas pelas skills `gd-*`.
- `router` (awesome): encaminha para as 80 skills da coleção, a maioria não instalada.
- `game-jam`, `steam-publish`, `itch-publish`, `gd-go-to-market`: publicação em lojas/jams; o jogo é publicado como site estático.
- `godot-gamedev` (setcodes).
- reason-machines/claude-code-game-studios: repositório não encontrado (privado ou nome diferente).

## Segunda rodada (realismo) — descartadas
- **Xyloforge/claude-game-skills**: já instalada e idêntica à versão atual.
- **Skyrant/gamedev-agent-skills**: cópia mais antiga (out/2026) da coleção awesome-gamedev-agent-skills já instalada (nov/2026).
- **jammyfu/open-game-skills** (195): contratos de arquitetura de ~30 linhas sem técnica de realismo; o pacote exige instalação completa para as referências funcionarem.
- ForgeSkills: `gamedev-camera` e `gamedev-performance` (sobrepõem camera-systems e performance-optimization/game-detail-bar), `gamedev-verification` e `gamedev-orchestrator` (sobrepõem o fluxo do CLAUDE.md e gd-pipeline), `gamedev-animation`, `gamedev-procedural-modeling`, `gamedev-blender-headless` (rigging/modelagem em Blender; o jogo gera geometria no código), `gamedev-vfx-impact`, `gamedev-boss-encounter`, `gamedev-gameplay-systems` (combate; o jogo não tem violência), Godot/Unity, concept-lab/judge, debugging, game-testing (Godot).
- GameStack: `game-feel-and-juice`, `level-design` (já instaladas equivalentes), `3d-graphics-and-rendering` (coberta por threejs-materials-lighting + gamedev-lighting + guia 3d-scenes), `art-direction-and-readability` (gamedev-art-direction é mais prática), combate/RPG/permadeath/monetização/narrativa (fora do escopo).

## Atualizar
Repita a cópia a partir do repositório de origem (`git clone --depth 1`), revisando o diff antes de commitar.
