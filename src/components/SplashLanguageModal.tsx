import React, { useState } from 'react';
import { LanguageCode, UserRole } from '../types';
import { SUPPORTED_LANGUAGES, getTranslation } from '../utils/i18n';
import { speakText, playAudioFeedback, VoiceRecognizer } from '../utils/speech';

interface SplashLanguageModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLanguage: LanguageCode;
  onSelectLanguage: (lang: LanguageCode) => void;
  selectedRole: UserRole;
  onSelectRole: (role: UserRole) => void;
}

export const SplashLanguageModal: React.FC<SplashLanguageModalProps> = ({
  isOpen,
  onClose,
  selectedLanguage,
  onSelectLanguage,
  selectedRole,
  onSelectRole,
}) => {
  const [step, setStep] = useState<'language' | 'role'>('language');
  const [isListeningForLang, setIsListeningForLang] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleVoiceDetectLanguage = () => {
    setIsListeningForLang(true);
    setVoiceHint('Listening for language: Speak Hindi, English, Marathi, Tamil, etc...');
    playAudioFeedback('start_listening');

    const recognizer = new VoiceRecognizer('hi');
    recognizer.start(
      (transcript, isFinal) => {
        if (isFinal) {
          const t = transcript.toLowerCase();
          setIsListeningForLang(false);
          playAudioFeedback('success');

          if (t.includes('hindi') || t.includes('हिंदी') || t.includes('हिन्दी')) {
            onSelectLanguage('hi');
            speakText('हिन्दी चुनी गई।', 'hi');
          } else if (t.includes('marathi') || t.includes('मराठी')) {
            onSelectLanguage('mr');
            speakText('मराठी निवडली.', 'mr');
          } else if (t.includes('tamil') || t.includes('தமிழ்')) {
            onSelectLanguage('ta');
            speakText('தமிழ் தேர்வு செய்யப்பட்டது.', 'ta');
          } else if (t.includes('telugu') || t.includes('తెలుగు')) {
            onSelectLanguage('te');
            speakText('తెలుగు ఎంపిక చేయబడింది.', 'te');
          } else if (t.includes('bengali') || t.includes('বাংলা') || t.includes('bangla')) {
            onSelectLanguage('bn');
            speakText('বাংলা নির্বাচিত হয়েছে।', 'bn');
          } else if (t.includes('gujarati') || t.includes('ગુજરાતી')) {
            onSelectLanguage('gu');
            speakText('ગુજરાતી પસંદ કરવામાં આવી.', 'gu');
          } else if (t.includes('kannada') || t.includes('ಕನ್ನಡ')) {
            onSelectLanguage('kn');
            speakText('ಕನ್ನಡ ಆಯ್ಕೆ ಮಾಡಲಾಗಿದೆ.', 'kn');
          } else if (t.includes('punjabi') || t.includes('ਪੰਜਾਬੀ')) {
            onSelectLanguage('pa');
            speakText('ਪੰਜਾਬੀ ਚੁਣੀ ਗਈ।', 'pa');
          } else {
            onSelectLanguage('en');
            speakText('English selected.', 'en');
          }
          setVoiceHint(null);
        }
      },
      (err) => {
        setIsListeningForLang(false);
        setVoiceHint('Could not detect speech. Please tap a language below.');
      }
    );
  };

  const handleLanguagePick = (lang: LanguageCode) => {
    onSelectLanguage(lang);
    playAudioFeedback('beep');
    const matched = SUPPORTED_LANGUAGES.find((l) => l.code === lang);
    if (matched) {
      speakText(matched.voiceGreeting, lang);
    }
  };

  const handleRolePick = (role: UserRole) => {
    onSelectRole(role);
    playAudioFeedback('success');
    if (role === 'patient') {
      speakText(getTranslation(selectedLanguage, 'rolePatient') + ' पोर्टल खुला है।', selectedLanguage);
    } else if (role === 'asha') {
      speakText(getTranslation(selectedLanguage, 'roleAsha') + ' पोर्टल खुला है।', selectedLanguage);
    } else {
      speakText(getTranslation(selectedLanguage, 'roleDoctor') + ' पोर्टल खुला है।', selectedLanguage);
    }
    onClose();
  };

  return (
    <div
      id="splash-language-modal-overlay"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        id="splash-modal-card"
        className="bg-slate-900 border border-slate-700 text-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-fadeIn"
      >
        {/* Header with Logo */}
        <div className="bg-gradient-to-r from-teal-900/60 via-slate-900 to-sky-950 p-6 border-b border-slate-800 text-center relative">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-500/20 border border-teal-400/40 text-teal-400 mb-3 shadow-lg shadow-teal-500/10">
            <span className="material-symbols-outlined text-[36px]">health_and_safety</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            <span>ArogyaConnect</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40 font-mono">
              RURAL 4.0
            </span>
          </h1>
          <p className="text-sm font-medium text-slate-300 mt-1">
            {getTranslation(selectedLanguage, 'tagline')}
          </p>

          <button
            id="splash-close-btn"
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Step Navigation Pill */}
        <div className="px-6 pt-4 flex gap-2 border-b border-slate-800/80 pb-3">
          <button
            onClick={() => setStep('language')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              step === 'language'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">translate</span>
            <span>1. {getTranslation(selectedLanguage, 'selectLanguage')}</span>
          </button>

          <button
            onClick={() => setStep('role')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              step === 'role'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">badge</span>
            <span>2. {getTranslation(selectedLanguage, 'roleSelectionTitle')}</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {step === 'language' ? (
            <div className="space-y-4">
              {/* Voice Language Button */}
              <div className="text-center">
                <button
                  id="voice-detect-lang-btn"
                  onClick={handleVoiceDetectLanguage}
                  className={`w-full py-3.5 px-4 rounded-xl border flex items-center justify-center gap-3 transition-all ${
                    isListeningForLang
                      ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse ring-4 ring-rose-500/30'
                      : 'bg-gradient-to-r from-teal-600/30 to-sky-600/30 border-teal-500/50 hover:border-teal-400 text-teal-200 shadow-md'
                  }`}
                >
                  <span className={`material-symbols-outlined text-[24px] ${isListeningForLang ? 'animate-bounce text-rose-400' : 'text-teal-300'}`}>
                    mic
                  </span>
                  <span className="text-sm font-bold tracking-wide">
                    {isListeningForLang
                      ? 'सुन रहे हैं... बोलें...'
                      : getTranslation(selectedLanguage, 'voiceLangPrompt')}
                  </span>
                </button>
                {voiceHint && <p className="text-xs text-amber-300 mt-2 font-medium">{voiceHint}</p>}
              </div>

              {/* Grid of 9 Languages with large accessible cards */}
              <div className="grid grid-cols-3 gap-2.5 pt-2">
                {SUPPORTED_LANGUAGES.map((lang) => {
                  const isSelected = selectedLanguage === lang.code;
                  return (
                    <button
                      key={lang.code}
                      id={`lang-select-${lang.code}`}
                      onClick={() => handleLanguagePick(lang.code)}
                      className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                        isSelected
                          ? 'bg-teal-500/20 border-teal-400 text-white ring-2 ring-teal-400/50 shadow-md'
                          : 'bg-slate-800/80 border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white'
                      }`}
                    >
                      <span className="text-lg">{lang.flag}</span>
                      <span className="text-sm font-bold">{lang.native}</span>
                      <span className="text-[10px] text-slate-400 uppercase font-mono">{lang.name}</span>
                    </button>
                  );
                })}
              </div>

              <div className="pt-3">
                <button
                  id="confirm-lang-btn"
                  onClick={() => setStep('role')}
                  className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all"
                >
                  <span>Continue to Role Selection</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <h3 className="text-base font-bold text-white">
                  {getTranslation(selectedLanguage, 'roleSelectionTitle')}
                </h3>
                <p className="text-xs text-slate-400">
                  {getTranslation(selectedLanguage, 'roleSelectionSub')}
                </p>
              </div>

              {/* 3 Primary Role Cards */}
              <div className="space-y-3">
                {/* 1. Patient / Villager */}
                <button
                  id="role-patient-btn"
                  onClick={() => handleRolePick('patient')}
                  className={`w-full p-4 rounded-xl border text-left transition-all flex items-center gap-4 ${
                    selectedRole === 'patient'
                      ? 'bg-teal-500/20 border-teal-400 ring-2 ring-teal-400/40 shadow-lg'
                      : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-300 shrink-0">
                    <span className="material-symbols-outlined text-[28px]">person</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white">
                        {getTranslation(selectedLanguage, 'rolePatient')}
                      </h4>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-700/50">
                        Voice-First
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Check vitals, speak symptoms for AI triage, consult on-call doctors, and access ABHA health records.
                    </p>
                  </div>
                </button>

                {/* 2. ASHA / ANM Worker */}
                <button
                  id="role-asha-btn"
                  onClick={() => handleRolePick('asha')}
                  className={`w-full p-4 rounded-xl border text-left transition-all flex items-center gap-4 ${
                    selectedRole === 'asha'
                      ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/40 shadow-lg'
                      : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0">
                    <span className="material-symbols-outlined text-[28px]">diversity_1</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white">
                        {getTranslation(selectedLanguage, 'roleAsha')}
                      </h4>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700/50">
                        Field Mode
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Village patient registry, antenatal (ANC) tracking, camp vitals capture, offline sync queue, and PHC referrals.
                    </p>
                  </div>
                </button>

                {/* 3. Doctor / PHC Officer */}
                <button
                  id="role-doctor-btn"
                  onClick={() => handleRolePick('doctor')}
                  className={`w-full p-4 rounded-xl border text-left transition-all flex items-center gap-4 ${
                    selectedRole === 'doctor'
                      ? 'bg-sky-500/20 border-sky-400 ring-2 ring-sky-400/40 shadow-lg'
                      : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-300 shrink-0">
                    <span className="material-symbols-outlined text-[28px]">stethoscope</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white">
                        {getTranslation(selectedLanguage, 'roleDoctor')}
                      </h4>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-700/50">
                        Clinical
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Teleconsultation waiting queue, incoming live calls, AI triage summary preview, and ABDM digital e-Prescriptions.
                    </p>
                  </div>
                </button>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  onClick={() => setStep('language')}
                  className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider"
                >
                  Back
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg"
                >
                  <span>Enter ArogyaConnect</span>
                  <span className="material-symbols-outlined text-[16px]">check</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
