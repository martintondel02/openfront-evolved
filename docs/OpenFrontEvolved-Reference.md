# OpenFront Evolved — Player Reference

New stuff on top of vanilla OpenFront. Everything on this page is live; the
dev copy is in `docs/OpenFrontEvolved.md`.

## Resources: oil & ore

The map is sprinkled with two deposit types at game start, visible as glowing
markers over terrain:

- **Amber glow** = oil deposit
- **Cyan glow** = ore deposit

Deposits are the same on every client — no one sees a different map.

### How to extract

1. Conquer land so a deposit tile falls inside your territory.
2. Build the matching extractor on that tile:
   - **Oil Pump** on an oil deposit
   - **Mine** on an ore deposit
3. Each extractor permanently boosts your trade income: **+15% per extractor**
   (capped at 8 extractors = **+120%**). Both trade ships and trains count.

The bonus drops the moment you lose the extractor — enemies _should_ raid
them.

|            | Oil Pump                           | Mine                     |
| ---------- | ---------------------------------- | ------------------------ |
| Needs      | Oil deposit in your land           | Ore deposit in your land |
| Cost       | 150k, doubles per extra (max 500k) | Same as oil pump         |
| Effect     | +15% trade                         | +15% trade               |
| Upgradable | Yes                                | Yes                      |

## Airstrikes

Long-range fire support that doesn't require a navy or a nuke silo.

### Airstrip (structure)

- Cost **1.5M**, build anywhere on your land.
- Each level = **one jet charge**. After a strike, the strip reloads in
  **120 ticks (~12s)**.
- Upgradable like a SAM.

### Airstrike (per-launch attack)

- Click **N** (or pick it from the build / radial menu), then click target
  land.
- Nearest ready airstrip launches one jet and spends one charge. Strike
  costs **400k** per jet.
- The jet is a unit: it flies over water, takes ~7 ticks per 100 tiles, and
  **can be shot down by SAMs** — the enemy sees it coming.
- On impact:
  - Everything within a **6-tile** circle around the target point is wiped:
    buildings, ships, units.
  - Tiles within a **12-tile** circle go neutral (no water conversion, no
    fallout — anyone can re-capture).
  - Troops in the blast take heavy losses.
- You can't strike your own land, teammates, or allies.

### When to use it

- Sniping an enemy airstrip / port / nuke silo before they can fire.
- Clearing a beach-head before a boat landing.
- Breaking a fortified border — hit where they _can't_ put a SAM.
- Finishing a weakened player — a strike at their capital deletes their
  production and strips the land around it.

## Hotbar keys (defaults)

| Key | Unit      |
| --- | --------- |
| O   | Oil Pump  |
| I   | Mine      |
| P   | Airstrip  |
| N   | Airstrike |

Rebind in Settings like the other build keys.
