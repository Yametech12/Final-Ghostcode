// Advanced calibration analysis with personality type determination
export interface CalibrationResult {
  primaryType: string;
  confidence: number;
  secondaryType?: string;
  traits: {
    timeOrientation: number; // Tester (T) vs Investor (N)
    emotionalStyle: number; // Denier (D) vs Justifier (J)
    relationshipFocus: number; // Realist (R) vs Idealist (I)
  };
  analysis: string;
  recommendations: string[];
  strengths: string[];
  growthAreas: string[];
}

export function analyzeCalibrationAnswers(answers: Record<string, any>): CalibrationResult {
  // Time Orientation (Tester vs Investor)
  let timeScore = 0;
  if (answers.time_orientation?.includes('observe') || answers.time_orientation?.includes('carefully')) timeScore += 2;
  if (answers.social_style?.includes('quiet') || answers.social_style?.includes('observer')) timeScore += 2;
  if (answers.conflict_response?.includes('withdraw') || answers.conflict_response?.includes('process internally')) timeScore += 2;

  // Emotional Expression (Denier vs Justifier)
  let emotionalScore = 0;
  if ((answers.emotional_expression || 0) < 5) emotionalScore += 2;
  if ((answers.vulnerability_level || 0) < 5) emotionalScore += 2;
  if (answers.boundary_setting?.includes('distant') || answers.boundary_setting?.includes('create space')) emotionalScore += 2;

  // Relationship Focus (Realist vs Idealist)
  let relationshipScore = 0;
  if (answers.relationship_goals?.includes('stability') || answers.relationship_goals?.includes('respect')) relationshipScore += 2;
  if (answers.future_orientation?.includes('stable') || answers.future_orientation?.includes('security')) relationshipScore += 2;
  if (answers.power_dynamics?.includes('equality') || answers.power_dynamics?.includes('mutual')) relationshipScore += 2;

  // Normalize scores to 0-100 range
  const timeOrientation = Math.min(100, (timeScore / 6) * 100);
  const emotionalStyle = Math.min(100, (emotionalScore / 6) * 100);
  const relationshipFocus = Math.min(100, (relationshipScore / 6) * 100);

  // Determine personality type
  const timeAxis = timeOrientation > 50 ? 'T' : 'N';
  const sexAxis = emotionalStyle > 50 ? 'D' : 'J';
  const relationshipAxis = relationshipFocus > 50 ? 'R' : 'I';

  const primaryType = `${timeAxis}${sexAxis}${relationshipAxis}`;
  const confidence = Math.round((Math.abs(timeOrientation - 50) + Math.abs(emotionalStyle - 50) + Math.abs(relationshipFocus - 50)) / 3);

  // Generate analysis and recommendations
  const { analysis, recommendations, strengths, growthAreas } = generatePersonalityInsights(primaryType);

  return {
    primaryType,
    confidence,
    traits: {
      timeOrientation,
      emotionalStyle,
      relationshipFocus
    },
    analysis,
    recommendations,
    strengths,
    growthAreas
  };
}

function generatePersonalityInsights(type: string) {
  const insights = {
    TDI: {
      analysis: "You embody the classic Tester-Denier-Idealist pattern. You're naturally cautious, value emotional depth, and seek meaningful connections. Your approach combines patience with high standards.",
      strengths: ["Emotional intelligence", "Long-term relationship focus", "High standards for partners"],
      growthAreas: ["Opening up faster", "Expressing needs clearly", "Balancing caution with action"],
      recommendations: [
        "Practice being more vulnerable in safe environments",
        "Focus on building trust through consistent small actions",
        "Learn to recognize when your standards are serving you vs holding you back"
      ]
    },
    TJI: {
      analysis: "You're a Tester-Justifier-Idealist - energetic, expressive, and seeking the fairy tale. You bring excitement and passion to relationships while maintaining high romantic ideals.",
      strengths: ["Social energy", "Romantic vision", "Expressive communication"],
      growthAreas: ["Emotional boundaries", "Practical relationship skills", "Patience in development"],
      recommendations: [
        "Balance your enthusiasm with listening and observation",
        "Develop practical relationship skills alongside your romantic vision",
        "Learn to maintain excitement without overwhelming others"
      ]
    },
    TDR: {
      analysis: "As a Tester-Denier-Realist, you combine patience with practicality. You value stability, clear communication, and mutual respect in relationships.",
      strengths: ["Practical approach", "Clear communication", "Emotional stability"],
      growthAreas: ["Romantic expression", "Emotional vulnerability", "Breaking routine"],
      recommendations: [
        "Practice expressing romantic feelings more openly",
        "Learn to embrace spontaneity alongside your practical nature",
        "Focus on building emotional intimacy through shared experiences"
      ]
    },
    TJR: {
      analysis: "You're a Tester-Justifier-Realist - direct, practical, and action-oriented. You value honesty, clear boundaries, and real-world relationship dynamics.",
      strengths: ["Direct communication", "Practical problem-solving", "Honesty and integrity"],
      growthAreas: ["Emotional expression", "Romantic gestures", "Patience with emotions"],
      recommendations: [
        "Learn to balance directness with emotional sensitivity",
        "Practice romantic gestures to show affection",
        "Develop patience for emotional processing in relationships"
      ]
    },
    NDI: {
      analysis: "As an Investor-Denier-Idealist, you invest deeply but cautiously. You seek meaningful connections and have high romantic ideals tempered by careful consideration.",
      strengths: ["Deep emotional investment", "Romantic vision", "Thoughtful approach"],
      growthAreas: ["Action orientation", "Expressing investment", "Overcoming hesitation"],
      recommendations: [
        "Balance careful consideration with decisive action",
        "Practice expressing your romantic feelings more openly",
        "Learn to trust your instincts while maintaining discernment"
      ]
    },
    NJI: {
      analysis: "You're an Investor-Justifier-Idealist - the classic romantic dreamer. You invest enthusiastically and seek the fairy tale ending with passion and commitment.",
      strengths: ["Romantic passion", "Deep investment", "Visionary thinking"],
      growthAreas: ["Practical considerations", "Emotional boundaries", "Reality checking"],
      recommendations: [
        "Balance romantic vision with practical relationship realities",
        "Develop healthy emotional boundaries alongside your passion",
        "Learn to assess compatibility alongside chemistry"
      ]
    },
    NDR: {
      analysis: "As an Investor-Denier-Realist, you combine deep investment with practicality. You value stability, mutual respect, and long-term relationship building.",
      strengths: ["Practical investment", "Emotional stability", "Long-term focus"],
      growthAreas: ["Romantic expression", "Breaking routine", "Expressing needs"],
      recommendations: [
        "Learn to express romantic feelings more openly",
        "Practice spontaneity alongside your practical nature",
        "Focus on communicating your emotional needs clearly"
      ]
    },
    NJR: {
      analysis: "You're an Investor-Justifier-Realist - practical, honest, and committed. You invest deeply in relationships while maintaining clear boundaries and realistic expectations.",
      strengths: ["Honest communication", "Practical commitment", "Clear boundaries"],
      growthAreas: ["Romantic gestures", "Emotional expression", "Flexibility"],
      recommendations: [
        "Balance practical approach with romantic gestures",
        "Practice expressing emotions alongside clear communication",
        "Learn to be flexible while maintaining your standards"
      ]
    }
  };

  return insights[type as keyof typeof insights] || {
    analysis: "Your personality profile shows a unique combination of traits. Focus on understanding your core values and communication style.",
    strengths: ["Self-awareness", "Individual approach", "Unique perspective"],
    growthAreas: ["Type-specific strategies", "Pattern recognition", "Strategy refinement"],
    recommendations: [
      "Study the EPIMETHEUS framework more deeply",
      "Track patterns in your relationship experiences",
      "Consider working with a relationship coach"
    ]
  };
}
