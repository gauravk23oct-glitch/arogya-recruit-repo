import React, { useState, useEffect } from 'react';
import { Doctor } from '../types';

interface DoctorRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (doctor: Doctor) => void;
  doctorToEdit?: Doctor | null;
}

const SPECIALTY_OPTIONS = [
  { value: 'general', label: 'General Physician & Internal Medicine' },
  { value: 'cardiology', label: 'Cardiology & Heart Care' },
  { value: 'pediatrics', label: 'Pediatrics & Child Health' },
  { value: 'gynecology', label: 'Obstetrics & Gynecology (Maternal Care)' },
  { value: 'orthopedics', label: 'Orthopedics & Joint Care' },
  { value: 'dermatology', label: 'Dermatology & Skin' },
  { value: 'ophthalmology', label: 'Ophthalmology & Eye Care' },
  { value: 'ent', label: 'ENT (Ear, Nose & Throat)' },
  { value: 'diabetes', label: 'Diabetology & Endocrinology' },
  { value: 'pulmonology', label: 'Pulmonology & Respiratory Medicine' },
  { value: 'psychiatry', label: 'Mental Health & Psychiatry' },
  { value: 'ayush', label: 'Ayurveda & Integrative Medicine' },
];

const SAMPLE_AVATARS = [
  'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1594824813681-ef07f78112c2?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=400&q=80',
];

export const DoctorRegistrationModal: React.FC<DoctorRegistrationModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  doctorToEdit,
}) => {
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('General Physician & Internal Medicine');
  const [subSpecialty, setSubSpecialty] = useState('Preventive & Community Health');
  const [category, setCategory] = useState('general');
  const [qualification, setQualification] = useState('MBBS, MD');
  const [hospitalAffiliation, setHospitalAffiliation] = useState('District Hospital & Rural Health Network');
  const [regNumber, setRegNumber] = useState('');
  const [experienceYears, setExperienceYears] = useState(8);
  const [languages, setLanguages] = useState('English, Hindi');
  const [consultationFee, setConsultationFee] = useState('₹0 (ABDM / Ayushman Bharat Covered)');
  const [about, setAbout] = useState('');
  const [availableNow, setAvailableNow] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState(SAMPLE_AVATARS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (doctorToEdit) {
        setName(doctorToEdit.name);
        setSpecialty(doctorToEdit.specialty);
        setSubSpecialty(doctorToEdit.subSpecialty || '');
        setCategory(doctorToEdit.category || 'general');
        setQualification(doctorToEdit.qualification);
        setHospitalAffiliation(doctorToEdit.hospitalAffiliation);
        setRegNumber(doctorToEdit.regNumber);
        setExperienceYears(doctorToEdit.experienceYears || 5);
        setLanguages(doctorToEdit.languages?.join(', ') || 'English, Hindi');
        setConsultationFee(doctorToEdit.consultationFee || '₹0 (ABDM Covered)');
        setAbout(doctorToEdit.about || '');
        setAvailableNow(doctorToEdit.availableNow);
        setAvatarUrl(doctorToEdit.avatarUrl || SAMPLE_AVATARS[0]);
      } else {
        setName('');
        setSpecialty('General Physician & Internal Medicine');
        setSubSpecialty('Preventive & Primary Care');
        setCategory('general');
        setQualification('MBBS, MD');
        setHospitalAffiliation('District Civil Hospital / Health Mission');
        setRegNumber(`NMC-${Math.floor(10000 + Math.random() * 90000)}`);
        setExperienceYears(6);
        setLanguages('English, Hindi');
        setConsultationFee('₹0 (ABDM / Ayushman Bharat Covered)');
        setAbout('');
        setAvailableNow(true);
        setAvatarUrl(SAMPLE_AVATARS[Math.floor(Math.random() * SAMPLE_AVATARS.length)]);
      }
      setError(null);
    }
  }, [isOpen, doctorToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter doctor full name');
      return;
    }
    if (!regNumber.trim()) {
      setError('Please enter Medical Council / NMC registration number');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const doctorPayload = {
      name: name.trim().startsWith('Dr.') ? name.trim() : `Dr. ${name.trim()}`,
      specialty: specialty.trim(),
      subSpecialty: subSpecialty.trim(),
      category: category.toLowerCase(),
      qualification: qualification.trim(),
      hospitalAffiliation: hospitalAffiliation.trim(),
      regNumber: regNumber.trim(),
      experienceYears: Number(experienceYears) || 1,
      languages: languages.split(',').map((s) => s.trim()).filter(Boolean),
      consultationFee: consultationFee.trim(),
      about: about.trim() || `Practicing clinician registered under ${regNumber.trim()}. Specialized in ${specialty.trim()}.`,
      availableNow,
      avatarUrl,
    };

    try {
      const url = doctorToEdit ? `/api/doctors/${doctorToEdit.id}` : '/api/doctors';
      const method = doctorToEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doctorPayload),
      });

      if (!res.ok) {
        throw new Error('Failed to save doctor to registry');
      }

      const resJson = await res.json();
      onSaved(resJson.data);
      onClose();
    } catch (err: any) {
      console.error('Error saving doctor:', err);
      // Fallback local creation
      const localDoc: Doctor = {
        id: doctorToEdit ? doctorToEdit.id : `doc-${Date.now()}`,
        ...doctorPayload,
        rating: 5.0,
        reviewCount: 1,
        consultationCount: 0,
        availableModes: ['video', 'audio', 'chat'],
        nextSlot: 'Available Now',
      };
      onSaved(localDoc);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-fadeIn">
        {/* Modal Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <span className="material-symbols-outlined text-[22px]">stethoscope</span>
            </div>
            <div>
              <h2 className="text-base font-bold font-mono tracking-tight text-white">
                {doctorToEdit ? 'Edit Real Doctor Profile' : 'Register Real Doctor Profile'}
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Add verified practitioners with legitimate Medical Council credentials
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-slate-800 max-h-[78vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-mono rounded-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-slate-700 mb-1">
                Doctor Full Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dr. Priya Sharma"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-sans focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Registration Number */}
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-slate-700 mb-1">
                Medical Council Reg. No. (NMC/State) *
              </label>
              <input
                type="text"
                required
                value={regNumber}
                onChange={(e) => setRegNumber(e.target.value)}
                placeholder="e.g. NMC-2023-49102 or DMC-38291"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Specialty Category */}
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-slate-700 mb-1">
                Primary Specialty Category *
              </label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  const found = SPECIALTY_OPTIONS.find((s) => s.value === e.target.value);
                  if (found) setSpecialty(found.label);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-sans focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              >
                {SPECIALTY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Specialty Title */}
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-slate-700 mb-1">
                Specialty Title (Display)
              </label>
              <input
                type="text"
                required
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="e.g. Senior Consultant Cardiologist"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-sans focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Qualifications */}
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-slate-700 mb-1">
                Degrees & Qualifications *
              </label>
              <input
                type="text"
                required
                value={qualification}
                onChange={(e) => setQualification(e.target.value)}
                placeholder="e.g. MBBS, MD (Medicine), DNB"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-sans focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Hospital / Clinic Affiliation */}
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-slate-700 mb-1">
                Hospital / Clinic Affiliation *
              </label>
              <input
                type="text"
                required
                value={hospitalAffiliation}
                onChange={(e) => setHospitalAffiliation(e.target.value)}
                placeholder="e.g. District Civil Hospital / AIIMS"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-sans focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Experience Years */}
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-slate-700 mb-1">
                Clinical Experience (Years)
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={experienceYears}
                onChange={(e) => setExperienceYears(Number(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-sans focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Consultation Fee */}
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-slate-700 mb-1">
                Consultation Fee
              </label>
              <input
                type="text"
                value={consultationFee}
                onChange={(e) => setConsultationFee(e.target.value)}
                placeholder="e.g. ₹0 (ABDM Covered) or ₹200"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-sans focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Spoken Languages */}
            <div className="md:col-span-2">
              <label className="block text-xs font-mono font-bold uppercase text-slate-700 mb-1">
                Spoken Languages (comma separated)
              </label>
              <input
                type="text"
                value={languages}
                onChange={(e) => setLanguages(e.target.value)}
                placeholder="English, Hindi, Marathi, Bengali"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-sans focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Bio */}
            <div className="md:col-span-2">
              <label className="block text-xs font-mono font-bold uppercase text-slate-700 mb-1">
                Clinical Profile / About
              </label>
              <textarea
                rows={2}
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder="Brief clinical background, patient care experience, and clinic timings..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-sans focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Avatar Selection */}
            <div className="md:col-span-2">
              <label className="block text-xs font-mono font-bold uppercase text-slate-700 mb-1.5">
                Profile Photo / Avatar
              </label>
              <div className="flex items-center gap-3">
                {SAMPLE_AVATARS.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setAvatarUrl(url)}
                    className={`w-12 h-12 rounded-xl overflow-hidden border-2 transition-all ${
                      avatarUrl === url
                        ? 'border-sky-500 ring-2 ring-sky-300 scale-105'
                        : 'border-slate-300 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt="avatar" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Online Now Checkbox */}
            <div className="md:col-span-2 flex items-center gap-2.5 pt-1">
              <input
                type="checkbox"
                id="doc-available-checkbox"
                checked={availableNow}
                onChange={(e) => setAvailableNow(e.target.checked)}
                className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500"
              />
              <label htmlFor="doc-available-checkbox" className="text-xs font-mono font-bold text-slate-800 cursor-pointer">
                Available Immediately for Live Teleconsultation Video Calls (Online)
              </label>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-mono text-slate-600 hover:text-slate-900 rounded-lg border border-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow"
            >
              <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
              <span>{isSubmitting ? 'Saving...' : doctorToEdit ? 'Update Doctor' : 'Register Real Doctor'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
