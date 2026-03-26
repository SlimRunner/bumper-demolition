import type { CarName as CarName, MatchGui, PowerUpState } from "./types";

export class GameGUI implements MatchGui {
  private static styleInstalled = false;

  private readonly host: HTMLElement;
  private readonly root: HTMLDivElement;
  private readonly timerValue: HTMLSpanElement;
  private readonly messageBox: HTMLDivElement;
  private readonly gameOverOverlay: HTMLDivElement;
  private readonly gameOverQuote: HTMLDivElement;
  private gameOverTextTimer?: number;
  private readonly healthBarA: HTMLDivElement;
  private readonly healthBarB: HTMLDivElement;
  private readonly healthTextA: HTMLSpanElement;
  private readonly healthTextB: HTMLSpanElement;
  private readonly scoreTextA: HTMLSpanElement;
  private readonly scoreTextB: HTMLSpanElement;
  private readonly powerupA: HTMLImageElement;
  private readonly powerupB: HTMLImageElement;
  private readonly powerupLabelA: HTMLSpanElement;
  private readonly powerupLabelB: HTMLSpanElement;
  private readonly powerDrainDurationMs = 6000;
  private readonly powerDrainFrames = new Map<HTMLElement, number>();

  private elapsedSeconds = 0;

  constructor(parent: HTMLElement) {
    this.host = parent;

    if (!GameGUI.styleInstalled) {
      GameGUI.installStyles();
      GameGUI.styleInstalled = true;
    }

    if (getComputedStyle(this.host).position === "static") {
      this.host.style.position = "relative";
    }

    this.root = document.createElement("div");
    this.root.className = "gui";

    const topLeft = document.createElement("div");
    topLeft.className = "card card-left";

    const topCenter = document.createElement("div");
    topCenter.className = "card card-center";

    const topRight = document.createElement("div");
    topRight.className = "card card-right";

    const bottomCenter = document.createElement("div");
    bottomCenter.className = "message";

    const labelA = document.createElement("img");
    labelA.className = "car-icon car-icon-a";
    labelA.src = "/assets/images/carIcon_CarA.png";
    labelA.alt = "Car A";

    const labelB = document.createElement("img");
    labelB.className = "car-icon car-icon-b";
    labelB.src = "/assets/images/carIcon_CarB.png";
    labelB.alt = "Car B";

    this.healthTextA = document.createElement("span");
    this.healthTextA.className = "health-text";

    this.healthTextB = document.createElement("span");
    this.healthTextB.className = "health-text";

    this.scoreTextA = document.createElement("span");
    this.scoreTextA.className = "score-text";

    this.scoreTextB = document.createElement("span");
    this.scoreTextB.className = "score-text";

    this.healthBarA = document.createElement("div");
    this.healthBarA.className = "health-fill health-fill-a";

    this.healthBarB = document.createElement("div");
    this.healthBarB.className = "health-fill health-fill-b";

    const healthWrapA = this.buildHealthBar(this.healthBarA);
    const healthWrapB = this.buildHealthBar(this.healthBarB, true);

    this.powerupA = document.createElement("img");
    this.powerupA.className = "powerup-icon";
    this.powerupA.alt = "Powerup A";

    this.powerupB = document.createElement("img");
    this.powerupB.className = "powerup-icon";
    this.powerupB.alt = "Powerup B";

    this.powerupLabelA = document.createElement("span");
    this.powerupLabelA.className = "powerup-label";

    this.powerupLabelB = document.createElement("span");
    this.powerupLabelB.className = "powerup-label";

    const timerLabel = document.createElement("div");
    timerLabel.className = "title";
    timerLabel.textContent = "Match Timer";

    this.timerValue = document.createElement("span");
    this.timerValue.className = "timer";

    const powerupRowA = document.createElement("div");
    powerupRowA.className = "powerup-row";
    powerupRowA.append(this.powerupA, this.powerupLabelA);

    const powerupRowB = document.createElement("div");
    powerupRowB.className = "powerup-row";
    powerupRowB.append(this.powerupLabelB, this.powerupB);

    const scoreWrapperA = document.createElement("div");
    scoreWrapperA.className = "score-wrapper";
    scoreWrapperA.append(this.scoreTextA);

    const timerWrapper = document.createElement("div");
    timerWrapper.className = "timer-wrapper";
    timerWrapper.append(timerLabel, this.timerValue);

    const scoreWrapperB = document.createElement("div");
    scoreWrapperB.className = "score-wrapper score-wrapper-right";
    scoreWrapperB.append(this.scoreTextB);

    const cardBodyA = document.createElement("div");
    cardBodyA.className = "card-body";
    cardBodyA.append(healthWrapA, powerupRowA);

    const cardBodyB = document.createElement("div");
    cardBodyB.className = "card-body card-body-right";
    cardBodyB.append(healthWrapB, powerupRowB);

    topLeft.append(labelA, cardBodyA);
    topCenter.append(scoreWrapperA, timerWrapper, scoreWrapperB);
    topRight.append(cardBodyB, labelB);

    this.messageBox = document.createElement("div");
    this.messageBox.className = "message-inner hidden";

    this.gameOverOverlay = document.createElement("div");
    this.gameOverOverlay.className = "game-over-overlay hidden";
    const gameOverBody = document.createElement("div");
    gameOverBody.className = "game-over-body";
    const gameOverTitle = document.createElement("div");
    gameOverTitle.className = "game-over-title";
    gameOverTitle.textContent = "WASTED";
    this.gameOverQuote = document.createElement("div");
    this.gameOverQuote.className = "game-over-quote";
    gameOverBody.append(gameOverTitle, this.gameOverQuote);
    this.gameOverOverlay.append(gameOverBody);

    bottomCenter.appendChild(this.messageBox);
    this.root.append(
      topLeft,
      topCenter,
      topRight,
      bottomCenter,
      this.gameOverOverlay,
    );
    this.host.appendChild(this.root);

    this.resetState();
  }

  get currentTime() {
    return this.elapsedSeconds;
  }

  updateHealth(car: CarName, value: number): void {
    value = this.clampPercent(value);
    switch (car) {
      case "carA":
        this.healthBarA.style.width = `${value}%`;
        this.healthTextA.textContent = `HP: ${Math.round(value)}`;
        break;
      case "carB":
        this.healthBarB.style.width = `${value}%`;
        this.healthTextB.textContent = `HP: ${Math.round(value)}`;
        break;
    }
  }

  setPowerUp(car: CarName, value: PowerUpState): void {
    switch (car) {
      case "carA":
        this.applyPowerupState(this.powerupA, this.powerupLabelA, value);
        break;
      case "carB":
        this.applyPowerupState(this.powerupB, this.powerupLabelB, value);
        break;
    }
  }

  updateTimer(timeDelta: number): void {
    if (!Number.isFinite(timeDelta) || timeDelta <= 0) {
      return;
    }

    this.elapsedSeconds += timeDelta;
    this.timerValue.textContent = this.formatClock(this.elapsedSeconds);
  }

  showMessage(msg: string): void {
    this.messageBox.textContent = msg;
    this.messageBox.classList.remove("hidden");

    setTimeout(() => {
      this.hideMessage();
    }, 3000);
  }

  hideMessage(): void {
    this.messageBox.classList.add("hidden");
  }

  showGameOverOverlay(
    quote: string,
    options?: {
      textDelayMs?: number;
    },
  ): void {
    if (this.gameOverTextTimer !== undefined) {
      window.clearTimeout(this.gameOverTextTimer);
      this.gameOverTextTimer = undefined;
    }

    this.gameOverQuote.textContent = quote;
    this.gameOverOverlay.classList.remove("hidden");
    this.gameOverOverlay.classList.remove("text-visible");
    this.gameOverOverlay.getBoundingClientRect();
    this.gameOverOverlay.classList.add("visible");

    const textDelay = Math.max(0, options?.textDelayMs ?? 600);
    this.gameOverTextTimer = window.setTimeout(() => {
      this.gameOverOverlay.classList.add("text-visible");
      this.gameOverTextTimer = undefined;
    }, textDelay);
  }

  hideGameOverOverlay(): void {
    if (this.gameOverTextTimer !== undefined) {
      window.clearTimeout(this.gameOverTextTimer);
      this.gameOverTextTimer = undefined;
    }

    this.gameOverOverlay.classList.remove("text-visible");
    this.gameOverOverlay.classList.remove("visible");
    this.gameOverOverlay.classList.add("hidden");
  }

  resetState(): void {
    this.elapsedSeconds = 0;
    this.timerValue.textContent = this.formatClock(0);
    this.updateHealth("carA", 100);
    this.updateHealth("carB", 100);
    this.setPowerUp("carA", "none");
    this.setPowerUp("carB", "none");
    this.hideMessage();
    this.hideGameOverOverlay();
  }

  updateScore(car: CarName, value: number): void {
    switch (car) {
      case "carA":
        this.scoreTextA.textContent = `${value}`;
        break;
      case "carB":
        this.scoreTextB.textContent = `${value}`;
        break;
    }
  }

  private applyPowerupState(
    icon: HTMLImageElement,
    label: HTMLSpanElement,
    powerup: PowerUpState,
  ): void {
    icon.src = `/assets/images/${this.getPowerupIconName(powerup)}.png`;
    label.textContent =
      powerup !== "none" ? this.getPowerupDisplayName(powerup) : "";
  }

  private getPowerupDisplayName(powerup: PowerUpState): string {
    switch (powerup) {
      case "heavy":
        return "Heavy";
      case "orbit":
        return "Orbit";
      default:
        return "None";
    }
  }

  private buildHealthBar(fill: HTMLDivElement, mirror = false): HTMLDivElement {
    const track = document.createElement("div");
    track.className = mirror
      ? "health-track health-track-mirror"
      : "health-track";
    track.appendChild(fill);
    return track;
  }

  private getPowerupIconName(powerup: PowerUpState): string {
    switch (powerup) {
      case "heavy":
        return "powerUpIcon_Heavy";
      case "orbit":
        return "powerUpIcon_Orbit";
      default:
        return "powerUpIcon_None";
    }
  }

  private clampPercent(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.max(0, Math.min(100, value));
  }

  private formatClock(seconds: number): string {
    const total = Math.max(0, Math.floor(seconds));
    const mm = Math.floor(total / 60)
      .toString()
      .padStart(2, "0");
    const ss = (total % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
  }

  private static installStyles(): void {
    const style = document.createElement("style");
    style.id = "gui-styles";
    style.textContent = `
      @font-face {
        font-family: "DeadlockFont";
        src: url('../assets/fonts/ValveOccult-SemiBold.woff2') format('woff2');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
      }

      .gui {
        position: absolute;
        inset: 0;
        z-index: 20;
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: flex-start;
        align-content: space-between;
        gap: 12px;
        padding: 14px;

        pointer-events: none;
        font-family: "DeadlockFont", "Segoe UI", Tahoma, sans-serif;
        color: #ffffff;
      }

      .card {
        width: 246px;
        box-sizing: border-box;
        padding: 10px 12px;
        color: #f2f7ff;
        background: rgba(13, 20, 32, 0.65);
        border: 1px solid rgba(120, 148, 186, 0.45);
        border-radius: 10px;
        backdrop-filter: blur(4px);
      }

      .card-left,
      .card-right {
        flex: 0 0 246px;
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 10px;
      }

      .card-body {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
      }

      .card-body-right {
        align-items: flex-end;
      }

      .card-center {
        flex: 0 1 auto;
        min-width: 140px;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        padding: 10px 20px;
      }

      .timer-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      .score-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .title {
        margin-bottom: 8px;
        font-size: 0.8rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #d6e4ff;
      }

      .car-icon {
        display: block;
        height: 56px;
        width: auto;
        object-fit: contain;
        flex-shrink: 0;
      }

      .car-icon-a {
        margin-right: auto;
      }

      .car-icon-b {
        margin-left: auto;
      }

      .powerup-row {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 6px;
        margin-top: 4px;
      }

      .powerup-icon {
        display: block;
        height: 32px;
        width: auto;
        object-fit: contain;
        flex-shrink: 0;
      }

      .powerup-label {
        font-size: 0.78rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #d6e4ff;
        white-space: nowrap;
      }

      .score-text {
        font-size: 2rem;
        color: #f2f7ff;
        font-weight: bold;
        font-variant-numeric: tabular-nums;
      }

      .health-track {
        width: 100%;
        height: 10px;
        margin-bottom: 6px;
        background: rgba(255, 255, 255, 0.12);
        border-radius: 999px;
        overflow: hidden;
      }

      .health-track-mirror {
        display: flex;
        justify-content: flex-end;
      }

      .health-fill {
        height: 100%;
        width: 100%;
        transition: width 120ms linear;
      }

      .health-fill-a {
        background: linear-gradient(90deg, #fdbb2d, #fc466b);
      }

      .health-fill-b {
        background: linear-gradient(90deg, #4facfe, #00f2fe);
      }

      .health-text {
        display: block;
        font-size: 0.96rem;
        line-height: 1.35;
      }


      .timer {
        font-size: 1.2rem;
        font-variant-numeric: tabular-nums;
      }

      .message {
        flex: 0 0 100%;
        display: flex;
        justify-content: center;
        align-items: flex-end;
      }

      .message-inner {
        padding: 8px 12px;
        border-radius: 8px;
        color: #f2f7ff;
        background: rgba(8, 12, 20, 0.75);
        border: 1px solid rgba(133, 166, 216, 0.4);
        font-size: 0.95rem;

        /* Animation logic */
        transition: opacity 0.4s ease, visibility 0.4s;
        opacity: 1;
        visibility: visible;
      }

      .message-inner.hidden {
        opacity: 0;
        visibility: hidden; /* Prevents clicking the ghost of the toast */
      }

      .game-over-overlay {
        position: absolute;
        inset: 0;
        z-index: 40;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        visibility: hidden;
        background: rgba(0, 0, 0, 0);
        transition: opacity 260ms ease, visibility 260ms ease, background 1400ms ease;
      }

      .game-over-overlay.visible {
        opacity: 1;
        visibility: visible;
        background: rgba(0, 0, 0, 0.5);
      }

      .game-over-overlay.hidden {
        opacity: 0;
        visibility: hidden;
      }

      .game-over-body {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        text-align: center;
      }

      .game-over-title {
        font-size: clamp(2.8rem, 8vw, 6rem);
        letter-spacing: 0.08em;
        color: #c73636;
        text-shadow: 0 2px 16px rgba(0, 0, 0, 0.7);
        opacity: 0;
        transform: translateY(8px);
        transition: opacity 240ms ease, transform 240ms ease;
      }

      .game-over-quote {
        max-width: min(70vw, 760px);
        font-size: clamp(0.85rem, 1.9vw, 1.2rem);
        color: rgba(245, 245, 245, 0.9);
        letter-spacing: 0.02em;
        opacity: 0;
        transform: translateY(8px);
        transition: opacity 240ms ease, transform 240ms ease;
      }

      .game-over-overlay.text-visible .game-over-title,
      .game-over-overlay.text-visible .game-over-quote {
        opacity: 1;
        transform: translateY(0);
      }

      @media (max-width: 820px) {
        .gui {
          justify-content: stretch;
          align-content: flex-start;
          gap: 10px;
          padding: 10px;
        }

        .card {
          flex: 1 1 calc(50% - 5px);
          width: auto;
          min-width: 0;
        }

        .card-center {
          flex-basis: 100%;
        }
      }
    `;

    document.head.appendChild(style);
  }
}
