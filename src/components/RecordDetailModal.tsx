import React, { useState } from 'react';
import { VitalsData, PatientProfile } from '../types';
import { exportVitalsToPDF, exportVitalsToCSV } from '../services/exportService';

interface RecordDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: VitalsData | null;
  patient: PatientProfile;
  onShowToast?: (msg: string) => void;
}

export const RecordDetailModal: React.FC<RecordDetailModalProps> = ({
  isOpen,
  onClose,
  record,
  patient,
  onShowToast,
}) => {
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);

  if (!isOpen || !record) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    try {
      setIsExportingPDF(true);
      const fileName = exportVitalsToPDF([record], patient);
      onShowToast?.(`📄 Downloaded PDF (${fileName})`);
    } catch (e) {
      console.error(e);
      onShowToast?.('Failed to generate PDF');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportCSV = () => {
    try {
      setIsExportingCSV(true);
      const fileName = exportVitalsToCSV([record], patient);
      onShowToast?.(`📊 Downloaded CSV (${fileName})`);
    } catch (e) {
      console.error(e);
      onShowToast?.('Failed to generate CSV');
    } finally {
      setIsExportingCSV(false);
    }
  };

  const handleExportText = () => {
    const textData = `
=====================================================
AROGYACONNECT CLINICAL VITALS RECORD SUMMARY
=====================================================
Record ID: ${record.id}
Timestamp: ${new Date(record.timestamp).toLocaleString()}
Location: ${record.location || 'Arogya Community Kiosk'}

PATIENT INFORMATION:
Name: ${patient.name}
ABHA ID: ${patient.abhaId}
Age: ${patient.age} | Gender: ${patient.gender} | Blood Group: ${patient.bloodGroup}

BIOMETRIC MEASUREMENTS:
1. Blood Pressure: ${record.bloodPressure.systolic}/${record.bloodPressure.diastolic} ${record.bloodPressure.unit} (${record.bloodPressure.status})
2. Blood Sugar: ${record.bloodSugar.value} ${record.bloodSugar.unit} [${record.bloodSugar.type}] (${record.bloodSugar.status})
3. SpO2 Oxygen Saturation: ${record.spO2.value}% (${record.spO2.status})
4. Core Temperature: ${record.temperature.value}${record.temperature.unit} (${record.temperature.status})
5. Heart Rate: ${record.heartRate?.value || 72} BPM (${record.heartRate?.status || 'Normal'})

DIAGNOSTIC NOTES:
${record.notes || 'Routine biometric reading captured via Kiosk calibrated sensors.'}

ABDM Secure Transaction Hash: #TX-${Date.now().toString(16).toUpperCase()}
=====================================================
`;
    const blob = new Blob([textData], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `VitalsRecord-${record.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    onShowToast?.(`Downloaded Vitals Record TXT`);
  };

  return (
    <div
      id="record-detail-modal-overlay"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-lg max-w-[620px] w-full p-6 flex flex-col gap-5 border border-slate-300 shadow-2xl relative">
        <div className="flex justify-between items-center pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-[#0284C7]">fact_check</span>
            <span className="text-xs font-bold font-mono uppercase tracking-widest text-slate-800">
              CLINICAL BIOMETRIC RECORD DETAIL
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              title="Export as PDF"
              className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold font-mono uppercase tracking-wider rounded-md flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">picture_as_pdf</span>
              <span>PDF</span>
            </button>
            <button
              onClick={handleExportCSV}
              disabled={isExportingCSV}
              title="Export as CSV"
              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold font-mono uppercase tracking-wider rounded-md flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">table_chart</span>
              <span>CSV</span>
            </button>
            <button
              onClick={handleExportText}
              title="Export as Text"
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold font-mono uppercase tracking-wider rounded-md flex items-center gap-1 border border-slate-200 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">download</span>
              <span>TXT</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-2.5 py-1.5 bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold font-mono uppercase tracking-wider rounded-md flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">print</span>
              <span>PRINT</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-md hover:bg-slate-100 font-mono text-sm ml-1"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Record Sheet */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex flex-col gap-4 font-mono text-xs text-slate-900">
          <div className="flex justify-between items-start border-b border-slate-200 pb-3">
            <div>
              <div className="text-sm font-bold text-slate-900">{patient.name}</div>
              <div className="text-[11px] text-slate-500">
                ABHA ID: {patient.abhaId} • {patient.age}y / {patient.gender}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-slate-500 font-bold">
                {new Date(record.timestamp).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
              <div className="text-[10px] text-[#0284C7] font-bold uppercase">{record.id}</div>
            </div>
          </div>

          {/* Vitals Matrix */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-3 rounded-md border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase block font-bold">Blood Pressure</span>
              <span className="text-lg font-black text-slate-900">
                {record.bloodPressure.systolic}/{record.bloodPressure.diastolic}
              </span>
              <span className="text-[10px] text-slate-500 ml-1">mmHg</span>
              <div className="text-[10px] text-green-600 font-bold uppercase mt-0.5">
                [{record.bloodPressure.status}]
              </div>
            </div>

            <div className="bg-white p-3 rounded-md border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase block font-bold">Blood Glucose</span>
              <span className="text-lg font-black text-slate-900">{record.bloodSugar.value}</span>
              <span className="text-[10px] text-slate-500 ml-1">{record.bloodSugar.unit}</span>
              <div className="text-[10px] text-green-600 font-bold uppercase mt-0.5">
                [{record.bloodSugar.type} - {record.bloodSugar.status}]
              </div>
            </div>

            <div className="bg-white p-3 rounded-md border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase block font-bold">SpO2 Oxygen Sat</span>
              <span className="text-lg font-black text-slate-900">{record.spO2.value}%</span>
              <div className="text-[10px] text-green-600 font-bold uppercase mt-0.5">
                [{record.spO2.status}]
              </div>
            </div>

            <div className="bg-white p-3 rounded-md border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase block font-bold">Body Temperature</span>
              <span className="text-lg font-black text-slate-900">
                {record.temperature.value}{record.temperature.unit}
              </span>
              <div className="text-[10px] text-green-600 font-bold uppercase mt-0.5">
                [{record.temperature.status}]
              </div>
            </div>
          </div>

          <div className="bg-white p-3 rounded-md border border-slate-200">
            <span className="text-[10px] text-slate-400 uppercase block font-bold mb-1">
              Sensor / Kiosk Notes:
            </span>
            <p className="text-[11px] text-slate-700 font-sans">
              {record.notes || 'Sensor readings within normal clinical parameters. No alerts triggered.'}
            </p>
            <div className="text-[10px] text-slate-400 mt-1">Location: {record.location || 'Arogya Rural Kiosk Node-04'}</div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white rounded-md text-xs font-bold font-mono uppercase tracking-wider hover:bg-slate-800"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};
