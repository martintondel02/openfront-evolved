import { Execution, Game, Unit } from "../game/Game";

/**
 * Airstrip: manages launch charges via the same missileTimerQueue mechanism
 * as missile silos. Each charge recovers after a cooldown.
 */
export class AirstripExecution implements Execution {
  private active = true;
  private mg: Game;

  constructor(private airstrip: Unit) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
  }

  tick(ticks: number): void {
    if (this.airstrip.isUnderConstruction()) return;
    if (!this.airstrip.isActive()) {
      this.active = false;
      return;
    }
    const frontTime = this.airstrip.missileTimerQueue()[0];
    if (frontTime === undefined) return;
    if (this.mg.ticks() - frontTime >= this.mg.config().AirstripCooldown()) {
      this.airstrip.reloadMissile();
    }
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
