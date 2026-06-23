#!/usr/bin/env node
/**
 * Chamfer AI - Comprehensive Feature Tests (Fixed)
 */

const BASE_URL = 'http://localhost:4000';
const fs = require('fs');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

let passed = 0;
let failed = 0;

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(name) {
  console.log('\n' + '='.repeat(60));
  log(`TEST: ${name}`, 'bright');
  console.log('='.repeat(60));
}

async function test(name, fn) {
  try {
    await fn();
    log(`  ✓ ${name}`, 'green');
    passed++;
  } catch (error) {
    log(`  ✗ ${name}: ${error.message}`, 'red');
    failed++;
  }
}

async function parseSSEResponse(res) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let events = [];
  let doneEvent = null;
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    
    // SSE events are separated by double newlines
    const parts = buffer.split('\n\n');
    buffer = parts.pop(); // Keep incomplete part
    
    for (const event of parts) {
      if (!event.trim()) continue;
      const lines = event.split('\n');
      let eventName = '';
      let dataStr = '';
      
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventName = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          dataStr += line.slice(6);
        }
      }
      
      if (dataStr) {
        try {
          const data = JSON.parse(dataStr);
          events.push({ event: eventName, ...data });
          if (eventName === 'done' && data.success) {
            doneEvent = data;
          }
        } catch (e) {
          // Ignore parse errors for incomplete data
        }
      }
    }
  }
  
  // Process remaining buffer
  if (buffer.trim()) {
    const lines = buffer.split('\n');
    let eventName = '';
    let dataStr = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) eventName = line.slice(7).trim();
      else if (line.startsWith('data: ')) dataStr += line.slice(6);
    }
    if (dataStr && eventName) {
      try {
        const data = JSON.parse(dataStr);
        if (eventName === 'done' && data.success) doneEvent = data;
      } catch (e) {}
    }
  }
  
  return { events, doneEvent };
}

// ===================== TESTS =====================

async function testVisionClarifier() {
  section('Vision Clarifier');
  
  await test('Analyze hammer image', async () => {
    const img = fs.readFileSync('/home/abhieren/Drive/Projects/CAD_AI/hammer.webp').toString('base64');
    const res = await fetch(`${BASE_URL}/api/clarify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'build this hammer',
        images: [`data:image/webp;base64,${img}`],
        provider: 'mimo'
      })
    });
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // Image is clear enough - model should analyze it (may or may not need questions)
    if (!data.expanded || data.expanded.length < 10) throw new Error('No expanded prompt generated');
    log(`    Questions: ${data.questions.length}`, 'cyan');
    log(`    Expanded: ${data.expanded.substring(0, 80)}...`, 'cyan');
    log(`    Needs clarification: ${data.needsClarification}`, 'cyan');
  });

  await test('Analyze mug image', async () => {
    const img = fs.readFileSync('/home/abhieren/Drive/Projects/CAD_AI/mug.webp').toString('base64');
    const res = await fetch(`${BASE_URL}/api/clarify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'build this mug',
        images: [`data:image/webp;base64,${img}`],
        provider: 'mimo'
      })
    });
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.questions || data.questions.length === 0) throw new Error('No questions asked');
    log(`    Questions: ${data.questions.length} - ${data.questions[0].question.substring(0, 60)}...`, 'cyan');
  });

  await test('Analyze screw image', async () => {
    const img = fs.readFileSync('/home/abhieren/Drive/Projects/CAD_AI/screw.webp').toString('base64');
    const res = await fetch(`${BASE_URL}/api/clarify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'build this screw',
        images: [`data:image/webp;base64,${img}`],
        provider: 'mimo'
      })
    });
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.questions || data.questions.length === 0) throw new Error('No questions asked');
    log(`    Questions: ${data.questions.length}`, 'cyan');
  });
}

async function testBasicGeneration() {
  section('Basic Generation with Sessions');
  
  await test('Generate cube with session creation', async () => {
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'a cube 50mm',
        provider: 'mimo'
      })
    });
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { events, doneEvent } = await parseSSEResponse(res);
    
    if (!doneEvent) throw new Error('No done event received');
    if (!doneEvent.sessionId) throw new Error('No sessionId in done event');
    if (!doneEvent.code) throw new Error('No code generated');
    if (!doneEvent.parameters) throw new Error('No parameters');
    
    log(`    Session: ${doneEvent.sessionId}`, 'cyan');
    log(`    Events: ${events.length} SSE events`, 'cyan');
    log(`    Code: ${doneEvent.code.length} chars`, 'cyan');
    log(`    Params: ${Object.keys(doneEvent.parameters).length} parameters`, 'cyan');
    
    global.testSessionId = doneEvent.sessionId;
    global.testCode = doneEvent.code;
  });
}

async function testSessionManagement() {
  section('Session Management');
  
  await test('Retrieve session by ID', async () => {
    if (!global.testSessionId) throw new Error('No session ID');
    const res = await fetch(`${BASE_URL}/api/sessions/${global.testSessionId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.messages || data.messages.length < 2) throw new Error('Session missing messages');
    log(`    Messages: ${data.messages.length}`, 'cyan');
    log(`    Has code: ${!!data.currentCode}`, 'cyan');
  });

  await test('Session contains user and assistant messages', async () => {
    const res = await fetch(`${BASE_URL}/api/sessions/${global.testSessionId}`);
    const data = await res.json();
    const userMsgs = data.messages.filter(m => m.role === 'user');
    const assistantMsgs = data.messages.filter(m => m.role === 'assistant');
    if (userMsgs.length === 0) throw new Error('No user messages');
    if (assistantMsgs.length === 0) throw new Error('No assistant messages');
    log(`    User: ${userMsgs.length}, Assistant: ${assistantMsgs.length}`, 'cyan');
  });
}

async function testEditMode() {
  section('Edit Mode');
  
  await test('Edit existing design with session context', async () => {
    if (!global.testSessionId) throw new Error('No session ID');
    
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'make it 100mm instead',
        provider: 'mimo',
        sessionId: global.testSessionId,
        editMode: true
      })
    });
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { events, doneEvent } = await parseSSEResponse(res);
    
    if (!doneEvent) throw new Error('No done event');
    if (doneEvent.sessionId !== global.testSessionId) {
      throw new Error(`Session ID changed: ${global.testSessionId} → ${doneEvent.sessionId}`);
    }
    log(`    Session preserved: ${doneEvent.sessionId}`, 'cyan');
    log(`    Events: ${events.length} SSE events`, 'cyan');
    log(`    Code length: ${doneEvent.code.length} chars`, 'cyan');
    
    global.editSessionId = doneEvent.sessionId;
  });

  await test('Verify edit history preserved', async () => {
    if (!global.editSessionId) throw new Error('No edit session ID');
    const res = await fetch(`${BASE_URL}/api/sessions/${global.editSessionId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.messages.length < 4) {
      throw new Error(`Expected 4+ messages, got ${data.messages.length}`);
    }
    log(`    Total messages: ${data.messages.length} (${data.messages.length / 2} turns)`, 'cyan');
  });

  await test('Delete session', async () => {
    const res = await fetch(`${BASE_URL}/api/sessions/${global.editSessionId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error('Delete failed');
    
    // Verify it's gone
    const checkRes = await fetch(`${BASE_URL}/api/sessions/${global.editSessionId}`);
    if (checkRes.ok) throw new Error('Session still exists');
    log(`    Session deleted and verified gone`, 'cyan');
  });
}

async function testContextTruncation() {
  section('Context Truncation');
  
  let sessionId = null;
  
  await test('Create session with initial message', async () => {
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'a cube 50mm',
        provider: 'mimo'
      })
    });
    
    const { doneEvent } = await parseSSEResponse(res);
    if (!doneEvent?.sessionId) throw new Error('No sessionId');
    sessionId = doneEvent.sessionId;
    log(`    Created session: ${sessionId}`, 'cyan');
  });

  await test('Add 3 follow-up messages (multi-turn conversation)', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`${BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `make the cube ${50 + (i + 1) * 10}mm on each side`,
          provider: 'mimo',
          sessionId: sessionId
        })
      });
      await parseSSEResponse(res);
    }
    
    const res = await fetch(`${BASE_URL}/api/sessions/${sessionId}`);
    const data = await res.json();
    if (data.messages.length < 6) {
      throw new Error(`Expected 6+ messages, got ${data.messages.length}`);
    }
    log(`    Session has ${data.messages.length} messages (${data.messages.length / 2} turns)`, 'cyan');
  });

  await test('Generation with long context still works', async () => {
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'a sphere 30mm',
        provider: 'mimo',
        sessionId: sessionId
      })
    });
    
    const { doneEvent } = await parseSSEResponse(res);
    if (!doneEvent) throw new Error('No done event with long context');
    if (!doneEvent.code) throw new Error('No code generated');
    log(`    Long context generation succeeded`, 'cyan');
    log(`    Code: ${doneEvent.code.length} chars`, 'cyan');
  });

  // Cleanup
  await fetch(`${BASE_URL}/api/sessions/${sessionId}`, { method: 'DELETE' });
}

async function testProviderList() {
  section('Provider Availability');
  
  const res = await fetch(`${BASE_URL}/api/providers`);
  const data = await res.json();
  
  let availableCount = 0;
  for (const provider of data.providers) {
    if (provider.hasKey) availableCount++;
    await test(`Provider ${provider.id} (${provider.name})`, async () => {
      if (!provider.hasKey) {
        throw new Error('No API key configured');
      }
      log(`    Vision: ${provider.supportsVision || false}`, 'cyan');
    });
  }
  log(`  Total available: ${availableCount}/${data.providers.length}`, 'cyan');
}

// ===================== MAIN =====================

async function main() {
  console.log(`${colors.bright}${colors.blue}
╔═══════════════════════════════════════════════════════════╗
║     Chamfer AI - Comprehensive Feature Tests            ║
║              Buildathon Demo Validation                    ║
╚═══════════════════════════════════════════════════════════╝${colors.reset}\n`);

  const startTime = Date.now();

  try {
    await testProviderList();
    await testVisionClarifier();
    await testBasicGeneration();
    await testSessionManagement();
    await testEditMode();
    await testContextTruncation();
  } catch (error) {
    log(`\nFatal error: ${error.message}`, 'red');
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(60));
  const color = failed > 0 ? 'yellow' : 'green';
  log(`Results: ${passed} passed, ${failed} failed`, color);
  log(`Duration: ${duration}s`, 'cyan');
  console.log('='.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

main();
