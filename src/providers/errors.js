export class ProviderAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProviderAuthError';
  }
}
