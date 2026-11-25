import React, { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, Radio, RefreshCw, Rocket, ShieldCheck } from "lucide-react";
import { Button, Input, Modal } from "../../components/ui/BaseUI";
import { deviceService, farmService, supportService } from "../../services";

export const GatewayEnrollmentPage: React.FC = () => {
  const otaStatusLabel: Record<string, string> = { Scheduled: "Đã lên lịch", CommandSent: "Đã gửi lệnh MQTT", InProgress: "Gateway đang xử lý", Succeeded: "Thành công", Failed: "Thất bại", RolledBack: "Đã rollback", TimedOut: "Quá thời gian" };
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
  const [scheduledAt, setScheduledAt] = useState("");
  const [otaStarted, setOtaStarted] = useState(false);
  const [otaJob, setOtaJob] = useState<any>(null);
  const [showActivate, setShowActivate] = useState(false);
  const [showOta, setShowOta] = useState(false);
  const [showFirstOta, setShowFirstOta] = useState(false);
  const [firstOtaReleaseId, setFirstOtaReleaseId] = useState("");
  const [error, setError] = useState("");
  const [gatewayFilter, setGatewayFilter] = useState('ALL');

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
      return `Yêu cầu lắp đặt cho Zone ${zoneName}${farmName ? ` tại ${farmName}` : ""}`;
    const raw =
      item.contractName || item.contractTitle || item.title || item.ownerNotes;
    if (raw)
      return String(raw)
        .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();
    return `Yêu cầu lắp đặt${farmName ? ` tại ${farmName}` : ""}`;
  };

  useEffect(() => {
    Promise.all([
      supportService.getTechnicianSpareParts(),
      deviceService.getTechnicianDeploymentRequests(),
      deviceService.listApprovedFirmwareReleases(),
      deviceService.listHardwarePreparations(),
      farmService.getFarms(),
    ])
      .then(([stock, deployments, releases, preparations, farms]) => {
        setItems(
          (Array.isArray(stock) ? stock : []).filter((item: any) =>
            String(item.category || "")
              .toLowerCase()
              .includes("gateway"),
          ),
        );
        setRequests(Array.isArray(deployments) ? deployments : []);
        const farmIds = [...new Set([
          ...(Array.isArray(farms) ? farms : []).map((farm: any) => farm.id || farm.farmId),
          ...(Array.isArray(deployments) ? deployments : [])
          .map((item: any) => item.farmId || item.context?.farmId || item.farm?.id)
          .filter(Boolean),
        ])] as string[];
        Promise.all(farmIds.map(farmId => deviceService.getGateways(farmId).catch(() => [])))
          .then(async groups => {
            const gateways = groups.flat().map((gateway: any) => ({
              ...gateway,
              // Chỉ dùng quan hệ Farm do API Gateway trả về, không suy ra từ Deployment Request.
              farmName: gateway.farmName || gateway.farm?.name || '',
            })).filter((gateway: any) => String(gateway.status || '').toLowerCase() !== 'decommissioned');
            const withJobs = await Promise.all(gateways.map(async (gateway: any) => ({
              ...gateway,
              otaJob: await deviceService.getLatestGatewayFirmwareJob(gateway.gatewayId || gateway.id).catch(() => null),
            })));
            // Gateway đạt ReadyForDeployment từ trang Chuẩn bị phần cứng phải
            // xuất hiện ngay trong cùng danh sách để có thể kích hoạt. Không
            // suy ra trạng thái từ tên thiết bị hay tự tạo Gateway runtime.
            const readyCandidates = (Array.isArray(preparations) ? preparations : [])
              .filter((preparation: any) =>
                String(preparation.status) === "ReadyForDeployment" &&
                String(preparation.deviceType || "").toUpperCase().includes("GATEWAY"),
              );
            const readyGateways = (await Promise.all(readyCandidates.map(async (preparation: any) => {
              const enrollment = await deviceService
                .getGatewayEnrollment(preparation.hardwareItemId)
                .catch(() => null);
              // Sau khi activation, runtime gateway là nguồn dữ liệu chính;
              // không đưa lại session chuẩn bị vào bảng lần thứ hai.
              if (String(enrollment?.status || "").toLowerCase() === "activated" || enrollment?.gatewayId) return null;
              const item = (Array.isArray(stock) ? stock : []).find(
                (candidate: any) => candidate.id === preparation.hardwareItemId,
              );
              return {
                  ...preparation,
                  id: preparation.hardwareItemId,
                  gatewayId: undefined,
                  hardwareItemId: preparation.hardwareItemId,
                  gatewaySerial: item?.serialNumber || item?.code || "Gateway",
                  serialNumber: item?.serialNumber,
                  macAddress: item?.macAddress,
                  firmwareVersion: preparation.boardProfile || "Đã chuẩn bị",
                  isReady: true,
                  farmName: "",
              };
            }))).filter(Boolean);
            const activeHardwareIds = new Set(
              withJobs.flatMap((gateway: any) => [gateway.hardwareItemId, gateway.macAddress, gateway.gatewaySerial, gateway.serialNumber]).filter(Boolean),
            );
            setActiveGateways([
              ...withJobs,
              ...readyGateways.filter((gateway: any) => !activeHardwareIds.has(gateway.hardwareItemId) && !activeHardwareIds.has(gateway.macAddress) && !activeHardwareIds.has(gateway.gatewaySerial)),
            ]);
          });
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
    ) || requests[0];
    if (!enrollment || !request?.farmId) return;
    setError("");
    try {
      const result = await deviceService.activateGatewayEnrollment(
        enrollment.id,
        { farmId: request.farmId, ...(deploymentRequestId ? { deploymentRequestId } : {}), frequencyBand },
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

  const activatePreparedGateway = async (prepared: any, otaReleaseId: string) => {
    setError("");
    try {
      if (!otaReleaseId) throw new Error("Vui lòng chọn phiên bản Runtime để OTA lần đầu.");
      const existing = await deviceService.getGatewayEnrollment(prepared.hardwareItemId);
      const request = requests[0];
      if (!existing) throw new Error("Gateway chưa có enrollment hoặc chưa nhận handshake.");
      if (String(existing.status).toLowerCase() === "activated") throw new Error("Gateway này đã được kích hoạt.");
      if (!request?.farmId) throw new Error("Chưa có yêu cầu triển khai đang hoạt động để gán Gateway.");
      if (!existing.handshakeVerifiedAtUtc) throw new Error("Gateway chưa nhận bootstrap handshake từ ESP.");
      const result = await deviceService.activateGatewayEnrollment(existing.id, { farmId: request.farmId, frequencyBand });
      setActivated(result);
      setActiveGateways((current) => current.filter((gateway: any) => gateway.hardwareItemId !== prepared.hardwareItemId));
      const resolvedGatewayId = result.gatewayId || "";
      if (!resolvedGatewayId) throw new Error("Đã kích hoạt nhưng chưa nhận được mã Gateway để bắt đầu OTA.");
      const job = await deviceService.scheduleGatewayFirmware(resolvedGatewayId, otaReleaseId);
      setGatewayId(resolvedGatewayId);
      setOtaJob(job);
      setShowFirstOta(false);
      // OTA lần đầu đã được tạo tự động; không mở lại popup OTA thủ công.
      setShowOta(false);
      // Đọc lại toàn bộ danh sách từ backend để không hiển thị bản ghi lạc
      // hoặc trạng thái optimistic ở frontend sau khi kích hoạt.
      window.location.reload();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Kích hoạt Gateway thất bại.");
    }
  };
  const setSelectedHardwareId = (_value: string) => {
    const prepared = activeGateways.find((gateway: any) => gateway.isReady);
    if (prepared) {
      setFirstOtaReleaseId(latestRuntimeRelease?.id || "");
      setShowFirstOta(true);
    }
  };

  const startOta = async () => {
    if (!gatewayId || !runtimeReleaseId) return;
    setError("");
    try {
      const job = await deviceService.scheduleGatewayFirmware(
        gatewayId,
        runtimeReleaseId,
        scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
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
  const activeOta = ["Scheduled", "CommandSent", "InProgress"].includes(String(otaJob?.status));
  const terminalOta = ["Succeeded", "Failed", "RolledBack", "TimedOut"].includes(String(otaJob?.status));
  const statusTone = (status?: string) => {
    if (status === "Succeeded") return "bg-emerald-100 text-emerald-700";
    if (["Failed", "RolledBack", "TimedOut"].includes(status || "")) return "bg-rose-100 text-rose-700";
    if (["CommandSent", "InProgress"].includes(status || "")) return "bg-indigo-100 text-indigo-700";
    return "bg-amber-100 text-amber-700";
  };
  const versionParts = (version: string) => String(version || "0").replace(/^v/i, "").split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const isNewerVersion = (candidate: string, current: string) => {
    const a = versionParts(candidate); const b = versionParts(current);
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) { if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0); }
    return false;
  };
  const latestRuntimeRelease = runtimeReleases.reduce((latest, release) => !latest || isNewerVersion(release.version, latest.version) ? release : latest, null as any);

  return (
    <div className="min-h-full bg-slate-50/70">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-sky-900 p-6 text-white shadow-xl md:p-8">
        <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">
          <Radio className="inline mr-2 text-sky-300" />
          Kích hoạt và quản lý Gateway
        </h1>
        <p className="text-sm text-slate-300 mt-1">
          Kích hoạt Gateway mới và quản lý các Gateway đang hoạt động.
        </p>
      </div>
      <div className="rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-slate-700">Danh sách Gateway</span><select value={gatewayFilter} onChange={(event) => setGatewayFilter(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"><option value="ALL">Tất cả trạng thái</option><option value="ACTIVE">Đang hoạt động</option><option value="READY">Chưa kích hoạt</option></select></div>
        {activeGateways.length === 0 ? <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Chưa có Gateway trong danh sách.</p> : <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Gateway</th><th className="p-3">Trang trại</th><th className="p-3">Vị trí</th><th className="p-3">Phiên bản đang chạy</th><th className="p-3">Trạng thái</th><th className="p-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{activeGateways.filter((gateway: any) => gatewayFilter === 'ALL' || (gatewayFilter === 'ACTIVE' && !gateway.isReady) || (gatewayFilter === 'READY' && gateway.isReady)).map((gateway: any) => { const id = gateway.gatewayId || gateway.id; const failed = ['Failed', 'RolledBack', 'TimedOut'].includes(String(gateway.otaJob?.status)); const hasUpdate = Boolean(latestRuntimeRelease && isNewerVersion(latestRuntimeRelease.version, gateway.firmwareVersion)); return <tr key={id} className="hover:bg-slate-50"><td className="p-3"><strong className="block text-slate-900">{gateway.gatewaySerial || gateway.serialNumber || 'Gateway'}</strong><span className="text-slate-400">{gateway.macAddress || gateway.hardwareItemId || id}</span></td><td className="p-3 text-slate-700">{gateway.isReady ? '—' : (gateway.farmName || 'Chưa xác định')}</td><td className="p-3 text-slate-700">{gateway.isReady ? 'Chưa gán' : (gateway.installationLocation || 'Chưa khai báo')}</td><td className="p-3 font-semibold text-slate-700">{gateway.isReady ? '—' : `Runtime v${gateway.firmwareVersion || 'Chưa xác định'}`}</td><td className="p-3"><span className={`font-semibold ${gateway.isReady ? 'text-amber-700' : 'text-emerald-700'}`}>{gateway.isReady ? 'Sẵn sàng kích hoạt' : 'Đang hoạt động'}</span></td><td className="p-3 text-right">{gateway.isReady ? <Button size="sm" className="bg-emerald-600 text-white" onClick={() => { setForm((previous) => ({ ...previous, hardwareItemId: gateway.hardwareItemId || '' })); setSelectedHardwareId?.(''); }}>Kích hoạt</Button> : failed ? <Button size="sm" className="bg-amber-600 text-white" onClick={() => { setGatewayId(id); setActivated(gateway); setOtaJob(gateway.otaJob); setShowOta(true); }}><RefreshCw size={14} /> Thử lại</Button> : <Button size="sm" className={hasUpdate ? "bg-indigo-600 text-white" : "border border-indigo-200 bg-white text-indigo-700"} onClick={() => { setGatewayId(id); setActivated(gateway); setOtaJob(gateway.otaJob); setShowOta(true); }}><Rocket size={14} /> {hasUpdate ? "Chuyển OTA" : "OTA bản khác"}</Button>}</td></tr>; })}</tbody></table></div>}
      </div>
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      <Modal isOpen={showFirstOta} onClose={() => setShowFirstOta(false)} title="Kích hoạt Gateway và OTA lần đầu" size="md">
        <div className="space-y-4">
          <div>
            <h2 className="font-bold text-slate-900">Chọn phiên bản Runtime</h2>
            <p className="mt-1 text-sm text-slate-600">
              Sau khi kích hoạt, hệ thống sẽ bắt đầu OTA ngay lập tức.
            </p>
          </div>
          <label className="block text-sm font-semibold text-slate-700">
            Phiên bản OTA lần đầu
            <select value={firstOtaReleaseId} onChange={(event) => setFirstOtaReleaseId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-normal">
              <option value="">-- Chọn phiên bản Runtime --</option>
              {runtimeReleases.map((release: any) => <option key={release.id} value={release.id}>Runtime v{release.version}</option>)}
            </select>
          </label>
          <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            Thời điểm gửi: <strong>Ngay lập tức</strong>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowFirstOta(false)}>Hủy</Button>
            <Button className="bg-amber-600 text-white" disabled={!firstOtaReleaseId} onClick={() => {
              const prepared = activeGateways.find((gateway: any) => gateway.isReady);
              if (prepared) void activatePreparedGateway(prepared, firstOtaReleaseId);
            }}>Kích hoạt và bắt đầu OTA</Button>
          </div>
        </div>
      </Modal>
      {activated && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="inline mr-1" size={16} />
          Gateway runtime đã Activated. Enrollment:{" "}
          <span className="font-mono">{activated.id}</span>
        </div>
      )}
      {activated && (
        <>
        <Modal isOpen={showOta} onClose={() => setShowOta(false)} title="Cập nhật Gateway" size="lg"><div className="space-y-4">
          <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sky-700 text-xs font-bold uppercase"><Rocket size={15}/> OTA Runtime</div><h2 className="mt-1 font-bold text-slate-900">Cập nhật firmware từ xa</h2></div><ShieldCheck className="text-emerald-500" size={22}/></div>
          {otaJob && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs">
              OTA job:{" "}
              <span className="font-mono">
                {otaJob.otaJobId || otaJob.jobId}
              </span>{" "}
              · Trạng thái: <strong>{otaStatusLabel[String(otaJob.status)] || otaJob.status}</strong> · Bản:{" "}
              <strong>{otaJob.targetVersion || otaJob.version}</strong>
              {(otaJob.commandId || otaJob.attemptCount) && <div className="mt-1 text-xs text-slate-500">Command: <span className="font-mono">{otaJob.commandId || "—"}</span> · Lần thử: {otaJob.attemptCount || 0}</div>}
              {(otaJob.errorMessage || otaJob.errorCode) && (
                <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                  Lỗi: {otaJob.errorCode ? `${otaJob.errorCode} · ` : ""}{otaJob.errorMessage || "Không có thông tin chi tiết."}
                </div>
              )}
            </div>
          )}
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
            <label className="block text-xs font-semibold text-slate-600">Phiên bản OTA
              <select value={runtimeReleaseId} onChange={(event) => setRuntimeReleaseId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm font-normal">
                <option value="">-- Chọn phiên bản --</option>
                {runtimeReleases.map((release) => <option key={release.id} value={release.id}>Runtime v{release.version}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-600">Thời điểm gửi
              <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm font-normal" />
            </label>
            <Button
              className="bg-sky-600 text-white"
              disabled={
                !gatewayId ||
                !runtimeReleaseId ||
                activeOta
              }
              onClick={() => void startOta()}
            >
              {["Scheduled", "CommandSent", "InProgress"].includes(String(otaJob?.status))
                ? "OTA đang xử lý"
                : "Bắt đầu cập nhật"}
            </Button>
            {["Failed", "RolledBack", "TimedOut"].includes(String(otaJob?.status)) && (
              <Button
                className="bg-amber-600 text-white"
                onClick={() => void retryOta()}
              >
                <RefreshCw size={15} /> Nạp lại OTA
              </Button>
            )}
          </div>
          {activeOta && <p className="mt-3 flex items-center gap-2 rounded-xl bg-indigo-50 p-3 text-xs text-indigo-700"><Clock3 size={14} /> Gateway đang có OTA hoạt động. Hãy chờ response MQTT hoặc timeout để retry.</p>}
          {terminalOta && otaJob?.status === "Succeeded" && <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700"><CheckCircle2 size={14} /> Firmware đã báo thành công và backend đã cập nhật trạng thái.</p>}
          {terminalOta && ["Failed", "RolledBack", "TimedOut"].includes(String(otaJob?.status)) && <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800"><AlertCircle size={14} /> Có thể nạp lại OTA; lần thử mới sẽ tạo commandId mới.</p>}
          {!gatewayId && (
            <p className="text-xs text-amber-700">
              Chưa tìm thấy Gateway runtime; hãy kiểm tra Activate.
            </p>
          )}
        </div></Modal>
        </>
      )}

      {false && <div className="bg-white border rounded-xl p-5 space-y-4">
        <div><div className="text-xs font-bold uppercase tracking-wider text-sky-600">Kích hoạt mới</div><h2 className="font-bold">Chọn Gateway cần kích hoạt</h2></div>
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
        {enrollment && !activated && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <span className="text-sm text-slate-500">Gateway đã sẵn sàng kích hoạt với cấu hình mặc định.</span>
            <Button className="shrink-0 bg-amber-600 text-white" disabled={!selectedItem || requests.length === 0} onClick={() => void activate()}>Kích hoạt Gateway</Button>
          </div>
        )}
      </div>}

      {false && enrollment && !activated && (
        <>
        <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-bold text-slate-900">Gateway đã sẵn sàng kích hoạt</h2><p className="mt-1 text-sm text-slate-500">Hệ thống tự dùng Farm đang hoạt động và cấu hình mặc định.</p></div><Button className="bg-amber-600 text-white" disabled={!selectedItem || requests.length === 0} onClick={() => void activate()}>Kích hoạt Gateway</Button></div></div>
        <Modal isOpen={showActivate} onClose={() => setShowActivate(false)} title="Activate Gateway Runtime" size="lg"><div className="space-y-4">
          <h2 className="font-bold">2. Activate Gateway runtime</h2>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Farm sẽ được tự xác định theo yêu cầu triển khai đang hoạt động của Gateway; không cần chọn hợp đồng.</div>
          <select
            value={deploymentRequestId}
            onChange={(event) => setDeploymentRequestId(event.target.value)}
            className="hidden"
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
            disabled={!selectedItem || requests.length === 0}
            onClick={() => { void activate(); setShowActivate(false); }}
          >
            Activate Gateway runtime
          </Button>
        </div></Modal>
        </>
      )}
      </div>
    </div>
  );
};
