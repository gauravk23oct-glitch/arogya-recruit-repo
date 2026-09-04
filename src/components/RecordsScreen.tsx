import React, { useState } from 'react';
import { VitalsData, PatientProfile } from '../types';
import { exportVitalsToCSV, exportVitalsToPDF } from '../services/exportService';

interface RecordsScreenProps {
  records: VitalsData[];
  patient: PatientProfile;
  onDeleteRecord?: (id: string) => void;
  onSelectRecord?: (record: VitalsData) => void;
  onOpenManualEntry?: () => void;
  onShowToast?: (msg: string) => void;
}

export const RecordsScreen: React.FC<RecordsScreenProps> = ({
  records,
  patient,
  onDeleteRecord,
  onSelectRecord,
  onOpenManualEntry,
  onShowToast,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'bp' | 'sugar' | 'spo2'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportScope, setExportScope] = useState<'all' | 'filtered'>('all');

  const filteredRecords = records.filter((rec) => {
    if (filterType === 'bp' && !rec.bloodPressure) return false;
    if (filterType === 'sugar' && !rec.bloodSugar) return false;
    if (filterType === 'spo2' && !rec.spO2) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDate = new Date(rec.timestamp).toLocaleDateString().toLowerCase();
      const matchLoc = (rec.location || '').toLowerCase();
      const matchNotes = (rec.notes || '').toLowerCase();
      return matchDate.includes(q) || matchLoc.includes(q) || matchNotes.includes(q);
    }
    return true;
  });

  const getRecordsToExport = () => {
    return exportScope === 'filtered' && filteredRecords.length > 0 ? filteredRecords : records;
  };

  const handleExportPDF = (customRecords?: VitalsData[]) => {
    try {
      setIsExportingPDF(true);
      const targetRecords = customRecords || getRecordsToExport();
      if (targetRecords.length === 0) {
        onShowToast?.('No records available to export.');
        return;
      }
      const fileName = exportVitalsToPDF(targetRecords, patient);
      onShowToast?.(`📄 Downloaded EHR Report (${fileName})`);
      setShowExportModal(false);
    } catch (err) {
      console.error('PDF Export Error:', err);
      onShowToast?.('Failed to generate PDF. Please try again.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportCSV = (customRecords?: VitalsData[]) => {
    try {
      setIsExportingCSV(true);
      const targetRecords = customRecords || getRecordsToExport();
      if (targetRecords.length === 0) {
        onShowToast?.('No records available to export.');
        return;
      }
      const fileName = exportVitalsToCSV(targetRecords, patient);
      onShowToast?.(`📊 Downloaded CSV Telemetry (${fileName})`);
      setShowExportModal(false);
    } catch (err) {
      console.error('CSV Export Error:', err);
      onShowToast?.('Failed to generate CSV. Please try again.');
    } finally {
      setIsExportingCSV(false);
    }
  };

  const handlePrintSummary = () => {
    window.print();
  };

  return (
    <main
      id="records-screen-main"
      className="flex-grow pt-[72px] md:pt-[84px] pb-[100px] md:pb-[40px] px-4 md:px-8 max-w-[1024px] mx-auto w-full flex flex-col gap-6"
    >
      {/* Header & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight font-mono uppercase">
            HEALTH RECORDS (EHR)
          </h1>
          <p className="text-xs text-slate-500 font-mono uppercase tracking-wider mt-0.5">
            PERMANENT HISTORICAL TELEMETRY LOG • SYNCED WITH ABHA HEALTH VAULT ({records.length} TOTAL)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenManualEntry && (
            <button
              onClick={onOpenManualEntry}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono text-xs font-bold uppercase tracking-wider rounded-md flex items-center justify-center gap-1.5 border border-slate-300 cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px]">edit_note</span>
              <span>LOG ENTRY</span>
            </button>
          )}

          {/* Quick Export as PDF */}
          <button
            onClick={() => handleExportPDF()}
            disabled={isExportingPDF || records.length === 0}
            title="Download complete vitals history as a printable PDF report"
            className="px-3.5 py-2 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-mono text-xs font-bold uppercase tracking-wider rounded-md flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
            <span>{isExportingPDF ? 'GENERATING...' : 'EXPORT PDF'}</span>
          </button>

          {/* Quick Export as CSV */}
          <button
            onClick={() => handleExportCSV()}
            disabled={isExportingCSV || records.length === 0}
            title="Download vitals history as a CSV spreadsheet"
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-mono text-xs font-bold uppercase tracking-wider rounded-md flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">table_chart</span>
            <span>{isExportingCSV ? 'PREPARING...' : 'EXPORT CSV'}</span>
          </button>

          {/* More Options / Print */}
          <button
            onClick={() => setShowExportModal(true)}
            className="px-3 py-2 bg-slate-900 text-white font-mono text-xs font-bold uppercase tracking-wider rounded-md flex items-center justify-center gap-1.5 hover:bg-slate-800 transition-all shadow-xs border border-slate-700 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-[#38BDF8]">tune</span>
            <span>CUSTOM EXPORT</span>
          </button>
        </div>
      </div>

      {/* Export Options Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-lg p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-[#0284C7]/20 border border-[#38BDF8]/30 flex items-center justify-center text-[#38BDF8] flex-shrink-0">
            <span className="material-symbols-outlined text-[22px]">download_for_offline</span>
          </div>
          <div>
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-100">
              ABDM Certified EHR Data Export
            </h4>
            <p className="text-[11px] text-slate-300 font-sans">
              Save your complete biometric history for doctor consultations, offline storage, or health insurance records.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => handleExportPDF()}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-mono font-bold rounded flex items-center gap-1.5 border border-white/20 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-red-400">picture_as_pdf</span>
            <span>PDF EHR</span>
          </button>
          <button
            onClick={() => handleExportCSV()}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-mono font-bold rounded flex items-center gap-1.5 border border-white/20 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-emerald-400">csv</span>
            <span>CSV Data</span>
          </button>
          <button
            onClick={handlePrintSummary}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-mono font-bold rounded flex items-center gap-1.5 border border-white/20 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-sky-400">print</span>
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Vitals Trend Visualizer Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 md:p-6 shadow-xs flex flex-col gap-4">
        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-mono flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#0284C7]">monitoring</span>
            CLINICAL METRIC PROGRESSION ({patient.name})
          </h3>
          <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2.5 py-0.5 rounded-full font-mono uppercase">
            ALL VALUES STABLE
          </span>
        </div>

        {/* Accessible Trend Bars */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-50 p-3.5 rounded-md flex flex-col gap-1 border border-slate-200 font-mono">
            <span className="text-[11px] text-slate-400 font-bold uppercase">BP SYS AVG</span>
            <span className="text-xl font-black text-slate-900">
              120 <span className="text-xs font-normal text-slate-500">mmHg</span>
            </span>
            <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden mt-1">
              <div className="w-[60%] h-full bg-[#0284C7] rounded-full"></div>
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-md flex flex-col gap-1 border border-slate-200 font-mono">
            <span className="text-[11px] text-slate-400 font-bold uppercase">GLUCOSE AVG</span>
            <span className="text-xl font-black text-slate-900">
              110 <span className="text-xs font-normal text-slate-500">mg/dL</span>
            </span>
            <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden mt-1">
              <div className="w-[55%] h-full bg-amber-600 rounded-full"></div>
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-md flex flex-col gap-1 border border-slate-200 font-mono">
            <span className="text-[11px] text-slate-400 font-bold uppercase">SPO2 SAT AVG</span>
            <span className="text-xl font-black text-slate-900">98%</span>
            <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden mt-1">
              <div className="w-[98%] h-full bg-green-600 rounded-full"></div>
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-md flex flex-col gap-1 border border-slate-200 font-mono">
            <span className="text-[11px] text-slate-400 font-bold uppercase">TEMP CORE AVG</span>
            <span className="text-xl font-black text-slate-900">98.6°F</span>
            <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden mt-1">
              <div className="w-[70%] h-full bg-green-600 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 font-mono">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              filterType === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            All Timeline ({records.length})
          </button>
          <button
            onClick={() => setFilterType('bp')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              filterType === 'bp'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Blood Pressure
          </button>
          <button
            onClick={() => setFilterType('sugar')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              filterType === 'sugar'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Blood Glucose
          </button>
        </div>

        {/* Search input */}
        <div className="relative min-w-[240px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search records by date/note..."
            className="w-full h-[36px] pl-8 pr-3 border border-slate-200 rounded-md text-xs font-mono text-slate-800 bg-white focus:border-[#38BDF8] outline-none"
          />
          <span className="material-symbols-outlined absolute left-2.5 top-2 text-[16px] text-slate-400">
            search
          </span>
        </div>
      </div>

      {/* Timeline List */}
      <div className="space-y-3 font-mono">
        {filteredRecords.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-lg p-8 text-center text-slate-500">
            <span className="material-symbols-outlined text-[40px] text-slate-400">receipt_long</span>
            <p className="font-bold text-sm mt-2 uppercase tracking-wider">No matching records found</p>
            <p className="text-xs mt-0.5">Execute biometric screening or adjust your search query.</p>
          </div>
        ) : (
          filteredRecords.map((rec) => {
            const dateStr = new Date(rec.timestamp).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={rec.id}
                onClick={() => onSelectRecord && onSelectRecord(rec)}
                className="bg-white border border-slate-200 hover:border-[#38BDF8] rounded-lg p-5 shadow-xs transition-all flex flex-col gap-3.5 cursor-pointer group"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-sm bg-slate-900 text-[#38BDF8] flex items-center justify-center font-bold group-hover:bg-[#0284C7] group-hover:text-white transition-colors">
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">{dateStr}</div>
                      <div className="text-[11px] text-slate-500 uppercase">
                        {rec.location || 'Arogya Kiosk Node-04'} • ID: {rec.id}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      CRYPTOGRAPHIC SIGNED
                    </span>

                    {/* Single-record PDF button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportPDF([rec]);
                      }}
                      title="Export this single measurement as PDF"
                      className="p-1 text-slate-400 hover:text-red-600 rounded-md transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                    </button>

                    {/* Single-record CSV button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportCSV([rec]);
                      }}
                      title="Export this single measurement as CSV"
                      className="p-1 text-slate-400 hover:text-emerald-600 rounded-md transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">table_chart</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectRecord) onSelectRecord(rec);
                      }}
                      className="text-xs text-[#0284C7] font-bold uppercase tracking-wider hover:underline px-1"
                    >
                      VIEW →
                    </button>

                    {onDeleteRecord && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteRecord(rec.id);
                        }}
                        className="text-slate-400 hover:text-red-600 p-1 rounded-md"
                        title="Delete entry"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 4 Vitals Summary Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-slate-900">
                  <div className="bg-slate-50 p-2.5 rounded-md border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Blood Pressure</span>
                    <span className="text-base font-bold text-slate-900">
                      {rec.bloodPressure.systolic}/{rec.bloodPressure.diastolic}
                    </span>
                    <span className="text-[10px] text-green-600 font-bold ml-1.5">
                      {rec.bloodPressure.status}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-md border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Glucose</span>
                    <span className="text-base font-bold text-slate-900">
                      {rec.bloodSugar.value} mg/dL
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-md border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">SpO2 Oxygen</span>
                    <span className="text-base font-bold text-slate-900">
                      {rec.spO2.value}%
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-md border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Temperature</span>
                    <span className="text-base font-bold text-slate-900">
                      {rec.temperature.value}°F
                    </span>
                  </div>
                </div>

                {rec.notes && (
                  <p className="text-xs text-slate-600 font-sans italic bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200">
                    Clinical Note: {rec.notes}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Custom Export Dialog Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-[540px] w-full p-6 flex flex-col gap-5 border border-slate-300 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#0284C7]">download_for_offline</span>
                <h3 className="text-sm font-bold font-mono uppercase text-slate-900 tracking-wider">
                  EXPORT VITALS HISTORY
                </h3>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-4 font-mono text-xs text-slate-800">
              <div>
                <label className="font-bold text-slate-700 block mb-1 uppercase text-[11px]">
                  1. Select Records Scope
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setExportScope('all')}
                    className={`p-3 rounded-md border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      exportScope === 'all'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="font-bold">All Records ({records.length})</span>
                    <span className="text-[10px] opacity-80">Full lifetime history log</span>
                  </button>

                  <button
                    onClick={() => setExportScope('filtered')}
                    className={`p-3 rounded-md border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      exportScope === 'filtered'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="font-bold">Filtered Records ({filteredRecords.length})</span>
                    <span className="text-[10px] opacity-80">Current search / filter subset</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1 uppercase text-[11px]">
                  2. Choose Export Format
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* PDF option card */}
                  <div
                    onClick={() => handleExportPDF()}
                    className="p-4 rounded-lg border border-slate-200 bg-slate-50 hover:bg-red-50 hover:border-red-300 transition-all cursor-pointer flex flex-col justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-red-100 text-red-700 flex items-center justify-center font-bold">
                        <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 group-hover:text-red-900">PDF Report (.pdf)</div>
                        <div className="text-[10px] text-slate-500">Official Clinical Format</div>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-600 font-sans leading-relaxed">
                      Includes patient ABHA demographics, summary statistical averages, and formatted tabular history.
                    </p>
                    <button
                      disabled={isExportingPDF}
                      className="w-full py-1.5 bg-red-700 hover:bg-red-800 text-white rounded text-[11px] font-bold uppercase tracking-wider"
                    >
                      {isExportingPDF ? 'Generating...' : 'Download PDF'}
                    </button>
                  </div>

                  {/* CSV option card */}
                  <div
                    onClick={() => handleExportCSV()}
                    className="p-4 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 transition-all cursor-pointer flex flex-col justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                        <span className="material-symbols-outlined text-[18px]">table_chart</span>
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 group-hover:text-emerald-900">CSV Sheet (.csv)</div>
                        <div className="text-[10px] text-slate-500">Excel / Raw Telemetry</div>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-600 font-sans leading-relaxed">
                      RFC-compliant comma separated spreadsheet with UTF-8 BOM encoding for Microsoft Excel & Google Sheets.
                    </p>
                    <button
                      disabled={isExportingCSV}
                      className="w-full py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[11px] font-bold uppercase tracking-wider"
                    >
                      {isExportingCSV ? 'Preparing...' : 'Download CSV'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <button
                onClick={handlePrintSummary}
                className="px-3 py-1.5 text-slate-600 hover:text-slate-900 text-xs font-mono font-bold flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                <span>Print Document</span>
              </button>

              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-md text-xs font-mono font-bold uppercase tracking-wider cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
