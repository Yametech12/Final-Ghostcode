import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  SITE_URL,
  SITE_NAME,
  OG_IMAGE,
  TWITTER_SITE,
  getSEOMeta,
} from '../utils/seo';

/**
 * Updates document head metadata on every route change.
 *
 * For a client-side rendered SPA this is the only way to give crawlers
 * (Google executes JS) per-page titles, descriptions, OG/Twitter tags,
 * canonical URLs, and robots directives. All tags are created once and
 * then updated in place — the hook never duplicates tags.
 */

function upsertMetaByName(name: string, content: string): void {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertMetaByProperty(property: string, content: string): void {
  let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string): void {
  let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function useSEO(): void {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = getSEOMeta(pathname);
    const canonicalPath = meta.canonicalPath ?? pathname;
    const canonicalUrl = `${SITE_URL}${canonicalPath === '/' ? '/' : canonicalPath}`;

    // Title
    document.title = meta.title;

    // Standard meta
    upsertMetaByName('description', meta.description);
    upsertMetaByName('robots', meta.noindex ? 'noindex, nofollow' : 'index, follow');

    // Open Graph
    upsertMetaByProperty('og:title', meta.title);
    upsertMetaByProperty('og:description', meta.description);
    upsertMetaByProperty('og:type', meta.ogType ?? 'website');
    upsertMetaByProperty('og:url', canonicalUrl);
    upsertMetaByProperty('og:site_name', SITE_NAME);
    upsertMetaByProperty('og:image', OG_IMAGE);

    // Twitter
    upsertMetaByName('twitter:card', 'summary_large_image');
    upsertMetaByName('twitter:site', TWITTER_SITE);
    upsertMetaByName('twitter:title', meta.title);
    upsertMetaByName('twitter:description', meta.description);
    upsertMetaByName('twitter:image', OG_IMAGE);

    // Canonical
    upsertCanonical(canonicalUrl);
  }, [pathname]);
}
