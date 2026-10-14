/** Runs code-runner reference solutions against their tests (filled in with the code-runner type). */
export interface CodeIssue {
  level: 'error' | 'warning';
  message: string;
}

export function runCodeChecks(_config: unknown, _solution: unknown): CodeIssue[] {
  return [];
}
