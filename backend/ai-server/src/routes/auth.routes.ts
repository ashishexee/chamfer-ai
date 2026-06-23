import express from 'express';
import { authMiddleware } from '../middleware/auth';
import { upsertProfile } from '../services/db';

export const router = express.Router();

router.post('/verify', authMiddleware, async (req, res) => {
  try {
    const walletAddress = (req as any).walletAddress;
    console.log(`[AUTH] verify request from wallet: ${walletAddress}`);
    const ok = await upsertProfile(walletAddress);
    console.log(`[AUTH] profile upsert: ${ok ? 'OK' : 'FAILED'}`);
    res.json({ walletAddress, verified: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[AUTH] verify error:', msg);
    res.status(500).json({ error: msg });
  }
});
