import { ClaudeProvider } from './claude-provider.js';
import { GeminiProvider } from './gemini-provider.js';
import { MockProvider } from './mock-provider.js';
import { OpenAIProvider } from './openai-provider.js';
import { OpenAICompatibleProvider } from './openai-compatible-provider.js';

export const providerNames = ['mock', 'openai', 'gemini', 'claude', 'groq', 'grok'];

export function buildProvider(name, modelOverride) {
  if (name === 'mock') {
    return new MockProvider();
  }

  if (name === 'openai') {
    if (!process.env.OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');
    return new OpenAIProvider(process.env.OPENAI_API_KEY, modelOverride || process.env.OPENAI_MODEL);
  }

  if (name === 'gemini') {
    if (!process.env.GEMINI_API_KEY) throw new Error('Missing GEMINI_API_KEY');
    return new GeminiProvider(process.env.GEMINI_API_KEY, modelOverride || process.env.GEMINI_MODEL);
  }

  if (name === 'claude') {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('Missing ANTHROPIC_API_KEY');
    return new ClaudeProvider(process.env.ANTHROPIC_API_KEY, modelOverride || process.env.CLAUDE_MODEL);
  }

  if (name === 'groq') {
    if (!process.env.GROQ_API_KEY) throw new Error('Missing GROQ_API_KEY');
    return new OpenAICompatibleProvider({
      name: 'groq',
      apiKey: process.env.GROQ_API_KEY,
      model: modelOverride || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      baseUrl: 'https://api.groq.com/openai/v1/chat/completions'
    });
  }

  if (name === 'grok') {
    if (!process.env.XAI_API_KEY) throw new Error('Missing XAI_API_KEY');
    return new OpenAICompatibleProvider({
      name: 'grok',
      apiKey: process.env.XAI_API_KEY,
      model: modelOverride || process.env.GROK_MODEL || 'grok-2-latest',
      baseUrl: 'https://api.x.ai/v1/chat/completions'
    });
  }

  throw new Error(`Unsupported provider: ${name}`);
}
