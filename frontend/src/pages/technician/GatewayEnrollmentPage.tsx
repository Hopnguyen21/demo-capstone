import React, { useEffect, useState } from "react";
import { CheckCircle2, Radio, RefreshCw, Rocket, ShieldCheck } from "lucide-react";
import { Button, Input, Modal } from "../../components/ui/BaseUI";
import { deviceService, supportService } from "../../services";

export const GatewayEnrollmentPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [bootstrapReleases, setBootstrapReleases] = useState<any[]>([]);
  const [runtimeReleases, setRuntimeReleases] = useState<any[]>([]);
  const [activeGateways, setActiveGateways] = useState<any[]>([]);
  const [form, setForm] = useState({
    hardwareItemId: "",
    macAddress: "",
    chipId: "",
    gatewaySerial: "",
    bootstrapFirmwareVersion: "",
  });
  const [enrollment, setEnrollment] = useState<any>(null);
  const [deploymentRequestId, setDeploymentRequestId] = useState("");
  const [frequencyBand, setFrequencyBand] = useState("915MHz");
  const [activated, setActivated] = useState<any>(null);
  const [gatewayId, setGatewayId] = useState("");
  const [runtimeReleaseId, setRuntimeReleaseId] = useState("");
  const [otaStarted, setOtaStarted] = useState(false);
  const [otaJob, setOtaJob] = useState<any>(null);
  const [showActivate, setShowActivate] = useState(false);
  const [showOta, setShowOta] = useState(false);
  const [error, setError] = useState("");
  const [gatewayTab, setGatewayTab] = useState<'FIRST' | 'ACTIVE'>('FIRST');

  // Keep the operator's view synchronized while the Gateway is downloading,
  // rebooting and reporting the OTA result. Retry remains manual and has no
  // artificial attempt counter: every Failed job can be submitted again.
  useEffect(() => {
    if (!gatewayId) return;
    let disposed = false;
    const refreshJob = async () => {
      const current = await deviceService.getLatestGatewayFirmwareJob(gatewayId).catch(() => null);
      if (!disposed && current) setOtaJob(current);
    };
    void refreshJob();
    const timer = window.setInterval(refreshJob, 5000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [gatewayId]);
  const deploymentLabel = (item: any) => {
    const zoneName = item.context?.zoneName || item.zoneName || item.zone?.name;
    const farmName = item.context?.farmName || item.farmName || item.farm?.name;
    if (zoneName)
      return `Yêu cầu lắp đặt cho Zone ${zoneName}${farmName ? ` · Farm ${farmName}` : ""}`;
    const raw =
      item.contractName || item.contractTitle || item.title || item.ownerNotes;
    if (raw)
      return String(raw)
        .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();
    return `Yêu cầu lắp đặt${farmName ? ` · Farm ${farmName}` : ""}`;
  };

  useEffect(() => {
    Promise.all([
      supportService.getTechnicianSpareParts(),
      deviceService.getTechnicianDeploymentRequests(),
      deviceService.listApprovedFirmwareReleases(),
    ])
      .then(([stock, deployments, releases]) => {
        setItems(
          (Array.isArray(stock) ? stock : []).filter((item: any) =>
            String(item.category || "")
              .toLowerCase()
              .includes("gateway"),
          ),
        );
        setRequests(Array.isArray(deployments) ? deployments : []);
        const farmIds = [...new Set((Array.isArray(deployments) ? deployments : [])
          .map((item: any) => item.farmId || item.context?.farmId || item.farm?.id)
          .filter(Boolean))] as string[];
        Promise.all(farmIds.map(farmId => deviceService.getGateways(farmId).catch(() => [])))
          .then(groups => setActiveGateways(groups.flat().filter((gateway: any) =>
            String(gateway.status || '').toLowerCase() !== 'decommissioned')));
        const approvedBootstrap = (
          Array.isArray(releases) ? releases : []
        ).filter(
          (release: any) =>
            String(release.hardwareTarget).toUpperCase() ===
              "ESP32_GATEWAY_BOOTSTRAP" &&
            String(release.status).toLowerCase() === "approved",
        );
        const approvedRuntime = (
          Array.isArray(releases) ? releases : []
        ).filter(
          (release: any) =>
            String(release.hardwareTarget).toUpperCase() ===
              "ESP32_GATEWAY_RUNTIME" &&
            String(release.status).toLowerCase() === "approved",
        );
        setBootstrapReleases(approvedBootstrap);
        setRuntimeReleases(approvedRuntime);
        setForm((previous) => ({
          ...previous,
          bootstrapFirmwareVersion:
            previous.bootstrapFirmwareVersion ||
            approvedBootstrap[0]?.version ||
            "",
        }));
      })
      .catch(() => setError("Không tải được Gateway hoặc Deployment Request."));
  }, []);

  const update = (key: keyof typeof form, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  const selectHardware = async (hardwareItemId: string) => {
    const item = items.find((x) => x.id === hardwareItemId);
    update("hardwareItemId", hardwareItemId);
    update("macAddress", item?.macAddress || "");
    update("gatewaySerial", item?.serialNumber || "");
    setEnrollment(null);
    setActivated(null);
    setError("");
    if (!hardwareItemId) return;
    try {
      const existing = await deviceService.getGatewayEnrollment(hardwareItemId);
      if (existing) {
        setEnrollment(existing);
        if (String(existing.status).toLowerCase() === "activated") {
          setActivated(existing);
          const existingGatewayId = existing.gatewayId || "";
          setGatewayId(existingGatewayId);
          if (existingGatewayId)
            setOtaJob(
              await deviceService
                .getLatestGatewayFirmwareJob(existingGatewayId)
                .catch(() => null),
            );
        }
      }
    } catch (e: any) {
      setError(
        e?.response?.data?.detail || "Không đọc được trạng thái Enrollment.",
      );
    }
  };

  const enroll = async () => {
    setError("");
    try {
      const result = await deviceService.autoEnrollGateway({
        macAddress: form.macAddress,
        chipId: form.chipId,
        gatewaySerial: form.gatewaySerial,
        bootstrapFirmwareVersion: form.bootstrapFirmwareVersion,
      });
      setEnrollment(result);
    } catch (e: any) {
      setError(
        e?.response?.data?.detail || e?.message || "Enrollment thất bại.",
      );
    }
  };

  const activate = async () => {
    const request = requests.find(
      (item) => (item.id || item.requestId) === deploymentRequestId,
    );
    if (!enrollment || !request?.farmId) return;
    setError("");
    try {
      const result = await deviceService.activateGatewayEnrollment(
        enrollment.id,
        { farmId: request.farmId, deploymentRequestId, frequencyBand },
      );
      setActivated(result);
      const gateways = await deviceService.getGateways(request.farmId);
      const gateway = (Array.isArray(gateways) ? gateways : []).find(
        (item: any) =>
          String(item.macAddress || "")
            .replace(/[:-]/g, "")
            .toUpperCase() ===
          String(form.macAddress).replace(/[:-]/g, "").toUpperCase(),
      );
      const resolvedGatewayId =
        result.gatewayId || gateway?.id || gateway?.gatewayId || "";
      setGatewayId(resolvedGatewayId);
      if (resolvedGatewayId)
        setOtaJob(
          await deviceService
            .getLatestGatewayFirmwareJob(resolvedGatewayId)
            .catch(() => null),
        );
    } catch (e: any) {
      setError(
        e?.response?.data?.detail || e?.message || "Activate Gateway thất bại.",
      );
    }
  };

  const startOta = async () => {
    if (!gatewayId || !runtimeReleaseId) return;
    setError("");
    try {
      const job = await deviceService.scheduleGatewayFirmware(
        gatewayId,
        runtimeReleaseId,
      );
      setOtaJob(job);
      setOtaStarted(true);
    } catch (e: any) {
      setError(
        e?.response?.data?.detail || e?.message || "Không thể tạo OTA job.",
      );
    }
  };

  const retryOta = async () => {
    if (!gatewayId) return;
    setError("");
    try {
      const job = await deviceService.retryGatewayFirmware(gatewayId);
      setOtaJob(job);
      setOtaStarted(true);
    } catch (e: any) {
      setError(
        e?.response?.data?.detail || e?.message || "Không thể reload OTA job.",
      );
    }
  };

  const selectedItem = items.find((item) => item.id === form.hardwareItemId);

  return (
    <div className="max-w-5xl mx-auto space-y-5 p-4 md:p-6">
      <div className="rounded-2xl bg-gradient-to-r from-sky-950 to-indigo-950 p-6 text-white shadow-lg">
        <div className="text-xs font-bold uppercase tracking-widest text-sky-300">Gateway operations</div>
        <h1 className="text-xl font-bold text-white">
          <Radio className="inline mr-2 text-sky-300" />
          Kích hoạt & quản lý Gateway
        </h1>
        <p className="text-sm text-slate-300 mt-1">
          Enrollment và handshake được thực hiện tự động trong Chuẩn bị phần
          cứng. Trang này chỉ dùng để kích hoạt Runtime và theo dõi OTA.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-2xl border bg-white p-2 shadow-sm">
        <button type="button" onClick={() => setGatewayTab('FIRST')} className={`rounded-xl px-4 py-3 text-left text-sm font-bold transition ${gatewayTab === 'FIRST' ? 'bg-sky-600 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}><span className="block">OTA lần đầu</span><span className={`text-xs font-normal ${gatewayTab === 'FIRST' ? 'text-sky-100' : 'text-slate-400'}`}>Bootstrap · Enrollment · Activate</span></button>
        <button type="button" onClick={() => setGatewayTab('ACTIVE')} className={`rounded-xl px-4 py-3 text-left text-sm font-bold transition ${gatewayTab === 'ACTIVE' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}><span className="block">OTA Gateway đang chạy</span><span className={`text-xs font-normal ${gatewayTab === 'ACTIVE' ? 'text-indigo-100' : 'text-slate-400'}`}>Nâng cấp · Theo dõi · Nạp lại</span></button>
      </div>
      {gatewayTab === 'ACTIVE' && <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div><div className="text-xs font-bold uppercase tracking-wider text-indigo-600">OTA trong quá trình hoạt động</div><h2 className="mt-1 font-bold text-slate-900">Nâng cấp Gateway đang chạy</h2><p className="mt-1 text-sm text-slate-600">Chọn Gateway đã Activated để cập nhật Runtime, không cần Enrollment hoặc Activate lại.</p></div>
          <Radio className="text-indigo-600" />
        </div>
        {activeGateways.length === 0 ? <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Chưa tìm thấy Gateway đã Activated trong các Farm được cấp quyền.</p> : <div className="mt-4 grid gap-2 md:grid-cols-2">{activeGateways.map((gateway: any) => { const id = gateway.gatewayId || gateway.id; return <button key={id} type="button" onClick={async () => { setGatewayId(id); setActivated(gateway); setOtaJob(await deviceService.getLatestGatewayFirmwareJob(id).catch(() => null)); setShowOta(true); }} className="flex items-center justify-between rounded-xl border bg-white p-3 text-left hover:border-indigo-400 hover:shadow-sm"><span><strong className="block text-sm text-slate-900">{gateway.gatewaySerial || gateway.serialNumber || 'Gateway'}</strong><span className="text-xs text-slate-500">{gateway.macAddress || id}</span></span><span className="text-xs font-semibold text-indigo-700">Mở OTA →</span></button>; })}</div>}
      </div>}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      {gatewayTab === 'ACTIVE' && activated && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="inline mr-1" size={16} />
          Gateway runtime đã Activated. Enrollment:{" "}
          <span className="font-mono">{activated.id}</span>
        </div>
      )}
      {gatewayTab === 'ACTIVE' && activated && (
        <>
        <div className="bg-white border border-sky-200 rounded-2xl p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><div className="text-xs font-bold uppercase tracking-wider text-sky-600">Bước 03 · OTA</div><h2 className="mt-1 font-bold text-slate-900">Cập nhật Runtime từ xa</h2><p className="mt-1 text-sm text-slate-500">Mở trung tâm OTA để chọn release và theo dõi tiến trình.</p></div><ShieldCheck className="text-emerald-500"/></div><Button className="mt-4 bg-sky-600 text-white" onClick={() => setShowOta(true)}><Rocket size={15}/> Mở trung tâm OTA</Button></div>
        <Modal isOpen={showOta} onClose={() => setShowOta(false)} title="Cập nhật Runtime OTA" size="lg"><div className="space-y-4">
          <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sky-700 text-xs font-bold uppercase"><Rocket size={15}/> OTA Runtime</div><h2 className="mt-1 font-bold text-slate-900">Cập nhật firmware từ xa</h2></div><ShieldCheck className="text-emerald-500" size={22}/></div>
          <p className="text-sm text-slate-600">
            Chọn bản Runtime đã được duyệt. ESP chỉ tải firmware sau khi bạn bấm
            nút này.
          </p>
          {otaJob && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              OTA job:{" "}
              <span className="font-mono">
                {otaJob.otaJobId || otaJob.jobId}
              </span>{" "}
              · Trạng thái: <strong>{otaJob.status}</strong> · Bản:{" "}
              <strong>{otaJob.targetVersion || otaJob.version}</strong>
              {String(otaJob.status) === "Failed" && (otaJob.errorMessage || otaJob.errorCode) && (
                <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                  Lỗi: {otaJob.errorMessage || otaJob.errorCode}
                </div>
              )}
            </div>
          )}
          <select
            value={runtimeReleaseId}
            onChange={(event) => setRuntimeReleaseId(event.target.value)}
            className="w-full rounded-lg border p-2.5"
          >
            <option value="">-- Chọn Runtime release đã duyệt --</option>
            {runtimeReleases.map((release) => (
              <option key={release.id} value={release.id}>
                Runtime v{release.version}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <Button
              className="bg-sky-600 text-white"
              disabled={
                !gatewayId ||
                !runtimeReleaseId ||
                ["Scheduled", "InProgress"].includes(String(otaJob?.status))
              }
              onClick={() => void startOta()}
            >
              {["Scheduled", "InProgress"].includes(String(otaJob?.status))
                ? "OTA đang xử lý"
                : "Bắt đầu OTA"}
            </Button>
            {otaJob?.status === "Failed" && (
              <Button
                className="bg-amber-600 text-white"
                onClick={() => void retryOta()}
              >
                <RefreshCw size={15} /> Nạp lại OTA
              </Button>
            )}
          </div>
          {!gatewayId && (
            <p className="text-xs text-amber-700">
              Chưa tìm thấy Gateway runtime; hãy kiểm tra Activate.
            </p>
          )}
        </div></Modal>
        </>
      )}

      {gatewayTab === 'FIRST' && <div className="bg-white border rounded-xl p-5 space-y-4">
        <div><div className="text-xs font-bold uppercase tracking-wider text-sky-600">OTA lần đầu</div><h2 className="font-bold">Kích hoạt Gateway mới</h2></div>
        <p className="text-sm text-slate-600">
          Hãy hoàn tất Bootstrap và handshake tại trang Chuẩn bị phần cứng
          trước. Không cần nhập MAC, Chip ID hoặc token thủ công ở đây.
        </p>
        <select
          value={form.hardwareItemId}
          onChange={(event) => void selectHardware(event.target.value)}
          className="w-full rounded-lg border p-2.5"
        >
          <option value="">-- Chọn Gateway đã chuẩn bị --</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {item.serialNumber || item.macAddress || item.id}
            </option>
          ))}
        </select>
        {enrollment && (
          <div className="text-sm text-emerald-700">
            Đã nhận handshake · MAC: {enrollment.macAddress} · Trạng thái:{" "}
            <strong>{enrollment.status}</strong>
          </div>
        )}
        {!enrollment && form.hardwareItemId && (
          <div className="text-sm text-amber-700">
            Gateway chưa có handshake. Hoàn tất tại Chuẩn bị phần cứng rồi quay
            lại đây.
          </div>
        )}
      </div>}

      {gatewayTab === 'FIRST' && enrollment && !activated && (
        <>
        <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm"><div className="text-xs font-bold uppercase tracking-wider text-amber-600">Bước 02 · Activate</div><h2 className="mt-1 font-bold text-slate-900">Kích hoạt Gateway Runtime</h2><p className="mt-1 text-sm text-slate-500">Chọn deployment request và băng tần trong popup.</p><Button className="mt-4 bg-amber-500 text-white" onClick={() => setShowActivate(true)}>Mở cấu hình Activate</Button></div>
        <Modal isOpen={showActivate} onClose={() => setShowActivate(false)} title="Activate Gateway Runtime" size="lg"><div className="space-y-4">
          <h2 className="font-bold">2. Activate Gateway runtime</h2>
          <select
            value={deploymentRequestId}
            onChange={(event) => setDeploymentRequestId(event.target.value)}
            className="w-full rounded-lg border p-2.5"
          >
            <option value="">-- Chọn Deployment Request --</option>
            {requests.map((item) => (
              <option
                key={item.id || item.requestId}
                value={item.id || item.requestId}
              >
                {deploymentLabel(item)}
                {/*
                  `Hợp đồng triển khai Farm ${item.farmId}`}{" "}
                  */}
              </option>
            ))}
          </select>
          <Input
            value={frequencyBand}
            onChange={(event) => setFrequencyBand(event.target.value)}
            placeholder="Frequency band"
          />
          <Button
            className="bg-amber-600 text-white"
            disabled={!deploymentRequestId || !selectedItem}
            onClick={() => { void activate(); setShowActivate(false); }}
          >
            Activate Gateway runtime
          </Button>
        </div></Modal>
        </>
      )}
    </div>
  );
};
