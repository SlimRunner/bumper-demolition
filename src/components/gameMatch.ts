import { clamp } from "../utils/math";
import type { CarName, MatchGui, PowerUpKind } from "./types";

export type PowerupMetadata = {
  kind: PowerUpKind;
  timer: number;
};

export type PlayerMetadata = {
  health: number;
  powerup?: PowerupMetadata;
};

export type MatchEvent = (
  event:
    | {
        event: "suddentDeath";
      }
    | {
        event: "gameOver";
        loser: CarName;
      }
    | {
        event: "powerSpawn";
        kind: PowerUpKind;
        count: number;
      }
    | {
        event: "powerExpires";
        player: CarName;
        kind: PowerUpKind;
      },
) => void;

// in seconds
const PowerupDurations: Record<PowerUpKind, number> = {
  heavy: 8,
  orbit: 16,
};

export class MatchManager {
  // this map pattern is to take advantage of string narrowing
  private _players: Map<CarName, PlayerMetadata>;
  private _gui?: MatchGui;

  private readonly timeEvents = {
    suddenDeath: (t: number) => t >= 4 * 60,
  };

  private spawnQueue: (PowerupMetadata & { count: number })[];
  private activeBoxes: number;

  constructor(private callback: MatchEvent) {
    this._players = new Map<CarName, PlayerMetadata>([
      ["carA", { health: 100 }],
      ["carB", { health: 100 }],
    ]);
    this.spawnQueue = [];
    this.activeBoxes = 0;
    this.resetState();
  }

  resetState() {
    this.makeDamage("carA", -100);
    this.makeDamage("carB", -100);
    this.unsetPowerup("carA");
    this.unsetPowerup("carB");
    this.spawnQueue = [
      {
        kind: "orbit",
        timer: 0.01,
        count: 0,
      },
      {
        kind: "orbit",
        timer: 0.01,
        count: 1,
      },
    ];
    this.activeBoxes = 0;
  }

  private get playerA() {
    return this._players.get("carA")!;
  }

  private get playerB() {
    return this._players.get("carA")!;
  }

  linkGUI(gui: MatchGui) {
    this._gui = gui;

    this._gui.updateHealth("carA", this.playerA.health);
    this._gui.setPowerUp("carA", this.playerA.powerup?.kind ?? "none");

    this._gui.updateHealth("carB", this.playerB.health);
    this._gui.setPowerUp("carB", this.playerB.powerup?.kind ?? "none");
  }

  getHealth(player: CarName) {
    return this._players.get(player)!.health;
  }

  getPowerup(player: CarName) {
    return this._players.get(player)!.powerup;
  }

  setPowerup(player: CarName, powerup: PowerUpKind) {
    this._players.get(player)!.powerup ??= {
      kind: powerup,
      timer: PowerupDurations[powerup],
    };
    this._gui?.setPowerUp(player, powerup);
    this.activeBoxes--;
  }

  makeDamage(player: CarName, amount: number) {
    const pl = this._players.get(player)!;
    pl.health = clamp(pl.health - amount, 0, 100);
    this._gui?.updateHealth(player, pl.health);
    if (pl.health <= 0) {
      console.log("gameOver");
      this.callback({
        event: "gameOver",
        loser: player,
      });
    }
  }

  unsetPowerup(player: CarName) {
    const pl = this._players.get(player)!;
    pl.powerup = undefined;
    this._gui?.setPowerUp(player, "none");
  }

  updateExpiry(timeDelta: number) {
    for (const [pl, meta] of this._players) {
      if (meta.powerup) {
        meta.powerup.timer = meta.powerup.timer - timeDelta;

        if (meta.powerup.timer < 0) {
          this.callback({
            event: "powerExpires",
            player: pl,
            kind: meta.powerup.kind,
          });
          this.unsetPowerup(pl);
        }
      }
    }
    const last = this.spawnQueue.length - 1;
    if (this.activeBoxes < 2) {
      this.spawnQueue[last].timer -= timeDelta;
      if (this.spawnQueue[last].timer <= 0) {
        const power = this.spawnQueue.pop()!;
        this.spawnQueue.unshift({
          kind: Math.random() > 0.5 ? "heavy" : "orbit",
          timer: 20,
          count: power.count + 1,
        });
        this.activeBoxes++;
        this.callback({
          event: "powerSpawn",
          kind: power.kind,
          count: power.count,
        });
      }
    }
  }

  checkTime() {
    const time = this._gui?.currentTime ?? 0;
    if (this.timeEvents.suddenDeath(time)) {
      this.callback({
        event: "suddentDeath",
      });
    }
  }
}
