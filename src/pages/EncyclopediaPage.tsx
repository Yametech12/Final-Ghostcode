import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  Heart,
  User,
  Shield,
  Flame,
  Target,
  BookOpen,
  Zap,
  AlertCircle,
  MessageSquare,
  Trophy,
  Flag,
  HandMetal,
  ChevronRight,
  Compass,
  Calendar,
  Quote,
  Brain,
  Info,
  MapPin,
  Shirt,
  Activity,
} from "lucide-react";
import { personalityTypes } from "../data/personalityTypes";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import ReactMarkdown from "react-markdown";
import FavoriteButton from "../components/FavoriteButton";
import ProfileRadarChart from "../components/ProfileRadarChart";
import Tooltip from "../components/Tooltip";
import { glossaryTerms } from "../components/GlossaryText";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function EncyclopediaPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedType = searchParams.get("type") || personalityTypes[0].id;
  const profile =
    personalityTypes.find((p) => p.id === selectedType) || personalityTypes[0];
  const profileRef = React.useRef<HTMLDivElement>(null);

  const tabs = [
    { id: "overview", label: "Overview", icon: Info },
    { id: "strategy", label: "Strategy", icon: Target },
    { id: "physicality", label: "Physicality", icon: Flame },
    { id: "triggers", label: "Triggers & Reads", icon: Zap },
    { id: "dating", label: "Dating Plan", icon: Compass },
    { id: "relationship", label: "Relationship", icon: Shield },
    { id: "freak", label: "Freak", icon: HandMetal },
    { id: "darkmind", label: "Dark Mind", icon: Brain },
    { id: "psychology", label: "Psych Profile", icon: Activity },
  ] as const;

  const [activeTab, setActiveTab] =
    React.useState<(typeof tabs)[number]["id"]>("overview");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Sidebar - Type Selection */}
      <div className="lg:col-span-3 space-y-4">
        <h2 className="text-sm font-medium text-slate-500 uppercase tracking-widest px-4 hidden lg:block">
          Personality Types
        </h2>
        <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-4 lg:pb-0 px-4 lg:px-0 scrollbar-hide">
          {personalityTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => {
                setSearchParams({ type: type.id });
                setActiveTab("overview");
                // On mobile, scroll to top when changing type
                if (window.innerWidth < 1024) {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              className={cn(
                "flex-shrink-0 lg:w-full flex flex-col items-start px-4 py-3 rounded-xl transition-all duration-200 group border lg:border-none",
                selectedType === type.id
                  ? "bg-accent-primary/10 border-accent-primary lg:border-l-4 lg:border-accent-primary text-accent-primary"
                  : "text-slate-400 border-white/5 hover:bg-white/5 hover:text-slate-200",
              )}
            >
              <span className="font-bold text-base lg:text-lg whitespace-nowrap">
                {type.name}
              </span>
              <span className="text-[10px] lg:text-xs font-mono opacity-60">
                {type.id}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:col-span-9 space-y-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <FavoriteButton
              contentId={profile.id}
              contentType="type"
              title={profile.name}
              className="bg-white/5 border border-white/10"
            />
          </div>
        </div>
        <div ref={profileRef} className="glass-card p-8 md:p-12 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-block px-3 py-1 rounded-lg bg-accent-primary/10 text-accent-primary text-xs font-mono font-bold tracking-widest uppercase">
                {profile.combination}
              </div>
              <h1 className="text-4xl md:text-6xl font-bold">{profile.name}</h1>
              <p className="text-xl text-accent-primary/80 font-medium italic">
                {profile.tagline}
              </p>
            </div>
            <div className="text-5xl md:text-7xl font-mono font-bold text-white/5 select-none">
              {profile.id}
            </div>
          </div>

          {/* ETS Sequence Visualization */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5 pt-6">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mr-2 mt-1.5">
              ETS:
            </span>
            {profile.ets.map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-slate-300">
                  {i + 1}. {step}
                </span>
                {i < profile.ets.length - 1 && (
                  <ChevronRight className="w-3 h-3 text-slate-600" />
                )}
              </div>
            ))}
          </div>

          {/* Tab Navigation */}
          <div className="flex flex-wrap gap-2 border-b border-white/5 pb-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-accent-primary text-white shadow-lg shadow-accent-primary/20"
                    : "text-slate-400 hover:text-white hover:bg-white/5",
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div key={activeTab + profile.id} className="space-y-8 min-h-[400px]">
            {activeTab === "overview" && (
              <div className="space-y-8">
                <div className="space-y-8">
                  <section className="space-y-4">
                    <h3 className="text-2xl font-bold flex items-center gap-3">
                      <BookOpen className="w-6 h-6 text-accent-primary" />
                      Character Overview
                    </h3>
                    <div className="text-lg text-slate-300 leading-relaxed">
                      <div className="markdown-body">
                        <ReactMarkdown>{profile.overview}</ReactMarkdown>
                      </div>
                    </div>
                  </section>
                  {profile.interactionStrategy && (
                    <section className="p-6 rounded-2xl bg-accent-primary/5 border border-accent-primary/20 space-y-4">
                      <h3 className="text-xl font-bold flex items-center gap-3 text-accent-primary">
                        <Target className="w-6 h-6" />
                        Interaction Strategy
                      </h3>
                      <p className="text-lg text-slate-300 leading-relaxed italic">
                        {profile.interactionStrategy}
                      </p>
                    </section>
                  )}
                  <section className="space-y-4">
                    <h3 className="text-2xl font-bold flex items-center gap-3">
                      <Zap className="w-6 h-6 text-accent-primary" />
                      How She Gets What She Wants
                    </h3>
                    <div className="text-slate-400 leading-relaxed">
                      <div className="markdown-body">
                        <ReactMarkdown>
                          {profile.howSheGetsWhatSheWants}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <section className="p-6 rounded-2xl bg-accent-primary/5 border border-accent-primary/10 space-y-4">
                    <h3 className="text-xl font-bold flex items-center gap-3 text-accent-primary">
                      <Heart className="w-6 h-6" />
                      What She Really Wants
                    </h3>
                    <div className="text-slate-300 leading-relaxed italic">
                      <div className="markdown-body">
                        <ReactMarkdown>{profile.whatSheWants}</ReactMarkdown>
                      </div>
                    </div>
                  </section>
                  <section className="p-6 rounded-2xl bg-red-500/5 border border-red-500/10 space-y-4">
                    <h3 className="text-xl font-bold flex items-center gap-3 text-red-400">
                      <AlertCircle className="w-6 h-6" />
                      What to Avoid
                    </h3>
                    <ul className="space-y-2">
                      {profile.whatToAvoid.map((item, i) => (
                        <li
                          key={i}
                          className="flex gap-3 items-start text-slate-400 text-sm"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                    <h4 className="font-bold text-lg flex items-center gap-2">
                      <User className="w-5 h-5 text-accent-primary" />
                      Key Traits
                    </h4>
                    <ul className="space-y-2">
                      {profile.keyTraits.map((trait, i) => {
                        const glossaryMatch = glossaryTerms.find((t) =>
                          trait.toLowerCase().includes(t.term.toLowerCase()),
                        );

                        return (
                          <li
                            key={i}
                            className="flex gap-2 items-start text-slate-400 text-sm"
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-accent-primary mt-1.5 shrink-0" />
                            {glossaryMatch ? (
                              <Tooltip
                                term={glossaryMatch.term}
                                definition={glossaryMatch.definition}
                              >
                                {trait}
                              </Tooltip>
                            ) : (
                              trait
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                    <h4 className="font-bold text-lg flex items-center gap-2">
                      <Flame className="w-5 h-5 text-orange-500" />
                      Core Desires
                    </h4>
                    <div className="text-slate-400 text-sm leading-relaxed">
                      <div className="markdown-body">
                        <ReactMarkdown>{profile.desires}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                    <h4 className="font-bold text-lg flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-accent-secondary" />
                      Where to Find Her
                    </h4>
                    <ul className="space-y-2">
                      {profile.whereToFindHer.map((place, i) => (
                        <li
                          key={i}
                          className="flex gap-2 items-start text-slate-400 text-sm"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-accent-secondary mt-1.5 shrink-0" />
                          {place}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                    <h4 className="font-bold text-lg flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-blue-400" />
                      Texting Style
                    </h4>
                    <div className="text-slate-400 text-sm leading-relaxed">
                      {profile.textingStyle}
                    </div>
                  </div>
                  <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                    <h4 className="font-bold text-lg flex items-center gap-2">
                      <Shirt className="w-5 h-5 text-pink-400" />
                      Style & Appearance
                    </h4>
                    <div className="text-slate-400 text-sm leading-relaxed">
                      {profile.styleAndAppearance}
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-accent-primary/5 border border-accent-primary/10 space-y-4">
                  <h4 className="font-bold text-lg flex items-center gap-2">
                    <HandMetal className="w-5 h-5 text-accent-primary" />
                    Compatibility
                  </h4>
                  <div className="text-slate-300 leading-relaxed">
                    <div className="markdown-body">
                      <ReactMarkdown>{profile.compatibility}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "strategy" && (
              <div className="space-y-12">
                {[
                  {
                    label: "Ignition",
                    content: profile.strategy.ignition,
                    example: profile.strategy.ignitionExample,
                    scenario: profile.strategy.ignitionScenario,
                    color: "from-blue-500 to-cyan-500",
                  },
                  {
                    label: "Momentum",
                    content: profile.strategy.momentum,
                    example: profile.strategy.momentumExample,
                    scenario: profile.strategy.momentumScenario,
                    color: "from-accent-primary to-accent-secondary",
                  },
                  {
                    label: "Connection",
                    content: profile.strategy.connection,
                    example: profile.strategy.connectionExample,
                    scenario: profile.strategy.connectionScenario,
                    color: "from-amber-500 to-orange-500",
                  },
                  {
                    label: "Bonding",
                    content: profile.strategy.bonding,
                    example: profile.strategy.bondingExample,
                    scenario: profile.strategy.bondingScenario,
                    color: "from-purple-500 to-pink-500",
                  },
                ].map((s, i) => (
                  <div key={i} className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "px-3 py-1 rounded-lg text-white text-xs font-bold uppercase tracking-widest bg-gradient-to-r",
                          s.color,
                        )}
                      >
                        {s.label}
                      </div>
                      <div className="h-px flex-1 bg-white/5" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <div className="text-lg text-slate-200 leading-relaxed font-medium">
                          <div className="markdown-body">
                            <ReactMarkdown>{s.content}</ReactMarkdown>
                          </div>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10 italic text-slate-400">
                          "{s.example}"
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h5 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                          Detailed Scenario
                        </h5>
                        <div className="text-sm text-slate-400 leading-relaxed">
                          <div className="markdown-body">
                            <ReactMarkdown>{s.scenario}</ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "physicality" && (
              <div className="space-y-12">
                {[
                  {
                    label: "Body Language",
                    content: profile.physicality.bodyLanguage,
                    example: profile.physicality.bodyLanguageExample,
                    scenario: profile.physicality.bodyLanguageScenario,
                    icon: User,
                  },
                  {
                    label: "Touch",
                    content: profile.physicality.touch,
                    example: profile.physicality.touchExample,
                    scenario: profile.physicality.touchScenario,
                    icon: Zap,
                  },
                  {
                    label: "Sexual Dynamics",
                    content: profile.physicality.sex,
                    example: profile.physicality.sexExample,
                    scenario: profile.physicality.sexScenario,
                    icon: Flame,
                  },
                ].map((p, i) => (
                  <div key={i} className="space-y-6">
                    <h4 className="font-bold text-2xl flex items-center gap-3">
                      <p.icon className="w-6 h-6 text-accent-primary" />
                      {p.label}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <div className="text-lg text-slate-200 leading-relaxed">
                          <div className="markdown-body">
                            <ReactMarkdown>{p.content}</ReactMarkdown>
                          </div>
                        </div>
                        <div className="p-4 rounded-xl bg-accent-primary/5 border border-accent-primary/10 italic text-slate-300">
                          "{p.example}"
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h5 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                          Practical Application
                        </h5>
                        <div className="text-sm text-slate-400 leading-relaxed">
                          <div className="markdown-body">
                            <ReactMarkdown>{p.scenario}</ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "triggers" && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 space-y-4">
                    <h4 className="font-bold text-lg flex items-center gap-2 text-emerald-400">
                      <Trophy className="w-5 h-5" />
                      Quick Wins
                    </h4>
                    <ul className="space-y-2">
                      {profile.quickWins.map((win, i) => (
                        <li
                          key={i}
                          className="flex gap-2 items-start text-slate-400 text-sm"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                          {win}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-6 rounded-2xl bg-accent-primary/5 border border-accent-primary/10 space-y-4">
                    <h4 className="font-bold text-lg flex items-center gap-2 text-accent-primary">
                      <Zap className="w-5 h-5" />
                      Devotion Triggers
                    </h4>
                    <ul className="space-y-2">
                      {profile.devotionTriggers.map((trigger, i) => (
                        <li
                          key={i}
                          className="flex gap-2 items-start text-slate-400 text-sm"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-accent-primary mt-1.5 shrink-0" />
                          {trigger}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/10 space-y-4">
                    <h4 className="font-bold text-lg flex items-center gap-2 text-red-400">
                      <Flag className="w-5 h-5" />
                      Red Flags
                    </h4>
                    <ul className="space-y-2">
                      {profile.redFlags.map((flag, i) => (
                        <li
                          key={i}
                          className="flex gap-2 items-start text-slate-400 text-sm"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                          {flag}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="glass-card p-8 space-y-6">
                  <h3 className="text-2xl font-bold flex items-center gap-3">
                    <MessageSquare className="w-6 h-6 text-teal-400" />
                    Advanced Cold Reads
                  </h3>
                  <div className="space-y-4">
                    {profile.coldReads.map((read, i) => (
                      <div
                        key={i}
                        className="p-6 rounded-2xl bg-white/5 border border-white/10 relative group overflow-hidden"
                      >
                        <div className="absolute top-0 left-0 w-1 h-full bg-teal-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <Quote className="absolute -top-2 -left-2 w-8 h-8 text-teal-500/20" />
                        <p className="text-lg text-slate-300 leading-relaxed italic">
                          "{read}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "dating" && (
              <div className="space-y-8">
                <section className="p-8 rounded-2xl bg-white/5 border border-white/10 space-y-6">
                  <h3 className="text-2xl font-bold flex items-center gap-3">
                    <Compass className="w-6 h-6 text-teal-400" />
                    Dating Strategy
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                        Ideal Venues
                      </h4>
                      <p className="text-slate-300 leading-relaxed">
                        {profile.dating.venues}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                        Key Activities
                      </h4>
                      <p className="text-slate-300 leading-relaxed">
                        {profile.dating.activities}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                        Golden Rules
                      </h4>
                      <p className="text-slate-300 leading-relaxed">
                        {profile.dating.rules}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="p-8 rounded-2xl bg-teal-500/5 border border-teal-500/10 space-y-6">
                  <h3 className="text-2xl font-bold flex items-center gap-3">
                    <Calendar className="w-6 h-6 text-teal-400" />
                    Specific Date Ideas
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {profile.dating.ideas.map((idea, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 text-slate-300"
                      >
                        <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-400 font-bold shrink-0">
                          {i + 1}
                        </div>
                        {idea}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {activeTab === "relationship" && (
              <div className="space-y-8">
                <section className="p-8 rounded-2xl bg-white/5 border border-white/10 space-y-8">
                  <h3 className="text-2xl font-bold flex items-center gap-3 text-teal-400">
                    <Shield className="w-6 h-6" />
                    Relationship Strategy: Total Devotion
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-emerald-400">
                        <Brain className="w-5 h-5" />
                        <h4 className="font-bold uppercase tracking-widest text-xs">
                          The Vision
                        </h4>
                      </div>
                      <p className="text-slate-300 leading-relaxed text-sm">
                        {profile.relationshipAdvice.vision}
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-teal-400">
                        <Zap className="w-5 h-5" />
                        <h4 className="font-bold uppercase tracking-widest text-xs">
                          Investment
                        </h4>
                      </div>
                      <p className="text-slate-300 leading-relaxed text-sm">
                        {profile.relationshipAdvice.investment}
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-orange-400">
                        <Trophy className="w-5 h-5" />
                        <h4 className="font-bold uppercase tracking-widest text-xs">
                          Potential
                        </h4>
                      </div>
                      <p className="text-slate-300 leading-relaxed text-sm">
                        {profile.relationshipAdvice.potential}
                      </p>
                    </div>
                  </div>
                </section>

                <div className="p-6 rounded-2xl bg-teal-500/5 border border-teal-500/10">
                  <p className="text-slate-400 text-sm italic text-center">
                    "Total Devotion is not about control, but about becoming the
                    most important person in her world through understanding and
                    vision."
                  </p>
                </div>
              </div>
            )}

            {activeTab === "freak" && (
              <div className="space-y-8">
                <section className="p-8 rounded-2xl bg-white/5 border border-white/10 space-y-8">
                  <h3 className="text-2xl font-bold flex items-center gap-3 text-purple-400">
                    <HandMetal className="w-6 h-6" />
                    Freak Dynamics: Bring Out the Freak
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-pink-400">
                        <Flame className="w-5 h-5" />
                        <h4 className="font-bold uppercase tracking-widest text-xs">
                          Kink & Novelty
                        </h4>
                      </div>
                      <p className="text-slate-300 leading-relaxed text-sm">
                        {profile.freakDynamics.kink}
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-purple-400">
                        <User className="w-5 h-5" />
                        <h4 className="font-bold uppercase tracking-widest text-xs">
                          Threesomes
                        </h4>
                      </div>
                      <p className="text-slate-300 leading-relaxed text-sm">
                        {profile.freakDynamics.threesomes}
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-indigo-400">
                        <Heart className="w-5 h-5" />
                        <h4 className="font-bold uppercase tracking-widest text-xs">
                          Worship
                        </h4>
                      </div>
                      <p className="text-slate-300 leading-relaxed text-sm">
                        {profile.freakDynamics.worship}
                      </p>
                    </div>
                  </div>
                </section>

                <div className="p-6 rounded-2xl bg-purple-500/5 border border-purple-500/10">
                  <p className="text-slate-400 text-sm italic text-center">
                    "Every woman has a 'freak' side. Your job is to create a
                    space safe enough for her to express it without judgment."
                  </p>
                </div>
              </div>
            )}

            {activeTab === "darkmind" && (
              <div className="space-y-8">
                <section className="p-8 rounded-2xl bg-white/5 border border-white/10 space-y-8">
                  <h3 className="text-2xl font-bold flex items-center gap-3 text-red-400">
                    <Brain className="w-6 h-6" />
                    Dark Mind Breakdown
                  </h3>
                  <div className="text-lg text-slate-300 leading-relaxed">
                    <div className="markdown-body">
                      <ReactMarkdown>{profile.darkMindBreakdown}</ReactMarkdown>
                    </div>
                  </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <section className="p-8 rounded-2xl bg-white/5 border border-white/10 space-y-8">
                    <h3 className="text-2xl font-bold flex items-center gap-3 text-accent-primary">
                      <Target className="w-6 h-6" />
                      Behavioral Blueprint
                    </h3>
                    <div className="text-lg text-slate-300 leading-relaxed">
                      <div className="markdown-body">
                        <ReactMarkdown>
                          {profile.behavioralBlueprint}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </section>

                  {profile.influenceStrategy && (
                    <section className="p-8 rounded-2xl bg-accent-secondary/5 border border-accent-secondary/20 space-y-6">
                      <h3 className="text-2xl font-bold flex items-center gap-3 text-accent-secondary">
                        <Zap className="w-6 h-6" />
                        Influence Strategy
                      </h3>
                      <div className="text-lg text-slate-300 leading-relaxed">
                        <div className="markdown-body">
                          <ReactMarkdown>{profile.influenceStrategy}</ReactMarkdown>
                        </div>
                      </div>
                    </section>
                  )}
                </div>

                {profile.behavioralMarkers && (
                  <section className="p-8 rounded-2xl bg-white/5 border border-white/10 space-y-6">
                    <h3 className="text-2xl font-bold flex items-center gap-3 text-teal-400">
                      <Compass className="w-6 h-6" />
                      Behavioral Markers
                    </h3>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {profile.behavioralMarkers.map((marker, i) => (
                        <li key={i} className="flex gap-3 items-start text-slate-300 text-sm bg-white/5 p-4 rounded-xl border border-white/5">
                          <div className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 shrink-0" />
                          {marker}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {profile.selfSabotagePattern && (
                    <section className="p-8 rounded-2xl bg-red-500/5 border border-red-500/20 space-y-4">
                      <h3 className="text-xl font-bold flex items-center gap-3 text-red-400">
                        <AlertCircle className="w-6 h-6" />
                        Self-Sabotage Pattern
                      </h3>
                      <p className="text-slate-300 leading-relaxed text-sm">
                        {profile.selfSabotagePattern}
                      </p>
                    </section>
                  )}

                  {profile.mistypeRedFlag && (
                    <section className="p-8 rounded-2xl bg-orange-500/5 border border-orange-500/20 space-y-4">
                      <h3 className="text-xl font-bold flex items-center gap-3 text-orange-400">
                        <Flag className="w-6 h-6" />
                        Mistype Red Flag
                      </h3>
                      <p className="text-slate-300 leading-relaxed text-sm">
                        {profile.mistypeRedFlag}
                      </p>
                    </section>
                  )}
                </div>

                {profile.conversationExamples && profile.conversationExamples.length > 0 && (
                  <section className="p-8 rounded-2xl bg-white/5 border border-white/10 space-y-6">
                    <h3 className="text-2xl font-bold flex items-center gap-3 text-blue-400">
                      <MessageSquare className="w-6 h-6" />
                      Conversation Examples
                    </h3>
                    <div className="space-y-4">
                      {profile.conversationExamples.map((ex, i) => (
                        <div key={i} className="p-6 rounded-xl bg-mystic-900 border border-white/5 space-y-4">
                          <div className="text-sm text-slate-400 italic border-b border-white/5 pb-2">
                            Scenario: {ex.scenario}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-accent-primary uppercase tracking-widest">Her Response</span>
                              <p className="text-sm text-slate-200">{ex.herResponse}</p>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Other Type Response</span>
                              <p className="text-sm text-slate-400">{ex.otherTypeResponse}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
            {activeTab === "psychology" && (
              <div className="space-y-8">
                <div className="p-8 rounded-2xl bg-white/5 border border-white/10 space-y-8">
                  <h3 className="text-2xl font-bold flex items-center gap-3 text-accent-primary">
                    <Activity className="w-6 h-6" />
                    Psychological Profile
                  </h3>
                  <div className="w-full max-w-3xl mx-auto">
                    <ProfileRadarChart profile={profile} />
                  </div>
                </div>

                {profile.psychologicalPortrait && (
                  <section className="p-8 rounded-2xl bg-mystic-900/50 border border-purple-500/20 space-y-6">
                    <h3 className="text-2xl font-bold flex items-center gap-3 text-purple-400">
                      <User className="w-6 h-6" />
                      Psychological Portrait
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Core Motivations</h4>
                        <p className="text-sm text-slate-300 leading-relaxed">{profile.psychologicalPortrait.motivations}</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Deep Fears</h4>
                        <p className="text-sm text-slate-300 leading-relaxed">{profile.psychologicalPortrait.fears}</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Childhood Influences</h4>
                        <p className="text-sm text-slate-300 leading-relaxed">{profile.psychologicalPortrait.childhoodInfluences}</p>
                      </div>
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
