import React from 'react';
import Tooltip from './Tooltip';

export const glossaryTerms = [
  {
    term: "Calibration",
    definition: "The ability to read a woman's reactions and adjust your behavior accordingly. It's about being socially aware and responsive rather than rigidly following a script."
  },
  {
    term: "Time Line",
    definition: "Determines how a woman views the progression of a relationship. Testers are harder to get but easier to keep. Investors are easier to get but harder to keep."
  },
  {
    term: "Tester",
    definition: "A woman who is harder to get but easier to keep. She tests you upfront before investing."
  },
  {
    term: "Investor",
    definition: "A woman who is easier to get but harder to keep. She invests early but expects a return."
  },
  {
    term: "Sex Line",
    definition: "Determines how a woman views sex. Deniers need a reason TO have sex. Justifiers need a reason NOT to have sex."
  },
  {
    term: "Denier",
    definition: "A woman who needs a reason TO have sex (emotional connection, commitment)."
  },
  {
    term: "Justifier",
    definition: "A woman who needs a reason NOT to have sex (she enjoys it freely unless there's a red flag)."
  },
  {
    term: "Relationship Line",
    definition: "Determines how a woman views the world and relationships. Realists are practical. Idealists are romantic."
  },
  {
    term: "Realist",
    definition: "A woman who is practical, logical, and focuses on what is."
  },
  {
    term: "Idealist",
    definition: "A woman who is romantic, imaginative, and focuses on what could be."
  },
  {
    term: "ETS",
    definition: "Emotional Tension Sequence: The specific sequence of emotions a woman needs to feel to become devoted (Intrigue, Arousal, Comfort, Devotion)."
  },
  {
    term: "Emotional Tension Sequence",
    definition: "The specific sequence of emotions a woman needs to feel to become devoted. The four emotions are Intrigue, Arousal, Comfort, and Devotion."
  },
  {
    term: "Intrigue",
    definition: "Curiosity and interest. Making her wonder about you and want to know more."
  },
  {
    term: "Arousal",
    definition: "Sexual tension and physical attraction. The feeling of being turned on."
  },
  {
    term: "Comfort",
    definition: "Emotional safety and trust. The feeling that she can be herself around you."
  },
  {
    term: "Devotion",
    definition: "Deep loyalty and commitment. The feeling that she wants to be with you long-term."
  },
  {
    term: "The Us-Frame",
    definition: "Framing the interaction as 'you and me against the world'. Creating a shared reality and a sense of partnership."
  },
  {
    term: "Us-Frame",
    definition: "Framing the interaction as 'you and me against the world'. Creating a shared reality and a sense of partnership."
  },
  {
    term: "Cold Read",
    definition: "Making an educated guess about her personality or background based on her appearance or behavior. Used to build intrigue and connection."
  },
  {
    term: "Fractionation",
    definition: "Alternating between different emotional states (e.g., serious and playful, or arousing and comforting) to build emotional depth and tension."
  },
  {
    term: "Compliance",
    definition: "Getting her to agree to small requests or follow your lead. A key indicator of interest and investment."
  },
  {
    term: "Inner Process Language",
    definition: "Speaking in a way that describes your internal thoughts, feelings, and motivations, rather than just facts. Used to connect with Idealists and build deep rapport."
  }
];

// Sort terms by length descending to match longer phrases first (e.g., "Emotional Tension Sequence" before "ETS")
const sortedTerms = [...glossaryTerms].sort((a, b) => b.term.length - a.term.length);

interface GlossaryTextProps {
  text: string;
}

export default function GlossaryText({ text }: GlossaryTextProps) {
  // Create a regex that matches any of the terms, word boundaries
  const termsRegex = new RegExp(`\\b(${sortedTerms.map(t => t.term).join('|')})\\b`, 'gi');

  const parts = text.split(termsRegex);

  return (
    <>
      {parts.map((part, i) => {
        const matchedTerm = sortedTerms.find(t => t.term.toLowerCase() === part.toLowerCase());
        if (matchedTerm) {
          return (
            <Tooltip key={i} term={matchedTerm.term} definition={matchedTerm.definition}>
              {part}
            </Tooltip>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}
