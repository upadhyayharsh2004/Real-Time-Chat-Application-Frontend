// import * as signalR from '@microsoft/signalr';
// import { HUB_URLS } from './api';

// const getToken = () => localStorage.getItem('token');

// function buildConnection(url) {
//   return new signalR.HubConnectionBuilder()
//     .withUrl(url, {
//       accessTokenFactory: () => getToken(),
//     })
//     .withAutomaticReconnect([0, 1000, 2000, 5000, 10000])
//     .configureLogging(signalR.LogLevel.Warning)
//     .build();
// }

// class HubManager {
//   constructor() {
//     this.connections = {};
//     // Store reconnect listeners per hub name
//     this._reconnectListeners = {};
//   }

//   get(name) {
//     return this.connections[name] || null;
//   }

//   // Call this from ChatContext to re-register handlers after reconnect
//   onReconnected(name, callback) {
//     this._reconnectListeners[name] = callback;
//   }

//   async connect(name, url) {
//     // FIX: Don't reuse a connection that is in Reconnecting/Disconnected state
//     const existing = this.connections[name];
//     if (
//       existing?.state === signalR.HubConnectionState.Connected ||
//       existing?.state === signalR.HubConnectionState.Connecting
//     ) {
//       return existing;
//     }

//     const conn = buildConnection(url);
//     this.connections[name] = conn;

//     // FIX: When SignalR auto-reconnects, fire our listener so ChatContext
//     // can re-register all .on() handlers on the same connection object
//     conn.onreconnected(() => {
//       console.log(`[HubManager] '${name}' reconnected — re-registering handlers`);
//       const listener = this._reconnectListeners[name];
//       if (listener) listener(conn);
//     });

//     conn.onclose((err) => {
//       console.warn(`[HubManager] '${name}' connection closed`, err);
//     });

//     await conn.start();
//     console.log(`[HubManager] '${name}' connected`);
//     return conn;
//   }

//   async disconnect(name) {
//     const conn = this.connections[name];
//     if (conn) {
//       await conn.stop();
//       delete this.connections[name];
//       delete this._reconnectListeners[name];
//     }
//   }

//   async disconnectAll() {
//     for (const name of Object.keys(this.connections)) {
//       await this.disconnect(name);
//     }
//   }

//   async connectAll() {
//     await Promise.allSettled([
//       this.connect('chat', HUB_URLS.CHAT),
//       this.connect('rooms', HUB_URLS.ROOMS),
//       this.connect('presence', HUB_URLS.PRESENCE),
//       this.connect('notifications', HUB_URLS.NOTIFICATIONS),
//     ]);
//   }
// }

// export const hubManager = new HubManager();
// export const HubState = signalR.HubConnectionState;

import * as signalR from '@microsoft/signalr';
import { HUB_URLS } from './api';

const getToken = () => localStorage.getItem('token');

function buildConnection(url) {
  return new signalR.HubConnectionBuilder()
    .withUrl(url, {
      accessTokenFactory: () => getToken(),
    })
    .withAutomaticReconnect([0, 1000, 2000, 5000, 10000])
    .configureLogging(signalR.LogLevel.Warning)
    .build();
}

class HubManager {
  constructor() {
    this.connections = {};
    this._reconnectListeners = {};
  }

  get(name) {
    return this.connections[name] || null;
  }

  onReconnected(name, callback) {
    this._reconnectListeners[name] = callback;
  }

  async connect(name, url) {
    const existing = this.connections[name];
    if (
      existing?.state === signalR.HubConnectionState.Connected ||
      existing?.state === signalR.HubConnectionState.Connecting
    ) {
      return existing;
    }

    const conn = buildConnection(url);
    this.connections[name] = conn;

    conn.onreconnected(() => {
      console.log(`[HubManager] '${name}' reconnected — re-registering handlers`);
      const listener = this._reconnectListeners[name];
      if (listener) listener(conn);
    });

    conn.onclose((err) => {
      console.warn(`[HubManager] '${name}' connection closed`, err);
    });

    // ─── NEW: Force logout if server pushes it (e.g. after password change) ───
    conn.on('ForceLogout', () => {
      console.warn(`[HubManager] ForceLogout received on '${name}' — clearing session`);
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    });
    // ──────────────────────────────────────────────────────────────────────────

    await conn.start();
    console.log(`[HubManager] '${name}' connected`);
    return conn;
  }

  async disconnect(name) {
    const conn = this.connections[name];
    if (conn) {
      await conn.stop();
      delete this.connections[name];
      delete this._reconnectListeners[name];
    }
  }

  async disconnectAll() {
    for (const name of Object.keys(this.connections)) {
      await this.disconnect(name);
    }
  }

  async connectAll() {
    await Promise.allSettled([
      this.connect('chat', HUB_URLS.CHAT),
      this.connect('rooms', HUB_URLS.ROOMS),
      this.connect('presence', HUB_URLS.PRESENCE),
      this.connect('notifications', HUB_URLS.NOTIFICATIONS),
    ]);
  }
}

export const hubManager = new HubManager();
export const HubState = signalR.HubConnectionState;