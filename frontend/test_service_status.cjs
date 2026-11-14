const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

async function scenario({ role = 'PlatformTechnician', status = 'Assigned', quote = null, mismatch = false, nodes = [], failedNodes = false }) {
  const calls = [];
  const api = { get: async path => {
    calls.push(path);
    if (path === '/api/v1/service-requests') return { data: [{ id: 's1', farmId: 'f1', zoneId: 'z1', deploymentRequestId: 'd1', status, failureCode: 'NEW_INSTALL' }] };
    if (path === '/api/v1/users/me') return { data: { role } };
    if (path.endsWith('/quotation')) return { data: quote };
    if (path.endsWith('/map-locations')) { if (failedNodes) throw Error('offline'); return { data: nodes }; }
    if (path.endsWith('/deployment-requests/d1')) return { data: { farmId: mismatch ? 'other' : 'f1', zoneId: 'z1', status: 'Completed' } };
    return { data: [] };
  }};
  const code = ts.transpileModule(fs.readFileSync('src/services/index.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => { assert.equal(name, './api'); return { apiClient: api }; }, console });
  const [request] = await exports.supportService.getServiceRequests();
  return { request, calls };
}
(async () => {
  let r = await scenario({ status: 'Closed' });
  assert.equal(r.request.status, 'CLOSED');
  assert.equal(r.request.isAcceptedByOwner, false);
  assert.equal(r.request.mappedNodesCount, 0);
  assert(r.calls.includes('/api/v1/platform/deployment-requests/d1'));
  r = await scenario({ role: 'FarmOwner', status: 'Verified', quote: { id: 'q1', status: 'SignedByOwner' } });
  assert.equal(r.request.status, 'VERIFIED');
  assert.equal(r.request.quotationStatus, 'SignedByOwner');
  assert.equal(r.request.isAcceptedByOwner, false);
  assert(r.calls.includes('/api/v1/deployment-requests/d1'));
  r = await scenario({ mismatch: true, failedNodes: true });
  assert.equal(r.request.deploymentLinkInvalid, true);
  assert.equal(r.request.deploymentStatus, undefined);
  assert.equal(r.request.mappedNodesCount, undefined);
  r = await scenario({ status: 'InProgress', quote: { id: 'q1', status: 'Completed' } });
  assert.equal(r.request.status, 'IN_PROGRESS');
  assert.equal(r.request.isAcceptedByOwner, true);
  r = await scenario({ role: 'PlatformAdmin' });
  assert(!r.calls.some(p => p.includes('/deployment-requests/')));
  console.log('PASS: 5 service status mapping scenarios');
})().catch(error => { console.error(error); process.exitCode = 1; });
