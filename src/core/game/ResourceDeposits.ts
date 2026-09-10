import { PseudoRandom } from "../PseudoRandom";
import { ResourceDepositType } from "./Game";
import { GameMap } from "./GameMap";

/**
 * Deterministically scatter oil/ore deposits on passable land tiles and
 * return a per-tile Uint8Array (0 = none, 1 = oil, 2 = ore), same on all
 * clients because it's a pure function of (map, rng).
 *
 * Deposits are small clusters: pick a seed tile, then sprinkle a few
 * neighbors so pumps/mines have a compact footprint to sit on.
 */
export function generateResourceDeposits(
  map: GameMap,
  random: PseudoRandom,
  densityPerMillionTiles: number = 1_800,
  clusterRadius: number = 2,
): Uint8Array {
  const size = map.width() * map.height();
  const deposits = new Uint8Array(size);

  let landTiles = 0;
  for (let i = 0; i < size; i++) {
    if (map.isLand(i)) landTiles++;
  }
  if (landTiles === 0) return deposits;

  const numSeeds = Math.max(
    4,
    Math.floor((landTiles * densityPerMillionTiles) / 1_000_000),
  );

  const half = Math.floor(numSeeds / 2);
  for (let i = 0; i < numSeeds; i++) {
    const type = i < half ? ResourceDepositType.Oil : ResourceDepositType.Ore;
    // Try a few times to find a passable land seed tile.
    for (let attempt = 0; attempt < 20; attempt++) {
      const ref = random.nextInt(0, size);
      if (!map.isLand(ref)) continue;
      placeCluster(map, deposits, ref, type, clusterRadius, random);
      break;
    }
  }
  return deposits;
}

function placeCluster(
  map: GameMap,
  deposits: Uint8Array,
  center: number,
  type: ResourceDepositType,
  radius: number,
  random: PseudoRandom,
): void {
  const cx = map.x(center);
  const cy = map.y(center);
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue;
      // ~60% density inside the cluster disc.
      if (random.nextFloat(0, 1) > 0.6) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (!map.isValidCoord(x, y)) continue;
      const ref = map.ref(x, y);
      if (map.isLand(ref) && deposits[ref] === ResourceDepositType.None) {
        deposits[ref] = type;
      }
    }
  }
}
