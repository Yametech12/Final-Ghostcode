import { ChevronRight, Target, Brain, Map, Heart, MessageSquare, User, Activity } from 'lucide-react';
import { personalityTypes } from '../data/personalityTypes';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import PrefetchLink from '../components/PrefetchLink';
import { motion } from 'motion/react';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 240, damping: 28 } }
};

export default function HomePage() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-12"
    >
      <div className="text-center space-y-12 py-12">
        <motion.div variants={itemVariants} className="space-y-6">
          <Logo size="xl" className="mx-auto mb-4 glow-accent" />
          {/* Hero serif — Q3 decision: Cormorant on Home/Login hero only */}
          <h1 className="hero-headline text-6xl md:text-8xl text-slate-50">
            EPIMETHEUS
          </h1>
          <p className="hero-headline-italic text-slate-400 text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed opacity-80">
            "Open the box. Find the hope."
          </p>
        </motion.div>

        <motion.div variants={itemVariants} className="max-w-3xl mx-auto">
          <div className="text-left space-y-6 glass-card p-8 md:p-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10" aria-hidden="true">
              <Heart className="w-32 h-32 text-accent-primary" />
            </div>
            <div className="space-y-4 relative z-10">
              <h2 className="hero-headline text-3xl md:text-4xl text-accent-primary text-center">
                Hope in the Chaos
              </h2>
              <p className="text-slate-300 leading-relaxed text-lg">
                Epimetheus opened Pandora's box. Chaos fled, but Hope remained.
              </p>
              <p className="text-slate-300 leading-relaxed text-lg">
                Modern dating is no different. Complex, guarded women (the Testers) test your resolve. They watch how you handle rejection, how you pursue without desperation, how you walk the line between confidence and arrogance. Pass their tests with behavioral precision. Attract the Investor within. Find real connection.
              </p>
              <p className="text-slate-400 leading-relaxed text-base">
                Open the box. Find the hope. Our system decodes female behavior through the EPIMETHEUS framework. Profiles reveal her type upfront. Learn her emotional triggers. Understand what she wants versus what she says she wants. Mutual effort deepens the match. This is for those who stay.
              </p>
              <p className="hero-headline-italic text-accent-primary text-xl pt-4 border-t border-slate-700/30 text-center">
                Navigate. Persist. Connect.
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
          <PrefetchLink
            to="/assessment"
            data-tour="assessment"
            className="w-full sm:w-auto px-8 py-4 rounded-xl accent-gradient text-mystic-950 font-semibold tracking-wide shadow-xl shadow-accent-primary/15 transition-transform flex items-center justify-center gap-2 group hover:scale-[1.02] active:scale-[0.98]"
          >
            Start Target Assessment
            <ChevronRight aria-hidden="true" className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
          </PrefetchLink>
          <PrefetchLink
            to="/profile"
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/5 border border-slate-700/30 text-slate-100 font-semibold tracking-wide hover:bg-white/8 hover:border-accent-primary/20 transition-all text-center"
          >
            Explore Profiles
          </PrefetchLink>
        </motion.div>

        {/* Personality Profiles Section */}
        <motion.div variants={itemVariants} className="pt-24 space-y-12">
          <div className="text-center space-y-4">
            <span className="eyebrow">The 8 Archetypes</span>
            <h2 className="hero-headline text-4xl md:text-5xl text-slate-50">The 8 Personality Archetypes</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Every woman fits into one of eight core profiles based on her approach to time, sex, and relationships.
            </p>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-100px' }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {personalityTypes.map((profile) => (
              <motion.div key={profile.id} variants={itemVariants}>
                <Link
                  to={`/encyclopedia?type=${profile.id}`}
                  className="glass-card p-6 text-left hover:border-accent-primary/25 transition-colors duration-200 group h-full block"
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-xs font-mono font-semibold text-accent-primary tracking-widest">{profile.id}</span>
                    <ChevronRight aria-hidden="true" className="w-4 h-4 text-slate-600 group-hover:text-accent-primary transition-colors" />
                  </div>
                  <h3 className="font-semibold text-lg mb-1 text-slate-100 group-hover:text-accent-primary transition-colors">{profile.name}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2">{profile.tagline}</p>
                </Link>
              </motion.div>
            ))}
          </motion.div>

          <div className="text-center">
            <Link to="/profile" className="text-accent-primary font-semibold hover:underline inline-flex items-center gap-2 tracking-wide">
              View detailed profile directory <ChevronRight aria-hidden="true" className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-24 text-left"
        >
          {[
            { title: 'AI Advisor', desc: 'Consult the Oracle for real-time strategic intelligence.', icon: Brain, link: '/advisor', tour: 'advisor' },
            { title: 'Signal Decryptor', desc: 'Analyze text messages to decode subtext and emotional state.', icon: MessageSquare, link: '/decryptor' },
            { title: 'Simulation Matrix', desc: 'Interactive roleplay trainer to practice conversation skills.', icon: Activity, link: '/simulation' },
            { title: 'Subject Dossiers', desc: 'Track individuals, log interactions, and store profiles.', icon: User, link: '/dossiers' },
            { title: 'Field Guide', desc: 'Quick-reference scenarios and tactical lines for any situation.', icon: Map, link: '/field-guide', tour: 'field-guide' },
            { title: 'Calibration', desc: 'Master the art of reading her type in 30 seconds or less.', icon: Target, link: '/calibration' },
            { title: 'Knowledge Check', desc: 'Test your mastery of the system with randomized quizzes.', icon: Brain, link: '/quiz' },
          ].map((feature, i) => (
            <motion.div key={i} variants={itemVariants}>
              <PrefetchLink
                to={feature.link}
                data-tour={feature.tour}
                className="glass-card p-6 space-y-4 mystic-border group h-full block overflow-hidden"
              >
                <div className="w-12 h-12 rounded-xl bg-accent-primary/10 border border-accent-primary/15 flex items-center justify-center text-accent-primary transition-colors group-hover:bg-accent-primary/15">
                  <feature.icon aria-hidden="true" className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-semibold tracking-tight text-slate-100 group-hover:text-accent-primary transition-colors">{feature.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
              </PrefetchLink>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
