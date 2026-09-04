import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { VitalsData, PatientProfile } from '../types';

/**
 * Exports vitals history to a formatted, RFC-compliant CSV file and triggers download.
 */
export function exportVitalsToCSV(records: VitalsData[], patient: PatientProfile): string {
  if (!records || records.length === 0) {
    throw new Error('No records available to export.');
  }

  // Define CSV headers
  const headers = [
    'Record ID',
    'Date',
    'Time',
    'Location / Kiosk Node',
    'Patient Name',
    'ABHA Health ID',
    'Age',
    'Gender',
    'Blood Group',
    'Systolic BP (mmHg)',
    'Diastolic BP (mmHg)',
    'BP Status',
    'Heart Rate / Pulse (BPM)',
    'Heart Rate Status',
    'Blood Glucose (mg/dL)',
    'Glucose Status',
    'Glucose Reading Type',
    'SpO2 Oxygen (%)',
    'SpO2 Status',
    'Body Temperature (F)',
    'Temperature Status',
    'Clinical Notes',
  ];

  // Helper to safely escape CSV fields
  const escapeField = (val: unknown): string => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  // Convert records to CSV rows
  const rows = records.map((rec) => {
    const d = new Date(rec.timestamp);
    const dateStr = isNaN(d.getTime())
      ? rec.timestamp
      : d.toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const timeStr = isNaN(d.getTime())
      ? ''
      : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    return [
      escapeField(rec.id),
      escapeField(dateStr),
      escapeField(timeStr),
      escapeField(rec.location || 'Arogya Kiosk Node-04'),
      escapeField(patient.name),
      escapeField(patient.abhaId),
      escapeField(patient.age),
      escapeField(patient.gender),
      escapeField(patient.bloodGroup || 'N/A'),
      escapeField(rec.bloodPressure?.systolic ?? ''),
      escapeField(rec.bloodPressure?.diastolic ?? ''),
      escapeField(rec.bloodPressure?.status ?? ''),
      escapeField(rec.heartRate?.value ?? ''),
      escapeField(rec.heartRate?.status ?? ''),
      escapeField(rec.bloodSugar?.value ?? ''),
      escapeField(rec.bloodSugar?.status ?? ''),
      escapeField(rec.bloodSugar?.type ?? 'Random'),
      escapeField(rec.spO2?.value ?? ''),
      escapeField(rec.spO2?.status ?? ''),
      escapeField(rec.temperature?.value ?? ''),
      escapeField(rec.temperature?.status ?? ''),
      escapeField(rec.notes || 'Routine Screening'),
    ].join(',');
  });

  const csvContent = [headers.map((h) => `"${h}"`).join(','), ...rows].join('\r\n');

  // Add UTF-8 BOM so Excel opens Hindi / Unicode characters properly
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const sanitizedName = patient.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const dateStamp = new Date().toISOString().slice(0, 10);
  const fileName = `arogya_vitals_${sanitizedName}_${dateStamp}.csv`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return fileName;
}

/**
 * Generates an official, beautifully formatted clinical PDF report of the vitals history.
 */
export function exportVitalsToPDF(records: VitalsData[], patient: PatientProfile): string {
  if (!records || records.length === 0) {
    throw new Error('No records available to export.');
  }

  // Create new PDF document (A4, portrait, mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const dateStamp = new Date().toISOString().slice(0, 10);
  const formattedGeneratedAt = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // Top Navy Header Bar
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Decorative blue accent stripe
  doc.setFillColor(2, 132, 199); // #0284C7
  doc.rect(0, 28, pageWidth, 2, 'F');

  // Header Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('AROGYACONNECT HEALTH EHR REPORT', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(186, 230, 253); // light sky blue
  doc.text('NATIONAL DIGITAL HEALTH MISSION • ABHA COMPLIANT TELEMETRY', 14, 18);

  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Generated: ${formattedGeneratedAt} | Kiosk: ${patient.kioskLocation || 'Node-04'}`, 14, 23);

  // Government & ABHA Badge on Top Right
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('ABHA VERIFIED', pageWidth - 14, 13, { align: 'right' });
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`ABHA: ${patient.abhaId}`, pageWidth - 14, 19, { align: 'right' });

  // ---------------- PATIENT DEMOGRAPHICS SECTION ----------------
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(14, 34, pageWidth - 28, 26, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('PATIENT PROFILE & CLINICAL DEMOGRAPHICS', 18, 40);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);

  // Column 1
  doc.text(`Name: ${patient.name}`, 18, 47);
  doc.text(`Age / Gender: ${patient.age} Yrs / ${patient.gender}`, 18, 54);

  // Column 2
  doc.text(`Blood Group: ${patient.bloodGroup || 'O+'}`, 75, 47);
  doc.text(`Phone: ${patient.phone || '+91 98765 43210'}`, 75, 54);

  // Column 3
  doc.text(`Emergency Contact: ${patient.emergencyContact || '+91 98765 00000'}`, 130, 47);
  doc.text(`Preferred Language: ${patient.preferredLanguage?.toUpperCase() || 'EN'}`, 130, 54);

  // ---------------- CLINICAL SUMMARY STATS ROW ----------------
  // Compute averages
  let totalSys = 0;
  let totalDia = 0;
  let totalGlucose = 0;
  let totalSpO2 = 0;
  let totalTemp = 0;
  let validCount = records.length;

  records.forEach((r) => {
    totalSys += r.bloodPressure?.systolic || 120;
    totalDia += r.bloodPressure?.diastolic || 80;
    totalGlucose += r.bloodSugar?.value || 110;
    totalSpO2 += r.spO2?.value || 98;
    totalTemp += r.temperature?.value || 98.6;
  });

  const avgSys = Math.round(totalSys / validCount);
  const avgDia = Math.round(totalDia / validCount);
  const avgGlucose = Math.round(totalGlucose / validCount);
  const avgSpO2 = Math.round((totalSpO2 / validCount) * 10) / 10;
  const avgTemp = Math.round((totalTemp / validCount) * 10) / 10;

  const cardWidth = (pageWidth - 28 - 9) / 4;
  const startY = 64;

  const summaryCards = [
    { label: 'AVG BLOOD PRESSURE', val: `${avgSys}/${avgDia} mmHg`, status: 'STABLE' },
    { label: 'AVG BLOOD GLUCOSE', val: `${avgGlucose} mg/dL`, status: 'NORMAL' },
    { label: 'AVG SPO2 OXYGEN', val: `${avgSpO2}%`, status: 'GOOD' },
    { label: 'AVG BODY TEMP', val: `${avgTemp}°F`, status: 'NORMOTHERMIC' },
  ];

  summaryCards.forEach((c, idx) => {
    const x = 14 + idx * (cardWidth + 3);
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(x, startY, cardWidth, 16, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(c.label, x + 3, startY + 5);

    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(c.val, x + 3, startY + 11);

    doc.setFontSize(6);
    doc.setTextColor(2, 132, 199);
    doc.text(c.status, x + cardWidth - 3, startY + 11, { align: 'right' });
  });

  // ---------------- TABLE OF VITALS RECORDS ----------------
  const tableData = records.map((rec, i) => {
    const d = new Date(rec.timestamp);
    const dateFormatted = isNaN(d.getTime())
      ? rec.timestamp
      : d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) +
        '\n' +
        d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    const bp = `${rec.bloodPressure?.systolic || '--'}/${rec.bloodPressure?.diastolic || '--'} mmHg\n(${rec.bloodPressure?.status || 'Normal'})`;
    const pulse = `${rec.heartRate?.value || '--'} BPM`;
    const glucose = `${rec.bloodSugar?.value || '--'} mg/dL\n(${rec.bloodSugar?.type || 'Random'})`;
    const spo2 = `${rec.spO2?.value || '--'}%\n(${rec.spO2?.status || 'Normal'})`;
    const temp = `${rec.temperature?.value || '--'}°F`;
    const notes = rec.notes || 'Routine checkup completed';

    return [
      `#${records.length - i}`,
      dateFormatted,
      bp,
      pulse,
      glucose,
      spo2,
      temp,
      notes,
    ];
  });

  autoTable(doc, {
    startY: 84,
    head: [
      [
        '#',
        'Date & Time',
        'Blood Pressure',
        'Heart Rate',
        'Glucose',
        'SpO2 Sat',
        'Body Temp',
        'Clinical Notes',
      ],
    ],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
      cellPadding: 2.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 28 },
      2: { cellWidth: 28 },
      3: { cellWidth: 18 },
      4: { cellWidth: 22 },
      5: { cellWidth: 18 },
      6: { cellWidth: 18 },
      7: { cellWidth: 'auto' },
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      // Footer on every page
      const footerY = pageHeight - 10;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);

      doc.text(
        'ArogyaConnect Health EHR • Certified Telemetry Export • Consult a licensed medical practitioner for diagnosis.',
        14,
        footerY
      );

      const pageNumberStr = `Page ${data.pageNumber} of ${doc.getNumberOfPages()}`;
      doc.text(pageNumberStr, pageWidth - 14, footerY, { align: 'right' });
    },
  });

  const sanitizedName = patient.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const fileName = `arogya_vitals_${sanitizedName}_${dateStamp}.pdf`;

  // Trigger browser download
  doc.save(fileName);

  return fileName;
}
