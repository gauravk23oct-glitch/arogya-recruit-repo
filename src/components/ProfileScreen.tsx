import React, { useState } from 'react';
import { PatientProfile } from '../types';
import { SUPPORTED_LANGUAGES } from '../services/i18n';

interface ProfileScreenProps {
  patient: PatientProfile;
  onUpdatePatient: (updated: Partial<PatientProfile>) => void;
  onNavigateToVitals?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  patient,
  onUpdatePatient,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(patient);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const languages = SUPPORTED_LANGUAGES.map((l) => ({
    code: l.code,
    label: `${l.nativeName} (${l.label})`,
  }));

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdatePatient(formData);
    setIsEditing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <main
      id="profile-screen-main"
      className="flex-grow pt-[72px] md:pt-[84px] pb-[100px] md:pb-[40px] px-4 md:px-8 max-w-[1024px] mx-auto w-full flex flex-col gap-6"
    >
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight font-mono uppercase">
            PATIENT PROFILE & KIOSK
          </h1>
          <p className="text-xs text-slate-500 font-mono uppercase tracking-wider mt-0.5">
            ABHA INTEGRATED DIGITAL HEALTH IDENTITY & REGIONAL NODE PREFERENCES
          </p>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-green-100 text-green-800 rounded-md font-mono font-bold text-xs flex items-center gap-2 uppercase tracking-wider">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          Profile parameters & preferences updated successfully!
        </div>
      )}

      {/* Digital ABHA Card (Geometric Slate / Sky Accent) */}
      <div className="bg-[#0F172A] text-white rounded-lg p-6 shadow-sm border border-[#334155] relative overflow-hidden flex flex-col gap-5">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-md bg-slate-900 border border-slate-700 overflow-hidden flex items-center justify-center">
              <img
                src={patient.avatarUrl}
                alt={patient.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-widest text-[#38BDF8] font-bold font-mono block">
                AYUSHMAN BHARAT DIGITAL MISSION (ABDM)
              </span>
              <h2 className="text-xl font-bold tracking-tight font-mono">{patient.name}</h2>
              <span className="text-xs text-slate-400 font-mono">
                AGE: {patient.age} • GENDER: {patient.gender} • BLOOD: {patient.bloodGroup}
              </span>
            </div>
          </div>

          <div className="bg-slate-900 p-2 rounded-md border border-slate-700 text-white flex flex-col items-center">
            <div className="w-12 h-12 bg-black flex items-center justify-center rounded-sm">
              <span className="material-symbols-outlined text-[#38BDF8] text-[28px]">qr_code_2</span>
            </div>
            <span className="text-[8px] font-bold mt-1 text-slate-400 font-mono uppercase tracking-widest">ABHA QR</span>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs font-mono gap-2">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">ABHA ID / HEALTH NUMBER</span>
            <span className="font-bold text-[#38BDF8] text-sm">{patient.abhaId}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">EMERGENCY HELPLINE</span>
            <span className="font-bold text-white">{patient.emergencyContact}</span>
          </div>
        </div>
      </div>

      {/* Profile Details & Preferences */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 md:p-6 shadow-xs flex flex-col gap-5">
        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-mono flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#0284C7]">settings</span>
            KIOSK PREFERENCES & LOCALIZATION
          </h3>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-xs font-bold font-mono uppercase text-[#0284C7] hover:underline"
          >
            {isEditing ? 'Cancel' : 'Edit Parameters'}
          </button>
        </div>

        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-4 font-mono text-xs">
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">
                Full Legal Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full h-[42px] px-3 border border-slate-200 rounded-md text-xs font-bold text-slate-900 bg-slate-50"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Age
                </label>
                <input
                  type="number"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) })}
                  className="w-full h-[42px] px-3 border border-slate-200 rounded-md text-xs font-bold text-slate-900 bg-slate-50"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Blood Group
                </label>
                <select
                  value={formData.bloodGroup}
                  onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                  className="w-full h-[42px] px-3 border border-slate-200 rounded-md text-xs font-bold text-slate-900 bg-slate-50"
                >
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">
                Preferred Interface Language
              </label>
              <select
                value={formData.preferredLanguage}
                onChange={(e) =>
                  setFormData({ ...formData, preferredLanguage: e.target.value as any })
                }
                className="w-full h-[42px] px-3 border border-slate-200 rounded-md text-xs font-bold text-slate-900 bg-slate-50"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">
                Emergency Contact Number
              </label>
              <input
                type="text"
                value={formData.emergencyContact}
                onChange={(e) =>
                  setFormData({ ...formData, emergencyContact: e.target.value })
                }
                className="w-full h-[42px] px-3 border border-slate-200 rounded-md text-xs text-slate-900 bg-slate-50"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full h-[44px] bg-slate-900 text-white font-mono text-xs font-bold uppercase tracking-wider rounded-md hover:bg-slate-800"
            >
              Commit Profile Changes
            </button>
          </form>
        ) : (
          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-slate-500 uppercase">Selected Localization:</span>
              <span className="font-bold text-slate-900">
                {languages.find((l) => l.code === patient.preferredLanguage)?.label || 'English'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <div>
                <span className="text-slate-900 font-bold block uppercase">
                  Voice Guidance Synthesizer
                </span>
                <span className="text-[11px] text-slate-400 font-sans">
                  Audible biometric feedback in regional vernacular
                </span>
              </div>
              <button
                onClick={() =>
                  onUpdatePatient({
                    voiceGuidanceEnabled: !patient.voiceGuidanceEnabled,
                  })
                }
                className={`w-11 h-6 rounded-full transition-colors relative ${
                  patient.voiceGuidanceEnabled ? 'bg-[#0284C7]' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    patient.voiceGuidanceEnabled ? 'right-1' : 'left-1'
                  }`}
                ></div>
              </button>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-slate-500 uppercase">Current Terminal Node:</span>
              <span className="font-bold text-slate-900">
                {patient.kioskLocation}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Hardware Diagnostic Status */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 md:p-6 shadow-xs flex flex-col gap-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-mono flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-green-600">bluetooth_connected</span>
          CONNECTED KIOSK PERIPHERALS
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md flex flex-col gap-1">
            <span className="font-bold text-slate-900 uppercase">BP Arm Cuff</span>
            <span className="text-green-700 font-bold text-[10px] flex items-center gap-1 uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>
              ONLINE (BT 5.2)
            </span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md flex flex-col gap-1">
            <span className="font-bold text-slate-900 uppercase">Glucometer</span>
            <span className="text-green-700 font-bold text-[10px] flex items-center gap-1 uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>
              STRIP READY
            </span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md flex flex-col gap-1">
            <span className="font-bold text-slate-900 uppercase">Pulse Oximeter</span>
            <span className="text-green-700 font-bold text-[10px] flex items-center gap-1 uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>
              98% CALIBRATED
            </span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md flex flex-col gap-1">
            <span className="font-bold text-slate-900 uppercase">IR Sensor</span>
            <span className="text-green-700 font-bold text-[10px] flex items-center gap-1 uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>
              LASER READY
            </span>
          </div>
        </div>
      </div>
    </main>
  );
};

