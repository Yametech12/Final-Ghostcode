/**
 * Calibration feature — shared types and static data.
 * Extracted verbatim from src/pages/CalibrationPage.tsx (mechanical refactor).
 */

export interface Task {
  id: string;
  // Server-side sanitizer (api/lib/handlers.ts:sanitizeTask) writes `title`
  // + `description`. Older locally-stored entries used a single `text` field.
  // Both shapes are accepted; the renderer/filter falls back gracefully.
  title?: string;
  description?: string;
  text?: string;
  priority: 'low' | 'medium' | 'high';
  dueDate: string;
  completed: boolean;
  category: 'communication' | 'physical' | 'logistics' | 'psychology';
}

// Helper for code that needs the user-visible label of a task in either shape.
export const taskLabel = (t: Task): string => t.title || t.text || '';
export const taskBody = (t: Task): string => t.description || t.text || '';

export interface AnalysisResult {
  primaryType: string;
  confidence: number;
  secondaryType: string | null;
  analysis: string;
  indicators: string[];
  tasks: Task[];
  coldReader: string;
  howSheGetsWhatSheWants: string;
  whatToAvoid: string[];
  relationshipAdvice: {
    vision: string;
    investment: string;
    potential: string;
  };
  freakDynamics: {
    kink: string;
    threesomes: string;
    worship: string;
  };
  darkMindBreakdown: string;
  behavioralBlueprint: string;
  interactionStrategy: string;
}

export interface AnalysisHistory extends AnalysisResult {
  id: string;
  date: string;
  scenarioSummary: string;
}

export interface StructuredInput {
  eyeContact: string;
  conversationTopic: string;
  bodyLanguage: string;
  clothingStyle: string;
  datingVenue: string;
  additionalNotes: string;
}

export type CalibrationMode = 'ai' | 'manual' | 'history' | 'practice';

export type TaskFilter = 'all' | 'completed' | 'pending';
export type TaskSort = 'priority' | 'dueDate' | 'category';
export type TaskCategoryFilter = 'all' | 'communication' | 'physical' | 'logistics' | 'psychology';

export interface DynamicScenario {
  text: string;
  correctType: string;
  explanation: string;
}

export const EMPTY_STRUCTURED_INPUT: StructuredInput = {
  eyeContact: '',
  conversationTopic: '',
  bodyLanguage: '',
  clothingStyle: '',
  datingVenue: '',
  additionalNotes: ''
};

export const practiceScenarios = [
  {
    id: 1,
    text: "She's wearing a modest but elegant dress. When you talk to her, she's polite but keeps her answers short and looks around the room a lot. She doesn't seem impressed when you compliment her outfit.",
    correctType: "TDI",
    explanation: "Modest dress and looking around (Observer) points to Denier. Unaffected by compliments and short attention span points to Tester. The elegant/modest combo often aligns with Idealist."
  },
  {
    id: 2,
    text: "She's the life of the party, talking to everyone. She has a visible tattoo and playfully punches your arm when you tease her. She gets bored quickly if the conversation gets too deep.",
    correctType: "TJI",
    explanation: "High energy, short attention span (Tester). Tattoos and aggressive touch (Justifier). Focus on fun over deep connection (Idealist)."
  },
  {
    id: 3,
    text: "She asks you a lot of questions about your career and goals. She's dressed very practically and insists on splitting the bill. She seems a bit guarded when you try to flirt.",
    correctType: "NDR",
    explanation: "Focus on goals/career and splitting bill (Realist). Guarded about flirting (Denier). Asking deep questions and focusing on you (Investor)."
  },
  {
    id: 4,
    text: "She's wearing a very expensive designer outfit and constantly checks her phone. She mentions her 'ex' who was a famous athlete and expects you to open every door for her.",
    correctType: "NJI",
    explanation: "High maintenance/spoiled (Idealist). Focus on status/ex (Justifier). Expects investment/pampering (Investor)."
  },
  {
    id: 5,
    text: "She's quiet and observant at the bar. She's wearing a simple black dress. When you approach, she listens intently but doesn't reveal much about herself. She seems to be analyzing your every move.",
    correctType: "TDR",
    explanation: "Quiet/Observant (Denier). Analyzing/Logical (Realist). Testing your approach by staying cold (Tester)."
  },
  {
    id: 6,
    text: "She's wearing a leather jacket and has several piercings. She's drinking whiskey neat and challenges your opinions on everything. She seems to enjoy the friction.",
    correctType: "TJR",
    explanation: "Rebellious/Edgy (Justifier). Challenging/Testing (Tester). Practical/Direct (Realist)."
  }
];

export const manualClues = [
  {
    axis: 'Time Line',
    options: [
      { label: 'Tester (T)', clues: ['Shorter attention span', 'Multitasking/Texting', 'Unaffected by compliments', 'Surrounded by male friends', 'Changes topics rapidly'] },
      { label: 'Investor (N)', clues: ['Takes compliments seriously', 'Needs focused attention', 'Responds with deep eye contact', 'Asks about your future/goals'] }
    ]
  },
  {
    axis: 'Sex Line',
    options: [
      { label: 'Denier (D)', clues: ['Careful with health/safety', 'Religious/Conservative background', 'Shy about sex talk', 'Consistent with upbringing', 'Avoids aggressive touch'] },
      { label: 'Justifier (J)', clues: ['Has tattoos', 'Takes risks with safety', 'Talks about sex openly', 'Comfortable with aggressive touch', 'Rebels against upbringing'] }
    ]
  },
  {
    axis: 'Relationship Line',
    options: [
      { label: 'Realist (R)', clues: ['Career/Studies priority', 'Believes women are equals', 'Takes care of others', 'Flakes because of work', 'Had weaker male figures'] },
      { label: 'Idealist (I)', clues: ['Affluent/Spoiled upbringing', 'Plans wedding early', 'Expects to be pampered', 'Flakes to hang out with guys', 'Vivid imagination'] }
    ]
  }
];
