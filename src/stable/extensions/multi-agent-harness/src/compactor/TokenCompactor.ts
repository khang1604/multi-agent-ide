/**
 * Token Compactor & Stream Cleaner for Terminal & Build Outputs
 * Spec: docs/architecture/10_context_compaction_and_token_management.md
 * Phase 3 of docs/AGENT_FIRST_TRANSFORMATION_PLAN.md
 */

export class TokenCompactor {
  // Regex to strip ANSI escape codes
  private static readonly ANSI_REGEX = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

  // Patterns indicating critical errors, stack traces, or failures
  private static readonly ERROR_PATTERNS = [
    /(?:FAIL|ERROR|FATAL|Exception|Traceback|AssertionError|assert\s)/i,
    /^\s*at\s+.*\(.*:\d+:\d+\)/,
    /^\s*File\s+".*",\s+line\s+\d+/,
    /error\[E\d+\]:/,
    /:\d+:\d+:\s+error:/
  ];

  public static stripAnsi(text: string): string {
    if (!text) return '';
    return text.replace(TokenCompactor.ANSI_REGEX, '');
  }

  public static compressOutput(raw: string, maxLines = 60): string {
    const clean = TokenCompactor.stripAnsi(raw);
    const lines = clean.split(/\r?\n/);

    if (lines.length <= maxLines) {
      return lines.join('\n');
    }

    const failureIndices = new Set<number>();
    lines.forEach((line, idx) => {
      if (TokenCompactor.ERROR_PATTERNS.some((pat) => pat.test(line))) {
        for (let ctx = Math.max(0, idx - 1); ctx <= Math.min(lines.length - 1, idx + 2); ctx++) {
          failureIndices.add(ctx);
        }
      }
    });

    if (failureIndices.size === 0) {
      const head = lines.slice(0, 15);
      const tail = lines.slice(-15);
      const elided = lines.length - 30;
      return `${head.join('\n')}\n\n... [${elided} lines of progress elided for context efficiency] ...\n\n${tail.join('\n')}`;
    }

    const sorted = Array.from(failureIndices).sort((a, b) => a - b);
    const resultLines: string[] = [];
    if (sorted.length > 0 && sorted[0] > 0) {
      resultLines.push(`... [${sorted[0]} lines elided for context efficiency] ...`);
    }

    let lastIdx = sorted.length > 0 ? sorted[0] : -1;

    for (const idx of sorted.slice(0, maxLines)) {
      if (lastIdx !== -1 && idx > lastIdx + 1) {
        resultLines.push(`... [${idx - lastIdx - 1} passing lines elided] ...`);
      }
      resultLines.push(lines[idx]);
      lastIdx = idx;
    }

    const tailSummary = lines.slice(-3);
    return `${resultLines.join('\n')}\n\n${tailSummary.join('\n')}`;
  }
}
