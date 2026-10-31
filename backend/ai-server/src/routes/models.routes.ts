import express from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  saveModelMetadata,
  getSavedModels,
  getSavedModel,
  deleteSavedModel,
  createModelVersion,
  completeModelVersion,
  failModelVersion,
  listSessionIterations,
  getModelVersion,
  getLatestModelForSession,
  getChatSession,
  rewindToVersion,
  type ModelSource,
} from '../services/db';
import { uploadTo0G, fetchFrom0G } from '../services/zgStorage';
import { toIteration } from '../lib/serialize';

export const router = express.Router();

/** Decrypt and fetch every artifact for a version from 0G. */
async function fetchModelContents(row: Record<string, any>) {
  const [code, stlBase64, stepBase64, glbBase64, dimViewsJson] = await Promise.all([
    row.root_hash_code ? fetchFrom0G(row.root_hash_code, false) : Promise.resolve(undefined),
    row.root_hash_stl ? fetchFrom0G(row.root_hash_stl, true) : Promise.resolve(undefined),
    row.root_hash_step ? fetchFrom0G(row.root_hash_step, true) : Promise.resolve(undefined),
    row.root_hash_glb ? fetchFrom0G(row.root_hash_glb, true) : Promise.resolve(undefined),
    row.root_hash_dim_views ? fetchFrom0G(row.root_hash_dim_views, false) : Promise.resolve(undefined),
  ]);

  let dimViews: Record<string, string> | undefined;
  if (dimViewsJson) {
    try {
      dimViews = JSON.parse(dimViewsJson);
    } catch {
      console.error('[0G] Failed to parse dim views JSON from 0G');
    }
  }

  return {
    ...toIteration(row),
    code,
    stlBase64,
    stepBase64,
    glbBase64,
    // DB mirror is a fast fallback if the 0G JSON is missing/corrupt.
    dimViews: dimViews || (row.dim_views ?? undefined),
  };
}

/**
 * Upload one iteration: create the pending version row first (so the version
 * number is stable), then stream the five 0G uploads, then complete by id.
 */
router.post('/upload-to-0g', authMiddleware, async (req, res) => {
  try {
    const walletAddress = (req as any).walletAddress;
    const {
      chatSessionId,
      messageOrder,
      name,
      code,
      stlBase64,
      stepBase64,
      glbBase64,
      dimViews,
      snapshots,
      parameters,
      inspection,
      boundingBox,
      source,
      restoredFrom,
      messageId,
    } = req.body;

    const msgOrder = Number(messageOrder);
    if (
      !chatSessionId ||
      messageOrder === undefined ||
      messageOrder === null ||
      !Number.isInteger(msgOrder) ||
      msgOrder < 0 ||
      !code
    ) {
      res.status(400).json({
        error: 'chatSessionId, a non-negative integer messageOrder, and code are required',
      });
      return;
    }

    const modelName = name || `Iteration ${msgOrder + 1}`;
    const modelSource: ModelSource =
      source === 'param_tweak' || source === 'restored' ? source : 'generate';

    console.log(`[0G] Upload request received — session ${chatSessionId} turn ${msgOrder} (${modelSource})`);

    const created = await createModelVersion(walletAddress, {
      name: modelName,
      chatSessionId,
      messageOrder: msgOrder,
      // Optional: the service resolves the assistant message id when omitted.
      messageId: messageId ?? undefined,
      source: modelSource,
      restoredFrom,
      parameters,
      inspection,
      boundingBox,
      snapshots,
      dimViews,
    });

    if (!created) {
      res.status(500).json({ error: 'Failed to create model version' });
      return;
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (data: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    sendEvent({
      type: 'version',
      modelId: created.id,
      version: created.version,
      messageOrder: msgOrder,
      source: modelSource,
    });

    const rootHashes: { code?: string; stl?: string; step?: string; glb?: string; dimViews?: string } = {};
    const txSeqs: { code?: number; stl?: number; step?: number; glb?: number; dimViews?: number } = {};

    try {
      // Upload 1/5: Code
      sendEvent({ type: 'progress', file: 'code', label: 'Code', status: 'uploading', step: 1, total: 5 });
      console.log(`[0G] Upload 1/5 (code) initiated...`);
      const codeResult = await uploadTo0G(code, false);
      rootHashes.code = codeResult.rootHash;
      txSeqs.code = codeResult.txSeq;
      sendEvent({ type: 'progress', file: 'code', label: 'Code', status: 'done', rootHash: codeResult.rootHash, txSeq: codeResult.txSeq, step: 1, total: 5 });
      console.log(`[0G] Upload 1/5 (code) successful: ${rootHashes.code} (seq=${codeResult.txSeq})`);

      // Upload 2/5: STL
      if (stlBase64) {
        sendEvent({ type: 'progress', file: 'stl', label: 'STL', status: 'uploading', step: 2, total: 5 });
        console.log(`[0G] Upload 2/5 (STL) initiated...`);
        const stlResult = await uploadTo0G(stlBase64, true);
        rootHashes.stl = stlResult.rootHash;
        txSeqs.stl = stlResult.txSeq;
        sendEvent({ type: 'progress', file: 'stl', label: 'STL', status: 'done', rootHash: stlResult.rootHash, txSeq: stlResult.txSeq, step: 2, total: 5 });
        console.log(`[0G] Upload 2/5 (STL) successful: ${rootHashes.stl} (seq=${stlResult.txSeq})`);
      } else {
        sendEvent({ type: 'progress', file: 'stl', label: 'STL', status: 'skipped', step: 2, total: 5 });
        console.log(`[0G] Upload 2/5 (STL) skipped — no data`);
      }

      // Upload 3/5: STEP
      if (stepBase64) {
        sendEvent({ type: 'progress', file: 'step', label: 'STEP', status: 'uploading', step: 3, total: 5 });
        console.log(`[0G] Upload 3/5 (STEP) initiated...`);
        const stepResult = await uploadTo0G(stepBase64, true);
        rootHashes.step = stepResult.rootHash;
        txSeqs.step = stepResult.txSeq;
        sendEvent({ type: 'progress', file: 'step', label: 'STEP', status: 'done', rootHash: stepResult.rootHash, txSeq: stepResult.txSeq, step: 3, total: 5 });
        console.log(`[0G] Upload 3/5 (STEP) successful: ${rootHashes.step} (seq=${stepResult.txSeq})`);
      } else {
        sendEvent({ type: 'progress', file: 'step', label: 'STEP', status: 'skipped', step: 3, total: 5 });
        console.log(`[0G] Upload 3/5 (STEP) skipped — no data`);
      }

      // Upload 4/5: GLB
      if (glbBase64) {
        sendEvent({ type: 'progress', file: 'glb', label: 'GLB', status: 'uploading', step: 4, total: 5 });
        console.log(`[0G] Upload 4/5 (GLB) initiated...`);
        const glbResult = await uploadTo0G(glbBase64, true);
        rootHashes.glb = glbResult.rootHash;
        txSeqs.glb = glbResult.txSeq;
        sendEvent({ type: 'progress', file: 'glb', label: 'GLB', status: 'done', rootHash: glbResult.rootHash, txSeq: glbResult.txSeq, step: 4, total: 5 });
        console.log(`[0G] Upload 4/5 (GLB) successful: ${rootHashes.glb} (seq=${glbResult.txSeq})`);
      } else {
        sendEvent({ type: 'progress', file: 'glb', label: 'GLB', status: 'skipped', step: 4, total: 5 });
        console.log(`[0G] Upload 4/5 (GLB) skipped — no data`);
      }

      // Upload 5/5: Dim Views (JSON-serialized)
      if (dimViews && Object.keys(dimViews).length > 0) {
        sendEvent({ type: 'progress', file: 'dimViews', label: 'Dim Views', status: 'uploading', step: 5, total: 5 });
        console.log(`[0G] Upload 5/5 (dim views) initiated...`);
        const dimViewsJson = JSON.stringify(dimViews);
        const dimResult = await uploadTo0G(dimViewsJson, false);
        rootHashes.dimViews = dimResult.rootHash;
        txSeqs.dimViews = dimResult.txSeq;
        sendEvent({ type: 'progress', file: 'dimViews', label: 'Dim Views', status: 'done', rootHash: dimResult.rootHash, txSeq: dimResult.txSeq, step: 5, total: 5 });
        console.log(`[0G] Upload 5/5 (dim views) successful: ${rootHashes.dimViews} (seq=${dimResult.txSeq})`);
      } else {
        sendEvent({ type: 'progress', file: 'dimViews', label: 'Dim Views', status: 'skipped', step: 5, total: 5 });
        console.log(`[0G] Upload 5/5 (dim views) skipped — no data`);
      }

      console.log(`[0G] All uploads complete. Saving metadata to Supabase...`);
      const saved = await completeModelVersion(walletAddress, created.id, {
        name: modelName,
        chatSessionId,
        messageOrder: msgOrder,
        source: modelSource,
        restoredFrom,
        rootHashCode: rootHashes.code!,
        rootHashStl: rootHashes.stl,
        rootHashStep: rootHashes.step,
        rootHashGlb: rootHashes.glb,
        rootHashDimViews: rootHashes.dimViews,
        txSeqs,
        parameters,
        inspection,
        boundingBox,
        snapshots,
        dimViews,
      });

      if (!saved) {
        // The artifacts are on 0G but the pointer row could not be completed.
        // Never report success: persist the partial hashes, mark the version
        // failed, and surface the error.
        console.error(`[0G] Failed to save metadata to Supabase for version ${created.version}`);
        await failModelVersion(
          walletAddress,
          created.id,
          'Uploaded to 0G but failed to save version metadata',
          { rootHashes, txSeqs },
        );
        sendEvent({
          type: 'error',
          success: false,
          error: 'Uploaded to 0G but failed to save version metadata',
          modelId: created.id,
          version: created.version,
          rootHashes,
          txSeqs,
        });
        res.end();
        return;
      }

      sendEvent({
        type: 'done',
        success: true,
        message: 'Upload to 0G complete',
        chatSessionId,
        messageOrder: msgOrder,
        modelId: created.id,
        version: created.version,
        source: modelSource,
        uploadStatus: 'complete',
        rootHashes,
        txSeqs,
        snapshots: snapshots || null,
        dimViews: dimViews || null,
      });
      res.end();
    } catch (uploadErr) {
      console.error(`[0G] Upload failed:`, uploadErr instanceof Error ? uploadErr.message : String(uploadErr));
      await failModelVersion(
        walletAddress,
        created.id,
        uploadErr instanceof Error ? uploadErr.message : String(uploadErr),
        // Persist whatever landed on 0G so the artifacts are not orphaned.
        { rootHashes, txSeqs },
      );
      sendEvent({
        type: 'error',
        success: false,
        error: uploadErr instanceof Error ? uploadErr.message : String(uploadErr),
        modelId: created.id,
        version: created.version,
        rootHashes,
        txSeqs,
      });
      res.end();
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

/** Every stored iteration for a chat, newest first. */
router.get('/session/:sessionId/iterations', authMiddleware, async (req, res) => {
  try {
    const walletAddress = (req as any).walletAddress;
    const rows = await listSessionIterations(req.params.sessionId, walletAddress);
    res.json({ iterations: rows.map(toIteration) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
});

/** The newest version for a chat, with its 0G contents (legacy shape + extras). */
router.get('/session/:sessionId/latest', authMiddleware, async (req, res) => {
  try {
    const walletAddress = (req as any).walletAddress;
    const model = await getLatestModelForSession(req.params.sessionId, walletAddress);

    if (!model) {
      res.status(404).json({ error: 'No completed model found for this session' });
      return;
    }

    if (model.upload_status !== 'complete' || !model.root_hash_code) {
      res.status(404).json({ error: 'No completed model found for this session' });
      return;
    }

    const contents = await fetchModelContents(model);

    res.json({
      success: true,
      model: {
        ...contents,
        // Backward-compatible aliases used by the existing frontend path.
        messageOrder: model.message_order,
        dimViews: contents.dimViews,
        parameters: model.parameters || [],
        inspection: model.inspection || null,
        boundingBox: model.bounding_box || null,
        uploadStatus: model.upload_status,
        createdAt: model.created_at,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
});

router.get('/fetch-from-0g/:rootHash', async (req, res) => {
  try {
    const isBase64 = req.query.isBase64 === 'true';
    const dataStr = await fetchFrom0G(req.params.rootHash, isBase64);
    res.json({ success: true, data: dataStr });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
});

/** Full contents of one version — used for preview and restore. */
router.get('/:id/contents', authMiddleware, async (req, res) => {
  try {
    const walletAddress = (req as any).walletAddress;
    const model = await getModelVersion(req.params.id, walletAddress);

    if (!model) {
      res.status(404).json({ error: 'Model version not found' });
      return;
    }
    if (model.upload_status !== 'complete') {
      res.status(409).json({ error: 'This iteration has no stored artifacts', uploadStatus: model.upload_status });
      return;
    }

    const contents = await fetchModelContents(model);
    res.json({ success: true, model: contents });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
});

/**
 * Full rewind to a version: removes newer versions and later messages, then
 * returns the restored contents and the trimmed transcript.
 */
router.post('/:id/rewind', authMiddleware, async (req, res) => {
  try {
    const walletAddress = (req as any).walletAddress;
    const model = await getModelVersion(req.params.id, walletAddress);

    if (!model) {
      res.status(404).json({ error: 'Model version not found' });
      return;
    }
    if (model.upload_status !== 'complete') {
      res.status(409).json({ error: 'This iteration cannot be restored — its upload did not complete' });
      return;
    }
    if (!model.message_id) {
      res.status(409).json({
        error: 'This version predates message anchoring and cannot be rewound safely. Store a new iteration first.',
      });
      return;
    }

    // Fetch the target artifacts BEFORE deleting anything. If 0G is down, the
    // user keeps their history instead of losing it to a half-applied rewind.
    let contents;
    try {
      contents = await fetchModelContents(model);
    } catch (fetchErr) {
      const detail = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.error('[0G] rewind pre-fetch failed, aborting before any delete:', detail);
      res.status(502).json({
        error: 'Could not load this version from 0G. Nothing was deleted.',
        detail,
      });
      return;
    }

    const result = await rewindToVersion(model.chat_session_id, walletAddress, model.version);
    if (result.error === 'not_found') {
      res.status(404).json({ error: 'Version not found' });
      return;
    }
    if (result.error === 'not_restorable') {
      res.status(409).json({ error: 'This iteration cannot be restored' });
      return;
    }
    if (result.error === 'unanchored') {
      res.status(409).json({
        error: 'This version predates message anchoring and cannot be rewound safely.',
      });
      return;
    }
    if (result.error === 'anchor_missing') {
      res.status(409).json({
        error: 'The message this version belongs to no longer exists; rewind aborted.',
      });
      return;
    }
    if (result.error === 'delete_failed') {
      res.status(500).json({ error: result.detail || 'Failed to rewind history' });
      return;
    }

    const target = result.target!;

    // The deletion is committed. The transcript read is best-effort so a read
    // failure cannot make the client believe the rewind failed.
    let history: Awaited<ReturnType<typeof getChatSession>> = null;
    let transcriptError: string | null = null;
    try {
      history = await getChatSession(target.chat_session_id, walletAddress);
      if (!history) transcriptError = 'Could not read the trimmed transcript';
    } catch (err) {
      transcriptError = err instanceof Error ? err.message : String(err);
    }

    let remaining: Record<string, any>[] = [];
    try {
      remaining = await listSessionIterations(target.chat_session_id, walletAddress);
    } catch (err) {
      console.error('[DB] post-rewind iterations refresh failed:', err);
    }

    // The pre-fetch used the row's stored order; the RPC may have re-synced it
    // to the anchored message's current position.
    contents.messageOrder = target.message_order ?? contents.messageOrder;

    res.json({
      success: true,
      model: contents,
      messages: history?.messages ?? null,
      session: history?.session ?? null,
      iterations: remaining.map(toIteration),
      transcriptError,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
});

router.post('/save', authMiddleware, async (req, res) => {
  try {
    const walletAddress = (req as any).walletAddress;
    const { name, chatSessionId, messageOrder } = req.body ?? {};
    const order = Number(messageOrder);

    if (
      !name ||
      !chatSessionId ||
      messageOrder === undefined ||
      messageOrder === null ||
      !Number.isInteger(order) ||
      order < 0
    ) {
      res.status(400).json({
        error: 'name, chatSessionId and a non-negative integer messageOrder are required',
      });
      return;
    }

    const result = await saveModelMetadata(walletAddress, req.body);
    if (!result) {
      res.status(500).json({ error: 'Failed to save model' });
      return;
    }
    res.json({ success: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const walletAddress = (req as any).walletAddress;
    const models = await getSavedModels(walletAddress);
    res.json({ models: models.map(toIteration) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const walletAddress = (req as any).walletAddress;
    const model = await getSavedModel(req.params.id, walletAddress);
    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }
    res.json({ model: toIteration(model) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const walletAddress = (req as any).walletAddress;
    const ok = await deleteSavedModel(req.params.id, walletAddress);
    if (!ok) {
      res.status(404).json({ error: 'Model version not found' });
      return;
    }
    res.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
});
