import { describe, expect, it } from 'vitest';
import {
  canRestoreIteration,
  planRewind,
  type IterationRowLike,
} from '../src/lib/iterations';

function row(
  version: number,
  message_order: number,
  upload_status: IterationRowLike['upload_status'] = 'complete',
  id = `m${version}`,
): IterationRowLike {
  return {
    id,
    chat_session_id: 's1',
    message_order,
    version,
    upload_status,
  };
}

describe('canRestoreIteration', () => {
  it('allows only completed uploads', () => {
    expect(canRestoreIteration({ upload_status: 'complete' })).toBe(true);
    expect(canRestoreIteration({ upload_status: 'pending' })).toBe(false);
    expect(canRestoreIteration({ upload_status: 'failed' })).toBe(false);
  });
});

describe('planRewind', () => {
  it('deletes only versions newer than the target', () => {
    const rows = [row(5, 4), row(4, 3), row(3, 2), row(2, 1), row(1, 0)];
    const plan = planRewind(rows, rows[2]);

    expect(plan.deletedVersions).toEqual([4, 5]);
    expect(plan.trimMessagesAfter).toBe(2);
    expect(plan.targetVersion).toBe(3);
  });

  it('is a no-op when rewinding to the newest version', () => {
    const rows = [row(3, 2), row(2, 1), row(1, 0)];
    const plan = planRewind(rows, rows[0]);

    expect(plan.deletedVersions).toEqual([]);
    expect(plan.trimMessagesAfter).toBe(2);
  });

  it('keeps same-turn versions older than the target', () => {
    // v4 and v3 are param tweaks on turn 2; rewinding to v3 keeps v3.
    const rows = [row(4, 2), row(3, 2), row(2, 1), row(1, 0)];
    const plan = planRewind(rows, rows[1]);

    expect(plan.deletedVersions).toEqual([4]);
    expect(plan.trimMessagesAfter).toBe(2);
  });
});
