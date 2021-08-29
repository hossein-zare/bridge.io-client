export as namespace BridgeIO;
export = BridgeIO;

declare class BridgeIO {
  constructor(config?: Partial<BridgeIO.Config>);

  on(event: BridgeIO.EventName, callback: BridgeIO.EventCallback): void;
  on(event: "connection", callback: BridgeIO.ConnectedEventCallback): void;
}

declare namespace BridgeIO {
  interface Config {
    server: string;
    protocols: any[];
    response_timeout: number;
    attempts: number | null;
    delay: number;
    reconnection: boolean;
  }

  type EventName = "connection" | "disconnected" | "reconnecting" | "reconnection" | "error" | string;
  type EventCallback = (e: Event) => void;
  type ConnectedEventCallback = (e: Event, reconnected: boolean) => void;
}