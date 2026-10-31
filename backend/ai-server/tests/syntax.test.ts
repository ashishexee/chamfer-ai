import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  classifyError,
  fastSyntaxCheck,
  formatPythonSyntaxError,
} from '../src/services/llm';

describe('formatPythonSyntaxError', () => {
  it('keeps the parser message, line, column, source line and caret', () => {
    const detail = formatPythonSyntaxError({
      msg: "'(' was never closed",
      line: 2,
      offset: 10,
      text: 'result = (\n',
    });

    expect(detail).toContain("Python SyntaxError: '(' was never closed");
    expect(detail).toContain('Line 2, column 10');
    expect(detail).toContain('result = (');
    expect(detail).toContain('^');
  });

  it('degrades to the message when Python gives no position', () => {
    const detail = formatPythonSyntaxError({ msg: 'invalid syntax' });
    expect(detail).toBe('Python SyntaxError: invalid syntax');
  });
});

describe('classifyError syntax detection', () => {
  it('recognises both spellings and indentation failures', () => {
    expect(classifyError("Python SyntaxError: '(' was never closed").category).toBe('SYNTAX');
    expect(classifyError('Syntax error: invalid syntax').category).toBe('SYNTAX');
    expect(classifyError('IndentationError: expected an indented block').category).toBe('SYNTAX');
  });

  it('does not classify a syntax error as UNKNOWN', () => {
    expect(classifyError('Syntax error: Traceback (most recent call last):').category).toBe('SYNTAX');
  });
});

// The checker shells out to Python. Skip the integration tests where Python
// is not installed (the production container always has python3).
const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
const hasPython = (() => {
  try {
    return spawnSync(pythonCmd, ['-I', '-c', 'import ast'], { timeout: 5000 }).status === 0;
  } catch {
    return false;
  }
})();

describe.skipIf(!hasPython)('fastSyntaxCheck', () => {
  it('returns the real error instead of a bare traceback header', async () => {
    const result = await fastSyntaxCheck('result = (\n');

    expect(result.valid).toBe(false);
    expect(result.error).toContain("'(' was never closed");
    expect(result.error).toContain('Line 1');
    expect(result.error).toContain('result = (');
    expect(result.error).toContain('^');
    expect(result.error).not.toContain('Traceback');
  });

  it('accepts triple-single-quoted docstrings without corrupting them', async () => {
    const code = "'''module docstring'''\nresult = [1, 2, 3]\n";
    const result = await fastSyntaxCheck(code);
    expect(result).toEqual({ valid: true });
  });

  it('accepts backslashes in string literals', async () => {
    const code = "path = 'C:\\\\temp\\\\part.stl'\nresult = [path]\n";
    const result = await fastSyntaxCheck(code);
    expect(result).toEqual({ valid: true });
  });

  it('accepts scripts larger than the Windows command-line limit', async () => {
    const body = Array.from({ length: 5000 }, (_, i) => `    ${i},`).join('\n');
    const code = `values = [\n${body}\n]\nresult = values\n`;
    expect(code.length).toBeGreaterThan(32_000);

    const result = await fastSyntaxCheck(code);
    expect(result).toEqual({ valid: true });
  });
});
