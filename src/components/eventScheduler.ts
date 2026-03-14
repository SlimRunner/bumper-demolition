import { enumerate } from "../utils/iterators";

export type SchedulerEvent<K extends string> =
  | { type: "timed"; ident: K; duration: number }
  | { type: "event"; ident: K; isExpired: (time: number) => boolean };

/**
 * Allows defining a squence of timed and user defined events
 *
 * ## Usage
 * ```
 * const gameEvents = [
 *   { type: "timed", ident: "intro_logo", duration: 2 },
 *   { type: "timed", ident: "intro_cinematic", duration: 5 },
 *   { type: "event", ident: "match_loop", isExpired: (t: number) => t > 300 }, // 5 mins
 *   { type: "timed", ident: "outro", duration: 3 },
 * ] as const; // <--- 'as const' to get literal types in listener
 *
 * const stageManager = new Scheduler(
 *   [...gameEvents],
 *   (ident, time) => {
 *     // 'ident' is now strictly: "intro_logo" | "intro_cinematic" | "match_loop" | "outro"
 *     console.log(`Firing: ${ident} after ${time}s`);
 *   },
 *   () => console.log("All stages finished!"),
 * );
 * ```
 */
export class Scheduler<K extends string, E extends SchedulerEvent<K>> {
  private index = 0;
  private timer = 0;
  private events: E[];

  constructor(
    events: E[],
    private listener: (ident: E["ident"], elapsed: number) => void,
    private onComplete?: () => void,
  ) {
    this.events = events;
  }

  update(timeDelta: number) {
    this.timer += timeDelta;

    // Loop as long as there are events and the current one is ready to "pop"
    while (this.index < this.events.length) {
      const current = this.events[this.index];
      let fired = false;

      if (current.type === "timed") {
        if (this.timer >= current.duration) {
          this.listener(current.ident, current.duration);
          this.timer -= current.duration;
          fired = true;
        }
      } else if (current.type === "event") {
        if (current.isExpired(this.timer)) {
          this.listener(current.ident, this.timer);
          this.timer = 0; // Reset for the next sequence phase
          fired = true;
        }
      }

      if (fired) {
        this.index++;
        // If we just finished the last event
        if (this.index === this.events.length && this.onComplete) {
          this.onComplete();
        }
      } else {
        // If the current event didn't fire, stop processing for this frame
        break;
      }
    }
  }

  reset(event?: K) {
    let index = 0;
    if (event) {
      for (const [i, e] of enumerate(this.events)) {
        if (e.ident === event) {
          index = i;
          break;
        }
      }
    }
    this.index = index;
    this.timer = 0;
  }
}
