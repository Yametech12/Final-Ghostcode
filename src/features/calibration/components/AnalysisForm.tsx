/**
 * Calibration feature — AI Oracle scenario form.
 * JSX extracted verbatim from src/pages/CalibrationPage.tsx (mechanical refactor).
 */
import React from 'react';
import {
  Target, Loader2, Info, MessageSquare, UserCheck, Zap, Filter, Brain
} from 'lucide-react';
import type { StructuredInput } from '../types';

interface AnalysisFormProps {
  structuredInput: StructuredInput;
  onChange: (input: StructuredInput) => void;
  onClear: () => void;
  isLoading: boolean;
  onAnalyze: () => void;
}

export function AnalysisForm({ structuredInput, onChange, onClear, isLoading, onAnalyze }: AnalysisFormProps) {
  return (
    <div className="glass-card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Target className="w-5 h-5 text-accent-primary" />
          Scenario Parameters
        </h3>
        <button
          onClick={onClear}
          className="text-xs font-bold text-slate-500 hover:text-accent-primary transition-colors uppercase tracking-widest"
        >
          Clear Form
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Info className="w-3 h-3" />
            Eye Contact
          </label>
          <select
            value={structuredInput.eyeContact}
            onChange={(e) => onChange({...structuredInput, eyeContact: e.target.value})}
            className="custom-select w-full"
          >
            <option value="" className="bg-slate-900">Select...</option>
            <option value="Intense / Holding gaze" className="bg-slate-900">Intense / Holding gaze</option>
            <option value="Shy / Looking down" className="bg-slate-900">Shy / Looking down</option>
            <option value="Avoiding / Looking around room" className="bg-slate-900">Avoiding / Looking around room</option>
            <option value="Normal / Conversational" className="bg-slate-900">Normal / Conversational</option>
            <option value="Rapid blinking / Nervous" className="bg-slate-900">Rapid blinking / Nervous</option>
            <option value="Squinting / Skeptical" className="bg-slate-900">Squinting / Skeptical</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <MessageSquare className="w-3 h-3" />
            Conversation Topic
          </label>
          <select
            value={structuredInput.conversationTopic}
            onChange={(e) => onChange({...structuredInput, conversationTopic: e.target.value})}
            className="custom-select w-full"
          >
            <option value="" className="bg-slate-900">Select...</option>
            <option value="Work / Career / Goals" className="bg-slate-900">Work / Career / Goals</option>
            <option value="Family / Friends / Relationships" className="bg-slate-900">Family / Friends / Relationships</option>
            <option value="Hobbies / Fun / Travel" className="bg-slate-900">Hobbies / Fun / Travel</option>
            <option value="Deep / Philosophical" className="bg-slate-900">Deep / Philosophical</option>
            <option value="Small Talk / Surface Level" className="bg-slate-900">Small Talk / Surface Level</option>
            <option value="Complaining / Negative" className="bg-slate-900">Complaining / Negative</option>
            <option value="Boasting / Self-centered" className="bg-slate-900">Boasting / Self-centered</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <UserCheck className="w-3 h-3" />
            Body Language
          </label>
          <select
            value={structuredInput.bodyLanguage}
            onChange={(e) => onChange({...structuredInput, bodyLanguage: e.target.value})}
            className="custom-select w-full"
          >
            <option value="" className="bg-slate-900">Select...</option>
            <option value="Open / Relaxed / Leaning in" className="bg-slate-900">Open / Relaxed / Leaning in</option>
            <option value="Closed / Guarded / Arms crossed" className="bg-slate-900">Closed / Guarded / Arms crossed</option>
            <option value="Fidgety / Distracted / Restless" className="bg-slate-900">Fidgety / Distracted / Restless</option>
            <option value="Touchy / Flirty / Playful" className="bg-slate-900">Touchy / Flirty / Playful</option>
            <option value="Mirroring your movements" className="bg-slate-900">Mirroring your movements</option>
            <option value="Rigid / Professional / Stiff" className="bg-slate-900">Rigid / Professional / Stiff</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Zap className="w-3 h-3" />
            Clothing Style
          </label>
          <select
            value={structuredInput.clothingStyle}
            onChange={(e) => onChange({...structuredInput, clothingStyle: e.target.value})}
            className="custom-select w-full"
          >
            <option value="" className="bg-slate-900">Select...</option>
            <option value="Modest / Conservative" className="bg-slate-900">Modest / Conservative</option>
            <option value="Trendy / Fashionable" className="bg-slate-900">Trendy / Fashionable</option>
            <option value="Classy / Elegant" className="bg-slate-900">Classy / Elegant</option>
            <option value="Casual / Practical / Tomboy" className="bg-slate-900">Casual / Practical / Tomboy</option>
            <option value="Revealing / Sexy / Edgy" className="bg-slate-900">Revealing / Sexy / Edgy</option>
            <option value="Artistic / Eccentric / Unique" className="bg-slate-900">Artistic / Eccentric / Unique</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Filter className="w-3 h-3" />
            Dating Venue
          </label>
          <select
            value={structuredInput.datingVenue}
            onChange={(e) => onChange({...structuredInput, datingVenue: e.target.value})}
            className="custom-select w-full"
          >
            <option value="" className="bg-slate-900">Select...</option>
            <option value="Loud Club / Bar" className="bg-slate-900">Loud Club / Bar</option>
            <option value="Quiet Lounge / Cafe" className="bg-slate-900">Quiet Lounge / Cafe</option>
            <option value="Outdoor / Park / Beach" className="bg-slate-900">Outdoor / Park / Beach</option>
            <option value="Formal Restaurant" className="bg-slate-900">Formal Restaurant</option>
            <option value="Activity Based (Bowling, etc)" className="bg-slate-900">Activity Based (Bowling, etc)</option>
            <option value="Private / Home" className="bg-slate-900">Private / Home</option>
            <option value="Professional / Office" className="bg-slate-900">Professional / Office</option>
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Additional Notes (Optional)</label>
        <textarea
          value={structuredInput.additionalNotes}
          onChange={(e) => onChange({...structuredInput, additionalNotes: e.target.value})}
          placeholder="Any other specific behaviors, quotes, or context..."
          className="w-full h-20 bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-accent-primary/50 transition-all resize-none"
        />
      </div>

      <button
        onClick={onAnalyze}
        disabled={isLoading}
        className="w-full py-4 rounded-xl accent-gradient text-white font-bold shadow-xl shadow-accent-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-3"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Extracting Behavioral Matrix...
          </>
        ) : (
          <>
            <Brain className="w-5 h-5" />
            Extract Profile
          </>
        )}
      </button>
    </div>
  );
}
