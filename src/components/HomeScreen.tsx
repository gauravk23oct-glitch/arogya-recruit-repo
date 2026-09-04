import React, { useState } from 'react';
import { VitalsData, PatientProfile, TabType, LanguageCode } from '../types';
import { getTranslation } from '../utils/i18n';
import { speakText, playAudioFeedback } from '../utils/speech';

interface HomeScreenProps {
  patient: PatientProfile;
  latestVitals: VitalsData;
  language: LanguageCode;
  onNavigate: (tab: TabType) => void;
  onStartCheckup: () => void;
  onOpenEmergency: () => void;
  onShowToast: (msg: string) => void;
  onOpenWsInspector?: () => void;
  onOpenLanguageModal?: () => void;
  onOpenPatientRegistration?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  patient,
  latestVitals,
  language,
  onNavigate,
  onStartCheckup,
  onOpenEmergency,
  onShowToast,
  onOpenWsInspector,
  onOpenLanguageModal,
  onOpenPatientRegistration,
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const handleVoiceWelcome = () => {
    if (isPlayingAudio) return;
    setIsPlayingAudio(true);
    playAudioFeedback('start_listening');
    const welcomeMsg =
      language === 'hi'
        ? `नमस्ते ${patient.name} जी। आरोग्य कनेक्ट में आपका स्वागत है। अपनी समस्या बोलने के लिए माइक बटन दबाएं, या वाइटल्स चेक करें।`
        : `Welcome to ArogyaConnect, ${patient.name}. Tap speak to check symptoms, or check your vitals.`;

    speakText(welcomeMsg, language, () => {
      setIsPlayingAudio(false);
    });
  };

  const primaryActions = [
    {
      id: 'action-voice-triage',
      title: getTranslation(language, 'speakProblem'),
      subtitle: getTranslation(language, 'speakProblemSub'),
      icon: 'mic',
      badge: 'AI VOICE',
      color: 'from-teal-600 to-emerald-600',
      textColor: 'text-teal-300',
      bgColor: 'bg-teal-500/10 border-teal-500/30 hover:border-teal-400',
      onClick: () => onNavigate('triage'),
    },
    {
      id: 'action-check-vitals',
      title: getTranslation(language, 'checkVitals'),
      subtitle: getTranslation(language, 'checkVitalsSub'),
      icon: 'monitor_heart',
      badge: 'KIOSK SENSORS',
      color: 'from-sky-600 to-blue-600',
      textColor: 'text-sky-300',
      bgColor: 'bg-sky-500/10 border-sky-500/30 hover:border-sky-400',
      onClick: onStartCheckup,
    },
    {
      id: 'action-talk-doctor',
      title: getTranslation(language, 'talkDoctor'),
      subtitle: getTranslation(language, 'talkDoctorSub'),
      icon: 'video_camera_front',
      badge: 'TELEMEDICINE',
      color: 'from-indigo-600 to-purple-600',
      textColor: 'text-indigo-300',
      bgColor: 'bg-indigo-500/10 border-indigo-500/30 hover:border-indigo-400',
      onClick: () => onNavigate('consult'),
    },
    {
      id: 'action-appointments',
      title: getTranslation(language, 'myAppointments'),
      subtitle: getTranslation(language, 'myAppointmentsSub'),
      icon: 'calendar_month',
      badge: 'TOKEN #TK-04',
      color: 'from-amber-600 to-orange-600',
      textColor: 'text-amber-300',
      bgColor: 'bg-amber-500/10 border-amber-500/30 hover:border-amber-400',
      onClick: () => onNavigate('consult'),
    },
    {
      id: 'action-health-records',
      title: getTranslation(language, 'myHealthRecords'),
      subtitle: getTranslation(language, 'myHealthRecordsSub'),
      icon: 'folder_shared',
      badge: 'ABHA LINKED',
      color: 'from-cyan-600 to-teal-600',
      textColor: 'text-cyan-300',
      bgColor: 'bg-cyan-500/10 border-cyan-500/30 hover:border-cyan-400',
      onClick: () => onNavigate('records'),
    },
    {
      id: 'action-emergency-help',
      title: getTranslation(language, 'emergencyHelp'),
      subtitle: getTranslation(language, 'emergencyHelpSub'),
      icon: 'e911_emergency',
      badge: '108 SOS DISPATCH',
      color: 'from-rose-600 to-red-600',
      textColor: 'text-rose-300',
      bgColor: 'bg-rose-500/20 border-rose-500/50 hover:border-rose-400',
      onClick: onOpenEmergency,
    },
  ];

  return (
    <div id="patient-home-dashboard" className="space-y-6 animate-fadeIn pb-24 md:pb-12 max-w-6xl mx-auto">
      {/* Top Welcome Card with Audio Readout */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-teal-950/60 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-teal-500/20 border border-teal-500/30 overflow-hidden flex-shrink-0 flex items-center justify-center text-teal-300 shadow-md">
              <img
                src={patient.avatarUrl}
                alt={patient.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <span className="material-symbols-outlined text-[32px]">person</span>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40">
                  ABHA: {patient.abhaId}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {patient.age}y • {patient.gender} • {patient.location}
                </span>
                {onOpenPatientRegistration && (
                  <button
                    onClick={onOpenPatientRegistration}
                    className="text-[11px] font-mono font-bold text-teal-300 hover:text-teal-200 bg-teal-950/60 hover:bg-teal-900/80 px-2 py-0.5 rounded border border-teal-500/40 flex items-center gap-1 transition-all"
                  >
                    <span className="material-symbols-outlined text-[14px]">edit</span>
                    <span>Edit Real Patient</span>
                  </button>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white mt-1">
                {getTranslation(language, 'welcome')}, {patient.name}
              </h1>
            </div>
          </div>

          {/* Quick Voice Audio Welcome Button */}
          <div className="flex items-center gap-2">
            <button
              id="home-voice-readout-btn"
              onClick={handleVoiceWelcome}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/40 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow"
            >
              <span className="material-symbols-outlined text-[18px]">
                {isPlayingAudio ? 'volume_up' : 'volume_down'}
              </span>
              <span>{isPlayingAudio ? 'Speaking...' : 'Listen in Audio (सुनें)'}</span>
            </button>

            {onOpenLanguageModal && (
              <button
                id="home-change-lang-btn"
                onClick={onOpenLanguageModal}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700"
                title="Change Language"
              >
                <span className="material-symbols-outlined text-[18px]">translate</span>
              </button>
            )}
          </div>
        </div>

        {/* Current Biometric Summary Card */}
        <div className="mt-6 pt-5 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Blood Pressure</div>
            <div className="text-lg font-black text-teal-300 mt-0.5">
              {latestVitals.bloodPressure.systolic}/{latestVitals.bloodPressure.diastolic}
              <span className="text-[10px] text-slate-400 font-normal ml-1">mmHg</span>
            </div>
            <span className="text-[9px] font-bold text-teal-400 font-mono">
              ● {latestVitals.bloodPressure.status}
            </span>
          </div>

          <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Oxygen (SpO2)</div>
            <div className="text-lg font-black text-sky-300 mt-0.5">
              {latestVitals.spO2.value}
              <span className="text-[10px] text-slate-400 font-normal ml-1">%</span>
            </div>
            <span className="text-[9px] font-bold text-sky-400 font-mono">
              ● {latestVitals.spO2.status}
            </span>
          </div>

          <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Blood Glucose</div>
            <div className="text-lg font-black text-amber-300 mt-0.5">
              {latestVitals.bloodSugar.value}
              <span className="text-[10px] text-slate-400 font-normal ml-1">mg/dL</span>
            </div>
            <span className="text-[9px] font-bold text-amber-400 font-mono">
              ● {latestVitals.bloodSugar.status}
            </span>
          </div>

          <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Heart Rate</div>
            <div className="text-lg font-black text-emerald-300 mt-0.5">
              {latestVitals.heartRate?.value || 72}
              <span className="text-[10px] text-slate-400 font-normal ml-1">BPM</span>
            </div>
            <span className="text-[9px] font-bold text-emerald-400 font-mono">
              ● Normal Sinus
            </span>
          </div>
        </div>
      </div>

      {/* Six Primary Action Cards - Large Accessible Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 font-mono flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-400 text-[18px]">apps</span>
            <span>Primary Healthcare Actions (मुख्य सेवाएं)</span>
          </h2>
          <span className="text-xs text-slate-500 font-mono">Tap any card to begin</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {primaryActions.map((action) => (
            <button
              key={action.id}
              id={action.id}
              onClick={action.onClick}
              className={`p-6 rounded-2xl border text-left transition-all group flex flex-col justify-between min-h-[160px] shadow-lg cursor-pointer transform hover:-translate-y-1 ${action.bgColor}`}
            >
              <div className="flex items-start justify-between">
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${action.color} text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform`}
                >
                  <span className="material-symbols-outlined text-[32px]">{action.icon}</span>
                </div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-black/40 text-slate-300 border border-white/10">
                  {action.badge}
                </span>
              </div>

              <div className="mt-4">
                <h3 className="text-lg font-black text-white group-hover:text-teal-300 transition-colors">
                  {action.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  {action.subtitle}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Real-time Telemetry & Diagnostic Status Pill */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-slate-300">
            Node-04 Online • Health Kiosk Live Gateway • ABDM Connected
          </span>
        </div>

        {onOpenWsInspector && (
          <button
            onClick={onOpenWsInspector}
            className="text-teal-400 hover:text-teal-300 underline font-bold flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">sensors</span>
            <span>Inspect Live WebSocket Telemetry</span>
          </button>
        )}
      </div>
    </div>
  );
};
