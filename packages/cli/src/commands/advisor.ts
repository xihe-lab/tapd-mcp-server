import type { Command } from 'commander';
import { stub } from './stub.js';

export function registerAdvisorCommand(program: Command): void {
  const advisor = program.command('advisor').description('自然语言命令推荐');
  advisor.argument('<query...>', '想完成的操作描述').action(stub('td advisor', '1286'));
}
