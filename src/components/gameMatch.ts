import { EventEmitter } from "../types";
import { clamp } from "../utils/math";
import type { CarName, MatchGui, PowerUpKind } from "./types";

export type PowerupMetadata = {
  kind: PowerUpKind;
  timer: number;
};

export type PlayerMetadata = {
  health: number;
  score: number;
  powerup?: PowerupMetadata;
};

export type MatchEventArgs = {
  suddenDeath: {};
  gameOver: {
    loser: CarName;
  };
  powerSpawn: {
    kind: PowerUpKind;
    count: number;
  };
  powerExpires: {
    player: CarName;
    kind: PowerUpKind;
  };
  powerDepletes: {
    player: CarName;
    kind: PowerUpKind;
  };
};

export type MatchEvent = (event: MatchEventArgs) => void;

// in seconds
const PowerupDurations: Record<PowerUpKind, number> = {
  heavy: 16,
  orbit: 12,
};

export class MatchManager implements EventEmitter<MatchEventArgs> {
  // this map pattern is to take advantage of string narrowing
  private _players: Map<CarName, PlayerMetadata>;
  private _gui?: MatchGui;
  private _endFlag = false;

  private readonly timeEvents = {
    suddenDeath: (t: number) => t >= 1.5 * 60,
  };

  private spawnQueue: (PowerupMetadata & { count: number })[];
  private activeBoxes: number;

  private _listeners = new Map<
    keyof MatchEventArgs,
    Array<(args: any) => void>
  >();

  constructor() {
    this._players = new Map<CarName, PlayerMetadata>([
      ["carA", { health: 100, score: 0 }],
      ["carB", { health: 100, score: 0 }],
    ]);
    this.spawnQueue = [];
    this.activeBoxes = 0;
    this.resetState();
  }

  resetState() {
    this._endFlag = false;
    this.makeDamage("carA", -100);
    this.makeDamage("carB", -100);
    this.unsetPowerup("carA");
    this.unsetPowerup("carB");

    // Ensure the GUI re-syncs the persistent score upon reset
    this._gui?.updateScore("carA", this._players.get("carA")!.score);
    this._gui?.updateScore("carB", this._players.get("carB")!.score);

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

  addEventListener<K extends keyof MatchEventArgs>(
    event: K,
    callback: (args: MatchEventArgs[K]) => void,
  ): void {
    const listeners = this._listeners.get(event);
    if (listeners) {
      listeners.push(callback);
    } else {
      this._listeners.set(event, [callback]);
    }
  }

  private execListeners<K extends keyof MatchEventArgs>(
    event: K,
    args: MatchEventArgs[K],
  ) {
    const listeners = this._listeners.get(event);
    for (const listener of listeners ?? []) {
      listener(args);
    }
  }

  linkGUI(gui: MatchGui) {
    this._gui = gui;

    this._gui.updateHealth("carA", this._players.get("carA")!.health);
    this._gui.updateScore("carA", this._players.get("carA")!.score);
    this._gui.setPowerUp(
      "carA",
      this._players.get("carA")?.powerup?.kind ?? "none",
    );

    this._gui.updateHealth("carB", this._players.get("carB")!.health);
    this._gui.updateScore("carB", this._players.get("carB")!.score);
    this._gui.setPowerUp(
      "carB",
      this._players.get("carB")?.powerup?.kind ?? "none",
    );
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
    if (this._endFlag) return;
    const pl = this._players.get(player)!;
    pl.health = clamp(pl.health - amount, 0, 100);
    this._gui?.updateHealth(player, pl.health);
    if (pl.health <= 0) {
      this._endFlag = true;
      this.execListeners("gameOver", { loser: player });
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
          this.execListeners("powerExpires", {
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
        this.execListeners("powerSpawn", {
          kind: power.kind,
          count: power.count,
        });
      }
    }
  }

  checkTime() {
    const time = this._gui?.currentTime ?? 0;
    if (this.timeEvents.suddenDeath(time)) {
      this.execListeners("suddenDeath", {});
    }
  }

  addScore(player: CarName) {
    const pl = this._players.get(player)!;
    pl.score += 1;
    this._gui?.updateScore(player, pl.score);
  }
}
