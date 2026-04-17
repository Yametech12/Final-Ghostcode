export type PersonalityType =
  | "TDI"
  | "TJI"
  | "NDI"
  | "NJI"
  | "TDR"
  | "TJR"
  | "NDR"
  | "NJR"
  | "REB"
  | "MUS"
  | "ARC"
  | "ENC"
  | "STR";

export interface PersonalityProfile {
  id: PersonalityType;
  name: string;
  tagline: string;
  combination: string;
  overview: string;
  desires: string;
  whatSheWants: string;
  whatToAvoid: string[];
  howSheGetsWhatSheWants: string;
  keyTraits: string[];
  whereToFindHer: string[];
  textingStyle: string;
  styleAndAppearance: string;
  ets: string[]; // Emotional Trigger Sequence
  strategy: {
    ignition: string;
    ignitionExample: string;
    ignitionScenario: string;
    momentum: string;
    momentumExample: string;
    momentumScenario: string;
    connection: string;
    connectionExample: string;
    connectionScenario: string;
    bonding: string;
    bondingExample: string;
    bondingScenario: string;
  };
  physicality: {
    bodyLanguage: string;
    bodyLanguageExample: string;
    bodyLanguageScenario: string;
    touch: string;
    touchExample: string;
    touchScenario: string;
    sex: string;
    sexExample: string;
    sexScenario: string;
  };
  dating: {
    venues: string;
    activities: string;
    rules: string;
    ideas: string[];
  };
  quickWins: string[];
  devotionTriggers: string[];
  redFlags: string[];
  compatibility: string;
  coldReads: string[];
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
  psychologicalPortrait?: {
    motivations: string;
    fears: string;
    childhoodInfluences: string;
  };
  behavioralMarkers?: string[];
  selfSabotagePattern?: string;
  influenceStrategy?: string;
  conversationExamples?: {
    scenario: string;
    herResponse: string;
    otherTypeResponse: string;
  }[];
  mistypeRedFlag?: string;
}

export interface GuideSection {
  id: string;
  title: string;
  content: string;
}

export interface Favorite {
  id?: string;
  userId: string;
  contentId: string;
  contentType: "type" | "guide" | "calibration";
  category: "Personality" | "Content" | "Assessment";
  title: string;
  timestamp: any;
}

export interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  bio?: string;
  contactInfo?: {
    phone?: string;
    instagram?: string;
    twitter?: string;
  };
  role: 'user' | 'admin';
  createdAt: any;
  lastLoginAt?: any;
}
