import React, { useState, useRef, useEffect } from 'react';
import { VitalsData, AIAnalysisResult, LanguageCode } from '../types';
import { speakText, stopSpeaking, playAudioFeedback } from '../utils/speech';
import confetti from 'canvas-confetti';

interface VitalsScreenProps {
  vitals: VitalsData;
  onMeasureAgain: () => void;
  onSaveToRecords: () => void;
  onOpenManualEdit: () => void;
  isMeasuring?: boolean;
  isSaving?: boolean;
  onAnalyzeWithAI?: () => void;
  aiAnalysis?: AIAnalysisResult | null;
  isLoadingAI?: boolean;
  language?: LanguageCode;
  onOpenWsInspector?: () => void;
}

export const VitalsScreen: React.FC<VitalsScreenProps> = ({
  vitals,
  onMeasureAgain,
  onSaveToRecords,
  onOpenManualEdit,
  isMeasuring = false,
  isSaving = false,
  onAnalyzeWithAI,
  aiAnalysis,
  isLoadingAI = false,
  language = 'en',
  onOpenWsInspector,
}) => {
  const [showAiCard, setShowAiCard] = useState(false);
  const [tempUnit, setTempUnit] = useState<'°F' | '°C'>('°F');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [waveMode, setWaveMode] = useState<'PPG Wave' | 'Enzymatic' | 'Thermal'>('PPG Wave');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Oscilloscope live canvas animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let offset = 0;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = '#090D16';
      ctx.fillRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 25) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Signal wave
      ctx.beginPath();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = waveMode === 'PPG Wave' ? '#10B981' : waveMode === 'Enzymatic' ? '#38BDF8' : '#F59E0B';
      ctx.shadowColor = waveMode === 'PPG Wave' ? '#10B981' : waveMode === 'Enzymatic' ? '#38BDF8' : '#F59E0B';
      ctx.shadowBlur = 6;

      const baseMid = h / 2;
      for (let x = 0; x < w; x++) {
        const t = (x + offset) * 0.04;
        let y = baseMid;

        if (waveMode === 'PPG Wave') {
          // ECG-like pulse wave
          const cycle = (x + offset) % 180;
          if (cycle > 40 && cycle < 55) {
            y -= 12; // P wave
          } else if (cycle >= 70 && cycle < 78) {
            y += 8; // Q dip
          } else if (cycle >= 78 && cycle < 90) {
            y -= 48; // R peak
          } else if (cycle >= 90 && cycle < 98) {
            y += 18; // S dip
          } else if (cycle >= 115 && cycle < 140) {
            y -= 16; // T wave
          } else {
            y += Math.sin(t * 0.8) * 2;
          }
        } else if (waveMode === 'Enzymatic') {
          // Biosensor reaction curve
          y += Math.sin(t) * 20 + Math.sin(t * 2.3) * 6;
        } else {
          // Thermal gradient smooth wave
          y += Math.sin(t * 0.5) * 15;
        }

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      offset += 2.5;
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [waveMode]);

  // Convert temperature if user toggles °C
  const displayedTemp =
    tempUnit === '°F'
      ? `${vitals.temperature.value}°F`
      : `${(((vitals.temperature.value - 32) * 5) / 9).toFixed(1)}°C`;

  // Voice readout for accessibility
  const handleVoiceReadout = () => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    playAudioFeedback('beep');

    const text =
      language === 'hi'
        ? `स्वास्थ्य जांच पूरी हो गई है। रक्तचाप ${vitals.bloodPressure.systolic} बटा ${vitals.bloodPressure.diastolic} है। ब्लड शुगर ${vitals.bloodSugar.value} मिलीग्राम है। ऑक्सीजन स्तर ${vitals.spO2.value} प्रतिशत है। तापमान ${vitals.temperature.value} डिग्री है।`
        : `Vitals check complete. Blood pressure is ${vitals.bloodPressure.systolic} over ${vitals.bloodPressure.diastolic} mmHg. Blood sugar is ${vitals.bloodSugar.value} mg/dL. Oxygen saturation is ${vitals.spO2.value} percent. Body temperature is ${vitals.temperature.value} degrees Fahrenheit.`;

    speakText(text, (language || 'hi') as LanguageCode, () => setIsSpeaking(false));
  };

  const handleSaveWithCelebration = () => {
    try {
      confetti({
        particleCount: 35,
        spread: 50,
        origin: { y: 0.8 },
        colors: ['#38BDF8', '#0F172A', '#22C55E', '#94A3B8'],
      });
    } catch {
      // fallback
    }
    onSaveToRecords();
  };

  return (
    <main
      id="vitals-check-main-canvas"
      className="flex-grow pt-[72px] md:pt-[84px] pb-[100px] md:pb-[40px] px-4 md:px-8 max-w-[1024px] mx-auto w-full flex flex-col gap-6"
    >
      {/* Desktop Page Title & Telemetry Header */}
      <div className="hidden md:flex justify-between items-center w-full border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1
              id="vitals-screen-title"
              className="text-2xl font-bold text-slate-800 tracking-tight uppercase font-mono"
            >
              Vitals Command Matrix
            </h1>
            <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[11px] font-bold rounded-sm font-mono uppercase">
              NODE_04
            </span>
          </div>
          <p className="text-xs text-slate-500 font-mono uppercase tracking-widest mt-1">
            REAL-TIME BIOMETRIC TELEMETRY • HIGH PRECISION HARVEST
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onOpenWsInspector && (
            <button
              onClick={onOpenWsInspector}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider font-mono bg-slate-900 text-[#38BDF8] border border-slate-700 hover:bg-slate-800 transition-all"
              title="Inspect WebSocket Connection & Diagnostics"
            >
              <span className="w-2 h-2 rounded-full bg-[#38BDF8] animate-ping"></span>
              <span>WS TELEMETRY</span>
            </button>
          )}

          <button
            id="voice-readout-button"
            onClick={handleVoiceReadout}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider border transition-all ${
              isSpeaking
                ? 'bg-sky-50 text-[#0284C7] border-[#38BDF8] animate-pulse'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
            }`}
            title="Read out vitals in audio"
          >
            <span className="material-symbols-outlined text-[18px]">
              {isSpeaking ? 'volume_up' : 'campaign'}
            </span>
            <span>{isSpeaking ? 'TRANSMITTING...' : 'AUDIO SYNTH'}</span>
          </button>

          <button
            onClick={onOpenManualEdit}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            <span>CALIBRATE</span>
          </button>

          <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full uppercase tracking-widest flex items-center gap-1.5 font-mono">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            ALL_SENSORS_OK
          </span>
        </div>
      </div>

      {/* Mobile Subheader */}
      <div className="flex md:hidden justify-between items-center w-full">
        <span className="text-[11px] text-slate-500 font-bold uppercase tracking-widest font-mono flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          KIOSK HARVEST STREAM
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={handleVoiceReadout}
            className="text-[11px] font-bold uppercase tracking-wider text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-md flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[15px] text-[#38BDF8]">volume_up</span>
            {isSpeaking ? 'AUDIO...' : 'AUDIO'}
          </button>

          <button
            onClick={onOpenManualEdit}
            className="text-[11px] font-bold uppercase tracking-wider text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-md flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[15px]">tune</span>
            EDIT
          </button>
        </div>
      </div>

      {/* Vitals Grid - 4 Geometric Cards (Geometric Balance Archetype) */}
      <section
        id="vitals-grid-cards"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full"
      >
        {/* 1. Blood Pressure Card */}
        <div
          id="card-blood-pressure"
          className="bg-white p-6 border border-slate-200 rounded-lg flex flex-col justify-between shadow-xs hover:border-slate-300 transition-all relative overflow-hidden"
        >
          <div className="flex justify-between items-start mb-2">
            <div className="text-slate-400 text-xs font-bold uppercase tracking-widest">
              Blood Pressure
            </div>
            <span
              id="bp-status-badge"
              className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-widest font-mono ${
                vitals.bloodPressure.status === 'Normal'
                  ? 'bg-green-100 text-green-700'
                  : vitals.bloodPressure.status === 'Elevated'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {vitals.bloodPressure.status}
            </span>
          </div>

          <div className="my-2">
            <div
              id="bp-value-display"
              className="text-3xl lg:text-4xl font-black text-slate-800 tracking-tighter"
            >
              {vitals.bloodPressure.systolic}/{vitals.bloodPressure.diastolic}
            </div>
            <div className="text-slate-400 text-xs font-mono uppercase mt-0.5">
              {vitals.bloodPressure.unit} • SYS/DIA
            </div>
          </div>

          <div className="mt-2 text-green-600 text-xs flex items-center gap-1 font-mono pt-3 border-t border-slate-100">
            <svg className="w-3.5 h-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z"></path>
            </svg>
            Optimal Hemodynamics
          </div>
        </div>

        {/* 2. Blood Sugar Card */}
        <div
          id="card-blood-sugar"
          className="bg-white p-6 border border-slate-200 rounded-lg flex flex-col justify-between shadow-xs hover:border-slate-300 transition-all relative overflow-hidden"
        >
          <div className="flex justify-between items-start mb-2">
            <div className="text-slate-400 text-xs font-bold uppercase tracking-widest">
              Blood Sugar
            </div>
            <span
              id="sugar-status-badge"
              className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-widest font-mono ${
                vitals.bloodSugar.status === 'Normal'
                  ? 'bg-green-100 text-green-700'
                  : vitals.bloodSugar.status === 'Pre-diabetes'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {vitals.bloodSugar.status}
            </span>
          </div>

          <div className="my-2">
            <div
              id="sugar-value-display"
              className="text-3xl lg:text-4xl font-black text-slate-800 tracking-tighter"
            >
              {vitals.bloodSugar.value}
            </div>
            <div className="text-slate-400 text-xs font-mono uppercase mt-0.5">
              {vitals.bloodSugar.unit} • {vitals.bloodSugar.type}
            </div>
          </div>

          <div className="mt-2 text-slate-500 text-xs flex items-center gap-1 font-mono pt-3 border-t border-slate-100">
            <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8]"></span>
            Biosensor Strip Verified
          </div>
        </div>

        {/* 3. SpO2 Card */}
        <div
          id="card-spo2"
          className="bg-white p-6 border border-slate-200 rounded-lg flex flex-col justify-between shadow-xs hover:border-slate-300 transition-all relative overflow-hidden"
        >
          <div className="flex justify-between items-start mb-2">
            <div className="text-slate-400 text-xs font-bold uppercase tracking-widest">
              SpO2 Oxygen
            </div>
            <span
              id="spo2-status-badge"
              className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-widest font-mono ${
                vitals.spO2.status === 'Good' || vitals.spO2.status === 'Normal'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {vitals.spO2.status}
            </span>
          </div>

          <div className="my-2">
            <div
              id="spo2-value-display"
              className="text-3xl lg:text-4xl font-black text-slate-800 tracking-tighter"
            >
              {vitals.spO2.value}%
            </div>
            <div className="text-slate-400 text-xs font-mono uppercase mt-0.5">
              Pulse Oximeter Saturation
            </div>
          </div>

          <div className="mt-2 text-green-600 text-xs flex items-center gap-1 font-mono pt-3 border-t border-slate-100">
            <svg className="w-3.5 h-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z"></path>
            </svg>
            98.5% Calibrated Pulse
          </div>
        </div>

        {/* 4. Temperature Card */}
        <div
          id="card-temperature"
          className="bg-white p-6 border border-slate-200 rounded-lg flex flex-col justify-between shadow-xs hover:border-slate-300 transition-all relative overflow-hidden"
        >
          <div className="flex justify-between items-start mb-2">
            <div className="text-slate-400 text-xs font-bold uppercase tracking-widest">
              Temperature
            </div>
            <button
              onClick={() => setTempUnit(tempUnit === '°F' ? '°C' : '°F')}
              className="text-[10px] font-mono font-bold text-[#0284C7] uppercase hover:underline"
            >
              [{tempUnit === '°F' ? '°C' : '°F'}]
            </button>
          </div>

          <div className="my-2">
            <div
              id="temp-value-display"
              className="text-3xl lg:text-4xl font-black text-slate-800 tracking-tighter"
            >
              {displayedTemp}
            </div>
            <div className="text-slate-400 text-xs font-mono uppercase mt-0.5">
              Contactless IR Core
            </div>
          </div>

          <div className="mt-2 text-slate-500 text-xs flex items-center gap-1 font-mono pt-3 border-t border-slate-100">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            Normothermic Range
          </div>
        </div>
      </section>

      {/* Primary Action Buttons (Geometric Balance) */}
      <section id="vitals-primary-actions" className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
        {/* Measure Again Button */}
        <button
          id="btn-measure-again"
          onClick={onMeasureAgain}
          disabled={isMeasuring}
          className="h-[52px] bg-white text-slate-800 text-xs font-bold uppercase tracking-widest rounded-lg flex items-center justify-center gap-2.5 hover:bg-slate-50 active:scale-[0.99] transition-all border border-slate-300 cursor-pointer shadow-xs disabled:opacity-60 font-mono"
        >
          <svg className={`w-4 h-4 text-slate-600 ${isMeasuring ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
          </svg>
          <span>{isMeasuring ? 'RE-CALIBRATING SENSORS...' : 'RE-SCAN VITALS'}</span>
        </button>

        {/* Save to Health Records Button */}
        <button
          id="btn-save-health-records"
          onClick={handleSaveWithCelebration}
          disabled={isSaving}
          className="h-[52px] bg-[#0F172A] text-white text-xs font-bold uppercase tracking-widest rounded-lg flex items-center justify-center gap-2.5 hover:bg-[#1E293B] active:scale-[0.99] transition-all shadow-xs cursor-pointer border border-[#334155] disabled:opacity-60 font-mono"
        >
          <span className="w-2 h-2 rounded-full bg-[#38BDF8] animate-pulse"></span>
          <span>{isSaving ? 'PERSISTING TO ABHA...' : 'SYNC TO HEALTH MATRIX'}</span>
        </button>
      </section>

      {/* Infrastructure Pulse & Live Event Log (Geometric Balance Design Signature) */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
        {/* Pulse / Waveform visualizer */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between shadow-xs">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#0284C7]">show_chart</span>
              <h3 className="font-bold uppercase tracking-widest text-xs text-slate-700 font-mono">
                Biometric Oscilloscope & Signal Wave
              </h3>
            </div>
            <div className="flex gap-2 text-xs font-bold text-slate-400 font-mono">
              {(['PPG Wave', 'Enzymatic', 'Thermal'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setWaveMode(m)}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    waveMode === m
                      ? 'bg-[#0F172A] text-[#38BDF8]'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          
          {/* Realtime Canvas Oscilloscope Wave */}
          <div className="h-36 relative bg-[#090D16] rounded-md overflow-hidden p-2 border border-slate-800 flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={600}
              height={140}
              className="w-full h-full object-contain"
            />
            <div className="absolute top-2 left-3 text-[10px] font-mono text-emerald-400 bg-slate-900/80 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>LIVE PULSE: {vitals.heartRate?.value || 72} BPM</span>
            </div>
            <div className="absolute top-2 right-3 text-[10px] font-mono text-sky-400 bg-slate-900/80 px-2 py-0.5 rounded border border-sky-500/30">
              MODE: {waveMode.toUpperCase()}
            </div>
          </div>

          <div className="flex justify-between items-center mt-3 text-[11px] text-slate-500 font-mono">
            <span>SAMPLING FREQ: {waveMode === 'PPG Wave' ? '250Hz' : waveMode === 'Enzymatic' ? '100Hz' : '50Hz'}</span>
            <span className="text-green-600 font-bold">DSP ARTIFACT FILTER: ACTIVE</span>
          </div>
        </div>

        {/* Live Telemetry Event Log */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-6 flex flex-col text-white shadow-xs">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold uppercase tracking-widest text-xs text-slate-400 font-mono">
              Sensor Telemetry Log
            </h3>
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
          </div>

          <div className="space-y-2.5 font-mono text-[11px] flex-1 overflow-y-auto max-h-[140px]">
            <div className="flex gap-2 border-l-2 border-green-500 pl-2">
              <span className="text-green-400">[OK]</span>
              <span className="text-slate-300">Cuff transducer calibrated (BP: {vitals.bloodPressure.systolic}/{vitals.bloodPressure.diastolic})</span>
            </div>
            <div className="flex gap-2 border-l-2 border-sky-500 pl-2">
              <span className="text-[#38BDF8]">[INFO]</span>
              <span className="text-slate-300">Blood glucose biosensor: {vitals.bloodSugar.value} mg/dL</span>
            </div>
            <div className="flex gap-2 border-l-2 border-green-500 pl-2">
              <span className="text-green-400">[OK]</span>
              <span className="text-slate-300">SpO2 optic sensor: {vitals.spO2.value}% saturation</span>
            </div>
            <div className="flex gap-2 border-l-2 border-purple-500 pl-2">
              <span className="text-purple-300">[THERM]</span>
              <span className="text-slate-300">IR thermal sensor: {displayedTemp}</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800 flex justify-between items-center text-[10px] font-mono text-slate-500">
            <span>LATENCY: 8ms • KIOSK NODE-04</span>
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full opacity-60"></div>
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full opacity-30"></div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Clinical Insights Module */}
      <section
        id="ai-insights-section"
        className="w-full bg-white border border-slate-200 rounded-lg p-6"
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-800 text-[#38BDF8] rounded-md flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[18px]">smart_toy</span>
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 font-mono">
                Clinical AI Triage & Analysis
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                MULTI-PARAMETRIC PROTOCOL EVALUATION
              </p>
            </div>
          </div>

          <button
            id="btn-toggle-ai-insights"
            onClick={() => {
              if (!showAiCard && !aiAnalysis && onAnalyzeWithAI) {
                onAnalyzeWithAI();
              }
              setShowAiCard(!showAiCard);
            }}
            className="text-xs font-bold uppercase tracking-widest font-mono text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1"
          >
            <span>{showAiCard ? 'COLLAPSE' : 'RUN AI DIAGNOSTIC'}</span>
            <span className="material-symbols-outlined text-[16px]">
              {showAiCard ? 'expand_less' : 'expand_more'}
            </span>
          </button>
        </div>

        {showAiCard && (
          <div className="mt-5 pt-5 border-t border-slate-200 flex flex-col gap-4">
            {isLoadingAI ? (
              <div className="flex flex-col items-center justify-center py-6 gap-3 text-slate-500 font-mono">
                <div className="w-6 h-6 border-2 border-slate-800 border-t-[#38BDF8] rounded-full animate-spin"></div>
                <span className="text-xs uppercase tracking-widest">
                  RUNNING GEMINI CLINICAL REASONING ENGINE...
                </span>
              </div>
            ) : aiAnalysis ? (
              <div className="flex flex-col gap-4 text-slate-800">
                <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">
                      Health Index Score:
                    </span>
                    <span className="text-xl font-black text-slate-900">
                      {aiAnalysis.overallScore}/100
                    </span>
                  </div>
                  <span
                    className={`text-xs font-bold uppercase tracking-widest font-mono px-2.5 py-1 rounded-full ${
                      aiAnalysis.riskLevel === 'Low'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    RISK_LEVEL: {aiAnalysis.riskLevel}
                  </span>
                </div>

                <p className="text-sm leading-relaxed text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-200 font-sans">
                  {aiAnalysis.statusSummary}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-2 font-mono">
                      <span className="material-symbols-outlined text-[16px] text-[#0284C7]">restaurant</span>
                      Nutritional Guidance
                    </h4>
                    <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                      {aiAnalysis.dietaryTips.map((tip, idx) => (
                        <li key={idx}>{tip}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-2 font-mono">
                      <span className="material-symbols-outlined text-[16px] text-green-600">directions_walk</span>
                      Preventive Protocol
                    </h4>
                    <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                      {aiAnalysis.recommendations.map((rec, idx) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-100 p-3 rounded-lg border border-slate-200 font-mono">
                  <span className="flex items-center gap-1.5">
                    <span className="text-[#38BDF8] font-bold">[CLINICAL NOTE]</span>
                    <span>{aiAnalysis.doctorAdvice}</span>
                  </span>
                  <button
                    onClick={onAnalyzeWithAI}
                    className="text-xs font-bold uppercase tracking-wider text-[#0284C7] hover:underline"
                  >
                    RE-ANALYZE
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-mono uppercase tracking-wider">
                  Select run to execute algorithmic diagnostic evaluation.
                </span>
                <button
                  onClick={onAnalyzeWithAI}
                  className="px-4 py-2 bg-[#0F172A] text-white rounded-md text-xs font-bold uppercase tracking-widest font-mono hover:bg-[#1E293B]"
                >
                  RUN EVALUATION
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
};

