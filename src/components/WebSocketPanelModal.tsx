import React, { useState } from 'react';
import { SocketStatus, TransportMode, WSFrameLog, LiveStreamTick } from '../services/kioskSocket';

interface WebSocketPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: SocketStatus;
  latencyMs: number | null;
  activeClients: number;
  isStreaming: boolean;
  transportMode: TransportMode;
  frameLogs: WSFrameLog[];
  lastTick: LiveStreamTick | null;
  serverUrl?: string;
  kioskNodeId?: string;
  onToggleStream: () => void;
  onTriggerScan: () => void;
  onTriggerEmergency: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
  onClearLogs: () => void;
  onShowToast: (msg: string) => void;
}

export const WebSocketPanelModal: React.FC<WebSocketPanelModalProps> = ({
  isOpen,
  onClose,
  status,
  latencyMs,
  activeClients,
  isStreaming,
  transportMode,
  frameLogs,
  lastTick,
  serverUrl = '/ws (Port 3000)',
  kioskNodeId = 'NODE-04-PUNE',
  onToggleStream,
  onTriggerScan,
  onTriggerEmergency,
  onReconnect,
  onDisconnect,
  onClearLogs,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'traffic' | 'diagnostics' | 'actions'>('traffic');
  const [selectedFrame, setSelectedFrame] = useState<WSFrameLog | null>(null);

  if (!isOpen) return null;

  return (
    <div
      id="websocket-panel-overlay"
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
      onClick={onClose}
    >
      <div
        id="websocket-panel-container"
        className="bg-[#0F172A] border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col text-slate-100 overflow-hidden font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-[#38BDF8]">
              <span className="material-symbols-outlined text-[22px]">swap_horiz</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white uppercase font-mono tracking-tight">
                  WebSocket Real-Time Gateway
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                    status === 'connected'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                      : status === 'connecting'
                      ? 'bg-amber-950 text-amber-300 border border-amber-500/40 animate-pulse'
                      : 'bg-rose-950 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {status}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Authoritative Biometric Telemetry & Peer Synchronization
              </p>
            </div>
          </div>

          <button
            id="ws-modal-close-btn"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Real-time Status Metric Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-4 bg-slate-950/40 border-b border-slate-800 font-mono text-xs">
          <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">Protocol / Transport</div>
            <div className="font-bold text-[#38BDF8] mt-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#38BDF8] animate-ping"></span>
              <span className="uppercase">{transportMode === 'websocket' ? 'WebSocket (WSS/WS)' : 'SSE Stream'}</span>
            </div>
          </div>

          <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">Round-Trip Latency</div>
            <div className="font-bold text-emerald-400 mt-0.5">
              {latencyMs !== null ? `${latencyMs} ms` : 'Evaluating...'}
            </div>
          </div>

          <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">Active Nodes / Peers</div>
            <div className="font-bold text-indigo-300 mt-0.5 flex items-center gap-1">
              <span>{activeClients}</span>
              <span className="text-[10px] text-slate-500 font-normal">Synchronized</span>
            </div>
          </div>

          <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">Live Sensor Stream</div>
            <div className={`font-bold mt-0.5 ${isStreaming ? 'text-emerald-400' : 'text-slate-500'}`}>
              {isStreaming ? 'STREAMING ACTIVE' : 'STANDBY'}
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center px-6 border-b border-slate-800 bg-slate-900/40 gap-2 pt-2">
          <button
            id="ws-tab-traffic"
            onClick={() => setActiveTab('traffic')}
            className={`px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === 'traffic'
                ? 'border-[#38BDF8] text-[#38BDF8]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Live Frame Traffic ({frameLogs.length})
          </button>

          <button
            id="ws-tab-actions"
            onClick={() => setActiveTab('actions')}
            className={`px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === 'actions'
                ? 'border-[#38BDF8] text-[#38BDF8]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Stream Controls & Triggers
          </button>

          <button
            id="ws-tab-diagnostics"
            onClick={() => setActiveTab('diagnostics')}
            className={`px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === 'diagnostics'
                ? 'border-[#38BDF8] text-[#38BDF8]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Kiosk Diagnostics
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto max-h-[50vh] flex-1 space-y-4">
          {/* TAB 1: Live Frame Traffic */}
          {activeTab === 'traffic' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400">
                  Real-time incoming (RX) and outgoing (TX) packet stream:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onClearLogs}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-bold uppercase"
                  >
                    Clear Logs
                  </button>
                </div>
              </div>

              {frameLogs.length === 0 ? (
                <div className="text-center py-10 bg-slate-900/40 rounded-lg border border-slate-800 text-slate-500 font-mono text-xs">
                  Awaiting WebSocket frames... Connect or trigger a test action.
                </div>
              ) : (
                <div className="space-y-1.5 font-mono text-xs">
                  {frameLogs.map((frame) => (
                    <div
                      key={frame.id}
                      onClick={() => setSelectedFrame(frame === selectedFrame ? null : frame)}
                      className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                        frame.direction === 'TX'
                          ? 'bg-slate-900/90 border-sky-950 hover:border-[#38BDF8]/40'
                          : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              frame.direction === 'TX'
                                ? 'bg-sky-900/60 text-[#38BDF8]'
                                : 'bg-emerald-950 text-emerald-300'
                            }`}
                          >
                            {frame.direction}
                          </span>
                          <span className="font-bold text-slate-200">{frame.type}</span>
                        </div>
                        <span className="text-[10px] text-slate-500">{frame.timestamp}</span>
                      </div>

                      {/* Payload preview or expanded details */}
                      {selectedFrame?.id === frame.id ? (
                        <pre className="mt-2 p-2 bg-black/60 rounded text-[11px] text-emerald-400 overflow-x-auto border border-slate-800">
                          {JSON.stringify(frame.payload, null, 2)}
                        </pre>
                      ) : (
                        <div className="mt-1 text-[10px] text-slate-400 truncate">
                          {JSON.stringify(frame.payload)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Stream Controls & Action Triggers */}
          {activeTab === 'actions' && (
            <div className="space-y-4">
              {/* Telemetry Stream Toggle */}
              <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-white">High-Frequency Telemetry Stream</div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">
                    Streams live PPG pulse, SpO2 oscillations & thermal indices (800ms intervals)
                  </div>
                </div>
                <button
                  id="ws-toggle-stream-btn"
                  onClick={() => {
                    onToggleStream();
                    onShowToast(isStreaming ? 'WS Stream Paused' : '✓ Live WS Stream Started');
                  }}
                  className={`px-4 py-2 rounded-lg font-mono text-xs font-bold uppercase tracking-wider transition-colors ${
                    isStreaming
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-[#38BDF8] hover:bg-sky-400 text-slate-950'
                  }`}
                >
                  {isStreaming ? 'Stop Stream' : 'Start Stream'}
                </button>
              </div>

              {/* Hardware Biometric Trigger */}
              <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-white">Broadcast Biometric Scan</div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">
                    Sends `vitals:measure` WS frame to calculate & broadcast new vitals across all nodes
                  </div>
                </div>
                <button
                  id="ws-trigger-scan-btn"
                  onClick={() => {
                    onTriggerScan();
                    onShowToast('✓ Hardware Scan Broadcast Dispatched over WebSocket');
                  }}
                  className="px-4 py-2 rounded-lg font-mono text-xs font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30"
                >
                  Trigger Scan
                </button>
              </div>

              {/* Emergency Alert Broadcast */}
              <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-white">Broadcast 108 Emergency Alert</div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">
                    Sends `emergency:trigger` WS frame to notify all medical dispatchers immediately
                  </div>
                </div>
                <button
                  id="ws-trigger-emergency-btn"
                  onClick={() => {
                    onTriggerEmergency();
                    onShowToast('⚠️ Emergency Telemetry Alert Broadcasted via WS');
                  }}
                  className="px-4 py-2 rounded-lg font-mono text-xs font-bold uppercase tracking-wider bg-rose-950 text-rose-300 hover:bg-rose-900 border border-rose-500/40"
                >
                  Broadcast Alert
                </button>
              </div>

              {/* Live Sensor Tick Preview if streaming */}
              {lastTick && (
                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs">
                  <div className="text-slate-400 text-[10px] uppercase font-bold mb-2">
                    Latest Ingested Micro-Tick
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 bg-slate-900 rounded border border-slate-800">
                      <div className="text-[10px] text-slate-500">Live Pulse</div>
                      <div className="text-emerald-400 font-bold text-base">{lastTick.heartRate} BPM</div>
                    </div>
                    <div className="p-2 bg-slate-900 rounded border border-slate-800">
                      <div className="text-[10px] text-slate-500">SpO2</div>
                      <div className="text-[#38BDF8] font-bold text-base">{lastTick.spO2}%</div>
                    </div>
                    <div className="p-2 bg-slate-900 rounded border border-slate-800">
                      <div className="text-[10px] text-slate-500">PPG Amplitude</div>
                      <div className="text-amber-400 font-bold text-base">{lastTick.ppgAmplitude.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Diagnostics */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-3 font-mono text-xs">
              <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-2 text-slate-300">
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">Node Identifier:</span>
                  <span className="text-white font-bold">{kioskNodeId}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">Gateway URL:</span>
                  <span className="text-white font-bold">{serverUrl}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">Connection State:</span>
                  <span className="text-emerald-400 font-bold uppercase">{status}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">Transport:</span>
                  <span className="text-[#38BDF8] font-bold uppercase">{transportMode}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">Heartbeat Cadence:</span>
                  <span className="text-white">3500 ms (Automated Ping/Pong)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Fault Tolerance:</span>
                  <span className="text-emerald-400">Dual WS / SSE Auto-Failover Enabled</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      JSON.stringify(
                        {
                          nodeId: kioskNodeId,
                          url: serverUrl,
                          status,
                          transportMode,
                          latencyMs,
                          activeClients,
                          isStreaming,
                          recentFrames: frameLogs.slice(0, 10),
                        },
                        null,
                        2
                      )
                    );
                    onShowToast('✓ Diagnostics copied to clipboard');
                  }}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-bold uppercase text-xs transition-colors"
                >
                  Copy Diagnostics JSON
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              id="ws-reconnect-action-btn"
              onClick={() => {
                onReconnect();
                onShowToast('Reconnecting WebSocket...');
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-bold uppercase flex items-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              <span>Force Reconnect</span>
            </button>

            {status === 'connected' ? (
              <button
                id="ws-disconnect-action-btn"
                onClick={() => {
                  onDisconnect();
                  onShowToast('WebSocket disconnected');
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/50 font-mono text-xs font-bold uppercase transition-colors"
              >
                Disconnect
              </button>
            ) : (
              <button
                id="ws-connect-action-btn"
                onClick={() => {
                  onReconnect();
                  onShowToast('Connecting WebSocket...');
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/50 font-mono text-xs font-bold uppercase transition-colors"
              >
                Connect Now
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold uppercase"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
