const fs = require('fs');
const path = require('path');

const IMAGE_PATH = '/home/abhieren/Drive/Projects/CAD_AI/hammer.webp';
const BASE_URL = 'http://localhost:4000';

async function testVisionClarifier() {
  console.log('Testing vision clarifier with hammer image...');
  
  const imageBuffer = fs.readFileSync(IMAGE_PATH);
  const base64 = imageBuffer.toString('base64');
  const dataUrl = `data:image/webp;base64,${base64}`;
  
  console.log(`Image: ${IMAGE_PATH} (${(base64.length / 1024).toFixed(1)}KB base64)`);
  
  try {
    const res = await fetch(`${BASE_URL}/api/clarify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'build this hammer',
        images: [dataUrl],
        provider: 'mimo'
      })
    });
    
    if (!res.ok) {
      console.error(`HTTP ${res.status}: ${await res.text()}`);
      return;
    }
    
    const data = await res.json();
    console.log('\n✓ Vision clarifier response:');
    console.log(`  Questions: ${JSON.stringify(data.questions)}`);
    console.log(`  Expanded: ${data.expanded || 'N/A'}`);
    console.log(`  NeedsClarification: ${data.needsClarification}`);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function testVisionGeneration() {
  console.log('\nTesting vision generation with hammer image...');
  
  const imageBuffer = fs.readFileSync(IMAGE_PATH);
  const base64 = imageBuffer.toString('base64');
  const dataUrl = `data:image/webp;base64,${base64}`;
  
  try {
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'a hammer 200mm long with a claw head',
        images: [dataUrl],
        provider: 'mimo',
        enableVision: true
      })
    });
    
    if (!res.ok) {
      console.error(`HTTP ${res.status}: ${await res.text()}`);
      return;
    }
    
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
    
    console.log('\n✓ Vision generation complete:');
    console.log(`  Events: ${events.join(' → ')}`);
    console.log(`  Session ID: ${sessionId}`);
    console.log(`  Code length: ${code ? code.length : 0} chars`);
    
    return sessionId;
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function testEditMode(sessionId) {
  if (!sessionId) {
    console.log('\nSkipping edit mode test (no session ID)');
    return;
  }
  
  console.log('\nTesting edit mode...');
  
  try {
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'make it 300mm long and add a rubber grip',
        provider: 'mimo',
        sessionId: sessionId,
        editMode: true
      })
    });
    
    if (!res.ok) {
      console.error(`HTTP ${res.status}: ${await res.text()}`);
      return;
    }
    
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
    
    console.log('\n✓ Edit mode complete:');
    console.log(`  Events: ${events.join(' → ')}`);
    console.log(`  Session preserved: ${newSessionId === sessionId}`);
    
    // Verify session history
    const sessionRes = await fetch(`${BASE_URL}/api/sessions/${sessionId}`);
    const sessionData = await sessionRes.json();
    console.log(`  Session messages: ${sessionData.messages.length} (expected 4+)`);
    
    // Cleanup
    await fetch(`${BASE_URL}/api/sessions/${sessionId}`, { method: 'DELETE' });
    console.log('  Session cleaned up');
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║     Chamfer AI - Vision & Edit Mode Test Suite            ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  const startTime = Date.now();
  
  await testVisionClarifier();
  const sessionId = await testVisionGeneration();
  await testEditMode(sessionId);
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\nCompleted in ${duration}s`);
}

main();
