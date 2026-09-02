import type { CliErrorCode } from '@xihe-lab/tapd-core';
import { EXIT } from './exit-codes.js';

export class CliError extends Error {
  constructor(
    public readonly code: CliErrorCode,
    message: string,
  ) {
    super(message);
  }

  get exitCode(): number {
    return this.code === 'INVALID_ARGS' ? EXIT.USAGE : EXIT.RUNTIME;
  }

  render(): string {
    if (this.code !== 'INVALID_ARGS') {
      return `error: ${this.code}: ${this.message}`;
    }
    const pretty = this.message.replace(
      /(^|[;\s])([a-z0-9_]+):/g,
      (_match, prefix: string, field: string) => `${prefix}--${field.replaceAll('_', '-')}:`,
    );
    return `error: ${this.code}: ${pretty}`;
  }
}
