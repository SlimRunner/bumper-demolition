export interface EventEmitter<TEvents> {
  addEventListener<K extends keyof TEvents>(
    event: K,
    callback: (args: TEvents[K]) => void,
  ): void;
}
