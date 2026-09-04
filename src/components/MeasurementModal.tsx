import React, { useState, useEffect } from 'react';
import { VitalsData } from '../types';

interface MeasurementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (vitals: Partial<VitalsData>) => void;
  initialVitals: VitalsData;
  mode?: 'kiosk-scan' | 'manual-edit';
}

export const MeasurementModal: React.FC<MeasurementModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  initialVitals,
  mode = 'kiosk-scan',
}) => {
  const [activeMode, setActiveMode] = useState<'kiosk-scan' | 'manual-edit'>(mode);
  const [scanStep, setScanStep] = useState<number>(0);
  const [scanProgress, setScanProgress] = useState<number>(0);

  // Manual form state
  const [systolic, setSystolic] = useState(initialVitals.bloodPressure.systolic);
  const [diastolic, setDiastolic] = useState(initialVitals.bloodPressure.diastolic);
  const [sugar, setSugar] = useState(initialVitals.bloodSugar.value);
  const [sugarType, setSugarType] = useState(initialVitals.bloodSugar.type);
  const [spO2, setSpO2] = useState(initialVitals.spO2.value);
  const [temperature, setTemperature] = useState(initialVitals.temperature.value);
  const [heartRate, setHeartRate] = useState(initialVitals.heartRate?.value || 72);

  useEffect(() => {
    if (isOpen) {
      setActiveMode(mode);
      setSystolic(initialVitals.bloodPressure.systolic);
      setDiastolic(initialVitals.bloodPressure.diastolic);
      setSugar(initialVitals.bloodSugar.value);
      setSugarType(initialVitals.bloodSugar.type);
      setSpO2(initialVitals.spO2.value);
      setTemperature(initialVitals.temperature.value);
      setHeartRate(initialVitals.heartRate?.value || 72);
    }
  }, [isOpen, mode, initialVitals]);

  useEffect(() => {
    if (isOpen && activeMode === 'kiosk-scan') {
      setScanStep(0);
      setScanProgress(0);

      const interval = setInterval(() => {
        setScanProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          const next = prev + 5;
          if (next >= 25 && next < 50) setScanStep(1);
          else if (next >= 50 && next < 75) setScanStep(2);
          else if (next >= 75 && next < 100) setScanStep(3);
          else if (next >= 100) setScanStep(4);
          return next;
        });
      }, 140);

      return () => clearInterval(interval);
    }
  }, [isOpen, activeMode]);

  if (!isOpen) return null;

  const handleFinishScan = () => {
    // Generate slight healthy variation on scan
    const newSys = Math.floor(116 + Math.random() * 8);
    const newDia = Math.floor(76 + Math.random() * 6);
    const newSugar = Math.floor(105 + Math.random() * 12);
    const newSpO2 = Math.floor(97 + Math.random() * 3);
    const newTemp = Number((98.4 + Math.random() * 0.4).toFixed(1));
    const newHr = Math.floor(70 + Math.random() * 8);

    onComplete({
      bloodPressure: {
        systolic: newSys,
        diastolic: newDia,
        unit: 'mmHg',
        status: newSys > 130 || newDia > 85 ? 'Elevated' : 'Normal',
      },
      bloodSugar: {
        value: newSugar,
        unit: 'mg/dL',
        type: sugarType,
        status: newSugar > 125 ? 'High' : newSugar > 115 ? 'Pre-diabetes' : 'Normal',
      },
      spO2: {
        value: newSpO2,
        unit: '%',
        status: newSpO2 >= 95 ? 'Good' : 'Low',
      },
      temperature: {
        value: newTemp,
        unit: '°F',
        status: newTemp > 99.5 ? 'Low Grade Fever' : 'Normal',
      },
      heartRate: {
        value: newHr,
        unit: 'BPM',
        status: 'Normal',
      },
    });
    onClose();
  };

  const handleManualSave = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete({
      bloodPressure: {
        systolic: Number(systolic),
        diastolic: Number(diastolic),
        unit: 'mmHg',
        status:
          systolic >= 140 || diastolic >= 90
            ? 'High (Stage 2)'
            : systolic >= 130 || diastolic >= 85
            ? 'Elevated'
            : systolic < 90
            ? 'Low'
            : 'Normal',
      },
      bloodSugar: {
        value: Number(sugar),
        unit: 'mg/dL',
        type: sugarType,
        status: sugar > 140 ? 'High' : sugar > 115 ? 'Pre-diabetes' : 'Normal',
      },
      spO2: {
        value: Number(spO2),
        unit: '%',
        status: spO2 >= 95 ? 'Good' : spO2 >= 90 ? 'Normal' : 'Low',
      },
      temperature: {
        value: Number(temperature),
        unit: '°F',
        status: temperature > 100.4 ? 'High Fever' : temperature > 99.2 ? 'Low Grade Fever' : 'Normal',
      },
      heartRate: {
        value: Number(heartRate),
        unit: 'BPM',
        status: heartRate > 100 ? 'Tachycardia' : heartRate < 60 ? 'Bradycardia' : 'Normal',
      },
    });
    onClose();
  };

  return (
    <div
      id="measurement-modal-overlay"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 font-mono"
    >
      <div
        id="measurement-modal-dialog"
        className="bg-white border border-slate-300 rounded-lg max-w-[560px] w-full p-6 shadow-2xl relative flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
      >
        {/* Modal Header */}
        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[24px] text-[#0284C7]">
              {activeMode === 'kiosk-scan' ? 'sensors' : 'tune'}
            </span>
            <h3 className="text-base font-bold text-slate-900 uppercase tracking-wider">
              {activeMode === 'kiosk-scan' ? 'KIOSK BIOMETRIC SCANNER' : 'ADJUST VITALS READINGS'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-md border border-slate-200">
          <button
            onClick={() => setActiveMode('kiosk-scan')}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
              activeMode === 'kiosk-scan'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Automated Kiosk Scan
          </button>
          <button
            onClick={() => setActiveMode('manual-edit')}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
              activeMode === 'manual-edit'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Manual Override
          </button>
        </div>

        {/* Kiosk Scan Flow */}
        {activeMode === 'kiosk-scan' ? (
          <div className="flex flex-col gap-5 py-2">
            {/* Progress Bar */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-semibold text-slate-500">
                <span className="uppercase">Screening Biometric Stream...</span>
                <span className="text-[#0284C7] font-bold">{scanProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-900 rounded-full transition-all duration-150"
                  style={{ width: `${scanProgress}%` }}
                ></div>
              </div>
            </div>

            {/* Step Status Badges */}
            <div className="space-y-2.5">
              <div
                className={`p-3 rounded-md border flex items-center gap-3 transition-all ${
                  scanStep >= 1
                    ? 'bg-slate-50 border-slate-300'
                    : 'bg-white border-slate-200 opacity-50'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-sm flex items-center justify-center font-bold text-xs ${
                    scanStep >= 1 ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {scanStep >= 1 ? 'check' : 'favorite'}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-slate-900 uppercase">1. Arm Cuff Inflatable BP</div>
                  <div className="text-[11px] text-slate-500">
                    {scanStep >= 1 ? 'Reading: 120/80 mmHg [LOCKED]' : 'Inflating pneumatic cuff to 160 mmHg...'}
                  </div>
                </div>
              </div>

              <div
                className={`p-3 rounded-md border flex items-center gap-3 transition-all ${
                  scanStep >= 2
                    ? 'bg-slate-50 border-slate-300'
                    : 'bg-white border-slate-200 opacity-50'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-sm flex items-center justify-center font-bold text-xs ${
                    scanStep >= 2 ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {scanStep >= 2 ? 'check' : 'water_drop'}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-slate-900 uppercase">2. Biosensor Glucose Strip</div>
                  <div className="text-[11px] text-slate-500">
                    {scanStep >= 2 ? 'Reading: 110 mg/dL Fasting [LOCKED]' : 'Analyzing enzymatic reaction current...'}
                  </div>
                </div>
              </div>

              <div
                className={`p-3 rounded-md border flex items-center gap-3 transition-all ${
                  scanStep >= 3
                    ? 'bg-slate-50 border-slate-300'
                    : 'bg-white border-slate-200 opacity-50'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-sm flex items-center justify-center font-bold text-xs ${
                    scanStep >= 3 ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {scanStep >= 3 ? 'check' : 'air'}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-slate-900 uppercase">3. Fingertip Pulse Oximeter</div>
                  <div className="text-[11px] text-slate-500">
                    {scanStep >= 3 ? 'Reading: 98% SpO2 (72 BPM) [LOCKED]' : 'Detecting photoplethysmograph waveform...'}
                  </div>
                </div>
              </div>

              <div
                className={`p-3 rounded-md border flex items-center gap-3 transition-all ${
                  scanStep >= 4
                    ? 'bg-slate-50 border-slate-300'
                    : 'bg-white border-slate-200 opacity-50'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-sm flex items-center justify-center font-bold text-xs ${
                    scanStep >= 4 ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {scanStep >= 4 ? 'check' : 'thermometer'}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-slate-900 uppercase">4. Contactless IR Sensor</div>
                  <div className="text-[11px] text-slate-500">
                    {scanStep >= 4 ? 'Reading: 98.6°F Core Normothermic [LOCKED]' : 'Scanning temporal artery emission...'}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-[44px] border border-slate-300 text-slate-700 font-bold uppercase tracking-wider rounded-md hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFinishScan}
                disabled={scanProgress < 100}
                className="flex-1 h-[44px] bg-slate-900 text-white font-bold uppercase tracking-wider rounded-md hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">done_all</span>
                Apply Readings
              </button>
            </div>
          </div>
        ) : (
          /* Manual Input Form */
          <form onSubmit={handleManualSave} className="flex flex-col gap-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Systolic (mmHg)
                </label>
                <input
                  type="number"
                  min="60"
                  max="240"
                  value={systolic}
                  onChange={(e) => setSystolic(Number(e.target.value))}
                  className="w-full h-[42px] px-3 border border-slate-200 rounded-md text-sm font-bold text-slate-900 bg-slate-50 focus:border-[#38BDF8] outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Diastolic (mmHg)
                </label>
                <input
                  type="number"
                  min="40"
                  max="150"
                  value={diastolic}
                  onChange={(e) => setDiastolic(Number(e.target.value))}
                  className="w-full h-[42px] px-3 border border-slate-200 rounded-md text-sm font-bold text-slate-900 bg-slate-50 focus:border-[#38BDF8] outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Blood Sugar (mg/dL)
                </label>
                <input
                  type="number"
                  min="40"
                  max="500"
                  value={sugar}
                  onChange={(e) => setSugar(Number(e.target.value))}
                  className="w-full h-[42px] px-3 border border-slate-200 rounded-md text-sm font-bold text-slate-900 bg-slate-50 focus:border-[#38BDF8] outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Glucose Timing
                </label>
                <select
                  value={sugarType}
                  onChange={(e) => setSugarType(e.target.value as any)}
                  className="w-full h-[42px] px-3 border border-slate-200 rounded-md text-xs font-semibold text-slate-900 bg-slate-50 focus:border-[#38BDF8] outline-none"
                >
                  <option value="Fasting">Fasting</option>
                  <option value="Post-Meal">Post-Meal</option>
                  <option value="Random">Random</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  SpO2 (%)
                </label>
                <input
                  type="number"
                  min="70"
                  max="100"
                  value={spO2}
                  onChange={(e) => setSpO2(Number(e.target.value))}
                  className="w-full h-[42px] px-3 border border-slate-200 rounded-md text-sm font-bold text-slate-900 bg-slate-50 focus:border-[#38BDF8] outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Temperature (°F)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="94"
                  max="108"
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  className="w-full h-[42px] px-3 border border-slate-200 rounded-md text-sm font-bold text-slate-900 bg-slate-50 focus:border-[#38BDF8] outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">
                Heart Rate (BPM)
              </label>
              <input
                type="number"
                min="40"
                max="200"
                value={heartRate}
                onChange={(e) => setHeartRate(Number(e.target.value))}
                className="w-full h-[42px] px-3 border border-slate-200 rounded-md text-sm font-bold text-slate-900 bg-slate-50 focus:border-[#38BDF8] outline-none"
                required
              />
            </div>

            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-[44px] border border-slate-300 text-slate-700 font-bold uppercase tracking-wider rounded-md hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 h-[44px] bg-slate-900 text-white font-bold uppercase tracking-wider rounded-md hover:bg-slate-800 shadow-sm"
              >
                Commit Override
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

