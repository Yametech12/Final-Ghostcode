import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import {
  Brain,
  MessageSquare,
  Activity,
  User,
  Map,
  Target,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Lock,
  Eye,
  Zap,
  TrendingUp,
  Star,
  Menu,
  X,
} from 'lucide-react';
import Logo from '../components/Logo';
import { useEnhancedAuth } from '../contexts/EnhancedAuthContext';

/**
 * Public landing page — the marketing front door for Epimetheus.
 *
 * Mounted at /welcome. Not wrapped in PublicRoute so signed-in users can
 * still visit it from a footer or shared link without being bounced home.
 */

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 240, damping: 28 },
  },
};

/**
 * Reduced-motion variants. `motion`'s global respect for the OS preference
 * goes through CSS `prefers-reduced-motion` zeroing animation durations,
 * but the JS-driven y-offsets and opacity transitions still queue layout
 * thrash. We hard-flip those to no-ops when the user opts out.
 */
const noMotionContainer = { hidden: { opacity: 1 }, show: { opacity: 1 } };
const noMotionItem = { hidden: { opacity: 1, y: 0 }, show: { opacity: 1, y: 0 } };

const FEATURES = [
  {
    icon: Brain,
    title: 'AI Advisor',
    desc: 'A live oracle for the field. Ask, and get tactical guidance grounded in the framework.',
    locked: true,
  },
  {
    icon: MessageSquare,
    title: 'Signal Decryptor',
    desc: 'Paste a message. Read the subtext, the emotional state, and the move beneath the words.',
    locked: true,
  },
  {
    icon: Activity,
    title: 'Simulation Matrix',
    desc: 'Interactive roleplay. Rehearse the lines that fail elsewhere, here.',
    locked: true,
  },
  {
    icon: User,
    title: 'Subject Dossiers',
    desc: 'Profile the women in your orbit. Track interactions. Spot patterns.',
    locked: true,
  },
  {
    icon: Map,
    title: 'Field Guide',
    desc: 'A quick-reference for the moments that move too fast to think.',
    locked: true,
  },
  {
    icon: Target,
    title: 'Calibration',
    desc: 'Read her archetype in thirty seconds. Train the eye.',
    locked: true,
  },
  {
    icon: Eye,
    title: '8 Archetypes',
    desc: 'Two free, six unlocked with Strategist. Each profile maps her tells, triggers, and tests.',
    locked: false,
  },
  {
    icon: Zap,
    title: 'Personality Assessment',
    desc: 'Take the foundational test. Discover how you read women today, and where the gaps are.',
    locked: false,
  },
];

const ARCHETYPES = [
  { id: 'TDI', name: 'The Playette', tagline: 'Mysterious, sensitive beneath a cool exterior.', locked: false },
  { id: 'TJI', name: 'The Social Butterfly', tagline: 'Energetic, enticing, always center of attention.', locked: false },
  { id: 'NDI', name: 'The Hopeful Romantic', tagline: 'Old-fashioned, sentimental, looking for The One.', locked: true },
  { id: 'NJI', name: 'The Cinderella', tagline: 'Classy, refined, waiting to be swept away.', locked: true },
  { id: 'TDR', name: 'The Private Dancer', tagline: 'Mysterious shell, passionate giver inside.', locked: true },
  { id: 'TJR', name: 'The Seductress', tagline: 'Confident, sexual, intimidatingly strong.', locked: true },
  { id: 'NDR', name: 'The Connoisseur', tagline: 'Selective, practical, cautious giver.', locked: true },
  { id: 'NJR', name: 'The Modern Woman', tagline: 'Independent, level-headed, healthy in love.', locked: true },
];

export default function LandingPage() {
  const auth = useEnhancedAuth();
  const isSignedIn = !!auth?.user;
  const reduceMotion = useReducedMotion();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Pick variants once. Doing it inline at every motion.* site would bloat
  // the JSX without changing behavior.
  const cVar = reduceMotion ? noMotionContainer : containerVariants;
  const iVar = reduceMotion ? noMotionItem : itemVariants;

  return (
    <div className="min-h-screen bg-mystic-950 text-slate-200 overflow-x-hidden">
      {/* Skip-to-content link — first focusable element so keyboard users
          can jump past the long nav. Visually hidden until focused. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-accent-primary focus:text-mystic-950 focus:font-semibold focus:shadow-lg"
      >
        Skip to content
      </a>

      {/* Atmospheric background bloom — gold + copper, blurred */}
      <div className="atmosphere" aria-hidden="true" />

      {/* ───────────────────────── Top nav ───────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-mystic-950/80 backdrop-blur-xl safe-area-x">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <Link
            to={isSignedIn ? '/' : '/welcome'}
            className="flex items-center gap-2 sm:gap-3 group min-w-0"
            aria-label="Epimetheus home"
          >
            <Logo size="md" />
            {/* Brand wordmark hides below 360px to make room for CTAs on
                tiny phones (iPhone SE 1st gen, old Android). The logo
                glyph alone keeps the brand visible. */}
            <span className="hidden xs:inline hero-headline text-base sm:text-xl text-slate-50 tracking-tight group-hover:text-accent-primary transition-colors truncate">
              EPIMETHEUS
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-400" aria-label="Primary">
            <a href="#features" className="hover:text-slate-100 transition-colors">
              Features
            </a>
            <a href="#archetypes" className="hover:text-slate-100 transition-colors">
              Archetypes
            </a>
            <Link to="/pricing" className="hover:text-slate-100 transition-colors">
              Pricing
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            {isSignedIn ? (
              <>
                <Link
                  to="/profile"
                  className="hidden sm:inline-block text-sm text-slate-300 hover:text-slate-50 px-3 py-2 transition-colors"
                >
                  Profile
                </Link>
                <Link
                  to="/"
                  className="text-sm font-semibold text-mystic-950 accent-gradient px-3 sm:px-4 py-2 rounded-xl shadow-lg shadow-accent-primary/15 hover:scale-[1.02] active:scale-[0.98] transition-transform whitespace-nowrap"
                >
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden sm:inline-block text-sm text-slate-300 hover:text-slate-50 px-3 py-2 transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="text-sm font-semibold text-mystic-950 accent-gradient px-3 sm:px-4 py-2 rounded-xl shadow-lg shadow-accent-primary/15 hover:scale-[1.02] active:scale-[0.98] transition-transform whitespace-nowrap"
                >
                  Get Started
                </Link>
              </>
            )}
            {/* Mobile nav trigger — only visible below md. Toggles a
                full-screen overlay panel since this page is the marketing
                surface (no Layout chrome). */}
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
              aria-expanded={mobileNavOpen}
              aria-controls="landing-mobile-nav"
              className="md:hidden p-2 rounded-xl text-slate-300 hover:text-slate-100 hover:bg-white/5 transition-colors"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* ───────────────────────── Mobile nav overlay ───────────────────────── */}
      {mobileNavOpen && (
        <div
          id="landing-mobile-nav"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className="fixed inset-0 z-50 md:hidden bg-mystic-950/95 backdrop-blur-xl flex flex-col safe-area-top safe-area-bottom safe-area-x"
        >
          <div className="flex items-center justify-between px-4 py-4 border-b border-white/5">
            <Link
              to={isSignedIn ? '/' : '/welcome'}
              onClick={() => setMobileNavOpen(false)}
              className="flex items-center gap-2"
            >
              <Logo size="md" />
              <span className="hero-headline text-lg text-slate-50">EPIMETHEUS</span>
            </Link>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation"
              className="p-2 rounded-xl text-slate-300 hover:text-slate-100 hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-2 text-base" aria-label="Mobile primary">
            <a
              href="#features"
              onClick={() => setMobileNavOpen(false)}
              className="block px-4 py-3 rounded-xl text-slate-200 hover:bg-white/5 transition-colors"
            >
              Features
            </a>
            <a
              href="#archetypes"
              onClick={() => setMobileNavOpen(false)}
              className="block px-4 py-3 rounded-xl text-slate-200 hover:bg-white/5 transition-colors"
            >
              Archetypes
            </a>
            <Link
              to="/pricing"
              onClick={() => setMobileNavOpen(false)}
              className="block px-4 py-3 rounded-xl text-slate-200 hover:bg-white/5 transition-colors"
            >
              Pricing
            </Link>
            {isSignedIn ? (
              <Link
                to="/profile"
                onClick={() => setMobileNavOpen(false)}
                className="block px-4 py-3 rounded-xl text-slate-200 hover:bg-white/5 transition-colors"
              >
                Profile
              </Link>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileNavOpen(false)}
                className="block px-4 py-3 rounded-xl text-slate-200 hover:bg-white/5 transition-colors"
              >
                Sign in
              </Link>
            )}
          </nav>
          <div className="px-4 py-4 border-t border-white/5">
            <Link
              to={isSignedIn ? '/' : '/register'}
              onClick={() => setMobileNavOpen(false)}
              className="block w-full text-center px-6 py-3 rounded-xl accent-gradient text-mystic-950 font-semibold shadow-lg shadow-accent-primary/15"
            >
              {isSignedIn ? 'Open dashboard' : 'Create free account'}
            </Link>
          </div>
        </div>
      )}

      {/* ───────────────────────── Hero ───────────────────────── */}
      <motion.section
        id="main-content"
        variants={cVar}
        initial="hidden"
        animate="show"
        className="max-w-5xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 md:pt-28 pb-16 sm:pb-24 text-center"
      >
        <motion.div variants={iVar}>
          <span className="eyebrow inline-flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-accent-primary" aria-hidden="true" />
            Yame Coaching · The EPIMETHEUS System
          </span>
        </motion.div>

        <motion.h1
          variants={iVar}
          className="hero-headline mt-6 text-4xl xs:text-5xl sm:text-6xl md:text-7xl lg:text-8xl text-slate-50 leading-[1.05]"
        >
          Open the box.
          <br />
          <span className="text-gradient">Find the hope.</span>
        </motion.h1>

        <motion.p
          variants={iVar}
          className="mt-6 sm:mt-8 mx-auto max-w-2xl text-base sm:text-lg md:text-xl text-slate-400 leading-relaxed"
        >
          A behavioral intelligence platform for modern dating. Decode female archetypes,
          read the signals beneath the words, and navigate the test with precision.
        </motion.p>

        <motion.div
          variants={iVar}
          className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 max-w-md sm:max-w-none mx-auto"
        >
          {isSignedIn ? (
            <>
              <Link
                to="/"
                className="group w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl accent-gradient text-mystic-950 font-semibold tracking-wide shadow-xl shadow-accent-primary/15 transition-transform hover:scale-[1.02] active:scale-[0.98] inline-flex items-center justify-center gap-2"
              >
                Go to dashboard
                <ArrowRight
                  aria-hidden="true"
                  className="w-5 h-5 transition-transform group-hover:translate-x-0.5"
                />
              </Link>
              <Link
                to="/pricing"
                className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl bg-white/5 border border-slate-700/30 text-slate-100 font-semibold tracking-wide hover:bg-white/8 hover:border-accent-primary/20 transition-all inline-flex items-center justify-center"
              >
                See pricing
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/register"
                className="group w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl accent-gradient text-mystic-950 font-semibold tracking-wide shadow-xl shadow-accent-primary/15 transition-transform hover:scale-[1.02] active:scale-[0.98] inline-flex items-center justify-center gap-2"
              >
                Create free account
                <ArrowRight
                  aria-hidden="true"
                  className="w-5 h-5 transition-transform group-hover:translate-x-0.5"
                />
              </Link>
              <Link
                to="/pricing"
                className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl bg-white/5 border border-slate-700/30 text-slate-100 font-semibold tracking-wide hover:bg-white/8 hover:border-accent-primary/20 transition-all inline-flex items-center justify-center"
              >
                See pricing
              </Link>
            </>
          )}
        </motion.div>

        <motion.p
          variants={iVar}
          className="mt-6 font-mono text-[10px] sm:text-[11px] tracking-[0.2em] sm:tracking-[0.25em] uppercase text-slate-500"
        >
          Free forever · Upgrade anytime · No credit card to start
        </motion.p>
      </motion.section>

      {/* ───────────────────────── Stats strip ───────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24" aria-label="At a glance">
        <div className="glass-card p-6 sm:p-10 grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-4 text-center">
          {[
            { v: '8', l: 'Archetypes mapped', a: undefined },
            { v: '40+', l: 'Behavioral signals', a: undefined },
            { v: '24/7', l: 'AI advisor on call', a: '24 by 7' },
            { v: '∞', l: 'Roleplay simulations', a: 'Unlimited' },
          ].map((s) => (
            <div key={s.l} className="space-y-1">
              <div
                className="hero-headline text-4xl sm:text-5xl text-accent-primary tabular-nums"
                aria-label={s.a}
              >
                <span aria-hidden={s.a ? 'true' : undefined}>{s.v}</span>
              </div>
              <div className="text-xs text-slate-500 tracking-wider uppercase">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────────────────── Features ───────────────────────── */}
      <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center max-w-2xl mx-auto space-y-4 mb-14">
          <span className="eyebrow">The toolkit</span>
          <h2 className="hero-headline text-4xl sm:text-5xl text-slate-50">
            Eight instruments. <span className="text-gradient">One framework.</span>
          </h2>
          <p className="text-slate-400">
            Two are free, forever. Six unlock with Strategist. Every tool is built on the same
            behavioral spine — so the advisor, the decryptor, and the dossiers all speak the
            same language.
          </p>
        </div>

        <motion.div
          variants={cVar}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
        >
          {FEATURES.map((f) => (
            <motion.div
              key={f.title}
              variants={iVar}
              className="glass-card p-6 mystic-border group relative overflow-hidden"
            >
              {/* Tier badge */}
              <div className="absolute top-4 right-4">
                {f.locked ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-primary/10 border border-accent-primary/20 text-[9px] font-mono tracking-[0.2em] uppercase text-accent-primary">
                    <Lock className="w-2.5 h-2.5" aria-hidden="true" />
                    Strategist
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-status-success/10 border border-status-success/20 text-[9px] font-mono tracking-[0.2em] uppercase text-status-success">
                    Free
                  </span>
                )}
              </div>

              <div className="w-12 h-12 rounded-xl bg-accent-primary/10 border border-accent-primary/15 flex items-center justify-center text-accent-primary mb-5 group-hover:bg-accent-primary/15 transition-colors">
                <f.icon className="w-6 h-6" strokeWidth={1.5} aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold tracking-tight text-slate-100 group-hover:text-accent-primary transition-colors mb-2 pr-16">
                {f.title}
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        <div className="mt-10 text-center">
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 text-accent-primary font-semibold hover:underline"
          >
            See full plan comparison
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* ───────────────────────── Archetypes preview ───────────────────────── */}
      <section id="archetypes" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center max-w-2xl mx-auto space-y-4 mb-14">
          <span className="eyebrow">The 8 archetypes</span>
          <h2 className="hero-headline text-4xl sm:text-5xl text-slate-50">
            Two free. <span className="text-gradient">Six unlocked with Strategist.</span>
          </h2>
          <p className="text-slate-400">
            Each archetype maps her tells, triggers, and tests. Start with the two free profiles,
            unlock the rest when you're ready to go deeper.
          </p>
        </div>

        <motion.div
          variants={cVar}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {ARCHETYPES.map((a) => (
            <motion.div key={a.id} variants={iVar}>
              <div className={`glass-card p-6 h-full transition-colors ${a.locked ? 'opacity-70' : 'hover:border-accent-primary/25'}`}>
                <div className="flex justify-between items-start mb-4">
                  <span className="text-xs font-mono font-semibold text-accent-primary tracking-widest">
                    {a.id}
                  </span>
                  {a.locked ? (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-primary/10 border border-accent-primary/20 text-[9px] font-mono tracking-[0.15em] uppercase text-accent-primary"
                      title="Strategist plan required"
                    >
                      <Lock className="w-2.5 h-2.5" aria-hidden="true" />
                      Locked
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-status-success/10 border border-status-success/20 text-[9px] font-mono tracking-[0.15em] uppercase text-status-success">
                      Free
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-lg mb-1 text-slate-100">{a.name}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{a.tagline}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ───────────────────────── How it works ───────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center max-w-2xl mx-auto space-y-4 mb-14">
          <span className="eyebrow">How it works</span>
          <h2 className="hero-headline text-4xl sm:text-5xl text-slate-50">
            From signal to strategy.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              n: '01',
              t: 'Calibrate',
              d: 'Take the assessment. The system learns how you read people today.',
            },
            {
              n: '02',
              t: 'Decode',
              d: 'Drop in messages, behaviors, or conversations. We surface the archetype and the signals.',
            },
            {
              n: '03',
              t: 'Move',
              d: 'Get the line, the move, or the warning — before the moment passes.',
            },
          ].map((step) => (
            <div key={step.n} className="glass-card p-6 space-y-3">
              <div className="font-mono text-xs tracking-[0.3em] text-accent-primary">{step.n}</div>
              <h3 className="hero-headline text-2xl text-slate-50">{step.t}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{step.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────────────────── Quote / philosophy ───────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
        <motion.blockquote
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="hero-headline-italic text-2xl sm:text-3xl text-slate-200 leading-relaxed"
        >
          “Epimetheus opened Pandora's box. Chaos fled, but Hope remained.
          Modern dating is no different.”
        </motion.blockquote>
        <p className="mt-6 font-mono text-xs tracking-[0.25em] uppercase text-slate-500">
          The Yame Coaching doctrine
        </p>
      </section>

      {/* ───────────────────────── Testimonials ───────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center max-w-2xl mx-auto space-y-4 mb-14">
          <span className="eyebrow">Sample scenarios</span>
          <h2 className="hero-headline text-4xl sm:text-5xl text-slate-50">
            What it looks like in practice.
          </h2>
          <p className="text-slate-400">
            Illustrative examples of the kinds of breakthroughs the framework targets.
            Real member testimonials will be added as the platform matures.
          </p>
        </div>

        <motion.div
          variants={cVar}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-5"
        >
          {[
            {
              quote:
                'Decoding a long text thread to map her archetype, then seeing the signals you missed in real time.',
              label: 'Signal Decryptor',
            },
            {
              quote:
                'Practicing high-stakes conversations until the right line comes faster than the wrong one.',
              label: 'Simulation Matrix',
            },
            {
              quote:
                'Walking into a date already knowing her archetype and the moves the framework predicts.',
              label: 'Archetype Calibration',
            },
          ].map((t, i) => (
            <motion.div
              key={i}
              variants={iVar}
              className="glass-card p-6 sm:p-7 flex flex-col"
            >
              <div className="flex gap-0.5 mb-4 text-accent-primary/50">
                {[...Array(5)].map((_, idx) => (
                  <Star
                    key={idx}
                    className="w-3.5 h-3.5"
                    fill="currentColor"
                    aria-hidden="true"
                  />
                ))}
              </div>
              <blockquote className="hero-headline-italic text-base text-slate-200 leading-relaxed flex-1">
                “{t.quote}”
              </blockquote>
              <div className="mt-5 pt-4 border-t border-slate-700/30">
                <div className="text-xs font-mono tracking-[0.18em] uppercase text-accent-primary">
                  {t.label}
                </div>
                <div className="text-xs text-slate-500 mt-1">Illustrative example</div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ───────────────────────── Comparison strip ───────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center max-w-2xl mx-auto space-y-4 mb-12">
          <span className="eyebrow">The difference</span>
          <h2 className="hero-headline text-3xl sm:text-4xl text-slate-50">
            Without vs. with EPIMETHEUS.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="glass-card p-7 border-status-error/20">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-status-error/10 border border-status-error/20 flex items-center justify-center text-status-error">
                <span className="text-xl">×</span>
              </div>
              <h3 className="hero-headline text-2xl text-slate-100">Without</h3>
            </div>
            <ul className="space-y-3 text-sm text-slate-400">
              {[
                'Misreading mixed signals as rejection',
                'Replying late, replying wrong, replying never',
                'Losing the same kind of woman, twice',
                'Guessing her type and being three weeks late',
                'Freezing in the moment that decides everything',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-status-error/60 shrink-0" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass-card p-7 border-accent-primary/30 shadow-[0_0_32px_-12px_rgba(232,199,126,0.18)]">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center text-accent-primary">
                <TrendingUp className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
              </div>
              <h3 className="hero-headline text-2xl text-slate-100">With</h3>
            </div>
            <ul className="space-y-3 text-sm text-slate-300">
              {[
                'Reading signals in real time, not in hindsight',
                'Replies that move the frame forward, every time',
                'Recognizing her archetype before the second date',
                'A pre-loaded playbook for the moments that matter',
                'Confidence built on pattern recognition, not luck',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-accent-primary shrink-0" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ───────────────────────── Final CTA ───────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="glass-card p-8 sm:p-14 text-center relative overflow-hidden shimmer-effect">
          <div className="relative z-10 space-y-6">
            <ShieldCheck className="w-12 h-12 text-accent-primary mx-auto" aria-hidden="true" />
            <h2 className="hero-headline text-3xl sm:text-5xl text-slate-50">
              Stop guessing. <span className="text-gradient">Start reading.</span>
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              {isSignedIn
                ? 'Open the dashboard and pick up where you left off.'
                : 'Create your account in under a minute. The first assessment is free, forever.'}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              {isSignedIn ? (
                <>
                  <Link
                    to="/"
                    className="group w-full sm:w-auto px-8 py-4 rounded-xl accent-gradient text-mystic-950 font-semibold tracking-wide shadow-xl shadow-accent-primary/15 transition-transform hover:scale-[1.02] active:scale-[0.98] inline-flex items-center justify-center gap-2"
                  >
                    Go to dashboard
                    <ArrowRight
                      className="w-5 h-5 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                  <Link
                    to="/pricing"
                    className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/5 border border-slate-700/30 text-slate-100 font-semibold tracking-wide hover:bg-white/8 hover:border-accent-primary/20 transition-all"
                  >
                    Compare plans
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="group w-full sm:w-auto px-8 py-4 rounded-xl accent-gradient text-mystic-950 font-semibold tracking-wide shadow-xl shadow-accent-primary/15 transition-transform hover:scale-[1.02] active:scale-[0.98] inline-flex items-center justify-center gap-2"
                  >
                    Create free account
                    <ArrowRight
                      className="w-5 h-5 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                  <Link
                    to="/pricing"
                    className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/5 border border-slate-700/30 text-slate-100 font-semibold tracking-wide hover:bg-white/8 hover:border-accent-primary/20 transition-all"
                  >
                    Compare plans
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────── Footer ───────────────────────── */}
      <footer className="border-t border-white/5 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-slate-500">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span>© {new Date().getFullYear()} Yame Coaching · EPIMETHEUS</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/pricing" className="hover:text-slate-200 transition-colors">
              Pricing
            </Link>
            <Link to="/terms" className="hover:text-slate-200 transition-colors">
              Terms
            </Link>
            <Link to="/privacy" className="hover:text-slate-200 transition-colors">
              Privacy
            </Link>
            <Link to="/login" className="hover:text-slate-200 transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

