import React, { useState, useEffect, useRef } from 'react';
import { DoctorQueueItem, Doctor, LanguageCode, UserRole } from '../types';
import { getTranslation } from '../utils/i18n';
import { speakText, playAudioFeedback } from '../utils/speech';
import { DoctorRegistrationModal } from './DoctorRegistrationModal';

interface DoctorPortalProps {
  language: LanguageCode;
  onShowToast: (msg: string) => void;
  onSwitchRole: (role: UserRole) => void;
}

export const DoctorPortal: React.FC<DoctorPortalProps> = ({
  language,
  onShowToast,
  onSwitchRole,
}) => {
  const [queue, setQueue] = useState<DoctorQueueItem[]>([]);
  const [activeDoctor, setActiveDoctor] = useState<Doctor | null>(null);
  const [selectedQueueItem, setSelectedQueueItem] = useState<DoctorQueueItem | null>(null);
  const [isInCall, setIsInCall] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [doctorStream, setDoctorStream] = useState<MediaStream | null>(null);
  const doctorCameraRef = useRef<HTMLVideoElement | null>(null);

  // Prescription writer state
  const [diagnosis, setDiagnosis] = useState('Acute Clinical Management & Upper Respiratory Prophylaxis');
  const [clinicalAdvice, setClinicalAdvice] = useState('Rest, drink plenty of warm fluids with ORS, and report back if fever exceeds 101°F.');
  const [followUpDays, setFollowUpDays] = useState(5);
  const [prescribedMeds, setPrescribedMeds] = useState([
    { name: 'Tab. Paracetamol 500mg (Jan Aushadhi Generic)', dosage: '1 Tab', frequency: 'TDS (Thrice Daily)', duration: '3 Days' },
    { name: 'Tab. Cetirizine 10mg', dosage: '1 Tab', frequency: 'HS (Night Bedtime)', duration: '5 Days' },
    { name: 'ORS Hydration Sachet (WHO Formula)', dosage: '1 Sachet in 1L', frequency: 'PRN (As Needed)', duration: '3 Days' },
  ]);

  const genericCatalog = [
    { name: 'Tab. Paracetamol 500mg (Jan Aushadhi)', dosage: '1 Tab', frequency: 'TDS', duration: '3 Days' },
    { name: 'Tab. Amoxicillin 500mg (Jan Aushadhi)', dosage: '1 Tab', frequency: 'BD (Twice Daily)', duration: '5 Days' },
    { name: 'Tab. Telmisartan 40mg (Jan Aushadhi)', dosage: '1 Tab', frequency: 'OD (Once Daily)', duration: '30 Days' },
    { name: 'Tab. Metformin 500mg (Jan Aushadhi)', dosage: '1 Tab', frequency: 'BD (Post Meals)', duration: '30 Days' },
    { name: 'Tab. Iron & Folic Acid (IFA Red)', dosage: '1 Tab', frequency: 'OD (Post Lunch)', duration: '30 Days' },
    { name: 'Syrup Cough Expectorant 100ml', dosage: '10ml', frequency: 'TDS', duration: '5 Days' },
  ];

  useEffect(() => {
    fetchDoctorQueue();
  }, []);

  useEffect(() => {
    let timer: any;
    if (isInCall) {
      timer = setInterval(() => setCallDuration((d) => d + 1), 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(timer);
  }, [isInCall]);

  const fetchDoctorQueue = async () => {
    try {
      const res = await fetch('/api/doctor/queue');
      const data = await res.json();
      if (data.success) {
        setQueue(data.data);
        if (data.activeDoctor) setActiveDoctor(data.activeDoctor);
        if (!selectedQueueItem && data.data.length > 0) {
          setSelectedQueueItem(data.data[0]);
        }
      }
    } catch (e) {
      console.warn('Could not fetch doctor teleconsult queue:', e);
    }
  };

  useEffect(() => {
    if (doctorCameraRef.current && doctorStream) {
      doctorCameraRef.current.srcObject = doctorStream;
    }
  }, [doctorStream, isInCall]);

  const handleStartCall = async (item: DoctorQueueItem) => {
    setSelectedQueueItem(item);
    setIsInCall(true);
    playAudioFeedback('success');
    speakText(`Connecting with ${item.patientName} at ${item.village} Kiosk.`, 'en');

    try {
      if (navigator?.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setDoctorStream(stream);
      }
    } catch (camErr) {
      console.warn('Doctor camera access error:', camErr);
    }
  };

  const handleEndCall = () => {
    if (doctorStream) {
      doctorStream.getTracks().forEach((t) => t.stop());
      setDoctorStream(null);
    }
    setIsInCall(false);
    playAudioFeedback('beep');
    onShowToast('Call ended. You can now issue the digital e-Prescription.');
  };

  const handleAddGenericMed = (med: typeof genericCatalog[0]) => {
    setPrescribedMeds([...prescribedMeds, { ...med }]);
    playAudioFeedback('beep');
  };

  const handleRemoveMed = (index: number) => {
    setPrescribedMeds(prescribedMeds.filter((_, i) => i !== index));
  };

  const handleIssuePrescription = async () => {
    if (!selectedQueueItem) return;
    try {
      const res = await fetch('/api/doctor/prescribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedQueueItem.patientId,
          doctorId: activeDoctor?.id || 'doc-1',
          diagnosis,
          medicines: prescribedMeds,
          advice: clinicalAdvice,
          followUpDays,
        }),
      });

      const data = await res.json();
      if (data.success) {
        playAudioFeedback('success');
        onShowToast(`Digital e-Prescription #${data.data.id} issued & synced to ABHA.`);
        setIsInCall(false);
        fetchDoctorQueue();
      }
    } catch (e) {
      onShowToast('Error issuing prescription');
    }
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div id="doctor-portal-screen" className="space-y-6 animate-fadeIn pb-24 md:pb-12 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-sky-950/70 via-slate-900 to-slate-900 border border-sky-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-sky-500/20 border border-sky-500/40 text-sky-300 flex items-center justify-center shrink-0 shadow-lg">
              <span className="material-symbols-outlined text-[32px]">stethoscope</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40">
                  DOCTOR / PHC TELEMEDICINE CONSOLE
                </span>
                <span className="text-xs text-slate-400">
                  {activeDoctor ? `${activeDoctor.name} (${activeDoctor.specialty}) • Reg: ${activeDoctor.regNumber}` : 'Tele-consult Duty'}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white mt-1">
                Kiosk Teleconsultation Waiting Room
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsRegisterModalOpen(true)}
              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 shadow transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
              <span>+ Register Real Doctor</span>
            </button>
            <button
              onClick={() => onSwitchRole('patient')}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider"
            >
              Villager View
            </button>
            <button
              onClick={() => onSwitchRole('asha')}
              className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold uppercase tracking-wider"
            >
              ASHA View
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Waiting Queue (Left) + Video / Prescription Station (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Waiting Queue */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>Live Patient Queue ({queue.length} Waiting)</span>
            </h2>
            <button
              onClick={fetchDoctorQueue}
              className="text-[11px] font-mono text-sky-400 hover:text-sky-300"
            >
              Refresh
            </button>
          </div>

          <div className="space-y-3">
            {queue.length === 0 ? (
              <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-500 text-xs">
                No patients currently in the live waiting queue.
              </div>
            ) : (
              queue.map((item) => {
                const isSelected = selectedQueueItem?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedQueueItem(item)}
                    className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-slate-800 border-sky-500 ring-2 ring-sky-500/30'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold font-mono px-1.5 py-0.5 bg-sky-950 text-sky-300 rounded border border-sky-800">
                            {item.tokenNumber}
                          </span>
                          <h3 className="text-sm font-bold text-white">{item.patientName}</h3>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {item.patientAge}y • {item.patientGender} • {item.village}
                        </p>
                      </div>

                      <span
                        className={`text-[9px] font-bold uppercase font-mono px-2 py-0.5 rounded-full ${
                          item.triageRisk === 'red'
                            ? 'bg-rose-950 text-rose-300 border border-rose-500'
                            : 'bg-amber-950 text-amber-300 border border-amber-500'
                        }`}
                      >
                        {item.triageRisk === 'red' ? '🔴 RED SOS' : '🟡 PHC TRIAGE'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 mt-2 bg-slate-950/60 p-2 rounded-lg line-clamp-2">
                      {item.symptoms}
                    </p>

                    <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400">Wait: {item.waitingSince}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartCall(item);
                        }}
                        className="px-2.5 py-1 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-lg text-[10px] uppercase tracking-wider flex items-center gap-1 shadow"
                      >
                        <span className="material-symbols-outlined text-[14px]">video_call</span>
                        <span>Start Call</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Teleconsult Stage & e-Prescription Console */}
        <div className="lg:col-span-8 space-y-6">
          {selectedQueueItem ? (
            <div className="space-y-6">
              {/* Call Stage */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                {isInCall ? (
                  <div className="relative bg-slate-950 min-h-[360px] flex flex-col justify-between p-6">
                    {/* Simulated live video stream view */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent pointer-events-none"></div>

                    {/* Patient Video Placeholder */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                      <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-sky-400/50 flex items-center justify-center text-sky-300 text-3xl font-black mb-3 shadow-2xl">
                        {selectedQueueItem.patientName.charAt(0)}
                      </div>
                      <h3 className="text-lg font-bold text-white">
                        {selectedQueueItem.patientName} (Live at {selectedQueueItem.village} Kiosk)
                      </h3>
                      <p className="text-xs text-teal-400 font-mono mt-1">
                        ● Real-time WebRTC 720p • Adaptive 2G/3G Audio Fallback Active
                      </p>
                    </div>

                    {/* Doctor Local Self Video Stream (Picture-in-Picture) */}
                    <div className="absolute top-14 right-4 w-36 h-26 bg-slate-900 rounded-lg border-2 border-sky-500/80 overflow-hidden shadow-2xl z-20">
                      {doctorStream && !isVideoMuted ? (
                        <video
                          ref={doctorCameraRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover transform -scale-x-100"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-slate-400 text-center p-2">
                          <span className="material-symbols-outlined text-[20px]">videocam_off</span>
                          <span className="text-[9px] font-mono mt-0.5">Doctor Cam Muted</span>
                        </div>
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-black/75 text-[9px] text-white font-mono text-center py-0.5">
                        You (Doctor Feed)
                      </div>
                    </div>

                    {/* Top Call Info */}
                    <div className="relative z-10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse"></span>
                        <span className="text-xs font-mono font-bold text-white bg-slate-900/80 px-2 py-1 rounded-lg border border-slate-700">
                          {formatTimer(callDuration)}
                        </span>
                      </div>

                      <div className="bg-slate-900/80 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-mono text-white flex items-center gap-3">
                        <span>BP: <b className="text-teal-400">{selectedQueueItem.vitals.bloodPressure.systolic}/{selectedQueueItem.vitals.bloodPressure.diastolic}</b></span>
                        <span>SpO2: <b className="text-sky-400">{selectedQueueItem.vitals.spO2.value}%</b></span>
                        <span>Pulse: <b className="text-amber-400">{selectedQueueItem.vitals.heartRate?.value || 74} BPM</b></span>
                      </div>
                    </div>

                    {/* Bottom Call Controls */}
                    <div className="relative z-10 flex items-center justify-center gap-4 pt-4">
                      <button
                        onClick={() => setIsAudioMuted(!isAudioMuted)}
                        className={`w-12 h-12 rounded-full flex items-center justify-center text-white border transition-all ${
                          isAudioMuted ? 'bg-rose-600 border-rose-500' : 'bg-slate-800 border-slate-600 hover:bg-slate-700'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[22px]">
                          {isAudioMuted ? 'mic_off' : 'mic'}
                        </span>
                      </button>

                      <button
                        onClick={() => setIsVideoMuted(!isVideoMuted)}
                        className={`w-12 h-12 rounded-full flex items-center justify-center text-white border transition-all ${
                          isVideoMuted ? 'bg-rose-600 border-rose-500' : 'bg-slate-800 border-slate-600 hover:bg-slate-700'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[22px]">
                          {isVideoMuted ? 'videocam_off' : 'videocam'}
                        </span>
                      </button>

                      <button
                        id="end-teleconsult-call-btn"
                        onClick={handleEndCall}
                        className="px-6 h-12 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-xl shadow-rose-900/50"
                      >
                        <span className="material-symbols-outlined text-[20px]">call_end</span>
                        <span>End Consultation</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold px-2 py-0.5 bg-sky-950 text-sky-300 rounded border border-sky-800">
                            {selectedQueueItem.tokenNumber}
                          </span>
                          <h2 className="text-xl font-black text-white">{selectedQueueItem.patientName}</h2>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          ABHA: {selectedQueueItem.abhaId} • {selectedQueueItem.patientAge}y • {selectedQueueItem.village}
                        </p>
                      </div>

                      <button
                        id="doctor-connect-call-btn"
                        onClick={() => handleStartCall(selectedQueueItem)}
                        className="px-5 py-3 bg-gradient-to-r from-teal-600 to-sky-600 hover:brightness-110 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg"
                      >
                        <span className="material-symbols-outlined text-[20px]">video_camera_front</span>
                        <span>Start Video Consult Now</span>
                      </button>
                    </div>

                    {/* Pre-Screened AI Triage Summary */}
                    <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="text-xs font-bold font-mono text-teal-400 uppercase mb-1 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px]">psychology</span>
                        <span>AI Pre-Consultation Triage Notes</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {selectedQueueItem.symptoms}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* ABDM Electronic Prescription (e-Rx) Station */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-teal-400">receipt_long</span>
                    <h3 className="text-base font-bold text-white">
                      Digital e-Prescription (ABDM Compliant)
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-teal-300">Jan Aushadhi Generic Link Active</span>
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase text-slate-400">Diagnosis & Clinical Impression</label>
                  <input
                    type="text"
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                  />
                </div>

                {/* Prescribed Medicines List */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-mono uppercase text-slate-400">Prescribed Generic Medicines</label>
                    <span className="text-[10px] text-slate-400 font-mono">1-Tap add from catalog below</span>
                  </div>

                  <div className="space-y-2">
                    {prescribedMeds.map((med, idx) => (
                      <div key={idx} className="p-3 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-white">{med.name}</div>
                          <div className="text-slate-400 font-mono text-[11px] mt-0.5">
                            {med.dosage} • {med.frequency} • {med.duration}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveMed(idx)}
                          className="text-rose-400 hover:text-rose-300 p-1"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Jan Aushadhi Quick Add Chips */}
                <div>
                  <div className="text-[10px] font-mono uppercase text-slate-400 mb-2">Jan Aushadhi Generic Formulary:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {genericCatalog.map((gen, i) => (
                      <button
                        key={i}
                        onClick={() => handleAddGenericMed(gen)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-teal-300 hover:text-white rounded-lg text-[10px] font-mono transition-all flex items-center gap-1"
                      >
                        <span>+ {gen.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase text-slate-400">Doctor Advice & Precautions</label>
                  <textarea
                    value={clinicalAdvice}
                    onChange={(e) => setClinicalAdvice(e.target.value)}
                    rows={2}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <div className="text-xs text-slate-400 font-mono">
                    Digitally signs with ABDM Key of {activeDoctor?.name || 'Duty Medical Officer'}
                  </div>

                  <button
                    id="doctor-issue-rx-btn"
                    onClick={handleIssuePrescription}
                    className="px-6 py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg"
                  >
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                    <span>Digitally Sign & Issue e-Rx</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl">
              Select a patient from the waiting queue to begin teleconsultation.
            </div>
          )}
        </div>
      </div>

      {/* Doctor Registration / Edit Modal */}
      <DoctorRegistrationModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onSaved={(newDoc) => {
          setActiveDoctor(newDoc);
          fetchDoctorQueue();
          onShowToast(`Doctor ${newDoc.name} registered as active clinic physician.`);
        }}
      />
    </div>
  );
};
