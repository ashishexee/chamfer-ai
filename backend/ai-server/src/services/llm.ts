import OpenAI from 'openai';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { config } from '../config';
import { buildInitialPrompt, buildPromptWithRefs, validateRequestedFiles, RETRY_TEMPLATE } from '../lib/loader';
import { CLARIFIER_SYSTEM_PROMPT } from './clarifier-prompt';

// ─── JSON Response Extraction ────────────────────────────────────────

export interface CadQueryResult {
  code: string | null;
  parameters: Record<string, ParameterSchema>;
  description: string;
  tags: string[];
  context_needed?: string[];
  reason?: string;
}

export interface ParameterSchema {
  type: 'int' | 'float' | 'bool' | 'string' | 'enum' | 'color';
  default: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
  options?: string[];
}

export function extractJSONFromResponse(text: string): { data: CadQueryResult | null; error: string | null } {
  // Strip markdown fences if present
  let clean = text.trim();
  
  // Remove ```json or ``` fences
  const jsonFenceMatch = clean.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (jsonFenceMatch) {
    clean = jsonFenceMatch[1].trim();
  }
  
  // Strategy 1: Try to parse as-is first (sometimes it works)
  try {
    const parsed = JSON.parse(clean);
    
    // Handle context_needed responses (progressive loading)
    if (parsed.context_needed && Array.isArray(parsed.context_needed)) {
      return {
        data: {
          code: parsed.code || null,
          parameters: parsed.parameters || {},
          description: parsed.description || '',
          tags: parsed.tags || [],
          context_needed: parsed.context_needed,
          reason: parsed.reason || '',
        },
        error: null,
      };
    }
    
    // Handle normal code responses
    if (parsed.code && typeof parsed.code === 'string' && parsed.parameters && typeof parsed.parameters === 'object') {
      return {
        data: {
          code: parsed.code,
          parameters: parsed.parameters || {},
          description: parsed.description || '',
          tags: parsed.tags || [],
        },
        error: null,
      };
    }
  } catch {
    // Continue to strategy 2
  }
  
  // Strategy 2: Extract code block and reconstruct JSON
  // This is more robust for LLM-generated code with special characters
  const reconstructed = extractAndReconstructJSON(clean);
  if (reconstructed) {
    return {
      data: reconstructed,
      error: null,
    };
  }
  
  // Strategy 3: Find first { and last } and try standard repair
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return { data: null, error: 'No JSON object found in response' };
  }
  
  let jsonStr = clean.slice(firstBrace, lastBrace + 1);
  
  // Try to repair common LLM JSON errors
  // Remove trailing commas before } or ]
  jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
  
  // Fix single quotes used as JSON string delimiters (common LLM mistake)
  jsonStr = jsonStr.replace(/'([^']*)':/g, '"$1":');
  
  try {
    const parsed = JSON.parse(jsonStr);
    
    // Validate required fields
    if (!parsed.code || typeof parsed.code !== 'string') {
      return { data: null, error: 'Missing or invalid "code" field in JSON' };
    }
    if (!parsed.parameters || typeof parsed.parameters !== 'object') {
      return { data: null, error: 'Missing or invalid "parameters" field in JSON' };
    }
    
    return {
      data: {
        code: parsed.code,
        parameters: parsed.parameters || {},
        description: parsed.description || '',
        tags: parsed.tags || [],
      },
      error: null,
    };
  } catch (e) {
    return { data: null, error: `JSON parse error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * Robust extraction: finds the code block by looking for the "parameters" key that follows it,
 * then reconstructs valid JSON from the parts.
 */
function extractAndReconstructJSON(text: string): CadQueryResult | null {
  try {
    // Find the code key
    const codeKeyMatch = text.match(/"code"\s*:\s*/);
    if (!codeKeyMatch) return null;
    
    const codeStart = text.indexOf(codeKeyMatch[0]) + codeKeyMatch[0].length;
    
    // Find the parameters key that follows the code
    const paramsKeyMatch = text.match(/",\s*"parameters"\s*:/);
    if (!paramsKeyMatch) return null;
    
    const codeEnd = text.indexOf(paramsKeyMatch[0], codeStart);
    if (codeEnd === -1) return null;
    
    // Extract the raw code string (between code key and parameters key)
    // The code starts after the opening quote and ends before the closing quote
    let rawCode = text.slice(codeStart, codeEnd + 1); // +1 to include the closing quote
    
    // Remove surrounding quotes if present
    if (rawCode.startsWith('"')) rawCode = rawCode.slice(1);
    if (rawCode.endsWith('"')) rawCode = rawCode.slice(0, -1);
    
    // Unescape JSON sequences to get actual code
    const code = rawCode
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
    
    // Extract parameters object - find the matching closing brace
    const paramsStart = text.indexOf(paramsKeyMatch[0]) + paramsKeyMatch[0].length - 1; // -1 to include the {
    // Find the matching } by counting braces
    let braceCount = 1;
    let paramsEnd = paramsStart + 1;
    while (braceCount > 0 && paramsEnd < text.length) {
      if (text[paramsEnd] === '{') braceCount++;
      else if (text[paramsEnd] === '}') braceCount--;
      else if (text[paramsEnd] === '"') {
        // Skip string content
        paramsEnd++;
        while (paramsEnd < text.length && text[paramsEnd] !== '"') {
          if (text[paramsEnd] === '\\') paramsEnd++;
          paramsEnd++;
        }
      }
      paramsEnd++;
    }
    
    const paramsStr = text.slice(paramsStart, paramsEnd);
    let parameters = {};
    try {
      parameters = JSON.parse(paramsStr);
    } catch {
      // Try to extract with simple regex if parsing fails
      const simpleMatch = paramsStr.match(/\{[\s\S]*\}/);
      if (simpleMatch) {
        try {
          parameters = JSON.parse(simpleMatch[0]);
        } catch {
          parameters = {};
        }
      }
    }
    
    // Extract description
    const descMatch = text.slice(paramsEnd).match(/"description"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/);
    const description = descMatch ? descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : '';
    
    // Extract tags
    const tagsMatch = text.slice(paramsEnd).match(/"tags"\s*:\s*(\[[\s\S]*?\])/);
    let tags: string[] = [];
    if (tagsMatch) {
      try {
        tags = JSON.parse(tagsMatch[1]);
      } catch {
        tags = [];
      }
    }
    
    return {
      code,
      parameters,
      description,
      tags,
    };
  } catch {
    return null;
  }
}

// ─── Fast AST Syntax Check ──────────────────────────────────────────

export interface ASTCheckResult {
  valid: boolean;
  error?: string;
}

export async function fastSyntaxCheck(code: string): Promise<ASTCheckResult> {
  return new Promise((resolve) => {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const escapedCode = code.replace(/'''/g, "\\'''").replace(/\\/g, '\\\\');
    const python = spawn(pythonCmd, ['-c', `import ast; ast.parse('''${escapedCode}''')`], {
      timeout: 5000,
    });
    
    let stderr = '';
    python.stderr.on('data', (data) => { stderr += data.toString(); });
    
    python.on('close', (code) => {
      if (code === 0) {
        resolve({ valid: true });
      } else {
        const errorMatch = stderr.match(/SyntaxError:\s*(.*)/);
        const errorMsg = errorMatch ? errorMatch[1] : (stderr.slice(0, 200) || 'Unknown syntax error');
        resolve({ valid: false, error: `Syntax error: ${errorMsg}` });
      }
    });
    
    python.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        console.warn('[AST] Python not found — skipping syntax check (Docker will catch errors)');
        resolve({ valid: true });
      } else {
        resolve({ valid: false, error: `Failed to run Python AST check: ${err.message}` });
      }
    });
  });
}

// ─── Error Classification (for logging/debugging) ───────────────────

interface FailureClass {
  category: string;
  hint: string;
  priority: 'critical' | 'high' | 'medium';
}

interface ErrorPattern {
  patterns: string[];
  failure: FailureClass;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  {
    patterns: ['must be an iterable', 'argument after * must be'],
    failure: {
      category: 'COMPOUND_ITERABLE',
      priority: 'critical',
      hint: 'A function expected a list/tuple but got a single value. Check .translate((x,y,z)), .rotate((0,0,0),(0,0,1),90), .pushPoints([(x,y),...]).',
    },
  },
  {
    patterns: ['no pending wires', 'no solid to cut from', 'cannot compound'],
    failure: {
      category: 'BUILD_ORDER',
      priority: 'critical',
      hint: 'Called an operation that needs a solid before creating one. Extrude first, then cut/fillet.',
    },
  },
  {
    patterns: ['no wire to close', 'cannot close wire'],
    failure: {
      category: 'WIRE_NOT_CLOSED',
      priority: 'critical',
      hint: 'Called .close() or .extrude() on an unclosed profile. Start with .moveTo() and end with .close().',
    },
  },
  {
    patterns: ['no start point specified', 'cannot close'],
    failure: {
      category: 'NO_START_POINT',
      priority: 'critical',
      hint: 'Called .close() without .moveTo() first. Always start custom profiles with .moveTo().',
    },
  },
  {
    patterns: ['no suitable edges', 'standard failure: make-fillet', 'standard failure: make-chamfer', 'BRep_API: command not done'],
    failure: {
      category: 'FILLET_CHAMFER',
      priority: 'high',
      hint: 'Fillet/chamfer failed. Radius must be LESS than half the adjacent thickness/dimension. Remove fillets entirely OR reduce radius to 1.0. Check that edges exist before filleting.',
    },
  },
  {
    patterns: ['null topods', 'boolean operation failed', 'cut from a null'],
    failure: {
      category: 'BOOLEAN_FAILURE',
      priority: 'critical',
      hint: 'Boolean operation failed. Check that solids overlap. Extend cutting tools beyond the target.',
    },
  },
  {
    patterns: ['has no attribute', 'attributeerror'],
    failure: {
      category: 'API_ERROR',
      priority: 'high',
      hint: 'Used a non-existent CadQuery method. Check method names and use only documented API.',
    },
  },
  {
    patterns: ['cq.math', "module 'cadquery' has no attribute 'math'"],
    failure: {
      category: 'API_ERROR',
      priority: 'high',
      hint: 'NEVER use cq.math. Use Python built-in math: math.sin, math.cos, math.radians, math.sqrt.',
    },
  },
  {
    patterns: ["'r' not in dir", 'no variable', 'did not define variable'],
    failure: {
      category: 'MISSING_R',
      priority: 'critical',
      hint: 'The code must assign the final 3D model to variable `result`. Add: result = <your geometry>',
    },
  },
  {
    patterns: ['syntaxerror', 'indentationerror'],
    failure: {
      category: 'SYNTAX',
      priority: 'medium',
      hint: 'Python syntax error. Check indentation, colons, parentheses, and quotes.',
    },
  },
  {
    patterns: ['typeerror', 'argument', 'takes', 'must be an iterable'],
    failure: {
      category: 'TYPE_ERROR',
      priority: 'high',
      hint: 'Wrong argument types. .translate() needs ONE tuple. .rotate() needs (start,end,angle).',
    },
  },
  {
    patterns: ['selector', 'no faces', 'no edges'],
    failure: {
      category: 'SELECTOR',
      priority: 'medium',
      hint: 'Selector found no matching faces/edges. Use ">Z", "<Z", "|Z", "%CIRCLE".',
    },
  },
  {
    patterns: ['wire', 'brep', 'topods', 'standard_failure'],
    failure: {
      category: 'WIRE_TOPOLOGY',
      priority: 'high',
      hint: '2D profile has topology issues. Ensure .close() before .extrude(). Check for self-intersections.',
    },
  },
  {
    patterns: ['assert', 'runtimeerror'],
    failure: {
      category: 'RUNTIME',
      priority: 'medium',
      hint: 'CadQuery internal assertion failed. Check positive extrude values, hole diameters, boolean overlaps.',
    },
  },
  {
    patterns: ['zerodivision', 'division by zero', 'math domain'],
    failure: {
      category: 'MATH_ERROR',
      priority: 'medium',
      hint: 'Math domain error — sqrt of negative, log of zero, or division by zero.',
    },
  },
  {
    patterns: ['import', 'modulenotfounderror'],
    failure: {
      category: 'IMPORT_ERROR',
      priority: 'medium',
      hint: 'Missing import. Only cadquery and math are available.',
    },
  },
];

export function classifyError(error: string): { category: string; hint: string; priority: string } {
  const e = error.toLowerCase();
  for (const { patterns, failure } of ERROR_PATTERNS) {
    if (patterns.some(p => e.includes(p))) {
      return { category: failure.category, hint: failure.hint, priority: failure.priority };
    }
  }
  return {
    category: 'UNKNOWN',
    hint: 'Unexpected error. Simplify the geometry — use basic primitives and boolean operations.',
    priority: 'medium',
  };
}

// ─── Inspection Feedback ─────────────────────────────────────────────

export function buildInspectionFeedback(inspection: any): string {
  if (!inspection) return '';
  const parts: string[] = [];
  if (inspection.errors && inspection.errors.length > 0) {
    parts.push('Geometry inspection found errors:');
    for (const err of inspection.errors) parts.push(`- ${err}`);
  }
  if (inspection.warnings && inspection.warnings.length > 0) {
    parts.push('Geometry inspection warnings:');
    for (const w of inspection.warnings) parts.push(`- ${w}`);
  }
  if (parts.length > 0) parts.push('Fix the code and return the complete updated JSON.');
  return parts.join('\n');
}

export function buildValidationFeedback(validation: any): string {
  if (!validation) return '';
  const warnings = validation.warnings || [];
  if (warnings.length === 0) return '';
  const parts: string[] = [];
  parts.push('Geometry validation found issues:');
  if (validation.volume === 0 || !validation.has_volume) {
    parts.push('- The model has ZERO volume. Use .extrude(), .revolve(), or .box() to create a solid body.');
  }
  if (validation.bounding_box) {
    const size = validation.bounding_box.size;
    if (size && size.some((s: number) => s > 10000)) {
      parts.push(`- The model is very large (${size.join('x')}mm). Check units — use millimeters.`);
    }
    if (size && size.some((s: number) => s > 0 && s < 0.01)) {
      parts.push(`- The model is very small (${size.join('x')}mm). Check units — use millimeters.`);
    }
  }
  if (validation.is_valid === false) {
    parts.push('- The shape is not a valid B-rep solid. Check for self-intersecting geometry or incomplete booleans.');
  }
  for (const w of warnings) {
    if (!parts.some(p => p.includes(w))) parts.push(`- ${w}`);
  }
  parts.push('Fix the code and return the complete updated JSON.');
  return parts.join('\n');
}

// ─── LLM Streaming Call ──────────────────────────────────────────────

export interface ZeroGMetadata {
  model: string;
  requestId: string;
  providerAddress: string;
  teeVerified?: boolean;
  billing: {
    inputCost: string;
    outputCost: string;
    totalCost: string;
  };
  tokens: {
    prompt: number;
    completion: number;
    reasoning: number;
    total: number;
  };
}

export interface LLMResult {
  code: string;
  rawResponse: string;
  reasoning: string;
  parameters: Record<string, ParameterSchema>;
  description: string;
  tags: string[];
  zeroG?: ZeroGMetadata;
}

export interface StreamCallbacks {
  onReasoning: (chunk: string) => void;
  onContent: (chunk: string) => void;
  onDone: (result: LLMResult) => void;
  onError: (error: string) => void;
}

import { buildVisionContent } from './vision';
import type { SessionMessage } from './session';
import { truncateHistory, logTokenCounts, getMaxContextTokens } from './context-manager';

export interface GenerateOptions {
  prompt: string;
  images?: string[];
  sessionHistory?: SessionMessage[];
  previousCode?: string;
  errorFeedback?: string;
  providerId?: string;
  callbacks?: StreamCallbacks;
}

export async function generateCadQueryCodeStream(
  options: GenerateOptions,
): Promise<LLMResult> {
  const { prompt, images, sessionHistory, previousCode, errorFeedback, providerId, callbacks } = options;
  const provider = config.providers[providerId || '0g'] || config.providers['0g'];
  const llm = new OpenAI({ apiKey: provider.apiKey, baseURL: provider.baseUrl });
  const isZeroG = provider.isZeroG === true;
  const maxPhases = 3;
  
  // Track loaded files across phases
  let loadedFiles: string[] = [];
  
  for (let phase = 1; phase <= maxPhases; phase++) {
    console.log(`[LLM] Phase ${phase}/${maxPhases}`);
    
    // Build system prompt based on loaded files
    const systemPrompt = loadedFiles.length === 0
      ? buildInitialPrompt()
      : buildPromptWithRefs(loadedFiles);
    
    let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add session history if available
    if (sessionHistory && sessionHistory.length > 0) {
      for (const msg of sessionHistory) {
        let messageContent = msg.content;
        if (msg.clarificationHistory && msg.clarificationHistory.answers) {
          messageContent = `Previous clarification:
Q: ${msg.clarificationHistory.questions.join('\nQ: ')}
A: ${msg.clarificationHistory.answers}

${messageContent}`;
        }
        
        if (msg.images && msg.images.length > 0) {
          if (msg.role === 'user') {
            messages.push({
              role: 'user',
              content: buildVisionContent(messageContent, msg.images),
            } as OpenAI.Chat.Completions.ChatCompletionMessageParam);
          } else {
            messages.push({ role: 'assistant', content: messageContent });
          }
        } else if (msg.role === 'system') {
          continue;
        } else {
          messages.push({ role: msg.role as 'user' | 'assistant', content: messageContent });
        }
      }
    }

    if (previousCode && errorFeedback) {
      messages.push({ role: 'assistant', content: JSON.stringify({ code: previousCode }) });
      messages.push({ role: 'user', content: errorFeedback });
    }

    // Add current user message
    if (images && images.length > 0) {
      messages.push({
        role: 'user',
        content: buildVisionContent(prompt, images),
      });
    } else {
      messages.push({ role: 'user', content: prompt });
    }

    // Log token counts
    logTokenCounts(messages, `generate-phase${phase}-${providerId || '0g'}`);
    
    console.log(`[LLM] Provider: ${providerId || '0g'}, Model: ${provider.model}, Phase: ${phase}, Loaded files: ${loadedFiles.length}`);

    let fullContent = '';
    let fullReasoning = '';
    let lastChunk: any = null;

    try {
      const stream = await llm.chat.completions.create({
        model: provider.model,
        messages,
        ...(isZeroG ? { max_tokens: 32768, verify_tee: true } : {}),
        temperature: 0.2,
        stream: true,
      } as any);

      for await (const chunk of stream) {
        lastChunk = chunk;
        const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      const reasoningChunk = (delta as any)?.reasoning_content;
      if (reasoningChunk) {
        fullReasoning += reasoningChunk;
        callbacks?.onReasoning(reasoningChunk);
      }

      const contentChunk = delta?.content;
      if (contentChunk) {
        fullContent += contentChunk;
        callbacks?.onContent(contentChunk);
      }
    }

    // Extract JSON from the complete response
    console.log(`[LLM] Raw response (${fullContent.length} chars): ${fullContent.slice(0, 500)}...`);
    const { data, error: extractError } = extractJSONFromResponse(fullContent);
    
    if (!data) {
      console.error(`[LLM] JSON extraction failed: ${extractError}`);
      console.error(`[LLM] Full raw response: ${fullContent}`);
      // On extraction failure, try to continue to next phase
      continue;
    }

    console.log(`[LLM] Stream done. Content: ${fullContent.length} chars, Reasoning: ${fullReasoning.length} chars`);

    // Check if LLM requested more context (progressive loading)
    const contextNeeded = (data as any).context_needed;
    if (contextNeeded && contextNeeded.length > 0 && !data.code) {
      // Phase transition: LLM requested more context
      const newFiles = validateRequestedFiles(contextNeeded)
        .filter(f => !loadedFiles.includes(f));

      if (newFiles.length === 0) {
        console.error(`[LLM] Context request but no new files available: ${contextNeeded.join(', ')}`);
        continue; // Try again with same context
      }

      // Cache loaded files
      loadedFiles.push(...newFiles);
      console.log(`[LLM] Phase ${phase}: Loaded ${newFiles.join(', ')}`);
      
      // Emit content about loading
      callbacks?.onContent?.(`[Loading context: ${newFiles.join(', ')}]`);
      continue; // Next phase
    }

    // Code generated — return result
    console.log(`[LLM] Code generated: ${data.code.length} chars, Params: ${Object.keys(data.parameters).length}`);
    
    // Extract 0G-specific metadata if available
    let zeroGMeta: ZeroGMetadata | undefined;
    if (isZeroG && lastChunk) {
      const usage = (lastChunk as any).usage;
      const trace = (lastChunk as any).x_0g_trace;
      if (usage || trace) {
        zeroGMeta = {
          model: (lastChunk as any).model || provider.model,
          requestId: trace?.request_id || '',
          providerAddress: trace?.provider || '',
          teeVerified: trace?.tee_verified === true,
          billing: {
            inputCost: trace?.billing?.input_cost || '',
            outputCost: trace?.billing?.output_cost || '',
            totalCost: trace?.billing?.total_cost || '',
          },
          tokens: {
            prompt: usage?.prompt_tokens || 0,
            completion: usage?.completion_tokens || 0,
            reasoning: usage?.reasoning_tokens || 0,
            total: usage?.total_tokens || 0,
          },
        };
        console.log(`[0G] Metadata captured: ${zeroGMeta.tokens.total} tokens, cost: ${zeroGMeta.billing.totalCost}`);
      }
    }

    const result: LLMResult = {
      code: data.code,
      rawResponse: fullContent,
      reasoning: fullReasoning,
      parameters: data.parameters,
      description: data.description,
      tags: data.tags,
      zeroG: zeroGMeta,
    };
    
    callbacks?.onDone(result);
    return result;
    
  } catch (e: unknown) {
    const err = e as any;
    if (err.message === 'terminated' || err.code === 'ECONNRESET' || err.type === 'aborted') {
      console.error(`[LLM] Stream terminated prematurely`);
      continue; // Try next phase
    }
    const errorMsg = `${err.constructor?.name}: ${err.message}`;
    console.error(`[LLM] ERROR: ${errorMsg}`);
    callbacks?.onError(errorMsg);
    // Continue to next phase on error
    continue;
  }
  } // End of phase loop

  // If we exhaust all phases without generating code, throw error
  throw new Error('Failed to generate code after maximum phases');
}

// ─── Visual Inspection (Vision-Capable Models Only) ──────────────────

export interface VisionInspectionResult {
  needsFix: boolean;
  feedback: string;
}

export async function inspectWithVision(
  originalPrompt: string,
  code: string,
  pngSnapshots: Record<string, string>,
  inspection: any,
  providerId: string,
): Promise<VisionInspectionResult> {
  const provider = config.providers[providerId] || config.providers['0g'];

  if (!provider.supportsVision) {
    return { needsFix: false, feedback: 'Vision not supported by provider' };
  }

  const llm = new OpenAI({ apiKey: provider.apiKey, baseURL: provider.baseUrl });

  const inspectionSummary = inspection
    ? `Bounding box: ${inspection.bounding_box?.size?.join('x') || 'unknown'}mm, Volume: ${inspection.volume?.toFixed(1) || 'unknown'}mm³, Faces: ${inspection.face_count || 'unknown'}, Valid: ${inspection.is_valid}`
    : 'No inspection data available';

  const content: any[] = [
    {
      type: 'text',
      text: `You are reviewing a CAD model generated from this request: "${originalPrompt}"

The CadQuery code that generated it:
\`\`\`python
${code}
\`\`\`

Inspection data: ${inspectionSummary}

Please review the rendered snapshots below and check:
1. Does the geometry match the user's request?
2. Are there any obvious defects (missing features, wrong proportions, etc.)?
3. Does the overall shape make sense?

Respond with:
- "PASS" if the model looks correct
- "FIX: <description>" if you see issues that need fixing`,
    },
  ];

  for (const [view, b64] of Object.entries(pngSnapshots)) {
    if (b64 && !b64.includes('error')) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${b64}` },
      });
    }
  }

  try {
    const response = await llm.chat.completions.create({
      model: provider.model,
      messages: [{ role: 'user', content }],
      temperature: 0.1,
    });

    const responseText = response.choices[0]?.message?.content || '';
    console.log(`[VISION] Response: ${responseText.slice(0, 200)}`);

    // Check for FIX first (more specific indicator of issues)
    // Use stricter check: must start with FIX or have "FIX:" in the text
    if (/^\s*FIX\b/i.test(responseText) || /FIX:\s*/i.test(responseText)) {
      const fixMatch = responseText.match(/FIX:\s*(.*)/i);
      return { needsFix: true, feedback: fixMatch?.[1]?.trim() || responseText };
    }

    // Only PASS if no FIX found and text explicitly says PASS
    if (/^\s*PASS\b/i.test(responseText)) {
      return { needsFix: false, feedback: responseText };
    }

    return { needsFix: false, feedback: responseText };
  } catch (e: unknown) {
    const err = e as any;
    console.error(`[VISION] Error: ${err.message}`);
    return { needsFix: false, feedback: `Vision inspection failed: ${err.message}` };
  }
}

// ─── Clarification Agent ───────────────────────────────────────────────

export interface ClarificationQuestion {
  question: string;
  key: string;
  options: string[];
  default: string;
}

export interface ClarificationResult {
  isClear: boolean;
  questions: ClarificationQuestion[];
  standardizedPrompt: string;
}

/**
 * Extracts a ClarificationResult from raw LLM text (JSON parsing + repair).
 */
export function extractClarification(text: string): ClarificationResult | null {
  // Strip thinking tags (0G model and similar reasoning models emit these)
  let clean = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  // Strip markdown fences if present
  const jsonFenceMatch = clean.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (jsonFenceMatch) clean = jsonFenceMatch[1].trim();

  // Extract JSON using regex (handle both ```json blocks and raw JSON)
  const jsonMatch = clean.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) ||
                     clean.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) {
    console.error(`[CLARIFIER] No JSON object found in response`);
    return null;
  }

  let jsonStr = jsonMatch[1];
  jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');

  let data: any;
  try {
    data = JSON.parse(jsonStr);
  } catch (e) {
    console.error(`[CLARIFIER] JSON parse error: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }

  // Support both snake_case (old format) and camelCase (new format)
  const isClear = data.is_clear ?? data.isClear;
  const standardizedPrompt = data.standardized_prompt ?? data.standardizedPrompt ?? '';
  const questionsArray = data.questions;

  if (typeof isClear !== 'boolean' || typeof standardizedPrompt !== 'string' || !Array.isArray(questionsArray)) {
    console.error(`[CLARIFIER] Invalid JSON structure: missing is_clear/isClear, standardized_prompt/standardizedPrompt, or questions`);
    return null;
  }

  const questions: ClarificationQuestion[] = questionsArray.map((q: any) => ({
    question: String(q.question || ''),
    key: String(q.key || ''),
    options: Array.isArray(q.options) ? q.options.map(String) : [],
    default: String(q.default || ''),
  })).filter((q: ClarificationQuestion) => q.question && q.key);

  return {
    isClear,
    questions,
    standardizedPrompt,
  };
}

/**
 * Checks if a prompt needs clarification.
 * Uses the user's selected provider, validated against config.
 */
export async function checkClarification(
  prompt: string,
  providerId?: string,
  images?: string[],
): Promise<ClarificationResult> {
  const clarifierProviderId = providerId || '0g';
  const provider = config.providers[clarifierProviderId] || config.providers['0g'];

  console.log(`[CLARIFIER] Checking prompt: "${prompt.slice(0, 80)}..." using ${clarifierProviderId}, Images: ${images?.length || 0}`);

  const llm = new OpenAI({ apiKey: provider.apiKey, baseURL: provider.baseUrl });

  try {
    let userContent: any = `Analyze this CAD generation prompt:\n\n${prompt}`;
    if (images && images.length > 0 && provider.supportsVision) {
      userContent = buildVisionContent(`Analyze this CAD generation prompt with reference images:\n\n${prompt}`, images);
    }

    const response = await llm.chat.completions.create({
      model: provider.model,
      messages: [
        { role: 'system', content: CLARIFIER_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
      max_tokens: 2048,
    });

    const rawResponse = response.choices[0]?.message?.content || '';
    console.log(`[CLARIFIER] Response length: ${rawResponse.length} chars`);
    console.log(`[CLARIFIER] Response preview: ${rawResponse.slice(0, 300)}`);

    const result = extractClarification(rawResponse);
    if (!result) {
      console.error(`[CLARIFIER] Parse failed on first attempt, retrying with stricter prompt`);
      try {
        const retryResponse = await llm.chat.completions.create({
          model: provider.model,
          messages: [
            { role: 'system', content: CLARIFIER_SYSTEM_PROMPT + '\n\nCRITICAL: Output ONLY the JSON object. No thinking, no explanations, no markdown fences. Start with { and end with }.' },
            { role: 'user', content: userContent },
          ],
          temperature: 0.0,
          response_format: { type: 'json_object' },
          max_tokens: 2048,
        });
        const retryRaw = retryResponse.choices[0]?.message?.content || '';
        console.log(`[CLARIFIER] Retry response: ${retryRaw.slice(0, 300)}`);
        const retryResult = extractClarification(retryRaw);
        if (retryResult) return retryResult;
      } catch (retryErr) {
        console.error(`[CLARIFIER] Retry also failed: ${(retryErr as any).message}`);
      }
      return { isClear: true, questions: [], standardizedPrompt: prompt };
    }

    // If questions exist, prompt is ALWAYS ambiguous (regardless of is_clear flag)
    if (result.questions.length > 0) {
      console.log(`[CLARIFIER] Found ${result.questions.length} clarifying questions`);
      return {
        isClear: false,
        questions: result.questions,
        standardizedPrompt: result.standardizedPrompt || prompt,
      };
    }

    console.log(`[CLARIFIER] isClear=${result.isClear}, standardizedPrompt="${result.standardizedPrompt.slice(0, 80)}..."`);
    return result;
  } catch (e: unknown) {
    const err = e as any;
    console.error(`[CLARIFIER] Error: ${err.message}`);
    // On error, skip clarification and proceed with original prompt
    return { isClear: true, questions: [], standardizedPrompt: prompt };
  }
}
