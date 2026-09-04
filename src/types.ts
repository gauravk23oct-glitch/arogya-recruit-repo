export type UserRole = 'patient' | 'asha' | 'doctor';

export type LanguageCode = 'en' | 'hi' | 'mr' | 'bn' | 'ta' | 'te' | 'gu' | 'kn' | 'pa';

export interface LanguageOption {
  code: LanguageCode;
  name: string;
  native: string;
  flag: string;
  voiceGreeting: string;
}

export interface VitalsData {
  id: string;
  timestamp: string;
  bloodPressure: {
    systolic: number;
    diastolic: number;
    unit: string;
    status: 'Normal' | 'Elevated' | 'High (Stage 1)' | 'High (Stage 2)' | 'Low';
  };
  bloodSugar: {
    value: number;
    unit: string;
    type: 'Fasting' | 'Post-Meal' | 'Random';
    status: 'Normal' | 'Pre-diabetes' | 'High' | 'Low';
  };
  spO2: {
    value: number;
    unit: string;
    status: 'Good' | 'Normal' | 'Low' | 'Critical';
  };
  temperature: {
    value: number;
    unit: '°F' | '°C';
    status: 'Normal' | 'Low Grade Fever' | 'High Fever' | 'Hypothermia';
  };
  heartRate: {
    value: number;
    unit: string;
    status: 'Normal' | 'Bradycardia' | 'Tachycardia';
  };
  notes?: string;
  location?: string;
}

export interface AIAnalysisResult {
  overallScore: number; // 0 - 100
  statusSummary: string;
  riskLevel: 'Low' | 'Moderate' | 'High';
  findings: string[];
  recommendations: string[];
  dietaryTips: string[];
  doctorAdvice: string;
  isEmergency: boolean;
}

export interface VoiceTriageResult {
  riskLevel: 'green' | 'yellow' | 'red';
  riskCategory: 'Self-Care & Home Monitoring' | 'Primary Health Centre (PHC) Consult' | 'Immediate Emergency Dispatch (108)';
  title: string;
  summary: string;
  symptomsIdentified: string[];
  recommendedDoctor: string;
  homeRemedies: string[];
  warningSigns: string[];
  followUpQuestions: string[];
  emergencyInstructions?: string;
  audioNarration?: string;
}

export interface PatientProfile {
  name: string;
  abhaId: string;
  age: number;
  gender: string;
  bloodGroup: string;
  phone: string;
  emergencyContact: string;
  avatarUrl: string;
  preferredLanguage: LanguageCode;
  voiceGuidanceEnabled: boolean;
  kioskLocation: string;
  village?: string;
  ward?: string;
}

export interface AshaPatient {
  id: string;
  name: string;
  age: number;
  gender: string;
  village: string;
  ward: string;
  abhaId: string;
  phone: string;
  category: 'anc' | 'child' | 'hypertensive' | 'diabetic' | 'general' | 'elderly' | 'high_risk';
  riskFlag: 'normal' | 'moderate' | 'high';
  lastVitals: VitalsData;
  lastVisitDate: string;
  nextFollowUp: string;
  offlineSyncStatus: 'synced' | 'pending';
  notes: string;
  pregnancyTrimester?: number;
  immunizationDue?: string[];
}

export interface DoctorQueueItem {
  id: string;
  patientId: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  village: string;
  abhaId: string;
  symptoms: string;
  triageRisk: 'green' | 'yellow' | 'red';
  vitals: VitalsData;
  tokenNumber: string;
  waitingSince: string;
  preferredMode: 'video' | 'audio' | 'chat';
  status: 'waiting' | 'in_call' | 'prescribed' | 'referred';
}

export interface OfflineQueueItem {
  id: string;
  type: 'vitals' | 'patient_reg' | 'triage' | 'prescription' | 'followup';
  title: string;
  timestamp: string;
  data: any;
  status: 'pending' | 'synced' | 'failed';
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  subSpecialty?: string;
  category: string;
  qualification: string;
  hospitalAffiliation: string;
  regNumber: string;
  experienceYears: number;
  languages: string[];
  avatarUrl: string;
  rating: number;
  reviewCount: number;
  availableNow: boolean;
  nextSlot?: string;
  consultationFee: string;
  about?: string;
  availableModes?: ('video' | 'audio' | 'chat')[];
  consultationCount?: number;
}

export interface ConsultationMessage {
  id: string;
  sender: 'user' | 'assistant' | 'doctor';
  text: string;
  timestamp: string;
}

export interface PrescriptionMedicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface Prescription {
  id: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorRegNo: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  patientAbhaId: string;
  date: string;
  diagnosis: string;
  medicines: PrescriptionMedicine[];
  generalAdvice: string;
  followUpDays: number;
  signatureStamp: string;
}

export interface HealthMilestone {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  status: 'DONE' | 'SYNC' | 'PENDING';
  percentage: number;
  category: 'vitals' | 'hydration' | 'medication' | 'activity';
}

export interface KioskNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'info' | 'alert' | 'success';
  read: boolean;
}

export type TabType = 'home' | 'health' | 'triage' | 'consult' | 'records' | 'profile' | 'asha' | 'doctor';


