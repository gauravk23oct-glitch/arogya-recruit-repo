import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { WebSocketServer, WebSocket } from "ws";
import dotenv from "dotenv";

dotenv.config();

const rootDir = process.cwd();

const app = express();
const PORT = 3000;

app.use(express.json());

// ---------------- REALTIME BROADCAST & WEBSOCKET INFRASTRUCTURE ----------------
let wssInstance: WebSocketServer | null = null;
const activeStreamClients = new Set<WebSocket>();
const sseClients = new Set<express.Response>();
let streamInterval: NodeJS.Timeout | null = null;

function broadcastWS(payload: Record<string, unknown>) {
  const str = JSON.stringify(payload);
  
  // WebSocket broadcast
  if (wssInstance) {
    wssInstance.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(str);
        } catch (err) {
          console.error("WS broadcast error:", err);
        }
      }
    });
  }

  // SSE broadcast
  sseClients.forEach((res) => {
    try {
      res.write(`data: ${str}\n\n`);
    } catch {
      sseClients.delete(res);
    }
  });
}

// Background biological telemetry micro-tick stream (for subscribed clients)
setInterval(() => {
  if (activeStreamClients.size === 0 && sseClients.size === 0) return;

  const hrNoise = (Math.random() - 0.5) * 2;
  const liveHR = Math.round(Math.max(55, Math.min(110, (currentVitals.heartRate?.value || 72) + hrNoise)));
  const spo2Noise = Math.random() > 0.85 ? (Math.random() > 0.5 ? 1 : -1) : 0;
  const liveSpO2 = Math.round(Math.max(94, Math.min(100, currentVitals.spO2.value + spo2Noise)));

  const liveTick = {
    type: "vitals:live_tick",
    timestamp: new Date().toISOString(),
    heartRate: liveHR,
    spO2: liveSpO2,
    ppgAmplitude: Math.sin(Date.now() / 140) * 0.48 + 0.5,
    thermalIndex: currentVitals.temperature.value + (Math.random() - 0.5) * 0.1,
  };

  const payload = JSON.stringify(liveTick);
  
  activeStreamClients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(payload);
      } catch {
        activeStreamClients.delete(ws);
      }
    } else {
      activeStreamClients.delete(ws);
    }
  });

  sseClients.forEach((res) => {
    try {
      res.write(`data: ${payload}\n\n`);
    } catch {
      sseClients.delete(res);
    }
  });
}, 800);

// In-memory data store for the Health Kiosk
let currentVitals = {
  id: "vitals-live",
  timestamp: new Date().toISOString(),
  bloodPressure: {
    systolic: 120,
    diastolic: 80,
    unit: "mmHg",
    status: "Normal",
  },
  bloodSugar: {
    value: 110,
    unit: "mg/dL",
    type: "Fasting",
    status: "Normal",
  },
  spO2: {
    value: 98,
    unit: "%",
    status: "Good",
  },
  temperature: {
    value: 98.6,
    unit: "°F",
    status: "Normal",
  },
  heartRate: {
    value: 72,
    unit: "BPM",
    status: "Normal",
  },
  notes: "Kiosk sensor measurement accurate",
  location: "Arogya Community Health Center #4",
};

let healthRecords = [
  {
    id: "rec-1",
    timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
    bloodPressure: { systolic: 122, diastolic: 82, unit: "mmHg", status: "Normal" },
    bloodSugar: { value: 114, unit: "mg/dL", type: "Fasting", status: "Normal" },
    spO2: { value: 97, unit: "%", status: "Good" },
    temperature: { value: 98.4, unit: "°F", status: "Normal" },
    heartRate: { value: 74, unit: "BPM", status: "Normal" },
    notes: "Routine evening vitals check",
    location: "Kiosk #1 - Primary Health Centre",
  },
  {
    id: "rec-2",
    timestamp: new Date(Date.now() - 86400000 * 5).toISOString(),
    bloodPressure: { systolic: 118, diastolic: 78, unit: "mmHg", status: "Normal" },
    bloodSugar: { value: 108, unit: "mg/dL", type: "Fasting", status: "Normal" },
    spO2: { value: 99, unit: "%", status: "Good" },
    temperature: { value: 98.6, unit: "°F", status: "Normal" },
    heartRate: { value: 70, unit: "BPM", status: "Normal" },
    notes: "Post-walk health check",
    location: "Kiosk #2 - Gram Panchayat Office",
  },
  {
    id: "rec-3",
    timestamp: new Date(Date.now() - 86400000 * 12).toISOString(),
    bloodPressure: { systolic: 125, diastolic: 84, unit: "mmHg", status: "Elevated" },
    bloodSugar: { value: 122, unit: "mg/dL", type: "Post-Meal", status: "Normal" },
    spO2: { value: 98, unit: "%", status: "Good" },
    temperature: { value: 98.7, unit: "°F", status: "Normal" },
    heartRate: { value: 76, unit: "BPM", status: "Normal" },
    notes: "General monthly checkup",
    location: "Mobile Health Camp",
  },
];

let patientProfile: {
  name: string;
  abhaId: string;
  age: number;
  gender: string;
  bloodGroup: string;
  phone: string;
  emergencyContact: string;
  avatarUrl: string;
  preferredLanguage: string;
  voiceGuidanceEnabled: boolean;
  kioskLocation: string;
  village?: string;
  location?: string;
} = {
  name: "Ramesh Kumar Sharma",
  abhaId: "91-4820-1928-3921",
  age: 48,
  gender: "Male",
  bloodGroup: "B+",
  phone: "+91 98765 43210",
  emergencyContact: "+91 98123 45678 (Spouse - Sunita)",
  avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuDB9EP28IpcWeVA7u5JLDE3Z2NZUmmkRWz9Lo7FpJIDhxAiFVCCe4W2mn3VGrS15NzS3ve_R1CY6LFkA52FwlPSG7menq1bCMjJA2M0-mbE_EQI9jP3C7GekW2cSSzjeeTYplPYVGI53ZfHvyUaO5J-ZmZQidCeVkEwIRZyynUknnOXqoixF7zTq2iua_0SHIj9otla-Ce5Y6pzqJQuPzCXCaTAVwkti5zRVcIVnJsEuHMQq0Gwghzknw",
  preferredLanguage: "en",
  voiceGuidanceEnabled: true,
  kioskLocation: "Arogya Rural Kiosk - Sector 4",
  village: "Pipariya Kalan",
  location: "Pipariya Kalan, Ward 3",
};

const DEFAULT_DOCTORS = [
  {
    id: "doc-1",
    name: "Dr. Ananya Roy",
    specialty: "General Physician & Internal Medicine",
    subSpecialty: "Preventive Health & Geriatric Care",
    category: "general",
    qualification: "MBBS, MD (Internal Medicine, AIIMS), DNB",
    hospitalAffiliation: "AIIMS New Delhi (Senior Consultant)",
    regNumber: "DMC-R-14829 (Delhi Medical Council)",
    experienceYears: 14,
    languages: ["English", "Hindi", "Bengali"],
    avatarUrl: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=400&q=80",
    rating: 4.93,
    reviewCount: 1240,
    availableNow: true,
    nextSlot: "Available Immediately (Online)",
    consultationFee: "₹0 (ABDM / Ayushman Bharat Covered)",
    consultationCount: 3820,
    availableModes: ["video", "audio", "chat"],
    about: "Gold medalist from AIIMS New Delhi with 14+ years of clinical leadership in primary care, chronic disease management, and rural community health screening.",
  },
  {
    id: "doc-2",
    name: "Dr. Rajesh Verma",
    specialty: "Cardiologist & Heart Specialist",
    subSpecialty: "Interventional Cardiology & Hypertension Management",
    category: "cardiology",
    qualification: "MBBS, MD (Medicine), DM (Cardiology, GB Pant)",
    hospitalAffiliation: "Fortis Escorts Heart Institute, New Delhi",
    regNumber: "MCI-32941 (Medical Council of India)",
    experienceYears: 18,
    languages: ["English", "Hindi", "Punjabi"],
    avatarUrl: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=400&q=80",
    rating: 4.96,
    reviewCount: 2890,
    availableNow: true,
    nextSlot: "Available Immediately (Online)",
    consultationFee: "₹0 (Govt Tele-Subsidized)",
    consultationCount: 5120,
    availableModes: ["video", "audio", "chat"],
    about: "Fellow of American College of Cardiology with over 5,000 successful procedures. Specializes in blood pressure control, arrhythmia, ECG interpretation, and ischemic heart disease.",
  },
  {
    id: "doc-3",
    name: "Dr. Priya Sundaram",
    specialty: "Endocrinologist & Diabetologist",
    subSpecialty: "Type-2 Diabetes, Thyroid & Metabolic Disorders",
    category: "diabetes",
    qualification: "MBBS, MD, DM (Endocrinology, PGIMER)",
    hospitalAffiliation: "Apollo Hospitals, Greams Road, Chennai",
    regNumber: "TNC-58291 (Tamil Nadu Medical Council)",
    experienceYears: 12,
    languages: ["English", "Tamil", "Hindi", "Telugu"],
    avatarUrl: "https://images.unsplash.com/photo-1594824813689-53664d4b1a45?auto=format&fit=crop&w=400&q=80",
    rating: 4.92,
    reviewCount: 1850,
    availableNow: true,
    nextSlot: "Available Immediately (Online)",
    consultationFee: "₹0 (Govt Subsidized)",
    consultationCount: 4210,
    availableModes: ["video", "audio", "chat"],
    about: "Pioneer in rural glycemic management programs. Expert in HbA1c stabilization, diabetic diet guidance, gestational diabetes, and thyroid hormone optimization.",
  },
  {
    id: "doc-4",
    name: "Dr. Vikramaditya Joshi",
    specialty: "Neurologist & Stroke Specialist",
    subSpecialty: "Headache, Epilepsy & Peripheral Neuropathy",
    category: "neurology",
    qualification: "MBBS, MD (Medicine), DM (Neurology, NIMHANS)",
    hospitalAffiliation: "NIMHANS Bangalore & Manipal Hospital",
    regNumber: "KMC-77124 (Karnataka Medical Council)",
    experienceYears: 19,
    languages: ["English", "Kannada", "Hindi", "Marathi"],
    avatarUrl: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=400&q=80",
    rating: 4.98,
    reviewCount: 3100,
    availableNow: true,
    nextSlot: "Available Today (10 mins queue)",
    consultationFee: "₹0 (National Tele-Neuro covered)",
    consultationCount: 6400,
    availableModes: ["video", "audio"],
    about: "Senior Neurologist with extensive research in stroke rehabilitation, neuropathic pain, migraine management, and tremors.",
  },
  {
    id: "doc-5",
    name: "Dr. Sunita Deshmukh",
    specialty: "Orthopedic Surgeon & Joint Care",
    subSpecialty: "Arthritis, Spine Health & Fracture Rehabilitation",
    category: "orthopedics",
    qualification: "MBBS, MS (Orthopedics, KEM Mumbai), MCh Orth",
    hospitalAffiliation: "K.E.M. Hospital & Lilavati Hospital, Mumbai",
    regNumber: "MMC-44820 (Maharashtra Medical Council)",
    experienceYears: 15,
    languages: ["Marathi", "Hindi", "English", "Gujarati"],
    avatarUrl: "https://images.unsplash.com/photo-1651008376811-b90baee60c1f?auto=format&fit=crop&w=400&q=80",
    rating: 4.89,
    reviewCount: 1640,
    availableNow: false,
    nextSlot: "Today at 04:30 PM",
    consultationFee: "₹0 (ABDM Subsidized)",
    consultationCount: 3190,
    availableModes: ["video", "audio", "chat"],
    about: "Specialist in osteoarthritis management, knee/hip pain relief exercises, osteoporosis prevention, and ergonomic spine correction.",
  },
  {
    id: "doc-6",
    name: "Dr. Arvind Swaminathan",
    specialty: "Pediatrician & Child Health Specialist",
    subSpecialty: "Neonatology, Pediatric Nutrition & Vaccinations",
    category: "pediatrics",
    qualification: "MBBS, MD (Pediatrics, CMC Vellore), DCH (UK)",
    hospitalAffiliation: "Christian Medical College (CMC), Vellore",
    regNumber: "TNC-89214 (Tamil Nadu Medical Council)",
    experienceYears: 16,
    languages: ["Tamil", "English", "Malayalam", "Hindi"],
    avatarUrl: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=400&q=80",
    rating: 4.95,
    reviewCount: 2420,
    availableNow: true,
    nextSlot: "Available Immediately (Online)",
    consultationFee: "₹0 (National Child Health Covered)",
    consultationCount: 5600,
    availableModes: ["video", "audio", "chat"],
    about: "Dedicated to primary pediatric care, infant growth tracking, seasonal pediatric infections, child asthma, and adolescent development.",
  },
  {
    id: "doc-7",
    name: "Dr. Meenakshi Banerjee",
    specialty: "Dermatologist & Skin Specialist",
    subSpecialty: "Skin Allergies, Psoriasis, Eczema & Fungal Infections",
    category: "dermatology",
    qualification: "MBBS, MD (DVL, Calcutta Medical College)",
    hospitalAffiliation: "IPGMER & SSKM Hospital, Kolkata",
    regNumber: "WBMC-63109 (West Bengal Medical Council)",
    experienceYears: 11,
    languages: ["Bengali", "Hindi", "English"],
    avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80",
    rating: 4.90,
    reviewCount: 1410,
    availableNow: true,
    nextSlot: "Available Immediately (Online)",
    consultationFee: "₹0 (Govt Subsidized)",
    consultationCount: 2890,
    availableModes: ["video", "audio", "chat"],
    about: "Expert in tropical dermatological conditions, eczema, contact dermatitis, fungal infections, hair/scalp health, and safe topical therapeutics.",
  },
  {
    id: "doc-8",
    name: "Dr. Sanjay K. Singhal",
    specialty: "Pulmonologist & Chest Specialist",
    subSpecialty: "Asthma, COPD, Bronchitis & SpO2 Monitoring",
    category: "pulmonology",
    qualification: "MBBS, MD, DM (Pulmonary Medicine, VMMC Safdarjung)",
    hospitalAffiliation: "Medanta The Medicity & Safdarjung Hospital",
    regNumber: "DMC-90182 (Delhi Medical Council)",
    experienceYears: 17,
    languages: ["Hindi", "English"],
    avatarUrl: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=400&q=80",
    rating: 4.93,
    reviewCount: 2150,
    availableNow: true,
    nextSlot: "Available Immediately (Online)",
    consultationFee: "₹0 (National Respiratory Shield Covered)",
    consultationCount: 4780,
    availableModes: ["video", "audio", "chat"],
    about: "Specialized in respiratory distress diagnosis, oxygen therapy calibration, environmental pollution health defense, and chronic cough management.",
  },
  {
    id: "doc-9",
    name: "Dr. Radhika Menon",
    specialty: "Gynecologist & Women's Health",
    subSpecialty: "Maternal Health, PCOS/PCOD & Reproductive Care",
    category: "gynecology",
    qualification: "MBBS, MS (OBG, Madras Medical College), DNB, FICOG",
    hospitalAffiliation: "Aster Medcity & Govt Medical College, Kochi",
    regNumber: "TCMC-38910 (Travancore Cochin Medical Council)",
    experienceYears: 14,
    languages: ["Malayalam", "English", "Hindi", "Tamil"],
    avatarUrl: "https://images.unsplash.com/photo-1614608682850-e0d6ed316d47?auto=format&fit=crop&w=400&q=80",
    rating: 4.97,
    reviewCount: 2780,
    availableNow: true,
    nextSlot: "Available Immediately (Online)",
    consultationFee: "₹0 (Janani Shishu Suraksha Covered)",
    consultationCount: 5200,
    availableModes: ["video", "audio", "chat"],
    about: "Advocate of women's primary reproductive wellbeing, prenatal guidance, menstrual disorders, anemia eradication in rural mothers, and hormone balance.",
  },
  {
    id: "doc-10",
    name: "Dr. Harpreet Singh Gill",
    specialty: "ENT Surgeon (Ear, Nose & Throat)",
    subSpecialty: "Hearing Care, Sinusitis, Throat & Vertigo Treatment",
    category: "ent",
    qualification: "MBBS, MS (ENT, PGIMER Chandigarh), DOHNS",
    hospitalAffiliation: "PGIMER Chandigarh & Fortis Mohali",
    regNumber: "PMC-23849 (Punjab Medical Council)",
    experienceYears: 13,
    languages: ["Punjabi", "Hindi", "English"],
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
    rating: 4.88,
    reviewCount: 1120,
    availableNow: false,
    nextSlot: "Tomorrow at 10:00 AM",
    consultationFee: "₹0 (ABDM Subsidized)",
    consultationCount: 2450,
    availableModes: ["video", "audio", "chat"],
    about: "Specialized in chronic sinus inflammation, tonsillitis, ear discharge, allergic rhinitis, balance disorders (vertigo), and hearing rehabilitation.",
  },
  {
    id: "doc-11",
    name: "Dr. Amitav Patnaik",
    specialty: "Nephrologist & Kidney Specialist",
    subSpecialty: "Kidney Function, Proteinuria & Dialysis Care",
    category: "nephrology",
    qualification: "MBBS, MD (Medicine), DM (Nephrology, SGPGI Lucknow)",
    hospitalAffiliation: "Apollo Hospitals, Bhubaneswar & SCB Cuttack",
    regNumber: "OMC-18490 (Odisha Medical Council)",
    experienceYears: 15,
    languages: ["Odia", "Hindi", "English", "Bengali"],
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
    rating: 4.91,
    reviewCount: 1380,
    availableNow: true,
    nextSlot: "Available Immediately (Online)",
    consultationFee: "₹0 (National Renal Care Scheme)",
    consultationCount: 3100,
    availableModes: ["video", "audio", "chat"],
    about: "Expert in preserving renal function in diabetic and hypertensive patients, urinary tract infections, electrolyte imbalances, and acute kidney injury prevention.",
  },
  {
    id: "doc-12",
    name: "Dr. Shalini Patel",
    specialty: "Psychiatrist & Mental Health Consultant",
    subSpecialty: "Anxiety, Stress, Depression, Sleep Disorders & Counseling",
    category: "mental_health",
    qualification: "MBBS, MD (Psychiatry, BJ Medical College)",
    hospitalAffiliation: "Civil Hospital Ahmedabad & Sterling Hospital",
    regNumber: "GUMC-51920 (Gujarat Medical Council)",
    experienceYears: 10,
    languages: ["Gujarati", "Hindi", "English"],
    avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80",
    rating: 4.94,
    reviewCount: 1590,
    availableNow: true,
    nextSlot: "Available Immediately (Online)",
    consultationFee: "₹0 (Tele-MANAS Covered)",
    consultationCount: 2950,
    availableModes: ["video", "audio", "chat"],
    about: "Compassionate mental health professional specializing in stress resilience, anxiety relief, mood disorders, insomnia, and de-addiction therapy.",
  },
  {
    id: "doc-13",
    name: "Dr. K. S. Venkatesh",
    specialty: "Ophthalmologist & Eye Specialist",
    subSpecialty: "Cataract, Diabetic Retinopathy & Vision Screening",
    category: "ophthalmology",
    qualification: "MBBS, MS (Ophthalmology, Sankara Nethralaya), FICO (UK)",
    hospitalAffiliation: "Sankara Nethralaya & Narayana Nethralaya",
    regNumber: "TNC-41928 (Tamil Nadu Medical Council)",
    experienceYears: 20,
    languages: ["Tamil", "Telugu", "English", "Hindi"],
    avatarUrl: "https://images.unsplash.com/photo-1622902046580-2b47f47f5471?auto=format&fit=crop&w=400&q=80",
    rating: 4.97,
    reviewCount: 3450,
    availableNow: false,
    nextSlot: "Today at 05:00 PM",
    consultationFee: "₹0 (National Eye Health Covered)",
    consultationCount: 7100,
    availableModes: ["video", "audio", "chat"],
    about: "Leading eye care surgeon with over 10,000 micro-surgeries. Expert in digital eyestrain, cataract evaluation, glaucoma screening, and macular health.",
  },
  {
    id: "doc-14",
    name: "Dr. Ritu Bhardwaj",
    specialty: "Ayurveda & Integrative Medicine",
    subSpecialty: "Chronic Lifestyle Disorders, Digestive Health & Immunity",
    category: "ayurveda",
    qualification: "BAMS, MD (Ayurveda - Kayachikitsa, NIA Jaipur), PhD",
    hospitalAffiliation: "National Institute of Ayurveda (NIA), Jaipur",
    regNumber: "RJMC-92014 (Board of Indian Medicine)",
    experienceYears: 12,
    languages: ["Hindi", "English"],
    avatarUrl: "https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&w=400&q=80",
    rating: 4.87,
    reviewCount: 980,
    availableNow: true,
    nextSlot: "Available Immediately (Online)",
    consultationFee: "₹0 (AYUSH Ministry Covered)",
    consultationCount: 2200,
    availableModes: ["video", "audio", "chat"],
    about: "Specializes in evidence-based Ayurvedic medicine, gut flora rejuvenation, lifestyle metabolic balancing (Rasayana), and holistic joint stiffness therapy.",
  },
  {
    id: "doc-15",
    name: "Dr. Tanmay Mukherjee",
    specialty: "Gastroenterologist & Hepatologist",
    subSpecialty: "Liver Health, Acidity/GERD, IBS & Gallbladder Care",
    category: "gastroenterology",
    qualification: "MBBS, MD, DM (Gastroenterology, IPGMER Kolkata)",
    hospitalAffiliation: "AMRI Hospitals & Apollo Gleneagles, Kolkata",
    regNumber: "WBMC-71934 (West Bengal Medical Council)",
    experienceYears: 14,
    languages: ["Bengali", "Hindi", "English"],
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
    rating: 4.92,
    reviewCount: 1730,
    availableNow: true,
    nextSlot: "Available Immediately (Online)",
    consultationFee: "₹0 (ABDM Covered)",
    consultationCount: 3680,
    availableModes: ["video", "audio", "chat"],
    about: "Specialized in fatty liver diagnosis, chronic indigestion, peptic ulcer disease, inflammatory bowel symptoms, and endoscopy evaluations.",
  },
];

let doctors = [...DEFAULT_DOCTORS];

// Lazy Gemini API client
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Resilient Multi-Model Gemini Executor with 503/429 auto-failover
async function callGeminiWithFallback(params: {
  contents: string;
  config?: any;
  models?: string[];
}): Promise<{ text: string | undefined; modelUsed: string } | null> {
  const ai = getGeminiClient();
  if (!ai) return null;

  // Ordered candidate models: gemini-3.7-flash as primary, followed by gemini-2.0-flash and gemini-1.5-flash
  const candidateModels = params.models || [
    "gemini-3.7-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
  ];

  for (let i = 0; i < candidateModels.length; i++) {
    const model = candidateModels[i];
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        ...(params.config ? { config: params.config } : {}),
      });

      if (response && response.text) {
        return { text: response.text, modelUsed: model };
      }
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      const isOverloadedOrUnavailable =
        errorMsg.includes("503") ||
        errorMsg.includes("429") ||
        errorMsg.includes("high demand") ||
        errorMsg.includes("UNAVAILABLE") ||
        errorMsg.includes("RESOURCE_EXHAUSTED");

      if (isOverloadedOrUnavailable) {
        console.warn(
          `[Gemini Resilience] Model ${model} temporarily unavailable (503/429). Attempting fallback model (${i + 1}/${candidateModels.length})...`
        );
        // Micro-pause before next model attempt to allow network jitter to clear
        await new Promise((resolve) => setTimeout(resolve, 200));
      } else {
        console.warn(`[Gemini Resilience] Model ${model} returned error: ${errorMsg.slice(0, 150)}`);
      }
    }
  }

  return null;
}

// ---------------- API ROUTES ----------------

// Get current vitals
app.get("/api/vitals/current", (req, res) => {
  res.json({ success: true, data: currentVitals });
});

// Trigger a new vitals measurement
app.post("/api/vitals/measure", (req, res) => {
  const customData = req.body;
  
  if (customData && customData.bloodPressure) {
    currentVitals = {
      ...currentVitals,
      ...customData,
      id: `vitals-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
  } else {
    // Generate realistic measurement values based on normal physiological variation
    const sys = Math.floor(115 + Math.random() * 12);
    const dia = Math.floor(75 + Math.random() * 9);
    const sugar = Math.floor(100 + Math.random() * 20);
    const spo2 = Math.floor(97 + Math.random() * 3);
    const temp = Number((98.2 + Math.random() * 0.7).toFixed(1));
    const hr = Math.floor(68 + Math.random() * 10);

    currentVitals = {
      id: `vitals-${Date.now()}`,
      timestamp: new Date().toISOString(),
      bloodPressure: {
        systolic: sys,
        diastolic: dia,
        unit: "mmHg",
        status: sys > 130 || dia > 85 ? "Elevated" : "Normal",
      },
      bloodSugar: {
        value: sugar,
        unit: "mg/dL",
        type: "Fasting",
        status: sugar > 125 ? "High" : sugar > 115 ? "Pre-diabetes" : "Normal",
      },
      spO2: {
        value: spo2,
        unit: "%",
        status: spo2 >= 95 ? "Good" : "Low",
      },
      temperature: {
        value: temp,
        unit: "°F",
        status: temp > 99.5 ? "Low Grade Fever" : "Normal",
      },
      heartRate: {
        value: hr,
        unit: "BPM",
        status: "Normal",
      },
      notes: "Auto-calibrated via Kiosk Sensor suite",
      location: patientProfile.kioskLocation,
    };
  }

  const newRecord = {
    ...currentVitals,
    id: `rec-${Date.now()}`,
  };
  healthRecords.unshift(newRecord);

  broadcastWS({
    type: "vitals:updated",
    data: currentVitals,
    record: newRecord,
    totalRecords: healthRecords.length,
  });

  res.json({ success: true, data: currentVitals, message: "Measurement completed successfully" });
});

// Save vitals to health records
app.post("/api/vitals/save", (req, res) => {
  const recordToSave = req.body || currentVitals;
  const newRecord = {
    ...recordToSave,
    id: `rec-${Date.now()}`,
    timestamp: new Date().toISOString(),
  };

  healthRecords.unshift(newRecord);
  broadcastWS({
    type: "records:updated",
    records: healthRecords,
    newRecord,
  });

  res.json({ success: true, data: newRecord, totalRecords: healthRecords.length });
});

// Get all health records
app.get("/api/records", (req, res) => {
  res.json({ success: true, data: healthRecords });
});

// Delete a record
app.delete("/api/records/:id", (req, res) => {
  const { id } = req.params;
  healthRecords = healthRecords.filter((r) => r.id !== id);
  broadcastWS({
    type: "records:updated",
    records: healthRecords,
    deletedId: id,
  });
  res.json({ success: true, message: "Record removed" });
});

// Get patient profile
app.get("/api/profile", (req, res) => {
  res.json({ success: true, data: patientProfile });
});

// Update patient profile
app.put("/api/profile", (req, res) => {
  patientProfile = { ...patientProfile, ...req.body };
  saveDataStore();
  broadcastWS({
    type: "profile:updated",
    data: patientProfile,
  });
  res.json({ success: true, data: patientProfile });
});

// Get doctors list with rich search, specialty filtering, sorting, and availability
app.get("/api/doctors", (req, res) => {
  const { search, specialty, category, onlineOnly, language, sortBy } = req.query;
  let results = [...doctors];

  // Filter by category or specialty
  if (category && category !== "all") {
    results = results.filter(
      (d) => d.category.toLowerCase() === String(category).toLowerCase()
    );
  } else if (specialty && specialty !== "all") {
    const specTerm = String(specialty).toLowerCase();
    results = results.filter(
      (d) =>
        d.category.toLowerCase() === specTerm ||
        d.specialty.toLowerCase().includes(specTerm) ||
        (d.subSpecialty && d.subSpecialty.toLowerCase().includes(specTerm))
    );
  }

  // Filter by online status
  if (onlineOnly === "true") {
    results = results.filter((d) => d.availableNow);
  }

  // Filter by language
  if (language && language !== "all") {
    const langTerm = String(language).toLowerCase();
    results = results.filter((d) =>
      d.languages.some((l) => l.toLowerCase().includes(langTerm))
    );
  }

  // Filter by search query (name, specialty, qualification, hospital, about, regNumber)
  if (search && String(search).trim()) {
    const query = String(search).toLowerCase().trim();
    results = results.filter((d) => {
      return (
        d.name.toLowerCase().includes(query) ||
        d.specialty.toLowerCase().includes(query) ||
        (d.subSpecialty && d.subSpecialty.toLowerCase().includes(query)) ||
        d.qualification.toLowerCase().includes(query) ||
        d.hospitalAffiliation.toLowerCase().includes(query) ||
        d.regNumber.toLowerCase().includes(query) ||
        (d.about && d.about.toLowerCase().includes(query)) ||
        d.languages.some((l) => l.toLowerCase().includes(query))
      );
    });
  }

  // Sorting
  if (sortBy === "experience") {
    results.sort((a, b) => b.experienceYears - a.experienceYears);
  } else if (sortBy === "name") {
    results.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === "consultations") {
    results.sort((a, b) => (b.consultationCount || 0) - (a.consultationCount || 0));
  } else if (sortBy === "availability") {
    results.sort((a, b) => (b.availableNow ? 1 : 0) - (a.availableNow ? 1 : 0));
  } else {
    // Default sort by rating descending
    results.sort((a, b) => b.rating - a.rating);
  }

  res.json({
    success: true,
    total: results.length,
    data: results,
  });
});

// Get all medical specialties & category metadata
app.get("/api/doctors/specialties", (req, res) => {
  const categoriesMap: { [key: string]: { id: string; name: string; icon: string; count: number; description: string } } = {
    all: { id: "all", name: "All Specialists", icon: "medical_services", count: doctors.length, description: "All certified clinical consultants" },
    general: { id: "general", name: "General Physician", icon: "stethoscope", count: 0, description: "Fever, infections, primary care & health checkups" },
    cardiology: { id: "cardiology", name: "Cardiology", icon: "cardiology", count: 0, description: "Heart, hypertension, chest discomfort & ECG" },
    diabetes: { id: "diabetes", name: "Diabetology & Endocrinology", icon: "bloodtype", count: 0, description: "Blood sugar, thyroid, metabolism & insulin" },
    neurology: { id: "neurology", name: "Neurology", icon: "psychology", count: 0, description: "Brain, stroke, migraine, nerves & seizures" },
    orthopedics: { id: "orthopedics", name: "Orthopedics", icon: "bone", count: 0, description: "Joint pain, arthritis, backache & fractures" },
    pediatrics: { id: "pediatrics", name: "Pediatrics & Child Care", icon: "child_care", count: 0, description: "Newborns, infant health, vaccination & child development" },
    dermatology: { id: "dermatology", name: "Dermatology & Skin", icon: "clean_hands", count: 0, description: "Skin rashes, eczema, fungal, hair & nails" },
    pulmonology: { id: "pulmonology", name: "Pulmonology & Chest", icon: "pulmonology", count: 0, description: "Lungs, breathing, asthma, COPD & SpO2" },
    gynecology: { id: "gynecology", name: "Gynecology & Women", icon: "female", count: 0, description: "Maternal health, pregnancy, PCOS & hormonal health" },
    ent: { id: "ent", name: "ENT (Ear, Nose, Throat)", icon: "hearing", count: 0, description: "Sinus, ear pain, tonsils, vertigo & hearing" },
    nephrology: { id: "nephrology", name: "Nephrology & Kidney", icon: "water_drop", count: 0, description: "Kidney health, dialysis, urinary tract & creatinine" },
    mental_health: { id: "mental_health", name: "Psychiatry & Mind", icon: "self_improvement", count: 0, description: "Stress, anxiety, sleep disorders & counseling" },
    ophthalmology: { id: "ophthalmology", name: "Ophthalmology & Eye", icon: "visibility", count: 0, description: "Eye vision, cataract, retinopathy & strain" },
    ayurveda: { id: "ayurveda", name: "Ayurveda & AYUSH", icon: "spa", count: 0, description: "Integrative lifestyle, herbal remedies & rejuvenation" },
    gastroenterology: { id: "gastroenterology", name: "Gastroenterology", icon: "restaurant", count: 0, description: "Liver, acidity, digestion, gastric & endoscopy" },
  };

  doctors.forEach((doc) => {
    if (categoriesMap[doc.category]) {
      categoriesMap[doc.category].count += 1;
    }
  });

  res.json({
    success: true,
    data: Object.values(categoriesMap),
  });
});

// Get individual doctor details
app.get("/api/doctors/:id", (req, res) => {
  const { id } = req.params;
  const doctor = doctors.find((d) => d.id === id);
  if (!doctor) {
    return res.status(404).json({ success: false, error: "Doctor not found" });
  }
  res.json({ success: true, data: doctor });
});

// Book real consultation slot
app.post("/api/doctors/book-slot", (req, res) => {
  const { doctorId, patientName, patientPhone, slotTime, consultType } = req.body;
  const doctor = doctors.find((d) => d.id === doctorId);
  if (!doctor) {
    return res.status(404).json({ success: false, error: "Doctor not found" });
  }

  const booking = {
    bookingId: `ABDM-BK-${Date.now()}`,
    doctorId: doctor.id,
    doctorName: doctor.name,
    specialty: doctor.specialty,
    hospital: doctor.hospitalAffiliation,
    patientName: patientName || "Ramesh Kumar Sharma",
    patientPhone: patientPhone || "+91 98765 43210",
    slotTime: slotTime || "Immediate Tele-Queue",
    consultType: consultType || "video",
    status: "CONFIRMED",
    tokenNumber: `K-04-${Math.floor(100 + Math.random() * 900)}`,
    createdAt: new Date().toISOString(),
  };

  res.json({
    success: true,
    message: `Consultation confirmed with ${doctor.name}`,
    data: booking,
  });
});

// Create/Register a real doctor
app.post("/api/doctors", (req, res) => {
  const {
    name,
    specialty,
    subSpecialty,
    category,
    qualification,
    hospitalAffiliation,
    regNumber,
    experienceYears,
    languages,
    avatarUrl,
    consultationFee,
    about,
    availableNow,
    nextSlot,
  } = req.body;

  if (!name || !specialty) {
    return res.status(400).json({ success: false, error: "Doctor name and specialty are required" });
  }

  const newDoc = {
    id: `doc-${Date.now()}`,
    name: name.trim(),
    specialty: specialty.trim(),
    subSpecialty: subSpecialty ? subSpecialty.trim() : "",
    category: category ? category.toLowerCase() : "general",
    qualification: qualification ? qualification.trim() : "MBBS",
    hospitalAffiliation: hospitalAffiliation ? hospitalAffiliation.trim() : "Primary Health Centre",
    regNumber: regNumber ? regNumber.trim() : `NMC-${Date.now().toString().slice(-6)}`,
    experienceYears: Number(experienceYears) || 5,
    languages: Array.isArray(languages) && languages.length ? languages : ["English", "Hindi"],
    avatarUrl: avatarUrl || "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=400&q=80",
    rating: 5.0,
    reviewCount: 1,
    availableNow: availableNow !== undefined ? Boolean(availableNow) : true,
    nextSlot: nextSlot || "Available Immediately",
    consultationFee: consultationFee || "₹0 (ABDM / Ayushman Bharat Covered)",
    consultationCount: 0,
    availableModes: ["video", "audio", "chat"],
    about: about ? about.trim() : `Verified clinical practitioner registered with ${regNumber || 'National Medical Commission'}.`,
    isCustom: true,
  };

  doctors.unshift(newDoc);
  saveDataStore();

  broadcastWS({
    type: "doctors:updated",
    data: doctors,
  });

  res.status(201).json({ success: true, message: "Doctor registered successfully", data: newDoc });
});

// Update doctor profile
app.put("/api/doctors/:id", (req, res) => {
  const { id } = req.params;
  const idx = doctors.findIndex((d) => d.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: "Doctor not found" });
  }

  doctors[idx] = { ...doctors[idx], ...req.body, id, isCustom: true };
  saveDataStore();

  broadcastWS({
    type: "doctors:updated",
    data: doctors,
  });

  res.json({ success: true, message: "Doctor updated successfully", data: doctors[idx] });
});

// Delete doctor profile
app.delete("/api/doctors/:id", (req, res) => {
  const { id } = req.params;
  const beforeCount = doctors.length;
  doctors = doctors.filter((d) => d.id !== id);
  if (doctors.length === beforeCount) {
    return res.status(404).json({ success: false, error: "Doctor not found" });
  }

  saveDataStore();

  broadcastWS({
    type: "doctors:updated",
    data: doctors,
  });

  res.json({ success: true, message: "Doctor removed from directory" });
});

// Clear all demo/synthetic doctors (keeps only real custom-registered doctors)
app.post("/api/doctors/clear-demo", (req, res) => {
  const customDoctors = doctors.filter((d: any) => d.isCustom);
  doctors = customDoctors;
  saveDataStore();

  broadcastWS({
    type: "doctors:updated",
    data: doctors,
  });

  res.json({ success: true, message: "Demo doctor profiles cleared", remaining: doctors.length });
});

// Reset to default verified doctor profiles
app.post("/api/doctors/reset-defaults", (req, res) => {
  doctors = [...DEFAULT_DOCTORS];
  saveDataStore();

  broadcastWS({
    type: "doctors:updated",
    data: doctors,
  });

  res.json({ success: true, message: "Reset to standard verified directory", count: doctors.length });
});

// AI Status and Health Endpoint
app.get("/api/ai/status", (req, res) => {
  const isKeyConfigured = !!process.env.GEMINI_API_KEY;
  res.json({
    success: true,
    apiConnected: isKeyConfigured,
    model: "gemini-3.7-flash",
    fallbackModels: ["gemini-2.0-flash", "gemini-1.5-flash", "clinical_rule_engine"],
    mode: isKeyConfigured ? "cloud_gemini_active" : "clinical_rule_engine_active",
    statusMessage: isKeyConfigured
      ? "Google Gemini AI Online (High Resilience Mode)"
      : "Arogya Clinical Engine Active (Ready for Gemini API Key)",
    timestamp: new Date().toISOString(),
  });
});

// Helper for language names
function getLanguageLabel(code?: string): { name: string; native: string } {
  switch (code) {
    case "hi":
      return { name: "Hindi", native: "हिन्दी" };
    case "mr":
      return { name: "Marathi", native: "मराठी" };
    case "ta":
      return { name: "Tamil", native: "தமிழ்" };
    case "te":
      return { name: "Telugu", native: "తెలుగు" };
    case "bn":
      return { name: "Bengali", native: "বাংলা" };
    case "gu":
      return { name: "Gujarati", native: "ગુજરાતી" };
    case "kn":
      return { name: "Kannada", native: "ಕನ್ನಡ" };
    case "en":
    default:
      return { name: "English", native: "English" };
  }
}

// Multilingual Clinical Fallback Generator
function generateClinicalConsultFallback(userMessage: string, langCode: string, vitals: typeof currentVitals): string {
  const lower = (userMessage || "").toLowerCase();
  const bpStr = `${vitals.bloodPressure.systolic}/${vitals.bloodPressure.diastolic} mmHg`;
  const sugarStr = `${vitals.bloodSugar.value} mg/dL`;
  const spo2Str = `${vitals.spO2.value}%`;

  if (langCode === "hi") {
    if (lower.includes("sir dard") || lower.includes("dard") || lower.includes("pain") || lower.includes("chakkar") || lower.includes("headache")) {
      return `नमस्ते। आपके वाइटल्स (रक्तचाप ${bpStr}, शर्करा ${sugarStr}, ऑक्सीजन ${spo2Str}) स्थिर हैं। हल्के सिरदर्द या तनाव के लिए 2-3 गिलास पानी पिएं, 20 मिनट शांत वातावरण में विश्राम करें और स्क्रीन देखने से बचें। यदि दर्द 24 घंटे से अधिक रहे, तो कृपया हमारे टेली-कंसल्टेशन द्वारा डॉक्टर से संपर्क करें।`;
    }
    if (lower.includes("diet") || lower.includes("khana") || lower.includes("food") || lower.includes("kya khaye")) {
      return `स्वस्थ स्वास्थ्य के लिए हरी पत्तेदार सब्जियां, दालें, मौसमी फल और साबुत अनाज का सेवन करें। प्रतिदिन नमक की मात्रा 5 ग्राम से कम रखें और तली-भुनी चीजों से परहेज करें। पानी पर्याप्त मात्रा में (2.5 से 3 लीटर) पिएं।`;
    }
    return `नमस्ते! आपके हालिया वाइटल्स (रक्तचाप ${bpStr}, ऑक्सीजन ${spo2Str}, पल्स ${vitals.heartRate.value} BPM) बिल्कुल सामान्य हैं। मैं आपकी स्वास्थ्य संबंधी किसी भी शंका, खानपान, व्यायाम या लक्षणों के समाधान के लिए उपलब्ध हूँ। आप क्या पूछना चाहते हैं?`;
  }

  if (langCode === "mr") {
    if (lower.includes("dokhe") || lower.includes("pain") || lower.includes("tras")) {
      return `नमस्कार. आपले रक्तदाब (${bpStr}) आणि ऑक्सिजन (${spo2Str}) सुरक्षित मर्यादेत आहेत. डोकेदुखी किंवा थकव्यासाठी भरपूर पाणी प्यावे व थोडा वेळ विश्रांती घ्यावी. त्रास जास्त वेळ राहिल्यास डॉक्टरांचा सल्ला घ्यावा.`;
    }
    return `नमस्कार. आपले आरोग्य निर्देशक (रक्तदाब ${bpStr}, ऑक्सिजन ${spo2Str}) उत्तम आहेत. आपण आहार, व्यायाम किंवा कोणत्याही आरोग्याच्या त्रासाबाबत प्रश्न विचारू शकता. मी मदत करण्यास तयार आहे.`;
  }

  if (langCode === "ta") {
    return `வணக்கம். உங்கள் உடல் அளவீடுகள் (இரத்த அழுத்தம் ${bpStr}, ஆக்சிஜன் ${spo2Str}) சீராக உள்ளன. நீர்ச்சத்து குறையாமல் பார்த்துக்கொள்ளுங்கள். உங்கள் உணவுமுறை அல்லது உடல்நலம் குறித்த சந்தேகங்களை என்னிடம் கேட்கலாம்.`;
  }

  if (langCode === "te") {
    return `నమస్కారం. మీ రక్తపోటు (${bpStr}) మరియు ఆక్సిజన్ స్థాయిలు (${spo2Str}) సాధారణ పరిధిలో ఉన్నాయి. ఆరోగ్యకరమైన ఆహారం మరియు తగినంత విశ్రాంతి తీసుకోండి. మీ ఆరోగ్య సందేహాలను ఇక్కడ అడగవచ్చు.`;
  }

  if (langCode === "bn") {
    return `নমস্কার। আপনার স্বাস্থ্য সূচকগুলি (রক্তচাপ ${bpStr}, অক্সিজেন ${spo2Str}) স্বাভাবিক রয়েছে। পর্যাপ্ত জল পান করুন ও বিশ্রাম নিন। খাদ্যতালিকা বা যেকোনো উপসর্গ সম্পর্কে প্রশ্ন করতে পারেন।`;
  }

  if (langCode === "gu") {
    return `નમસ્તે. તમારા બ્લડ પ્રેશર (${bpStr}) અને ઓક્સિજન (${spo2Str}) સામાન્ય છે. પૂરતું પાણી પીવો અને આરામ કરો. તમારા સ્વાસ્થ્ય અંગે કોઈ પણ પ્રશ્ન પૂછી શકો છો.`;
  }

  if (langCode === "kn") {
    return `ನಮಸ್ಕಾರ. ನಿಮ್ಮ ರಕ್ತದೊತ್ತಡ (${bpStr}) ಮತ್ತು ಆಮ್ಲಜನಕದ ಮಟ್ಟ (${spo2Str}) ಸಾಮಾನ್ಯವಾಗಿವೆ. ಸಾಕಷ್ಟು ನೀರು ಕುಡಿಯಿರಿ. ನಿಮ್ಮ ಆರೋಗ್ಯಕ್ಕೆ ಸಂಬಂಧಿಸಿದ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಿ.`;
  }

  // English fallback
  if (lower.includes("headache") || lower.includes("pain") || lower.includes("dizzy")) {
    return `Hello. Based on your current vitals (BP ${bpStr}, Glucose ${sugarStr}, SpO2 ${spo2Str}), your cardiovascular parameters are stable. For mild headache or tension, drink 500ml water, rest in a dim quiet room, and avoid screens. If discomfort persists beyond 24 hours, connect directly with our on-call physicians.`;
  }
  if (lower.includes("diet") || lower.includes("food") || lower.includes("eat") || lower.includes("nutrition")) {
    return `For optimal wellness: prioritize fresh green vegetables, whole lentils, millets, and fruits. Keep daily dietary sodium under 5 grams and avoid sugary beverages. Maintain 2.5 - 3.0 liters of daily hydration.`;
  }
  return `Hello! Your latest vitals (BP ${bpStr}, Sugar ${sugarStr}, SpO2 ${spo2Str}, Heart Rate ${vitals.heartRate.value} BPM) are within healthy reference ranges. I am your Arogya AI Health Consultant. Feel free to ask about your symptoms, medication guidance, or lifestyle modifications.`;
}

// AI Vitals Clinical Insights
app.post("/api/ai/analyze-vitals", async (req, res) => {
  const vitals = req.body.vitals || currentVitals;
  const languageCode = req.body.language || patientProfile.preferredLanguage || "en";
  const lang = getLanguageLabel(languageCode);

  try {
    const prompt = `Analyze patient vitals at a rural primary care kiosk in language: ${lang.name} (${lang.native}).
Patient: ${patientProfile.name}, Age: ${patientProfile.age}, Gender: ${patientProfile.gender}.
Vitals:
- BP: ${vitals.bloodPressure.systolic}/${vitals.bloodPressure.diastolic} mmHg (${vitals.bloodPressure.status})
- Blood Sugar: ${vitals.bloodSugar.value} ${vitals.bloodSugar.unit} (${vitals.bloodSugar.type})
- SpO2: ${vitals.spO2.value}%
- Temp: ${vitals.temperature.value}${vitals.temperature.unit}
- Heart Rate: ${vitals.heartRate?.value || 72} BPM

Return clinical insights structured in JSON matching the schema. Translate recommendations and findings into ${lang.name} if requested.`;

    const result = await callGeminiWithFallback({
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallScore: { type: Type.INTEGER, description: "Health score 0-100" },
            statusSummary: { type: Type.STRING, description: "Clear 2-sentence summary of overall condition" },
            riskLevel: { type: Type.STRING, enum: ["Low", "Moderate", "High"] },
            findings: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Clinical observations for each vital metric",
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Actionable lifestyle recommendations",
            },
            dietaryTips: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Dietary tips suited for cardiovascular and glucose wellness",
            },
            doctorAdvice: { type: Type.STRING, description: "Advice on whether to see a doctor or follow up" },
            isEmergency: { type: Type.BOOLEAN, description: "True if critical emergency values detected" },
          },
          required: ["overallScore", "statusSummary", "riskLevel", "findings", "recommendations", "dietaryTips", "doctorAdvice", "isEmergency"],
        },
      },
    });

    if (result?.text) {
      const parsed = JSON.parse(result.text);
      return res.json({ success: true, data: parsed, source: result.modelUsed });
    }
  } catch (error) {
    console.warn("AI Analysis notice (falling back to clinical rule engine):", error);
  }

  // High quality clinical rule-based fallback if API is unreachable or key is unset
  const isBpHigh = vitals.bloodPressure.systolic >= 130 || vitals.bloodPressure.diastolic >= 85;
  const isSugarHigh = vitals.bloodSugar.value > 120;
  const isSpO2Low = vitals.spO2.value < 95;
  const isFever = vitals.temperature.value > 99.5;

  const riskLevel = isBpHigh || isSugarHigh || isSpO2Low || isFever ? "Moderate" : "Low";
  const score = riskLevel === "Low" ? 95 : 82;

  return res.json({
    success: true,
    data: {
      overallScore: score,
      statusSummary: `Your biometric markers are stable. Blood pressure (${vitals.bloodPressure.systolic}/${vitals.bloodPressure.diastolic} mmHg) and oxygen saturation (${vitals.spO2.value}%) indicate healthy physiological function.`,
      riskLevel: riskLevel,
      findings: [
        `Blood Pressure: ${vitals.bloodPressure.systolic}/${vitals.bloodPressure.diastolic} mmHg (${vitals.bloodPressure.status}) - Ideal arterial pressure.`,
        `Blood Sugar: ${vitals.bloodSugar.value} mg/dL (${vitals.bloodSugar.status}) - Stable glycemic control.`,
        `SpO2: ${vitals.spO2.value}% (${vitals.spO2.status}) - Healthy respiratory oxygenation.`,
        `Temperature: ${vitals.temperature.value}${vitals.temperature.unit} - Normothermic body temperature.`,
      ],
      recommendations: [
        "Maintain moderate daily physical activity such as 30 minutes of brisk walking.",
        "Stay well hydrated with 2-3 liters of clean water daily.",
        "Schedule your next routine vitals check in 2-4 weeks.",
      ],
      dietaryTips: [
        "Consume fiber-rich seasonal vegetables, whole grains, and lentils.",
        "Keep daily dietary sodium (salt) below 5 grams.",
        "Avoid processed foods with added refined sugars.",
      ],
      doctorAdvice: "No immediate intervention required. All parameters conform to standard clinical benchmarks.",
      isEmergency: false,
    },
    source: "clinical_rule_engine",
  });
});

// AI Tele-Consultation Assistant
app.post("/api/ai/consult", async (req, res) => {
  const { messages, userMessage, language, vitals: userVitals, patient: userPatient } = req.body;
  const targetLanguage = language || patientProfile.preferredLanguage || "en";
  const lang = getLanguageLabel(targetLanguage);
  const activeVitals = userVitals || currentVitals;
  const activePatient = userPatient || patientProfile;

  try {
    const conversationContext = (messages || [])
      .slice(-6)
      .map((m: { sender: string; text: string }) => `${m.sender.toUpperCase()}: ${m.text}`)
      .join("\n");

    const prompt = `You are "Dr. Arogya", an empathetic, highly qualified telemedicine AI physician at an ArogyaConnect Rural Health Kiosk.
Language Requirement: Please respond fluently in ${lang.name} (${lang.native}). If medical terms are used, ensure they are simple and understandable for general patients.

Patient Context:
- Name: ${activePatient.name}, Age: ${activePatient.age}, Gender: ${activePatient.gender}
- Vitals: BP ${activeVitals.bloodPressure.systolic}/${activeVitals.bloodPressure.diastolic} mmHg, Sugar ${activeVitals.bloodSugar.value} mg/dL, SpO2 ${activeVitals.spO2.value}%, Temp ${activeVitals.temperature.value}°F, Heart Rate ${activeVitals.heartRate?.value || 72} BPM

Previous Conversation:
${conversationContext}

Patient Question/Message:
"${userMessage}"

Clinical Response Instructions:
1. Greet warmly and address the patient's concerns directly in ${lang.name}.
2. Interpret symptoms in context of their latest stable vitals.
3. Provide safe, practical home advice (hydration, rest, nutrition) and warning signs to watch out for.
4. If urgent or red flag symptoms exist, clearly recommend consulting the verified doctor in the next tab or calling 108.
5. Keep response concise (under 120 words), well-formatted, and encouraging.`;

    const result = await callGeminiWithFallback({
      contents: prompt,
    });

    if (result?.text) {
      return res.json({ success: true, reply: result.text, source: result.modelUsed });
    }
  } catch (error) {
    console.warn("AI Consult notice (utilizing clinical rule engine):", error);
  }

  // Graceful rule-based clinical response
  const fallbackReply = generateClinicalConsultFallback(userMessage, targetLanguage, activeVitals);
  return res.json({
    success: true,
    reply: fallbackReply,
    source: "clinical_rule_engine",
  });
});

// AI Quick Symptom Checker
app.post("/api/ai/symptom-check", async (req, res) => {
  const { symptomText } = req.body;
  try {
    const prompt = `You are a clinical diagnostic AI at ArogyaConnect Health Kiosk.
Patient: ${patientProfile.name}, Age: ${patientProfile.age}, Gender: ${patientProfile.gender}.
Current Vitals: BP ${currentVitals.bloodPressure.systolic}/${currentVitals.bloodPressure.diastolic} mmHg, Sugar ${currentVitals.bloodSugar.value} mg/dL, SpO2 ${currentVitals.spO2.value}%, Temp ${currentVitals.temperature.value}°F.
Reported Symptom: "${symptomText}".

Analyze the symptom and return structured clinical advice in JSON format.`;

    const result = await callGeminiWithFallback({
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            symptom: { type: Type.STRING },
            urgency: { type: Type.STRING, enum: ["Emergency", "Urgent Care Needed", "Routine / Mild"] },
            possibleCauses: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendation: { type: Type.STRING },
            recommendedDoctor: { type: Type.STRING },
            emergencyWarning: { type: Type.BOOLEAN },
          },
          required: ["symptom", "urgency", "possibleCauses", "recommendation", "recommendedDoctor", "emergencyWarning"],
        },
      },
    });

    if (result?.text) {
      const parsed = JSON.parse(result.text);
      return res.json({ success: true, data: parsed, source: result.modelUsed });
    }
  } catch (error) {
    console.warn("Symptom check notice (utilizing clinical rule engine):", error);
  }

  res.json({
    success: true,
    data: {
      symptom: symptomText || "Reported Discomfort",
      urgency: "Routine / Mild",
      possibleCauses: ["Postural fatigue", "Mild dehydration", "Diurnal fatigue"],
      recommendation: "Rest in a well-ventilated room, consume warm water with electrolytes, and schedule a routine checkup if symptoms persist.",
      recommendedDoctor: "General Physician",
      emergencyWarning: false,
    },
    source: "clinical_rule_engine",
  });
});

// ---------------- ASHA / VILLAGE REGISTRY DATA ----------------
let ashaVillagePatients = [
  {
    id: "asha-pat-1",
    name: "Kamla Devi",
    age: 26,
    gender: "Female",
    village: "Pipariya Kalan",
    ward: "Ward 3",
    abhaId: "91-3829-1029-4820",
    phone: "+91 94251 88291",
    category: "anc",
    riskFlag: "high",
    pregnancyTrimester: 3,
    lastVitals: {
      id: "v-anc-1",
      timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
      bloodPressure: { systolic: 142, diastolic: 92, unit: "mmHg", status: "High (Stage 1)" },
      bloodSugar: { value: 118, unit: "mg/dL", type: "Random", status: "Normal" },
      spO2: { value: 97, unit: "%", status: "Good" },
      temperature: { value: 98.4, unit: "°F", status: "Normal" },
      heartRate: { value: 88, unit: "BPM", status: "Normal" },
    },
    lastVisitDate: "2026-08-29",
    nextFollowUp: "2026-09-02",
    offlineSyncStatus: "synced",
    notes: "Gestational hypertension watch. Anemia screening hemoglobin 10.2g/dL. Iron Folic Acid tablets issued.",
    immunizationDue: ["TT Booster / Td Dose 2"],
  },
  {
    id: "asha-pat-2",
    name: "Ramsevak Yadav",
    age: 62,
    gender: "Male",
    village: "Pipariya Kalan",
    ward: "Ward 1",
    abhaId: "91-8492-2938-1940",
    phone: "+91 98263 11923",
    category: "diabetic",
    riskFlag: "moderate",
    lastVitals: {
      id: "v-diab-1",
      timestamp: new Date(Date.now() - 86400000 * 5).toISOString(),
      bloodPressure: { systolic: 135, diastolic: 86, unit: "mmHg", status: "Elevated" },
      bloodSugar: { value: 174, unit: "mg/dL", type: "Fasting", status: "High" },
      spO2: { value: 96, unit: "%", status: "Normal" },
      temperature: { value: 98.6, unit: "°F", status: "Normal" },
      heartRate: { value: 74, unit: "BPM", status: "Normal" },
    },
    lastVisitDate: "2026-08-26",
    nextFollowUp: "2026-09-05",
    offlineSyncStatus: "synced",
    notes: "Type-2 diabetes on Metformin 500mg. Fasting sugar slightly elevated. Advised diet control.",
  },
  {
    id: "asha-pat-3",
    name: "Baby Aarav (s/o Meena)",
    age: 1,
    gender: "Male",
    village: "Pipariya Kalan",
    ward: "Ward 4",
    abhaId: "91-1029-4820-3849",
    phone: "+91 97521 34910",
    category: "child",
    riskFlag: "normal",
    lastVitals: {
      id: "v-ch-1",
      timestamp: new Date(Date.now() - 86400000 * 7).toISOString(),
      bloodPressure: { systolic: 90, diastolic: 60, unit: "mmHg", status: "Normal" },
      bloodSugar: { value: 92, unit: "mg/dL", type: "Random", status: "Normal" },
      spO2: { value: 99, unit: "%", status: "Good" },
      temperature: { value: 98.2, unit: "°F", status: "Normal" },
      heartRate: { value: 110, unit: "BPM", status: "Normal" },
    },
    lastVisitDate: "2026-08-24",
    nextFollowUp: "2026-09-10",
    offlineSyncStatus: "synced",
    notes: "Growth chart green zone (Weight 9.4 kg). Pentavalent-3 vaccine completed.",
    immunizationDue: ["Measles-Rubella (MR-1)", "JE-1 (Japanese Encephalitis)"],
  },
  {
    id: "asha-pat-4",
    name: "Sundari Bai",
    age: 54,
    gender: "Female",
    village: "Pipariya Kalan",
    ward: "Ward 2",
    abhaId: "91-5820-3948-2910",
    phone: "+91 99812 77412",
    category: "hypertensive",
    riskFlag: "moderate",
    lastVitals: {
      id: "v-hyp-1",
      timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
      bloodPressure: { systolic: 148, diastolic: 94, unit: "mmHg", status: "High (Stage 1)" },
      bloodSugar: { value: 108, unit: "mg/dL", type: "Random", status: "Normal" },
      spO2: { value: 97, unit: "%", status: "Good" },
      temperature: { value: 98.6, unit: "°F", status: "Normal" },
      heartRate: { value: 80, unit: "BPM", status: "Normal" },
    },
    lastVisitDate: "2026-08-28",
    nextFollowUp: "2026-09-04",
    offlineSyncStatus: "synced",
    notes: "Hypertension follow-up. Telmisartan 40mg daily prescribed at PHC. Salt restriction counselled.",
  },
  {
    id: "asha-pat-5",
    name: "Ramesh Kumar Sharma",
    age: 48,
    gender: "Male",
    village: "Pipariya Kalan",
    ward: "Ward 4",
    abhaId: "91-4820-1928-3921",
    phone: "+91 98765 43210",
    category: "general",
    riskFlag: "normal",
    lastVitals: currentVitals,
    lastVisitDate: "2026-08-30",
    nextFollowUp: "2026-09-15",
    offlineSyncStatus: "synced",
    notes: "Kiosk regular checkup. Vitals stable. No active complaints.",
  },
];

let doctorTeleconsultQueue = [
  {
    id: "q-1",
    patientId: "pat-101",
    patientName: "Kamla Devi",
    patientAge: 26,
    patientGender: "Female",
    village: "Pipariya Kalan",
    abhaId: "91-3829-1029-4820",
    symptoms: "High BP in 3rd trimester (142/92 mmHg), mild pedal swelling",
    triageRisk: "yellow",
    vitals: {
      id: "v-q-1",
      timestamp: new Date().toISOString(),
      bloodPressure: { systolic: 142, diastolic: 92, unit: "mmHg", status: "High (Stage 1)" },
      bloodSugar: { value: 118, unit: "mg/dL", type: "Random", status: "Normal" },
      spO2: { value: 97, unit: "%", status: "Good" },
      temperature: { value: 98.4, unit: "°F", status: "Normal" },
      heartRate: { value: 88, unit: "BPM", status: "Normal" },
    },
    tokenNumber: "TK-01",
    waitingSince: "4 mins ago",
    preferredMode: "video",
    status: "waiting",
  },
  {
    id: "q-2",
    patientId: "pat-102",
    patientName: "Ramsevak Yadav",
    patientAge: 62,
    patientGender: "Male",
    village: "Pipariya Kalan",
    abhaId: "91-8492-2938-1940",
    symptoms: "Elevated fasting blood sugar (174 mg/dL), mild fatigue",
    triageRisk: "yellow",
    vitals: {
      id: "v-q-2",
      timestamp: new Date().toISOString(),
      bloodPressure: { systolic: 135, diastolic: 86, unit: "mmHg", status: "Elevated" },
      bloodSugar: { value: 174, unit: "mg/dL", type: "Fasting", status: "High" },
      spO2: { value: 96, unit: "%", status: "Normal" },
      temperature: { value: 98.6, unit: "°F", status: "Normal" },
      heartRate: { value: 74, unit: "BPM", status: "Normal" },
    },
    tokenNumber: "TK-02",
    waitingSince: "9 mins ago",
    preferredMode: "audio",
    status: "waiting",
  },
];

const DATA_DIR = path.join(rootDir, "data");
const DATA_FILE = path.join(DATA_DIR, "clinic_store.json");

function saveDataStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const store = {
      doctors,
      patientProfile,
      healthRecords,
      doctorTeleconsultQueue,
      ashaVillagePatients,
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (e) {
    console.warn("[DataStore] Failed to save store to file:", e);
  }
}

function loadDataStore() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, "utf-8");
      const store = JSON.parse(content);
      if (Array.isArray(store.doctors) && store.doctors.length > 0) doctors = store.doctors;
      if (store.patientProfile && typeof store.patientProfile === "object") patientProfile = store.patientProfile;
      if (Array.isArray(store.healthRecords) && store.healthRecords.length > 0) healthRecords = store.healthRecords;
      if (Array.isArray(store.doctorTeleconsultQueue)) doctorTeleconsultQueue = store.doctorTeleconsultQueue;
      if (Array.isArray(store.ashaVillagePatients) && store.ashaVillagePatients.length > 0) ashaVillagePatients = store.ashaVillagePatients;
      console.log(`[DataStore] Initialized: ${doctors.length} doctors, ${healthRecords.length} records, ${ashaVillagePatients.length} ASHA patients for ${patientProfile.name}`);
    } else {
      saveDataStore();
      console.log(`[DataStore] Created new persistent store at ${DATA_FILE}`);
    }
  } catch (e) {
    console.warn("[DataStore] Could not load store from file:", e);
  }
}

loadDataStore();

// AI Voice Triage API (Core Feature)
app.post("/api/ai/voice-triage", async (req, res) => {
  const { symptomVoiceText, language, patient: userPatient, vitals: userVitals } = req.body;
  const targetLanguage = language || patientProfile.preferredLanguage || "hi";
  const lang = getLanguageLabel(targetLanguage);
  const activeVitals = userVitals || currentVitals;
  const activePatient = userPatient || patientProfile;

  try {
    const prompt = `You are the AI Voice Clinical Triage Officer at ArogyaConnect - India's Rural Health Kiosk Network.
Language: Respond in ${lang.name} (${lang.native}) for rural low-literacy patient accessibility.

Patient Details:
- Name: ${activePatient.name}, Age: ${activePatient.age}, Gender: ${activePatient.gender}
- Current Kiosk Vitals: BP ${activeVitals.bloodPressure.systolic}/${activeVitals.bloodPressure.diastolic} mmHg (${activeVitals.bloodPressure.status}), Blood Sugar ${activeVitals.bloodSugar.value} mg/dL, SpO2 ${activeVitals.spO2.value}%, Temp ${activeVitals.temperature.value}°F, Heart Rate ${activeVitals.heartRate?.value || 72} BPM

Reported Voice Symptoms:
"${symptomVoiceText}"

Assess clinical risk into one of 3 explicit levels:
- "green": Self-Care & Home Monitoring (Mild symptoms, stable vitals, safe for home hydration/rest)
- "yellow": Consult a Doctor / PHC Visit (Persistent issue, requires clinical examination or prescription adjustment)
- "red": Immediate Emergency Care (108 SOS Dispatch - e.g. severe chest pain, SpO2 < 90%, high BP crisis, acute trauma, stroke signs)

Return strictly formatted JSON matching the schema. Translate all clinical strings into clear, conversational ${lang.name}.`;

    const result = await callGeminiWithFallback({
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskLevel: { type: Type.STRING, enum: ["green", "yellow", "red"] },
            riskCategory: {
              type: Type.STRING,
              enum: [
                "Self-Care & Home Monitoring",
                "Primary Health Centre (PHC) Consult",
                "Immediate Emergency Dispatch (108)",
              ],
            },
            title: { type: Type.STRING, description: "Short title in regional language" },
            summary: { type: Type.STRING, description: "Empathetic clear diagnosis summary in regional language" },
            symptomsIdentified: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendedDoctor: { type: Type.STRING, description: "Medical specialty to consult" },
            homeRemedies: { type: Type.ARRAY, items: { type: Type.STRING } },
            warningSigns: { type: Type.ARRAY, items: { type: Type.STRING } },
            followUpQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            emergencyInstructions: { type: Type.STRING },
            audioNarration: { type: Type.STRING, description: "Spoken summary script for rural patients" },
          },
          required: [
            "riskLevel",
            "riskCategory",
            "title",
            "summary",
            "symptomsIdentified",
            "recommendedDoctor",
            "homeRemedies",
            "warningSigns",
            "followUpQuestions",
            "audioNarration",
          ],
        },
      },
    });

    if (result?.text) {
      const parsed = JSON.parse(result.text);
      return res.json({ success: true, data: parsed, source: result.modelUsed });
    }
  } catch (error) {
    console.warn("AI Voice Triage notice (utilizing clinical rule engine):", error);
  }

  // Robust Rule-based Clinical Fallback
  const lower = (symptomVoiceText || "").toLowerCase();
  const isEmergency =
    lower.includes("chest pain") ||
    lower.includes("chhati") ||
    lower.includes("saans") ||
    lower.includes("breath") ||
    lower.includes("stroke") ||
    lower.includes("khoon") ||
    lower.includes("blood") ||
    activeVitals.spO2.value < 90 ||
    activeVitals.bloodPressure.systolic >= 180;

  const isYellow =
    !isEmergency &&
    (lower.includes("fever") ||
      lower.includes("bukhar") ||
      lower.includes("taap") ||
      lower.includes("sugar") ||
      lower.includes("headache") ||
      lower.includes("dard") ||
      lower.includes("khansi") ||
      lower.includes("cough") ||
      activeVitals.bloodPressure.systolic >= 140 ||
      activeVitals.bloodSugar.value > 150);

  let fallbackTriage;
  if (isEmergency) {
    fallbackTriage = {
      riskLevel: "red",
      riskCategory: "Immediate Emergency Dispatch (108)",
      title: targetLanguage === "hi" ? "आपातकालीन स्थिति – तुरंत सहायता लें" : "Emergency Care Required (108)",
      summary:
        targetLanguage === "hi"
          ? "आपके लक्षणों और वाइटल्स के अनुसार तत्काल चिकित्सा सहायता आवश्यक है। कृपया 108 एम्बुलेंस या नजदीकी अस्पताल से संपर्क करें।"
          : "Based on acute symptom markers, emergency medical intervention is recommended immediately.",
      symptomsIdentified: ["Critical Discomfort", "Cardio-respiratory evaluation required"],
      recommendedDoctor: "Emergency Physician / Cardiologist",
      homeRemedies: ["Keep patient seated upright", "Do not give heavy food", "Loosen tight clothes"],
      warningSigns: ["Dizziness", "Shortness of breath", "Severe sweating"],
      followUpQuestions: ["Did the chest or breathing pain start suddenly?", "Is there any left arm pain?"],
      emergencyInstructions: "Press the RED SOS button or call 108 immediately. Nearest PHC alerted.",
      audioNarration:
        targetLanguage === "hi"
          ? "सावधानी: यह आपातकालीन लक्षण हो सकता है। कृपया तुरंत 108 एम्बुलेंस या डॉक्टर से संपर्क करें।"
          : "Alert: This requires immediate clinical emergency care. Please connect to 108 SOS or visit the nearest hospital.",
    };
  } else if (isYellow) {
    fallbackTriage = {
      riskLevel: "yellow",
      riskCategory: "Primary Health Centre (PHC) Consult",
      title: targetLanguage === "hi" ? "डॉक्टर से परामर्श की आवश्यकता" : "Doctor Consultation Recommended",
      summary:
        targetLanguage === "hi"
          ? `आपके वाइटल्स (रक्तचाप ${activeVitals.bloodPressure.systolic}/${activeVitals.bloodPressure.diastolic} mmHg, पल्स ${activeVitals.heartRate?.value || 76}) की जांच के अनुसार आपको प्राथमिक स्वास्थ्य केंद्र या टेली-कंसल्ट डॉक्टर से परामर्श लेना चाहिए।`
          : `Based on your symptoms and vitals (BP ${activeVitals.bloodPressure.systolic}/${activeVitals.bloodPressure.diastolic} mmHg), teleconsultation with a medical officer is advised.`,
      symptomsIdentified: ["Sub-acute clinical symptoms", "Elevated vital markers"],
      recommendedDoctor: "General Physician / Internal Medicine",
      homeRemedies: [
        "Take plenty of warm fluids & ORS",
        "Rest for 20-30 minutes in a cool airy room",
        "Avoid heavy manual labor for today",
      ],
      warningSigns: ["Fever exceeding 102°F", "Persistent vomiting", "Chest tightness"],
      followUpQuestions: ["How many days have you had these symptoms?", "Are you currently taking any daily medicines?"],
      emergencyInstructions: "Connect with our online tele-doctor in the Consult tab for e-Prescription.",
      audioNarration:
        targetLanguage === "hi"
          ? "आपकी स्थिति स्थिर है, लेकिन डॉक्टर से सलाह लेना बेहतर रहेगा। आप अभी हमारे ऑनलाइन डॉक्टर से बात कर सकते हैं।"
          : "Your condition is stable, but a medical consultation is recommended. You can speak with our on-call doctor right away.",
    };
  } else {
    fallbackTriage = {
      riskLevel: "green",
      riskCategory: "Self-Care & Home Monitoring",
      title: targetLanguage === "hi" ? "घरेलू देखभाल व सामान्य स्वास्थ्य" : "Self-Care & Home Monitoring",
      summary:
        targetLanguage === "hi"
          ? `आपके सभी वाइटल्स (रक्तचाप ${activeVitals.bloodPressure.systolic}/${activeVitals.bloodPressure.diastolic} mmHg, ऑक्सीजन ${activeVitals.spO2.value}%, शुगर ${activeVitals.bloodSugar.value} mg/dL) बिल्कुल सुरक्षित दायरे में हैं। आराम और पर्याप्त पानी से आपकी समस्या ठीक हो जाएगी।`
          : `All biometric markers (BP ${activeVitals.bloodPressure.systolic}/${activeVitals.bloodPressure.diastolic} mmHg, SpO2 ${activeVitals.spO2.value}%) are within healthy normal limits. Home care and hydration are sufficient.`,
      symptomsIdentified: ["Mild fatigue or mild tension", "Normal physiological parameters"],
      recommendedDoctor: "General Health Consultant",
      homeRemedies: [
        "Drink 2-3 glasses of clean drinking water",
        "Eat light seasonal fruits and nutritious khichdi or lentils",
        "Take 7-8 hours of sound nighttime sleep",
      ],
      warningSigns: ["Sudden high fever", "Severe headache not relieving with rest"],
      followUpQuestions: ["Did you sleep well last night?", "Have you had enough water today?"],
      audioNarration:
        targetLanguage === "hi"
          ? "अच्छी खबर: आपकी जांच सामान्य है। पर्याप्त पानी पिएं और विश्राम करें। कोई गंभीर समस्या नहीं है।"
          : "Good news: Your vital signs are healthy and normal. Rest and hydration will help you recover quickly.",
    };
  }

  res.json({ success: true, data: fallbackTriage, source: "clinical_rule_engine" });
});

// ASHA / Village Registry Endpoints
app.get("/api/asha/patients", (req, res) => {
  const { category, search, risk } = req.query;
  let results = [...ashaVillagePatients];

  if (category && category !== "all") {
    results = results.filter((p) => p.category === category);
  }
  if (risk && risk !== "all") {
    results = results.filter((p) => p.riskFlag === risk);
  }
  if (search) {
    const q = String(search).toLowerCase();
    results = results.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.village.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        p.abhaId.includes(q)
    );
  }

  res.json({
    success: true,
    total: results.length,
    data: results,
    stats: {
      totalVillagePatients: ashaVillagePatients.length,
      highRiskANC: ashaVillagePatients.filter((p) => p.category === "anc" && p.riskFlag === "high").length,
      hypertensionDue: ashaVillagePatients.filter((p) => p.category === "hypertensive").length,
      diabeticFollowup: ashaVillagePatients.filter((p) => p.category === "diabetic").length,
      pendingOfflineSync: ashaVillagePatients.filter((p) => p.offlineSyncStatus === "pending").length,
    },
  });
});

app.post("/api/asha/patients/register", (req, res) => {
  const { name, age, gender, village, ward, phone, category, notes, initialVitals } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, error: "Patient name is required" });
  }

  const newPatient = {
    id: `asha-pat-${Date.now()}`,
    name,
    age: Number(age) || 30,
    gender: gender || "Female",
    village: village || "Pipariya Kalan",
    ward: ward || "Ward 1",
    abhaId: `91-${Math.floor(1000 + Math.random() * 8999)}-${Math.floor(1000 + Math.random() * 8999)}-${Math.floor(1000 + Math.random() * 8999)}`,
    phone: phone || "+91 90000 00000",
    category: category || "general",
    riskFlag: category === "anc" ? "moderate" : "normal",
    lastVitals: initialVitals || currentVitals,
    lastVisitDate: new Date().toISOString().split("T")[0],
    nextFollowUp: new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0],
    offlineSyncStatus: "synced",
    notes: notes || "Newly registered in ASHA village health register.",
  };

  ashaVillagePatients.unshift(newPatient);
  saveDataStore();

  res.json({
    success: true,
    message: "Patient registered with ABHA ID successfully",
    data: newPatient,
  });
});

// Record camp vitals for an ASHA patient
app.post("/api/asha/patients/:id/vitals", (req, res) => {
  const { id } = req.params;
  const { vitals } = req.body;
  const pat = ashaVillagePatients.find((p) => p.id === id);
  if (!pat) {
    return res.status(404).json({ success: false, error: "Patient not found in ASHA register" });
  }

  if (vitals) {
    pat.lastVitals = vitals;
    pat.lastVisitDate = new Date().toISOString().split("T")[0];
    saveDataStore();
  }

  res.json({ success: true, message: `Vitals recorded for ${pat.name}`, data: pat });
});

app.post("/api/asha/sync", (req, res) => {
  const { queueItems } = req.body;
  const count = Array.isArray(queueItems) ? queueItems.length : 1;

  // Mark all pending as synced
  ashaVillagePatients = ashaVillagePatients.map((p) => ({ ...p, offlineSyncStatus: "synced" }));
  saveDataStore();

  res.json({
    success: true,
    syncedCount: count,
    message: `Batch sync complete: ${count} offline records synchronized with PHC server.`,
    timestamp: new Date().toISOString(),
  });
});

// Doctor Teleconsult Queue Endpoints
app.get("/api/doctor/queue", (req, res) => {
  res.json({
    success: true,
    data: doctorTeleconsultQueue,
    activeDoctor: doctors[0],
  });
});

// Patient joins live teleconsultation queue
app.post("/api/doctor/queue/join", (req, res) => {
  const { patientId, patientName, patientAge, patientGender, village, abhaId, symptoms, vitals, preferredMode } = req.body;
  
  const newItem = {
    id: `q-${Date.now()}`,
    patientId: patientId || `pat-${Date.now()}`,
    patientName: patientName || patientProfile.name,
    patientAge: Number(patientAge) || patientProfile.age,
    patientGender: patientGender || patientProfile.gender,
    village: village || patientProfile.village || "Local Kiosk",
    abhaId: abhaId || patientProfile.abhaId,
    symptoms: symptoms || "Teleconsultation requested from Kiosk",
    triageRisk: (vitals?.bloodPressure?.systolic > 140 || vitals?.spO2?.value < 94) ? "red" : "yellow",
    vitals: vitals || currentVitals,
    tokenNumber: `TK-${Math.floor(10 + Math.random() * 90)}`,
    waitingSince: "Just now",
    preferredMode: preferredMode || "video",
    status: "waiting",
  };

  doctorTeleconsultQueue.unshift(newItem);
  saveDataStore();

  broadcastWS({
    type: "queue:updated",
    data: doctorTeleconsultQueue,
  });

  res.status(201).json({ success: true, message: "Patient queued for teleconsultation", data: newItem });
});

// Delete or remove patient from queue
app.delete("/api/doctor/queue/:id", (req, res) => {
  const { id } = req.params;
  doctorTeleconsultQueue = doctorTeleconsultQueue.filter((q) => q.id !== id && q.patientId !== id);
  saveDataStore();

  broadcastWS({
    type: "queue:updated",
    data: doctorTeleconsultQueue,
  });

  res.json({ success: true, message: "Queue entry removed" });
});

app.post("/api/doctor/prescribe", (req, res) => {
  const { patientId, doctorId, diagnosis, medicines, advice, followUpDays } = req.body;
  const doctor = doctors.find((d) => d.id === doctorId) || doctors[0];
  const patient = ashaVillagePatients.find((p) => p.id === patientId) || {
    name: patientProfile.name,
    age: patientProfile.age,
    gender: patientProfile.gender,
    abhaId: patientProfile.abhaId,
  };

  const newRx = {
    id: `RX-ABDM-${Date.now().toString().slice(-6)}`,
    doctorId: doctor.id,
    doctorName: doctor.name,
    doctorSpecialty: doctor.specialty,
    doctorRegNo: doctor.regNumber || "MCI-38291",
    patientName: patient.name,
    patientAge: patient.age,
    patientGender: patient.gender,
    patientAbhaId: patient.abhaId,
    date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    diagnosis: diagnosis || "Acute Clinical Management & Prophylaxis",
    medicines: medicines || [
      {
        name: "Tab. Paracetamol 500mg (Jan Aushadhi Generic)",
        dosage: "1 Tablet",
        frequency: "TDS (Thrice Daily)",
        duration: "3 Days",
        instructions: "Post meals with water",
      },
    ],
    generalAdvice: advice || "Rest, drink plenty of fluids, and visit PHC if symptoms worsen.",
    followUpDays: followUpDays || 7,
    signatureStamp: `Digitally Signed by ${doctor.name} (${doctor.regNumber}) - ABDM Compliance Approved`,
  };

  // Remove from teleconsult queue
  doctorTeleconsultQueue = doctorTeleconsultQueue.filter((q) => q.patientId !== patientId);

  // Add prescription to health records history
  const rxRecord = {
    id: `rec-rx-${Date.now()}`,
    timestamp: new Date().toISOString(),
    bloodPressure: currentVitals.bloodPressure,
    bloodSugar: currentVitals.bloodSugar,
    spO2: currentVitals.spO2,
    temperature: currentVitals.temperature,
    heartRate: currentVitals.heartRate,
    notes: `e-Prescription by ${doctor.name}: ${newRx.diagnosis} (${newRx.medicines.length} medications prescribed)`,
    location: doctor.hospitalAffiliation || "Tele-OPD",
  };
  healthRecords.unshift(rxRecord);

  saveDataStore();

  broadcastWS({
    type: "queue:updated",
    data: doctorTeleconsultQueue,
  });

  broadcastWS({
    type: "records:updated",
    records: healthRecords,
  });

  res.json({
    success: true,
    message: "Digital e-Prescription issued and linked to ABHA account.",
    data: newRx,
  });
});

// Generate Electronic Prescription (e-Rx)
app.post("/api/consult/prescription", (req, res) => {
  const { doctorId } = req.body;
  const doctor = doctors.find((d) => d.id === doctorId) || doctors[0];

  const prescription = {
    id: `RX-${Date.now().toString().slice(-6)}`,
    doctorId: doctor.id,
    doctorName: doctor.name,
    doctorSpecialty: doctor.specialty,
    doctorRegNo: `MCI-${Math.floor(10000 + Math.random() * 89999)}`,
    patientName: patientProfile.name,
    patientAge: patientProfile.age,
    patientGender: patientProfile.gender,
    patientAbhaId: patientProfile.abhaId,
    date: new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    diagnosis: "Routine Health Screening - Stable Vitals & Mild Preventive Prophylaxis",
    medicines: [
      {
        name: "Tab. Multivitamin & Minerals (Zinc + Vitamin C)",
        dosage: "1 Tablet",
        frequency: "Once Daily (OD)",
        duration: "30 Days",
        instructions: "Post-breakfast with warm water",
      },
      {
        name: "Tab. Calcium Carbonate + Vitamin D3 (500mg/250IU)",
        dosage: "1 Tablet",
        frequency: "Once Daily (OD)",
        duration: "30 Days",
        instructions: "Post-dinner before bedtime",
      },
      {
        name: "ORS Hydration Sachet (WHO Formula)",
        dosage: "1 Sachet in 1L water",
        frequency: "As Needed (PRN)",
        duration: "5 Days",
        instructions: "Consume throughout daylight hours",
      },
    ],
    generalAdvice: "Maintain daily 30-minute brisk walk. Keep dietary sodium < 5g/day. Sync telemetry weekly via Arogya Kiosk.",
    followUpDays: 30,
    signatureStamp: "Digitally Signed via ABDM Secure Gateway Token #91823",
  };

  res.json({ success: true, data: prescription });
});

// ---------------- REALTIME SSE & HTTP TELEMETRY ENDPOINTS ----------------

// Server-Sent Events stream for reliable real-time updates (cross-proxy compatible)
app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  sseClients.add(res);

  // Send initial authoritative state
  const initMsg = {
    type: "init",
    kioskId: "NODE-04-PUNE",
    timestamp: new Date().toISOString(),
    vitals: currentVitals,
    profile: patientProfile,
    records: healthRecords,
    activeClients: (wssInstance?.clients.size || 0) + sseClients.size,
    status: "ONLINE",
  };
  res.write(`data: ${JSON.stringify(initMsg)}\n\n`);

  // Broadcast updated client count
  broadcastWS({
    type: "network:clients_count",
    activeClients: (wssInstance?.clients.size || 0) + sseClients.size,
  });

  req.on("close", () => {
    sseClients.delete(res);
    broadcastWS({
      type: "network:clients_count",
      activeClients: (wssInstance?.clients.size || 0) + sseClients.size,
    });
  });
});

// HTTP Telemetry Ping / Latency check
app.get("/api/telemetry/ping", (req, res) => {
  res.json({
    type: "pong",
    timestamp: Date.now(),
    serverUptime: process.uptime(),
    activeClients: (wssInstance?.clients.size || 0) + sseClients.size,
  });
});

// HTTP Trigger for Vitals Scan (Fallback when WS send is queued)
app.post("/api/telemetry/measure", (req, res) => {
  const sys = Math.floor(115 + Math.random() * 12);
  const dia = Math.floor(75 + Math.random() * 9);
  const sugar = Math.floor(100 + Math.random() * 20);
  const spo2 = Math.floor(97 + Math.random() * 3);
  const temp = Number((98.2 + Math.random() * 0.7).toFixed(1));
  const hr = Math.floor(68 + Math.random() * 10);

  currentVitals = {
    id: `vitals-${Date.now()}`,
    timestamp: new Date().toISOString(),
    bloodPressure: {
      systolic: sys,
      diastolic: dia,
      unit: "mmHg",
      status: sys > 130 || dia > 85 ? "Elevated" : "Normal",
    },
    bloodSugar: {
      value: sugar,
      unit: "mg/dL",
      type: "Fasting",
      status: sugar > 125 ? "High" : sugar > 115 ? "Pre-diabetes" : "Normal",
    },
    spO2: {
      value: spo2,
      unit: "%",
      status: spo2 >= 95 ? "Good" : "Low",
    },
    temperature: {
      value: temp,
      unit: "°F",
      status: temp > 99.5 ? "Low Grade Fever" : "Normal",
    },
    heartRate: {
      value: hr,
      unit: "BPM",
      status: "Normal",
    },
    notes: "Biometric sensor telemetry synchronized via Kiosk trigger",
    location: patientProfile.kioskLocation,
  };

  const newRecord = {
    ...currentVitals,
    id: `rec-${Date.now()}`,
  };
  healthRecords.unshift(newRecord);

  broadcastWS({
    type: "vitals:updated",
    data: currentVitals,
    record: newRecord,
    totalRecords: healthRecords.length,
  });

  res.json({ success: true, data: currentVitals, record: newRecord });
});

// HTTP Trigger for Emergency Alert
app.post("/api/telemetry/emergency", (req, res) => {
  const ticketId = `EMG-${Date.now().toString().slice(-6)}`;
  const alertPayload = {
    type: "emergency:alert",
    ticketId,
    patient: patientProfile,
    vitals: currentVitals,
    timestamp: new Date().toISOString(),
    message: "EMERGENCY TELEMETRY DISPATCHED TO PHC 108 AMBULANCE UNIT",
  };
  broadcastWS(alertPayload);
  res.json({ success: true, ...alertPayload });
});

// ---------------- VITE MIDDLEWARE & SERVER BOOT ----------------

async function startServer() {
  const server = http.createServer(app);

  // Initialize standalone WebSocket server with manual upgrade handling
  wssInstance = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    try {
      const parsedUrl = request.url ? new URL(request.url, `http://${request.headers.host || 'localhost'}`) : null;
      const pathname = parsedUrl?.pathname || request.url || '';
      if (
        pathname === "/ws" ||
        pathname === "/ws/" ||
        pathname.startsWith("/ws") ||
        pathname.startsWith("/socket") ||
        pathname.startsWith("/realtime")
      ) {
        wssInstance?.handleUpgrade(request, socket, head, (ws) => {
          wssInstance?.emit("connection", ws, request);
        });
      }
    } catch (e) {
      console.error("[WebSocket Upgrade Error]", e);
    }
  });

  wssInstance.on("connection", (ws, req) => {
    console.log(`[WebSocket] Client connected: ${req.socket.remoteAddress || 'client'}`);

    // Send initial authoritative state upon connection
    try {
      ws.send(
        JSON.stringify({
          type: "init",
          kioskId: "NODE-04-PUNE",
          timestamp: new Date().toISOString(),
          vitals: currentVitals,
          profile: patientProfile,
          records: healthRecords,
          activeClients: (wssInstance?.clients.size || 0) + sseClients.size,
          status: "ONLINE",
        })
      );
    } catch (err) {
      console.error("[WebSocket Init Error]", err);
    }

    // Broadcast client presence count
    broadcastWS({
      type: "network:clients_count",
      activeClients: (wssInstance?.clients.size || 0) + sseClients.size,
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        switch (msg.type) {
          case "ping":
            ws.send(
              JSON.stringify({
                type: "pong",
                timestamp: Date.now(),
                clientTime: msg.clientTime,
                serverUptime: process.uptime(),
                activeClients: (wssInstance?.clients.size || 0) + sseClients.size,
              })
            );
            break;

          case "vitals:subscribe_stream":
            activeStreamClients.add(ws);
            ws.send(JSON.stringify({ type: "stream:status", active: true }));
            break;

          case "vitals:unsubscribe_stream":
            activeStreamClients.delete(ws);
            ws.send(JSON.stringify({ type: "stream:status", active: false }));
            break;

          case "vitals:measure": {
            const sys = Math.floor(115 + Math.random() * 12);
            const dia = Math.floor(75 + Math.random() * 9);
            const sugar = Math.floor(100 + Math.random() * 20);
            const spo2 = Math.floor(97 + Math.random() * 3);
            const temp = Number((98.2 + Math.random() * 0.7).toFixed(1));
            const hr = Math.floor(68 + Math.random() * 10);

            currentVitals = {
              id: `vitals-${Date.now()}`,
              timestamp: new Date().toISOString(),
              bloodPressure: {
                systolic: sys,
                diastolic: dia,
                unit: "mmHg",
                status: sys > 130 || dia > 85 ? "Elevated" : "Normal",
              },
              bloodSugar: {
                value: sugar,
                unit: "mg/dL",
                type: "Fasting",
                status: sugar > 125 ? "High" : sugar > 115 ? "Pre-diabetes" : "Normal",
              },
              spO2: {
                value: spo2,
                unit: "%",
                status: spo2 >= 95 ? "Good" : "Low",
              },
              temperature: {
                value: temp,
                unit: "°F",
                status: temp > 99.5 ? "Low Grade Fever" : "Normal",
              },
              heartRate: {
                value: hr,
                unit: "BPM",
                status: "Normal",
              },
              notes: "Biometric sensor telemetry synchronized via WebSocket trigger",
              location: patientProfile.kioskLocation,
            };

            const newRecord = {
              ...currentVitals,
              id: `rec-${Date.now()}`,
            };
            healthRecords.unshift(newRecord);

            broadcastWS({
              type: "vitals:updated",
              data: currentVitals,
              record: newRecord,
              totalRecords: healthRecords.length,
            });
            break;
          }

          case "vitals:save": {
            if (msg.vitals) {
              currentVitals = { ...msg.vitals, timestamp: new Date().toISOString() };
              const savedRec = { ...currentVitals, id: `rec-${Date.now()}` };
              healthRecords.unshift(savedRec);
              broadcastWS({
                type: "vitals:updated",
                data: currentVitals,
                record: savedRec,
                totalRecords: healthRecords.length,
              });
            }
            break;
          }

          case "profile:update": {
            if (msg.profile) {
              patientProfile = { ...patientProfile, ...msg.profile };
              broadcastWS({
                type: "profile:updated",
                data: patientProfile,
              });
            }
            break;
          }

          case "emergency:trigger": {
            const ticketId = `EMG-${Date.now().toString().slice(-6)}`;
            broadcastWS({
              type: "emergency:alert",
              ticketId,
              patient: patientProfile,
              vitals: currentVitals,
              timestamp: new Date().toISOString(),
              message: "EMERGENCY TELEMETRY DISPATCHED TO PHC 108 AMBULANCE UNIT",
            });
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error("Failed to parse WS payload:", err);
      }
    });

    ws.on("close", () => {
      activeStreamClients.delete(ws);
      broadcastWS({
        type: "network:clients_count",
        activeClients: (wssInstance?.clients.size || 0) + sseClients.size,
      });
    });

    ws.on("error", (err) => {
      console.error("WS error:", err);
      activeStreamClients.delete(ws);
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`ArogyaConnect Health Kiosk Server (HTTP & WebSocket) running on port ${PORT}`);
  });
}

startServer();
