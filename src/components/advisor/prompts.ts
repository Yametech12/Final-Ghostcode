/**
 * Suggested prompts shown in the empty state and as follow-up chips.
 * Grouped so the empty state can render them as categories.
 */

export interface PromptCategory {
  title: string;
  description: string;
  prompts: string[];
}

export const promptCategories: PromptCategory[] = [
  {
    title: 'Read the situation',
    description: 'Make sense of a specific moment',
    prompts: [
      'She laughed at my joke but looked away. What does that mean?',
      "She keeps texting but won't commit to plans. What should I do?",
      'What red flags should I watch for in early dating?',
    ],
  },
  {
    title: 'Build connection',
    description: 'Move things forward',
    prompts: [
      'How do I escalate from texting to asking her out?',
      'She seems interested but distant. How do I build trust?',
      "What's a good first date that reveals compatibility?",
    ],
  },
  {
    title: 'Self & strategy',
    description: 'Sharpen your own game',
    prompts: [
      'How can I improve my calibration skills?',
      'What does my personality type mean for dating?',
      'How do I handle rejection without losing confidence?',
    ],
  },
];

export const followUpSuggestions: string[] = [
  'Give me a specific example',
  'What should I say to her?',
  'How do I escalate this?',
  'What does my personality type say about this?',
  'What are the red flags here?',
  'When should I walk away?',
];
