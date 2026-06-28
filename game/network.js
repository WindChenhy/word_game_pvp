import { PVP_MODE } from './config.js';

export async function createTransport() {
  if (PVP_MODE === 'supabase') {
    const { SupabaseTransport } = await import('./supabase-transport.js');
    return new SupabaseTransport();
  }
  return new NetworkClient();
}

export class NetworkClient {
  constructor() {
    this.ws = null;
    this.playerId = null;
    this.connected = false;
    this._handlers = new Map();
  }

  connect(url) {
    return new Promise((resolve, reject) => {
      let resolved = false;
      let ws;
      try {
        ws = new WebSocket(url);
        this.ws = ws;
      } catch (e) {
        reject(new Error('WebSocket creation failed: ' + e.message));
        return;
      }

      const onResolve = (val) => { if (!resolved) { resolved = true; resolve(val); } };
      const onReject = (err) => { if (!resolved) { resolved = true; reject(err); } };

      ws.onopen = () => {
        this.connected = true;
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          this._dispatch(msg);
          if (msg.type === 'connected') {
            this.playerId = msg.player_id;
            onResolve(msg);
          }
        } catch {}
      };

      ws.onclose = (e) => {
        this.connected = false;
        if (resolved) {
          this._dispatch({ type: 'disconnected', code: e.code });
        } else {
          onReject(new Error(this._closeCodeMessage(e.code)));
        }
      };

      ws.onerror = () => {
        onReject(new Error('Connection failed (server unreachable or CORS blocked)'));
      };

      setTimeout(() => {
        onReject(new Error('Connection timeout (8s)'));
      }, 8000);
    });
  }

  _closeCodeMessage(code) {
    if (code === undefined || code === null) {
      return 'Connection failed (server not running, network error, or blocked by browser)';
    }
    switch (code) {
      case 1000: return 'Connection closed normally';
      case 1001: return 'Endpoint going away';
      case 1002: return 'Protocol error';
      case 1003: return 'Unsupported data';
      case 1006: return 'Connection failed (server not running or network error)';
      case 1007: return 'Invalid frame payload data';
      case 1008: return 'Policy violation';
      case 1009: return 'Message too big';
      case 1010: return 'Missing extension';
      case 1011: return 'Server error';
      case 1015: return 'TLS handshake failed';
      default: return `Connection closed (code=${code})`;
    }
  }

  send(msg) {
    if (this.ws && this.readyState() === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  readyState() {
    return this.ws ? this.ws.readyState : WebSocket.CLOSED;
  }

  on(type, handler) {
    if (!this._handlers.has(type)) this._handlers.set(type, new Set());
    this._handlers.get(type).add(handler);
    return () => this._handlers.get(type)?.delete(handler);
  }

  disconnect() {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.playerId = null;
    this._handlers.clear();
  }

  _dispatch(msg) {
    const set = this._handlers.get(msg.type);
    if (set) for (const fn of set) fn(msg);
    const all = this._handlers.get('*');
    if (all) for (const fn of all) fn(msg);
  }
}
