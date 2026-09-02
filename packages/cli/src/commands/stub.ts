import { EXIT } from '../exit-codes.js';

export function stub(name: string, task: string): () => void {
  return () => {
    process.stderr.write(`${name} 尚未实现（规划于需求 ${task}）\n`);
    process.exitCode = EXIT.RUNTIME;
  };
}
