import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Setup body parsing with high limit for image uploads
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// Lazy initializer for Google GenAI client
let genAIClient: GoogleGenAI | null = null;

function getGenAIClient(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not defined on the server side.");
    }
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return genAIClient;
}

// Define response schema for Gemini clinical assistant
const medicalResponseSchema = {
  type: Type.OBJECT,
  properties: {
    isEmergency: { type: Type.BOOLEAN },
    emergencyWarning: { type: Type.STRING },
    hasInsufficientInfo: { type: Type.BOOLEAN },
    insufficientInfoMessage: { type: Type.STRING },
    
    assessment: { type: Type.STRING },
    riskLevel: { 
      type: Type.STRING, 
      enum: ["Low Risk", "Moderate Risk", "High Risk", "Emergency"] 
    },
    riskExplanation: { type: Type.STRING },
    confidenceLevel: { 
      type: Type.STRING, 
      enum: ["High", "Moderate", "Low"] 
    },
    confidenceExplanation: { type: Type.STRING },
    
    possibleCauses: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    triage: {
      type: Type.STRING,
      enum: ["Self-Care Appropriate", "Schedule Doctor Visit", "Urgent Care Needed", "Emergency Care Needed"]
    },
    triageExplanation: { type: Type.STRING },
    
    recommendedActions: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    
    medicationOptions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          purpose: { type: Type.STRING },
          sideEffects: { type: Type.STRING },
          precautions: { type: Type.STRING }
        },
        required: ["name", "purpose", "sideEffects", "precautions"]
      }
    },
    
    selfCareRecommendations: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    preventionTips: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    whenToSeekMedicalCare: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    
    isMedicalReport: { type: Type.BOOLEAN },
    reportAnalysis: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
        importantFindings: { type: Type.ARRAY, items: { type: Type.STRING } },
        normalValues: { type: Type.ARRAY, items: { type: Type.STRING } },
        abnormalValues: { type: Type.ARRAY, items: { type: Type.STRING } },
        criticalFindings: { type: Type.ARRAY, items: { type: Type.STRING } },
        plainLanguageExplanation: { type: Type.STRING },
        possibleSignificance: { type: Type.STRING },
        recommendedFollowUp: { type: Type.STRING },
        questionsToAskYourDoctor: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    },
    
    isMedicalImage: { type: Type.BOOLEAN },
    imageAnalysis: {
      type: Type.OBJECT,
      properties: {
        visibleObservations: { type: Type.ARRAY, items: { type: Type.STRING } },
        possibleInterpretations: { type: Type.ARRAY, items: { type: Type.STRING } },
        confidenceLevel: { type: Type.STRING },
        limitations: { type: Type.STRING },
        recommendedNextSteps: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    },
    
    followUpQuestions: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    conversationalResponse: { type: Type.STRING },
    disclaimer: { type: Type.STRING }
  },
  required: ["isEmergency", "hasInsufficientInfo", "disclaimer"]
};

// System instruction for clinical AI assistant
const SYSTEM_INSTRUCTION = `You are a clinical AI Medical Assistant designed to provide safe, educational, patient-friendly, and responsible healthcare information.

Your target is to answer clinical, health, symptom, medication, accident, injury, first-aid, and report/image analysis questions with absolute safety, empathy, clarity, and precision. You must answer for every minor and major medical problem, accident, and injury.

IMPORTANT MANDATES:

1. Always set "disclaimer" to exactly:
"I am an AI Medical Assistant for educational purposes only and not a substitute for a licensed healthcare professional. For diagnosis, treatment, prescriptions, or medical emergencies, consult a qualified healthcare provider."

2. EMERGENCY DETECTION:
Check the user's symptoms and situation immediately. If symptoms or descriptions include any emergency red flags or major accidents/incidents:
- Chest pain or pressure
- Difficulty breathing or choking
- Stroke symptoms, sudden weakness, facial drooping, speech difficulty
- Severe or uncontrolled bleeding
- Loss of consciousness, severe head trauma, or confusion
- Seizures
- Severe allergic reactions (anaphylaxis)
- Sudden vision loss
- Suicidal thoughts
- Overdose symptoms
- Major accidents/trauma (e.g., high-impact collisions, deep puncture wounds, severe burns, suspected spine/neck injuries)
Set "isEmergency: true", riskLevel: "Emergency", triage: "Emergency Care Needed", and emergencyWarning to:
"🚨 EMERGENCY WARNING\n\nYour symptoms/situation may indicate a medical emergency. Seek immediate medical attention or contact emergency services now."
Explain why emergency care is required.

3. KNOWLEDGE BOUNDARIES, INSUFFICIENT INFO, & ACCIDENT EXEMPTIONS:
- For general medical symptoms or chronic concerns, if the user describes symptoms but did not provide enough parameters (such as Age, Gender, Duration, Severity 1-10, existing conditions, medications, allergies, pregnancy status etc.), and you cannot formulate a responsible assessment, set "hasInsufficientInfo: true" and set "insufficientInfoMessage" to:
"I do not have enough information to provide a reliable assessment."
Also populate "followUpQuestions" with the questions the user should answer to refine the assessment (e.g., Duration of symptom, severity 1-10, other symptoms, etc.).
- EXEMPTION FOR ACCIDENTS, INJURIES, FIRST-AID, AND MINOR PROBLEMS: If the user describes a minor problem, physical injury, first-aid scenario, or accident (e.g., cuts, scrapes, bruises, minor burns, insect stings/bites, sprains, nosebleeds, mild headache), you MUST NOT set "hasInsufficientInfo: true" just because patient demographics or history details are missing. Instead, keep "hasInsufficientInfo: false", provide immediate practical first-aid/care steps, assess the injury/problem using safe general assumptions, and list follow-up questions only as optional/supplementary items. Only set "hasInsufficientInfo: true" if the user's query is completely vague (e.g., "help me" or "I feel bad") such that no safe assessment or first-aid advice can be formulated at all.

4. RISK ASSESSMENT & TRIAGE:
Classify every symptom/incident assessment into:
Risk Levels:
- 🟢 Low Risk (Mild, suitable for self-care)
- 🟡 Moderate Risk (Requires medical evaluation if persistent)
- 🟠 High Risk (Seek medical attention soon)
- 🔴 Emergency (Immediate medical attention required)
Provide a detailed explanation for the selected risk level.
Triage Categories:
1. Self-Care Appropriate
2. Schedule Doctor Visit
3. Urgent Care Needed
4. Emergency Care Needed
Provide a detailed explanation for this triage.

5. CONFIDENCE LEVEL:
Classify your assessment confidence as "High", "Moderate", or "Low" and explain why. If there is uncertainty or many unknowns, confidence must be Low or Moderate.

6. MEDICATION GUIDANCE:
Suggest commonly used OTC medications when appropriate (e.g., Acetaminophen/Paracetamol or Ibuprofen for fever/pain/inflammation, Cetirizine or Loratadine for allergies, Saline nasal spray for congestion, Antacids or PPIs for acid reflux, Neosporin/antibiotic ointment for minor cuts).
Always:
- Ask about current medications, allergies, pregnancy first, or list critical warns about interactions.
- Explicitly explain: Purpose, Common side-effects, and Important precautions.
- NEVER prescribe, recommend controlled drugs or antibiotics without physical evaluations, or tell users to stop prescription drugs.

7. MEDICAL REPORT ANALYSIS:
If analyzing a lab result, prescription, or clinical report, set "isMedicalReport: true" and fill out:
- Summary
- Important Findings
- Normal Values
- Abnormal Values
- Critical Findings
- Plain Language Explanation
- Possible Significance
- Recommended Follow-Up
- Questions to ask their doctor

8. MEDICAL IMAGE ANALYSIS:
If an image is uploaded (e.g. skin rash, x-ray, wound, burn), set "isMedicalImage: true" and specify:
- Visible Observations
- Possible Interpretations
- Confidence Level
- Limitations
- Recommended Next Steps
Always state: "Image-based analysis has limitations and should be reviewed by a qualified healthcare professional." Do not claim certain cancer, infection, or fracture confirmation.

9. GENERAL CONVERSATION:
If user enters a general hello, greeting, or asks a non-diagnostic general health concept (e.g. "what is DNA", "explain carbs"), set conversationalResponse, keep isEmergency and hasInsufficientInfo false, and fill other fields as empty or null. Populate the disclaimer.`;

// API endpoint for chat processing
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, attachment } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Missing or invalid 'messages' array in request body." });
    }

    const aiClient = getGenAIClient();

    // Prepare content format for Gemini chat
    // contents represents the list of past and current turns
    const contents: any[] = [];

    // Map conversation except the last user message
    for (let i = 0; i < messages.length - 1; i++) {
      const msg = messages[i];
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }

    // Map the latest user message
    const latestMsg = messages[messages.length - 1];
    const latestParts: any[] = [{ text: latestMsg.content }];

    // If an attachment is uploaded (base64 image, report PDF page/image, etc.)
    if (attachment && attachment.data && attachment.mimeType) {
      latestParts.push({
        inlineData: {
          data: attachment.data,
          mimeType: attachment.mimeType,
        },
      });
    }

    contents.push({
      role: "user",
      parts: latestParts,
    });

    // Make the API request to Gemini with a robust retry and fallback mechanism
    let response;
    const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];
    let lastError: any = null;

    for (const model of modelsToTry) {
      let delay = 1000;
      const maxRetries = 2; // Try up to 2 additional retries per model if there are transient errors (like 503, 429)

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[Gemini API] Requesting ${model} (attempt ${attempt + 1}/${maxRetries + 1})...`);
          response = await aiClient.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              responseMimeType: "application/json",
              responseSchema: medicalResponseSchema,
              temperature: 0.2, // Slightly lower temp for more consistent/rigorous clinical outputs
            },
          });
          break; // successfully received response, break out of retry loop
        } catch (err: any) {
          lastError = err;
          console.warn(`[Gemini API Warning] Model ${model} on attempt ${attempt + 1} failed:`, err.message || err);

          // Check if it is a 4xx error that is not 429 (Too Many Requests)
          const errStr = String(err.message || "").toLowerCase();
          const isFatalClientError = (errStr.includes("status: 4") || errStr.includes("\"code\":4") || errStr.includes("bad request")) && !errStr.includes("429");
          
          if (isFatalClientError) {
            console.error(`[Gemini API Error] Fatal client error with model ${model}, aborting retries for this model.`);
            break; // Skip rest of retries for this model
          }

          if (attempt < maxRetries) {
            console.log(`[Gemini API] Retrying in ${delay}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
          }
        }
      }
      if (response) {
        break; // successfully got response, break out of models loop
      }
    }

    if (!response) {
      throw lastError || new Error("All attempts to communicate with the Gemini models failed. Please try again later.");
    }

    const parsedText = response.text || "{}";
    const parsedData = JSON.parse(parsedText);

    res.json(parsedData);
  } catch (err: any) {
    console.error("Gemini API Error in /api/chat:", err);
    res.status(500).json({
      error: err.message || "An unexpected error occurred while communicating with the medical assistant server.",
      isEmergency: false,
      hasInsufficientInfo: false,
      disclaimer: "I am an AI Medical Assistant for educational purposes only and not a substitute for a licensed healthcare professional."
    });
  }
});

// Configure Vite middleware or serve static files
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode with Static Assets...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI Medical Assistant Server listening at http://0.0.0.0:${PORT}`);
  });
}

startServer();
