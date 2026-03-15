import { clamp } from "../utils/math";

export type MixChannelId =
  | "normalBgm"
  | "lowHealthBgm"
  | "engine"
  | "collision"
  | "saw"
  | "gameOver";

export type MixChannelConfig = {
  id: MixChannelId;
  label: string;
  defaultVolume: number;
};

type MixChannelState = {
  label: string;
  defaultVolume: number;
  volume: number;
};

export const defaultMixChannels: readonly MixChannelConfig[] = [
  { id: "normalBgm", label: "Normal BGM", defaultVolume: 1 },
  { id: "lowHealthBgm", label: "Low Health BGM", defaultVolume: 1 },
  { id: "engine", label: "Engine", defaultVolume: 1 },
  { id: "collision", label: "Collision", defaultVolume: 1 },
  { id: "saw", label: "Saw", defaultVolume: 1 },
  { id: "gameOver", label: "Game Over", defaultVolume: 1 },
];

export class AudioMixRegistry {
  private readonly channels: Record<MixChannelId, MixChannelState>;

  constructor(configs: readonly MixChannelConfig[]) {
    this.channels = {
      normalBgm: {
        label: "Normal BGM",
        defaultVolume: 1,
        volume: 1,
      },
      lowHealthBgm: {
        label: "Low Health BGM",
        defaultVolume: 1,
        volume: 1,
      },
      engine: {
        label: "Engine",
        defaultVolume: 1,
        volume: 1,
      },
      collision: {
        label: "Collision",
        defaultVolume: 1,
        volume: 1,
      },
      saw: {
        label: "Saw",
        defaultVolume: 1,
        volume: 1,
      },
      gameOver: {
        label: "Game Over",
        defaultVolume: 1,
        volume: 1,
      },
    };

    for (const config of configs) {
      this.channels[config.id] = {
        label: config.label,
        defaultVolume: clamp(config.defaultVolume, 0, 1),
        volume: 1,
      };
    }
  }

  getVolume(channel: MixChannelId) {
    const state = this.channels[channel];
    return clamp(state.defaultVolume * state.volume, 0, 1);
  }

  setVolume(channel: MixChannelId, volume: number) {
    this.channels[channel].volume = clamp(volume, 0, 1);
  }

  listChannels() {
    return (Object.keys(this.channels) as MixChannelId[]).map((id) => {
      const state = this.channels[id];
      return {
        id,
        label: state.label,
        volume: this.getVolume(id),
      };
    });
  }
}