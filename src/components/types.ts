export type CarName = "carA" | "carB";
export type PowerUpKind = "heavy" | "orbit";
export type PowerUpState = PowerUpKind | "none";

export interface MatchGui {
  updateHealth(car: CarName, value: number): void;
  setPowerUp(car: CarName, value: PowerUpState): void;
  updateScore(car: CarName, value: number): void;
  get currentTime(): number;
}
