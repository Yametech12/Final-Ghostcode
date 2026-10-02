import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

// The app is English-only for its international audience. There is a single
// locale ('en'); the translation dictionary is kept so `t()` call sites keep
// working unchanged. There is intentionally no language toggle.
export type Language = 'en';

interface LanguageContextType {
  language: Language;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Translation dictionary (English only)
const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation
    'nav.home': 'Home',
    'nav.profile': 'Profile',
    'nav.assessment': 'Assessment',
    'nav.calibration': 'Calibration',
    'nav.advisor': 'AI Advisor',
    'nav.encyclopedia': 'Encyclopedia',
    'nav.guide': 'Guide',
    'nav.fieldGuide': 'Field Guide',
    'nav.glossary': 'Glossary',
    'nav.favorites': 'Favorites',
    'nav.dossiers': 'Dossiers',
    'nav.insights': 'Insights',
    'nav.compare': 'Compare',
    'nav.quiz': 'Quiz',
    'nav.profiler': 'Profiler',
    'nav.decryptor': 'Decryptor',
    'nav.simulation': 'Simulation',
    'nav.admin': 'Admin',
    'nav.logout': 'Sign Out',
    'nav.login': 'Sign In',

    // Home page
    'home.title': 'EPIMETHEUS',
    'home.subtitle': '"Open the box. Find the hope."',
    'home.hopeTitle': 'Hope in the Chaos',
    'home.startAssessment': 'Start Target Assessment',
    'home.exploreProfiles': 'Explore Profiles',
    'home.archetypesTitle': 'The 8 Personality Archetypes',
    'home.archetypesDesc': 'Every woman fits into one of eight core profiles based on her approach to time, sex, and relationships.',
    'home.viewDirectory': 'View detailed profile directory',

    // Assessment
    'assessment.title': 'Target Assessment',
    'assessment.subtitle': 'Answer the following questions based on her behavior to determine her core archetype.',
    'assessment.analyzing': 'Analyzing Profile...',
    'assessment.crossRef': 'Cross-referencing behavioral markers with the 8 archetypes.',
    'assessment.previous': 'Previous',
    'assessment.restart': 'Restart',
    'assessment.recentTitle': 'Recent Assessments (Offline Cache)',
    'assessment.timeLine': 'Time Line',
    'assessment.sexLine': 'Sex Line',
    'assessment.relationshipLine': 'Relationship Line',

    // Calibration
    'calibration.title': 'The Oracle',
    'calibration.subtitle': 'Advanced personality analysis and type calibration. Use the AI Oracle, practice your skills, or review past analyses.',
    'calibration.aiOracle': 'AI Oracle',
    'calibration.manual': 'Manual',
    'calibration.practice': 'Practice',
    'calibration.history': 'History',
    'calibration.scenarioParams': 'Scenario Parameters',
    'calibration.clearForm': 'Clear Form',
    'calibration.extractProfile': 'Extract Profile',
    'calibration.extracting': 'Extracting Behavioral Matrix...',
    'calibration.newAnalysis': 'New Analysis',
    'calibration.saveImage': 'Save Analysis as Image',

    // Advisor
    'advisor.title': 'AI Advisor',
    'advisor.placeholder': 'Ask the advisor anything...',
    'advisor.send': 'Send',
    'advisor.clearChat': 'Clear Chat',
    'advisor.loading': 'Initializing session...',

    // Common
    'common.loading': 'Loading...',
    'common.error': 'Something went wrong',
    'common.retry': 'Retry',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.confirm': 'Confirm',
    'common.search': 'Search...',
    'common.noResults': 'No results found',
    'common.language': 'Language',

    // Features
    'feature.aiAdvisor': 'AI Advisor',
    'feature.aiAdvisorDesc': 'Consult the Oracle for real-time strategic intelligence.',
    'feature.signalDecryptor': 'Signal Decryptor',
    'feature.signalDecryptorDesc': 'Analyze text messages to decode subtext and emotional state.',
    'feature.simulation': 'Simulation Matrix',
    'feature.simulationDesc': 'Interactive roleplay trainer to practice conversation skills.',
    'feature.dossiers': 'Subject Dossiers',
    'feature.dossiersDesc': 'Track individuals, log interactions, and store profiles.',
    'feature.fieldGuide': 'Field Guide',
    'feature.fieldGuideDesc': 'Quick-reference scenarios and tactical lines for any situation.',
    'feature.calibration': 'Calibration',
    'feature.calibrationDesc': 'Master the art of reading her type in 30 seconds or less.',
    'feature.quiz': 'Knowledge Check',
    'feature.quizDesc': 'Test your mastery of the system with randomized quizzes.',

    // Auth
    'auth.signIn': 'Sign In',
    'auth.signUp': 'Create Account',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.forgotPassword': 'Forgot password?',
    'auth.noAccount': "Don't have an account?",
    'auth.hasAccount': 'Already have an account?',
    'auth.googleSignIn': 'Continue with Google',
  },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Fixed to English. Clear any locale a previous version may have stored.
  const [language] = useState<Language>('en');

  useEffect(() => {
    localStorage.removeItem('app-language');
    document.documentElement.lang = 'en';
  }, []);

  const t = useCallback((key: string): string => {
    return translations[language][key] || key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
