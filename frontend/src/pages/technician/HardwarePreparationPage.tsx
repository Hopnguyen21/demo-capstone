import React, { useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, Wrench, Search, SlidersHorizontal } from "lucide-react";
import { Button, Modal } from "../../components/ui/BaseUI";
import { deviceService, supportService } from "../../services";

const labels: Record<string, string> = {
  HardwarePreparation: "Chuẩn bị phần cứng",
  FirmwarePrepared: "Đã nạp firmware",
  IdentityVerified: "Đã xác minh định danh",
  ConnectivityVerified: "Đã kiểm tra kết nối",
  ReadyForDeployment: "Sẵn sàng triển khai",
  Faulty: "Thiết bị lỗi",
};
export const HardwarePreparationPage: React.FC = () => {
  const [stock, setStock] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [releases, setReleases] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>();
  const [releaseId, setReleaseId] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [lora, setLora] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [gatewayEnrollment, setGatewayEnrollment] = useState<any>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const load = async () => {
    setBusy(true);
    try {
      const [items, rows, approved] = await Promise.all([
        supportService.getTechnicianSpareParts(),
        deviceService.listHardwarePreparations(),
        deviceService.listApprovedFirmwareReleases(),
      ]);
      setStock(Array.isArray(items) ? items : []);
      setSessions(Array.isArray(rows) ? rows : []);
      setReleases(Array.isArray(approved) ? approved : []);
    } catch (e: any) {
      setError(
        e?.response?.data?.detail || e?.message || "Không tải được dữ liệu.",
      );
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const start = async (item: any) => {
    try {
      setSelected(await deviceService.startHardwarePreparation(item.id));
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message);
    }
  };
  const advance = async (status: string, keepSelected = false) => {
    if (!selected) return;
    try {
      const stockItem = stock.find((item) => item.id === selected.hardwareItemId);
      const preparedNodeId =
        selected.nodeId ||
        stockItem?.code ||
        stockItem?.serialNumber ||
        `NODE-${String(selected.hardwareItemId).slice(0, 8).toUpperCase()}`;
      await deviceService.advanceHardwarePreparation(selected.id, {
        status,
        nodeId: nodeId || (!selectedIsGateway ? preparedNodeId : undefined),
        loRaAddress: lora ? Number(lora) : undefined,
        boardProfile: selected.deviceType,
      });
      await load();
      setSelected(keepSelected ? { ...selected, status } : undefined);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message);
    }
  };
  const firmware = async () => {
    if (!selected || !releaseId) return;
    try {
      const gateway = String(selected.deviceType)
        .toUpperCase()
        .includes("GATEWAY");
      await deviceService.recordFirmwareInstallation(selected.id, {
        firmwareReleaseId: releaseId,
        uploadMethod: "UsbManual",
        result: "Succeeded",
        boardProfile: gateway ? "ESP32 Gateway Bootstrap" : "Arduino Nano",
        notes: gateway
          ? "USB Bootstrap; OTA chỉ dùng sau Enrollment."
          : "USB qua Arduino IDE/PlatformIO.",
      });
      await advance("FirmwarePrepared");
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message);
    }
  };
  const verifyGatewayIdentity = async () => {
    if (!selected) return;
    try {
      const enrollment = await deviceService.getGatewayEnrollment(
        selected.hardwareItemId,
      );
      if (!enrollment?.handshakeVerifiedAtUtc) {
        setError(
          "Chưa nhận bootstrap handshake từ ESP thật. Giữ Gateway kết nối Wi-Fi để hệ thống tự nhận diện.",
        );
        return;
      }
      await advance("IdentityVerified", true);
    } catch (e: any) {
      setError(
        e?.response?.data?.detail ||
          e?.message ||
          "Chưa xác minh được Gateway từ ESP.",
      );
    }
  };
  const completeGatewayConnectivity = async () => {
    if (!selected || !gatewayEnrollment?.handshakeVerifiedAtUtc) return;
    try {
      await deviceService.recordHardwareConnectivityCheck(selected.id, {
        passed: true,
        evidence: `Bootstrap handshake OK; MAC=${gatewayEnrollment.macAddress}; ChipID=${gatewayEnrollment.chipId}`,
      });
      await advance("ConnectivityVerified", true);
    } catch (e: any) {
      setError(
        e?.response?.data?.detail ||
          e?.message ||
          "Chưa thể ghi nhận kết nối Gateway.",
      );
    }
  };
  const chosen = releases.find((x) => x.id === releaseId);
  const preparableStock = stock.filter((item) => {
    const category = String(
      item.category || item.deviceType || "",
    ).toUpperCase();
    const matchesType = typeFilter === "ALL" || category.includes(typeFilter);
    const matchesQuery = `${item.name} ${item.code || ""} ${item.serialNumber || ""} ${item.macAddress || ""}`.toLowerCase().includes(query.toLowerCase());
    return matchesType && matchesQuery && (category.includes("GATEWAY") || category.includes("NODE"));
  });
  const selectedIsGateway =
    selected && String(selected.deviceType).toUpperCase().includes("GATEWAY");
  useEffect(() => {
    if (!selectedIsGateway || !selected?.hardwareItemId) {
      setGatewayEnrollment(null);
      return;
    }
    void deviceService
      .getGatewayEnrollment(selected.hardwareItemId)
      .then(setGatewayEnrollment)
      .catch(() => setGatewayEnrollment(null));
  }, [selected?.hardwareItemId, selectedIsGateway]);
  return (
    <div className="max-w-6xl mx-auto space-y-5 p-4 md:p-6">
      <div className="rounded-2xl bg-gradient-to-r from-emerald-950 to-slate-900 p-6 text-white shadow-lg flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-emerald-300">Technician workspace</div>
          <h1 className="mt-1 text-2xl font-bold">
            <Wrench className="inline mr-2 text-emerald-300" />
            Chuẩn bị phần cứng
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-2xl">
            Nạp firmware và xác minh định danh trước khi gán Gateway–Node trong
            GIS; kiểm tra LoRa sẽ do Runtime tự thực hiện sau khi được gán.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={busy} className="border-slate-500 text-white hover:bg-white/10">
          <RefreshCw size={14} /> Làm mới
        </Button>
      </div>
      {error && (
        <div className="p-3 bg-rose-50 text-rose-700 rounded">{error}</div>
      )}
      <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 md:flex-row"><label className="relative flex-1"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm theo tên, mã, serial hoặc MAC..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-emerald-400"/></label><div className="flex items-center gap-2"><SlidersHorizontal size={16} className="text-slate-400"/><select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="ALL">Gateway & Node</option><option value="GATEWAY">Chỉ Gateway</option><option value="NODE">Chỉ Node</option></select></div></div></div>
      <div className="grid gap-3 md:grid-cols-2">
        {preparableStock.map((item) => {
          const s = sessions.find(
            (x) => x.hardwareItemId === item.id && x.status !== "Faulty",
          );
          return (
            <div className="rounded-2xl border bg-white p-4 shadow-sm flex items-center justify-between gap-4 hover:border-emerald-300" key={item.id}>
              <div className="min-w-0"><div className="flex items-center gap-2"><b className="truncate">{item.name}</b><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{String(item.category || item.deviceType || "Hardware")}</span></div><div className="text-xs text-slate-500 mt-1">
                  {item.serialNumber || item.macAddress} ·{" "}
                  {s ? labels[s.status] || s.status : "Chưa bắt đầu"}
                </div>
              </div>
              {s ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelected(s)}
                >
                  Tiếp tục
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="bg-emerald-600 text-white"
                  onClick={() => void start(item)}
                >
                  Bắt đầu
                </Button>
              )}
            </div>
          );
        })}
      </div>
      <Modal isOpen={Boolean(selected)} onClose={() => setSelected(undefined)} title={selected ? `Chuẩn bị ${selected.deviceType || "thiết bị"}` : "Chuẩn bị phần cứng"} size="lg">
        {selected && <div className="space-y-3">
          <b>{labels[selected.status] || selected.status}</b>
          <div className="text-xs">
            Hardware Item:{" "}
            <span className="font-mono">{selected.hardwareItemId}</span>
          </div>
          {selected.status === "HardwarePreparation" && (
            <>
              <p className="text-sm">
                Gateway: USB Bootstrap. Node: USB qua Arduino IDE/PlatformIO.
              </p>
              <select
                value={releaseId}
                onChange={(e) => setReleaseId(e.target.value)}
                className="w-full rounded-lg border p-2.5"
              >
                <option value="">-- Chọn Firmware Release Approved --</option>
                {releases
                  .filter((r) => {
                    const target = String(r.hardwareTarget || "").toUpperCase();
                    const gateway = String(selected.deviceType || "")
                      .toUpperCase()
                      .includes("GATEWAY");
                    return gateway
                      ? target.includes("GATEWAY")
                      : !target.includes("GATEWAY");
                  })
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.hardwareTarget} · {r.version} ·{" "}
                      {r.commitSha || "no commit"}
                    </option>
                  ))}
              </select>
              {chosen && (
                <div className="rounded bg-slate-50 p-3 text-xs">
                  <div>
                    Source:{" "}
                    {chosen.sourceRepository ? (
                      <a
                        href={chosen.sourceRepository}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 underline"
                      >
                        Mở repository
                      </a>
                    ) : (
                      "—"
                    )}{" "}
                    · Commit: {chosen.commitSha || "—"}
                  </div>
                  <div>
                    Artifact:{" "}
                    {chosen.artifactUrl ? (
                      <a
                        href={chosen.artifactUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 underline"
                      >
                        Tải firmware
                      </a>
                    ) : (
                      "—"
                    )}{" "}
                    · SHA-256: {chosen.artifactSha256 || "—"}
                  </div>
                </div>
              )}
              <Button
                disabled={!releaseId}
                className="bg-emerald-600 text-white"
                onClick={() => void firmware()}
              >
                Ghi nhận firmware
              </Button>
            </>
          )}
          {selected.status === "FirmwarePrepared" &&
            (selectedIsGateway ? (
              <>
                <div
                  className={`rounded-lg p-3 text-sm ${gatewayEnrollment?.handshakeVerifiedAtUtc ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}
                >
                  {gatewayEnrollment?.handshakeVerifiedAtUtc
                    ? `ESP handshake đã nhận · MAC ${gatewayEnrollment.macAddress || "—"} · Chip ID ${gatewayEnrollment.chipId || "—"}`
                    : "Chưa nhận ESP bootstrap handshake. Giữ ESP kết nối Wi-Fi; hệ thống sẽ tự cập nhật trạng thái ở đây."}
                </div>
                <Button
                  disabled={!gatewayEnrollment?.handshakeVerifiedAtUtc}
                  className="bg-emerald-600 text-white"
                  onClick={() => void verifyGatewayIdentity()}
                >
                  {gatewayEnrollment?.handshakeVerifiedAtUtc
                    ? "Xác nhận handshake và tiếp tục"
                    : "Kiểm tra lại ESP handshake"}
                </Button>
              </>
            ) : (
              <>
                <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  Node ID và LoRa Address sẽ được cấp khi đưa Node vào Gateway.
                </div>
                <Button
                  className="bg-emerald-600 text-white"
                  onClick={() => void advance("IdentityVerified")}
                >
                  Xác nhận Node đã nạp firmware
                </Button>
              </>
            ))}
          {selected.status === "IdentityVerified" && selectedIsGateway ? (
            <>
              <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                Đã nhận handshake từ ESP. Kết nối Bootstrap đã được xác minh;
                Runtime MQTT sẽ được kiểm tra sau khi Gateway được kích hoạt.
              </div>
              <Button
                className="bg-emerald-600 text-white"
                onClick={() => void completeGatewayConnectivity()}
              >
                Hoàn tất chuẩn bị Gateway
              </Button>
            </>
          ) : selected.status === "IdentityVerified" ? (
            <>
              <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                Node đã sẵn sàng để được gán vào Gateway trong GIS. LoRa chỉ
                được kiểm tra sau khi Gateway nhận danh sách Node và tự gửi
                lệnh yêu cầu.
              </div>
              <Button
                className="bg-emerald-600 text-white"
                onClick={() => void advance("ReadyForDeployment")}
              >
                <CheckCircle2 size={15} /> Hoàn tất chuẩn bị Node
              </Button>
            </>
          ) : null}
          {selected.status === "ConnectivityVerified" && (
            <Button
              className="bg-emerald-600 text-white"
              onClick={() => void advance("ReadyForDeployment")}
            >
              <CheckCircle2 size={15} /> Sẵn sàng triển khai
            </Button>
          )}
        </div>}
      </Modal>
    </div>
  );
};
