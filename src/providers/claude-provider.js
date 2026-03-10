import { iterationSystemPrompt, iterationUserPrompt, systemPrompt, userPrompt } from '../prompt.js';
import { ProviderAuthError } from './errors.js';
import { parseProviderJson } from './parse-json.js';

function extractClaudeText(json) {
  return (json.content ?? [])
    .filter((item) => item.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text)
    .join('\n')
    .trim();
}

export class ClaudeProvider {
  constructor(apiKey, model = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-latest') {
    this.name = 'claude';
    this.apiKey = apiKey;
    this.model = model;
  }

  async requestJson(systemText, userText) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1800,
        system: systemText,
        messages: [{ role: 'user', content: userText }]
      })
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new ProviderAuthError('Anthropic API key was rejected.');
      }
      throw new Error(`Claude request failed: ${res.status} ${await res.text()}`);
    }

    const json = await res.json();
    const text = extractClaudeText(json);
    if (!text) {
      throw new Error('Claude response missing JSON text');
    }
    return parseProviderJson(text);
  }

  async evaluate(input) {
    return await this.requestJson(systemPrompt(), userPrompt(input));
  }

  async iterate(input) {
    return await this.requestJson(iterationSystemPrompt(), iterationUserPrompt(input));
  }
}
