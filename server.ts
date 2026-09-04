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
  avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuDB9EP28IpcWeVA7u5JLDE3Z2NZUmmkRWz9Lo7FpJIDhxAiFVCCe4W2mn3VGrS15NzS3ve_R1CY6LFkA52FwlPSG7menq1bCMjJA2M0-mbE_EQI9jP3C7GekW2cSSzjeeT[...],
  preferredLanguage: "en",
  voiceGuidanceEnabled: true,
  kioskLocation: "Arogya Rural Kiosk - Sector 4",
  village: "Pipariya Kalan",
  location: "Pipariya Kalan, Ward 3",
};

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

  // Ordered candidate models: gemini-3.7-flash as primary, followed by gemini-2.0-flash and gemni-1.5-flash
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

// ... (rest of file unchanged) ...

if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: {
        protocol: "ws",
        host: "localhost",
        port: PORT, // uses the same port as the HTTP server (3000)
      },
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
