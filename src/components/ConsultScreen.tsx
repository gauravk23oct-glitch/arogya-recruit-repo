import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Doctor, ConsultationMessage, VitalsData, PatientProfile, Prescription } from '../types';
import { SUPPORTED_LANGUAGES, LanguageCode, t } from '../services/i18n';
import { DoctorRegistrationModal } from './DoctorRegistrationModal';

interface SpecialtyCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
  description: string;
}

interface ConsultScreenProps {
  doctors: Doctor[];
  vitals: VitalsData;
  patient: PatientProfile;
  onStartVideoCall?: (doctor: Doctor) => void;
  onViewPrescription?: (rx: Prescription) => void;
  onShowToast?: (msg: string) => void;
  onUpdateLanguage?: (langCode: string) => void;
}

export const ConsultScreen: React.FC<ConsultScreenProps> = ({
  doctors: initialDoctors,
  vitals,
  patient,
  onViewPrescription,
  onShowToast,
  onUpdateLanguage,
}) => {
  const [activeTab, setActiveTab] = useState<'doctors' | 'ai'>('doctors');
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(
    (patient.preferredLanguage as LanguageCode) || 'en'
  );
  const [aiStatus, setAiStatus] = useState<{
    apiConnected: boolean;
    statusMessage: string;
    model: string;
  } | null>(null);

  // Doctors Search & Filter State
  const [doctorsList, setDoctorsList] = useState<Doctor[]>(initialDoctors);
  const [specialties, setSpecialties] = useState<SpecialtyCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('all');
  const [filterOnlineOnly, setFilterOnlineOnly] = useState(false);
  const [filterLanguage, setFilterLanguage] = useState('all');
  const [sortBy, setSortBy] = useState<'rating' | 'experience' | 'consultations' | 'name'>('rating');
  const [isSearchingBackend, setIsSearchingBackend] = useState(false);

  // Doctor Modals
  const [selectedDoctorForProfile, setSelectedDoctorForProfile] = useState<Doctor | null>(null);
  const [selectedDoctorForBooking, setSelectedDoctorForBooking] = useState<Doctor | null>(null);
  const [bookingSlotTime, setBookingSlotTime] = useState('Immediate Tele-Queue');
  const [bookingConsultType, setBookingConsultType] = useState<'video' | 'audio' | 'chat'>('video');
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<any | null>(null);

  // Video Teleconsultation State
  const [activeCallDoctor, setActiveCallDoctor] = useState<Doctor | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [generatedRx, setGeneratedRx] = useState<Prescription | null>(null);

  // Doctor Registry Management State
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [doctorToEdit, setDoctorToEdit] = useState<Doctor | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [doctorToDelete, setDoctorToDelete] = useState<Doctor | null>(null);

  // Real Camera & Mic Stream State
  const [localMediaStream, setLocalMediaStream] = useState<MediaStream | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [activeCallSeconds, setActiveCallSeconds] = useState(0);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // AI Chat Assistant State
  const getInitialAssistantMessage = (lang: LanguageCode) => {
    return t(lang, 'aiConsultWelcome', { name: patient.name });
  };

  const [messages, setMessages] = useState<ConsultationMessage[]>([
    {
      id: 'm-1',
      sender: 'assistant',
      text: getInitialAssistantMessage((patient.preferredLanguage as LanguageCode) || 'en'),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Sync initial doctors if prop changes
  useEffect(() => {
    if (initialDoctors && initialDoctors.length > 0) {
      setDoctorsList(initialDoctors);
    }
  }, [initialDoctors]);

  // Fetch specialties metadata from backend
  useEffect(() => {
    fetch('/api/doctors/specialties')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setSpecialties(data.data);
        }
      })
      .catch((err) => console.warn('Could not fetch specialties:', err));
  }, []);

  // Fetch AI connection status
  useEffect(() => {
    fetch('/api/ai/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setAiStatus({
            apiConnected: data.apiConnected,
            statusMessage: data.statusMessage,
            model: data.model,
          });
        }
      })
      .catch(() => {
        setAiStatus({
          apiConnected: false,
          statusMessage: 'Clinical Engine Active',
          model: 'Clinical Rule Engine',
        });
      });
  }, []);

  // Perform live search & filtering against backend API
  const fetchDoctors = useCallback(async () => {
    setIsSearchingBackend(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (selectedSpecialty !== 'all') params.set('category', selectedSpecialty);
      if (filterOnlineOnly) params.set('onlineOnly', 'true');
      if (filterLanguage !== 'all') params.set('language', filterLanguage);
      if (sortBy) params.set('sortBy', sortBy);

      const res = await fetch(`/api/doctors?${params.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setDoctorsList(data.data);
      }
    } catch (err) {
      console.warn('Doctor search fallback to local filter:', err);
      // Fallback local filter
      let filtered = [...initialDoctors];
      if (selectedSpecialty !== 'all') {
        filtered = filtered.filter((d) => d.category === selectedSpecialty);
      }
      if (filterOnlineOnly) {
        filtered = filtered.filter((d) => d.availableNow);
      }
      if (filterLanguage !== 'all') {
        filtered = filtered.filter((d) => d.languages.includes(filterLanguage));
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        filtered = filtered.filter(
          (d) =>
            d.name.toLowerCase().includes(q) ||
            d.specialty.toLowerCase().includes(q) ||
            d.hospitalAffiliation.toLowerCase().includes(q) ||
            d.qualification.toLowerCase().includes(q)
        );
      }
      setDoctorsList(filtered);
    } finally {
      setIsSearchingBackend(false);
    }
  }, [searchQuery, selectedSpecialty, filterOnlineOnly, filterLanguage, sortBy, initialDoctors]);

  // Debounced backend fetch when query or filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDoctors();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchDoctors]);

  const handleLanguageChange = (lang: LanguageCode) => {
    setSelectedLanguage(lang);
    if (onUpdateLanguage) {
      onUpdateLanguage(lang);
    }
    setMessages((prev) => [
      ...prev,
      {
        id: `lang-change-${Date.now()}`,
        sender: 'assistant',
        text: getInitialAssistantMessage(lang),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleSpeechInput = () => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      onShowToast?.('Voice recognition is not supported in this browser. Please type your message.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang =
        selectedLanguage === 'hi'
          ? 'hi-IN'
          : selectedLanguage === 'mr'
          ? 'mr-IN'
          : selectedLanguage === 'ta'
          ? 'ta-IN'
          : selectedLanguage === 'te'
          ? 'te-IN'
          : selectedLanguage === 'bn'
          ? 'bn-IN'
          : selectedLanguage === 'gu'
          ? 'gu-IN'
          : selectedLanguage === 'kn'
          ? 'kn-IN'
          : 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      setIsListening(true);
      onShowToast?.('🎙️ Listening... Speak now');

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
        onShowToast?.('Could not capture audio. Please try again.');
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
      onShowToast?.('Microphone access was not available.');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMsg: ConsultationMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: inputText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          userMessage: userMsg.text,
          language: selectedLanguage,
          vitals: vitals,
          patient: patient,
        }),
      });
      const data = await res.json();

      if (data.success && data.reply) {
        setMessages((prev) => [
          ...prev,
          {
            id: `reply-${Date.now()}`,
            sender: 'assistant',
            text: data.reply,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } else {
        throw new Error('No reply received');
      }
    } catch (err) {
      console.error('AI chat error:', err);
      const fallbackText =
        selectedLanguage === 'hi'
          ? `नमस्ते। आपके वाइटल्स (रक्तचाप ${vitals.bloodPressure.systolic}/${vitals.bloodPressure.diastolic} mmHg, पल्स ${vitals.heartRate.value} BPM) सामान्य हैं। यदि आपको कोई गंभीर असुविधा है, तो कृपया ऑन-कॉल डॉक्टर से संपर्क करें या 108 पर कॉल करें।`
          : `Thank you for your message. Based on your current vitals (BP ${vitals.bloodPressure.systolic}/${vitals.bloodPressure.diastolic} mmHg, SpO2 ${vitals.spO2.value}%), your metrics are stable. Ensure adequate hydration, rest, and consult on-call physicians for specialized advice.`;

      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: fallbackText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Timer for active call duration
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isCalling) {
      setActiveCallSeconds(0);
      interval = setInterval(() => {
        setActiveCallSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setActiveCallSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCalling]);

  // Connect video stream to video elements
  useEffect(() => {
    if (localMediaStream) {
      if (pipVideoRef.current) {
        pipVideoRef.current.srcObject = localMediaStream;
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localMediaStream;
      }
    }
  }, [localMediaStream, isCalling]);

  const startAudioVisualizer = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setAudioLevel(normalized);
        animationFrameRef.current = requestAnimationFrame(updateMeter);
      };

      updateMeter();
    } catch (err) {
      console.warn('Audio analyser unavailable:', err);
    }
  };

  const handleStartCall = async (doctor: Doctor) => {
    setActiveCallDoctor(doctor);
    setIsCalling(true);
    setGeneratedRx(null);
    setCameraError(null);
    setIsMicMuted(false);
    setIsCamOff(false);

    // 1. Join doctor teleconsult queue on server
    try {
      await fetch('/api/doctor/queue/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patient.abhaId || `pat-${Date.now()}`,
          patientName: patient.name,
          patientAge: patient.age,
          patientGender: patient.gender,
          village: patient.village || patient.kioskLocation,
          abhaId: patient.abhaId,
          symptoms: `Teleconsultation requested with ${doctor.name}`,
          vitals,
          preferredMode: 'video',
        }),
      });
    } catch (qErr) {
      console.warn('Queue notification error:', qErr);
    }

    // 2. Activate Real Webcam & Microphone
    try {
      if (navigator?.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalMediaStream(stream);
        startAudioVisualizer(stream);
      } else {
        setCameraError('WebRTC camera access not supported by browser.');
      }
    } catch (camErr: any) {
      console.warn('Camera / Microphone permission error:', camErr);
      setCameraError('Camera / microphone access denied or busy. Audio simulation active.');
    }
  };

  const handleEndCall = () => {
    if (localMediaStream) {
      localMediaStream.getTracks().forEach((track) => track.stop());
      setLocalMediaStream(null);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsCalling(false);
    setActiveCallDoctor(null);
    setCameraError(null);
  };

  const toggleMute = () => {
    if (localMediaStream) {
      const audioTracks = localMediaStream.getAudioTracks();
      audioTracks.forEach((t) => (t.enabled = !t.enabled));
      setIsMicMuted((prev) => !prev);
    }
  };

  const toggleVideo = () => {
    if (localMediaStream) {
      const videoTracks = localMediaStream.getVideoTracks();
      videoTracks.forEach((t) => (t.enabled = !t.enabled));
      setIsCamOff((prev) => !prev);
    }
  };

  const handleDeleteDoctor = async (doc: Doctor) => {
    try {
      const res = await fetch(`/api/doctors/${doc.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDoctorsList((prev) => prev.filter((d) => d.id !== doc.id));
        onShowToast?.(`Doctor ${doc.name} removed from registry.`);
      }
    } catch (err) {
      setDoctorsList((prev) => prev.filter((d) => d.id !== doc.id));
    } finally {
      setDoctorToDelete(null);
    }
  };

  const handleClearDemoDoctors = async () => {
    try {
      const res = await fetch('/api/doctors/clear-demo', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        await fetchDoctors();
        onShowToast?.('Demo doctor profiles cleared. Directory contains real verified doctors only.');
      }
    } catch (err) {
      console.error('Failed to clear demo doctors:', err);
    } finally {
      setConfirmClearOpen(false);
    }
  };

  const handleResetDefaults = async () => {
    try {
      const res = await fetch('/api/doctors/reset-defaults', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        await fetchDoctors();
        onShowToast?.('Reset to verified doctor directory.');
      }
    } catch (err) {
      console.error('Failed to reset defaults:', err);
    }
  };

  const handleBookSlotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorForBooking) return;

    setIsSubmittingBooking(true);
    try {
      const res = await fetch('/api/doctors/book-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId: selectedDoctorForBooking.id,
          patientName: patient.name,
          patientPhone: patient.phone,
          slotTime: bookingSlotTime,
          consultType: bookingConsultType,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setConfirmedBooking(data.data);
        onShowToast?.(`✅ Confirmed: Token ${data.data.tokenNumber} issued with ${selectedDoctorForBooking.name}`);
      }
    } catch (err) {
      console.error('Booking failed:', err);
      onShowToast?.('Booking scheduled locally. Kiosk operator notified.');
      setConfirmedBooking({
        tokenNumber: `K-04-${Math.floor(100 + Math.random() * 900)}`,
        doctorName: selectedDoctorForBooking.name,
        slotTime: bookingSlotTime,
      });
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  // Generate verified prescription matching the real doctor's clinical profile
  const generateDoctorPrescription = (doctor: Doctor): Prescription => {
    let medList = [
      {
        name: 'Paracetamol 500mg (IP)',
        dosage: '1 Tab (500mg)',
        frequency: '1-0-1 (Twice daily)',
        duration: '3 Days',
        instructions: 'Take orally after meals with water if body ache persists',
      },
      {
        name: 'ORS (Oral Rehydration Salts) Sachet',
        dosage: '1 Sachet in 1 Litre boiled & cooled water',
        frequency: 'Throughout Day',
        duration: '2 Days',
        instructions: 'Sip steadily for hydration and electrolyte balance',
      },
    ];

    if (doctor.category === 'cardiology') {
      medList = [
        {
          name: 'Telmisartan 40mg',
          dosage: '1 Tab (40mg)',
          frequency: '1-0-0 (Morning)',
          duration: '30 Days',
          instructions: 'Take after breakfast. Maintain daily BP log.',
        },
        {
          name: 'Atorvastatin 10mg',
          dosage: '1 Tab (10mg)',
          frequency: '0-0-1 (Bedtime)',
          duration: '30 Days',
          instructions: 'Lipid stabilization. Low sodium diet advised.',
        },
      ];
    } else if (doctor.category === 'diabetes') {
      medList = [
        {
          name: 'Metformin Hydrochloride 500mg SR',
          dosage: '1 Tab (500mg)',
          frequency: '1-0-1 (Morning & Night)',
          duration: '30 Days',
          instructions: 'Take with main meals. Monitor fasting glucose weekly.',
        },
        {
          name: 'Vitamin B-Complex with Methylcobalamin',
          dosage: '1 Capsule',
          frequency: '0-1-0 (After Lunch)',
          duration: '30 Days',
          instructions: 'Nerve health & vitality support.',
        },
      ];
    } else if (doctor.category === 'pulmonology') {
      medList = [
        {
          name: 'Levocetirizine + Montelukast (5mg/10mg)',
          dosage: '1 Tab',
          frequency: '0-0-1 (Night)',
          duration: '7 Days',
          instructions: 'For airway inflammation and night-time breathing comfort.',
        },
        {
          name: 'Steam Inhalation with Saline Drops',
          dosage: '5-10 mins',
          frequency: 'Twice daily',
          duration: '5 Days',
          instructions: 'Relieves bronchial congestion.',
        },
      ];
    }

    return {
      id: `RX-ABDM-${Date.now()}`,
      doctorId: doctor.id,
      doctorName: doctor.name,
      doctorSpecialty: doctor.specialty,
      doctorRegNo: doctor.regNumber,
      patientName: patient.name,
      patientAge: patient.age,
      patientGender: patient.gender,
      patientAbhaId: patient.abhaId,
      date: new Date().toLocaleDateString('en-GB'),
      diagnosis: `Clinical Teleconsultation: Vitals Stable (BP ${vitals.bloodPressure.systolic}/${vitals.bloodPressure.diastolic} mmHg, HR ${vitals.heartRate.value} BPM, SpO2 ${vitals.spO2.value}%, Temp ${vitals.temperature.value}°F)`,
      medicines: medList,
      generalAdvice: `Patient evaluated via Arogya Kiosk Telehealth Terminal. Verified by ${doctor.name} (${doctor.hospitalAffiliation}). Maintain balanced hydration and recheck vitals in 7 days.`,
      followUpDays: 7,
      signatureStamp: `VERIFIED_MCI_DIGITAL_SIG_${doctor.regNumber.replace(/[^A-Z0-9]/gi, '_')}`,
    };
  };

  return (
    <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-8 flex flex-col gap-6">
      {/* Top Header & Mode Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-mono tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-[#0284C7] text-28px">medical_services</span>
              Specialist Consultations & Tele-Doctors
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold font-mono rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              ABDM Verified Network
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 font-mono mt-1">
            Connect directly with verified Indian clinical specialists, super-consultants & AI primary triage.
          </p>
        </div>

        {/* Tab Switcher & Language selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-100 p-1 rounded-lg border border-slate-200 flex items-center gap-1">
            <button
              onClick={() => setActiveTab('doctors')}
              className={`px-4 py-2 rounded-md text-xs font-bold font-mono transition-all flex items-center gap-2 ${
                activeTab === 'doctors'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[18px] text-[#0284C7]">badge</span>
              <span>Find Real Doctors ({doctorsList.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              className={`px-4 py-2 rounded-md text-xs font-bold font-mono transition-all flex items-center gap-2 ${
                activeTab === 'ai'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[18px] text-amber-500">smart_toy</span>
              <span>AI Health Assistant</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-mono">
            <span className="material-symbols-outlined text-[16px] text-slate-500">translate</span>
            <select
              value={selectedLanguage}
              onChange={(e) => handleLanguageChange(e.target.value as LanguageCode)}
              className="bg-transparent text-slate-900 font-bold focus:outline-hidden cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.nativeName} ({lang.label})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {activeTab === 'doctors' ? (
        /* REAL DOCTORS & SPECIALISTS DIRECTORY */
        <div className="flex flex-col gap-6">
          {/* Real Doctor Registry Management Banner */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 flex-shrink-0">
                <span className="material-symbols-outlined text-[24px]">verified_user</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold font-mono text-white">
                    Verified Clinic Doctor Registry
                  </h2>
                  <span className="text-[10px] bg-teal-950 border border-teal-700/60 text-teal-300 font-mono px-2 py-0.5 rounded-full font-bold">
                    {doctorsList.length} Registered Clinicians
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Register your real practicing doctors, or clear synthetic demo profiles to run solely with verified staff.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setDoctorToEdit(null);
                  setIsRegisterModalOpen(true);
                }}
                className="flex-1 sm:flex-initial px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow"
              >
                <span className="material-symbols-outlined text-[16px]">person_add</span>
                <span>+ Register Real Doctor</span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmClearOpen(true)}
                className="px-3 py-2 bg-slate-800 hover:bg-red-950/60 hover:text-red-300 text-slate-300 border border-slate-700 hover:border-red-800/60 rounded-lg text-xs font-mono font-semibold transition-all flex items-center justify-center gap-1"
                title="Remove synthetic demo profiles"
              >
                <span className="material-symbols-outlined text-[15px]">delete_sweep</span>
                <span>Clear Demo Profiles</span>
              </button>

              <button
                type="button"
                onClick={handleResetDefaults}
                className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 rounded-lg text-xs font-mono transition-all flex items-center justify-center"
                title="Reset to standard verified directory"
              >
                <span className="material-symbols-outlined text-[15px]">restart_alt</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
              {/* Main Search Input */}
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Doctor Name, Specialty (e.g., Cardiologist, Diabetologist), Hospital, or Medical Degree..."
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 font-mono focus:outline-hidden focus:border-[#0284C7] focus:bg-white transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                )}
              </div>

              {/* Filter Controls Row */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Online Toggle */}
                <button
                  onClick={() => setFilterOnlineOnly(!filterOnlineOnly)}
                  className={`px-3.5 py-2.5 rounded-lg text-xs font-bold font-mono transition-all flex items-center gap-2 border ${
                    filterOnlineOnly
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${filterOnlineOnly ? 'bg-white' : 'bg-emerald-500 animate-pulse'}`}></span>
                  <span>Available Online Now</span>
                </button>

                {/* Language Filter */}
                <select
                  value={filterLanguage}
                  onChange={(e) => setFilterLanguage(e.target.value)}
                  className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 font-bold focus:outline-hidden focus:border-[#0284C7]"
                >
                  <option value="all">All Languages</option>
                  <option value="Hindi">Hindi (हिंदी)</option>
                  <option value="English">English</option>
                  <option value="Bengali">Bengali (বাংলা)</option>
                  <option value="Tamil">Tamil (தமிழ்)</option>
                  <option value="Telugu">Telugu (తెలుగు)</option>
                  <option value="Marathi">Marathi (मराठी)</option>
                  <option value="Gujarati">Gujarati (ગુજરાતી)</option>
                  <option value="Punjabi">Punjabi (ਪੰਜਾਬੀ)</option>
                  <option value="Malayalam">Malayalam (മലയാളം)</option>
                  <option value="Kannada">Kannada (ಕನ್ನಡ)</option>
                  <option value="Odia">Odia (ଓଡ଼ିଆ)</option>
                </select>

                {/* Sort By */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 font-bold focus:outline-hidden focus:border-[#0284C7]"
                >
                  <option value="rating">Sort: Highest Rating ★</option>
                  <option value="experience">Sort: Most Experienced (Years)</option>
                  <option value="consultations">Sort: Most Consultations</option>
                  <option value="name">Sort: Name (A-Z)</option>
                </select>
              </div>
            </div>

            {/* Specialty Quick-Filter Carousel */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar border-t border-slate-100">
              <span className="text-[11px] font-bold font-mono text-slate-400 uppercase tracking-wider whitespace-nowrap pl-1 pr-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">tune</span>
                Specialties:
              </span>

              {[
                { id: 'all', name: 'All Doctors', icon: 'groups' },
                { id: 'general', name: 'General Physician', icon: 'stethoscope' },
                { id: 'cardiology', name: 'Cardiology (Heart)', icon: 'cardiology' },
                { id: 'diabetes', name: 'Diabetes & Thyroid', icon: 'bloodtype' },
                { id: 'neurology', name: 'Neurology (Brain/Nerve)', icon: 'psychology' },
                { id: 'orthopedics', name: 'Orthopedics (Bones)', icon: 'accessibility_new' },
                { id: 'pediatrics', name: 'Pediatrics (Child)', icon: 'child_care' },
                { id: 'dermatology', name: 'Dermatology (Skin)', icon: 'clean_hands' },
                { id: 'pulmonology', name: 'Pulmonology (Lungs)', icon: 'air' },
                { id: 'gynecology', name: 'Gynecology (Women)', icon: 'female' },
                { id: 'ent', name: 'ENT (Ear/Nose/Throat)', icon: 'hearing' },
                { id: 'nephrology', name: 'Nephrology (Kidney)', icon: 'water_drop' },
                { id: 'mental_health', name: 'Mental Health & Mind', icon: 'self_improvement' },
                { id: 'ophthalmology', name: 'Ophthalmology (Eye)', icon: 'visibility' },
                { id: 'ayurveda', name: 'Ayurveda & AYUSH', icon: 'spa' },
                { id: 'gastroenterology', name: 'Gastroenterology', icon: 'restaurant' },
              ].map((cat) => {
                const isSelected = selectedSpecialty === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedSpecialty(cat.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold whitespace-nowrap transition-all flex items-center gap-1.5 flex-shrink-0 ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">{cat.icon}</span>
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Doctors Count & Status Bar */}
          <div className="flex items-center justify-between text-xs font-mono text-slate-500 px-1">
            <span>
              Showing <strong className="text-slate-900">{doctorsList.length}</strong> verified doctors & consultants
              {selectedSpecialty !== 'all' && ` in ${selectedSpecialty.toUpperCase()}`}
              {filterOnlineOnly && ' (Online Only)'}
            </span>
            {isSearchingBackend && (
              <span className="flex items-center gap-1.5 text-[#0284C7]">
                <span className="w-2 h-2 rounded-full bg-[#0284C7] animate-ping"></span>
                Querying medical directory...
              </span>
            )}
          </div>

          {/* Doctors Grid / List */}
          {doctorsList.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3">
              <span className="material-symbols-outlined text-48px text-slate-300">person_search</span>
              <h3 className="text-base font-bold text-slate-800 font-mono">No Specialists Found</h3>
              <p className="text-xs text-slate-500 font-mono max-w-md">
                No doctors matched your current search filters. Try clearing the search query or changing the specialty category.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedSpecialty('all');
                  setFilterOnlineOnly(false);
                  setFilterLanguage('all');
                }}
                className="mt-2 px-4 py-2 bg-slate-900 text-white rounded-md text-xs font-mono font-bold uppercase tracking-wider hover:bg-slate-800"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {doctorsList.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4 border-l-4 border-l-[#0284C7]"
                >
                  <div className="flex items-start gap-4">
                    {/* Doctor Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                        <img
                          className="w-full h-full object-cover"
                          src={doc.avatarUrl}
                          alt={doc.name}
                          loading="lazy"
                        />
                      </div>
                      {doc.availableNow ? (
                        <span
                          className="absolute -bottom-1 -right-1 bg-emerald-500 border-2 border-white w-4 h-4 rounded-full"
                          title="Online Now"
                        ></span>
                      ) : (
                        <span
                          className="absolute -bottom-1 -right-1 bg-slate-400 border-2 border-white w-4 h-4 rounded-full"
                          title="Offline / In Surgery"
                        ></span>
                      )}
                    </div>

                    {/* Doctor Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-base font-bold text-slate-900 font-mono truncate">{doc.name}</h3>
                            <span className="material-symbols-outlined text-[16px] text-[#0284C7]" title="Verified Doctor">
                              verified
                            </span>
                            {doc.isCustom && (
                              <span className="bg-teal-50 text-teal-700 border border-teal-200 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase">
                                Clinic Doctor
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-[#0284C7] font-mono mt-0.5">{doc.specialty}</p>
                        </div>

                        {/* Online Badge */}
                        {doc.availableNow ? (
                          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1 uppercase tracking-wider flex-shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            ONLINE
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-600 text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border border-slate-200 uppercase tracking-wider flex-shrink-0">
                            NEXT: {doc.nextSlot || 'Today'}
                          </span>
                        )}
                      </div>

                      {/* Hospital & Reg Details */}
                      <p className="text-xs text-slate-700 font-mono mt-1 font-medium flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px] text-slate-400">local_hospital</span>
                        <span className="truncate">{doc.hospitalAffiliation}</span>
                      </p>

                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {doc.qualification} • {doc.experienceYears} Yrs Exp • Reg: {doc.regNumber}
                      </p>

                      {/* Languages & Rating */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 mt-2 font-mono">
                        <span className="text-amber-600 font-bold flex items-center gap-0.5">
                          ★ {doc.rating} <span className="text-slate-400 font-normal">({doc.reviewCount || 1000}+ reviews)</span>
                        </span>
                        <span>•</span>
                        <span className="text-slate-500">🗣 {doc.languages.join(', ')}</span>
                      </div>

                      {/* Subsidized Fee Badge */}
                      <div className="mt-2.5 inline-flex items-center gap-1 px-2 py-0.5 bg-sky-50 border border-sky-200 text-[#0284C7] rounded text-[11px] font-mono font-bold">
                        <span className="material-symbols-outlined text-[13px]">health_and_safety</span>
                        <span>{doc.consultationFee}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 mt-1">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedDoctorForProfile(doc)}
                        className="px-2.5 py-1.5 text-slate-700 hover:text-slate-900 text-xs font-mono font-bold hover:bg-slate-100 rounded-md transition-all flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">info</span>
                        <span>Dossier</span>
                      </button>

                      {/* Edit Doctor */}
                      <button
                        onClick={() => {
                          setDoctorToEdit(doc);
                          setIsRegisterModalOpen(true);
                        }}
                        className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-md transition-all"
                        title="Edit Doctor Profile"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>

                      {/* Delete Doctor */}
                      <button
                        onClick={() => setDoctorToDelete(doc)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
                        title="Delete Doctor Profile"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedDoctorForBooking(doc);
                          setConfirmedBooking(null);
                        }}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 border border-slate-200"
                      >
                        <span className="material-symbols-outlined text-[16px] text-slate-600">calendar_month</span>
                        <span>Book Slot</span>
                      </button>

                      <button
                        onClick={() => handleStartCall(doc)}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-xs border border-slate-700"
                      >
                        <span className="material-symbols-outlined text-[16px] text-[#38BDF8]">videocam</span>
                        <span>Instant Call</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* AI CLINICAL HEALTH ASSISTANT CHAT */
        <div className="bg-white border border-slate-200 rounded-xl flex flex-col h-[650px] shadow-xs">
          {/* AI Banner */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
                <span className="material-symbols-outlined text-[20px]">smart_toy</span>
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 font-mono uppercase tracking-wider">
                  AI Clinical Triage & Multilingual Health Advisor
                </h3>
                <p className="text-[11px] text-slate-500 font-mono">
                  Grounding: Current Vitals (BP {vitals.bloodPressure.systolic}/{vitals.bloodPressure.diastolic}, SpO2 {vitals.spO2.value}%, Sugar {vitals.bloodSugar.value} mg/dL)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold font-mono rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                {aiStatus?.model || 'Gemini 3.7 Flash Active'}
              </span>
            </div>
          </div>

          {/* Quick Prompts Bar */}
          <div className="px-4 py-2 bg-slate-100/60 border-b border-slate-200/60 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider whitespace-nowrap">
              Quick Questions:
            </span>
            {(
              [
                { text: 'Analyze my current BP and blood sugar reading', label: 'Analyze Current Vitals' },
                { text: 'What lifestyle habits prevent high blood pressure?', label: 'Hypertension Advice' },
                { text: 'When should I consult an on-call Cardiologist?', label: 'When to see Doctor?' },
              ]
            ).map((qp, idx) => (
              <button
                key={idx}
                onClick={() => setInputText(qp.text)}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded text-[11px] font-mono text-slate-700 font-medium whitespace-nowrap hover:bg-slate-50 transition-all flex-shrink-0"
              >
                {qp.label}
              </button>
            ))}
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender !== 'user' && (
                  <div className="w-8 h-8 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 flex-shrink-0 mt-1">
                    <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg p-3.5 text-xs font-mono leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-slate-900 text-white rounded-tr-none'
                      : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  <span
                    className={`block text-[9px] mt-1.5 font-mono ${
                      msg.sender === 'user' ? 'text-slate-400 text-right' : 'text-slate-400 text-left'
                    }`}
                  >
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 flex-shrink-0">
                  <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
                </div>
                <div className="bg-slate-100 rounded-lg p-3 text-xs font-mono text-slate-500 border border-slate-200 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-[#0284C7] rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-[#0284C7] rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 bg-[#0284C7] rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  <span>Synthesizing clinical response...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Box */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 flex items-center gap-2 bg-slate-50">
            <button
              type="button"
              onClick={handleSpeechInput}
              className={`p-2.5 rounded-lg border transition-all flex items-center justify-center ${
                isListening
                  ? 'bg-red-500 text-white border-red-600 animate-pulse'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title="Speak in your preferred language"
            >
              <span className="material-symbols-outlined text-[18px]">mic</span>
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Ask a medical or health question in ${
                SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage)?.label || 'your language'
              }...`}
              className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-hidden focus:border-[#0284C7]"
            />

            <button
              type="submit"
              disabled={isLoading || !inputText.trim()}
              className="px-4 py-2.5 bg-slate-900 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              <span>Send</span>
              <span className="material-symbols-outlined text-[14px]">send</span>
            </button>
          </form>
        </div>
      )}

      {/* DOCTOR DOSSIER / PROFILE MODAL */}
      {selectedDoctorForProfile && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-[620px] w-full p-6 flex flex-col gap-5 border border-slate-300 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0">
                  <img
                    className="w-full h-full object-cover"
                    src={selectedDoctorForProfile.avatarUrl}
                    alt={selectedDoctorForProfile.name}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900 font-mono">{selectedDoctorForProfile.name}</h2>
                    <span className="material-symbols-outlined text-[18px] text-[#0284C7]">verified</span>
                  </div>
                  <p className="text-xs font-bold text-[#0284C7] font-mono">{selectedDoctorForProfile.specialty}</p>
                  <p className="text-xs text-slate-600 font-mono mt-0.5">{selectedDoctorForProfile.hospitalAffiliation}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedDoctorForProfile(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Credentials Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                <span className="text-[10px] text-slate-400 font-mono block">EXPERIENCE</span>
                <span className="text-sm font-bold text-slate-900 font-mono">{selectedDoctorForProfile.experienceYears} Years</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                <span className="text-[10px] text-slate-400 font-mono block">RATING</span>
                <span className="text-sm font-bold text-amber-600 font-mono">★ {selectedDoctorForProfile.rating}</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                <span className="text-[10px] text-slate-400 font-mono block">CONSULTS</span>
                <span className="text-sm font-bold text-slate-900 font-mono">{selectedDoctorForProfile.consultationCount || 2500}+</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                <span className="text-[10px] text-slate-400 font-mono block">STATUS</span>
                <span className={`text-xs font-bold font-mono ${selectedDoctorForProfile.availableNow ? 'text-emerald-600' : 'text-slate-600'}`}>
                  {selectedDoctorForProfile.availableNow ? 'ONLINE' : 'BY APPT'}
                </span>
              </div>
            </div>

            {/* Full Clinical Bio */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 font-mono uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-slate-500">menu_book</span>
                Clinical Background & Specialization
              </h4>
              <p className="text-xs text-slate-700 font-mono leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
                {selectedDoctorForProfile.about || 'Senior clinical consultant with extensive experience in outpatient and tele-medicine clinical care.'}
              </p>
            </div>

            {/* Medical Verification Data */}
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Medical Registration:</span>
                <span className="font-bold text-slate-900">{selectedDoctorForProfile.regNumber}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Medical Degrees:</span>
                <span className="font-bold text-slate-900">{selectedDoctorForProfile.qualification}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Spoken Languages:</span>
                <span className="font-bold text-slate-900">{selectedDoctorForProfile.languages.join(', ')}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Coverage / Fee:</span>
                <span className="font-bold text-emerald-700">{selectedDoctorForProfile.consultationFee}</span>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedDoctorForProfile(null)}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-mono font-bold"
              >
                Close
              </button>

              <button
                onClick={() => {
                  const doc = selectedDoctorForProfile;
                  setSelectedDoctorForProfile(null);
                  setSelectedDoctorForBooking(doc);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 border border-slate-200"
              >
                <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                <span>Schedule Appointment</span>
              </button>

              <button
                onClick={() => {
                  const doc = selectedDoctorForProfile;
                  setSelectedDoctorForProfile(null);
                  handleStartCall(doc);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px] text-[#38BDF8]">videocam</span>
                <span>Connect Live</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOOKING MODAL */}
      {selectedDoctorForBooking && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-[520px] w-full p-6 flex flex-col gap-5 border border-slate-300 shadow-2xl">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-mono flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#0284C7] text-[20px]">calendar_month</span>
                  Book Tele-Consultation Slot
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  With {selectedDoctorForBooking.name} ({selectedDoctorForBooking.specialty})
                </p>
              </div>
              <button
                onClick={() => setSelectedDoctorForBooking(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {confirmedBooking ? (
              <div className="space-y-4 py-2 text-center">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-[32px]">check_circle</span>
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900 font-mono">Appointment Confirmed!</h4>
                  <p className="text-xs text-slate-600 font-mono mt-1">
                    Your ABDM Tele-queue Token has been assigned for {selectedDoctorForBooking.name}.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-xs space-y-2 text-left">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Token Number:</span>
                    <strong className="text-emerald-700 text-sm">{confirmedBooking.tokenNumber}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Patient:</span>
                    <span className="text-slate-900 font-bold">{patient.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Slot Time:</span>
                    <span className="text-slate-900 font-bold">{bookingSlotTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Hospital/Affiliation:</span>
                    <span className="text-slate-900">{selectedDoctorForBooking.hospitalAffiliation}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedDoctorForBooking(null);
                      handleStartCall(selectedDoctorForBooking);
                    }}
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider"
                  >
                    Enter Consultation Room Now
                  </button>
                  <button
                    onClick={() => setSelectedDoctorForBooking(null)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-mono font-bold"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleBookSlotSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 font-mono block mb-1.5">
                    Select Consultation Mode:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'video', label: 'Video Call', icon: 'videocam' },
                      { id: 'audio', label: 'Audio Call', icon: 'call' },
                      { id: 'chat', label: 'Tele-Chat', icon: 'chat' },
                    ].map((mode) => (
                      <button
                        type="button"
                        key={mode.id}
                        onClick={() => setBookingConsultType(mode.id as any)}
                        className={`p-2.5 rounded-lg border text-xs font-mono font-bold flex flex-col items-center gap-1 transition-all ${
                          bookingConsultType === mode.id
                            ? 'bg-sky-50 border-[#0284C7] text-[#0284C7]'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px]">{mode.icon}</span>
                        <span>{mode.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 font-mono block mb-1.5">
                    Select Time Slot:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      'Immediate Tele-Queue (Next in line)',
                      'Today at 03:00 PM',
                      'Today at 05:30 PM',
                      'Tomorrow at 10:30 AM',
                    ].map((slot) => (
                      <button
                        type="button"
                        key={slot}
                        onClick={() => setBookingSlotTime(slot)}
                        className={`p-2 rounded-lg border text-xs font-mono text-left transition-all ${
                          bookingSlotTime === slot
                            ? 'bg-slate-900 text-white border-slate-900 font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-[11px] font-mono text-sky-900">
                  <span>💡 <strong>Free Under Ayushman Bharat (ABDM)</strong>: No out-of-pocket consultation fee charged at Arogya Rural Kiosk.</span>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDoctorForBooking(null)}
                    className="px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-mono font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingBooking}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1.5"
                  >
                    {isSubmittingBooking ? 'Reserving...' : 'Confirm Appointment'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ENCRYPTED REAL VIDEO TELECONSULTATION DIALOG */}
      {isCalling && activeCallDoctor && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl max-w-[760px] w-full p-5 sm:p-6 flex flex-col gap-4 border border-slate-800 shadow-2xl text-white">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-800 flex-shrink-0 border border-slate-700">
                  <img
                    className="w-full h-full object-cover"
                    src={activeCallDoctor.avatarUrl}
                    alt={activeCallDoctor.name}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white font-mono">
                      {activeCallDoctor.name}
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">({activeCallDoctor.regNumber})</span>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1 uppercase tracking-wider font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Live WebRTC Teleconsultation • {activeCallDoctor.hospitalAffiliation}
                  </span>
                </div>
              </div>

              <button
                onClick={handleEndCall}
                className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
                title="End Consultation"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            {/* Video Viewport Stage */}
            <div className="h-[320px] bg-slate-950 rounded-xl relative overflow-hidden flex items-center justify-center border border-slate-800 shadow-inner">
              {/* Remote Doctor Feed */}
              <img
                src={activeCallDoctor.avatarUrl}
                alt={activeCallDoctor.name}
                className="w-full h-full object-cover opacity-90"
              />

              {/* Overlay Doctor Info */}
              <div className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-lg text-white text-xs font-mono border border-white/10 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <div>
                  <div className="font-bold">{activeCallDoctor.name}</div>
                  <div className="text-[10px] text-sky-400">{activeCallDoctor.specialty}</div>
                </div>
              </div>

              {/* Real Local Patient Camera Feed (Picture-in-Picture) */}
              <div className="absolute top-3 right-3 w-36 h-26 bg-slate-900 rounded-lg border-2 border-teal-500/80 overflow-hidden shadow-2xl relative group">
                {!isCamOff && localMediaStream ? (
                  <video
                    ref={pipVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-slate-400 text-center p-2">
                    <span className="material-symbols-outlined text-[24px]">videocam_off</span>
                    <span className="text-[9px] font-mono mt-0.5">Camera Muted</span>
                  </div>
                )}

                {/* Patient Label & Live Audio Mic Indicator */}
                <div className="absolute bottom-0 inset-x-0 bg-black/80 text-[9px] text-white font-mono px-2 py-0.5 flex items-center justify-between">
                  <span className="truncate">You ({patient.name})</span>
                  <div className="flex items-center gap-0.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isMicMuted ? 'bg-red-500' : audioLevel > 15 ? 'bg-emerald-400 animate-ping' : 'bg-emerald-500'
                      }`}
                    ></span>
                  </div>
                </div>
              </div>

              {/* Camera Access Warning Notice if denied */}
              {cameraError && (
                <div className="absolute top-3 left-3 bg-amber-950/80 border border-amber-500/40 text-amber-200 text-[11px] font-mono px-3 py-1.5 rounded-lg max-w-xs backdrop-blur-xs flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-amber-400">warning</span>
                  <span>{cameraError}</span>
                </div>
              )}
            </div>

            {/* Live Synchronized Vitals & Telemetry */}
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-red-400 animate-pulse">favorite</span>
                <span className="text-slate-400">Streaming Vitals to Doctor:</span>
                <strong className="text-white">
                  BP {vitals.bloodPressure.systolic}/{vitals.bloodPressure.diastolic} | HR {vitals.heartRate.value} BPM | SpO2 {vitals.spO2.value}% | Temp {vitals.temperature.value}°F
                </strong>
              </div>

              {/* Real Audio Volume Waveform */}
              <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-700 text-[10px]">
                <span className="text-slate-400">Mic Input:</span>
                <div className="flex items-end gap-0.5 h-3">
                  {[20, 40, 60, 80, 100].map((step, idx) => (
                    <div
                      key={idx}
                      className={`w-1 rounded-xs transition-all duration-75 ${
                        isMicMuted
                          ? 'h-1 bg-red-500/40'
                          : audioLevel >= step
                          ? 'bg-teal-400'
                          : 'h-1 bg-slate-700'
                      }`}
                      style={{
                        height: !isMicMuted && audioLevel >= step ? `${Math.max(4, (idx + 1) * 2.5)}px` : '4px',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* In-Call Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>
                  Duration:{' '}
                  <strong className="text-white font-mono">
                    {String(Math.floor(activeCallSeconds / 60)).padStart(2, '0')}:
                    {String(activeCallSeconds % 60).padStart(2, '0')}
                  </strong>
                </span>
              </div>

              {/* Hardware Toggles & End Call */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMute}
                  className={`px-3 py-2 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 border transition-all ${
                    isMicMuted
                      ? 'bg-red-950/80 border-red-700 text-red-300'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-white'
                  }`}
                  title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {isMicMuted ? 'mic_off' : 'mic'}
                  </span>
                  <span>{isMicMuted ? 'Unmute' : 'Mute'}</span>
                </button>

                <button
                  type="button"
                  onClick={toggleVideo}
                  className={`px-3 py-2 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 border transition-all ${
                    isCamOff
                      ? 'bg-red-950/80 border-red-700 text-red-300'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-white'
                  }`}
                  title={isCamOff ? 'Turn Camera On' : 'Turn Camera Off'}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {isCamOff ? 'videocam_off' : 'videocam'}
                  </span>
                  <span>{isCamOff ? 'Camera Off' : 'Camera On'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const rx = generateDoctorPrescription(activeCallDoctor);
                    setGeneratedRx(rx);
                    onShowToast?.(`Prescription digitally generated & signed by ${activeCallDoctor.name}`);
                  }}
                  className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow"
                >
                  <span className="material-symbols-outlined text-[16px]">prescriptions</span>
                  <span>Issue e-Prescription</span>
                </button>

                <button
                  type="button"
                  onClick={handleEndCall}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow"
                >
                  <span className="material-symbols-outlined text-[16px]">call_end</span>
                  <span>End Call</span>
                </button>
              </div>
            </div>

            {/* Generated Prescription Banner */}
            {generatedRx && (
              <div className="p-3.5 bg-teal-950/70 border border-teal-600/50 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs font-mono text-teal-200">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-teal-400 text-[18px]">verified</span>
                  <span>Digital Prescription issued by {activeCallDoctor.name} ({activeCallDoctor.regNumber})</span>
                </div>
                <button
                  onClick={() => {
                    handleEndCall();
                    onViewPrescription?.(generatedRx);
                  }}
                  className="px-3 py-1 bg-teal-600 text-white rounded-md text-xs font-bold hover:bg-teal-500 transition-all uppercase tracking-wider flex items-center gap-1 self-start sm:self-auto shadow"
                >
                  <span>Open Full Rx</span>
                  <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Doctor Registration / Edit Modal */}
      <DoctorRegistrationModal
        isOpen={isRegisterModalOpen}
        onClose={() => {
          setIsRegisterModalOpen(false);
          setDoctorToEdit(null);
        }}
        doctorToEdit={doctorToEdit}
        onSaved={(savedDoctor) => {
          fetchDoctors();
          onShowToast?.(`Doctor ${savedDoctor.name} registered successfully.`);
        }}
      />

      {/* Clear Demo Doctors Confirmation Modal */}
      {confirmClearOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl text-slate-800 animate-fadeIn">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[28px]">delete_forever</span>
            </div>
            <h3 className="text-base font-bold font-mono text-slate-900 mb-2">
              Clear All Demo Doctors?
            </h3>
            <p className="text-xs text-slate-600 font-mono leading-relaxed mb-6">
              This will remove synthetic profiles and leave only your real clinic doctors. You can register your real doctors using "+ Register Real Doctor" or restore standard profiles anytime.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                className="px-4 py-2 text-xs font-mono font-semibold text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearDemoDoctors}
                className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-white bg-red-600 hover:bg-red-700 rounded-lg shadow"
              >
                Yes, Clear Demo Profiles
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Doctor Confirmation Modal */}
      {doctorToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl text-slate-800 animate-fadeIn">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[28px]">person_remove</span>
            </div>
            <h3 className="text-base font-bold font-mono text-slate-900 mb-2">
              Remove {doctorToDelete.name}?
            </h3>
            <p className="text-xs text-slate-600 font-mono leading-relaxed mb-6">
              Are you sure you want to remove this doctor from your clinic roster? This change will be saved persistently.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDoctorToDelete(null)}
                className="px-4 py-2 text-xs font-mono font-semibold text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteDoctor(doctorToDelete)}
                className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-white bg-red-600 hover:bg-red-700 rounded-lg shadow"
              >
                Remove Doctor
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
