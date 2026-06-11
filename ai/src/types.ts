export interface MessageAttachment {
  name: string;
  mimeType: string;
  data: string; // Base64 code
}

export interface MedicalResponse {
  isEmergency: boolean;
  emergencyWarning?: string;
  hasInsufficientInfo: boolean;
  insufficientInfoMessage?: string;
  
  assessment?: string;
  riskLevel?: "Low Risk" | "Moderate Risk" | "High Risk" | "Emergency";
  riskExplanation?: string;
  confidenceLevel?: "High" | "Moderate" | "Low";
  confidenceExplanation?: string;
  
  possibleCauses?: string[];
  triage?: "Self-Care Appropriate" | "Schedule Doctor Visit" | "Urgent Care Needed" | "Emergency Care Needed";
  triageExplanation?: string;
  
  recommendedActions?: string[];
  
  medicationOptions?: Array<{
    name: string;
    purpose: string;
    sideEffects: string;
    precautions: string;
  }>;
  
  selfCareRecommendations?: string[];
  preventionTips?: string[];
  whenToSeekMedicalCare?: string[];
  
  isMedicalReport?: boolean;
  reportAnalysis?: {
    summary: string;
    importantFindings: string[];
    normalValues: string[];
    abnormalValues: string[];
    criticalFindings: string[];
    plainLanguageExplanation: string;
    possibleSignificance: string;
    recommendedFollowUp: string;
    questionsToAskYourDoctor: string[];
  };
  
  isMedicalImage?: boolean;
  imageAnalysis?: {
    visibleObservations: string[];
    possibleInterpretations: string[];
    confidenceLevel: string;
    limitations: string;
    recommendedNextSteps: string[];
  };
  
  followUpQuestions?: string[];
  conversationalResponse?: string;
  disclaimer: string;
}

export interface MedicalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  attachment?: MessageAttachment;
  analysis?: MedicalResponse;
  isLoading?: boolean;
  isError?: boolean;
  errorText?: string;
}

export interface UserDemographics {
  age?: string;
  gender?: string;
  pregnancyStatus?: string;
  allergies?: string;
  currentMedications?: string;
  conditions?: string;
}
