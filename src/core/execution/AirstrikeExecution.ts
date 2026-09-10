import {
  Execution,
  Game,
  isUnit,
  MessageType,
  Player,
  TerraNullius,
  TrajectoryTile,
  Unit,
  UnitType,
} from "../game/Game";
import { TileRef } from "../game/GameMap";
import { UniversalPathFinding } from "../pathfinding/PathFinder";
import { ParabolaUniversalPathFinder } from "../pathfinding/PathFinder.Parabola";
import { PathStatus } from "../pathfinding/types";

const SPRITE_RADIUS = 16;

/**
 * Airstrike: a jet launched from an airstrip that flies to a target tile and
 * detonates: removes tile ownership (no water conversion), kills troops, and
 * destroys structures/units in a small radius. Interceptable by SAMs.
 */
export class AirstrikeExecution implements Execution {
  private active = true;
  private mg: Game;
  private airstrike: Unit | null = null;
  private pathFinder: ParabolaUniversalPathFinder;

  constructor(
    private player: Player,
    private dst: TileRef,
    private src?: TileRef | null,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.pathFinder = UniversalPathFinding.Parabola(mg, {
      increment: this.mg.config().airstrikeSpeed(),
      directionUp: true,
    });
  }

  public target(): Player | TerraNullius {
    return this.mg.owner(this.dst);
  }

  tick(ticks: number): void {
    if (this.airstrike === null) {
      const spawn = this.player.canBuild(UnitType.Airstrike, this.dst);
      if (spawn === false) {
        this.active = false;
        return;
      }
      this.src ??= spawn;
      const airstrip = this.player
        .units(UnitType.Airstrip)
        .find((a) => a.tile() === spawn);
      this.airstrike = this.player.buildUnit(UnitType.Airstrike, this.src, {
        targetTile: this.dst,
        trajectory: this.getTrajectory(this.dst),
      });
      this.recordMotionPlan(ticks);
      if (this.mg.hasOwner(this.dst)) {
        const target = this.mg.owner(this.dst);
        if (target.isPlayer()) {
          this.mg.displayIncomingUnit(
            this.airstrike.id(),
            `${this.player.displayName()} - airstrike inbound`,
            MessageType.NUKE_INBOUND,
            target.id(),
          );
        }
      }
      if (airstrip) {
        airstrip.launch();
      }
      return;
    }

    if (!this.airstrike.isActive()) {
      this.active = false;
      return;
    }

    const speed = this.mg.config().airstrikeSpeed();
    const result = this.pathFinder.next(this.src!, this.dst, speed);

    if (result.status === PathStatus.COMPLETE) {
      this.airstrike.move(result.node);
      const shouldBeDestroyed =
        this.mg.nearbyUnits(
          this.dst,
          this.mg.config().defaultSamMissileSpeed(),
          UnitType.SAMMissile,
          ({ unit }) => {
            if (!isUnit(unit) || unit.owner() === this.airstrike?.owner())
              return false;
            return unit.targetUnit()?.id() === this.airstrike?.id();
          },
        ).length >= 1;
      if (!shouldBeDestroyed) this.detonate();
    } else if (result.status === PathStatus.NEXT) {
      this.airstrike.move(result.node);
      this.airstrike.setTrajectoryIndex(this.pathFinder.currentIndex());
    }
  }

  private getTrajectory(target: TileRef): TrajectoryTile[] {
    const trajectoryTiles: TrajectoryTile[] = [];
    const targetRangeSquared =
      this.mg.config().defaultNukeTargetableRange() ** 2;
    const allTiles = this.pathFinder.findPath(this.src!, target) ?? [];
    for (const tile of allTiles) {
      trajectoryTiles.push({
        tile,
        targetable:
          this.src !== undefined &&
          this.src !== null &&
          this.mg.euclideanDistSquared(this.src, tile) < targetRangeSquared,
      });
    }
    return trajectoryTiles;
  }

  private recordMotionPlan(ticks: number): void {
    if (this.airstrike === null || this.src === undefined || this.src === null)
      return;
    const speed = this.mg.config().airstrikeSpeed();
    const pathFinder = UniversalPathFinding.Parabola(this.mg, {
      increment: speed,
      directionUp: true,
    });
    const path: TileRef[] = [this.src];
    let result = pathFinder.next(this.src, this.dst, speed);
    while (result.status === PathStatus.NEXT) {
      path.push(result.node);
      result = pathFinder.next(this.src, this.dst, speed);
    }
    this.mg.recordMotionPlan({
      kind: "grid",
      unitId: this.airstrike.id(),
      planId: 1,
      startTick: ticks + 1,
      ticksPerStep: 1,
      path,
    });
  }

  private detonate() {
    if (this.airstrike === null) {
      throw new Error("Not initialized");
    }
    const mg = this.mg;
    const magnitude = mg.config().airstrikeMagnitudes();
    const inner2 = magnitude.inner * magnitude.inner;
    const outer2 = magnitude.outer * magnitude.outer;

    const damageTiles = mg.bfs(this.dst, (gm, n: TileRef) => {
      const d2 = mg.euclideanDistSquared(this.dst, n);
      return d2 <= outer2 && !mg.isImpassable(n);
    });

    // Remove ownership and reduce troops in the outer radius.
    const tilesPerPlayers = new Map<Player, number>();
    for (const tile of damageTiles) {
      const owner = mg.owner(tile);
      if (owner.isPlayer()) {
        owner.relinquish(tile);
        tilesPerPlayers.set(owner, (tilesPerPlayers.get(owner) ?? 0) + 1);
      }
    }
    for (const [player, numImpactedTiles] of tilesPerPlayers) {
      const tilesBefore = player.numTilesOwned() + numImpactedTiles;
      for (let i = 0; i < numImpactedTiles; i++) {
        player.removeTroops(
          mg.config().airstrikeDeathFactor(player.troops(), tilesBefore - i),
        );
      }
    }

    // Destroy units in the inner radius. Other airstrikes/SAM
    // missiles/nukes are spared.
    for (const unit of mg.units()) {
      const type = unit.type();
      if (
        type === UnitType.AtomBomb ||
        type === UnitType.HydrogenBomb ||
        type === UnitType.MIRVWarhead ||
        type === UnitType.MIRV ||
        type === UnitType.SAMMissile ||
        type === UnitType.Airstrike
      ) {
        continue;
      }
      if (mg.euclideanDistSquared(this.dst, unit.tile()) < inner2) {
        unit.delete(true, this.player);
      }
    }

    const radius = magnitude.outer + SPRITE_RADIUS;
    this.active = false;
    this.airstrike.setReachedTarget();
    this.airstrike.delete(false);
    // Touch nearby structures so the client redraws them.
    const radiusSq = radius * radius;
    for (const unit of mg.units()) {
      if (mg.euclideanDistSquared(this.dst, unit.tile()) < radiusSq) {
        unit.touch();
      }
    }
    const dstOwner = this.mg.owner(this.dst);
    if (dstOwner.isPlayer()) {
      mg.displayMessage(
        "events_display.airstrike_detonated",
        MessageType.NUKE_DETONATED,
        dstOwner.id(),
        undefined,
        { name: this.player.displayName() },
        undefined,
        this.player.id(),
      );
    }
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
