// Google Analytics loader.
//
// CSP NOTE: this used to inject a second <script> element whose textContent
// held the gtag bootstrap. That is an *inline* script, and the app-shell CSP
// (script-src 'self' https://www.googletagmanager.com, no 'unsafe-inline', no
// nonce) blocks it — GA would have silently stopped reporting the moment the
// CSP from vercel.json took effect. Initialising from module code instead is
// equivalent and is allowed, because the module itself is a same-origin script.
declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

// Initialize Google Analytics
export const initAnalytics = () => {
  if (typeof window === 'undefined') return;

  const trackingId = import.meta.env.VITE_GA_TRACKING_ID;
  if (!trackingId) return;

  // Load the external GA loader (allowed by script-src's googletagmanager entry).
  const script1 = document.createElement('script');
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${trackingId}`;
  document.head.appendChild(script1);

  // Initialise in module scope — no inline <script> element, so no CSP
  // violation and no console noise.
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', trackingId);
};

// Track page views
export const trackPageView = (pagePath: string, pageTitle?: string) => {
  if (typeof window !== 'undefined' && import.meta.env.VITE_GA_TRACKING_ID && typeof window.gtag === 'function') {
    window.gtag('config', import.meta.env.VITE_GA_TRACKING_ID, {
      page_path: pagePath,
      page_title: pageTitle || document.title,
    });
  }
};

// Track events
export const trackEvent = (
  eventName: string,
  parameters: Record<string, unknown> = {}
) => {
  if (typeof window !== 'undefined' && import.meta.env.VITE_GA_TRACKING_ID && typeof window.gtag === 'function') {
    window.gtag('event', eventName, {
      ...parameters,
      custom_map: { dimension1: 'user_type' }
    });
  }
};

// Track user interactions
export const trackUserInteraction = (
  category: string,
  action: string,
  label?: string,
  value?: number
) => {
  trackEvent('user_interaction', {
    event_category: category,
    event_action: action,
    event_label: label,
    value: value
  });
};

// Track AI usage
export const trackAIUsage = (
  feature: string,
  model?: string,
  tokens?: number
) => {
  trackEvent('ai_usage', {
    feature,
    model,
    tokens
  });
};

// Track errors
export const trackError = (
  error: string,
  fatal: boolean = false
) => {
  trackEvent('exception', {
    description: error,
    fatal
  });
};

// Track performance
export const trackPerformance = (
  metric: string,
  value: number,
  unit: string = 'ms'
) => {
  trackEvent('performance', {
    metric,
    value,
    unit
  });
};
