import { iterationSystemPrompt, iterationUserPrompt, systemPrompt, userPrompt } from '../prompt.js';
import { ProviderAuthError } from './errors.js';
import { parseProviderJson } from './parse-json.js';

function extractOpenAICompatibleText(json) {
  return (json.choices ?? [])
    .map((choice) => choice.message?.content)
    .filter(Boolean)
    .join('\n')
    .trim();
}

export class OpenAICompatibleProvider {
  constructor({ name, apiKey, model, baseUrl }) {
    this.name = name;
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl;
  }

  async requestJson(systemText, userText) {
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemText },
          { role: 'user', content: userText }
        ]
      })
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new ProviderAuthError(`${this.name} API key was rejected.`);
      }
      throw new Error(`${this.name} request failed: ${res.status} ${await res.text()}`);
    }

    const json = await res.json();
    const text = extractOpenAICompatibleText(json);
    if (!text) {
      throw new Error(`${this.name} response missing JSON text`);
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
