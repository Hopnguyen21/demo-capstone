const http = require('http');

async function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch(e) {}
        resolve({ status: res.statusCode, headers: res.headers, body, json });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🚀 Starting Technician Platform API Test Suite...');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Login as Platform Technician
  console.log('\n--- 1. Technician Authentication ---');
  const loginRes = await request({
    hostname: 'localhost',
    port: 5144,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: 'technician@smartfarm.demo',
    password: 'Demo@12345'
  });

  assert(loginRes.status === 200, 'Technician login status 200');
  const token = loginRes.json?.accessToken;
  assert(Boolean(token), 'Access token received');

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. GET /api/v1/service-requests
  console.log('\n--- 2. Service Requests List ---');
  const srRes = await request({
    hostname: 'localhost',
    port: 5144,
    path: '/api/v1/service-requests',
    method: 'GET',
    headers: authHeaders
  });

  assert(srRes.status === 200, 'GET /api/v1/service-requests returns 200');
  const requests = Array.isArray(srRes.json) ? srRes.json : [];
  assert(requests.length > 0, `Technician sees ${requests.length} service requests`);

  const targetReq = requests.find(r => r.failureCode === 'NEW_INSTALL') || requests[0];
  console.log(`  Target Request ID: ${targetReq?.id}, Zone: ${targetReq?.zoneId}`);

  // 3. POST /api/v1/service-requests/{id}/quotation
  console.log('\n--- 3. Quotation & Contract Creation ---');
  if (targetReq) {
    const quoteRes = await request({
      hostname: 'localhost',
      port: 5144,
      path: `/api/v1/service-requests/${targetReq.id}/quotation`,
      method: 'POST',
      headers: authHeaders
    }, {
      items: [
        {
          code: 'GW-ESP32-DL01',
          name: 'Trạm Central Gateway ESP32-LoRa',
          category: 'GATEWAY',
          unit: 'Trạm',
          quantity: 1,
          unitPrice: 3800000,
          vatPercent: 8,
          notes: 'LoRa 915MHz, IP67'
        },
        {
          code: 'SN-SOIL-01',
          name: 'Node Cảm biến Độ ẩm Đất RS485',
          category: 'SOIL_SENSOR',
          unit: 'Node',
          quantity: 2,
          unitPrice: 1250000,
          vatPercent: 8,
          notes: 'Đầu đo 3-in-1'
        }
      ],
      notes: 'Báo giá lắp đặt trọn gói hệ thống IoT nhà màng',
      contractTerms: 'Bảo hành 24 tháng theo chuẩn SmartFarm'
    });

    assert(quoteRes.status === 200 || quoteRes.status === 201, `POST quotation returns success (Got: ${quoteRes.status})`);
    assert(quoteRes.json?.totalAmount > 0, `Quotation total: ${quoteRes.json?.totalAmount} VND`);
    assert(quoteRes.json?.deposit30Percent > 0, `30% Deposit: ${quoteRes.json?.deposit30Percent} VND`);
  }

  // 4. PUT /api/v1/zones/{zoneId}/devices/bulk-locations (GIS Node Positioning & Editing)
  console.log('\n--- 4. GIS Node Placement & Coordinate Editing ---');
  const zoneId = targetReq?.zoneId || '32000000-0000-0000-0000-000000000001';
  const bulkGisRes = await request({
    hostname: 'localhost',
    port: 5144,
    path: `/api/v1/zones/${zoneId}/devices/bulk-locations`,
    method: 'PUT',
    headers: authHeaders
  }, {
    serviceRequestId: targetReq?.id,
    nodes: [
      {
        deviceId: '52000000-0000-0000-0000-000000000001',
        latitude: 11.940567,
        longitude: 108.458234,
        batteryLevel: 98,
        rssi: -68
      },
      {
        deviceId: '52000000-0000-0000-0000-000000000002',
        latitude: 11.940250,
        longitude: 108.458780,
        batteryLevel: 94,
        rssi: -71
      }
    ]
  });

  assert(bulkGisRes.status === 204 || bulkGisRes.status === 200, `PUT bulk-locations returns success (Got: ${bulkGisRes.status})`);

  // 5. GET /api/v1/zones/{zoneId}/devices/map-locations (Verify coordinates saved to DB)
  console.log('\n--- 5. Verify GIS Coordinates Saved in DB ---');
  const mapLocRes = await request({
    hostname: 'localhost',
    port: 5144,
    path: `/api/v1/zones/${zoneId}/devices/map-locations`,
    method: 'GET',
    headers: authHeaders
  });

  assert(mapLocRes.status === 200, 'GET map-locations returns 200');
  const mapNodes = Array.isArray(mapLocRes.json) ? mapLocRes.json : [];
  assert(mapNodes.length >= 2, `Zone has ${mapNodes.length} mapped nodes on GIS`);
  const node1 = mapNodes.find(n => n.deviceId === '52000000-0000-0000-0000-000000000001');
  assert(node1 && Math.abs(node1.latitude - 11.940567) < 0.001, `Node 1 latitude verified: ${node1?.latitude}`);
  assert(node1 && Math.abs(node1.longitude - 108.458234) < 0.001, `Node 1 longitude verified: ${node1?.longitude}`);

  // 6. GET /api/v1/platform/technicians/me/spare-parts
  console.log('\n--- 6. Technician Spare Parts Inventory ---');
  const spareRes = await request({
    hostname: 'localhost',
    port: 5144,
    path: '/api/v1/platform/technicians/me/spare-parts',
    method: 'GET',
    headers: authHeaders
  });

  assert(spareRes.status === 200, 'GET spare-parts returns 200');
  const spareItems = Array.isArray(spareRes.json) ? spareRes.json : [];
  assert(spareItems.length >= 0, `Technician has ${spareItems.length} spare parts in inventory`);

  console.log(`\n========================================`);
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
