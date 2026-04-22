import { Question } from '../components/CalibrationWizard';

export const personalityAssessmentQuestions: Question[] = [
  {
    id: 'time_orientation',
    text: 'How do you typically approach new romantic interests?',
    type: 'multiple',
    options: [
      'I take my time and observe carefully before making moves',
      'I jump in quickly with enthusiasm and energy',
      'I prefer to keep things practical and low-pressure',
      'I wait for clear signs before investing time'
    ]
  },
  {
    id: 'emotional_expression',
    text: 'When meeting someone new, how comfortable are you expressing your emotions?',
    type: 'slider',
    min: 0,
    max: 10,
    step: 1
  },
  {
    id: 'social_style',
    text: 'In social situations, you tend to be:',
    type: 'multiple',
    options: [
      'Quiet and observant, preferring deep conversations',
      'The center of attention, energizing the room',
      'Practical and focused on shared activities',
      'Reserved but open to meaningful connections'
    ]
  },
  {
    id: 'relationship_goals',
    text: 'What matters most to you in a relationship?',
    type: 'multiple',
    options: [
      'Emotional depth and long-term commitment',
      'Fun, excitement, and shared adventures',
      'Stability, trust, and mutual respect',
      'Personal growth and understanding'
    ]
  },
  {
    id: 'conflict_response',
    text: 'When faced with relationship challenges, your first instinct is to:',
    type: 'multiple',
    options: [
      'Withdraw and process internally',
      'Address it directly with humor or confrontation',
      'Find practical solutions and compromises',
      'Seek deeper understanding of underlying issues'
    ]
  },
  {
    id: 'intimacy_style',
    text: 'How do you prefer to build intimacy?',
    type: 'slider',
    min: 0,
    max: 10,
    step: 1
  },
  {
    id: 'decision_making',
    text: 'In important relationship decisions, you rely most on:',
    type: 'multiple',
    options: [
      'Your intuition and feelings',
      'Logic and practical considerations',
      'Input from trusted friends/family',
      'Careful analysis of all options'
    ]
  },
  {
    id: 'vulnerability_level',
    text: 'How comfortable are you being vulnerable with a partner?',
    type: 'slider',
    min: 0,
    max: 10,
    step: 1
  },
  {
    id: 'future_orientation',
    text: 'When thinking about relationships, you focus most on:',
    type: 'multiple',
    options: [
      'Building a fairy-tale future together',
      'Making the most of the present moment',
      'Creating stable, long-term security',
      'Personal and mutual growth'
    ]
  },
  {
    id: 'communication_style',
    text: 'Your communication style in relationships tends to be:',
    type: 'multiple',
    options: [
      'Indirect and subtle, requiring interpretation',
      'Direct and enthusiastic, very expressive',
      'Clear and practical, focused on solutions',
      'Thoughtful and introspective, seeking meaning'
    ]
  }
];

export const situationalAssessmentQuestions: Question[] = [
  {
    id: 'first_meeting',
    text: 'At a social event, you notice someone attractive. What\'s your typical approach?',
    type: 'multiple',
    options: [
      'Observe from afar, wait for the right moment',
      'Approach confidently with a fun opener',
      'Find a mutual friend to make an introduction',
      'Engage in group conversation first'
    ]
  },
  {
    id: 'texting_habits',
    text: 'When texting someone you\'re interested in, you usually:',
    type: 'multiple',
    options: [
      'Keep responses brief and mysterious',
      'Send frequent, enthusiastic messages',
      'Respond thoughtfully when you have time',
      'Match their energy and style'
    ]
  },
  {
    id: 'boundary_setting',
    text: 'How do you typically handle unwanted advances?',
    type: 'multiple',
    options: [
      'Politely but firmly set boundaries',
      'Use humor to deflect and redirect',
      'Become distant and create space',
      'Address it directly and clearly'
    ]
  },
  {
    id: 'date_planning',
    text: 'For a first date, you prefer:',
    type: 'multiple',
    options: [
      'Something low-key and conversational',
      'An exciting activity or adventure',
      'A classic dinner or planned outing',
      'Something spontaneous and unplanned'
    ]
  }
];

export const relationshipDynamicsQuestions: Question[] = [
  {
    id: 'power_dynamics',
    text: 'In relationships, you feel most comfortable when:',
    type: 'multiple',
    options: [
      'There\'s mutual respect and equality',
      'You can take charge and lead',
      'Your partner takes initiative',
      'Power dynamics shift naturally'
    ]
  },
  {
    id: 'attachment_style',
    text: 'How would you describe your attachment style?',
    type: 'multiple',
    options: [
      'Secure - comfortable with intimacy and independence',
      'Anxious - need reassurance and closeness',
      'Avoidant - value independence over closeness',
      'Disorganized - mixed feelings about relationships'
    ]
  },
  {
    id: 'conflict_resolution',
    text: 'During disagreements, you prefer to:',
    type: 'multiple',
    options: [
      'Discuss feelings and find emotional resolution',
      'Use humor to lighten the mood',
      'Focus on practical solutions',
      'Take time apart to process'
    ]
  }
];

export const getAssessmentQuestions = (type: 'personality' | 'situational' | 'dynamics') => {
  switch (type) {
    case 'personality':
      return personalityAssessmentQuestions;
    case 'situational':
      return situationalAssessmentQuestions;
    case 'dynamics':
      return relationshipDynamicsQuestions;
    default:
      return personalityAssessmentQuestions;
  }
};
