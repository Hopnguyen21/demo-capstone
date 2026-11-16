import React, { useEffect, useState } from 'react';
import { CheckCircle2, Radio } from 'lucide-react';
import { Button, Input } from '../../components/ui/BaseUI';
import { deviceService, supportService } from '../../services';

export const GatewayEnrollmentPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [bootstrapReleases, setBootstrapReleases] = useState<any[]>([]);
  const [runtimeReleases, setRuntimeReleases] = useState<any[]>([]);
  const [form, setForm] = useState({ hardwareItemId: '', macAddress: '', chipId: '', gatewaySerial: '', bootstrapFirmwareVersion: '' });
  const [enrollment, setEnrollment] = useState<any>(null);
  const [deploymentRequestId, setDeploymentRequestId] = useState('');
  const [frequencyBand, setFrequencyBand] = useState('915MHz');
  const [activated, setActivated] = useState<any>(null);
  const [gatewayId, setGatewayId] = useState('');
  const [runtimeReleaseId, setRuntimeReleaseId] = useState('');
  const [otaStarted, setOtaStarted] = useState(false);
  const [otaJob, setOtaJob] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([supportService.getTechnicianSpareParts(), deviceService.getTechnicianDeploymentRequests(), deviceService.listApprovedFirmwareReleases()])
      .then(([stock, deployments, releases]) => {
        setItems((Array.isArray(stock) ? stock : []).filter((item: any) => String(item.category || '').toLowerCase().includes('gateway')));
        setRequests(Array.isArray(deployments) ? deployments : []);
        const approvedBootstrap = (Array.isArray(releases) ? releases : []).filter((release: any) => String(release.hardwareTarget).toUpperCase() === 'ESP32_GATEWAY_BOOTSTRAP' && String(release.status).toLowerCase() === 'approved');
        const approvedRuntime = (Array.isArray(releases) ? releases : []).filter((release: any) => String(release.hardwareTarget).toUpperCase() === 'ESP32_GATEWAY_RUNTIME' && String(release.status).toLowerCase() === 'approved');
        setBootstrapReleases(approvedBootstrap);
        setRuntimeReleases(approvedRuntime);
        setForm(previous => ({ ...previous, bootstrapFirmwareVersion: previous.bootstrapFirmwareVersion || approvedBootstrap[0]?.version || '' }));
      })
      .catch(() => setError('Không tải được Gateway hoặc Deployment Request.'));
  }, []);

  const update = (key: keyof typeof form, value: string) => setForm(previous => ({ ...previous, [key]: value }));
  const selectHardware = async (hardwareItemId: string) => {
    const item = items.find(x => x.id === hardwareItemId);
    update('hardwareItemId', hardwareItemId); update('macAddress', item?.macAddress || ''); update('gatewaySerial', item?.serialNumber || '');
    setEnrollment(null); setActivated(null); setError('');
    if (!hardwareItemId) return;
    try {
      const existing = await deviceService.getGatewayEnrollment(hardwareItemId);
      if (existing) {
        setEnrollment(existing);
        if (String(existing.status).toLowerCase() === 'activated') {
          setActivated(existing);
          const existingGatewayId = existing.gatewayId || '';
          setGatewayId(existingGatewayId);
          if (existingGatewayId) setOtaJob(await deviceService.getLatestGatewayFirmwareJob(existingGatewayId).catch(() => null));
        }
      }
    } catch (e: any) { setError(e?.response?.data?.detail || 'Không đọc được trạng thái Enrollment.'); }
  };

  const enroll = async () => {
    setError('');
    try {
      const result = await deviceService.autoEnrollGateway({ macAddress: form.macAddress, chipId: form.chipId, gatewaySerial: form.gatewaySerial, bootstrapFirmwareVersion: form.bootstrapFirmwareVersion });
      setEnrollment(result);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Enrollment thất bại.');
    }
  };

  const activate = async () => {
    const request = requests.find(item => (item.id || item.requestId) === deploymentRequestId);
    if (!enrollment || !request?.farmId) return;
    setError('');
    try {
      const result = await deviceService.activateGatewayEnrollment(enrollment.id, { farmId: request.farmId, deploymentRequestId, frequencyBand });
      setActivated(result);
      const gateways = await deviceService.getGateways(request.farmId);
      const gateway = (Array.isArray(gateways) ? gateways : []).find((item: any) => String(item.macAddress || '').replace(/[:-]/g, '').toUpperCase() === String(form.macAddress).replace(/[:-]/g, '').toUpperCase());
      const resolvedGatewayId = result.gatewayId || gateway?.id || gateway?.gatewayId || '';
      setGatewayId(resolvedGatewayId);
      if (resolvedGatewayId) setOtaJob(await deviceService.getLatestGatewayFirmwareJob(resolvedGatewayId).catch(() => null));
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Activate Gateway thất bại.');
    }
  };

  const startOta = async () => {
    if (!gatewayId || !runtimeReleaseId) return;
    setError('');
    try {
      const job = await deviceService.scheduleGatewayFirmware(gatewayId, runtimeReleaseId);
      setOtaJob(job);
      setOtaStarted(true);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Không thể tạo OTA job.');
    }
  };

  const retryOta = async () => {
    if (!gatewayId) return;
    setError('');
    try {
      const job = await deviceService.retryGatewayFirmware(gatewayId);
      setOtaJob(job);
      setOtaStarted(true);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Không thể reload OTA job.');
    }
  };

  const selectedItem = items.find(item => item.id === form.hardwareItemId);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900"><Radio className="inline mr-2 text-emerald-600" />Gateway Enrollment</h1>
        <p className="text-sm text-slate-600 mt-1">USB flash Bootstrap trước, Enrollment sau; không nhập MQTT production credentials.</p>
      </div>
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {activated && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="inline mr-1" size={16} />Gateway runtime đã Activated. Enrollment: <span className="font-mono">{activated.id}</span></div>}
      {activated && <div className="bg-white border-2 border-sky-200 rounded-xl p-5 space-y-4"><h2 className="font-bold">3. Cập nhật Runtime OTA</h2><p className="text-sm text-slate-600">Chọn bản Runtime đã được duyệt. ESP chỉ tải firmware sau khi bạn bấm nút này.</p>{otaJob && <div className="rounded-lg bg-slate-50 p-3 text-sm">OTA job: <span className="font-mono">{otaJob.otaJobId || otaJob.jobId}</span> · Trạng thái: <strong>{otaJob.status}</strong> · Bản: <strong>{otaJob.targetVersion || otaJob.version}</strong></div>}<select value={runtimeReleaseId} onChange={event => setRuntimeReleaseId(event.target.value)} className="w-full rounded-lg border p-2.5"><option value="">-- Chọn Runtime release đã duyệt --</option>{runtimeReleases.map(release => <option key={release.id} value={release.id}>Runtime v{release.version}</option>)}</select><div className="flex gap-2"><Button className="bg-sky-600 text-white" disabled={!gatewayId || !runtimeReleaseId || ['Scheduled', 'InProgress'].includes(String(otaJob?.status))} onClick={() => void startOta()}>{['Scheduled', 'InProgress'].includes(String(otaJob?.status)) ? 'OTA đang xử lý' : 'Bắt đầu OTA'}</Button>{otaJob?.status === 'Failed' && <Button className="bg-amber-600 text-white" onClick={() => void retryOta()}>Reload OTA</Button>}</div>{!gatewayId && <p className="text-xs text-amber-700">Chưa tìm thấy Gateway runtime; hãy kiểm tra Activate.</p>}</div>}

      <div className="bg-white border rounded-xl p-5 space-y-4">
        <h2 className="font-bold">1. Xác nhận Enrollment sau khi flash Bootstrap</h2>
        <select value={form.hardwareItemId} disabled={!!enrollment} onChange={event => void selectHardware(event.target.value)} className="w-full rounded-lg border p-2.5"><option value="">-- Chọn Gateway trong Technician Stock --</option>{items.map(item => <option key={item.id} value={item.id}>{item.name} · {item.serialNumber || item.macAddress || item.id}</option>)}</select>
        <Input disabled={!!enrollment} value={form.macAddress} onChange={event => update('macAddress', event.target.value)} placeholder="MAC Address đọc từ ESP32" />
        <Input disabled={!!enrollment} value={form.chipId} onChange={event => update('chipId', event.target.value)} placeholder="ESP32 Chip ID" />
        <Input disabled={!!enrollment} value={form.gatewaySerial} onChange={event => update('gatewaySerial', event.target.value)} placeholder="Gateway Serial Number" />
        <select disabled={!!enrollment} required value={form.bootstrapFirmwareVersion} onChange={event => update('bootstrapFirmwareVersion', event.target.value)} className="w-full rounded-lg border p-2.5"><option value="">-- Chọn Bootstrap release đã duyệt --</option>{bootstrapReleases.map(release => <option key={release.id} value={release.version}>Bootstrap v{release.version}</option>)}</select>
        {!enrollment && <Button className="bg-emerald-600 text-white" disabled={!form.hardwareItemId || !form.macAddress || !form.chipId || !form.bootstrapFirmwareVersion} onClick={() => void enroll()}>Bắt đầu Enrollment</Button>}
        {enrollment && <div className="text-sm text-emerald-700">Enrollment: <span className="font-mono">{enrollment.id}</span> · Trạng thái: <strong>{enrollment.status}</strong></div>}
      </div>

      {enrollment && !activated && <div className="bg-white border-2 border-amber-200 rounded-xl p-5 space-y-4"><h2 className="font-bold">2. Activate Gateway runtime</h2><select value={deploymentRequestId} onChange={event => setDeploymentRequestId(event.target.value)} className="w-full rounded-lg border p-2.5"><option value="">-- Chọn Deployment Request --</option>{requests.map(item => <option key={item.id || item.requestId} value={item.id || item.requestId}>{item.id || item.requestId} · Farm {item.farmId}</option>)}</select><Input value={frequencyBand} onChange={event => setFrequencyBand(event.target.value)} placeholder="Frequency band" /><Button className="bg-amber-600 text-white" disabled={!deploymentRequestId || !selectedItem} onClick={() => void activate()}>Activate Gateway runtime</Button></div>}
    </div>
  );
};
