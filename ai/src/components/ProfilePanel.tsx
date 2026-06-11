import React from "react";
import { UserDemographics } from "../types";
import { Activity, Shield, User, Info, FileText } from "lucide-react";

interface ProfilePanelProps {
  profile: UserDemographics;
  onProfileChange: (profile: UserDemographics) => void;
}

export default function ProfilePanel({ profile, onProfileChange }: ProfilePanelProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    onProfileChange({
      ...profile,
      [name]: value,
    });
  };

  const clearProfile = () => {
    onProfileChange({
      age: "",
      gender: "",
      pregnancyStatus: "",
      allergies: "",
      currentMedications: "",
      conditions: "",
    });
  };

  const isProfileEmpty = !profile.age && !profile.gender && !profile.allergies && !profile.currentMedications && !profile.conditions;

  return (
    <div id="profile-panel" className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5 h-full flex flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-100 p-2 rounded-lg text-emerald-700">
            <User className="w-5 h-5" id="profile-icon" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-800">Symptom Context Profile</h2>
            <p className="text-xs text-slate-500">Improves symptom assessment speed</p>
          </div>
        </div>
        {!isProfileEmpty && (
          <button 
            type="button" 
            onClick={clearProfile} 
            className="text-xs text-slate-500 hover:text-red-500 transition-colors"
            id="clear-profile-btn"
          >
            Clear Profile
          </button>
        )}
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Age</label>
            <input
              type="text"
              name="age"
              value={profile.age || ""}
              onChange={handleChange}
              placeholder="e.g. 34"
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              id="age-input"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Biological Sex</label>
            <select
              name="gender"
              value={profile.gender || ""}
              onChange={handleChange}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              id="gender-select"
            >
              <option value="">Select...</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </div>
        </div>

        {profile.gender === "Female" && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Pregnancy / Breastfeeding Status</label>
            <select
              name="pregnancyStatus"
              value={profile.pregnancyStatus || ""}
              onChange={handleChange}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              id="pregnancy-select"
            >
              <option value="">Select status...</option>
              <option value="Not Pregnant">Not Pregnant / Lactating</option>
              <option value="Pregnant (1st Trimester)">Pregnant (1st Trimester)</option>
              <option value="Pregnant (2nd Trimester)">Pregnant (2nd Trimester)</option>
              <option value="Pregnant (3rd Trimester)">Pregnant (3rd Trimester)</option>
              <option value="Breastfeeding">Breastfeeding</option>
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Allergies (Drugs, Foods, env)</label>
          <textarea
            name="allergies"
            value={profile.allergies || ""}
            onChange={handleChange}
            placeholder="e.g. Penicillin, Peanuts, Gluten"
            rows={2}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
            id="allergies-textarea"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Current Medications</label>
          <textarea
            name="currentMedications"
            value={profile.currentMedications || ""}
            onChange={handleChange}
            placeholder="e.g. Lipitor 10mg daily, Metformin"
            rows={2}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
            id="medications-textarea"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Existing Medical Conditions</label>
          <textarea
            name="conditions"
            value={profile.conditions || ""}
            onChange={handleChange}
            placeholder="e.g. Hypertension, Type 2 Diabetes, Asthma"
            rows={2}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
            id="conditions-textarea"
          />
        </div>
      </div>

      <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 space-y-2 mt-auto">
        <div className="flex items-start gap-2 text-xs text-slate-600">
          <Shield className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <p>
            <strong>Local Privacy:</strong> This profile is stored strictly in your browser&apos;s localStorage and is only attached to active AI inquiries. No data is stored permanently on any server databases.
          </p>
        </div>
        <div className="flex items-start gap-2 text-xs text-slate-500">
          <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <p>
            Do not enter highly sensitive state identifiers or credentials (SSNs, login passwords) in any inputs.
          </p>
        </div>
      </div>
    </div>
  );
}
