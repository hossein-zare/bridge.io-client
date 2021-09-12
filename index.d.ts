export as namespace BridgeIO;
export = BridgeIO;

declare class BridgeIO {
  constructor(config?: Partial<BridgeIO.Config>);

  on(event: BridgeIO.EventName, callback: BridgeIO.EventCallback): void;
  on(event: "connection", callback: BridgeIO.ConnectionEventCallback): void;
  on(event: string, callback: BridgeIO.MessageEventCallback): void;
  cast(event: string, data?: any, response?: BridgeIO.ResponseCallback, errorCalback?: BridgeIO.ErrorCallback, config?: Partial<BridgeIO.CastConfig>): number;
  revoke(id: number): void;
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

  type EventName = "connection" | "disconnected" | "reconnecting" | "reconnection" | "error";
  type EventCallback = (e: Event) => void;
  type ConnectionEventCallback = (e: Event, reconnected: boolean) => void;
  type MessageEventCallback = (data: any) => void;

  type ResponseCallback = (result: any) => void;
  type ErrorCallback = (error: any | null) => void;
  
  interface CastConfig {
    timeout: number;
  }
}