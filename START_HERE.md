# How to use this pack in Antigravity (for you, not the agent)

1. Unzip → File > Open Folder → `entitlesim/` in Antigravity. AGENTS.md at the root is picked up automatically as persistent rules.
2. Open the Agent panel. Type `/build-phase` and then `Phase 1`. Send.
3. When it finishes, check it runs, then `/build-phase` `Phase 2`. Repeat through Phase 5.
4. If something fails, paste ONLY the error text + "fix, don't refactor". Don't re-explain the project.

## Quota rules
- 5 prompts total for the whole build; keep every prompt one phase.
- Don't use Manager-view parallel agents (they multiply usage).
- Don't ask it to "test in browser" until Phase 5.
- Use `/usage` or `/quota` to check what's left before a big phase (Phase 2 and 4 are the heaviest). If low, wait for the reset and start that phase later.
- Rules/workflow files are capped at 12,000 chars each (all files here are under).
