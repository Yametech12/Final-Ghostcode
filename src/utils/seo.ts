/**
 * Central SEO configuration for the Epimetheus SPA.
 *
 * Because this is a client-side rendered app, all routes share the same
 * index.html shell. The `useSEO` hook reads this config on every navigation
 * and updates document.title, meta description, Open Graph / Twitter tags,
 * and the canonical link so crawlers that execute JavaScript (Google)
 * see per-page metadata.
 *
 * Only public, indexable routes get full metadata. Authenticated app routes
 * are disallowed in robots.txt and get a minimal noindex-friendly fallback.
 */

export const SITE_URL = 'https://epimetheusproject.vercel.app';
export const SITE_NAME = 'Epimetheus';
export const OG_IMAGE = `${SITE_URL}/og-image.jpg`;
export const TWITTER_SITE = '@epimetheus';

export interface SEOMeta {
  title: string;
  description: string;
  /** Open Graph type — 'website' for landing-style pages, 'article' never used here. */
  ogType?: 'website';
  /** Canonical path (defaults to the route key). */
  canonicalPath?: string;
  /** When true, the page is a private app route — crawlers should not index it. */
  noindex?: boolean;
}

const DEFAULT_TITLE = 'EPIMETHEUS — Master the Art of Connection';
const DEFAULT_DESCRIPTION =
  'EPIMETHEUS is premium dating and relationship coaching — personality assessments, an AI advisor, and tactical playbooks for connection.';

export const SEO_CONFIG: Record<string, SEOMeta> = {
  '/': {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    ogType: 'website',
  },
  '/pricing': {
    title: 'Pricing — EPIMETHEUS',
    description:
      'Simple, transparent pricing for Epimetheus. Start free, upgrade to Strategist for the full observatory — AI advisor, decryptor, dossiers and more.',
    ogType: 'website',
  },
  '/login': {
    title: 'Sign In — EPIMETHEUS',
    description:
      'Sign in to your Epimetheus account to access your personality assessments, AI advisor, and tactical playbooks.',
    noindex: true,
  },
  '/register': {
    title: 'Create Your Account — EPIMETHEUS',
    description:
      'Create a free Epimetheus account and start reading personality dynamics with the behavioral observatory.',
    noindex: true,
  },
  '/reset-password': {
    title: 'Reset Password — EPIMETHEUS',
    description: 'Reset your Epimetheus account password securely.',
    noindex: true,
  },
  '/terms': {
    title: 'Terms of Service — EPIMETHEUS',
    description:
      'The Epimetheus Terms of Service — the rules and agreements governing your use of the platform.',
  },
  '/privacy': {
    title: 'Privacy Policy — EPIMETHEUS',
    description:
      'How Epimetheus collects, uses, and protects your data. Read our privacy commitments.',
  },
};

/** Fallback for authenticated app routes — never indexed. */
export const APP_FALLBACK_META: SEOMeta = {
  title: 'EPIMETHEUS',
  description: DEFAULT_DESCRIPTION,
  noindex: true,
};

export function getSEOMeta(pathname: string): SEOMeta {
  // Exact match first, then fall back to the app default for private routes.
  return SEO_CONFIG[pathname] ?? APP_FALLBACK_META;
}
