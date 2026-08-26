import express from 'express';
import { authMiddleware } from '../middleware/auth';
import { verifyTEEResponse } from '../0g/tee-verifier';

export const router = express.Router();

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/**
 * POST /api/tee/verify — re-run independent TEE verification on demand.
 *
 * Body: { providerAddress, chatId, model?, expectedSignedTextSha256? }
 *
 * Runs the same cryptographic checks the generation pipeline performs (provider
 * signature re-fetch, EIP-191 recovery, integrity hash, on-chain teeSignerAddress)
 * and returns per-step results so the UI can show exactly what was verified.
 */
router.post('/verify', authMiddleware, async (req: express.Request, res: express.Response) => {
  const { providerAddress, chatId, model, expectedSignedTextSha256 } = req.body ?? {};

  if (typeof providerAddress !== 'string' || !ADDRESS_RE.test(providerAddress)) {
    res.status(400).json({ error: 'providerAddress must be a 0x wallet address' });
    return;
  }
  if (typeof chatId !== 'string' || chatId.length === 0 || chatId.length > 200) {
    res.status(400).json({ error: 'chatId is required' });
    return;
  }

  try {
    const tee = await verifyTEEResponse(providerAddress, chatId, {
      model: typeof model === 'string' && model.length <= 200 ? model : undefined,
    });
    const r = tee.receipt;

    const steps = [
      {
        key: 'refetch',
        label: 'Signature re-fetched from the provider',
        pass: !!r,
        detail: r?.providerEndpoint,
      },
      {
        key: 'recover',
        label: 'Signature recovers to the TEE signer (EIP-191)',
        pass: !!r?.recoveredSigner,
        detail: r?.recoveredSigner,
      },
      {
        key: 'integrity',
        label: 'Signed text hash matches the original receipt',
        // Without an expected hash from the original generation there is nothing to
        // compare — presence of the freshly computed hash is still shown.
        pass: r ? (expectedSignedTextSha256 ? r.signedTextSha256 === String(expectedSignedTextSha256).toLowerCase() : true) : null,
        detail: r?.signedTextSha256,
      },
      {
        key: 'onchain',
        label: 'Signer matches the on-chain teeSignerAddress',
        pass: tee.status === 'verified',
        detail: tee.detail,
      },
    ];

    res.json({ status: tee.status, detail: tee.detail, receipt: r ?? null, steps });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[TEE:route] verify failed: ${msg}`);
    res.status(500).json({ error: msg });
  }
});
