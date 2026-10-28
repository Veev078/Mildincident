export class HandoffError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = 'HandoffError';
    this.code = code;
  }
}

export function requireThat(condition, code, message) {
  if (!condition) throw new HandoffError(code, message);
}
