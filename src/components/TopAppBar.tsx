import React, { useState } from 'react';
import { TabType, LanguageCode, UserRole } from '../types';
import { SocketStatus } from '../services/kioskSocket';
import { SUPPORTED_LANGUAGES } from '../utils/i18n';

interface TopAppBarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  syncStatus: 'synced' | 'measuring' | 'saving';
  language: LanguageCode;
  selectedRole: UserRole;
  onOpenLanguageModal: () => void;
  onOpenRoleModal: () => void;
  onOpenEmergency: () => void;
  patientName?: string;
  avatarUrl?: string;
  wsStatus?: SocketStatus;
  latencyMs?: number | null;
  activeClients?: number;
  isStreaming?: boolean;
  onToggleStream?: () => void;
  onReconnectWs?: () => void;
  onOpenWsInspector?: () => void;
  onOpenPatientRegistration?: () => void;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  currentTab,
  onSelectTab,
  syncStatus,
  language,
  selectedRole,
  onOpenLanguageModal,
  onOpenRoleModal,
  onOpenEmergency,
  patientName = 'Ramesh Kumar',
  avatarUrl,
  wsStatus = 'connected',
  latencyMs = 14,
  activeClients = 1,
  isStreaming = false,
  onToggleStream,
  onReconnectWs,
  onOpenWsInspector,
  onOpenPatientRegistration,
}) => {
  const [showWsDetails, setShowWsDetails] = useState(false);

  const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  const getRoleLabel = () => {
    switch (selectedRole) {
      case 'asha':
        return { label: 'ASHA / ANM', icon: 'diversity_1', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
      case 'doctor':
        return { label: 'DOCTOR / PHC', icon: 'stethoscope', color: 'bg-sky-500/20 text-sky-300 border-sky-500/40' };
      default:
        return { label: 'VILLAGER / PATIENT', icon: 'person', color: 'bg-teal-500/20 text-teal-300 border-teal-500/40' };
    }
  };

  const roleInfo = getRoleLabel();

  return (
    <>
      <header
        id="main-top-app-bar"
        className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white w-full px-4 md:px-6 h-[64px] fixed top-0 left-0 z-40 flex items-center justify-between shadow-md"
      >
        {/* Brand & Logo */}
        <div className="flex items-center gap-3">
          <div
            id="brand-logo-btn"
            onClick={() => onSelectTab('home')}
            className="flex items-center gap-2.5 cursor-pointer select-none"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-sky-500 flex items-center justify-center text-slate-950 font-black shadow-md shadow-teal-500/20">
              <span className="material-symbols-outlined text-[22px]">health_and_safety</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black tracking-tight text-white">
                  ArogyaConnect
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40 hidden sm:inline-block">
                  RURAL 4.0
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium hidden sm:block">
                Unified Healthcare Access
              </p>
            </div>
          </div>
        </div>

        {/* Desktop Nav Items */}
        <div className="hidden lg:flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => onSelectTab('home')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
              currentTab === 'home'
                ? 'bg-teal-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">home</span>
            <span>Home</span>
          </button>

          <button
            onClick={() => onSelectTab('health')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
              currentTab === 'health'
                ? 'bg-teal-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">monitor_heart</span>
            <span>Vitals Kiosk</span>
          </button>

          <button
            onClick={() => onSelectTab('triage')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
              currentTab === 'triage'
                ? 'bg-teal-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">mic</span>
            <span>Voice Triage</span>
          </button>

          <button
            onClick={() => onSelectTab('consult')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
              currentTab === 'consult'
                ? 'bg-teal-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">video_camera_front</span>
            <span>Consult</span>
          </button>

          <button
            onClick={() => onSelectTab('records')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
              currentTab === 'records'
                ? 'bg-teal-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">folder_shared</span>
            <span>ABHA Records</span>
          </button>
        </div>

        {/* Right Action Icons: Role Switcher, Language Picker, WS Indicator, SOS */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Real Patient Profile Badge & Edit */}
          {selectedRole === 'patient' && onOpenPatientRegistration && (
            <button
              id="patient-profile-header-btn"
              onClick={onOpenPatientRegistration}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-teal-300 rounded-xl border border-slate-700 text-xs font-mono transition-all"
              title="Click to Edit Real Patient Details"
            >
              <span className="material-symbols-outlined text-[15px] text-teal-400">person_edit</span>
              <span className="max-w-[110px] truncate font-bold">{patientName}</span>
            </button>
          )}

          {/* Role Badge & Switcher */}
          <button
            id="role-switch-header-btn"
            onClick={onOpenRoleModal}
            className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold uppercase flex items-center gap-1.5 border transition-all ${roleInfo.color}`}
            title="Switch User Role"
          >
            <span className="material-symbols-outlined text-[16px]">{roleInfo.icon}</span>
            <span className="hidden sm:inline">{roleInfo.label}</span>
          </button>

          {/* Language Selector Trigger */}
          <button
            id="language-switch-header-btn"
            onClick={onOpenLanguageModal}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all"
            title="Select Regional Language"
          >
            <span>{currentLangObj.flag}</span>
            <span className="hidden sm:inline font-mono">{currentLangObj.native}</span>
          </button>

          {/* WebSocket Status Indicator */}
          <div className="relative">
            <button
              id="ws-status-indicator-btn"
              onClick={() => (onOpenWsInspector ? onOpenWsInspector() : setShowWsDetails(!showWsDetails))}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1 text-xs font-mono"
              title="WebSocket Telemetry Status"
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  wsStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              ></span>
              <span className="hidden md:inline text-[10px] text-slate-400">
                {latencyMs !== null ? `${latencyMs}ms` : 'WS'}
              </span>
            </button>
          </div>

          {/* Emergency 108 SOS Quick Button */}
          <button
            id="header-emergency-sos-btn"
            onClick={onOpenEmergency}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center gap-1 shadow-lg shadow-rose-900/40 animate-pulse"
          >
            <span className="material-symbols-outlined text-[16px]">e911_emergency</span>
            <span>108 SOS</span>
          </button>
        </div>
      </header>
    </>
  );
};
