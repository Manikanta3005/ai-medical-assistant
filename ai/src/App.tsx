import React, { useState, useEffect, useRef } from "react";
import { 
  Plus, 
  Send, 
  Trash2, 
  AlertTriangle, 
  ShieldCheck, 
  Info, 
  ChevronRight, 
  Activity, 
  CheckCircle,
  FileText,
  User,
  ExternalLink,
  Pill,
  HeartIcon,
  RotateCcw,
  Sparkles
} from "lucide-react";
import { MedicalMessage, UserDemographics, MessageAttachment, MedicalResponse } from "./types";
import ProfilePanel from "./components/ProfilePanel";
import AttachmentUpload from "./components/AttachmentUpload";

const DEFAULT_WELCOME_MESSAGE: MedicalMessage = {
  id: "welcome",
  role: "assistant",
  content: "Hello! I am your AI Medical Assistant. I can help you with symptoms, minor or major health problems, accidents, first aid, wellness guidance, or analyze medical images/reports.\n\nTo begin, describe your issue (e.g., 'I burned my finger on the stove' or 'I have a mild headache') or upload a document/image. Feel free to fill out the Patient Context Profile on the right to tailor my safety constraints to your specific health background (allergies, medications, etc.).",
  timestamp: new Date(),
  analysis: {
    disclaimer: "I am an AI Medical Assistant for educational purposes only and not a substitute for a licensed healthcare professional. For diagnosis, treatment, prescriptions, or medical emergencies, consult a qualified healthcare provider.",
    hasInsufficientInfo: false,
    isEmergency: false
  }
};

export default function App() {
  const [messages, setMessages] = useState<MedicalMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<MessageAttachment | null>(null);
  const [profile, setProfile] = useState<UserDemographics>({
    age: "",
    gender: "",
    pregnancyStatus: "",
    allergies: "",
    currentMedications: "",
    conditions: "",
  });
  
  const [activeTab, setActiveTab] = useState<"assessment" | "profile">("assessment");
  const [selectedMessageId, setSelectedMessageId] = useState<string>("welcome");
  const [loading, setLoading] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load state from localStorage on mount
  useEffect(() => {
    const savedProfile = localStorage.getItem("med_profile");
    if (savedProfile) {
      try {
        setProfile(JSON.parse(savedProfile));
      } catch (e) {
        console.error("Failed to load profile", e);
      }
    }

    const savedMessages = localStorage.getItem("med_messages");
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        // Deserialise dates
        const formatted = parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }));
        setMessages(formatted);
        
        // Default select the last assistant message that has an analysis
        const assistantMsgs = formatted.filter((m: any) => m.role === "assistant" && m.analysis);
        if (assistantMsgs.length > 0) {
          setSelectedMessageId(assistantMsgs[assistantMsgs.length - 1].id);
        }
      } catch (e) {
        console.error("Failed to load messages", e);
        setMessages([DEFAULT_WELCOME_MESSAGE]);
      }
    } else {
      setMessages([DEFAULT_WELCOME_MESSAGE]);
    }
  }, []);

  // Sync profile changes to localStorage
  const handleProfileChange = (newProfile: UserDemographics) => {
    setProfile(newProfile);
    localStorage.setItem("med_profile", JSON.stringify(newProfile));
  };

  // Save messages to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("med_messages", JSON.stringify(messages));
    } else {
      localStorage.removeItem("med_messages");
    }
  }, [messages]);

  // Handle scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const clearSession = () => {
    setShowClearConfirm(true);
  };

  const handleClearConfirm = () => {
    localStorage.removeItem("med_messages");
    setMessages([DEFAULT_WELCOME_MESSAGE]);
    setSelectedMessageId("welcome");
    setAttachment(null);
    setInput("");
    setActiveTab("assessment");
    setShowClearConfirm(false);
  };

  const handleSendMessage = async (e?: React.FormEvent, textToOverride?: string) => {
    if (e) e.preventDefault();
    
    const messageText = textToOverride !== undefined ? textToOverride : input;
    if (!messageText.trim() && !attachment) return;

    setLoading(true);
    setInput("");

    // Create unique user message ID
    const userMsgId = `user-${Date.now()}`;
    const userMessage: MedicalMessage = {
      id: userMsgId,
      role: "user",
      content: messageText || (attachment ? `Uploaded image/report: ${attachment.name}` : ""),
      timestamp: new Date(),
      attachment: attachment || undefined
    };

    // Append to messages list
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    // Prepare assistant response stub
    const assistantMsgId = `assistant-${Date.now()}`;
    
    // Build context-enriched query payload for Gemini
    // We prepend the user's Demographic Profile if filled, ensuring high-accuracy personalization
    let requestContent = messageText;
    const profileParts: string[] = [];
    if (profile.age) profileParts.push(`Age: ${profile.age}`);
    if (profile.gender) profileParts.push(`Biological Sex: ${profile.gender}`);
    if (profile.pregnancyStatus && profile.gender === "Female") profileParts.push(`Pregnancy / Breastfeeding Status: ${profile.pregnancyStatus}`);
    if (profile.allergies) profileParts.push(`Known Allergies: ${profile.allergies}`);
    if (profile.currentMedications) profileParts.push(`Current Medications: ${profile.currentMedications}`);
    if (profile.conditions) profileParts.push(`Existing Diagnoses/Conditions: ${profile.conditions}`);

    if (profileParts.length > 0) {
      requestContent = `[Patient Context: ${profileParts.join(", ")}]\n\nPatient Query:\n${messageText}`;
    }

    // Reset attachment field
    const sentAttachment = attachment;
    setAttachment(null);

    try {
      // Map existing messages to API lightweight array
      // Replace last message content with the profile-grafted query
      const apiMessages = updatedMessages.map((m, idx) => {
        let content = m.content;
        if (idx === updatedMessages.length - 1) {
          content = requestContent;
        }
        return {
          role: m.role,
          content: content
        };
      });

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: apiMessages,
          attachment: sentAttachment ? {
            name: sentAttachment.name,
            mimeType: sentAttachment.mimeType,
            data: sentAttachment.data
          } : undefined
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const rawResult: MedicalResponse = await response.json();

      let textOutput = rawResult.conversationalResponse || "";
      if (!textOutput) {
        if (rawResult.isEmergency) {
          textOutput = rawResult.emergencyWarning || "CRITICAL EMERGENCY DETECTED. PLEASE SEEK IMMEDIATE ADVANCED HEALTHCARE OR EMERGENCY SERVICES.";
        } else if (rawResult.hasInsufficientInfo) {
          textOutput = rawResult.insufficientInfoMessage || "I need more parameters to build an assessment. Please answer the follow-up questions.";
        } else {
          textOutput = rawResult.assessment || "I have analyzed your situation and updated the Preliminary Assessment Dashboard on the right.";
        }
      }

      const parsedResponse: MedicalMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: textOutput,
        timestamp: new Date(),
        analysis: rawResult
      };

      setMessages(prev => [...prev, parsedResponse]);
      setSelectedMessageId(assistantMsgId);
      setActiveTab("assessment");

    } catch (err: any) {
      console.error(err);
      const errorMsg: MedicalMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "I apology, but I encountered an error communicating with the clinical reasoning backend. Please check your network and retry.",
        timestamp: new Date(),
        isError: true,
        errorText: err?.message || "Unknown communication issue"
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowUpClick = (question: string) => {
    setInput(question);
    // Autofocus input
    document.getElementById("chat-input-box")?.focus();
  };

  // Find the selected or latest assistant analysis message
  const selectedMessage = messages.find(m => m.id === selectedMessageId) || messages[messages.length - 1];
  const activeAnalysis = selectedMessage?.analysis;

  return (
    <div id="clean-minimal-app" className="flex flex-col h-screen bg-[#F8FAFC] font-sans text-slate-800 overflow-hidden">
      {/* Real-time Emergency Sticky banner if active analysis detects critical emergency */}
      {activeAnalysis?.isEmergency && (
        <div className="bg-red-600 text-white px-6 py-2.5 flex items-center justify-between text-xs animate-pulse sticky top-0 z-50 shadow-md" id="emergency-banner">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="font-bold tracking-wider uppercase">Emergency Warning:</span>
            <span>Immediate care is recommended. Call emergency responders (911 / Local Services) immediately.</span>
          </div>
          <div className="flex gap-4">
            <a 
              href="tel:911" 
              className="bg-white text-red-700 font-bold px-3 py-1 rounded hover:bg-red-50 transition-colors uppercase text-[10px]"
              id="emergency-call-btn"
            >
              Call 911 / Emergency
            </a>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10 shadow-sm" id="header-bar">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold shadow-sm shadow-emerald-600/20">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-slate-800 flex items-center gap-1.5 leading-none">
              MedAssistant <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">AI</span>
            </h1>
            <p className="text-[10px] text-slate-400 mt-0.5">Clinical Companion & symptom triage</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 text-[11px]">
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Safe Clinical Mode Active</span>
          </div>
          
          <button 
            type="button" 
            onClick={clearSession}
            disabled={messages.length <= 1}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 hover:text-slate-900 rounded-xl text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            id="clear-session-btn"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear Chat
          </button>
        </div>
      </header>

      {/* Main Framework Content Container */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden" id="workspace">
        
        {/* Left Side: Medical Interactive Chat Panel */}
        <section className="w-full md:w-[500px] lg:w-[540px] flex flex-col bg-white border-r border-slate-200 shrink-0 overflow-hidden" id="chat-panel">
          
          {/* Conversation Core */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/40" id="message-scroller">
            {messages.map((msg, index) => {
              const timestampStr = msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              const isAssistant = msg.role === "assistant";
              
              return (
                <div 
                  key={msg.id} 
                  onClick={() => {
                    if (isAssistant && msg.analysis) {
                      setSelectedMessageId(msg.id);
                      setActiveTab("assessment");
                    }
                  }}
                  className={`flex flex-col group cursor-pointer transition-all ${
                    isAssistant && selectedMessageId === msg.id 
                      ? "ring-2 ring-emerald-500/20 bg-emerald-50/20 p-3 rounded-2xl" 
                      : "p-1"
                  }`}
                  id={`msg-card-${msg.id}`}
                >
                  <div className="flex items-center justify-between mb-1.5 px-1">
                    <span className={`text-[9px] uppercase font-bold tracking-widest ${
                      isAssistant ? "text-emerald-600" : "text-slate-500"
                    }`}>
                      {isAssistant ? "Clinical Advisor AI" : "Patient Identifier"}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      {timestampStr}
                    </span>
                  </div>

                  <div className={`text-sm leading-relaxed rounded-2xl py-3 px-4 shadow-sm border ${
                    isAssistant 
                      ? "bg-white border-slate-200 text-slate-800 rounded-tl-none" 
                      : "bg-emerald-600 border-emerald-700 text-white rounded-tr-none ml-auto max-w-[90%]"
                  }`}>
                    {/* Render attachment description inside message if uploaded */}
                    {msg.attachment && (
                      <div className="mb-2 p-2 bg-emerald-700/30 rounded-xl flex items-center gap-2 border border-white/10 text-xs">
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{msg.attachment.name}</span>
                        <span className="text-[10px] bg-white/20 px-1 py-0.2 rounded font-mono uppercase shrink-0">
                          {msg.attachment.mimeType.split("/")[1]}
                        </span>
                      </div>
                    )}

                    <p className="whitespace-pre-line text-[13px]">{msg.content}</p>

                    {/* Quick indicator to select assistant messages */}
                    {isAssistant && msg.analysis && selectedMessageId !== msg.id && (
                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 group-hover:text-emerald-600 transition-colors">
                        <span>Click card to inspect parameters & symptoms</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Simulated Server Typing state */}
            {loading && (
              <div className="flex flex-col p-1 animate-pulse" id="typing-stub">
                <div className="text-[9px] uppercase font-bold tracking-widest text-[#059669] mb-1 px-1">
                  AI Medical Assistant Processing...
                </div>
                <div className="bg-white border border-slate-200 text-slate-500 rounded-2xl rounded-tl-none py-4 px-4 w-44 shadow-sm flex items-center gap-2">
                  <div className="flex gap-1.5 items-center">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  </div>
                  <span className="text-xs font-medium text-slate-400 ml-1">Evaluating...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Control Center (Attachment & Inputs) */}
          <div className="p-4 bg-white border-t border-slate-200 space-y-3" id="input-center">
            
            {/* Attachment preview trigger */}
            <AttachmentUpload 
              attachment={attachment}
              onAttachmentChange={setAttachment}
            />

            {/* Input form */}
            <form onSubmit={handleSendMessage} className="flex gap-2.5">
              <input
                id="chat-input-box"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe symptoms, minor/major problems, accidents (e.g. burned finger, minor cut) or ask a health query..."
                disabled={loading}
                className="flex-1 bg-[#F8FAFC] border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={loading || (!input.trim() && !attachment)}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white p-3 rounded-xl disabled:cursor-not-allowed cursor-pointer shadow-sm shadow-emerald-600/10 transition-all flex items-center justify-center aspect-square"
                id="send-message-btn"
                title="Send messages and analyze diagnostics"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </section>

        {/* Right Side: Tabbed Diagnostic Dashboard */}
        <section className="flex-1 flex flex-col bg-white overflow-hidden" id="dashboard-panel">
          
          {/* Dashboard Tabs controls */}
          <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 shrink-0" id="tab-controls">
            <button
              onClick={() => setActiveTab("assessment")}
              className={`pb-3 text-xs font-semibold border-b-2 px-4 transition-all flex items-center gap-2 ${
                activeTab === "assessment"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
              id="tab-btn-assessment"
            >
              <Activity className="w-4 h-4" />
              Clinical Assessment
              {activeAnalysis && !activeAnalysis.hasInsufficientInfo && !activeAnalysis.isEmergency && activeAnalysis.riskLevel && (
                <span className={`w-1.5 h-1.5 rounded-full ${
                  activeAnalysis.riskLevel === "Low Risk" ? "bg-emerald-500" :
                  activeAnalysis.riskLevel === "Moderate Risk" ? "bg-amber-500" : "bg-red-500"
                }`}></span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("profile")}
              className={`pb-3 text-xs font-semibold border-b-2 px-4 transition-all flex items-center gap-2 ${
                activeTab === "profile"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
              id="tab-btn-profile"
            >
              <User className="w-4 h-4" />
              Patient Profile Context
              {(Object.values(profile) as (string | undefined)[]).some(x => x && x.length > 0) && (
                <span className="bg-emerald-100 text-emerald-700 text-[9px] px-1.5 py-0.1 rounded font-bold">SAVED</span>
              )}
            </button>
          </div>

          {/* Active Tab Panel contents */}
          <div className="flex-1 overflow-y-auto p-6" id="tab-viewport">
            
            {activeTab === "profile" ? (
              <ProfilePanel 
                profile={profile}
                onProfileChange={handleProfileChange}
              />
            ) : (
              // Active Assessment Dashboard View
              <div className="space-y-6" id="assessment-tab-view">
                
                {/* 1. Quick Stats Summary Metrics Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Risk Level Badge */}
                  <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-200 shadow-sm transition-all hover:border-slate-300">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Risk Classification</span>
                    <div className="flex items-center gap-2.5 mt-2">
                      <div className="text-xl">
                        {!activeAnalysis ? "⚪" :
                         activeAnalysis.riskLevel === "Low Risk" ? "🟢" : 
                         activeAnalysis.riskLevel === "Moderate Risk" ? "🟡" : 
                         activeAnalysis.riskLevel === "High Risk" ? "🟠" : "🔴"}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-sm">
                          {activeAnalysis?.riskLevel || "No Symptoms Analyzed"}
                        </div>
                        <div className="text-[10px] text-slate-500 line-clamp-1 max-w-[200px]" title={activeAnalysis?.riskExplanation}>
                          {activeAnalysis?.riskExplanation || "Describe symptoms to evaluate risks."}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Clinical Confidence level Gauge */}
                  <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-200 shadow-sm transition-all hover:border-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Assistant Confidence</span>
                      {activeAnalysis?.confidenceLevel && (
                        <span className="text-[9px] text-slate-400 italic">
                          ({activeAnalysis.confidenceLevel === "High" ? "90%+" : activeAnalysis.confidenceLevel === "Moderate" ? "65%+" : "30%"})
                        </span>
                      )}
                    </div>
                    <div className="mt-2">
                      <div className="font-bold text-slate-800 text-sm">
                        {activeAnalysis?.confidenceLevel ? `${activeAnalysis.confidenceLevel} Confidence` : "Awaiting Information"}
                      </div>
                      
                      {/* Interactive Visual Meter */}
                      <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div 
                          className={`h-1.5 rounded-full transition-all duration-500 ${
                            !activeAnalysis ? "w-0 bg-slate-300" :
                            activeAnalysis.confidenceLevel === "High" ? "w-11/12 bg-emerald-600" : 
                            activeAnalysis.confidenceLevel === "Moderate" ? "w-2/3 bg-amber-500" : "w-1/3 bg-red-500"
                          }`}
                        />
                      </div>
                      {activeAnalysis?.confidenceExplanation && (
                        <p className="text-[9px] text-slate-500 mt-1 line-clamp-1 truncate" title={activeAnalysis.confidenceExplanation}>
                          {activeAnalysis.confidenceExplanation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Insufficient Info / Follow up Warning Panel */}
                {activeAnalysis?.hasInsufficientInfo && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3" id="warning-box">
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-amber-600 shrink-0" />
                      <h3 className="font-bold text-amber-900 text-xs uppercase tracking-tight">Additional Information Required</h3>
                    </div>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      {activeAnalysis.insufficientInfoMessage || "I need more parameters about your symptomatology before drawing highly reliable clinical paths."}
                    </p>
                    
                    {activeAnalysis.followUpQuestions && activeAnalysis.followUpQuestions.length > 0 && (
                      <div className="space-y-2 mt-2">
                        <p className="text-[10px] font-bold text-amber-900 uppercase">Recommended Questions to Answer:</p>
                        <ul className="space-y-1.5">
                          {activeAnalysis.followUpQuestions.map((q, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <button 
                                type="button"
                                onClick={() => handleFollowUpClick(q)}
                                className="flex-1 text-left bg-white hover:bg-neutral-50 shadow-sm border border-amber-200 rounded-lg py-1.5 px-3 text-xs text-slate-700 hover:text-slate-900 transition-colors flex items-center justify-between"
                              >
                                <span>{q}</span>
                                <Plus className="w-3 h-3 text-emerald-600 ml-2" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Emergency Warning block */}
                {activeAnalysis?.isEmergency && activeAnalysis.emergencyWarning && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-left space-y-3" id="emergency-detail-box">
                    <div className="flex items-center gap-2 text-red-700">
                      <AlertTriangle className="w-5 h-5 shrink-0" />
                      <span className="font-bold text-xs uppercase tracking-wider">Critical Emergency Indicator</span>
                    </div>
                    <p className="text-sm border-l-2 border-red-500 pl-3 py-1 font-bold text-red-900 bg-red-100/40 rounded-r">
                      {activeAnalysis.triage || "Emergency Care Needed"}
                    </p>
                    <p className="text-xs text-red-800 leading-relaxed whitespace-pre-line font-medium">
                      {activeAnalysis.emergencyWarning}
                    </p>
                    {activeAnalysis.triageExplanation && (
                      <p className="text-xs text-slate-600">
                        <strong>Clinical Assessment:</strong> {activeAnalysis.triageExplanation}
                      </p>
                    )}
                  </div>
                )}

                {/* 4. Normal analysis dashboard payload when insufficient info or emergency is NOT blocking */}
                {activeAnalysis && !activeAnalysis.hasInsufficientInfo && (
                  <div className="space-y-5" id="assessment-details">
                    
                    {/* Preliminary Assessment & Triage */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-emerald-600" />
                          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Triage Path Identification</h3>
                        </div>
                        {activeAnalysis.triage && (
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase border ${
                            activeAnalysis.triage === "Self-Care Appropriate" ? "bg-emerald-50 text-emerald-800 border-emerald-100" :
                            activeAnalysis.triage === "Schedule Doctor Visit" ? "bg-blue-50 text-blue-800 border-blue-100" :
                            activeAnalysis.triage === "Urgent Care Needed" ? "bg-amber-50 text-amber-800 border-amber-100" :
                            "bg-red-50 text-red-800 border-red-100"
                          }`}>
                            {activeAnalysis.triage}
                          </span>
                        )}
                      </div>

                      {activeAnalysis.assessment && (
                        <div>
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Analysis Summary</h4>
                          <p className="text-xs text-slate-600 leading-relaxed mt-1">
                            {activeAnalysis.assessment}
                          </p>
                        </div>
                      )}

                      {activeAnalysis.triageExplanation && (
                        <div>
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Triage Rationale</h4>
                          <p className="text-xs text-slate-600 leading-relaxed mt-1 italic">
                            {activeAnalysis.triageExplanation}
                          </p>
                        </div>
                      )}

                      {/* Possible Causes List, beautifully grid aligned */}
                      {activeAnalysis.possibleCauses && activeAnalysis.possibleCauses.length > 0 && (
                        <div>
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Possible Causes / Etiology</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {activeAnalysis.possibleCauses.map((cause, idx) => (
                              <div key={idx} className="bg-[#F8FAFC] border border-slate-200 rounded-lg p-3 text-xs flex gap-2">
                                <span className="bg-emerald-100 text-emerald-700 w-5 h-5 rounded-full flex items-center justify-center font-bold font-mono text-[9px] shrink-0">
                                  {idx + 1}
                                </span>
                                <div>
                                  <p className="font-semibold text-slate-800">{cause}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Medical Image / Skin Rash observations if uploaded */}
                    {activeAnalysis.isMedicalImage && activeAnalysis.imageAnalysis && (
                      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                          <Activity className="w-4 h-4 text-blue-600" />
                          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Medical Image Diagnostics</h3>
                        </div>

                        <div className="space-y-3">
                          {activeAnalysis.imageAnalysis.visibleObservations && activeAnalysis.imageAnalysis.visibleObservations.length > 0 && (
                            <div>
                              <h4 className="text-[10px] font-bold text-slate-400 uppercase">Visible Clinical Observations</h4>
                              <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 mt-1">
                                {activeAnalysis.imageAnalysis.visibleObservations.map((obs, idx) => (
                                  <li key={idx}>{obs}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {activeAnalysis.imageAnalysis.possibleInterpretations && activeAnalysis.imageAnalysis.possibleInterpretations.length > 0 && (
                            <div>
                              <h4 className="text-[10px] font-bold text-slate-400 uppercase">Differential Interpretations</h4>
                              <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 mt-1">
                                {activeAnalysis.imageAnalysis.possibleInterpretations.map((interp, idx) => (
                                  <li key={idx} className="font-medium">{interp}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                            {activeAnalysis.imageAnalysis.confidenceLevel && (
                              <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Confidence Level</span>
                                <p className="text-xs font-semibold text-slate-800 mt-0.5">{activeAnalysis.imageAnalysis.confidenceLevel}</p>
                              </div>
                            )}
                            {activeAnalysis.imageAnalysis.limitations && (
                              <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Analysis Limitation</span>
                                <p className="text-xs text-slate-600 mt-0.5">{activeAnalysis.imageAnalysis.limitations}</p>
                              </div>
                            )}
                          </div>

                          {activeAnalysis.imageAnalysis.recommendedNextSteps && activeAnalysis.imageAnalysis.recommendedNextSteps.length > 0 && (
                            <div className="pt-2">
                              <h4 className="text-[10px] font-bold text-slate-400 uppercase">Image Analysis Recommended Next Step</h4>
                              <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-xs text-blue-800 mt-1">
                                {activeAnalysis.imageAnalysis.recommendedNextSteps.map((step, idx) => (
                                  <div key={idx} className="flex gap-2">
                                    <span>•</span>
                                    <span>{step}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <p className="text-[10px] text-slate-400 italic bg-slate-50 p-2 rounded">
                            Notice: Image-based analysis has limitations and should be reviewed by a qualified healthcare professional.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Medical Reports / Chem labs diagnostic summaries */}
                    {activeAnalysis.isMedicalReport && activeAnalysis.reportAnalysis && (
                      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                          <Activity className="w-4 h-4 text-[#4f46e5]" />
                          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Medical Document / Lab Report Analysis</h3>
                        </div>

                        <div className="space-y-3">
                          {activeAnalysis.reportAnalysis.summary && (
                            <div>
                              <h4 className="text-[10px] font-bold text-slate-400 uppercase">Summary Statement</h4>
                              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{activeAnalysis.reportAnalysis.summary}</p>
                            </div>
                          )}

                          {activeAnalysis.reportAnalysis.plainLanguageExplanation && (
                            <div>
                              <h4 className="text-[10px] font-bold text-slate-400 uppercase">Plain Language Explanations</h4>
                              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed bg-[#fbfbfb] p-2.5 border rounded-lg whitespace-pre-wrap">{activeAnalysis.reportAnalysis.plainLanguageExplanation}</p>
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            {activeAnalysis.reportAnalysis.normalValues && activeAnalysis.reportAnalysis.normalValues.length > 0 && (
                              <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-lg text-xs">
                                <span className="font-bold text-emerald-800 uppercase text-[9px]">Normal Identified Values</span>
                                <ul className="list-disc list-inside mt-1 text-emerald-700 space-y-0.5 text-[11px]">
                                  {activeAnalysis.reportAnalysis.normalValues.map((v, i) => <li key={i}>{v}</li>)}
                                </ul>
                              </div>
                            )}

                            {activeAnalysis.reportAnalysis.abnormalValues && activeAnalysis.reportAnalysis.abnormalValues.length > 0 && (
                              <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-lg text-xs">
                                <span className="font-bold text-amber-800 uppercase text-[9px]">Abnormal Values</span>
                                <ul className="list-disc list-inside mt-1 text-amber-700 space-y-0.5 text-[11px]">
                                  {activeAnalysis.reportAnalysis.abnormalValues.map((v, i) => <li key={i}>{v}</li>)}
                                </ul>
                              </div>
                            )}
                          </div>

                          {activeAnalysis.reportAnalysis.criticalFindings && activeAnalysis.reportAnalysis.criticalFindings.length > 0 && (
                            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs">
                              <span className="font-bold text-red-800 uppercase text-[9px]">Critical Highlight Findings</span>
                              <ul className="list-disc list-inside mt-1 text-red-700 space-y-0.5 text-[11px]">
                                {activeAnalysis.reportAnalysis.criticalFindings.map((v, i) => <li key={i}>{v}</li>)}
                              </ul>
                            </div>
                          )}

                          {activeAnalysis.reportAnalysis.possibleSignificance && (
                            <div>
                              <h4 className="text-[10px] font-bold text-slate-400 uppercase">Possible Diagnostic Significance</h4>
                              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{activeAnalysis.reportAnalysis.possibleSignificance}</p>
                            </div>
                          )}

                          {activeAnalysis.reportAnalysis.recommendedFollowUp && (
                            <div className="bg-slate-50 border p-3 rounded-lg">
                              <h4 className="text-[10px] font-bold text-slate-400 uppercase">Recommended Professional Follow-Up</h4>
                              <p className="text-xs text-slate-800 mt-0.5 font-medium leading-relaxed">{activeAnalysis.reportAnalysis.recommendedFollowUp}</p>
                            </div>
                          )}

                          {activeAnalysis.reportAnalysis.questionsToAskYourDoctor && activeAnalysis.reportAnalysis.questionsToAskYourDoctor.length > 0 && (
                            <div className="bg-[#fafafa] border border-dashed p-3.5 rounded-xl">
                              <h4 className="text-[10px] font-bold text-indigo-800 uppercase flex items-center gap-1.5 mb-1.5">
                                <FileText className="w-3.5 h-3.5" />
                                Questions to Ask Your Physician:
                              </h4>
                              <ul className="space-y-1 list-decimal list-inside text-xs text-indigo-900 font-medium">
                                {activeAnalysis.reportAnalysis.questionsToAskYourDoctor.map((item, idx) => (
                                  <li key={idx} className="leading-relaxed">{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Recommended Medication Guidance Box */}
                    {activeAnalysis.medicationOptions && activeAnalysis.medicationOptions.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 text-emerald-700">
                          <Pill className="w-5 h-5 shrink-0" />
                          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Informed OTC Medication Guidance</h3>
                        </div>

                        <div className="space-y-3.5">
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Based on your profile, the following over-the-counter (OTC) supportive care medications may be options. Consider these general safety boundaries:
                          </p>

                          {activeAnalysis.medicationOptions.map((med, idx) => (
                            <div key={idx} className="p-3 border border-slate-200 bg-slate-50/60 rounded-xl space-y-2">
                              <div className="flex justify-between items-center bg-slate-100/80 px-2 py-1 rounded">
                                <span className="text-xs font-bold text-slate-800">{med.name}</span>
                                <span className="text-[10px] uppercase bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">Safety profile</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] leading-relaxed">
                                <div>
                                  <span className="font-bold text-slate-500">Clinical Purpose:</span>
                                  <p className="text-slate-700 mt-0.5">{med.purpose}</p>
                                </div>
                                <div>
                                  <span className="font-bold text-red-500">Common Side Effects:</span>
                                  <p className="text-slate-700 mt-0.5">{med.sideEffects}</p>
                                </div>
                                <div>
                                  <span className="font-bold text-amber-600">Precautions/Interactions:</span>
                                  <p className="text-slate-700 mt-0.5">{med.precautions}</p>
                                </div>
                              </div>
                            </div>
                          ))}

                          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-[11px] text-emerald-800 flex items-start gap-2 leading-relaxed">
                            <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                              Always check correct local dose details. If you have active allergies, pregnancy, kidney/liver issues or are taking prescription medicines, consult a licensed pharmacist or doctor before starting OTC treatments. Never stop prescribed medicines unilaterally.
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Self-Care, Lifestyle & Physical Remedies */}
                    {activeAnalysis.selfCareRecommendations && activeAnalysis.selfCareRecommendations.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 text-slate-700">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Self-Care & Comfort Measures</h3>
                        </div>
                        <ul className="space-y-2">
                          {activeAnalysis.selfCareRecommendations.map((rec, idx) => (
                            <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-600">
                              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                              <span className="leading-relaxed">{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Prevention Tips */}
                    {activeAnalysis.preventionTips && activeAnalysis.preventionTips.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 text-slate-700">
                          <HeartIcon className="w-4 h-4 text-rose-500" />
                          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Prevention & Wellness Advice</h3>
                        </div>
                        <ul className="space-y-2">
                          {activeAnalysis.preventionTips.map((tip, idx) => (
                            <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-600">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0 mt-1.5"></span>
                              <span className="leading-relaxed">{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Red flag indicators: When to Seek Medical Care */}
                    {activeAnalysis.whenToSeekMedicalCare && activeAnalysis.whenToSeekMedicalCare.length > 0 && (
                      <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-5 space-y-3">
                        <div className="flex items-center gap-2 border-b border-amber-100 pb-2.5 text-amber-700">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wide">When to Seek Emergency/Advanced Care</h3>
                        </div>
                        <ul className="space-y-1.5">
                          {activeAnalysis.whenToSeekMedicalCare.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-xs text-amber-800">
                              <span className="font-bold text-amber-600">•</span>
                              <span className="leading-relaxed">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  </div>
                )}

                {/* Default placeholder state if there's no diagnostic parameters yet */}
                {!activeAnalysis && (
                  <div className="flex flex-col items-center justify-center py-20 text-center space-y-4" id="empty-dashboard-state">
                    <div className="bg-emerald-50 p-4 rounded-full text-emerald-600">
                      <Sparkles className="w-10 h-10 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">No Advisory Data Generated</h3>
                      <p className="text-xs text-slate-400 max-w-sm mt-1 mx-auto leading-relaxed">
                        A clinical assessment dashboard will automatically build here. Type your symptoms, upload lab results or medical skin/X-ray images in the chat.
                      </p>
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>

          {/* Action button in the layout based on the theme design */}
          {activeAnalysis && !activeAnalysis.hasInsufficientInfo && (
            <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0">
              <button 
                onClick={() => {
                  window.open("https://maps.google.com/?q=hospitals+near+me", "_blank");
                }}
                className="w-full bg-slate-900 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-all cursor-pointer shadow-sm text-xs"
                id="hospitalizer-btn"
              >
                <span>LOCATE NEAREST HEALTHCARE FACILITY</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

        </section>

      </main>

      {/* Sticky mandated disclaimer footer */}
      <footer className="h-12 bg-white border-t border-slate-200 flex items-center justify-center px-6 shrink-0 z-10" id="footer-banner">
        <p className="text-[10px] text-slate-400 text-center leading-tight max-w-[800px]" id="disclaimer-text">
          {activeAnalysis?.disclaimer || "I am an AI Medical Assistant for educational purposes only and not a substitute for a licensed healthcare professional. For diagnosis, treatment, prescriptions, or medical emergencies, consult a qualified healthcare provider."}
        </p>
      </footer>

      {/* Custom Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50" id="clear-chat-modal">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-5 shadow-xl space-y-4">
            <div className="flex items-start gap-4">
              <div className="bg-amber-50 p-2.5 rounded-xl text-amber-700 border border-amber-150 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800">Clear Conversation History?</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Are you sure you want to clear your current conversation history? This will erase all diagnostic messages but preserve your Patient Profile Context.
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-3.5 py-2 text-xs font-semibold border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-all cursor-pointer"
                id="cancel-clear-btn"
              >
                No, Keep it
              </button>
              <button
                type="button"
                onClick={handleClearConfirm}
                className="px-4 py-2 text-xs font-bold bg-slate-900 border border-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all cursor-pointer shadow-sm"
                id="confirm-clear-btn"
              >
                Yes, Clear Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
