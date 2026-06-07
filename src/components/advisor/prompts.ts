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
      'How should I approach this situation?',
      'What are her likely intentions?',
      'What red flags should I watch for?',
    ],
  },
  {
    title: 'Build connection',
    description: 'Move things forward',
    prompts: [
      'How to escalate safely?',
      'Building emotional connection',
      'Reading body language cues',
    ],
  },
  {
    title: 'Self & strategy',
    description: 'Sharpen your own game',
    prompts: [
      'How can I improve my calibration?',
      'What does my personality type mean?',
      'How to handle rejection?',
      'When to walk away?',
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
