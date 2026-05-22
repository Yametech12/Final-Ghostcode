import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

export type Language = 'en' | 'tl';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Translation dictionary
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
    'common.english': 'English',
    'common.tagalog': 'Tagalog',

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
  tl: {
    // Navigation
    'nav.home': 'Home',
    'nav.profile': 'Profile',
    'nav.assessment': 'Assessment',
    'nav.calibration': 'Calibration',
    'nav.advisor': 'AI Advisor',
    'nav.encyclopedia': 'Encyclopedia',
    'nav.guide': 'Gabay',
    'nav.fieldGuide': 'Field Guide',
    'nav.glossary': 'Glossary',
    'nav.favorites': 'Mga Paborito',
    'nav.dossiers': 'Mga Dossier',
    'nav.insights': 'Mga Insight',
    'nav.compare': 'Ihambing',
    'nav.quiz': 'Quiz',
    'nav.profiler': 'Profiler',
    'nav.decryptor': 'Decryptor',
    'nav.simulation': 'Simulation',
    'nav.admin': 'Admin',
    'nav.logout': 'Mag-sign Out',
    'nav.login': 'Mag-sign In',

    // Home page
    'home.title': 'EPIMETHEUS',
    'home.subtitle': '"Buksan ang kahon. Hanapin ang pag-asa."',
    'home.hopeTitle': 'Pag-asa sa Kaguluhan',
    'home.startAssessment': 'Simulan ang Target Assessment',
    'home.exploreProfiles': 'Tingnan ang mga Profile',
    'home.archetypesTitle': 'Ang 8 Personality Archetypes',
    'home.archetypesDesc': 'Bawat babae ay nasa isa sa walong core profiles batay sa kanyang approach sa oras, sex, at relasyon.',
    'home.viewDirectory': 'Tingnan ang detalyadong profile directory',

    // Assessment
    'assessment.title': 'Target Assessment',
    'assessment.subtitle': 'Sagutin ang mga sumusunod na tanong batay sa kanyang behavior para malaman ang kanyang core archetype.',
    'assessment.analyzing': 'Sinusuri ang Profile...',
    'assessment.crossRef': 'Kino-cross-reference ang behavioral markers sa 8 archetypes.',
    'assessment.previous': 'Nakaraan',
    'assessment.restart': 'Ulitin',
    'assessment.recentTitle': 'Mga Kamakailang Assessment (Offline Cache)',
    'assessment.timeLine': 'Time Line',
    'assessment.sexLine': 'Sex Line',
    'assessment.relationshipLine': 'Relationship Line',

    // Calibration
    'calibration.title': 'Ang Oracle',
    'calibration.subtitle': 'Advanced personality analysis at type calibration. Gamitin ang AI Oracle, mag-practice, o tingnan ang mga nakaraang analysis.',
    'calibration.aiOracle': 'AI Oracle',
    'calibration.manual': 'Manual',
    'calibration.practice': 'Practice',
    'calibration.history': 'Kasaysayan',
    'calibration.scenarioParams': 'Mga Parameter ng Scenario',
    'calibration.clearForm': 'I-clear ang Form',
    'calibration.extractProfile': 'I-extract ang Profile',
    'calibration.extracting': 'Kine-extract ang Behavioral Matrix...',
    'calibration.newAnalysis': 'Bagong Analysis',
    'calibration.saveImage': 'I-save ang Analysis bilang Larawan',

    // Advisor
    'advisor.title': 'AI Advisor',
    'advisor.placeholder': 'Magtanong sa advisor...',
    'advisor.send': 'Ipadala',
    'advisor.clearChat': 'I-clear ang Chat',
    'advisor.loading': 'Ini-initialize ang session...',

    // Common
    'common.loading': 'Naglo-load...',
    'common.error': 'May nangyaring mali',
    'common.retry': 'Subukan Muli',
    'common.save': 'I-save',
    'common.cancel': 'Kanselahin',
    'common.delete': 'Tanggalin',
    'common.confirm': 'Kumpirmahin',
    'common.search': 'Maghanap...',
    'common.noResults': 'Walang resulta',
    'common.language': 'Wika',
    'common.english': 'English',
    'common.tagalog': 'Tagalog',

    // Features
    'feature.aiAdvisor': 'AI Advisor',
    'feature.aiAdvisorDesc': 'Kumonsulta sa Oracle para sa real-time strategic intelligence.',
    'feature.signalDecryptor': 'Signal Decryptor',
    'feature.signalDecryptorDesc': 'Suriin ang mga text message para ma-decode ang subtext at emotional state.',
    'feature.simulation': 'Simulation Matrix',
    'feature.simulationDesc': 'Interactive roleplay trainer para mag-practice ng conversation skills.',
    'feature.dossiers': 'Mga Subject Dossier',
    'feature.dossiersDesc': 'I-track ang mga indibidwal, i-log ang interactions, at i-store ang profiles.',
    'feature.fieldGuide': 'Field Guide',
    'feature.fieldGuideDesc': 'Quick-reference scenarios at tactical lines para sa kahit anong sitwasyon.',
    'feature.calibration': 'Calibration',
    'feature.calibrationDesc': 'Master ang art ng pagbasa ng kanyang type sa loob ng 30 segundo.',
    'feature.quiz': 'Knowledge Check',
    'feature.quizDesc': 'Subukan ang iyong mastery ng system gamit ang randomized quizzes.',

    // Auth
    'auth.signIn': 'Mag-sign In',
    'auth.signUp': 'Gumawa ng Account',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.forgotPassword': 'Nakalimutan ang password?',
    'auth.noAccount': 'Wala pang account?',
    'auth.hasAccount': 'May account na?',
    'auth.googleSignIn': 'Magpatuloy gamit ang Google',
  }
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'en';
    return (localStorage.getItem('app-language') as Language) || 'en';
  });

  useEffect(() => {
    localStorage.setItem('app-language', language);
    document.documentElement.lang = language === 'tl' ? 'fil' : 'en';
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState(prev => prev === 'en' ? 'tl' : 'en');
  }, []);

  const t = useCallback((key: string): string => {
    return translations[language][key] || translations['en'][key] || key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
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
