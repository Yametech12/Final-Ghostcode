import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Logo from '../components/Logo';

/**
 * Terms of Service — public route, no auth required.
 *
 * IMPORTANT: This is a plain-English template, not legal advice. Replace the
 * placeholders ([Effective Date], [Jurisdiction], [Contact Email],
 * [Company Legal Name]) with real values and have the document reviewed by
 * a lawyer for your jurisdiction before shipping to production.
 */
export default function TermsPage() {
  const EFFECTIVE_DATE = 'May 25, 2026';

  return (
    <div className="min-h-screen bg-mystic-950 text-slate-200">
      <header className="border-b border-white/5 bg-mystic-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Back
          </Link>
          <Logo size="md" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        <div className="space-y-2">
          <p className="font-mono text-[11px] tracking-[0.3em] uppercase text-accent-primary">
            Legal
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-50">
            Terms of Service
          </h1>
          <p className="text-sm text-slate-500">Effective: {EFFECTIVE_DATE}</p>
        </div>

        <p className="text-sm text-slate-400 leading-relaxed">
          Welcome to Epimetheus. These Terms of Service (&quot;Terms&quot;) govern
          your access to and use of the Epimetheus web application and related
          services (collectively, the &quot;Service&quot;). By creating an
          account or otherwise using the Service, you agree to be bound by
          these Terms. If you do not agree, do not use the Service.
        </p>

        <Section title="1. Eligibility">
          <p>
            You must be at least 18 years old to use the Service. By creating an
            account, you represent that you meet this age requirement and that
            you have the legal capacity to enter into these Terms.
          </p>
        </Section>

        <Section title="2. Your Account">
          <ul className="list-disc list-inside space-y-2">
            <li>
              You are responsible for keeping your login credentials secure and
              for all activity that occurs under your account.
            </li>
            <li>
              You agree to provide accurate information during registration and
              to keep it up to date.
            </li>
            <li>
              You agree not to share your account or use someone else&apos;s
              account without their permission.
            </li>
          </ul>
        </Section>

        <Section title="3. The Service is for Informational and Entertainment Purposes Only">
          <p>
            Epimetheus provides personality assessments, AI-generated analyses,
            tactical suggestions, and an AI-powered chat advisor. These outputs
            are produced by automated systems and curated content, and they are
            offered for informational and entertainment purposes only.
          </p>
          <p className="mt-3">
            <strong className="text-slate-200">
              The Service is not a substitute for professional advice.
            </strong>{' '}
            It does not constitute medical, mental-health, psychological,
            legal, financial, or relationship-counseling advice. Do not rely on
            the Service to make decisions that materially affect you or others.
            If you are in distress or considering harming yourself or another
            person, contact local emergency services or a qualified
            professional.
          </p>
        </Section>

        <Section title="4. AI-Generated Content">
          <ul className="list-disc list-inside space-y-2">
            <li>
              AI outputs may be inaccurate, biased, incomplete, or otherwise
              unsuitable. You are responsible for evaluating outputs before
              acting on them.
            </li>
            <li>
              Confidence scores are heuristic estimates produced by the model,
              not guarantees of accuracy.
            </li>
            <li>
              We do not warrant that AI outputs are appropriate for your
              specific situation, and we are not liable for actions you take
              based on them.
            </li>
          </ul>
        </Section>

        <Section title="5. Acceptable Use">
          <p>You agree not to use the Service to:</p>
          <ul className="list-disc list-inside space-y-2 mt-2">
            <li>
              Harass, stalk, threaten, manipulate, defraud, or otherwise harm
              another person.
            </li>
            <li>
              Profile, surveil, or build dossiers on minors or non-consenting
              individuals in a manner that violates applicable law.
            </li>
            <li>
              Generate content that sexualizes minors, incites violence,
              promotes hatred against protected groups, or is otherwise
              illegal.
            </li>
            <li>
              Reverse engineer, scrape at scale, abuse rate limits, or attempt
              to extract our prompts, models, or proprietary data.
            </li>
            <li>
              Upload malware, spam, or content you do not have the right to
              upload.
            </li>
            <li>
              Use the Service to make decisions about employment, credit,
              housing, insurance, or other contexts where automated profiling
              of identified individuals is regulated.
            </li>
          </ul>
          <p className="mt-3">
            We may suspend or terminate accounts that violate this section.
          </p>
        </Section>

        <Section title="6. User Content">
          <p>
            &quot;User Content&quot; means anything you submit to the Service:
            assessment answers, scenario inputs, advisor messages, profile
            information, photos, dossiers, field reports, comments, and
            feedback.
          </p>
          <ul className="list-disc list-inside space-y-2 mt-2">
            <li>You retain ownership of your User Content.</li>
            <li>
              You grant us a worldwide, non-exclusive, royalty-free license to
              host, store, transmit, and display your User Content as needed to
              operate the Service.
            </li>
            <li>
              You are solely responsible for your User Content and for
              obtaining any consents required to share information about other
              people.
            </li>
            <li>
              You agree not to upload content that infringes third-party
              rights, exposes private facts, or otherwise violates applicable
              law.
            </li>
          </ul>
        </Section>

        <Section title="7. Third-Party Services">
          <p>
            The Service uses third-party providers including Supabase
            (database, authentication, storage) and Regolo AI (large language
            models). Your use of the Service is also subject to those
            providers&apos; terms. We are not responsible for the acts or
            omissions of third parties.
          </p>
        </Section>

        <Section title="8. Intellectual Property">
          <p>
            The Service, including the eight-archetype framework, the trait
            taxonomies, written guides, glossary, prompts, code, and visual
            design, is owned by us or licensed to us and is protected by
            applicable intellectual-property laws. You receive a limited,
            revocable, non-transferable license to use the Service for your
            personal, non-commercial use.
          </p>
        </Section>

        <Section title="9. Termination">
          <p>
            You may stop using the Service at any time and delete your account
            from the profile settings. We may suspend or terminate your access
            for violations of these Terms or applicable law, or to protect the
            Service or other users. Sections that by their nature should
            survive termination will survive.
          </p>
        </Section>

        <Section title="10. Disclaimers">
          <p>
            The Service is provided &quot;as is&quot; and &quot;as
            available,&quot; without warranties of any kind, express or
            implied, including merchantability, fitness for a particular
            purpose, non-infringement, or accuracy. We do not warrant that the
            Service will be uninterrupted or error-free.
          </p>
        </Section>

        <Section title="11. Limitation of Liability">
          <p>
            To the maximum extent permitted by law, we will not be liable for
            indirect, incidental, special, consequential, or punitive damages,
            or for lost profits, data, or goodwill, arising from your use of
            the Service. Our total liability for any claim relating to the
            Service is limited to the greater of (a) the amounts you paid us
            for the Service in the twelve months preceding the claim, or
            (b) one hundred United States dollars.
          </p>
        </Section>

        <Section title="12. Changes to These Terms">
          <p>
            We may update these Terms from time to time. If we make material
            changes, we will notify you by email or through the Service. Your
            continued use of the Service after changes take effect constitutes
            your acceptance of the updated Terms.
          </p>
        </Section>

        <Section title="13. Governing Law">
          <p>
            These Terms are governed by the laws of [Jurisdiction], without
            regard to its conflict-of-laws principles. Any dispute arising out
            of or relating to these Terms or the Service will be resolved in
            the courts located in [Jurisdiction], and you consent to the
            personal jurisdiction of those courts.
          </p>
        </Section>

        <Section title="14. Contact">
          <p>
            Questions about these Terms? Contact us at{' '}
            <a
              href="mailto:epimetheus.support@gmail.com"
              className="text-accent-primary hover:underline"
            >
              epimetheus.support@gmail.com
            </a>
            .
          </p>
        </Section>

        <p className="text-xs text-slate-600 pt-8 border-t border-white/5">
          This document is provided as a starting template and does not
          constitute legal advice. Please consult a qualified attorney in your
          jurisdiction before relying on it.
        </p>

        <div className="pt-4">
          <Link
            to="/privacy"
            className="text-sm text-accent-primary hover:underline"
          >
            Read the Privacy Policy →
          </Link>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-slate-100">{title}</h2>
      <div className="text-sm text-slate-400 leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}
