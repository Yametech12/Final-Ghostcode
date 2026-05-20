import { DEFAULT_MODEL, createCompletion, createStreamingCompletion } from './_config.js';

export const AI_PROVIDER = DEFAULT_MODEL;
export const API_URL = 'https://api.regolo.ai/v1/chat/completions';
export { createCompletion, createStreamingCompletion };
