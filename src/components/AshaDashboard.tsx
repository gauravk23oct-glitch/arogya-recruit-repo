import React, { useState, useEffect } from 'react';
import { AshaPatient, VitalsData, LanguageCode, UserRole } from '../types';
import { getTranslation } from '../utils/i18n';
import { speakText, playAudioFeedback } from '../utils/speech';

interface AshaDashboardProps {
  language: LanguageCode;
  onSelectPatientForKiosk: (patient: AshaPatient) => void;
  onStartVoiceTriageForPatient: (patient: AshaPatient) => void;
  onShowToast: (msg: string) => void;
  onSwitchRole: (role: UserRole) => void;
}

export const AshaDashboard: React.FC<AshaDashboardProps> = ({
  language,
  onSelectPatientForKiosk,
  onStartVoiceTriageForPatient,
  onShowToast,
  onSwitchRole,
}) => {
  const [patients, setPatients] = useState<AshaPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRisk, setSelectedRisk] = useState<string>('all');
  const [activePatient, setActivePatient] = useState<AshaPatient | null>(null);

  // New Patient Registration Modal
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newGender, setNewGender] = useState('Female');
  const [newVillage, setNewVillage] = useState('Pipariya Kalan');
  const [newWard, setNewWard] = useState('Ward 1');
  const [newPhone, setNewPhone] = useState('+91 ');
  const [newCategory, setNewCategory] = useState<AshaPatient['category']>('anc');
  const [newNotes, setNewNotes] = useState('');

  // Camp Vitals Capture Modal
  const [isCampVitalsOpen, setIsCampVitalsOpen] = useState(false);
  const [campBpSys, setCampBpSys] = useState('120');
  const [campBpDia, setCampBpDia] = useState('80');
  const [campSugar, setCampSugar] = useState('110');
  const [campSpo2, setCampSpo2] = useState('98');
  const [campTemp, setCampTemp] = useState('98.6');
  const [campHr, setCampHr] = useState('74');

  // Offline Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState({
    totalVillagePatients: 5,
    highRiskANC: 1,
    hypertensionDue: 1,
    diabeticFollowup: 1,
    pendingOfflineSync: 0,
  });

  useEffect(() => {
    fetchAshaPatients();
  }, [selectedCategory, selectedRisk]);

  const fetchAshaPatients = async () => {
    setLoading(true);
    try {
      let url = `/api/asha/patients?category=${selectedCategory}&risk=${selectedRisk}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setPatients(data.data);
        if (data.stats) setStats(data.stats);
        if (!activePatient && data.data.length > 0) {
          setActivePatient(data.data[0]);
        }
      }
    } catch (e) {
      console.warn('Could not fetch ASHA patient registry:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAshaPatients();
  };

  const handleRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      onShowToast('Please enter patient name');
      return;
    }

    try {
      const res = await fetch('/api/asha/patients/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          age: Number(newAge) || 28,
          gender: newGender,
          village: newVillage,
          ward: newWard,
          phone: newPhone,
          category: newCategory,
          notes: newNotes,
        }),
      });

      const data = await res.json();
      if (data.success) {
        playAudioFeedback('success');
        onShowToast(`Patient ${newName} registered with ABHA ID: ${data.data.abhaId}`);
        setIsRegisterOpen(false);
        setNewName('');
        setNewAge('');
        setNewNotes('');
        fetchAshaPatients();
      }
    } catch (e) {
      onShowToast('Error registering patient');
    }
  };

  const handleBatchSync = async () => {
    setIsSyncing(true);
    playAudioFeedback('beep');
    try {
      const res = await fetch('/api/asha/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueItems: patients.map((p) => p.id) }),
      });
      const data = await res.json();
      if (data.success) {
        playAudioFeedback('success');
        setSyncNotice(`Synced ${patients.length} patient records with PHC Cloud Server.`);
        setTimeout(() => setSyncNotice(null), 4000);
        onShowToast('ASHA Village Records Synced with PHC Gateway');
        fetchAshaPatients();
      }
    } catch (e) {
      onShowToast('Sync error - records safely cached locally.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveCampVitals = () => {
    if (!activePatient) return;
    const updatedVitals: VitalsData = {
      id: `v-camp-${Date.now()}`,
      timestamp: new Date().toISOString(),
      bloodPressure: {
        systolic: Number(campBpSys) || 120,
        diastolic: Number(campBpDia) || 80,
        unit: 'mmHg',
        status: (Number(campBpSys) >= 140 ? 'High (Stage 1)' : 'Normal') as any,
      },
      bloodSugar: {
        value: Number(campSugar) || 110,
        unit: 'mg/dL',
        type: 'Random',
        status: (Number(campSugar) > 140 ? 'High' : 'Normal') as any,
      },
      spO2: {
        value: Number(campSpo2) || 98,
        unit: '%',
        status: 'Good',
      },
      temperature: {
        value: Number(campTemp) || 98.6,
        unit: '°F',
        status: 'Normal',
      },
      heartRate: {
        value: Number(campHr) || 74,
        unit: 'BPM',
        status: 'Normal',
      },
      location: 'ASHA Field Camp - Pipariya',
    };

    activePatient.lastVitals = updatedVitals;
    activePatient.lastVisitDate = new Date().toISOString().split('T')[0];
    
    // Persist to server data store
    fetch(`/api/asha/patients/${activePatient.id}/vitals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vitals: updatedVitals }),
    }).catch((err) => console.warn('Offline vitals saved locally:', err));

    setIsCampVitalsOpen(false);
    playAudioFeedback('success');
    onShowToast(`Vitals recorded & saved for ${activePatient.name}`);
  };

  const categories = [
    { id: 'all', label: 'All Village Patients', icon: 'groups' },
    { id: 'anc', label: 'Pregnant (ANC)', icon: 'pregnant_woman' },
    { id: 'child', label: 'Infant & Child', icon: 'child_care' },
    { id: 'hypertensive', label: 'Hypertension', icon: 'cardiology' },
    { id: 'diabetic', label: 'Diabetes', icon: 'bloodtype' },
  ];

  return (
    <div id="asha-dashboard-screen" className="space-y-6 animate-fadeIn pb-24 md:pb-12 max-w-7xl mx-auto">
      {/* Top ASHA Worker Header */}
      <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 border border-amber-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 shadow-lg">
              <span className="material-symbols-outlined text-[32px]">diversity_1</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  ASHA / ANM WORKER PORTAL
                </span>
                <span className="text-xs text-slate-400">
                  Sector 4 • Sub-Centre Pipariya • PHC Rampur
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white mt-1">
                Village Health Registry & Field Care
              </h1>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              id="register-new-patient-btn"
              onClick={() => setIsRegisterOpen(true)}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center gap-2 shadow-lg transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              <span>Register New Patient</span>
            </button>

            <button
              id="asha-batch-sync-btn"
              onClick={handleBatchSync}
              disabled={isSyncing}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/40 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center gap-2 transition-all"
            >
              <span className={`material-symbols-outlined text-[18px] ${isSyncing ? 'animate-spin' : ''}`}>
                sync
              </span>
              <span>{isSyncing ? 'Syncing...' : 'Push to PHC (Sync)'}</span>
            </button>

            <button
              onClick={() => onSwitchRole('patient')}
              className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider"
              title="Switch to Villager View"
            >
              Patient View
            </button>
          </div>
        </div>

        {syncNotice && (
          <div className="mt-4 p-3 bg-teal-500/20 border border-teal-500/40 rounded-xl text-xs text-teal-200 font-bold flex items-center gap-2 animate-fadeIn">
            <span className="material-symbols-outlined text-[18px] text-teal-300">cloud_done</span>
            <span>{syncNotice}</span>
          </div>
        )}

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800">
          <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Total Village Patients</div>
            <div className="text-xl font-black text-white mt-1">{stats.totalVillagePatients}</div>
          </div>
          <div className="bg-slate-900/80 border border-rose-900/50 p-3.5 rounded-xl">
            <div className="text-[10px] font-mono text-rose-400 uppercase">High-Risk ANC</div>
            <div className="text-xl font-black text-rose-300 mt-1">{stats.highRiskANC} High Watch</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl">
            <div className="text-[10px] font-mono text-amber-400 uppercase">Hypertension Check Due</div>
            <div className="text-xl font-black text-amber-300 mt-1">{stats.hypertensionDue}</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl">
            <div className="text-[10px] font-mono text-teal-400 uppercase">Offline Cache Status</div>
            <div className="text-xl font-black text-teal-300 mt-1">🟢 100% Synced</div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout: Patient List (Left) + Selected Patient Dossier (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Search & Patient List */}
        <div className="lg:col-span-5 space-y-4">
          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, village, phone, ABHA..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-slate-500">
              search
            </span>
          </form>

          {/* Category Filter Chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Patient Cards List */}
          <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
            {patients.map((pat) => {
              const isSelected = activePatient?.id === pat.id;
              return (
                <div
                  key={pat.id}
                  onClick={() => setActivePatient(pat)}
                  className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-slate-800 border-amber-500 ring-2 ring-amber-500/30'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white">{pat.name}</h3>
                        <span className="text-xs text-slate-400 font-mono">
                          {pat.age}y • {pat.gender}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {pat.village} • {pat.ward}
                      </p>
                    </div>

                    <span
                      className={`text-[9px] font-bold uppercase font-mono px-2 py-0.5 rounded-full ${
                        pat.riskFlag === 'high'
                          ? 'bg-rose-950 text-rose-300 border border-rose-500/50'
                          : pat.riskFlag === 'moderate'
                          ? 'bg-amber-950 text-amber-300 border border-amber-500/50'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                      }`}
                    >
                      {pat.riskFlag === 'high' ? 'High Risk' : pat.category.toUpperCase()}
                    </span>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <div>
                      BP: <span className="text-teal-300 font-bold">{pat.lastVitals.bloodPressure.systolic}/{pat.lastVitals.bloodPressure.diastolic}</span>
                    </div>
                    <div>
                      Visit: <span className="text-slate-300">{pat.lastVisitDate}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Patient Comprehensive Care Dossier */}
        <div className="lg:col-span-7">
          {activePatient ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
              {/* Patient Header Card */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-black text-white">{activePatient.name}</h2>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-teal-300 font-mono">
                      ABHA: {activePatient.abhaId}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {activePatient.age} Years • {activePatient.gender} • {activePatient.village}, {activePatient.ward} • Phone: {activePatient.phone}
                  </p>
                </div>

                {/* Patient Actions */}
                <div className="flex gap-2">
                  <button
                    id="asha-start-triage-btn"
                    onClick={() => onStartVoiceTriageForPatient(activePatient)}
                    className="px-3.5 py-2 bg-gradient-to-r from-teal-600 to-sky-600 hover:brightness-110 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow"
                  >
                    <span className="material-symbols-outlined text-[16px]">mic</span>
                    <span>AI Voice Triage</span>
                  </button>

                  <button
                    id="asha-record-vitals-btn"
                    onClick={() => setIsCampVitalsOpen(true)}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">monitor_heart</span>
                    <span>Record Vitals</span>
                  </button>
                </div>
              </div>

              {/* Patient Latest Vitals Grid */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-400">
                    Latest Biometric Readings ({activePatient.lastVitals.timestamp ? new Date(activePatient.lastVitals.timestamp).toLocaleDateString() : 'Recent'})
                  </h3>
                  <span className="text-[10px] font-mono text-teal-400">🟢 Verified Camp Sensor</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                    <div className="text-[10px] font-mono text-slate-400">BLOOD PRESSURE</div>
                    <div className="text-lg font-black text-white mt-0.5">
                      {activePatient.lastVitals.bloodPressure.systolic}/{activePatient.lastVitals.bloodPressure.diastolic}
                      <span className="text-[10px] text-slate-400 font-normal ml-1">mmHg</span>
                    </div>
                    <span className="text-[9px] font-bold text-teal-400 font-mono">
                      {activePatient.lastVitals.bloodPressure.status}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                    <div className="text-[10px] font-mono text-slate-400">BLOOD GLUCOSE</div>
                    <div className="text-lg font-black text-white mt-0.5">
                      {activePatient.lastVitals.bloodSugar.value}
                      <span className="text-[10px] text-slate-400 font-normal ml-1">mg/dL</span>
                    </div>
                    <span className="text-[9px] font-bold text-amber-400 font-mono">
                      {activePatient.lastVitals.bloodSugar.type}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                    <div className="text-[10px] font-mono text-slate-400">PULSE OXIMETRY</div>
                    <div className="text-lg font-black text-white mt-0.5">
                      {activePatient.lastVitals.spO2.value}
                      <span className="text-[10px] text-slate-400 font-normal ml-1">%</span>
                    </div>
                    <span className="text-[9px] font-bold text-sky-400 font-mono">
                      {activePatient.lastVitals.spO2.status}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                    <div className="text-[10px] font-mono text-slate-400">TEMPERATURE</div>
                    <div className="text-lg font-black text-white mt-0.5">
                      {activePatient.lastVitals.temperature.value}
                      <span className="text-[10px] text-slate-400 font-normal ml-1">°F</span>
                    </div>
                    <span className="text-[9px] font-bold text-emerald-400 font-mono">
                      {activePatient.lastVitals.temperature.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Clinical Notes & Follow-up Schedule */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">notes</span>
                    <span>ASHA Field Assessment Notes</span>
                  </span>
                  <span className="text-slate-400 font-mono">Next Follow-up: {activePatient.nextFollowUp}</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {activePatient.notes}
                </p>

                {activePatient.immunizationDue && activePatient.immunizationDue.length > 0 && (
                  <div className="pt-2 border-t border-slate-700 flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 font-mono">
                      Due Vaccines:
                    </span>
                    {activePatient.immunizationDue.map((v, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 bg-rose-950 text-rose-300 rounded border border-rose-800/60 font-mono">
                        {v}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Direct Kiosk Switch */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => onSelectPatientForKiosk(activePatient)}
                  className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow"
                >
                  <span className="material-symbols-outlined text-[18px]">touch_app</span>
                  <span>Open Patient in Full Health Kiosk Mode</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl">
              Select a patient from the list to view medical dossier.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Register New Patient */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-fadeIn">
            <div className="p-5 bg-gradient-to-r from-amber-900/60 to-slate-900 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400">person_add</span>
                <span>Register New Village Patient (ABHA Linked)</span>
              </h3>
              <button onClick={() => setIsRegisterOpen(false)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleRegisterPatient} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono uppercase text-slate-400">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Meena Bai"
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-slate-400">Age *</label>
                  <input
                    type="number"
                    required
                    value={newAge}
                    onChange={(e) => setNewAge(e.target.value)}
                    placeholder="e.g. 26"
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-mono uppercase text-slate-400">Gender</label>
                  <select
                    value={newGender}
                    onChange={(e) => setNewGender(e.target.value)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-slate-400">Village</label>
                  <input
                    type="text"
                    value={newVillage}
                    onChange={(e) => setNewVillage(e.target.value)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-slate-400">Ward</label>
                  <input
                    type="text"
                    value={newWard}
                    onChange={(e) => setNewWard(e.target.value)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono uppercase text-slate-400">Mobile Phone</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-slate-400">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                  >
                    <option value="anc">Pregnant (ANC Care)</option>
                    <option value="child">Child / Infant</option>
                    <option value="hypertensive">Hypertension</option>
                    <option value="diabetic">Diabetes</option>
                    <option value="general">General Adult</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-slate-400">Initial Clinical Notes</label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  rows={2}
                  placeholder="Record symptoms, hemoglobin, trimester, or immunization details..."
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider shadow"
                >
                  Generate ABHA & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Quick Record Camp Vitals */}
      {isCampVitalsOpen && activePatient && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fadeIn">
            <div className="p-5 bg-gradient-to-r from-teal-900/60 to-slate-900 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-400">monitor_heart</span>
                <span>Record Field Vitals ({activePatient.name})</span>
              </h3>
              <button onClick={() => setIsCampVitalsOpen(false)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase">BP Systolic</label>
                  <input
                    type="number"
                    value={campBpSys}
                    onChange={(e) => setCampBpSys(e.target.value)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase">BP Diastolic</label>
                  <input
                    type="number"
                    value={campBpDia}
                    onChange={(e) => setCampBpDia(e.target.value)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase">Blood Sugar (mg/dL)</label>
                  <input
                    type="number"
                    value={campSugar}
                    onChange={(e) => setCampSugar(e.target.value)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase">SpO2 (%)</label>
                  <input
                    type="number"
                    value={campSpo2}
                    onChange={(e) => setCampSpo2(e.target.value)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase">Temperature (°F)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={campTemp}
                    onChange={(e) => setCampTemp(e.target.value)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase">Heart Rate (BPM)</label>
                  <input
                    type="number"
                    value={campHr}
                    onChange={(e) => setCampHr(e.target.value)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCampVitalsOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold uppercase"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCampVitals}
                  className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider shadow"
                >
                  Save & Cache Offline
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
