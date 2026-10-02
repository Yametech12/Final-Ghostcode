import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  scrubParams,
  trackEvent,
  trackSignUp,
  trackLogin,
  trackPlanCtaClick,
  trackWaitlistJoin,
  trackOnboardingStep,
  trackOnboardingComplete,
  trackOnboardingDismissed,
  trackAssessmentComplete,
  trackAdvisorMessage,
  trackDecryptorRun,
  trackSimulationStarted,
  trackProfilerComplete,
  trackQuizComplete,
  trackFeatureUsed,
  trackErrorEvent,
  trackPageView,
  initAnalytics,
  __resetAnalyticsForTests,
} from './analytics';

describe('scrubParams — PII protection', () => {
  it('drops email addresses in values', () => {
    const out = scrubParams({ note: 'contact me at jane@example.com please' });
    expect(out).toEqual({});
  });

  it('drops phone-like strings in values', () => {
    const out = scrubParams({ note: 'call +1 555-123-4567 now' });
    expect(out).toEqual({});
  });

  it('drops PII-named keys regardless of value', () => {
    const out = scrubParams({
      email: 'x',
      displayName: 'Jane',
      phone: '123',
      userId: 'abc',
      password: 'secret',
    });
    expect(out).toEqual({});
  });

  it('keeps anonymous categorical and numeric params', () => {
    const out = scrubParams({ plan_tier: 'strategist', step: 2, signed_in: true });
    expect(out).toEqual({ plan_tier: 'strategist', step: 2, signed_in: true });
  });

  it('does not mutate the input object', () => {
    const input = { email: 'a@b.com', ok: 1 };
    scrubParams(input);
    expect(input).toEqual({ email: 'a@b.com', ok: 1 });
  });
});

describe('analytics no-op behavior (no tracking ID)', () => {
  beforeEach(() => {
    __resetAnalyticsForTests();
    delete (globalThis as any).gtag;
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    delete (globalThis as any).gtag;
    vi.unstubAllEnvs();
    __resetAnalyticsForTests();
  });

  it('trackEvent does not throw without a tracking ID', () => {
    expect(() => trackEvent('test_event', { a: 1 })).not.toThrow();
  });

  it('initAnalytics loads no scripts without a tracking ID', () => {
    expect(() => initAnalytics()).not.toThrow();
    const scripts = Array.from(document.querySelectorAll('script')).filter((s) =>
      s.src.includes('googletagmanager')
    );
    expect(scripts.length).toBe(0);
  });

  it('all typed helpers are safe no-ops without configuration', () => {
    const gtagMock = vi.fn();
    (globalThis as any).gtag = gtagMock;
    trackSignUp('email');
    trackLogin('google');
    trackPlanCtaClick('strategist', { signedIn: true });
    trackWaitlistJoin('oracle');
    trackOnboardingStep(2, 5);
    trackOnboardingComplete(5);
    trackOnboardingDismissed(2, 5);
    trackAssessmentComplete('strategist');
    trackAdvisorMessage();
    trackDecryptorRun();
    trackSimulationStarted('analyst');
    trackProfilerComplete();
    trackQuizComplete('q1');
    trackFeatureUsed('encyclopedia');
    trackErrorEvent('boom', true);
    trackPageView('/pricing');
    expect(gtagMock).not.toHaveBeenCalled();
  });
});

describe('analytics with tracking ID configured', () => {
  let gtagMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __resetAnalyticsForTests();
    vi.stubEnv('VITE_GA_TRACKING_ID', 'G-TEST123');
    gtagMock = vi.fn();
    (globalThis as any).gtag = gtagMock;
    initAnalytics();
  });

  afterEach(() => {
    delete (globalThis as any).gtag;
    vi.unstubAllEnvs();
    __resetAnalyticsForTests();
  });

  it('sends GA4 recommended auth event names', () => {
    trackSignUp('email');
    expect(gtagMock).toHaveBeenCalledWith('event', 'sign_up', { method: 'email' });
    trackLogin('google');
    expect(gtagMock).toHaveBeenCalledWith('event', 'login', { method: 'google' });
  });

  it('sends funnel events with anonymous params', () => {
    trackPlanCtaClick('strategist', { signedIn: false, intent: 'strategist' });
    expect(gtagMock).toHaveBeenCalledWith('event', 'plan_cta_click', {
      plan_tier: 'strategist',
      signed_in: false,
      intent: 'strategist',
    });
    trackWaitlistJoin('oracle');
    expect(gtagMock).toHaveBeenCalledWith('event', 'waitlist_join', {
      plan_tier: 'oracle',
    });
  });

  it('sends onboarding funnel events', () => {
    trackOnboardingStep(2, 5);
    expect(gtagMock).toHaveBeenCalledWith('event', 'onboarding_step', {
      step: 2,
      total_steps: 5,
    });
    trackOnboardingComplete(5);
    expect(gtagMock).toHaveBeenCalledWith('event', 'onboarding_complete', {
      total_steps: 5,
    });
    trackOnboardingDismissed(2, 5);
    expect(gtagMock).toHaveBeenCalledWith('event', 'onboarding_dismissed', {
      at_step: 2,
      total_steps: 5,
    });
  });

  it('sends feature usage events', () => {
    trackAssessmentComplete('strategist');
    expect(gtagMock).toHaveBeenCalledWith('event', 'assessment_complete', {
      result_type: 'strategist',
    });
    trackAdvisorMessage();
    expect(gtagMock).toHaveBeenCalledWith('event', 'advisor_message_sent', {});
    trackDecryptorRun();
    expect(gtagMock).toHaveBeenCalledWith('event', 'decryptor_run', {});
    trackSimulationStarted('analyst');
    expect(gtagMock).toHaveBeenCalledWith('event', 'simulation_started', {
      personality_type: 'analyst',
    });
    trackProfilerComplete();
    expect(gtagMock).toHaveBeenCalledWith('event', 'profiler_complete', {});
    trackQuizComplete('q1');
    expect(gtagMock).toHaveBeenCalledWith('event', 'quiz_complete', {
      quiz_id: 'q1',
    });
    trackFeatureUsed('encyclopedia');
    expect(gtagMock).toHaveBeenCalledWith('event', 'feature_used', {
      feature: 'encyclopedia',
    });
  });

  it('scrubs PII from event params before sending to gtag', () => {
    trackEvent('sneaky', {
      email: 'jane@example.com',
      note: 'call +1 555-123-4567',
      plan_tier: 'free',
    });
    expect(gtagMock).toHaveBeenCalledWith('event', 'sneaky', {
      plan_tier: 'free',
    });
  });

  it('truncates error messages and flags fatal', () => {
    trackErrorEvent('x'.repeat(500), true);
    const call = gtagMock.mock.calls.find((c) => c[1] === 'app_error');
    expect(call).toBeDefined();
    expect((call![2] as any).message.length).toBeLessThanOrEqual(200);
    expect((call![2] as any).fatal).toBe(true);
  });

  it('sends page_view with path', () => {
    trackPageView('/pricing?ref=x');
    expect(gtagMock).toHaveBeenCalledWith(
      'event',
      'page_view',
      expect.objectContaining({ page_path: '/pricing?ref=x' })
    );
  });
});
