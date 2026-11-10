const http = require('http');

function postJson(url, data, token = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = JSON.stringify(data);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'POST',
      headers
    }, (res) => {
      let resData = '';
      res.on('data', chunk => resData += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: resData ? JSON.parse(resData) : null });
        } catch {
          resolve({ status: res.statusCode, body: resData });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function getJson(url, token = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'GET',
      headers
    }, (res) => {
      let resData = '';
      res.on('data', chunk => resData += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: resData ? JSON.parse(resData) : null });
        } catch {
          resolve({ status: res.statusCode, body: resData });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('--- TESTING AUTH & PERMISSIONS ---');

  // 1. Login Admin
  const adminLogin = await postJson('http://localhost:5144/api/v1/auth/login', {
    email: 'admin@smartfarm.demo',
    password: 'Demo@12345'
  });
  const adminToken = adminLogin.body.accessToken;
  console.log('1. Admin Login:', adminLogin.status === 200 ? 'SUCCESS' : 'FAILED');

  // 2. Login Technician
  const techLogin = await postJson('http://localhost:5144/api/v1/auth/login', {
    email: 'technician@smartfarm.demo',
    password: 'Demo@12345'
  });
  const techToken = techLogin.body.accessToken;
  console.log('2. Technician Login:', techLogin.status === 200 ? 'SUCCESS' : 'FAILED');

  // 3. Login Owner
  const ownerLogin = await postJson('http://localhost:5144/api/v1/auth/login', {
    email: 'owner@smartfarm.demo',
    password: 'Demo@12345'
  });
  const ownerToken = ownerLogin.body.accessToken;
  console.log('3. Owner Login:', ownerLogin.status === 200 ? 'SUCCESS' : 'FAILED');

  // 4. Test Bills GET for all 3 roles
  const adminBills = await getJson('http://localhost:5144/api/v1/bills', adminToken);
  console.log('4a. Admin GET /api/v1/bills -> Status:', adminBills.status, '| Count:', adminBills.body?.length);

  const techBills = await getJson('http://localhost:5144/api/v1/bills', techToken);
  console.log('4b. Technician GET /api/v1/bills -> Status:', techBills.status, '| Count:', techBills.body?.length);

  const ownerBills = await getJson('http://localhost:5144/api/v1/bills', ownerToken);
  console.log('4c. Owner GET /api/v1/bills -> Status:', ownerBills.status, '| Count:', ownerBills.body?.length);

  // 5. Test StockOuts GET for all 3 roles
  const farmId = '30000000-0000-0000-0000-000000000001';
  const adminStockOuts = await getJson(`http://localhost:5144/api/v1/farms/${farmId}/stock-outs`, adminToken);
  console.log('5a. Admin GET stock-outs -> Status:', adminStockOuts.status, '| Count:', adminStockOuts.body?.length);

  const techStockOuts = await getJson(`http://localhost:5144/api/v1/farms/${farmId}/stock-outs`, techToken);
  console.log('5b. Technician GET stock-outs -> Status:', techStockOuts.status, '| Count:', techStockOuts.body?.length);

  const ownerStockOuts = await getJson(`http://localhost:5144/api/v1/farms/${farmId}/stock-outs`, ownerToken);
  console.log('5c. Owner GET stock-outs -> Status:', ownerStockOuts.status, '| Count:', ownerStockOuts.body?.length);

  // 6. Test Mutation Restrictions: Owner MUST be 403 Forbidden
  const ownerCreateBill = await postJson('http://localhost:5144/api/v1/bills', {
    contractId: '76b1e56a-3935-4481-8d1f-f5a17a6a8d36',
    amount: 1000000,
    issueDate: '2026-11-10',
    dueDate: '2026-11-20'
  }, ownerToken);
  console.log('6a. Owner POST /api/v1/bills -> Status:', ownerCreateBill.status, '(Expect 403 Forbidden)');

  const ownerCreateStockOut = await postJson(`http://localhost:5144/api/v1/farms/${farmId}/stock-outs`, {
    notes: 'Test Stock Out by Owner',
    details: [{ inventoryItemId: '70000000-0000-0000-0000-000000000002', quantity: 1 }]
  }, ownerToken);
  console.log('6b. Owner POST /api/v1/farms/.../stock-outs -> Status:', ownerCreateStockOut.status, '(Expect 403 Forbidden)');

  // 7. Verify Tech / Admin CAN mutate
  const techCreateStockOut = await postJson(`http://localhost:5144/api/v1/farms/${farmId}/stock-outs`, {
    notes: 'Test Stock Out created by Technician',
    details: [{ inventoryItemId: '70000000-0000-0000-0000-000000000002', quantity: 2 }]
  }, techToken);
  console.log('7a. Technician POST /api/v1/farms/.../stock-outs -> Status:', techCreateStockOut.status, '(Expect 201 Created)');

  console.log('\n--- ALL ROLE & PERMISSION CHECKS COMPLETE ---');
}

run().catch(console.error);
