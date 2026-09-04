import React, { useState, useEffect } from 'react';
import { PatientProfile, LanguageCode } from '../types';

interface PatientRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: PatientProfile;
  onSave: (updatedProfile: PatientProfile) => void;
  language: LanguageCode;
}

export const PatientRegistrationModal: React.FC<PatientRegistrationModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
  onSave,
  language,
}) => {
  const [formData, setFormData] = useState<PatientProfile>({ ...currentProfile });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData({ ...currentProfile });
      setError(null);
    }
  }, [isOpen, currentProfile]);

  if (!isOpen) return null;

  const handleGenerateAbha = () => {
    const part1 = Math.floor(10 + Math.random() * 89);
    const part2 = Math.floor(1000 + Math.random() * 9000);
    const part3 = Math.floor(1000 + Math.random() * 9000);
    const part4 = Math.floor(1000 + Math.random() * 9000);
    const newAbha = `${part1}-${part2}-${part3}-${part4}`;
    setFormData((prev) => ({ ...prev, abhaId: newAbha }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Please enter patient full name');
      return;
    }
    if (!formData.phone.trim()) {
      setError('Please enter a contact phone number');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to update patient profile on server');
      }

      const resData = await response.json();
      const updated = resData.data || formData;
      onSave(updated);
      onClose();
    } catch (err: any) {
      console.error('Error saving patient profile:', err);
      // Fallback to local save
      onSave(formData);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-fadeIn">
        {/* Modal Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <span className="material-symbols-outlined text-[22px]">badge</span>
            </div>
            <div>
              <h2 className="text-base font-bold font-mono tracking-tight text-white">
                Patient Identity & ABHA Registry
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Enter your real personal medical profile for this kiosk & tele-OPD
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-slate-800">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-mono rounded-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Full Name */}
            <div className="md:col-span-2">
              <label className="block text-xs font-mono font-bold uppercase text-slate-700 mb-1">
                Real Full Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Ramesh Kumar Sharma / Your Name"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-sans focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            {/* ABHA / Health ID */}
            <div className="md:col-span-2">
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-mono font-bold uppercase text-slate-700">
                  Ayushman Bharat Health Account (ABHA ID)
                </label>
                <button
                  type="button"
                  onClick={handleGenerateAbha}
                  className="text-[11px] text-teal-600 hover:text-teal-700 font-mono font-semibold flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">refresh</span>
                  <span>Generate New ABHA</span>
                </button>
              </div>
              <input
                type="text"
                value={formData.abhaId}
                onChange={(e) => setFormData({ ...formData, abhaId: e.target.value })}
                placeholder="e.g. 91-4820-1928-3921"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            {/* Age */}
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-slate-700 mb-1">
                Age (Years) *
              </label>
              <input
                type="number"
                min={1}
                max={120}
                required
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-sans focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            {/* Gender */}
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-slate-700 mb-1">
                Gender *
              </label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-sans focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-slate-700 mb-1">
                Mobile Number *
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            {/* Blood Group */}
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-slate-700 mb-1">
                Blood Group
              </label>
              <select
                value={formData.bloodGroup}
                onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-sans focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>

            {/* Village / City */}
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-slate-700 mb-1">
                Village / City
              </label>
              <input
                type="text"
                value={formData.village || formData.kioskLocation || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    village: e.target.value,
                    kioskLocation: e.target.value || formData.kioskLocation,
                  })
                }
                placeholder="e.g. Pipariya Kalan / Jaipur"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-sans focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            {/* Emergency Contact */}
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-slate-700 mb-1">
                Emergency Contact
              </label>
              <input
                type="text"
                value={formData.emergencyContact}
                onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                placeholder="+91 98123 45678 (Spouse / Kin)"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-sans focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-mono text-slate-600 hover:text-slate-900 rounded-lg border border-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow"
            >
              <span className="material-symbols-outlined text-[16px]">save</span>
              <span>{isSaving ? 'Saving Profile...' : 'Save Real Patient Data'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
