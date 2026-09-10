# OpenFront Evolved — Design Doc

New mechanics added on top of upstream OpenFront: **land resources**, an **airstrike system**, and the supporting render/UI plumbing. This file is the authoritative reference; `docs/OpenFrontEvolved-Reference.md` is the player-facing cheat sheet.

## Land resources (oil & ore)

### Placement

`src/core/game/ResourceDeposits.ts` — `generateResourceDeposits(map, rng)`:

- Called once at game start by `GameRunner.createGameRunner` with
  `new PseudoRandom(simpleHash(gameID) + 3)`. The result is a pure function of
  (map, gameID), so every client and the server land on the same tiles without
  touching the wire format.
- Picks ~`1800 / 1M land tiles` seed points (tunable via `densityPerMillionTiles`),
  half oil (`1`), half ore (`2`), each expanded into a 5×5 disc at ~60 %
  density (`clusterRadius = 2`). Only passable land tiles qualify.
- Stored on the `Game` instance as a `Uint8Array` (0/1/2). Accessors:
  `game.hasResourceDeposit(tile)`, `game.resourceDepositType(tile)`.
- Tests get the same treatment via a fixed seed in `tests/util/Setup.ts`.

### Placement rules (placement validation)

`src/core/game/PlayerImpl.ts` — `extractorSpawn(tile, validTiles, depositType)`:

- Building must sit **on a tile containing the matching deposit type** and the
  tile must be **inside the player's territory** (shared `validStructureSpawnTiles`
  walk, including `structureMinDist` spacing against other structures).
- Drives both the ghost preview, the right-click build menu, and execution —
  the same `canBuild` → `canSpawnUnitType` path serves all three, so client and
  sim can never disagree.

### Economy

`src/core/configuration/Config.ts`:

| Knob                  | Value                                                  |
| --------------------- | ------------------------------------------------------ |
| Extractor cost        | `150k * (n owned + 1)`, capped at **500k**, upgradable |
| Construction duration | 80 ticks (10 s), 0 with `instantBuild`                 |
| Trade bonus           | **+15 %** per extractor                                |
| Bonus cap             | **8 extractors** (so max **+120 %**)                   |

Applied in two places — `tradeShipGold()` and `trainGold()` — via
`resourceTradeMultiplier(player) = 1 + 0.15 * min(oilPump + mine count, 8)`.
The multiplier is derived from live `unitCount`, so it always matches the sim
and requires no stored state. In-game, each extractor raises the gold every
trade ship pays upon arrival and every train pays at a station.

Nothing decays: a pump continues to pay until the enemy captures or destroys it.

## Airstrike system

### Airstrip structure

- `UnitType.Airstrip` (structure). Cost 1.5 M, 120-tick construction,
  upgradable. One **charge per level** — the same `missileTimerQueue /
isInCooldown / launch / reloadMissile` mechanism the missile silo uses.
- `AirstripExecution.ts` re-charges a spent charge after `AirstripCooldown` =
  **120 ticks** (silo-equivalent 90 on nukes).
- Placement: normal land structure (no deposit requirement).

### Airstrike jet

- `UnitType.Airstrike`, build-type attack in the build menu (N key / build
  menu / radial attack menu). Cost 400 k per launch.
- Launch: `PlayerImpl.airstripSpawn(target)` picks the nearest airstrip that
  is active, off cooldown, and not under construction; the strike costs the
  airstrip one charge (`airstrip.launch()`).
- Target rules: land, not impassable, outside spawn immunity, not own land,
  not teammates, not allies.

### Flight

`src/core/execution/AirstrikeExecution.ts`:

- Parabolic path via `UniversalPathFinding.Parabola` at `airstrikeSpeed()` =
  **14 tiles/tick** (atom bomb 10, MIRV warhead 22 for reference).
- Carries a `TrajectoryTile[]` and motion-plan record so the client renders
  the flight smoothly (`UnitPass`, column 12 in `unit-atlas.png`).
- Sets `targetedBySAM(false)` so **SAM launchers can intercept it** — wired
  into `SAMLauncherExecution.getValidTargets`, the early-exit counter, and
  `SAMMissileExecution`'s whitelist (same entries add `Airstrike`).
- A level-N SAM has N missiles in the air at once; one SAM missile kills one
  jet.

### Damage model

`airstrikeMagnitudes()` = `{ inner: 6, outer: 12 }` tiles (vs. atom bomb
12/30, hydro 80/100).

On impact, within the **outer** radius:

1. Every player-owned tile is relinquished (goes neutral).
2. Each affected player loses
   `airstrikeDeathFactor(troops, tilesLeft) = 2 * troops / tilesLeft` troops
   per hit tile, so the drop scales with how much territory got clipped.
3. Within the **inner** radius (6), all non-flight units — structures
   included — are deleted outright (owner gets the "unit destroyed" events).
4. No water conversion, no fallout: the land is re-capturable immediately.

That's why the airstrike reads as "surgical strike" — it clears structures
and troops, but the attacker still has to invade to gain ground.

## Rendering

| Piece                                            | File                                                                                                                          |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Deposit overlay (static, instanced glowing dots) | `gl/passes/DepositPass.ts` + `gl/shaders/deposit/`                                                                            |
| Structure icons (atlas)                          | `resources/atlases/icon-atlas.png` — cols now oil pump / mine / airstrip. Regenerate with `node scripts/extendIconAtlas.mjs`. |
| In-flight jet sprite                             | `resources/atlases/unit-atlas.png` col 12 (drawn inline)                                                                      |
| Build-menu SVGs                                  | `resources/images/{OilPump,Mine,Airstrip,Airstrike}IconWhite.svg`                                                             |

`DepositPass.setDepositData(Uint8Array)` is called once at game start from
`ClientGameRunner.createWebGLView`, regenerating deposits client-side (same
`simpleHash(gameID) + 3` seed as the worker).

Structure shape SDFs live in `shaders/structure/structure.frag.glsl`:
6 = oil pump → diamond, 7 = mine → heptagon, 8 = airstrip → rotated square.

Deposit color palette is hardcoded in `deposit.frag.glsl`: oil `#ffd126`
(amber, 1.0 0.82 0.08 in 0-1), ore `#33ccdd` (teal/cyan).

## UI / i18n

| Surface            | Where                                                          | What                                                                                                        |
| ------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Build menu         | `src/client/hud/layers/BuildMenu.ts`                           | Second row with Oil Pump / Mine / Airstrip / Airstrike cards                                                |
| Hotbar             | `src/client/hud/layers/UnitDisplay.ts`                         | Icons + live counts, keybinds O / I / P / N                                                                 |
| Keybinds           | `src/client/InputHandler.ts` + `src/core/game/UserSettings.ts` | `buildOilPump`, `buildMine`, `buildAirstrip`, `buildAirstrike`                                              |
| Radial menu        | `RadialMenuElements.ts`                                        | Automatic via `buildTable` + `BuildableAttacks`                                                             |
| Ghost blast ring   | `BuildPreviewController.ts`                                    | `Airstrike` case shows the outer radius while targeting                                                     |
| Names/descriptions | `resources/lang/en.json`                                       | `unit_type.{oil_pump,mine,airstrip,airstrike}` + `build_menu.desc.*` + `events_display.airstrike_detonated` |
| Config disable     | `gameConfig.disabledUnits`                                     | Any new `UnitType` can be lobby-disabled                                                                    |

## Core touch points (where to edit)

| Symbol                                                  | File                                                | Purpose                                                                                                                |
| ------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `UnitType.OilPump / Mine / Airstrip / Airstrike`        | `src/core/game/Game.ts`                             | enum + `Structures` / `BuildableAttacks` groups                                                                        |
| `UnitParamsMap`                                         | `src/core/game/Game.ts`                             | `Airstrike` carries `{ targetTile, trajectory }`                                                                       |
| `unitInfo`                                              | `src/core/configuration/Config.ts`                  | Costs, construction times                                                                                              |
| `canSpawnUnitType` + `extractorSpawn` / `airstripSpawn` | `src/core/game/PlayerImpl.ts`                       | Placement validation                                                                                                   |
| `ConstructionExecution`                                 | `src/core/execution/ConstructionExecution.ts`       | Routes new types (airstrip → `AirstripExecution`, airstrike → `AirstrikeExecution`; pumps/mines need no per-tick exec) |
| `AirstrikeExecution`, `AirstripExecution`               | `src/core/execution/`                               | Flight + charge bookkeeping                                                                                            |
| SAM interop                                             | `SAMLauncherExecution.ts`, `SAMMissileExecution.ts` | Whitelists that add `UnitType.Airstrike`                                                                               |
| `StatsSchemas.NukeType`                                 | `src/core/StatsSchemas.ts`                          | Airstrike folds into the atom-bomb stat bucket                                                                         |

## Balance cheat sheet (everything in `Config.ts`)

| Want to change                 | Knob                                                                   |
| ------------------------------ | ---------------------------------------------------------------------- |
| How many deposits              | `generateResourceDeposits(..., densityPerMillionTiles)` (default 1800) |
| Extractor build cost           | `unitInfo(OilPump/Mine)` cost fn (150k × (n+1), cap 500k)              |
| Trade boost per extractor      | `resourceTradeBonusPercent()` (0.15)                                   |
| Max effective extractors       | `resourceTradeBonusCap()` (8)                                          |
| Airstrip cost                  | `unitInfo(Airstrip)` (1.5M flat)                                       |
| Re-charge time between strikes | `AirstripCooldown()` (120)                                             |
| Flight speed                   | `airstrikeSpeed()` (14)                                                |
| Blast size                     | `airstrikeMagnitudes()` (inner 6, outer 12)                            |
| Troop damage                   | `airstrikeDeathFactor()` (2 × troops / tilesOwned per hit tile)        |
| Strike cost                    | `unitInfo(Airstrike)` (400k flat)                                      |

## Tests

- `tests/ResourceDeposits.test.ts` — determinism, placement rules (extractor
  must be on a matching owned deposit), trade-boost formula, full airstrike
  flight → detonation, own-land and no-airstrip rejection.

Run `npx vitest tests/ResourceDeposits.test.ts --run`.

## Headless testing escape hatch (dev only)

`?allowSoftwareGL=1` in the URL (or `sessionStorage.__allowSoftwareGL = "1"`)
makes `initGL` accept a SwiftShader / software WebGL2 context instead of
showing the "Hardware acceleration is off" gate. Used for the headless
Chromium driver runs (`.claude/skills/run-openfront/`). Gate is untouched for
real players.
