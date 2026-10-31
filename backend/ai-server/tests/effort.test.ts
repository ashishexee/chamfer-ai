import { describe, expect, it } from 'vitest';
import {
  isEffortRejection,
  isMaxTokensRejection,
  lowerReasoningEffort,
} from '../src/services/llm';

describe('lowerReasoningEffort', () => {
  it('walks the ladder down one rung', () => {
    expect(lowerReasoningEffort('max')).toBe('xhigh');
    expect(lowerReasoningEffort('xhigh')).toBe('high');
    expect(lowerReasoningEffort('high')).toBe('medium');
    expect(lowerReasoningEffort('medium')).toBe('low');
    expect(lowerReasoningEffort('low')).toBe('minimal');
  });

  it('stops at the bottom and ignores non-ladder levels', () => {
    expect(lowerReasoningEffort('minimal')).toBeUndefined();
    expect(lowerReasoningEffort('none')).toBeUndefined();
    expect(lowerReasoningEffort('adaptive')).toBeUndefined();
    expect(lowerReasoningEffort(undefined)).toBeUndefined();
  });
});

describe('isEffortRejection', () => {
  it('detects a 400/422 that names reasoning effort', () => {
    expect(
      isEffortRejection(
        { status: 400, message: "Unsupported value: 'max' for reasoning_effort" },
        'max',
      ),
    ).toBe(true);
    expect(isEffortRejection({ status: 422, param: 'reasoning_effort' }, 'max')).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isEffortRejection({ status: 400, message: 'bad prompt' }, 'max')).toBe(false);
    expect(isEffortRejection({ status: 500, message: 'reasoning failed' }, 'max')).toBe(false);
    expect(isEffortRejection({ status: 400, message: 'reasoning_effort' }, undefined)).toBe(false);
  });
});

describe('isMaxTokensRejection', () => {
  it('detects max_tokens / max_completion_tokens rejections', () => {
    expect(
      isMaxTokensRejection({ status: 400, message: "Unsupported parameter: 'max_tokens'" }),
    ).toBe(true);
    expect(isMaxTokensRejection({ status: 400, param: 'max_completion_tokens' })).toBe(true);
  });

  it('ignores other failures', () => {
    expect(isMaxTokensRejection({ status: 500, message: 'max_tokens' })).toBe(false);
    expect(isMaxTokensRejection({ status: 400, message: 'bad prompt' })).toBe(false);
  });
});
