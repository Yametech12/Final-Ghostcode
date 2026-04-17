// Declare global gtag function
declare global {
  function gtag(...args: any[]): void;
}

// Initialize Google Analytics
export const initAnalytics = () => {
  if (typeof window !== 'undefined' && import.meta.env.VITE_GA_TRACKING_ID) {
    // Load Google Analytics script
    const script1 = document.createElement('script');
    script1.async = true;
    script1.src = `https://www.googletagmanager.com/gtag/js?id=${import.meta.env.VITE_GA_TRACKING_ID}`;
    document.head.appendChild(script1);

    // Initialize gtag
    const script2 = document.createElement('script');
    script2.textContent = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${import.meta.env.VITE_GA_TRACKING_ID}');
    `;
    document.head.appendChild(script2);
  }
};

// Track page views
export const trackPageView = (pagePath: string, pageTitle?: string) => {
  if (typeof window !== 'undefined' && import.meta.env.VITE_GA_TRACKING_ID && typeof gtag === 'function') {
    gtag('config', import.meta.env.VITE_GA_TRACKING_ID, {
      page_path: pagePath,
      page_title: pageTitle || document.title,
    });
  }
};

// Track events
export const trackEvent = (
  eventName: string,
  parameters: Record<string, any> = {}
) => {
  if (typeof window !== 'undefined' && import.meta.env.VITE_GA_TRACKING_ID && typeof gtag === 'function') {
    gtag('event', eventName, {
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