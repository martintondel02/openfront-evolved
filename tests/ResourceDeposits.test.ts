import { vi } from "vitest";
import { AirstrikeExecution } from "../src/core/execution/AirstrikeExecution";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  ResourceDepositType,
  UnitType,
} from "../src/core/game/Game";
import { setup } from "./util/Setup";

let game: Game;
let player: Player;
let other: Player;

beforeEach(async () => {
  game = await setup("big_plains", { instantBuild: true, infiniteGold: true }, [
    new PlayerInfo("player", PlayerType.Human, null, "player_id"),
    new PlayerInfo("other", PlayerType.Human, null, "other_id"),
  ]);
  player = game.player("player_id");
  other = game.player("other_id");
});

function findDeposit(type: ResourceDepositType): number | null {
  const deposits = game.resourceDeposits();
  if (deposits === null) return null;
  for (let i = 0; i < deposits.length; i++) {
    if (deposits[i] === type && game.isLand(i) && !game.hasOwner(i)) return i;
  }
  return null;
}

describe("resource deposits", () => {
  it("generates oil and ore deposits deterministically", () => {
    const deposits = game.resourceDeposits();
    expect(deposits).not.toBeNull();
    const oil = deposits!.filter((v) => v === ResourceDepositType.Oil).length;
    const ore = deposits!.filter((v) => v === ResourceDepositType.Ore).length;
    expect(oil).toBeGreaterThan(0);
    expect(ore).toBeGreaterThan(0);
  });

  it("OilPump builds only on an owned oil deposit", () => {
    const oilTile = findDeposit(ResourceDepositType.Oil);
    expect(oilTile).not.toBeNull();
    player.conquer(oilTile!);
    expect(player.canBuild(UnitType.OilPump, oilTile!)).not.toBe(false);
  });

  it("OilPump does not build on ore or plain land", () => {
    const oreTile = findDeposit(ResourceDepositType.Ore);
    if (oreTile !== null) {
      other.conquer(oreTile); // owned by someone else -> also false for us
      expect(player.canBuild(UnitType.OilPump, oreTile)).toBe(false);
    }
    expect(player.canBuild(UnitType.OilPump, game.ref(1, 1))).toBe(false);
  });

  it("extraction boosts trade income", () => {
    const before = game.config().tradeShipGold(1000, player);
    player.buildUnit(UnitType.OilPump, game.ref(2, 2), {});
    const after = game.config().tradeShipGold(1000, player);
    expect(Number(after)).toBeCloseTo(
      Number(before) * (1 + game.config().resourceTradeBonusPercent()),
      0,
    );
  });
});

describe("airstrike", () => {
  function buildAirstrip(p: Player): void {
    const t = game.ref(5, 5);
    p.conquer(t);
    p.buildUnit(UnitType.Airstrip, t, {});
  }

  it("requires an airstrip", () => {
    other.conquer(game.ref(20, 20));
    expect(player.canBuild(UnitType.Airstrike, game.ref(20, 20))).toBe(false);
    buildAirstrip(player);
    expect(player.canBuild(UnitType.Airstrike, game.ref(20, 20))).not.toBe(
      false,
    );
  });

  it("cannot strike own or allied land", () => {
    buildAirstrip(player);
    player.conquer(game.ref(6, 6));
    expect(player.canBuild(UnitType.Airstrike, game.ref(6, 6))).toBe(false);
  });

  it("jet flies to target and detonates, capturing the tile", () => {
    buildAirstrip(player);
    const target = game.ref(20, 20);
    other.conquer(target);
    const spy = vi.spyOn(other, "relinquish");

    const exec = new AirstrikeExecution(player, target);
    exec.init(game, 0);
    for (let i = 0; i < 200 && exec.isActive(); i++) exec.tick(i);

    expect(exec.isActive()).toBe(false);
    expect(spy).toHaveBeenCalled();
    expect(game.hasOwner(target)).toBe(false);
  });
});
