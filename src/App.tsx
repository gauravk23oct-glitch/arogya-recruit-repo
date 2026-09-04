import React, { useState, useEffect, useCallback } from 'react';
import {
  VitalsData,
  PatientProfile,
  Doctor,
  AIAnalysisResult,
  TabType,
  Prescription,
  LanguageCode,
  UserRole,
  AshaPatient,
} from './types';
import { TopAppBar } from './components/TopAppBar';
import { BottomNavBar } from './components/BottomNavBar';
import { VitalsScreen } from './components/VitalsScreen';
import { HomeScreen } from './components/HomeScreen';
import { ConsultScreen } from './components/ConsultScreen';
import { RecordsScreen } from './components/RecordsScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { VoiceTriageScreen } from './components/VoiceTriageScreen';
import { AshaDashboard } from './components/AshaDashboard';
import { DoctorPortal } from './components/DoctorPortal';
import { SplashLanguageModal } from './components/SplashLanguageModal';
import { MeasurementModal } from './components/MeasurementModal';
import { EmergencyModal } from './components/EmergencyModal';
import { PrescriptionModal } from './components/PrescriptionModal';
import { RecordDetailModal } from './components/RecordDetailModal';
import { WebSocketPanelModal } from './components/WebSocketPanelModal';
import { PatientRegistrationModal } from './components/PatientRegistrationModal';
import { useKioskWebSocket, LiveStreamTick } from './services/kioskSocket';
import { speakText, stopSpeaking } from './utils/speech';

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('home');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'measuring' | 'saving'>('synced');
  const [selectedRole, setSelectedRole] = useState<UserRole>('patient');
  const [language, setLanguage] = useState<LanguageCode>('hi');

  // Modals State
  const [isSplashOpen, setIsSplashOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPatientRegistrationOpen, setIsPatientRegistrationOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'kiosk-scan' | 'manual-edit'>('kiosk-scan');
  const [isEmergencyOpen, setIsEmergencyOpen] = useState(false);
  const [isWsModalOpen, setIsWsModalOpen] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<VitalsData | null>(null);

  // Initial Vitals State
  const [vitals, setVitals] = useState<VitalsData>({
    id: 'vitals-live',
    timestamp: new Date().toISOString(),
    bloodPressure: {
      systolic: 120,
      diastolic: 80,
      unit: 'mmHg',
      status: 'Normal',
    },
    bloodSugar: {
      value: 110,
      unit: 'mg/dL',
      type: 'Fasting',
      status: 'Normal',
    },
    spO2: {
      value: 98,
      unit: '%',
      status: 'Good',
    },
    temperature: {
      value: 98.6,
      unit: '°F',
      status: 'Normal',
    },
    heartRate: {
      value: 72,
      unit: 'BPM',
      status: 'Normal',
    },
    notes: 'Kiosk sensor measurement accurate',
    location: 'Arogya Community Health Center #4 - Pipariya',
  });

  const [records, setRecords] = useState<VitalsData[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patient, setPatient] = useState<PatientProfile>({
    name: 'Ramesh Kumar Sharma',
    abhaId: '91-4820-1928-3921',
    age: 48,
    gender: 'Male',
    bloodGroup: 'B+',
    phone: '+91 98765 43210',
    emergencyContact: '+91 98123 45678 (Spouse - Sunita)',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDB9EP28IpcWeVA7u5JLDE3Z2NZUmmkRWz9Lo7FpJIDhxAiFVCCe4W2mn3VGrS15NzS3ve_R1CY6LFkA52FwlPSG7menq1bCMjJA2M0-mbE_EQI9jP3C7GekW2cSSzjeeTYplPYVGI53ZfHvyUaO5J-ZmZQidCeVkEwIRZyynUknnOXqoixF7zTq2iua_0SHIj9otla-Ce5Y6pzqJQuPzCXCaTAVwkti5zRVcIVnJsEuHMQq0Gwghzknw',
    preferredLanguage: 'hi',
    voiceGuidanceEnabled: true,
    kioskLocation: 'Arogya Rural Kiosk - Pipariya Kalan',
    location: 'Pipariya Kalan, Ward 4',
  });

  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // WebSocket Live Sync Integration
  const handleVitalsFromWs = useCallback((newVitals: VitalsData, newRecord?: VitalsData) => {
    setVitals(newVitals);
    if (newRecord) {
      setRecords((prev) => [newRecord, ...prev.filter((r) => r.id !== newRecord.id)]);
    }
  }, []);

  const handleRecordsFromWs = useCallback((newRecords: VitalsData[]) => {
    setRecords(newRecords);
  }, []);

  const handleProfileFromWs = useCallback((newProfile: PatientProfile) => {
    setPatient(newProfile);
  }, []);

  const handleEmergencyFromWs = useCallback((data: any) => {
    showToast(`⚠️ [WS BROADCAST] 108 SOS Alert Triggered on ${data.kioskId || 'Kiosk'}`);
  }, [showToast]);

  const handleLiveTick = useCallback((tick: LiveStreamTick) => {
    setVitals((prev) => ({
      ...prev,
      heartRate: {
        ...prev.heartRate,
        value: tick.heartRate,
      },
      spO2: {
        ...prev.spO2,
        value: tick.spO2,
      },
    }));
  }, []);

  const {
    status: wsStatus,
    latencyMs,
    activeClients,
    isStreaming,
    transportMode,
    frameLogs,
    lastTick,
    serverUrl: wsServerUrl,
    kioskNodeId: wsNodeId,
    toggleStream,
    triggerScan: triggerWsScan,
    triggerEmergency: triggerWsEmergency,
    clearLogs: clearWsLogs,
    reconnect: reconnectWs,
    disconnect: disconnectWs,
  } = useKioskWebSocket({
    onVitalsUpdated: handleVitalsFromWs,
    onRecordsUpdated: handleRecordsFromWs,
    onProfileUpdated: handleProfileFromWs,
    onEmergencyAlert: handleEmergencyFromWs,
    onLiveTick: handleLiveTick,
  });

  // Fetch initial REST data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [vitalsRes, recordsRes, doctorsRes, profileRes] = await Promise.all([
          fetch('/api/vitals/current').catch(() => null),
          fetch('/api/records').catch(() => null),
          fetch('/api/doctors').catch(() => null),
          fetch('/api/profile').catch(() => null),
        ]);

        if (vitalsRes && vitalsRes.ok) {
          const data = await vitalsRes.json();
          if (data.data) setVitals(data.data);
        }

        if (recordsRes && recordsRes.ok) {
          const data = await recordsRes.json();
          if (data.data) setRecords(data.data);
        }

        if (doctorsRes && doctorsRes.ok) {
          const data = await doctorsRes.json();
          if (data.data) setDoctors(data.data);
        }

        if (profileRes && profileRes.ok) {
          const data = await profileRes.json();
          if (data.data) {
            setPatient(data.data);
            if (data.data.preferredLanguage) {
              setLanguage(data.data.preferredLanguage);
            }
          }
        }
      } catch (err) {
        console.warn('Backend API connecting...', err);
      }
    };

    fetchData();
  }, []);

  // Language Change handler
  const handleSelectLanguage = (newLang: LanguageCode) => {
    setLanguage(newLang);
    setPatient((prev) => ({ ...prev, preferredLanguage: newLang }));
    try {
      fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredLanguage: newLang }),
      });
    } catch {}
    showToast(`Language updated to ${newLang.toUpperCase()}`);
  };

  // Role Change handler
  const handleSelectRole = (newRole: UserRole) => {
    setSelectedRole(newRole);
    if (newRole === 'patient') {
      setCurrentTab('home');
    }
  };

  // Measure Again - Opens Kiosk Scan Modal
  const handleMeasureAgain = () => {
    setModalMode('kiosk-scan');
    setIsModalOpen(true);
  };

  // Open Manual Edit modal
  const handleOpenManualEdit = () => {
    setModalMode('manual-edit');
    setIsModalOpen(true);
  };

  // Modal Complete handler
  const handleModalComplete = async (newValues: Partial<VitalsData>) => {
    setSyncStatus('measuring');
    const updated = {
      ...vitals,
      ...newValues,
      id: `vitals-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };

    setVitals(updated);
    setAiAnalysis(null);

    try {
      await fetch('/api/vitals/measure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch (e) {
      console.error(e);
    }

    setSyncStatus('synced');
    showToast('✓ Vitals measurement updated and synchronized across all nodes!');
  };

  // Save to Records
  const handleSaveToRecords = async () => {
    setSyncStatus('saving');
    try {
      const res = await fetch('/api/vitals/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vitals),
      });
      const data = await res.json();

      if (data.success) {
        setRecords((prev) => [data.data, ...prev.filter((r) => r.id !== data.data.id)]);
        showToast('✓ Vitals saved to ABHA Health Records & broadcasted via WebSocket!');
      }
    } catch (err) {
      console.error(err);
      setRecords((prev) => [vitals, ...prev]);
      showToast('✓ Vitals saved to local Health Records!');
    } finally {
      setSyncStatus('synced');
    }
  };

  // AI Vitals Health Analysis
  const handleAnalyzeWithAI = async () => {
    setIsLoadingAI(true);
    try {
      const res = await fetch('/api/ai/analyze-vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vitals,
          language,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAiAnalysis(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingAI(false);
    }
  };

  // Delete Record
  const handleDeleteRecord = async (id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
    try {
      await fetch(`/api/records/${id}`, { method: 'DELETE' });
      showToast('Record removed');
    } catch (e) {
      console.error(e);
    }
  };

  // Update Patient Profile
  const handleUpdatePatient = async (updated: Partial<PatientProfile>) => {
    const newProfile = { ...patient, ...updated };
    setPatient(newProfile);
    try {
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProfile),
      });
      showToast('Profile settings saved');
    } catch (e) {
      console.error(e);
    }
  };

  // ASHA Patient Handlers
  const handleAshaSelectPatientForKiosk = (ashaPat: AshaPatient) => {
    setPatient({
      name: ashaPat.name,
      abhaId: ashaPat.abhaId,
      age: ashaPat.age,
      gender: ashaPat.gender,
      bloodGroup: 'O+',
      phone: ashaPat.phone,
      emergencyContact: '+91 90000 00000',
      avatarUrl: patient.avatarUrl,
      preferredLanguage: language,
      voiceGuidanceEnabled: true,
      kioskLocation: `ASHA Field Camp - ${ashaPat.village}`,
      location: `${ashaPat.village}, ${ashaPat.ward}`,
    });
    setVitals(ashaPat.lastVitals);
    setSelectedRole('patient');
    setCurrentTab('health');
    showToast(`Loaded ${ashaPat.name} into Health Kiosk`);
  };

  const handleAshaVoiceTriage = (ashaPat: AshaPatient) => {
    setPatient({
      name: ashaPat.name,
      abhaId: ashaPat.abhaId,
      age: ashaPat.age,
      gender: ashaPat.gender,
      bloodGroup: 'O+',
      phone: ashaPat.phone,
      emergencyContact: '+91 90000 00000',
      avatarUrl: patient.avatarUrl,
      preferredLanguage: language,
      voiceGuidanceEnabled: true,
      kioskLocation: `ASHA Field Camp - ${ashaPat.village}`,
      location: `${ashaPat.village}, ${ashaPat.ward}`,
    });
    setVitals(ashaPat.lastVitals);
    setSelectedRole('patient');
    setCurrentTab('triage');
    showToast(`Starting Voice Triage for ${ashaPat.name}`);
  };

  return (
    <div id="arogya-connect-app" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-slate-950">
      {/* Top Header */}
      <TopAppBar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        syncStatus={syncStatus}
        language={language}
        selectedRole={selectedRole}
        onOpenLanguageModal={() => setIsSplashOpen(true)}
        onOpenRoleModal={() => setIsSplashOpen(true)}
        onOpenEmergency={() => setIsEmergencyOpen(true)}
        patientName={patient.name}
        avatarUrl={patient.avatarUrl}
        wsStatus={wsStatus}
        latencyMs={latencyMs}
        activeClients={activeClients}
        isStreaming={isStreaming}
        onToggleStream={() => toggleStream()}
        onReconnectWs={reconnectWs}
        onOpenWsInspector={() => setIsWsModalOpen(true)}
        onOpenPatientRegistration={() => setIsPatientRegistrationOpen(true)}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div
          id="app-toast-notification"
          className="fixed top-18 md:top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-2.5 rounded-xl shadow-2xl text-xs font-bold font-mono tracking-wider flex items-center gap-2 border border-teal-500 animate-bounce"
        >
          <span className="material-symbols-outlined text-[18px] text-teal-400">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Content Router based on Role & Tab */}
      <main className="flex-grow pt-[72px] md:pt-[84px] px-4 md:px-8 w-full">
        {selectedRole === 'asha' ? (
          <AshaDashboard
            language={language}
            onSelectPatientForKiosk={handleAshaSelectPatientForKiosk}
            onStartVoiceTriageForPatient={handleAshaVoiceTriage}
            onShowToast={showToast}
            onSwitchRole={handleSelectRole}
          />
        ) : selectedRole === 'doctor' ? (
          <DoctorPortal
            language={language}
            onShowToast={showToast}
            onSwitchRole={handleSelectRole}
          />
        ) : (
          <>
            {currentTab === 'home' && (
              <HomeScreen
                patient={patient}
                latestVitals={vitals}
                language={language}
                onNavigate={setCurrentTab}
                onStartCheckup={() => setCurrentTab('health')}
                onOpenEmergency={() => setIsEmergencyOpen(true)}
                onShowToast={showToast}
                onOpenWsInspector={() => setIsWsModalOpen(true)}
                onOpenLanguageModal={() => setIsSplashOpen(true)}
                onOpenPatientRegistration={() => setIsPatientRegistrationOpen(true)}
              />
            )}

            {currentTab === 'health' && (
              <VitalsScreen
                vitals={vitals}
                onMeasureAgain={handleMeasureAgain}
                onSaveToRecords={handleSaveToRecords}
                onOpenManualEdit={handleOpenManualEdit}
                isMeasuring={syncStatus === 'measuring'}
                isSaving={syncStatus === 'saving'}
                onAnalyzeWithAI={handleAnalyzeWithAI}
                aiAnalysis={aiAnalysis}
                isLoadingAI={isLoadingAI}
                language={language}
                onOpenWsInspector={() => setIsWsModalOpen(true)}
              />
            )}

            {currentTab === 'triage' && (
              <VoiceTriageScreen
                patient={patient}
                vitals={vitals}
                language={language}
                onNavigateToConsult={() => setCurrentTab('consult')}
                onNavigateToVitals={() => setCurrentTab('health')}
                onOpenEmergency={() => setIsEmergencyOpen(true)}
                onShowToast={showToast}
              />
            )}

            {currentTab === 'consult' && (
              <ConsultScreen
                doctors={doctors}
                vitals={vitals}
                patient={patient}
                onViewPrescription={(rx) => setSelectedPrescription(rx)}
                onShowToast={showToast}
                onUpdateLanguage={handleSelectLanguage}
              />
            )}

            {currentTab === 'records' && (
              <RecordsScreen
                records={records}
                patient={patient}
                onDeleteRecord={handleDeleteRecord}
                onSelectRecord={(rec) => setSelectedRecord(rec)}
                onOpenManualEntry={handleOpenManualEdit}
                onShowToast={showToast}
              />
            )}

            {currentTab === 'profile' && (
              <ProfileScreen
                patient={patient}
                onUpdatePatient={handleUpdatePatient}
                onNavigateToVitals={() => setCurrentTab('health')}
              />
            )}
          </>
        )}
      </main>

      {/* Bottom Navigation Bar (Mobile) - Shown for patient role */}
      {selectedRole === 'patient' && (
        <BottomNavBar
          currentTab={currentTab}
          language={language}
          onSelectTab={setCurrentTab}
        />
      )}

      {/* Splash & Language / Role Selector Modal */}
      <SplashLanguageModal
        isOpen={isSplashOpen}
        onClose={() => setIsSplashOpen(false)}
        selectedLanguage={language}
        onSelectLanguage={handleSelectLanguage}
        selectedRole={selectedRole}
        onSelectRole={handleSelectRole}
      />

      {/* Measurement & Manual Calibration Modal */}
      <MeasurementModal
        isOpen={isModalOpen}
        mode={modalMode}
        initialVitals={vitals}
        onClose={() => setIsModalOpen(false)}
        onComplete={handleModalComplete}
      />

      {/* Critical Emergency 108 SOS Modal */}
      <EmergencyModal
        isOpen={isEmergencyOpen}
        onClose={() => setIsEmergencyOpen(false)}
        patient={patient}
        vitals={vitals}
      />

      {/* Digital e-Prescription Modal */}
      <PrescriptionModal
        isOpen={!!selectedPrescription}
        onClose={() => setSelectedPrescription(null)}
        prescription={selectedPrescription}
      />

      {/* Clinical Record Detail Modal */}
      <RecordDetailModal
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        record={selectedRecord}
        patient={patient}
        onShowToast={showToast}
      />

      {/* WebSocket Real-time Telemetry & Diagnostics Modal */}
      <WebSocketPanelModal
        isOpen={isWsModalOpen}
        onClose={() => setIsWsModalOpen(false)}
        status={wsStatus}
        latencyMs={latencyMs}
        activeClients={activeClients}
        isStreaming={isStreaming}
        transportMode={transportMode}
        frameLogs={frameLogs}
        lastTick={lastTick}
        serverUrl={wsServerUrl}
        kioskNodeId={wsNodeId}
        onToggleStream={() => toggleStream()}
        onTriggerScan={triggerWsScan}
        onTriggerEmergency={triggerWsEmergency}
        onReconnect={reconnectWs}
        onDisconnect={disconnectWs}
        onClearLogs={clearWsLogs}
        onShowToast={showToast}
      />

      {/* Real Patient Registration & Details Modal */}
      <PatientRegistrationModal
        isOpen={isPatientRegistrationOpen}
        onClose={() => setIsPatientRegistrationOpen(false)}
        currentPatient={patient}
        onSaved={(updated) => {
          setPatient(updated);
          showToast(`Patient ${updated.name} registered and saved to clinic store.`);
        }}
      />
    </div>
  );
}
