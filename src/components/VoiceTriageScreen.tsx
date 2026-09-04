import React, { useState, useEffect, useRef } from 'react';
import { PatientProfile, VitalsData, VoiceTriageResult, LanguageCode } from '../types';
import { getTranslation } from '../utils/i18n';
import { speakText, stopSpeaking, playAudioFeedback, VoiceRecognizer } from '../utils/speech';

interface VoiceTriageScreenProps {
  patient: PatientProfile;
  vitals: VitalsData;
  language: LanguageCode;
  onNavigateToConsult: () => void;
  onNavigateToVitals: () => void;
  onOpenEmergency: () => void;
  onShowToast: (msg: string) => void;
}

export const VoiceTriageScreen: React.FC<VoiceTriageScreenProps> = ({
  patient,
  vitals,
  language,
  onNavigateToConsult,
  onNavigateToVitals,
  onOpenEmergency,
  onShowToast,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [triageResult, setTriageResult] = useState<VoiceTriageResult | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const recognizerRef = useRef<VoiceRecognizer | null>(null);

  // Suggested quick prompts in current language
  const quickPrompts: Record<LanguageCode, string[]> = {
    hi: [
      'मुझे 2 दिन से सिरदर्द और तेज बुखार है',
      'छाती में भारीपन और सांस लेने में तकलीफ हो रही है',
      'कमजोरी लग रही है और चक्कर आ रहे हैं',
      'पेट में तेज मरोड़ और दस्त की समस्या है',
    ],
    mr: [
      'मला दोन दिवसांपासून ताप आणि डोकेदुखी आहे',
      'छातीत जडपणा आणि दम लागत आहे',
      'खूप अशक्तपणा आणि चक्कर येत आहे',
    ],
    bn: [
      'আমার দুদিন ধরে জ্বর ও প্রচণ্ড মাথাব্যথা',
      'বুকে চাপ ও শ্বাসকষ্ট অনুভব হচ্ছে',
      'শরীরে খুব দুর্বলতা ও মাথা ঘোরা',
    ],
    ta: [
      'எனக்கு இரண்டு நாட்களாக காய்ச்சல் மற்றும் தலைவலி உள்ளது',
      'நெஞ்சு அடைப்பது போல் உள்ளது, மூச்சு விட சிரமம்',
      'ரொம்ப சோர்வாகவும் மயக்கமாகவும் இருக்கிறது',
    ],
    te: [
      'నాకు రెండు రోజులుగా జ్వరం మరియు తలనొప్పిగా ఉంది',
      'ఛాతీలో బిగుతుగా ఉండి శ్వాస తీసుకోవడం కష్టంగా ఉంది',
      'చాలా నీరసంగా, కళ్ళు తిరుగుతున్నట్లు ఉంది',
    ],
    gu: [
      'મને બે દિવસથી તાવ અને માથાનો દુખાવો છે',
      'છાતીમાં ભારેપણું અને શ્વાસ લેવામાં તકલીફ છે',
      'ખૂબ નબળાઈ લાગે છે અને ચક્કર આવે છે',
    ],
    kn: [
      'ನನಗೆ ಎರಡು ದಿನಗಳಿಂದ ಜ್ವರ ಮತ್ತು ತಲೆನೋವು ಇದೆ',
      'ಎದೆಯಲ್ಲಿ ಬಿಗಿತ ಮತ್ತು ಉಸಿರಾಟದ ತೊಂದರೆ ಇದೆ',
      'ತುಂಬಾ ಸುಸ್ತು ಮತ್ತು ತಲೆತಿರುಗುವಿಕೆ ಇದೆ',
    ],
    pa: [
      'ਮੈਨੂੰ ਦੋ ਦਿਨਾਂ ਤੋਂ ਬੁਖਾਰ ਅਤੇ ਸਿਰਦਰਦ ਹੈ',
      'ਛਾਤੀ ਵਿੱਚ ਭਾਰਾਪਨ ਅਤੇ ਸਾਹ ਲੈਣ ਵਿੱਚ ਤਕਲੀਫ ਹੈ',
      'ਬਹੁਤ ਕਮਜ਼ੋਰੀ ਅਤੇ ਚੱਕਰ ਆ ਰਹੇ ਹਨ',
    ],
    en: [
      'I have severe headache and high fever for 2 days',
      'Feeling heavy chest discomfort and shortness of breath',
      'Experiencing extreme weakness, fatigue and dizziness',
      'Stomach cramps and digestive distress since morning',
    ],
  };

  useEffect(() => {
    recognizerRef.current = new VoiceRecognizer(language);
    return () => {
      stopSpeaking();
      recognizerRef.current?.stop();
    };
  }, [language]);

  const handleToggleListening = () => {
    if (isListening) {
      recognizerRef.current?.stop();
      setIsListening(false);
      if (transcript.trim()) {
        runTriage(transcript.trim());
      }
    } else {
      stopSpeaking();
      setTranscript('');
      setInterimText('');
      setTriageResult(null);
      setIsListening(true);

      recognizerRef.current?.setLanguage(language);
      recognizerRef.current?.start(
        (text, isFinal) => {
          if (isFinal) {
            setTranscript(text);
            setInterimText('');
            setIsListening(false);
            runTriage(text);
          } else {
            setInterimText(text);
          }
        },
        (err) => {
          setIsListening(false);
          onShowToast('Microphone notice: You can also tap sample symptoms below.');
        }
      );
    }
  };

  const handleQuickPromptClick = (text: string) => {
    setTranscript(text);
    playAudioFeedback('beep');
    runTriage(text);
  };

  const runTriage = async (symptomsText: string) => {
    setIsAnalyzing(true);
    playAudioFeedback('beep');

    try {
      const res = await fetch('/api/ai/voice-triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symptomVoiceText: symptomsText,
          language,
          patient,
          vitals,
        }),
      });

      const data = await res.json();
      if (data.success && data.data) {
        setTriageResult(data.data);
        playAudioFeedback(data.data.riskLevel === 'red' ? 'alert' : 'success');

        // Auto read-out in patient language
        if (data.data.audioNarration) {
          setIsPlayingAudio(true);
          speakText(data.data.audioNarration, language, () => {
            setIsPlayingAudio(false);
          });
        }
      } else {
        onShowToast('Could not complete clinical triage. Please retry.');
      }
    } catch (e) {
      console.warn('Triage fetch failed:', e);
      onShowToast('Using offline clinical rules.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleToggleVoiceReadout = () => {
    if (isPlayingAudio) {
      stopSpeaking();
      setIsPlayingAudio(false);
    } else if (triageResult?.audioNarration) {
      setIsPlayingAudio(true);
      speakText(triageResult.audioNarration, language, () => {
        setIsPlayingAudio(false);
      });
    }
  };

  const activePrompts = quickPrompts[language] || quickPrompts.en;

  return (
    <div id="voice-triage-screen" className="space-y-6 animate-fadeIn pb-24 md:pb-12 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-mono font-bold mb-2 border border-teal-500/40">
              <span className="material-symbols-outlined text-[14px]">psychology</span>
              <span>AI CLINICAL TRIAGE & RISK ENGINE</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              {getTranslation(language, 'speakProblem')}
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-xl">
              {getTranslation(language, 'speakProblemSub')}
            </p>
          </div>

          {/* Current Vitals Snapshot Card */}
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3.5 flex items-center gap-4 text-xs font-mono shrink-0">
            <div>
              <div className="text-slate-400 text-[10px]">PATIENT</div>
              <div className="text-white font-bold">{patient.name} ({patient.age}y)</div>
            </div>
            <div className="h-6 w-px bg-slate-700"></div>
            <div>
              <div className="text-slate-400 text-[10px]">LATEST BP</div>
              <div className="text-teal-300 font-bold">
                {vitals.bloodPressure.systolic}/{vitals.bloodPressure.diastolic}
              </div>
            </div>
            <div className="h-6 w-px bg-slate-700"></div>
            <div>
              <div className="text-slate-400 text-[10px]">SPO2</div>
              <div className="text-sky-300 font-bold">{vitals.spO2.value}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Microphone Interaction Stage */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 md:p-12 text-center relative overflow-hidden shadow-2xl">
        {/* Pulsing visual circles when listening */}
        {isListening && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 rounded-full bg-rose-500/20 animate-ping"></div>
            <div className="w-72 h-72 rounded-full bg-rose-500/10 animate-pulse"></div>
          </div>
        )}

        <div className="relative z-10 max-w-xl mx-auto flex flex-col items-center">
          {/* Large Center Microphone Button */}
          <button
            id="main-animated-mic-button"
            onClick={handleToggleListening}
            className={`w-32 h-32 md:w-40 md:h-40 rounded-full flex flex-col items-center justify-center transition-all transform active:scale-95 shadow-2xl cursor-pointer ${
              isListening
                ? 'bg-rose-600 text-white ring-8 ring-rose-500/40 animate-pulse scale-105'
                : isAnalyzing
                ? 'bg-amber-600 text-white animate-spin'
                : 'bg-gradient-to-tr from-teal-600 to-sky-500 text-slate-950 hover:brightness-110 ring-4 ring-teal-400/30'
            }`}
          >
            <span className="material-symbols-outlined text-[48px] md:text-[60px]">
              {isAnalyzing ? 'sync' : isListening ? 'mic' : 'mic_none'}
            </span>
            <span className="text-[10px] md:text-xs font-black tracking-wider uppercase font-mono mt-1">
              {isListening ? 'STOP & CHECK' : isAnalyzing ? 'ANALYZING' : 'TAP & SPEAK'}
            </span>
          </button>

          {/* Status Label */}
          <div className="mt-6 text-center">
            <p className="text-base md:text-lg font-bold text-white">
              {isListening
                ? getTranslation(language, 'listening')
                : isAnalyzing
                ? getTranslation(language, 'analyzing')
                : '“Tell me what problem you are facing / अपनी समस्या बताएं”'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Supports 9 Indian regional languages • Real-time clinical assessment
            </p>
          </div>

          {/* Real-time transcribed text box */}
          {(transcript || interimText) && (
            <div className="mt-6 w-full p-4 rounded-xl bg-slate-800 border border-slate-700 text-left">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-1">
                <span>RECOGNIZED VOICE INPUT</span>
                {isListening && <span className="text-rose-400 animate-pulse font-bold">● RECORDING</span>}
              </div>
              <p className="text-base font-semibold text-white">
                {transcript}
                <span className="text-teal-400 italic"> {interimText}</span>
              </p>
            </div>
          )}
        </div>

        {/* Quick Clickable Suggestions for Rural Accessibility */}
        {!isListening && !isAnalyzing && !triageResult && (
          <div className="mt-10 pt-6 border-t border-slate-800/80 text-left max-w-2xl mx-auto">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-teal-400">touch_app</span>
              <span>Or tap common health complaints (बिना बोले चुनें):</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {activePrompts.map((promptText, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickPromptClick(promptText)}
                  className="p-3 rounded-xl bg-slate-800/90 hover:bg-slate-750 border border-slate-700 hover:border-teal-500/50 text-left text-xs font-medium text-slate-200 transition-all flex items-start gap-2.5 hover:text-white"
                >
                  <span className="material-symbols-outlined text-teal-400 text-[18px] shrink-0 mt-0.5">
                    chat_bubble_outline
                  </span>
                  <span>{promptText}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Result Cards: 🟢 Self-Care | 🟡 Consult Doctor | 🔴 Emergency Care */}
      {triageResult && (
        <div id="triage-result-container" className="space-y-6 animate-fadeIn">
          {/* Main Triaged Risk Banner */}
          <div
            className={`rounded-2xl border p-6 md:p-8 shadow-2xl relative overflow-hidden ${
              triageResult.riskLevel === 'red'
                ? 'bg-rose-950/90 border-rose-600 text-rose-100 ring-2 ring-rose-500/50'
                : triageResult.riskLevel === 'yellow'
                ? 'bg-amber-950/90 border-amber-500 text-amber-100 ring-2 ring-amber-500/50'
                : 'bg-emerald-950/90 border-emerald-500 text-emerald-100 ring-2 ring-emerald-500/50'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                    triageResult.riskLevel === 'red'
                      ? 'bg-rose-600 text-white animate-bounce'
                      : triageResult.riskLevel === 'yellow'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-emerald-500 text-slate-950'
                  }`}
                >
                  <span className="material-symbols-outlined text-[36px]">
                    {triageResult.riskLevel === 'red'
                      ? 'e911_emergency'
                      : triageResult.riskLevel === 'yellow'
                      ? 'stethoscope'
                      : 'check_circle'}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-black/40 border border-white/20">
                      {triageResult.riskLevel === 'red'
                        ? '🔴 RED TIER - CRITICAL SOS'
                        : triageResult.riskLevel === 'yellow'
                        ? '🟡 YELLOW TIER - PHC REFERRAL'
                        : '🟢 GREEN TIER - HOME CARE'}
                    </span>
                    <span className="text-xs opacity-80 font-medium">
                      {triageResult.riskCategory}
                    </span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-black mt-1">
                    {triageResult.title}
                  </h2>
                </div>
              </div>

              {/* Audio Readout Button */}
              <button
                id="voice-readout-triage-btn"
                onClick={handleToggleVoiceReadout}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-all ${
                  isPlayingAudio
                    ? 'bg-white text-slate-950 border-white animate-pulse'
                    : 'bg-black/40 text-white hover:bg-black/60 border-white/20'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isPlayingAudio ? 'volume_up' : 'volume_down'}
                </span>
                <span>{isPlayingAudio ? 'Speaking...' : 'Listen in Audio (सुनें)'}</span>
              </button>
            </div>

            {/* Clinical Summary */}
            <p className="mt-4 text-sm md:text-base leading-relaxed opacity-95 bg-black/30 p-4 rounded-xl border border-white/10">
              {triageResult.summary}
            </p>

            {/* Action Callouts */}
            <div className="mt-6 flex flex-wrap gap-3">
              {triageResult.riskLevel === 'red' && (
                <button
                  id="triage-sos-dispatch-btn"
                  onClick={onOpenEmergency}
                  className="px-6 py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl text-sm uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-rose-900/50 animate-pulse cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">e911_emergency</span>
                  <span>DISPATCH EMERGENCY 108 AMBULANCE NOW</span>
                </button>
              )}

              {(triageResult.riskLevel === 'yellow' || triageResult.riskLevel === 'red') && (
                <button
                  id="triage-connect-doctor-btn"
                  onClick={onNavigateToConsult}
                  className="px-6 py-3.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black rounded-xl text-sm uppercase tracking-wider flex items-center gap-2 shadow-lg cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">video_camera_front</span>
                  <span>CONNECT WITH ON-CALL DOCTOR ({triageResult.recommendedDoctor})</span>
                </button>
              )}

              <button
                id="triage-recheck-vitals-btn"
                onClick={onNavigateToVitals}
                className="px-4 py-3 bg-black/40 hover:bg-black/60 text-white font-bold rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 border border-white/20"
              >
                <span className="material-symbols-outlined text-[18px]">monitor_heart</span>
                <span>Re-measure Kiosk Vitals</span>
              </button>

              <button
                onClick={() => {
                  setTriageResult(null);
                  setTranscript('');
                }}
                className="px-4 py-3 bg-black/30 hover:bg-black/50 text-white font-bold rounded-xl text-xs uppercase tracking-wider border border-white/20"
              >
                Ask Another Symptom
              </button>
            </div>
          </div>

          {/* Deep Clinical Breakdown: Home Care, Warning Signs & Questions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Self-care Guidance */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-3">
                <span className="material-symbols-outlined text-[20px]">spa</span>
                <span>Self-Care Guidance (घरेलू उपाय)</span>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-300">
                {triageResult.homeRemedies.map((remedy, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>{remedy}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 2. Red Flag Warning Signs */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm mb-3">
                <span className="material-symbols-outlined text-[20px]">warning</span>
                <span>Warning Signs (चेतावनी संकेत)</span>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-300">
                {triageResult.warningSigns.map((warning, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-rose-400 font-bold">⚠</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 3. Follow-up Clinical Questions */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-teal-400 font-bold text-sm mb-3">
                <span className="material-symbols-outlined text-[20px]">quiz</span>
                <span>Doctor Questions (जांच प्रश्न)</span>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-300">
                {triageResult.followUpQuestions.map((q, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-teal-400 font-mono font-bold">Q{i + 1}.</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
