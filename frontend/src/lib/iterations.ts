import type {
  Message,
  ModelIteration,
  Parameter,
  ParameterSchema,
} from '@/types';

/**
 * Attach stored versions to the chat messages that spawned them.
 * Versions are grouped by `messageOrder` and ordered newest-first. A message
 * keeps any live `rootHashes` it already has (an upload may still be running)
 * and otherwise borrows the newest complete version's hashes.
 */
export function attachIterationsToMessages(
  messages: Message[],
  iterations: ModelIteration[],
): Message[] {
  if (iterations.length === 0) {
    return messages.map((m) => (m.messageOrder === undefined ? m : { ...m, iterations: [] }));
  }

  // Anchored versions (post-v7) match the assistant message by its exact
  // persisted order. Legacy versions (no `message_id`) were numbered by the
  // collapsed turn index, which no longer equals the array index once a chat
  // is re-saved 1:1, so they attach by turn ordinal instead.
  const anchoredByOrder = new Map<number, ModelIteration[]>();
  const legacyByTurn = new Map<number, ModelIteration[]>();
  for (const iteration of iterations) {
    const bucket = iteration.messageId ? anchoredByOrder : legacyByTurn;
    const key = iteration.messageOrder;
    const list = bucket.get(key);
    if (list) list.push(iteration);
    else bucket.set(key, [iteration]);
  }
  for (const list of anchoredByOrder.values()) list.sort((a, b) => b.version - a.version);
  for (const list of legacyByTurn.values()) list.sort((a, b) => b.version - a.version);

  // Ordinal of the model turn (clarification cards and error bubbles are not
  // turns that can own a stored version).
  let turnOrdinal = -1;

  return messages.map((message, index) => {
    if (message.role !== "assistant") return message;
    if (message.clarification || message.error) return message;

    turnOrdinal += 1;
    const order = message.messageOrder ?? index;
    const anchored = anchoredByOrder.get(order) ?? [];
    const legacy = legacyByTurn.get(turnOrdinal) ?? [];

    if (anchored.length === 0 && legacy.length === 0) return message;

    const versions = [...anchored, ...legacy].sort((a, b) => b.version - a.version);
    const active = pickActiveIteration(versions);
    return {
      ...message,
      messageOrder: order,
      iterations: versions,
      rootHashes: message.rootHashes ?? active?.rootHashes,
    };
  });
}

/** Newest complete version, falling back to the newest row. */
export function pickActiveIteration(versions: ModelIteration[]): ModelIteration | null {
  if (versions.length === 0) return null;

  const complete = versions
    .filter((v) => v.uploadStatus === 'complete')
    .sort((a, b) => b.version - a.version);
  if (complete.length > 0) return complete[0];

  return [...versions].sort((a, b) => b.version - a.version)[0] ?? null;
}

/**
 * Parameters are stored either as a schema map (current) or the legacy
 * `Parameter[]` shape. Normalise to the schema map the panels expect.
 */
export function normalizeParameters(
  parameters: Record<string, ParameterSchema> | Parameter[] | null | undefined,
): Record<string, ParameterSchema> {
  if (!parameters) return {};
  if (Array.isArray(parameters)) {
    const out: Record<string, ParameterSchema> = {};
    for (const p of parameters) {
      out[p.name] = {
        type: 'float',
        default: p.default,
        min: p.min,
        max: p.max,
        step: p.step,
      };
    }
    return out;
  }
  return parameters;
}

export function parameterDefaults(
  parameters: Record<string, ParameterSchema>,
): Record<string, number> {
  const values: Record<string, number> = {};
  for (const [name, schema] of Object.entries(parameters)) {
    if (typeof schema.default === 'number') values[name] = schema.default;
  }
  return values;
}
