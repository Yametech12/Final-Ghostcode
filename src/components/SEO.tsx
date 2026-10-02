import { useSEO } from '../hooks/useSEO';
import { SITE_URL, SITE_NAME } from '../utils/seo';

/**
 * Global SEO component — mount once at the app root.
 *
 * - Runs `useSEO()` to keep per-route meta tags in sync on navigation.
 * - Injects JSON-LD structured data (Organization + WebSite) once.
 */
const ORGANIZATION_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/icon-512.png`,
  sameAs: [] as string[],
};

const WEBSITE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
  inLanguage: 'en-US',
};

export default function SEO(): React.ReactNode {
  useSEO();

  return (
    <>
      <script type="application/ld+json">{JSON.stringify(ORGANIZATION_JSONLD)}</script>
      <script type="application/ld+json">{JSON.stringify(WEBSITE_JSONLD)}</script>
    </>
  );
}
