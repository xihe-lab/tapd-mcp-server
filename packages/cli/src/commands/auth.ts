import type { Command } from 'commander';
import { stub } from './stub.js';

export function registerAuthCommand(ensureResource: (resource: string) => Command): void {
  const auth = ensureResource('auth');
  auth.command('status').description('查看认证状态').action(stub('td auth status', '1283'));
}
