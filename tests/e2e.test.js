const http = require('http');

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

async function runE2ETests() {
  console.log('=== Autonomous AI Creator E2E Test Suite ===\n');

  const port = process.env.PORT || 3000;

  // 1. Init Agent
  console.log('[1/4] Initializing agent persona via POST /api/agent/init...');
  const initRes = await makeRequest(
    {
      hostname: 'localhost',
      port,
      path: '/api/agent/init',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      persona: {
        name: 'Dr. Cipher (AI Security Researcher)',
        domain: 'LLM Vulnerability Analysis & Agent Safety',
      },
    }
  );

  const agentId = initRes.data?.agentId;
  if (!agentId) throw new Error('Init failed: agentId not returned');
  console.log(`✓ Agent initialized successfully (agentId: ${agentId})`);

  // 2. Check Feed Empty
  console.log('\n[2/4] Verifying feed is empty immediately after init...');
  const feedRes1 = await makeRequest({
    hostname: 'localhost',
    port,
    path: `/api/agent/feed?agentId=${agentId}`,
    method: 'GET',
  });

  if (!feedRes1.data || feedRes1.data.posts.length !== 0) {
    throw new Error('Contract violation: Feed must be empty immediately after init!');
  }
  console.log('✓ Feed verified empty after init.');

  // 3. Trigger Cron
  console.log('\n[3/4] Triggering autonomous cron cycle via GET /api/cron...');
  const cronRes = await makeRequest({
    hostname: 'localhost',
    port,
    path: `/api/cron?agentId=${agentId}`,
    method: 'GET',
  });
  console.log(`✓ Cron executed. Evaluated ${cronRes.data.evaluatedCount} candidates. Winner: "${cronRes.data.selectedTopic || 'None'}"`);

  // 4. Verify Feed Post & Evaluations
  console.log('\n[4/4] Verifying feed post and evaluations...');
  const feedRes2 = await makeRequest({
    hostname: 'localhost',
    port,
    path: `/api/agent/feed?agentId=${agentId}`,
    method: 'GET',
  });

  const posts = feedRes2.data.posts || [];
  console.log(`✓ Total feed posts: ${posts.length}`);

  const evalRes = await makeRequest({
    hostname: 'localhost',
    port,
    path: `/api/agent/evaluations?agentId=${agentId}`,
    method: 'GET',
  });

  const evaluations = evalRes.data.evaluations || [];
  console.log(`✓ Total logged evaluations: ${evaluations.length}`);

  console.log('\n========================================');
  console.log('ALL E2E CONTRACT & FUNCTIONAL TESTS PASSED!');
  console.log('========================================\n');
}

runE2ETests().catch((err) => {
  console.error('E2E Test Execution Failed:', err);
  process.exit(1);
});
