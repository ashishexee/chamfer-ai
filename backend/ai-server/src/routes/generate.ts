import type { Request, Response } from 'express';
import {
  generateCadQueryCodeStream,
  fastSyntaxCheck,
  classifyError,
  buildValidationFeedback,
  buildInspectionFeedback,
  inspectWithVision,
  checkClarification,
  type ParameterSchema,
} from '../services/llm';
import { config, type ReasoningEffort } from '../config';
import { RETRY_TEMPLATE } from '../lib/loader';
import { expandPrompt } from '../services/prompt-expander';
import { checkVisionSupport } from '../services/vision';
import { startHeartbeat } from '../lib/heartbeat';
import {
  createSession,
  getSession,
  addMessageToSession,
  updateSession,
  deleteSession,
} from '../services/session';
import type { SessionMessage } from '../services/session';

const MAX_RETRIES = 3;
/**
 * Independent budget for vision-FIX regenerations. A model that executes fine
 * but gets rejected by the visual reviewer burns a vision-fix retry, NOT a
 * code-retry slot — so a shape problem never silently eats the attempts
 * reserved for broken/failed code.
 */
const MAX_VISION_FIXES = config.visionRetryLimit;

async function callCadServer(endpoint: string, body: Record<string, unknown>) {
  const res = await fetch(`${config.cadServerUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

function sendSSE(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// Retry feedback categories that already carry their own targeted
// instructions (vision verdicts, geometry diagnostics, missing-code
// notices). These bypass the generic RETRY_TEMPLATE — re-classifying them
// would produce a mismatched "fix hint".
const TARGETED_RETRY_CATEGORIES = new Set(['VISION_FIX', 'GEOMETRY_FEEDBACK', 'NO_CODE']);

function buildTargetedRetry(feedback: string, code: string): string {
  const codeBlock = code && code.length > 0
    ? `\n\nThe code from the previous attempt:\n\n\`\`\`python\n${code}\n\`\`\`\n`
    : '';
  return `${feedback}${codeBlock}\nFix ONLY what is broken — the smallest change possible. Return ONLY a JSON object with keys "code", "parameters", "description", "tags". No thinking text. Start with '{' and end with '}'.`;
}

interface CadResult {
  success: boolean;
  error?: string;
  parameters?: unknown[];
  has_stl?: boolean;
  has_step?: boolean;
  has_glb?: boolean;
  stl_base64?: string;
  step_base64?: string;
  glb_base64?: string;
  validation?: {
    volume?: number;
    surface_area?: number;
    bounding_box?: { size?: number[] };
    is_valid?: boolean;
    has_volume?: boolean;
    warnings?: string[];
  };
  inspection?: {
    shape_type?: string;
    face_count?: number;
    edge_count?: number;
    vertex_count?: number;
    volume?: number;
    surface_area?: number;
    has_volume?: boolean;
    is_valid?: boolean;
    is_solid?: boolean;
    bounding_box?: { size?: number[]; min?: number[]; max?: number[]; center?: number[] };
    center_of_mass?: number[];
    warnings?: string[];
    errors?: string[];
    all_clear?: boolean;
  };
  snapshots?: Record<string, string>;
  png_snapshots?: Record<string, string>;
  dim_views?: Record<string, string>;
}

export async function handleGenerate(req: Request, res: Response): Promise<void> {
  const { prompt, provider, enableVision, answers, clarificationProvider, images, sessionId, editMode, reasoningEffort } = req.body as {
    prompt?: string;
    provider?: string;
    enableVision?: boolean;
    answers?: string;
    clarificationProvider?: string;
    images?: string[];
    sessionId?: string;
    editMode?: boolean;
    reasoningEffort?: string;
  };

  if (!prompt) { res.status(400).json({ error: 'Prompt is required' }); return; }
  if (provider && !config.providers[provider]) { res.status(400).json({ error: `Unknown provider: ${provider}` }); return; }

  const providerId = provider || '0g';
  const providerConfig = config.providers[providerId] || config.providers['0g'];
  const supportsVision = providerConfig.supportsVision && enableVision === true;

  // Per-request reasoning depth. Honoured only when the model advertises a
  // graded scale and the value is one it accepts; anything else silently falls
  // back to the provider default rather than sending a value the API rejects.
  const reasoningOverride: ReasoningEffort | undefined =
    reasoningEffort && providerConfig.reasoningEfforts?.includes(reasoningEffort as ReasoningEffort)
      ? (reasoningEffort as ReasoningEffort)
      : undefined;

  // Validate images if provided
  if (images && images.length > 0) {
    const visionCheck = checkVisionSupport(images, providerConfig.supportsVision);
    if (!visionCheck.valid) {
      res.status(400).json({ error: visionCheck.error });
      return;
    }
  }

  // Get or create session
  let session = sessionId ? getSession(sessionId) : undefined;
  if (!session && sessionId) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  if (!session) {
    session = createSession();
  }

  // effectivePrompt starts as raw user input — expandPrompt() runs AFTER clarifier
  let effectivePrompt = prompt;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    // Tell nginx not to buffer this response, even before its config is updated.
    'X-Accel-Buffering': 'no',
  });

  // Models that keep reasoning server-side (e.g. Muse) stream zero bytes while
  // thinking; idle heartbeats keep nginx proxy_read_timeout and the browser
  // from dropping the connection mid-generation.
  startHeartbeat(res, config.sseHeartbeatMs);

  let code = '';
  let parameters: Record<string, ParameterSchema> = {};
  let description = '';
  let tags: string[] = [];
  let rawResponse = '';
  let reasoning = '';
  let lastError = '';
  let lastErrorCategory = '';

  // ── Helper to emit structured workflow steps ──
  const step = (id: string, icon: string, label: string, detail: string, status: 'running' | 'done' | 'error' = 'running') => {
    sendSSE(res, 'step', { id, icon, label, detail, status });
  };
  const stepDone = (id: string, detail?: string) => {
    sendSSE(res, 'step', { id, status: 'done', detail });
  };
  const stepError = (id: string, detail: string) => {
    sendSSE(res, 'step', { id, status: 'error', detail });
  };

  // ── STEP 0: Clarification (skip if user already provided answers, edit mode, or follow-up in existing session) ──
  // Check if this is a follow-up in an existing session (has previous messages)
  const isFollowUp = session.messages.length > 0;
  
  if (editMode) {
    console.log(`[ROUTE] Edit mode: skipping clarifier, using previous code context`);
    step('clarify', 'help-circle', 'Edit mode', 'Using previous design context');
    stepDone('clarify', 'Proceeding with edit — previous code loaded');
  } else if (answers) {
    effectivePrompt = `${answers}\n\n${effectivePrompt}`;
    console.log(`[ROUTE] Using clarified prompt: "${effectivePrompt.slice(0, 100)}..."`);
    step('clarify', 'help-circle', 'Clarification received', 'Using your answers to refine the prompt');
    stepDone('clarify');
  } else if (isFollowUp) {
    // Skip clarification for follow-up messages in existing sessions
    // The context from previous messages is sufficient
    console.log(`[ROUTE] Follow-up in existing session (${session.messages.length} messages), skipping clarifier`);
    step('clarify', 'help-circle', 'Context preserved', 'Using previous conversation context');
    stepDone('clarify', 'Proceeding with full context');
  } else {
    step('clarify', 'help-circle', 'Checking specifications', 'Analyzing if your request needs more details');
    try {
      const clarification = await checkClarification(effectivePrompt, clarificationProvider || providerId, images);
      if (!clarification.isClear && clarification.questions.length > 0) {
        console.log(`[ROUTE] Clarification needed: ${clarification.questions.length} questions`);
        stepDone('clarify', `${clarification.questions.length} questions to refine your request`);

        // Store clarification questions in session for context tracking
        addMessageToSession(session.id, {
          role: 'system',
          content: `Clarification asked: ${clarification.questions.map(q => q.question).join(', ')}`,
          clarificationHistory: {
            questions: clarification.questions.map(q => q.question),
            answers: '',
            timestamp: Date.now(),
          },
        });

        sendSSE(res, 'clarify', {
          questions: clarification.questions,
          originalPrompt: prompt,
          standardizedPrompt: clarification.standardizedPrompt,
        });
        res.end();
        return;
      }
      effectivePrompt = clarification.standardizedPrompt || effectivePrompt;
      stepDone('clarify', 'Request is clear — proceeding with generation');
    } catch (err) {
      console.error(`[ROUTE] Clarification check failed: ${err}`);
      stepDone('clarify', 'Proceeding with original prompt');
    }
  }

  // Expand vague prompts with default dimensions (AFTER clarifier has seen raw input)
  const expandedPrompt = expandPrompt(effectivePrompt);
  if (expandedPrompt !== effectivePrompt) {
    effectivePrompt = expandedPrompt;
    console.log(`[ROUTE] Prompt expanded: "${effectivePrompt.slice(0, 100)}..."`);
  }

  // Add user message to session with clarification context if present
  const userMessage: any = {
    role: 'user',
    content: effectivePrompt,
    images,
  };
  
  // If answers provided, store the clarification Q&A in the message
  if (answers) {
    // Find the last clarification history from session
    const lastClarification = [...session.messages].reverse().find(m => m.clarificationHistory);
    if (lastClarification?.clarificationHistory) {
      userMessage.clarificationHistory = {
        ...lastClarification.clarificationHistory,
        answers: answers,
        timestamp: Date.now(),
      };
    }
  }
  
  // Snapshot the LLM history BEFORE appending the current message, so the
  // prompt is sent exactly once (as the current user message) — capturing
  // after the append would include it here too and double-prompt the model.
  const sessionHistory: SessionMessage[] = [...session.messages];

  addMessageToSession(session.id, userMessage);

  // If edit mode, include previous code context
  let previousCodeForRetry: string | undefined;
  if (editMode && session.currentCode) {
    previousCodeForRetry = session.currentCode;
    console.log(`[ROUTE] Edit mode: including previous code (${previousCodeForRetry.length} chars)`);
  }

  // Initial analysis step
  const analyzeDetail = expandedPrompt !== prompt
    ? `Expanded "${prompt}" → "${expandedPrompt}"`
    : 'Extracting dimensions, features, and parameters from your prompt';
  step('analyze', 'search', 'Analyzing request', analyzeDetail);

  let attempt = 0;
  let visionFixes = 0;
  // Last actual visual-review verdict; undefined = vision never ran / no verdict.
  let visionPassed: boolean | undefined;

  while (attempt < MAX_RETRIES) {
    console.log(`[ROUTE] Attempt ${attempt + 1}/${MAX_RETRIES} (vision fixes used: ${visionFixes}/${MAX_VISION_FIXES})`);
    sendSSE(res, 'attempt', { attempt: attempt + 1, maxRetries: MAX_RETRIES });

    // Build error feedback for retry. `lastError` (not `attempt > 0`) marks a
    // retry, because vision-fix regenerations consume their own budget and
    // leave the code-attempt counter untouched.
    let errorFeedback: string | undefined;
    if (lastError) {
      if (TARGETED_RETRY_CATEGORIES.has(lastErrorCategory)) {
        // Vision verdicts / geometry diagnostics / no-code notices already
        // contain targeted instructions — pass them through with the code
        // instead of re-classifying into the generic template.
        errorFeedback = buildTargetedRetry(lastError, code);
        console.log(`[ROUTE] Retry ${attempt}: ${lastErrorCategory} (targeted feedback)`);
      } else {
        const { category, hint } = classifyError(lastError);
        lastErrorCategory = category;
        errorFeedback = RETRY_TEMPLATE
          .replace('{error_message}', lastError)
          .replace('{error_class}', category)
          .replace('{hint}', hint)
          .replace('{code}', code);
        console.log(`[ROUTE] Retry ${attempt}: ${category} error`);
      }
    } else if (editMode && previousCodeForRetry && !lastError) {
      // Edit mode: include previous code as context for the first attempt
      errorFeedback = `Previous code:\n\n\`\`\`python\n${previousCodeForRetry}\n\`\`\`\n\nThe user wants to modify this design. Please update the code according to the new request: "${effectivePrompt}". Return the complete updated JSON with all fields (code, parameters, description, tags).`;
    }

    try {
      const result = await generateCadQueryCodeStream({
        prompt: effectivePrompt,
        images,
        sessionHistory,
        previousCode: lastError ? code : (editMode ? previousCodeForRetry : undefined),
        errorFeedback,
        repair: !!lastError,
        providerId,
        reasoningEffort: reasoningOverride,
        callbacks: !lastError ? {
          onReasoning: (chunk) => sendSSE(res, 'reasoning', { chunk }),
          onContent: () => {},
          onDone: (r) => sendSSE(res, 'llm-done', { codeLength: r.code.length }),
          onError: (err) => sendSSE(res, 'llm-error', { error: err }),
          onTEEVerifyStart: () => {
            // Close 'analyze' first — the TEE check fires after the LLM stream but
            // before the post-await stepDone below, so without this two steps
            // would show Running simultaneously and tee-verify would slot in
            // ahead of its turn.
            stepDone('analyze', 'Identified the requested geometry type and parameters');
            step(
              'tee-verify', 'shield-check', 'Verifying TEE signature',
              'Cryptographically checking the response against the provider\'s on-chain TEE identity',
            );
          },
        } : undefined,
      });

      code = result.code;
      parameters = result.parameters;
      description = result.description;
      tags = result.tags;
      rawResponse = result.rawResponse;
      reasoning = result.reasoning;

      if (!lastError) {
        stepDone('analyze', 'Identified the requested geometry type and parameters');
      }

      // Reflect the TEE verification outcome IMMEDIATELY — the check already ran
      // to completion inside the LLM call, so resolving it here (not at the end
      // of the attempt) keeps the timeline truthful: tee-verify closes before
      // syntax begins, in the order the work actually happened.
      if (!lastError && result.zeroG?.teeStatus) {
        if (result.zeroG.teeStatus === 'verified') {
          stepDone('tee-verify', 'Signature verified against on-chain TEE identity');
        } else if (result.zeroG.teeStatus === 'failed') {
          stepError('tee-verify', 'TEE signature FAILED verification — response untrusted');
        } else if (result.zeroG.teeStatus === 'not-verifiable') {
          stepDone('tee-verify', 'Provider has no verifiable TEE service');
        } else {
          stepDone('tee-verify', 'Could not verify independently — router-reported only');
        }
      }

      if (!code || code.length < 20) {
        lastError = 'Your previous response did not contain valid Python code in the "code" field. Output ONLY a JSON object where "code" is a complete CadQuery Python script (as a JSON string).';
        lastErrorCategory = 'NO_CODE';
        stepError('generate', 'No Python code found in response');
        sendSSE(res, 'retry', { reason: lastError, category: 'NO_CODE', hint: 'Output JSON with a valid "code" field.' });
        attempt++;
        continue;
      }

      step('generate', 'code', 'Writing CadQuery code', `Drafting parametric Python script with ${Object.keys(parameters).length} adjustable parameters`);
      stepDone('generate', 'CadQuery script ready');

      // ── FAST AST SYNTAX CHECK ──
      step('syntax', 'shield-check', 'Checking syntax', 'Validating Python code before execution');
      const astResult = await fastSyntaxCheck(code);
      if (!astResult.valid) {
        lastError = astResult.error || 'Syntax check failed';
        lastErrorCategory = 'SYNTAX';
        stepError('syntax', lastError.slice(0, 100));
        console.log(`[ROUTE] AST check failed: ${lastError.slice(0, 120)}`);
        sendSSE(res, 'retry', { reason: lastError, category: 'SYNTAX', hint: 'Fix Python syntax error.', attempt: attempt + 1 });
        attempt++;
        continue;
      }
      stepDone('syntax', 'Python syntax is valid');

      // ── Execute on CAD server ──
      const wantSvgSnapshots = attempt === 0 || attempt === MAX_RETRIES - 1;
      const wantPngSnapshots = supportsVision;
      step('execute', 'cpu', 'Executing CadQuery', `Running code in sandbox${wantPngSnapshots ? ' and rendering snapshots for visual inspection' : ''}`);
      sendSSE(res, 'executing', {
        message: `Executing CadQuery...${wantPngSnapshots ? ' (with visual inspection)' : wantSvgSnapshots ? ' (rendering snapshots)' : ''}`,
        visionEnabled: supportsVision,
      });

      const cadResult = await callCadServer('/execute', {
        code,
        render_snapshots: wantSvgSnapshots,
        render_png: wantPngSnapshots,
        render_dim_views: true,
      }) as CadResult;

      console.log(`[ROUTE] CAD result: success=${cadResult.success}`);

      if (!cadResult.success) {
        const errorMsg = cadResult.error || 'Unknown execution error';
        const { category, hint } = classifyError(errorMsg);
        lastError = errorMsg;
        lastErrorCategory = category;
        stepError('execute', `${category}: ${errorMsg.slice(0, 80)}`);
        console.log(`[ROUTE] Error [${category}]: ${errorMsg.slice(0, 120)}`);
        sendSSE(res, 'retry', { reason: errorMsg, category, hint, attempt: attempt + 1 });
        attempt++;
        continue;
      }

      stepDone('execute', 'CadQuery executed successfully');

      // ── Execution succeeded — check validation + inspection ──
      step('inspect', 'ruler', 'Inspecting geometry', `Checking volume, dimensions, faces, and B-rep validity`);
      const validation = cadResult.validation;
      const inspection = cadResult.inspection;
      const validationFeedback = buildValidationFeedback(validation);
      const inspectionFeedback = buildInspectionFeedback(inspection);

      if (inspection) {
        sendSSE(res, 'inspection', { inspection, visionEnabled: supportsVision });
      }
      stepDone('inspect', inspection
        ? `Valid ${inspection.shape_type?.toLowerCase() || 'solid'}, ${inspection.face_count} faces, ${inspection.bounding_box?.size?.map((s: number) => `${s.toFixed(1)}mm`).join('x') || 'unknown'}`
        : 'Inspection complete');

      // Stream SVG snapshots
      if (cadResult.snapshots && Object.keys(cadResult.snapshots).length > 0) {
        step('snapshots', 'camera', 'Rendering snapshots', 'Generating multi-view SVG renders');
        sendSSE(res, 'snapshots', { snapshots: cadResult.snapshots });
        stepDone('snapshots', `${Object.keys(cadResult.snapshots).length} views rendered`);
      }

      // Stream 2D dimensional views
      if (cadResult.dim_views && Object.keys(cadResult.dim_views).length > 0) {
        step('dimviews', 'ruler', 'Drawing dimensional views', 'Projecting top/front/side outlines');
        sendSSE(res, 'dim-views', { dimViews: cadResult.dim_views });
        stepDone('dimviews', `${Object.keys(cadResult.dim_views).length} orthographic views with dimensions`);
      }

      // Check validation/inspection issues
      const hasInspectionErrors = inspection?.errors && inspection.errors.length > 0;
      const hasValidationWarnings = validationFeedback.length > 0;

      if (hasInspectionErrors || hasValidationWarnings) {
        const allFeedback = [inspectionFeedback, validationFeedback]
          .filter(f => f.length > 0)
          .join('\n\n');

        if (allFeedback.length > 0 && attempt < MAX_RETRIES - 1) {
          console.log(`[ROUTE] Validation/inspection issues — feeding back to LLM`);
          step('repair', 'wrench', 'Repairing model', `Fixing ${inspection?.errors?.length || 0} geometry issues and retrying`);
          lastError = allFeedback;
          lastErrorCategory = 'GEOMETRY_FEEDBACK';
          sendSSE(res, 'validation-warning', {
            warnings: validation?.warnings || [],
            inspection,
          });
          stepDone('repair', 'Repair instructions sent — retrying');
          attempt++;
          continue;
        }
      }

      // ── VISUAL INSPECTION (own retry budget, separate from code retries) ──
      if (supportsVision && cadResult.png_snapshots && Object.keys(cadResult.png_snapshots).length > 0) {
        step('vision', 'eye', 'Visual inspection', 'Model reviewing rendered snapshots to verify correctness');
        sendSSE(res, 'vision-check', { message: 'Visually inspecting rendered model...' });

        const visionResult = await inspectWithVision(
          effectivePrompt,
          code,
          cadResult.png_snapshots,
          inspection,
          providerId,
        );

        sendSSE(res, 'vision-result', {
          needsFix: visionResult.needsFix,
          feedback: visionResult.feedback,
        });

        // Record the ACTUAL verdict — delivery honesty depends on it, not on
        // whether vision merely ran.
        visionPassed = !visionResult.needsFix;

        if (visionResult.needsFix && visionFixes < MAX_VISION_FIXES) {
          console.log(`[ROUTE] Vision inspection: NEEDS_FIX (${visionFixes + 1}/${MAX_VISION_FIXES}) — ${visionResult.feedback.slice(0, 120)}`);
          step('vision', 'eye', 'Visual inspection', `Model found issues: ${visionResult.feedback.slice(0, 60)}`, 'error');
          lastError = `Visual inspection found issues with your model:\n${visionResult.feedback}\n\nThe rendered snapshots show that the model doesn't fully match the user's request. Fix the code and return the complete updated JSON.`;
          lastErrorCategory = 'VISION_FIX';
          visionFixes++;
          continue;
        }

        if (visionResult.needsFix) {
          // Vision budget exhausted — deliver, but honestly flagged.
          console.log(`[ROUTE] Vision inspection: NEEDS_FIX — budget exhausted, delivering unverified`);
          step('vision', 'eye', 'Visual inspection', `Model found issues: ${visionResult.feedback.slice(0, 60)}`, 'error');
          sendSSE(res, 'validation-warning', {
            message: `⚠️ Visual check flagged unresolved issues: ${visionResult.feedback}`,
          });
        } else {
          stepDone('vision', 'Model confirmed the render looks correct');
          console.log(`[ROUTE] Vision inspection: PASSED`);
        }
      }

      // ── SUCCESS ──
      // Update session with new code and parameters
      updateSession(session.id, {
        currentCode: code,
        currentParameters: parameters,
        currentDescription: description,
        currentTags: tags,
      });
      addMessageToSession(session.id, {
        role: 'assistant',
        content: rawResponse,
        code,
        parameters,
        inspection: cadResult.inspection,
      });

      step('deliver', 'package-check', 'Preparing deliverables', 'Packaging STEP, STL, GLB, and snapshots for download');
      console.log(`[ROUTE] SUCCESS on attempt ${attempt + 1}${supportsVision ? (visionPassed ? ' (vision-verified)' : ' (vision NOT verified)') : ''}`);
      stepDone('deliver', 'Files packaged and ready');

      // Surface a failed TEE signature loudly — per 0G docs this means the response
      // should be treated as untrusted
      if (result.zeroG?.teeStatus === 'failed') {
        sendSSE(res, 'validation-warning', {
          message: '🔒⚠️ TEE signature verification FAILED for this response. The code was generated by a provider whose signature did not verify — treat it as untrusted.',
        });
      }

      // teeProof is only issued for cryptographically verified responses — the frontend
      // badge renders from this field, so no badge means "not independently verified".
      // signature carries the REAL EIP-191 bytes when the provider's signature endpoint
      // responded; it is absent (not faked) when only the verdict was possible.
      const teeProof = result.zeroG?.teeStatus === 'verified'
        ? {
            providerAddress: result.zeroG.providerAddress,
            teeSignerAddress: result.zeroG.teeReceipt?.recoveredSigner,
            chatId: result.zeroG.chatId || '',
            signature: result.zeroG.teeReceipt?.signature,
            model: result.zeroG.teeReceipt?.model,
            timestamp: Date.now(),
            verified: true,
          }
        : undefined;

      sendSSE(res, 'done', {
        success: true,
        sessionId: session.id,
        code,
        parameters,
        description,
        tags,
        message: rawResponse,
        reasoning,
        provider: providerId,
        hasStl: cadResult.has_stl,
        hasStep: cadResult.has_step,
        hasGlb: cadResult.has_glb,
        stlBase64: cadResult.stl_base64,
        stepBase64: cadResult.step_base64,
        glbBase64: cadResult.glb_base64,
        validation,
        inspection,
        snapshots: cadResult.snapshots || {},
        dimViews: cadResult.dim_views || {},
        // True only when the vision reviewer explicitly passed the model —
        // not merely when a vision-capable provider ran the check.
        visionVerified: visionPassed === true,
        ...(teeProof ? { teeProof } : {}),
        ...(result.zeroG ? { zeroG: result.zeroG } : {}),
      });
      res.end();
      return;

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[ROUTE] Error: ${msg}`);
      sendSSE(res, 'error', { error: msg });
      res.end();
      return;
    }
  }

  // ── All retries exhausted ──
  if (code) {
    console.log(`[ROUTE] Returning best-effort result after ${MAX_RETRIES} attempts. Last error: ${lastErrorCategory}`);
    let bestEffortData: any = {};
    try {
      const finalResult = await callCadServer('/execute', {
        code,
        render_snapshots: true,
        render_png: false,
        render_dim_views: true,
      }) as CadResult;
      if (finalResult.success) {
        bestEffortData = {
          hasStl: finalResult.has_stl,
          hasStep: finalResult.has_step,
          hasGlb: finalResult.has_glb,
          stlBase64: finalResult.stl_base64,
          stepBase64: finalResult.step_base64,
          glbBase64: finalResult.glb_base64,
          parameters: finalResult.parameters || [],
          validation: finalResult.validation,
          inspection: finalResult.inspection,
          snapshots: finalResult.snapshots || {},
          dimViews: finalResult.dim_views || {},
        };
        if (finalResult.inspection) sendSSE(res, 'inspection', { inspection: finalResult.inspection });
        if (finalResult.snapshots) sendSSE(res, 'snapshots', { snapshots: finalResult.snapshots });
        if (finalResult.dim_views) sendSSE(res, 'dim-views', { dimViews: finalResult.dim_views });
      }
    } catch {}

    // Update session even for best-effort
    updateSession(session.id, {
      currentCode: code,
      currentParameters: parameters,
      currentDescription: description,
      currentTags: tags,
    });
    addMessageToSession(session.id, {
      role: 'assistant',
      content: rawResponse,
      code,
      parameters,
      error: lastError,
      errorCategory: lastErrorCategory,
    });

    step('deliver', 'package-check', 'Preparing deliverables', 'Packaging best-effort result');
    stepDone('deliver', 'Best-effort deliverables packaged');

    sendSSE(res, 'done', {
      success: true,
      sessionId: session.id,
      code,
      parameters,
      description,
      tags,
      message: rawResponse,
      reasoning,
      provider: providerId,
      bestEffort: true,
      warning: `Model generated but had issues after ${MAX_RETRIES} attempts. Last error category: ${lastErrorCategory}.`,
      ...bestEffortData,
    });
  } else {
    sendSSE(res, 'error', { error: `Failed after ${MAX_RETRIES} attempts. Last error: ${lastError}` });
  }
  res.end();
}

export async function handleUpdateParams(req: Request, res: Response): Promise<void> {
  try {
    const { code, params } = req.body as { code?: string; params?: Record<string, number> };
    if (!code) { res.status(400).json({ error: 'Code is required' }); return; }
    if (!params) { res.status(400).json({ error: 'Params are required' }); return; }

    console.log(`[PARAMS] Updating with params: ${JSON.stringify(params)}`);
    const cadResult = await callCadServer('/update-params', {
      code,
      params,
      render_snapshots: true,
      render_png: false,
      render_dim_views: true,
    }) as CadResult;
    console.log(`[PARAMS] CAD result: success=${cadResult.success}, has_stl=${cadResult.has_stl}, has_step=${cadResult.has_step}`);

    if (!cadResult.success) {
      console.log(`[PARAMS] Error: ${cadResult.error}`);
      res.status(500).json({ success: false, error: cadResult.error });
      return;
    }

    res.json({
      success: true,
      parameters: cadResult.parameters || [],
      hasStl: cadResult.has_stl, hasStep: cadResult.has_step, hasGlb: cadResult.has_glb,
      stlBase64: cadResult.stl_base64, stepBase64: cadResult.step_base64, glbBase64: cadResult.glb_base64,
      validation: cadResult.validation,
      inspection: cadResult.inspection,
      snapshots: cadResult.snapshots || {},
      dimViews: cadResult.dim_views || {},
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[PARAMS] Exception: ${msg}`);
    res.status(500).json({ success: false, error: msg });
  }
}

export function handleListProviders(_req: Request, res: Response): void {
  const providers = Object.entries(config.providers).map(([id, p]) => ({
    id,
    name: p.name || id,
    model: p.model,
    hasKey: !!p.apiKey,
    supportsVision: p.supportsVision,
    maxContextTokens: p.maxContextTokens,
    isZeroG: p.isZeroG || false,
    // Graded reasoning scale, when the model exposes one. Absent means the UI
    // should render no reasoning control for this model.
    reasoningEfforts: p.reasoningEfforts,
    defaultReasoningEffort: p.reasoningEffort,
  }));
  res.json({ providers });
}

// ─── Session Management Endpoints ──────────────────────────────────────

export function handleGetSession(req: Request, res: Response): void {
  const { id } = req.params;
  const session = getSession(id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json({
    id: session.id,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messages: session.messages,
    currentCode: session.currentCode,
    currentDescription: session.currentDescription,
    currentTags: session.currentTags,
  });
}

export function handleDeleteSession(req: Request, res: Response): void {
  const { id } = req.params;
  const deleted = deleteSession(id);
  if (deleted) {
    res.json({ success: true, message: 'Session deleted' });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
}

// ─── Standalone Clarification Endpoint ─────────────────────────────────

export async function handleClarify(req: Request, res: Response): Promise<void> {
  const { prompt, provider, images } = req.body as {
    prompt?: string;
    provider?: string;
    images?: string[];
  };

  if (!prompt) { res.status(400).json({ error: 'Prompt is required' }); return; }
  if (provider && !config.providers[provider]) { res.status(400).json({ error: `Unknown provider: ${provider}` }); return; }
  const providerId = provider || '0g';

  try {
    console.log(`[CLARIFY] Checking: "${prompt}" with provider: ${providerId}`);
    const clarification = await checkClarification(prompt, providerId, images);
    console.log(`[CLARIFY] Result: is_clear=${clarification.isClear}, questions=${clarification.questions.length}`);
    res.json({
      isClear: clarification.isClear,
      questions: clarification.questions,
      expanded: clarification.standardizedPrompt,
      needsClarification: !clarification.isClear && clarification.questions.length > 0,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[CLARIFY] Exception: ${msg}`);
    res.status(500).json({ error: msg });
  }
}
