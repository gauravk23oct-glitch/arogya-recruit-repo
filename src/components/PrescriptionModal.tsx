import React from 'react';
import { Prescription } from '../types';

interface PrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  prescription: Prescription | null;
}

export const PrescriptionModal: React.FC<PrescriptionModalProps> = ({
  isOpen,
  onClose,
  prescription,
}) => {
  if (!isOpen || !prescription) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const textData = `
=====================================================
AROGYACONNECT DIGITAL e-PRESCRIPTION (ABDM COMPLIANT)
=====================================================
Rx Number: ${prescription.id}
Date: ${prescription.date}

DOCTOR DETAILS:
Dr. ${prescription.doctorName}
Specialty: ${prescription.doctorSpecialty}
Registration No: ${prescription.doctorRegNo}

PATIENT DETAILS:
Patient: ${prescription.patientName} (${prescription.patientAge}y / ${prescription.patientGender})
ABHA Health ID: ${prescription.patientAbhaId}

DIAGNOSIS / CLINICAL IMPRESSION:
${prescription.diagnosis}

PRESCRIBED MEDICINES:
${prescription.medicines
  .map(
    (m, i) =>
      `${i + 1}. ${m.name}\n   Dosage: ${m.dosage} | Frequency: ${m.frequency} | Duration: ${m.duration}\n   Instructions: ${m.instructions}`
  )
  .join('\n\n')}

GENERAL CLINICAL ADVICE:
${prescription.generalAdvice}

Follow-up: In ${prescription.followUpDays} days.
Digital Verification: ${prescription.signatureStamp}
=====================================================
`;
    const blob = new Blob([textData], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Prescription-${prescription.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      id="prescription-modal-overlay"
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-lg max-w-[680px] w-full p-6 md:p-8 flex flex-col gap-6 border border-slate-300 shadow-2xl relative my-auto">
        {/* Modal Controls Bar */}
        <div className="flex justify-between items-center pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-[#0284C7]">verified</span>
            <span className="text-xs font-bold font-mono uppercase tracking-widest text-slate-800">
              ABDM VERIFIED DIGITAL e-PRESCRIPTION
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold font-mono uppercase tracking-wider rounded-md flex items-center gap-1 border border-slate-200"
              title="Download text report"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>DOWNLOAD</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold font-mono uppercase tracking-wider rounded-md flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              <span>PRINT</span>
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-md hover:bg-slate-100 font-mono text-sm ml-2"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Printable Rx Document Container */}
        <div id="printable-rx-document" className="border-2 border-slate-900 rounded-lg p-6 bg-slate-50/50 flex flex-col gap-5 font-mono text-slate-900">
          {/* Header of Doctor & Clinic */}
          <div className="flex justify-between items-start border-b border-slate-300 pb-4">
            <div>
              <h2 className="text-lg font-black tracking-tight text-slate-900">
                Dr. {prescription.doctorName}
              </h2>
              <p className="text-xs text-[#0284C7] font-bold">{prescription.doctorSpecialty}</p>
              <p className="text-[11px] text-slate-500">
                Reg. No: {prescription.doctorRegNo} • Arogya Primary Health Kiosk Node
              </p>
            </div>

            <div className="text-right">
              <div className="text-2xl font-black text-slate-900 font-serif italic">℞</div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                ID: {prescription.id}
              </div>
              <div className="text-[10px] text-slate-500">{prescription.date}</div>
            </div>
          </div>

          {/* Patient Details Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-md border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase block font-bold">Patient</span>
              <span className="font-bold text-slate-800">{prescription.patientName}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase block font-bold">Age / Gender</span>
              <span className="font-bold text-slate-800">
                {prescription.patientAge} Yrs / {prescription.patientGender}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-[10px] text-slate-400 uppercase block font-bold">ABHA Health ID</span>
              <span className="font-bold text-[#0284C7]">{prescription.patientAbhaId}</span>
            </div>
          </div>

          {/* Diagnosis */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Clinical Assessment & Impression:
            </div>
            <div className="bg-white p-3 rounded-md border border-slate-200 text-xs font-bold text-slate-800">
              {prescription.diagnosis}
            </div>
          </div>

          {/* Medicines List */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-between">
              <span>Prescribed Therapeutics:</span>
              <span className="text-[10px] text-slate-400 font-normal">GENERIC DISPENSATION</span>
            </div>

            <div className="space-y-2">
              {prescription.medicines.map((med, idx) => (
                <div
                  key={idx}
                  className="bg-white p-3.5 rounded-md border border-slate-200 text-xs flex flex-col gap-1"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-slate-900">
                      {idx + 1}. {med.name}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">
                      {med.duration}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                    <span>Dosage: <strong className="text-slate-800">{med.dosage}</strong></span>
                    <span>Frequency: <strong className="text-slate-800">{med.frequency}</strong></span>
                    <span>Notes: <strong className="text-slate-800">{med.instructions}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Advice & Signature */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pt-3 border-t border-slate-300">
            <div className="text-[11px] text-slate-600 max-w-sm">
              <span className="font-bold uppercase text-slate-800 block mb-0.5">Physician Advice:</span>
              {prescription.generalAdvice}
              <span className="block mt-1 text-slate-500">
                Follow-up required in {prescription.followUpDays} days.
              </span>
            </div>

            <div className="text-right flex flex-col items-end">
              <div className="w-32 h-10 border-b border-dashed border-slate-400 flex items-center justify-center text-xs font-serif italic text-slate-500">
                Dr. {prescription.doctorName}
              </div>
              <span className="text-[9px] text-green-700 font-bold uppercase tracking-wider mt-1">
                ✓ {prescription.signatureStamp}
              </span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="flex justify-between items-center text-[11px] text-slate-500 font-mono">
          <span>This digital record has been appended to the patient's ABHA locker.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-md text-xs font-bold font-mono uppercase tracking-wider hover:bg-slate-800"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
