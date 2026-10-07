/**
 * Comprehensive QA & Integration Test Suite for SmartFarm System
 * Tests: Backend, Database, Authentication, API Integration, Error Handling, Negative Testing, E2E
 */

const http = require('http');

const BASE_URL = 'http://localhost:5144';
const PROXY_URL = 'http://localhost:3000';

let passed = 0;
let failed = 0;
let fixed = 0;
const results = [];

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch (_) { json = body; }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json,
          rawBody: body
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    if (data) {
      if (typeof data === 'string') {
        req.write(data);
      } else {
        req.write(JSON.stringify(data));
      }
    }
    req.end();
  });
}

async function runTest(category, name, testFn) {
  process.stdout.write(`  [TEST] ${category} - ${name} ... `);
  try {
    const res = await testFn();
    passed++;
    console.log(`PASS (${res})`);
    results.push({ category, name, status: 'PASS', details: res });
  } catch (err) {
    failed++;
    console.log(`FAIL: ${err.message}`);
    results.push({ category, name, status: 'FAIL', error: err.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

async function main() {
  console.log('================================================================');
  console.log('       SMARTFARM COMPREHENSIVE QA & INTEGRATION TEST SUITE       ');
  console.log('================================================================\n');

  let adminToken = '';
  let technicianToken = '';
  let ownerToken = '';
  let farmerToken = '';

  const seedFarmId = '30000000-0000-0000-0000-000000000001';
  const seedFieldId = '31000000-0000-0000-0000-000000000001';
  const seedZoneId = '32000000-0000-0000-0000-000000000001';
  const seedDeviceId = '52000000-0000-0000-0000-000000000001';
  const seedActuatorId = '53000000-0000-0000-0000-000000000001';

  // ─── 1. AUTHENTICATION & TOKEN TESTING ─────────────────────────────────────
  console.log('--- 1. Authentication & Token Security ---');

  await runTest('Authentication', 'Login as FarmOwner', async () => {
    const res = await request({
      hostname: 'localhost', port: 5144, path: '/api/v1/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'owner@smartfarm.demo', password: 'Demo@12345' });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.data.accessToken, 'Missing accessToken');
    assert(res.data.refreshToken, 'Missing refreshToken');
    assert(res.data.user.role === 'FarmOwner', 'Role must be FarmOwner');
    ownerToken = res.data.accessToken;
    return 'Owner token acquired';
  });

  await runTest('Authentication', 'Login as PlatformAdmin', async () => {
    const res = await request({
      hostname: 'localhost', port: 5144, path: '/api/v1/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'admin@smartfarm.demo', password: 'Demo@12345' });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    adminToken = res.data.accessToken;
    assert(res.data.user.role === 'PlatformAdmin', 'Role must be PlatformAdmin');
    return 'Admin token acquired';
  });

  await runTest('Authentication', 'Login as PlatformTechnician', async () => {
    const res = await request({
      hostname: 'localhost', port: 5144, path: '/api/v1/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'technician@smartfarm.demo', password: 'Demo@12345' });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    technicianToken = res.data.accessToken;
    assert(res.data.user.role === 'PlatformTechnician', 'Role must be PlatformTechnician');
    return 'Technician token acquired';
  });

  await runTest('Authentication', 'Login as Farmer', async () => {
    const res = await request({
      hostname: 'localhost', port: 5144, path: '/api/v1/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'farmer@smartfarm.demo', password: 'Demo@12345' });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    farmerToken = res.data.accessToken;
    assert(res.data.user.role === 'Farmer', 'Role must be Farmer');
    return 'Farmer token acquired';
  });

  await runTest('Authentication', 'Token Refresh Flow', async () => {
    const loginRes = await request({
      hostname: 'localhost', port: 5144, path: '/api/v1/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'owner@smartfarm.demo', password: 'Demo@12345' });
    const rToken = loginRes.data.refreshToken;
    const refRes = await request({
      hostname: 'localhost', port: 5144, path: '/api/v1/auth/refresh', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { refreshToken: rToken });
    assert(refRes.statusCode === 200, `Expected 200, got ${refRes.statusCode}`);
    assert(refRes.data.accessToken, 'Missing refreshed accessToken');
    return 'Refresh successful';
  });

  await runTest('Authentication', 'GetCurrentUser (/users/me)', async () => {
    const res = await request({
      hostname: 'localhost', port: 5144, path: '/api/v1/users/me', method: 'GET',
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.data.email === 'owner@smartfarm.demo', 'User email mismatch');
    return res.data.fullName;
  });

  // ─── 2. NEGATIVE TESTS & ERROR HANDLING ────────────────────────────────────
  console.log('\n--- 2. Negative Testing & Security Validation ---');

  await runTest('Negative Testing', 'Reject login with wrong password (401)', async () => {
    const res = await request({
      hostname: 'localhost', port: 5144, path: '/api/v1/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'owner@smartfarm.demo', password: 'WrongPassword999!' });
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    return 'Properly rejected';
  });

  await runTest('Negative Testing', 'Reject unauthenticated request without token (401)', async () => {
    const res = await request({
      hostname: 'localhost', port: 5144, path: '/api/v1/farms', method: 'GET'
    });
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    return 'Blocked with 401';
  });

  await runTest('Negative Testing', 'Reject request with forged token (401)', async () => {
    const res = await request({
      hostname: 'localhost', port: 5144, path: '/api/v1/farms', method: 'GET',
      headers: { 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature' }
    });
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    return 'Blocked with 401';
  });

  await runTest('Negative Testing', 'Reject Non-existent Entity GUID (404)', async () => {
    const res = await request({
      hostname: 'localhost', port: 5144,
      path: '/api/v1/farms/00000000-0000-0000-0000-000000000099', method: 'GET',
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });
    assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
    return '404 ProblemDetails returned';
  });

  await runTest('Negative Testing', 'Reject Malformed / Empty Request Body (400)', async () => {
    const res = await request({
      hostname: 'localhost', port: 5144,
      path: '/api/v1/farms', method: 'POST',
      headers: { 'Authorization': `Bearer ${ownerToken}`, 'Content-Type': 'application/json' }
    }, {});
    assert(res.statusCode === 400, `Expected 400 Bad Request, got ${res.statusCode}`);
    return 'Validation caught missing required fields';
  });

  await runTest('Negative Testing', 'Reject RBAC Forbidden: Farmer attempting Admin operation (403)', async () => {
    const res = await request({
      hostname: 'localhost', port: 5144,
      path: '/api/v1/crops', method: 'POST',
      headers: { 'Authorization': `Bearer ${farmerToken}`, 'Content-Type': 'application/json' }
    }, { name: 'Test Crop' });
    assert(res.statusCode === 403, `Expected 403 Forbidden, got ${res.statusCode}`);
    return 'RBAC successfully enforced';
  });

  // ─── 3. BACKEND & DATABASE CRUD & INTEGRATION FLOW ─────────────────────────
  console.log('\n--- 3. Backend & Database CRUD Integration (E2E) ---');

  await runTest('Backend CRUD', 'GET /api/v1/farms (List Farms for Owner)', async () => {
    const res = await request({
      hostname: 'localhost', port: 5144, path: '/api/v1/farms', method: 'GET',
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const items = res.data?.value ?? res.data ?? [];
    assert(Array.isArray(items), 'Farms must be an array');
    assert(items.length > 0, 'Seed demo farm should exist');
    return `Found ${items.length} farms; primary: ${items[0].name}`;
  });

  let createdFarmId = '';
  await runTest('Backend CRUD', 'POST /api/v1/farms (Create new Farm)', async () => {
    const res = await request({
      hostname: 'localhost', port: 5144, path: '/api/v1/farms', method: 'POST',
      headers: { 'Authorization': `Bearer ${ownerToken}`, 'Content-Type': 'application/json' }
    }, {
      name: `QA Test Farm ${Date.now()}`,
      locationText: 'Đơn Dương, Lâm Đồng, Vietnam',
      latitude: 11.834,
      longitude: 108.562,
      totalAreaM2: 25000,
      timeZone: 'Asia/Ho_Chi_Minh'
    });
    assert(res.statusCode === 201 || res.statusCode === 200, `Expected 200/201, got ${res.statusCode}`);
    createdFarmId = res.data.farmId || res.data.id;
    assert(createdFarmId, 'Created farm must have ID');
    return `Created farm ID: ${createdFarmId}`;
  });

  await runTest('Database Persistence', 'Verify created Farm in Database via GET', async () => {
    const res = await request({
      hostname: 'localhost', port: 5144, path: `/api/v1/farms/${createdFarmId}`, method: 'GET',
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.data.farmId === createdFarmId, 'FarmId match');
    assert(res.data.name.includes('QA Test Farm'), 'Farm name match');
    return 'Database confirmed persisted';
  });

  await runTest('Backend CRUD', 'PUT /api/v1/farms/{id} (Update Farm details)', async () => {
    const res = await request({
      hostname: 'localhost', port: 5144, path: `/api/v1/farms/${createdFarmId}`, method: 'PUT',
      headers: { 'Authorization': `Bearer ${ownerToken}`, 'Content-Type': 'application/json' }
    }, {
      name: `QA Test Farm Updated ${Date.now()}`,
      locationText: 'Đơn Dương, Lâm Đồng',
      latitude: 11.834,
      longitude: 108.562,
      totalAreaM2: 30000,
      timeZone: 'Asia/Ho_Chi_Minh'
    });
    assert(res.statusCode === 200 || res.statusCode === 204, `Expected 200/204, got ${res.statusCode}`);
    return 'Update success';
  });

  let createdFieldId = '';
  await runTest('Backend CRUD', 'POST /api/v1/farms/{farmId}/fields (Create Field)', async () => {
    const res = await request({
      hostname: 'localhost', port: 5144, path: `/api/v1/farms/${createdFarmId}/fields`, method: 'POST',
      headers: { 'Authorization': `Bearer ${ownerToken}`, 'Content-Type': 'application/json' }
    }, {
      name: 'Lô QA-A1',
      soilType: 'Loam',
      areaM2: 5000,
      latitude: 11.834,
      longitude: 108.562,
      boundaryGeoJson: {
        type: 'Polygon',
        coordinates: [[[108.561,11.833],[108.562,11.833],[108.562,11.834],[108.561,11.834],[108.561,11.833]]]
      }
    });
    assert(res.statusCode === 201 || res.statusCode === 200, `Expected 200/201, got ${res.statusCode}`);
    createdFieldId = res.data.fieldId || res.data.id;
    assert(createdFieldId, 'Field ID returned');
    return `Created field ID: ${createdFieldId}`;
  });

  let createdZoneId = '';
  await runTest('Backend CRUD', 'POST /api/v1/fields/{id}/zones (Create Zone)', async () => {
    const res = await request({
      hostname: 'localhost', port: 5144, path: `/api/v1/fields/${createdFieldId}/zones`, method: 'POST',
      headers: { 'Authorization': `Bearer ${ownerToken}`, 'Content-Type': 'application/json' }
    }, {
      name: 'Nhà màng QA-Z01',
      zoneType: 'Greenhouse',
      areaM2: 1200,
      notes: 'Thử nghiệm QA tự động',
      polygonGeoJson: {
        type: 'Polygon',
        coordinates: [[[108.561,11.833],[108.5615,11.833],[108.5615,11.8335],[108.561,11.8335],[108.561,11.833]]]
      }
    });
    assert(res.statusCode === 201 || res.statusCode === 200, `Expected 200/201, got ${res.statusCode}`);
    createdZoneId = res.data.zoneId || res.data.id;
    assert(createdZoneId, 'Zone ID returned');
    return `Created zone ID: ${createdZoneId}`;
  });

  await runTest('Backend CRUD', 'GET /api/v1/zones/{id} (Verify Zone created)', async () => {
    const res = await request({
      hostname: 'localhost', port: 5144, path: `/api/v1/zones/${createdZoneId}`, method: 'GET',
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.data.zoneId === createdZoneId, 'Zone ID match');
    return `Zone verified: ${res.data.name}`;
  });

  await runTest('Backend CRUD', 'DELETE /api/v1/farms/{id} (Clean up QA Farm)', async () => {
    const res = await request({
      hostname: 'localhost', port: 5144, path: `/api/v1/farms/${createdFarmId}`, method: 'DELETE',
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });
    assert(res.statusCode === 200 || res.statusCode === 204, `Expected 200/204, got ${res.statusCode}`);
    return 'Farm successfully soft-deleted/archived';
  });

  // ─── 4. TELEMETRY, CONTROL & IOT PIPELINE ──────────────────────────────────
  console.log('\n--- 4. Telemetry, IoT & Control Execution ---');

  await runTest('Telemetry', 'GET /api/v1/zones/{zoneId}/telemetry/latest', async () => {
    const res = await request({
      hostname: 'localhost', port: 5144, path: `/api/v1/zones/${seedZoneId}/telemetry/latest`, method: 'GET',
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    return `Readings count: ${res.data?.readings?.length ?? 0}`;
  });

  await runTest('Telemetry', 'GET /api/v1/zones/{zoneId}/telemetry/history', async () => {
    const now = new Date();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const to = now.toISOString();
    const res = await request({
      hostname: 'localhost', port: 5144,
      path: `/api/v1/zones/${seedZoneId}/telemetry/history?parameterCode=SoilMoisture&fromUtc=${encodeURIComponent(from)}&toUtc=${encodeURIComponent(to)}&interval=15m`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    return 'Telemetry history returned';
  });

  await runTest('Alerts', 'GET /api/v1/zones/{zoneId}/alerts', async () => {
    const res = await request({
      hostname: 'localhost', port: 5144, path: `/api/v1/zones/${seedZoneId}/alerts`, method: 'GET',
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    return `Alerts queried successfully, found: ${Array.isArray(res.data) ? res.data.length : 0}`;
  });

  await runTest('Control & Actuators', 'GET /api/v1/zones/{zoneId}/schedules', async () => {
    const res = await request({
      hostname: 'localhost', port: 5144, path: `/api/v1/zones/${seedZoneId}/schedules`, method: 'GET',
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    return 'Schedules retrieved';
  });

  await runTest('Control & Actuators', 'POST manual command to actuator (Safety Interlock Evaluation)', async () => {
    const res = await request({
      hostname: 'localhost', port: 5144,
      path: `/api/v1/zones/${seedZoneId}/actuators/${seedActuatorId}/command`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ownerToken}`, 'Content-Type': 'application/json' }
    }, {
      action: 'TurnOn',
      durationSeconds: 300,
      overrideActiveSchedules: true,
      idempotencyKey: `qa-cmd-${Date.now()}`,
      notes: 'Automated test toggle'
    });
    // In SmartFarm, 202 = Command Queued, while 409 = Safety Interlock correctly refusing command due to stale telemetry window (>15m)
    assert(res.statusCode === 200 || res.statusCode === 202 || res.statusCode === 409, `Unexpected response status ${res.statusCode}`);
    if (res.statusCode === 409) {
      return `Safety Interlock Active: ${res.data?.detail || 'Stale telemetry protected'}`;
    }
    return 'Command accepted by control engine';
  });

  // ─── 5. CROPS, PROFILES & AI ADVISORY ──────────────────────────────────────
  console.log('\n--- 5. Crops Library, Profiles & AI Advisory ---');

  await runTest('Crops Catalog', 'GET /api/v1/crops (Admin / Owner)', async () => {
    const res = await request({
      hostname: 'localhost', port: 5144, path: '/api/v1/crops', method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const crops = res.data?.value ?? res.data ?? [];
    assert(Array.isArray(crops), 'Crops must be array');
    assert(crops.length > 0, 'Seed crops should exist');
    return `Found ${crops.length} system crop catalog items`;
  });

  await runTest('AI Advisory', 'GET /api/v1/zones/{zoneId}/ai/context', async () => {
    const res = await request({
      hostname: 'localhost', port: 5144, path: `/api/v1/zones/${seedZoneId}/ai/context`, method: 'GET',
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    return 'AI context generated with telemetry & crop details';
  });

  // ─── 6. SERVICE REQUESTS & TASKS ───────────────────────────────────────────
  console.log('\n--- 6. Service Requests & Work Order Pipeline ---');

  let testReqId = '';
  let activeReq = null;

  await runTest('Service Requests', 'GET /api/v1/service-requests (Query existing requests)', async () => {
    const res = await request({
      hostname: 'localhost', port: 5144, path: '/api/v1/service-requests', method: 'GET',
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(Array.isArray(res.data), 'Expected array of requests');
    activeReq = res.data.find(r => r.status === 'Open' || r.status === 'Assigned');
    return `Found ${res.data.length} requests (active: ${activeReq?.id || 'none'})`;
  });

  await runTest('Service Requests', 'POST /api/v1/farms/{farmId}/service-requests (Owner creates request)', async () => {
    const res = await request({
      hostname: 'localhost', port: 5144,
      path: `/api/v1/farms/${seedFarmId}/service-requests`, method: 'POST',
      headers: { 'Authorization': `Bearer ${ownerToken}`, 'Content-Type': 'application/json' }
    }, {
      zoneId: seedZoneId,
      deviceId: seedDeviceId,
      failureCode: 'SENSOR_OFFLINE',
      description: 'Cảm biến độ ẩm đất mất tín hiệu LoRa định kỳ'
    });
    if (res.statusCode === 201 || res.statusCode === 200) {
      testReqId = res.data.id || res.data.requestId;
      return `Created request ID: ${testReqId}`;
    }
    if (res.statusCode === 409 && activeReq) {
      testReqId = activeReq.id;
      return `Reusing active request ID: ${testReqId} (Conflict safety verified: single active request per device)`;
    }
    throw new Error(`Unexpected status ${res.statusCode}`);
  });

  await runTest('Service Requests', 'POST /api/v1/service-requests/{id}/assign (Admin assigns Technician)', async () => {
    const techUserId = '20000000-0000-0000-0000-000000000004'; // technician demo user
    const res = await request({
      hostname: 'localhost', port: 5144,
      path: `/api/v1/service-requests/${testReqId}/assign`, method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
    }, {
      technicianUserId: techUserId,
      notes: 'Phân công kỹ thuật viên kiểm tra ăng-ten LoRa'
    });
    assert(res.statusCode === 200 || res.statusCode === 204, `Expected 200/204, got ${res.statusCode}`);
    return 'Technician assigned successfully';
  });

  // ─── 7. FRONTEND VITE PROXY INTEGRATION ────────────────────────────────────
  console.log('\n--- 7. Frontend Integration & Vite Proxy Check ---');

  await runTest('Frontend Integration', 'Proxy check: http://localhost:3000/api/v1/auth/login', async () => {
    const res = await request({
      hostname: 'localhost', port: 3000, path: '/api/v1/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'owner@smartfarm.demo', password: 'Demo@12345' });
    assert(res.statusCode === 200, `Expected 200 through Vite proxy, got ${res.statusCode}`);
    assert(res.data.accessToken, 'Token returned via Vite proxy');
    return 'Vite reverse proxy operational without CORS issues';
  });

  await runTest('Frontend Integration', 'Static App Load: http://localhost:3000/', async () => {
    const res = await request({
      hostname: 'localhost', port: 3000, path: '/', method: 'GET'
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.rawBody.includes('<!DOCTYPE html>') || res.rawBody.includes('<html'), 'HTML served');
    return 'Frontend index.html served correctly';
  });

  // ─── SUMMARY ──────────────────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED:      ${passed}`);
  console.log(`FAILED:      ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
