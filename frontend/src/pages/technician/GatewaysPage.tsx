import React, { useEffect, useState } from "react";
import { deviceService, supportService } from "../../services";
import { Button, StatusBadge, Modal } from "../../components/ui/BaseUI";
import { Radio, RefreshCw, Package, Cpu } from "lucide-react";
const rid = (x: any) => x?.requestId || x?.deploymentRequestId || x?.id || "";
const label = (x: any) =>
  `${x?.farmName || x?.farmId || "Farm"} · ${x?.zoneName || x?.zoneId || "Zone"} · ${x?.status || "Ready"}`;
const isGw = (x: any) =>
  String(x.category || "").toUpperCase() === "GATEWAY" ||
  /gateway|trạm central/i.test(`${x.code || ""} ${x.name || ""}`);
const isNodeModule = (x: any) => String(x.category || x.type || x.deviceCategory || "").trim().toUpperCase().replace(/[\s-]+/g, "_") === "NODE_MODULE";
const mac = (v: any) => {
  const h = String(v || "")
    .replace(/[^0-9a-f]/gi, "")
    .toUpperCase();
  return h.length === 12
    ? h.match(/.{2}/g)!.join(":")
    : String(v || "")
        .trim()
        .toUpperCase();
};
const sha = async (v: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  )
    .join("")
    .toUpperCase();
export const GatewaysPage: React.FC = () => {
  const [g, setG] = useState<any[]>([]),
    [stock, setStock] = useState<any[]>([]),
    [nodeStock, setNodeStock] = useState<any[]>([]),
    [selectedNodeStockIds, setSelectedNodeStockIds] = useState<string[]>([]),
    [rs, setRs] = useState<any[]>([]),
    [sel, setSel] = useState<any>(),
    [nodeModal, setNodeModal] = useState(false),
    [busy, setBusy] = useState(false),
    [nodeBusy, setNodeBusy] = useState(false),
    [f, setF] = useState<any>({
      deploymentRequestId: "",
      frequencyBand: "915MHz",
      firmwareVersion: "1.0.0",
      mqttClientId: "",
      fingerprint: "",
    }),
    [node, setNode] = useState({ hardwareAddress: "", deviceType: "SensorNode" });
  const load = async () => {
    const [b, c, d] = await Promise.all([
      supportService.getTechnicianSpareParts().catch(() => []),
      deviceService.getTechnicianDeploymentRequests().catch(() => []),
      supportService.getServiceRequests().catch(() => []),
    ]);
    const services = new Map(
      (Array.isArray(d) ? d : [])
        .filter((x: any) => x.deploymentRequestId)
        .map((x: any) => [x.deploymentRequestId, x]),
    );
    const requests = (Array.isArray(c) ? c : [])
      .filter(
        (x: any) =>
          Boolean(x.technicianUserId) &&
          !["Draft", "Completed"].includes(String(x.status || "")),
      )
      .map((x: any) => {
        const s = services.get(rid(x));
        return {
          ...x,
          farmName: s?.farmName || x.farmName,
          zoneName: s?.zoneName || x.zoneName,
        };
      });
    const farms = [
      ...new Set(requests.map((x: any) => x.farmId).filter(Boolean)),
    ] as string[];
    const lists = await Promise.all(
      farms.map((id) => deviceService.getGateways(id).catch(() => [])),
    );
    const registered = lists
      .flat()
      .filter(
        (x: any, i: number, a: any[]) =>
          a.findIndex(
            (y) => (y.gatewayId || y.id) === (x.gatewayId || x.id),
          ) === i,
      );
    const used = new Set(
      registered.flatMap((x: any) =>
        [x.macAddress, x.gatewaySerial]
          .filter(Boolean)
          .map((v: string) => v.toUpperCase()),
      ),
    );
    // Load the canonical Node list from firmware-config so this screen shows
    // what is actually attached to each Gateway, not only inventory items.
    const gatewaysWithNodes = await Promise.all(registered.map(async (gateway: any) => {
      const gatewayId = gateway.gatewayId || gateway.id;
      const config = gatewayId ? await deviceService.getGatewayFirmwareConfig(gatewayId).catch(() => null) : null;
      return { ...gateway, provisionedNodes: Array.isArray(config?.nodes) ? config.nodes : [] };
    }));
    setG(gatewaysWithNodes);
    setRs(requests);
    setStock(
      (Array.isArray(b) ? b : [])
        .filter(isGw)
        .filter(
          (x: any) =>
            !used.has(String(x.macAddress || "").toUpperCase()) &&
            !used.has(String(x.serialNumber || x.code || "").toUpperCase()),
        ),
    );
    setNodeStock(
      (Array.isArray(b) ? b : []).filter(
        (x: any) => isNodeModule(x) && Number(x.quantityInStock || x.quantity || 0) > 0,
      ),
    );
  };
  useEffect(() => {
    load();
  }, []);
  const openGateway = (x: any) => {
    const r =
      rs.find((q) => rid(q) === (x.deploymentRequestId || x.requestId)) ||
      rs[0];
    const id = rid(r);
    setSel(x);
    setF({
      deploymentRequestId: id,
      frequencyBand: "915MHz",
      firmwareVersion: "1.0.0",
      mqttClientId:
        `smartfarm-gateway-${x.gatewayId || x.id || x.serialNumber}`.replace(
          /[^A-Za-z0-9_-]/g,
          "",
        ),
      fingerprint: "",
    });
    sha(
      `${x.serialNumber || x.code || ""}|${x.macAddress || ""}|${id}|${r?.farmId || ""}`,
    ).then((v) => setF((p: any) => ({ ...p, fingerprint: v })));
  };
  const provisionGateway = async () => {
    const r = rs.find((x) => rid(x) === f.deploymentRequestId);
    if (!sel || !r) return;
    setBusy(true);
    try {
      await deviceService.provisionGateway({
        deploymentRequestId: f.deploymentRequestId,
        farmId: r.farmId,
        macAddress: mac(sel.macAddress),
        gatewaySerial: sel.serialNumber || sel.code,
        frequencyBand: f.frequencyBand,
        firmwareVersion: f.firmwareVersion,
        mqttClientId: f.mqttClientId,
        clientCertificateFingerprint: f.fingerprint,
      });
      setSel(undefined);
      await load();
    } catch (e: any) {
      alert(
        e?.response?.data?.detail || e?.response?.data?.message || e?.message,
      );
    } finally {
      setBusy(false);
    }
  };
  const provisionNode = async () => {
    const r = rs.find(
      (x) => rid(x) === (f.deploymentRequestId || sel?.deploymentRequestId || sel?.requestId || sel?.deployment?.id),
    );
    const gatewayId = sel?.gatewayId || sel?.id;
    if (!r) { alert("Chưa xác định được Deployment Request."); return; }
    if (!gatewayId) { alert("Chưa xác định được Gateway ID."); return; }
    if (selectedNodeStockIds.length === 0) { alert("Vui lòng tích chọn ít nhất một Node module."); return; }
    setNodeBusy(true);
    try {
      await deviceService.provisionNodes({
        deploymentRequestId: rid(r),
        gatewayId,
        farmId: r.farmId,
        nodes: selectedNodeStockIds.map(id => nodeStock.find(x => String(x.id) === id)).filter(Boolean).flatMap((item: any) => Array.from({ length: Math.min(Number(item.quantityInStock || item.quantity || 1), 50) }, (_, index) => ({ hardwareAddress: item.macAddress || item.serialNumber || `${item.code}-${index + 1}`, deviceType: "SensorNode" as const }))),
      });
      setNodeModal(false);
      setNode({ hardwareAddress: "", deviceType: "SensorNode" });
      setSelectedNodeStockIds([]);
      await load();
      alert("Đã đồng bộ Node vào Gateway. Danh sách Gateway đã được cập nhật.");
    } catch (e: any) {
      alert(
        e?.response?.data?.detail || e?.response?.data?.message || e?.message,
      );
    } finally {
      setNodeBusy(false);
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <h1 className="text-xl font-bold">
          <Radio className="inline text-emerald-600" /> Quản lý Gateway
        </h1>
        <Button variant="outline" onClick={load}>
          <RefreshCw size={14} /> Làm mới
        </Button>
      </div>
      <section>
        <h2 className="font-bold">Gateway đã provision ({g.length})</h2>
        {g.map((x) => (
          <div
            key={x.gatewayId || x.id}
            className="p-4 border rounded-xl mt-2 flex justify-between items-center"
          >
            <div>
              <b>{x.gatewaySerial}</b>
              <small className="block">
                Yêu cầu: {x.deploymentRequestId || "—"}
              </small>
              <small className="block text-emerald-700">
                Node đã provision: {Array.isArray(x.provisionedNodes) ? x.provisionedNodes.length : 0}
                {Array.isArray(x.provisionedNodes) && x.provisionedNodes.length > 0
                  ? ` · ${x.provisionedNodes.map((n: any) => n.hardwareAddress).join(", ")}`
                  : ""}
              </small>
            </div>
            <div className="flex gap-3 items-center">
              <StatusBadge status={x.status || "Provisioned"} />
              <Button
                onClick={() => {
                  setSel(x);
                  setF((previous: any) => ({ ...previous, deploymentRequestId: x.deploymentRequestId || x.requestId || x.deployment?.id || previous.deploymentRequestId || "" }));
                  setNodeModal(true);
                }}
              >
                <Cpu size={14} /> Provision Node
              </Button>
            </div>
          </div>
        ))}
      </section>
      <section>
        <h2 className="font-bold">
          <Package size={18} className="inline" /> Gateway trong kho (
          {stock.length})
        </h2>
        {stock.map((x) => (
          <div
            key={x.id}
            className="p-4 bg-amber-50 border rounded-xl mt-2 flex justify-between"
          >
            <span>
              <b>{x.name || x.code}</b>
              <small className="block">
                {x.serialNumber || "—"} · {mac(x.macAddress) || "—"}
              </small>
            </span>
            <Button onClick={() => openGateway(x)}>Provision Gateway</Button>
          </div>
        ))}
      </section>
      <Modal
        isOpen={nodeModal}
        onClose={() => setNodeModal(false)}
        title="Provision Node thật vào Gateway"
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Chỉ chọn các Node module trong kho Technician. Cảm biến CB/DHT không được provision ở bước này.</p>
          {Array.isArray(sel?.provisionedNodes) && sel.provisionedNodes.length > 0 && <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm">
            <strong className="block text-emerald-900">Node đã provision vào Gateway này</strong>
            <div className="mt-1 space-y-1 text-emerald-800">
              {sel.provisionedNodes.map((item: any) => <div key={item.deviceId || item.hardwareAddress}>✓ {item.hardwareAddress}</div>)}
            </div>
          </div>}
          <label className="block font-semibold">Chọn nhiều Node module trong kho</label>
          <div className="w-full border rounded p-2 max-h-44 overflow-y-auto space-y-1">
            {nodeStock.map((item: any) => { const id = String(item.id); const hardware = String(item.macAddress || item.serialNumber || `${item.code}-1`).trim().toUpperCase(); const alreadyProvisioned = (sel?.provisionedNodes || []).some((n: any) => String(n.hardwareAddress || '').trim().toUpperCase() === hardware); const checked = selectedNodeStockIds.includes(id); return <label key={id} className={`flex items-center gap-2 p-2 rounded ${alreadyProvisioned ? "opacity-60" : "cursor-pointer"} ${checked ? "bg-emerald-50 border border-emerald-300" : "hover:bg-slate-50"}`}>
              <input type="checkbox" disabled={alreadyProvisioned} checked={checked || alreadyProvisioned} onChange={(e) => setSelectedNodeStockIds(previous => e.target.checked ? [...previous, id] : previous.filter(value => value !== id))} />
              <span><strong>{item.code || item.name}</strong><small className="block text-slate-500">{alreadyProvisioned ? "Đã provision vào Gateway" : `Tồn: ${item.quantityInStock || item.quantity}`}</small></span>
            </label>; })}
          </div>
          <div className="text-xs font-semibold text-emerald-700">Đã chọn {selectedNodeStockIds.length} Node module</div>
          {nodeStock.length === 0 && <div className="text-xs text-amber-700">Kho Technician hiện không có Node module.</div>}
          <select
            className="w-full border rounded p-2"
            value={f.deploymentRequestId || sel?.deploymentRequestId || ""}
            onChange={(e) =>
              setF({ ...f, deploymentRequestId: e.target.value })
            }
          >
            <option value="">-- Chọn Deployment Request --</option>
            {rs.map((r) => (
              <option key={rid(r)} value={rid(r)}>
                {label(r)}
              </option>
            ))}
          </select>
          <Button
            disabled={
              nodeBusy ||
              selectedNodeStockIds.length === 0 ||
              !(f.deploymentRequestId || sel?.deploymentRequestId)
            }
            onClick={provisionNode}
          >
            {nodeBusy ? "Đang provision Node..." : "Xác nhận Provision Node"}
          </Button>
        </div>
      </Modal>
      <Modal
        isOpen={!!sel && !nodeModal && !!f.mqttClientId}
        onClose={() => setSel(undefined)}
        title="Provision Gateway vào Deployment"
      >
        <div className="space-y-3">
          <select
            className="w-full border rounded p-2"
            value={f.deploymentRequestId}
            onChange={(e) =>
              setF({ ...f, deploymentRequestId: e.target.value })
            }
          >
            <option value="">-- Chọn yêu cầu --</option>
            {rs.map((r) => (
              <option key={rid(r)} value={rid(r)}>
                {label(r)}
              </option>
            ))}
          </select>
          <input
            className="w-full border rounded p-2"
            value={f.frequencyBand}
            onChange={(e) => setF({ ...f, frequencyBand: e.target.value })}
          />
          <input
            className="w-full border rounded p-2"
            value={f.firmwareVersion}
            onChange={(e) => setF({ ...f, firmwareVersion: e.target.value })}
          />
          <input
            readOnly
            className="w-full border rounded p-2"
            value={f.mqttClientId}
          />
          <input
            readOnly
            className="w-full border rounded p-2 font-mono"
            value={f.fingerprint}
          />
          <Button
            disabled={busy || !f.deploymentRequestId}
            onClick={provisionGateway}
          >
            {busy ? "Đang provision..." : "Xác nhận Provision"}
          </Button>
        </div>
      </Modal>
    </div>
  );
};
