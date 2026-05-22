import { useLanguage } from '../contexts/LanguageContext';
import { Globe } from 'lucide-react';

export default function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();

  return (
    <button
      onClick={toggleLanguage}
      aria-label={`Switch to ${language === 'en' ? 'Tagalog' : 'English'}`}
      title={language === 'en' ? 'Switch to Tagalog' : 'Switch to English'}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-accent-primary/30 transition-all text-sm font-bold text-slate-400 hover:text-accent-primary"
    >
      <Globe className="w-4 h-4" />
      <span className="uppercase tracking-wider text-[10px]">
        {language === 'en' ? 'EN' : 'TL'}
      </span>
    </button>
  );
}
