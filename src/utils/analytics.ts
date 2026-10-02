/**
 * Privacy-conscious product analytics for Epimetheus.
 *
 * Uses Google Analytics 4 (gtag.js) when VITE_GA_TRACKING_ID is configured.
 * Every helper is a no-op until initAnalytics() has loaded the library, so
 * local development and builds without a tracking ID never throw and never
 * send anything.
 *
 * PRIVACY RULES (enforced by scrubParams):
 * - Never pass emails, names, phone numbers, or free-text user input.
 * - Event params carry only anonymous categorical/numeric values
 *   (plan tier, step index, feature name, counts, durations).
 * - scrubParams() defensively strips anything that looks like an email or
 *   phone number in case a caller slips up.
 */

// Declare global gtag function
declare global {
  function gtag(...args: unknown[]): void;
}

let initialized = false;

const trackingId = (): string | undefined =>
  typeof window !== 'undefined'
    ? import.meta.env.VITE_GA_TRACKING_ID || undefined
    : undefined;

const isReady = (): boolean =>
  typeof window !== 'undefined' &&
  initialized &&
  !!trackingId() &&
  typeof gtag === 'function';

/** Initialize Google Analytics. Safe to call multiple times. */
export const initAnalytics = (): void => {
  if (typeof window === 'undefined' || initialized) return;
  const id = trackingId();
  if (!id) return; // No tracking ID — stay silent, stay a no-op.

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);

  const inline = document.createElement('script');
  inline.textContent = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${id}', { anonymize_ip: true });
  `;
  document.head.appendChild(inline);
  initialized = true;
};

/** For tests: reset module state. */
export const __resetAnalyticsForTests = (): void => {
  initialized = false;
};

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
// Loose international phone match: 7+ digits with optional +, spaces, dashes, parens.
const PHONE_RE = /(?:\+?\d[\d\s().-]{6,}\d)/;

/**
 * Defensive PII scrubber. Drops any string param that looks like an email
 * or phone number, and drops keys commonly used for PII. Returns a new object.
 */
export const scrubParams = (
  params: Record<string, unknown>
): Record<string, unknown> => {
  const PII_KEYS = new Set([
    'email', 'e-mail', 'mail', 'name', 'displayName', 'display_name',
    'firstName', 'first_name', 'lastName', 'last_name', 'fullName', 'full_name',
    'phone', 'phoneNumber', 'phone_number', 'mobile', 'address', 'userId',
    'user_id', 'uid', 'password',
  ]);
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (PII_KEYS.has(key)) continue;
    if (typeof value === 'string' && (EMAIL_RE.test(value) || PHONE_RE.test(value))) {
      continue;
    }
    clean[key] = value;
  }
  return clean;
};

/** Low-level event sender. Params are PII-scrubbed before sending. */
export const trackEvent = (
  eventName: string,
  parameters: Record<string, unknown> = {}
): void => {
  if (!isReady()) return;
  gtag('event', eventName, scrubParams(parameters));
};

/** Track page views (call on every route change). */
export const trackPageView = (pagePath: string, pageTitle?: string): void => {
  if (!isReady()) return;
  gtag('event', 'page_view', {
    page_path: pagePath,
    page_title: pageTitle || (typeof document !== 'undefined' ? document.title : ''),
  });
};

// ---------------------------------------------------------------------------
// Typed product events — anonymous params only.
// ---------------------------------------------------------------------------

/** User completed registration. method: 'email' | 'google'. */
export const trackSignUp = (method: 'email' | 'google'): void => {
  trackEvent('sign_up', { method });
};

/** User signed in. method: 'email' | 'google'. */
export const trackLogin = (method: 'email' | 'google'): void => {
  trackEvent('login', { method });
};

/** User clicked a pricing plan CTA. */
export const trackPlanCtaClick = (
  planTier: string,
  opts: { signedIn: boolean; intent?: string } = { signedIn: false }
): void => {
  trackEvent('plan_cta_click', {
    plan_tier: planTier,
    signed_in: opts.signedIn,
    intent: opts.intent,
  });
};

/** User joined the waitlist for a paid plan (checkout not live yet). */
export const trackWaitlistJoin = (planTier: string): void => {
  trackEvent('waitlist_join', { plan_tier: planTier });
};

/** User advanced to an onboarding step (1-based). */
export const trackOnboardingStep = (step: number, totalSteps: number): void => {
  trackEvent('onboarding_step', { step, total_steps: totalSteps });
};

/** User finished the onboarding tour (reached the last step). */
export const trackOnboardingComplete = (totalSteps: number): void => {
  trackEvent('onboarding_complete', { total_steps: totalSteps });
};

/** User dismissed onboarding before finishing. */
export const trackOnboardingDismissed = (atStep: number, totalSteps: number): void => {
  trackEvent('onboarding_dismissed', { at_step: atStep, total_steps: totalSteps });
};

/** User completed the personality assessment. resultType is the archetype key. */
export const trackAssessmentComplete = (resultType: string): void => {
  trackEvent('assessment_complete', { result_type: resultType });
};

/** User sent a message to the AI advisor. */
export const trackAdvisorMessage = (): void => {
  trackEvent('advisor_message_sent', {});
};

/** User ran the decryptor analysis successfully. */
export const trackDecryptorRun = (): void => {
  trackEvent('decryptor_run', {});
};

/** User started a simulation with a given personality type. */
export const trackSimulationStarted = (personalityType: string): void => {
  trackEvent('simulation_started', { personality_type: personalityType });
};

/** User completed the profiler (all required traits provided). */
export const trackProfilerComplete = (): void => {
  trackEvent('profiler_complete', {});
};

/** User finished a quiz and saw results. */
export const trackQuizComplete = (quizId?: string): void => {
  trackEvent('quiz_complete', quizId ? { quiz_id: quizId } : {});
};

/** Generic feature usage (calibration tasks, encyclopedia views, etc.). */
export const trackFeatureUsed = (feature: string): void => {
  trackEvent('feature_used', { feature });
};

/** Track AI feature usage (kept for backwards compatibility). */
export const trackAIUsage = (
  feature: string,
  model?: string,
  tokens?: number
): void => {
  trackEvent('ai_usage', { feature, model, tokens });
};

/** Track a caught application error (message only, no stack/PII). */
export const trackErrorEvent = (message: string, fatal = false): void => {
  trackEvent('app_error', { message: message.slice(0, 200), fatal });
};
