import { systemPrompt, userPrompt } from '../prompt.js';
import { ProviderAuthError } from './errors.js';
import { parseProviderJson } from './parse-json.js';

function extractGeminiText(json) {
  return (json.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text)
    .filter(Boolean)
    .join('\n')
    .trim();
}

export class GeminiProvider {
  constructor(apiKey, model = process.env.GEMINI_MODEL || 'gemini-2.0-flash') {
    this.name = 'gemini';
    this.apiKey = apiKey;
    this.model = model;
  }

  async evaluate(input) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt() }]
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt(input) }]
          }
        ]
      })
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new ProviderAuthError('Gemini API key was rejected.');
      }
      throw new Error(`Gemini request failed: ${res.status} ${await res.text()}`);
    }

    const json = await res.json();
    const text = extractGeminiText(json);
    if (!text) {
      throw new Error('Gemini response missing JSON text');
    }
    return parseProviderJson(text);
  }
}
