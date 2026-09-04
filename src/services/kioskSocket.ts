import { useEffect, useState, useRef, useCallback } from 'react';
import { VitalsData, PatientProfile } from '../types';

export type SocketStatus = 'connected' | 'connecting' | 'disconnected' | 'error';
export type TransportMode = 'websocket' | 'sse' | 'http-poll';

export interface LiveStreamTick {
  type: 'vitals:live_tick';
  timestamp: string;
  heartRate: number;
  spO2: number;
  ppgAmplitude: number;
  thermalIndex: number;
}

export interface WSFrameLog {
  id: string;
  timestamp: string;
  direction: 'TX' | 'RX';
  type: string;
  payload: any;
  transport: TransportMode;
}

export interface KioskSocketState {
  status: SocketStatus;
  latencyMs: number | null;
  activeClients: number;
  isStreaming: boolean;
  lastTick: LiveStreamTick | null;
  lastMessageTime: string | null;
  kioskNodeId: string;
  transportMode: TransportMode;
  frameLogs: WSFrameLog[];
  connectedAt: string | null;
  serverUrl: string;
}

type MessageHandler = (data: any) => void;

class KioskWebSocketClient {
  private ws: WebSocket | null = null;
  private sse: EventSource | null = null;
  private url: string = '';
  private listeners: Map<string, Set<MessageHandler>> = new Map();
  private reconnectTimeout: number | null = null;
  private pingInterval: number | null = null;
  private isExplicitClose: boolean = false;
  private pingStartTime: number = 0;

  public status: SocketStatus = 'connecting';
  public latency: number | null = 12;
  public activeClients: number = 1;
  public kioskNodeId: string = 'NODE-04-PUNE';
  public isStreaming: boolean = false;
  public transportMode: TransportMode = 'websocket';
  public connectedAt: string | null = null;
  public frameLogs: WSFrameLog[] = [];
  public serverUrl: string = '';

  private statusListeners: Set<(status: SocketStatus) => void> = new Set();
  private latencyListeners: Set<(latency: number | null) => void> = new Set();
  private clientsCountListeners: Set<(count: number) => void> = new Set();
  private transportListeners: Set<(transport: TransportMode) => void> = new Set();
  private frameLogListeners: Set<(logs: WSFrameLog[]) => void> = new Set();

  constructor() {
    this.initUrl();
  }

  private initUrl() {
    if (typeof window !== 'undefined') {
      const isHttps = window.location.protocol === 'https:';
      const host = window.location.host || 'localhost:3000';
      this.url = `${isHttps ? 'wss:' : 'ws:'}//${host}/ws`;
      this.serverUrl = this.url;
    } else {
      this.url = 'ws://localhost:3000/ws';
      this.serverUrl = this.url;
    }
  }

  private logFrame(direction: 'TX' | 'RX', type: string, payload: any) {
    const log: WSFrameLog = {
      id: `frame-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      direction,
      type,
      payload,
      transport: this.transportMode,
    };

    this.frameLogs = [log, ...this.frameLogs.slice(0, 59)]; // keep latest 60 frames
    this.frameLogListeners.forEach((fn) => fn(this.frameLogs));
  }

  private safeCloseWebSocket(socket: WebSocket | null) {
    if (!socket) return;

    // Detach all listeners to prevent unwanted close/error triggers on an unmounting socket
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;

    if (socket.readyState === WebSocket.OPEN) {
      try {
        socket.close(1000, 'Normal Closure');
      } catch {
        // Ignored
      }
    } else if (socket.readyState === WebSocket.CONNECTING) {
      // If still in handshake, wait for handshake to settle or close once opened to prevent browser abort warnings
      socket.onopen = () => {
        try {
          socket.close(1000, 'Clean close after connection established');
        } catch {
          // Ignored
        }
      };
      // Timeout fallback if server never completes handshake
      setTimeout(() => {
        if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
          try {
            socket.close();
          } catch {
            // Ignored
          }
        }
      }, 500);
    }
  }

  public connect() {
    if (typeof window === 'undefined') return;
    this.initUrl();
    this.isExplicitClose = false;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus('connecting');

    try {
      const socket = new WebSocket(this.url);
      this.ws = socket;

      const wsConnectionTimeout = window.setTimeout(() => {
        if (this.ws === socket && socket.readyState !== WebSocket.OPEN) {
          console.log('[Realtime] WebSocket upgrade timeout or pending in sandbox, activating SSE fallback');
          this.initSseFallback();
        }
      }, 2500);

      socket.onopen = () => {
        clearTimeout(wsConnectionTimeout);
        if (this.ws !== socket) return;

        this.transportMode = 'websocket';
        this.connectedAt = new Date().toISOString();
        this.setStatus('connected');
        this.setTransport('websocket');
        this.closeSse();
        this.startHeartbeat();
        this.send({ type: 'ping', clientTime: Date.now() });
      };

      socket.onmessage = (event) => {
        if (this.ws !== socket) return;
        try {
          const payload = JSON.parse(event.data);
          this.logFrame('RX', payload.type || 'unknown', payload);
          this.handleIncoming(payload);
        } catch (err) {
          console.error('[WebSocket] Parse error:', err);
        }
      };

      socket.onclose = (event) => {
        clearTimeout(wsConnectionTimeout);
        if (this.ws !== socket) return;

        if (!this.isExplicitClose) {
          // If closed abnormally before or during connection, switch seamlessly to SSE
          this.initSseFallback();
        } else {
          this.stopHeartbeat();
          this.setStatus('disconnected');
        }
      };

      socket.onerror = () => {
        clearTimeout(wsConnectionTimeout);
        if (this.ws !== socket) return;

        if (!this.isExplicitClose) {
          this.initSseFallback();
        }
      };
    } catch (e) {
      console.warn('[Realtime] WebSocket init failed, starting SSE fallback:', e);
      this.initSseFallback();
    }
  }

  private initSseFallback() {
    if (this.sse && this.sse.readyState === EventSource.OPEN) {
      return;
    }
    this.closeSse();

    try {
      this.transportMode = 'sse';
      this.setTransport('sse');
      this.sse = new EventSource('/api/events');

      this.sse.onopen = () => {
        this.setStatus('connected');
        this.connectedAt = new Date().toISOString();
        this.startHeartbeat();
      };

      this.sse.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.logFrame('RX', payload.type || 'sse_event', payload);
          this.handleIncoming(payload);
        } catch (err) {
          console.error('[SSE] Parse error:', err);
        }
      };

      this.sse.onerror = () => {
        if (!this.isExplicitClose) {
          this.scheduleReconnect();
        }
      };
    } catch (err) {
      console.error('[SSE] Setup error:', err);
      this.scheduleReconnect();
    }
  }

  private closeSse() {
    if (this.sse) {
      this.sse.close();
      this.sse = null;
    }
  }

  public disconnect() {
    this.isExplicitClose = true;
    this.stopHeartbeat();
    this.closeSse();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    const ws = this.ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    this.ws = null;
    this.setStatus('disconnected');
  }

  public send(payload: Record<string, unknown>) {
    this.logFrame('TX', (payload.type as string) || 'message', payload);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
      return true;
    }
    
    // HTTP RPC Fallback for commands
    if (payload.type === 'vitals:measure') {
      fetch('/api/telemetry/measure', { method: 'POST' }).catch((e) => console.error(e));
      return true;
    }
    if (payload.type === 'emergency:trigger') {
      fetch('/api/telemetry/emergency', { method: 'POST' }).catch((e) => console.error(e));
      return true;
    }
    return false;
  }

  public subscribeStream(enable: boolean) {
    this.isStreaming = enable;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: enable ? 'vitals:subscribe_stream' : 'vitals:unsubscribe_stream',
      });
    }
  }

  public triggerHardwareScan() {
    return this.send({ type: 'vitals:measure' });
  }

  public triggerEmergencyAlert() {
    return this.send({ type: 'emergency:trigger' });
  }

  public clearFrameLogs() {
    this.frameLogs = [];
    this.frameLogListeners.forEach((fn) => fn(this.frameLogs));
  }

  public on(event: string, handler: MessageHandler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  public onStatusChange(listener: (status: SocketStatus) => void) {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public onLatencyChange(listener: (latency: number | null) => void) {
    this.latencyListeners.add(listener);
    listener(this.latency);
    return () => {
      this.latencyListeners.delete(listener);
    };
  }

  public onClientsCountChange(listener: (count: number) => void) {
    this.clientsCountListeners.add(listener);
    listener(this.activeClients);
    return () => {
      this.clientsCountListeners.delete(listener);
    };
  }

  public onTransportChange(listener: (transport: TransportMode) => void) {
    this.transportListeners.add(listener);
    listener(this.transportMode);
    return () => {
      this.transportListeners.delete(listener);
    };
  }

  public onFrameLogsChange(listener: (logs: WSFrameLog[]) => void) {
    this.frameLogListeners.add(listener);
    listener(this.frameLogs);
    return () => {
      this.frameLogListeners.delete(listener);
    };
  }

  private handleIncoming(data: any) {
    if (!data || !data.type) return;

    if (data.type === 'pong') {
      if (data.clientTime) {
        this.latency = Math.max(1, Math.round(Date.now() - data.clientTime));
        this.latencyListeners.forEach((fn) => fn(this.latency));
      }
    } else if (data.type === 'network:clients_count') {
      this.activeClients = data.activeClients || 1;
      this.clientsCountListeners.forEach((fn) => fn(this.activeClients));
    } else if (data.type === 'init') {
      if (data.kioskId) this.kioskNodeId = data.kioskId;
      if (data.activeClients) {
        this.activeClients = data.activeClients;
        this.clientsCountListeners.forEach((fn) => fn(this.activeClients));
      }
    }

    const set = this.listeners.get(data.type);
    if (set) {
      set.forEach((fn) => fn(data));
    }

    // Also dispatch to wildcard '*'
    const all = this.listeners.get('*');
    if (all) {
      all.forEach((fn) => fn(data));
    }
  }

  private setStatus(s: SocketStatus) {
    this.status = s;
    this.statusListeners.forEach((fn) => fn(s));
  }

  private setTransport(t: TransportMode) {
    this.transportMode = t;
    this.transportListeners.forEach((fn) => fn(t));
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;
    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      if (!this.isExplicitClose) {
        this.connect();
      }
    }, 2500);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.pingStartTime = Date.now();
        this.send({ type: 'ping', clientTime: this.pingStartTime });
      } else {
        // HTTP Ping for latency measurement
        const start = Date.now();
        fetch('/api/telemetry/ping')
          .then((r) => r.json())
          .then((data) => {
            this.latency = Math.max(1, Math.round(Date.now() - start));
            this.latencyListeners.forEach((fn) => fn(this.latency));
            if (data.activeClients) {
              this.activeClients = data.activeClients;
              this.clientsCountListeners.forEach((fn) => fn(this.activeClients));
            }
          })
          .catch(() => {});
      }
    }, 3500);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

// Global Singleton Instance
export const kioskSocket = new KioskWebSocketClient();

// React Hook for easy integration
export function useKioskWebSocket(callbacks?: {
  onVitalsUpdated?: (vitals: VitalsData, record?: VitalsData) => void;
  onProfileUpdated?: (profile: PatientProfile) => void;
  onRecordsUpdated?: (records: VitalsData[]) => void;
  onEmergencyAlert?: (payload: any) => void;
  onLiveTick?: (tick: LiveStreamTick) => void;
  onInit?: (initData: any) => void;
}) {
  const [status, setStatus] = useState<SocketStatus>(kioskSocket.status);
  const [latencyMs, setLatencyMs] = useState<number | null>(kioskSocket.latency);
  const [activeClients, setActiveClients] = useState<number>(kioskSocket.activeClients);
  const [isStreaming, setIsStreaming] = useState<boolean>(kioskSocket.isStreaming);
  const [transportMode, setTransportMode] = useState<TransportMode>(kioskSocket.transportMode);
  const [frameLogs, setFrameLogs] = useState<WSFrameLog[]>(kioskSocket.frameLogs);
  const [lastTick, setLastTick] = useState<LiveStreamTick | null>(null);

  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    kioskSocket.connect();

    const unsubStatus = kioskSocket.onStatusChange((s) => setStatus(s));
    const unsubLatency = kioskSocket.onLatencyChange((l) => setLatencyMs(l));
    const unsubClients = kioskSocket.onClientsCountChange((c) => setActiveClients(c));
    const unsubTransport = kioskSocket.onTransportChange((t) => setTransportMode(t));
    const unsubFrames = kioskSocket.onFrameLogsChange((logs) => setFrameLogs(logs));

    const unsubInit = kioskSocket.on('init', (data) => {
      callbacksRef.current?.onInit?.(data);
      if (data.vitals && callbacksRef.current?.onVitalsUpdated) {
        callbacksRef.current.onVitalsUpdated(data.vitals);
      }
      if (data.profile && callbacksRef.current?.onProfileUpdated) {
        callbacksRef.current.onProfileUpdated(data.profile);
      }
      if (data.records && callbacksRef.current?.onRecordsUpdated) {
        callbacksRef.current.onRecordsUpdated(data.records);
      }
    });

    const unsubVitals = kioskSocket.on('vitals:updated', (data) => {
      if (data.data && callbacksRef.current?.onVitalsUpdated) {
        callbacksRef.current.onVitalsUpdated(data.data, data.record);
      }
    });

    const unsubProfile = kioskSocket.on('profile:updated', (data) => {
      if (data.data && callbacksRef.current?.onProfileUpdated) {
        callbacksRef.current.onProfileUpdated(data.data);
      }
    });

    const unsubRecords = kioskSocket.on('records:updated', (data) => {
      if (data.records && callbacksRef.current?.onRecordsUpdated) {
        callbacksRef.current.onRecordsUpdated(data.records);
      }
    });

    const unsubEmergency = kioskSocket.on('emergency:alert', (data) => {
      callbacksRef.current?.onEmergencyAlert?.(data);
    });

    const unsubTick = kioskSocket.on('vitals:live_tick', (tick: LiveStreamTick) => {
      setLastTick(tick);
      callbacksRef.current?.onLiveTick?.(tick);
    });

    return () => {
      unsubStatus();
      unsubLatency();
      unsubClients();
      unsubTransport();
      unsubFrames();
      unsubInit();
      unsubVitals();
      unsubProfile();
      unsubRecords();
      unsubEmergency();
      unsubTick();
    };
  }, []);

  const toggleStream = useCallback((enable?: boolean) => {
    const nextState = enable !== undefined ? enable : !isStreaming;
    kioskSocket.subscribeStream(nextState);
    setIsStreaming(nextState);
  }, [isStreaming]);

  const triggerScan = useCallback(() => {
    return kioskSocket.triggerHardwareScan();
  }, []);

  const triggerEmergency = useCallback(() => {
    return kioskSocket.triggerEmergencyAlert();
  }, []);

  const clearLogs = useCallback(() => {
    kioskSocket.clearFrameLogs();
  }, []);

  const reconnect = useCallback(() => {
    kioskSocket.disconnect();
    setTimeout(() => {
      kioskSocket.connect();
    }, 100);
  }, []);

  const disconnect = useCallback(() => {
    kioskSocket.disconnect();
  }, []);

  const sendCustom = useCallback((payload: Record<string, unknown>) => {
    return kioskSocket.send(payload);
  }, []);

  return {
    status,
    latencyMs,
    activeClients,
    isStreaming,
    transportMode,
    frameLogs,
    lastTick,
    serverUrl: kioskSocket.serverUrl,
    kioskNodeId: kioskSocket.kioskNodeId,
    toggleStream,
    triggerScan,
    triggerEmergency,
    clearLogs,
    reconnect,
    disconnect,
    sendCustom,
  };
}
