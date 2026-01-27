/// <reference types="vite-plugin-electron/electron-env" />

declare module 'localtunnel' {
  interface TunnelConfig {
    port: number;
    subdomain?: string;
    host?: string;
    local_host?: string;
  }
  
  interface Tunnel {
    url: string;
    close(): Promise<void>;
  }
  
  function localtunnel(config: TunnelConfig): Promise<Tunnel>;
  export = localtunnel;
}