import type { Command } from 'commander';
import { stub } from './stub.js';

export function registerConfigCommand(program: Command): void {
  const config = program.command('config').description('TAPD 本地配置管理');
  config.command('show').description('查看当前生效配置').action(stub('td config show', '1283'));
  config.command('set').description('设置配置项').argument('<items...>', 'key=value 列表').action(stub('td config set', '1283'));
  config.command('export-schema').description('导出工具 schema（anthropic / openai 格式）').action(stub('td config export-schema', '1285'));
}
