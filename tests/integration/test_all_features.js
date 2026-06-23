#!/usr/bin/env node
/**
 * Chamfer AI - Comprehensive Integration Test Script
 * Tests all major features: vision, sessions, edit mode, context truncation, generation
 */

const BASE_URL = process.env.AI_SERVER_URL || 'http://localhost:4000';
const CAD_URL = process.env.CAD_SERVER_URL || 'http://localhost:5000';

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

// ===================== TESTS =====================

async function testServerHealth() {
  section('Server Health Checks');

  await test('AI Server responds', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    if (!res.ok) throw new Error(`Status: ${res.status}`);
  });

  await test('CAD Server responds', async () => {
    const res = await fetch(`${CAD_URL}/health`);
    if (!res.ok) throw new Error(`Status: ${res.status}`);
  });

  await test('AI Server providers endpoint', async () => {
    const res = await fetch(`${BASE_URL}/api/providers`);
    const data = await res.json();
    if (!data.providers || data.providers.length === 0) {
      throw new Error('No providers configured');
    }
    log(`    Found ${data.providers.length} providers: ${data.providers.map(p => p.id).join(', ')}`, 'cyan');
  });
}

async function testBasicGeneration() {
  section('Basic Generation (No Vision)');

  await test('Generate cube with mimo', async () => {
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'a cube 50mm',
        provider: 'mimo',
        enableVision: false
      })
    });

    if (!res.ok) throw new Error(`Status: ${res.status}`);
    
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let events = [];
    let sessionId = null;
    let code = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            events.push(data.type);
            if (data.type === 'done' && data.sessionId) {
              sessionId = data.sessionId;
            }
            if (data.type === 'code') {
              code = data.data;
            }
          } catch (e) {}
        }
      }
    }

    if (!events.includes('done')) throw new Error('No done event received');
    if (!sessionId) throw new Error('No sessionId in done event');
    if (!code) throw new Error('No code generated');
    
    log(`    Session ID: ${sessionId}`, 'cyan');
    log(`    Events: ${events.join(' → ')}`, 'cyan');
    
    // Store for later tests
    global.testSessionId = sessionId;
    global.testCode = code;
  });
}

async function testSessionManagement() {
  section('Session Management');

  await test('Retrieve session by ID', async () => {
    if (!global.testSessionId) throw new Error('No session ID from previous test');
    
    const res = await fetch(`${BASE_URL}/api/sessions/${global.testSessionId}`);
    if (!res.ok) throw new Error(`Status: ${res.status}`);
    
    const data = await res.json();
    if (!data.id || !data.messages || data.messages.length === 0) {
      throw new Error('Invalid session data');
    }
    log(`    Session has ${data.messages.length} messages`, 'cyan');
  });

  await test('Delete session', async () => {
    if (!global.testSessionId) throw new Error('No session ID');
    
    const res = await fetch(`${BASE_URL}/api/sessions/${global.testSessionId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error(`Status: ${res.status}`);
    
    // Verify it's gone
    const checkRes = await fetch(`${BASE_URL}/api/sessions/${global.testSessionId}`);
    if (checkRes.ok) throw new Error('Session still exists after deletion');
    log(`    Session deleted successfully`, 'cyan');
  });
}

async function testVisionWithImages() {
  section('Vision with Images');

  // Create a simple test image (1x1 red pixel as base64)
  const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const testImageDataUrl = `data:image/png;base64,${testImageBase64}`;

  await test('Vision clarifier with image', async () => {
    const res = await fetch(`${BASE_URL}/api/clarify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'build this',
        images: [testImageDataUrl],
        provider: 'mimo'
      })
    });

    if (!res.ok) throw new Error(`Status: ${res.status}`);
    const data = await res.json();
    if (!data.questions || data.questions.length === 0) {
      throw new Error('No clarifying questions returned');
    }
    log(`    Questions: ${data.questions.join(', ')}`, 'cyan');
  });

  await test('Generate with image (fallback to text)', async () => {
    // This will test that the server accepts images even if the provider doesn't support vision
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'a simple cube 50mm',
        provider: 'mimo',
        images: [testImageDataUrl],
        enableVision: true
      })
    });

    if (!res.ok) throw new Error(`Status: ${res.status}`);
    
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let events = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            events.push(data.type);
          } catch (e) {}
        }
      }
    }

    if (!events.includes('done')) throw new Error('No done event received');
    log(`    Events: ${events.join(' → ')}`, 'cyan');
  });
}

async function testEditMode() {
  section('Edit Mode');

  await test('Generate initial shape', async () => {
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'a cube 50mm',
        provider: 'mimo'
      })
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let sessionId = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'done' && data.sessionId) {
              sessionId = data.sessionId;
            }
          } catch (e) {}
        }
      }
    }

    if (!sessionId) throw new Error('No sessionId received');
    global.editSessionId = sessionId;
    log(`    Session ID: ${sessionId}`, 'cyan');
  });

  await test('Edit existing design', async () => {
    if (!global.editSessionId) throw new Error('No session ID');
    
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'make it 100mm instead',
        provider: 'mimo',
        sessionId: global.editSessionId,
        editMode: true
      })
    });

    if (!res.ok) throw new Error(`Status: ${res.status}`);
    
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let events = [];
    let newSessionId = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            events.push(data.type);
            if (data.type === 'done' && data.sessionId) {
              newSessionId = data.sessionId;
            }
          } catch (e) {}
        }
      }
    }

    if (!events.includes('done')) throw new Error('No done event received');
    if (newSessionId !== global.editSessionId) {
      throw new Error(`Session ID changed: ${global.editSessionId} → ${newSessionId}`);
    }
    log(`    Same session used: ${newSessionId}`, 'cyan');
    log(`    Events: ${events.join(' → ')}`, 'cyan');
  });

  await test('Verify edit history preserved', async () => {
    if (!global.editSessionId) throw new Error('No session ID');
    
    const res = await fetch(`${BASE_URL}/api/sessions/${global.editSessionId}`);
    if (!res.ok) throw new Error(`Status: ${res.status}`);
    
    const data = await res.json();
    if (data.messages.length < 4) {
      throw new Error(`Expected at least 4 messages (2 turns), got ${data.messages.length}`);
    }
    log(`    Session has ${data.messages.length} messages (2+ turns)`, 'cyan');
  });

  // Cleanup
  await fetch(`${BASE_URL}/api/sessions/${global.editSessionId}`, { method: 'DELETE' });
}

async function testContextTruncation() {
  section('Context Truncation');

  await test('Long conversation history', async () => {
    // Create a session with many messages to test truncation
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'a cube 50mm',
        provider: 'mimo'
      })
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let sessionId = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'done' && data.sessionId) {
              sessionId = data.sessionId;
            }
          } catch (e) {}
        }
      }
    }

    if (!sessionId) throw new Error('No sessionId');
    global.truncateSessionId = sessionId;
    log(`    Created session: ${sessionId}`, 'cyan');
  });

  await test('Add multiple follow-up messages', async () => {
    if (!global.truncateSessionId) throw new Error('No session ID');
    
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`${BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `make it ${50 + (i + 1) * 10}mm`,
          provider: 'mimo',
          sessionId: global.truncateSessionId
        })
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
      }
    }
    
    // Verify session has multiple messages
    const res = await fetch(`${BASE_URL}/api/sessions/${global.truncateSessionId}`);
    const data = await res.json();
    if (data.messages.length < 6) {
      throw new Error(`Expected 6+ messages, got ${data.messages.length}`);
    }
    log(`    Session has ${data.messages.length} messages (3 turns)`, 'cyan');
  });

  await test('Generation with long context still works', async () => {
    if (!global.truncateSessionId) throw new Error('No session ID');
    
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'a sphere 30mm',
        provider: 'mimo',
        sessionId: global.truncateSessionId
      })
    });

    if (!res.ok) throw new Error(`Status: ${res.status}`);
    
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let events = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            events.push(data.type);
          } catch (e) {}
        }
      }
    }

    if (!events.includes('done')) throw new Error('No done event');
    log(`    Long context generation succeeded`, 'cyan');
  });

  // Cleanup
  await fetch(`${BASE_URL}/api/sessions/${global.truncateSessionId}`, { method: 'DELETE' });
}

async function testCADExecution() {
  section('CAD Server Execution');

  await test('Execute valid CadQuery code', async () => {
    const code = `import cadquery as cq\nresult = cq.Workplane().box(50, 50, 50)\nshow_object(result)`;
    
    const res = await fetch(`${CAD_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });

    if (!res.ok) throw new Error(`Status: ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error('Execution failed');
    if (!data.stl || !data.parameters) throw new Error('Missing output data');
    log(`    Volume: ${data.volume?.toFixed(2)} mm³`, 'cyan');
    log(`    Parameters: ${Object.keys(data.parameters).join(', ')}`, 'cyan');
  });

  await test('Parameter update', async () => {
    const code = `import cadquery as cq\nresult = cq.Workplane().box(50, 50, 50)\nshow_object(result)`;
    
    const res = await fetch(`${CAD_URL}/update-params`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        params: { width: 100 }
      })
    });

    if (!res.ok) throw new Error(`Status: ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error('Parameter update failed');
    log(`    New volume: ${data.volume?.toFixed(2)} mm³`, 'cyan');
  });
}

async function testAllProviders() {
  section('Provider Availability');

  const res = await fetch(`${BASE_URL}/api/providers`);
  const data = await res.json();

  for (const provider of data.providers) {
    await test(`Provider ${provider.id} (${provider.name})`, async () => {
      if (!provider.hasKey) {
        throw new Error('No API key configured');
      }
      log(`    Model: ${provider.model}, Vision: ${provider.vision || false}`, 'cyan');
    });
  }
}

// ===================== MAIN =====================

async function main() {
  console.log(`${colors.bright}${colors.blue}
╔═══════════════════════════════════════════════════════════╗
║     Chamfer AI - Comprehensive Integration Tests       ║
║              Buildathon Demo Validation                    ║
╚═══════════════════════════════════════════════════════════╝${colors.reset}\n`);

  const startTime = Date.now();

  try {
    await testServerHealth();
    await testAllProviders();
    await testBasicGeneration();
    await testSessionManagement();
    await testVisionWithImages();
    await testEditMode();
    await testContextTruncation();
    await testCADExecution();
  } catch (error) {
    log(`\nFatal error: ${error.message}`, 'red');
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(60));
  log(`Results: ${passed} passed, ${failed} failed`, failed > 0 ? 'red' : 'green');
  log(`Duration: ${duration}s`, 'cyan');
  console.log('='.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

main();
