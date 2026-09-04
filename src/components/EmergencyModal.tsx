import React, { useState, useEffect } from 'react';
import { PatientProfile, VitalsData } from '../types';

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientProfile;
  vitals: VitalsData;
}

export const EmergencyModal: React.FC<EmergencyModalProps> = ({
  isOpen,
  onClose,
  patient,
  vitals,
}) => {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [sosSent, setSosSent] = useState(false);
  const [sirenPlaying, setSirenPlaying] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown !== null && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((prev) => (prev !== null ? prev - 1 : null));
      }, 1000);
    } else if (countdown === 0) {
      setSosSent(true);
      setCountdown(null);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  if (!isOpen) return null;

  const handleStartCountdown = () => {
    setCountdown(5);
    setSosSent(false);
  };

  const handleCancelCountdown = () => {
    setCountdown(null);
  };

  const toggleSiren = () => {
    if (!sirenPlaying) {
      try {
        const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1400, audioCtx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        setTimeout(() => {
          osc.stop();
          setSirenPlaying(false);
        }, 1200);
        setSirenPlaying(true);
      } catch {
        setSirenPlaying(false);
      }
    }
  };

  return (
    <div
      id="emergency-modal-overlay"
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-lg max-w-[540px] w-full p-6 flex flex-col gap-5 border border-red-300 shadow-2xl relative overflow-hidden">
        {/* Top Emergency Header */}
        <div className="flex justify-between items-start border-b border-red-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-red-600 text-white flex items-center justify-center animate-pulse flex-shrink-0">
              <span className="material-symbols-outlined text-[24px]">emergency</span>
            </div>
            <div>
              <h3 className="text-lg font-black text-red-700 font-mono uppercase tracking-tight">
                CRITICAL HEALTH DISPATCH
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                NATIONAL MEDICAL RESPONSE GATEWAY • KIOSK NODE-04
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-md hover:bg-slate-100 font-mono text-sm"
          >
            ✕
          </button>
        </div>

        {/* SOS Countdown or Status Box */}
        {countdown !== null ? (
          <div className="bg-red-50 border-2 border-red-500 rounded-lg p-5 flex flex-col items-center justify-center text-center gap-3 animate-pulse">
            <div className="text-5xl font-black text-red-600 font-mono">{countdown}</div>
            <div className="text-xs font-bold text-red-800 uppercase font-mono tracking-widest">
              DISPATCHING EMERGENCY TELEMETRY IN {countdown} SECONDS
            </div>
            <p className="text-[11px] text-red-600 font-mono max-w-sm">
              Live vitals (BP {vitals.bloodPressure.systolic}/{vitals.bloodPressure.diastolic}, SpO2 {vitals.spO2.value}%) and GPS coords will be broadcast to nearest 108 ambulance base.
            </p>
            <button
              onClick={handleCancelCountdown}
              className="px-6 py-2 bg-slate-900 text-white text-xs font-bold font-mono uppercase tracking-wider rounded-md hover:bg-slate-800 mt-1"
            >
              CANCEL TRANSMISSION
            </button>
          </div>
        ) : sosSent ? (
          <div className="bg-green-50 border border-green-300 rounded-lg p-4 flex flex-col gap-2 font-mono text-xs text-green-900">
            <div className="flex items-center gap-2 font-bold text-sm">
              <span className="material-symbols-outlined text-green-600">check_circle</span>
              EMERGENCY ALERT DISPATCHED SUCCESSFULLY
            </div>
            <p className="text-[11px] text-green-800">
              • Incident Ticket: #EMG-{Date.now().toString().slice(-6)}
              <br />
              • Contact Notified: {patient.emergencyContact}
              <br />
              • Nearest Dispatch: Primary Health Center (ETA ~ 8-12 mins)
            </p>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col gap-2.5 font-mono text-xs text-slate-800">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
              CURRENT PATIENT TELEMETRY SNAPSHOT:
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700">
              <div>• Patient: <span className="font-bold">{patient.name}</span> ({patient.age}y, {patient.gender})</div>
              <div>• Blood Group: <span className="font-bold text-red-600">{patient.bloodGroup}</span></div>
              <div>• BP: <span className="font-bold">{vitals.bloodPressure.systolic}/{vitals.bloodPressure.diastolic} mmHg</span></div>
              <div>• SpO2: <span className="font-bold">{vitals.spO2.value}%</span></div>
              <div className="col-span-2">• Kiosk Location: <span className="font-bold">{patient.kioskLocation}</span></div>
            </div>
          </div>
        )}

        {/* Direct Speed-Dial Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href="tel:108"
            className="h-[48px] bg-red-600 text-white rounded-md flex items-center justify-center gap-2 text-xs font-bold font-mono uppercase tracking-wider hover:bg-red-700 transition-colors shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">phone_in_talk</span>
            Call Ambulance 108
          </a>

          <a
            href="tel:1075"
            className="h-[48px] bg-slate-900 text-white rounded-md flex items-center justify-center gap-2 text-xs font-bold font-mono uppercase tracking-wider hover:bg-slate-800 transition-colors shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">support_agent</span>
            Health Helpline 1075
          </a>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-slate-100">
          {!countdown && !sosSent && (
            <button
              onClick={handleStartCountdown}
              className="flex-1 h-[44px] bg-red-100 text-red-800 border border-red-300 rounded-md font-mono text-xs font-bold uppercase tracking-wider hover:bg-red-200 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">cell_tower</span>
              Broadcast Automated SOS Alert
            </button>
          )}

          <button
            onClick={toggleSiren}
            className="px-4 h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border border-slate-200"
            title="Play acoustic beacon"
          >
            <span className="material-symbols-outlined text-[18px]">volume_up</span>
            {sirenPlaying ? 'SIREN ON' : 'TEST BEACON'}
          </button>
        </div>
      </div>
    </div>
  );
};
