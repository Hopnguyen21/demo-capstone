import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cpu, Wifi, Radio, Zap, Wrench, Package, TrendingUp, AlertTriangle,
  Info, CheckCircle2, ChevronDown, ChevronUp, Layers, Sliders, Maximize2, Send, Database
} from 'lucide-react';
import { Button } from '../ui/BaseUI';
import { adminService } from '../../services';

export interface HoneycombEstimateResult {
  sensingRadiusM: number;
  cellAreaM2: number;
  interNodeDistanceM: number;
  gateways: number;
  sensors: number;
  actuators: number;
  totalCostVnd: number;
  minCostVnd: number;
  maxCostVnd: number;
}

interface HoneycombEstimatorProps {
  areaM2: number;
  cropName?: string;
  zoneName?: string;
  farmId?: string;
  zoneId?: string;
  defaultExpanded?: boolean;
  onApplyEstimate?: (res: HoneycombEstimateResult) => void;
}

// Tham số đặc thù cây trồng cho mạng Tổ ong
export const CROP_HONEYCOMB_PROFILES: Record<string, {
  icon: string;
  defaultRadiusM: number;
  actuatorRatio: number; // Tỉ lệ van/bơm trên mỗi cảm biến
  recommendedSensors: string;
  description: string;
}> = {
  'Cà chua (Solanum lycopersicum)': {
    icon: '🍅',
    defaultRadiusM: 14,
    actuatorRatio: 0.6,
    recommendedSensors: 'Nhiệt ẩm không khí + Độ ẩm đất & EC',
    description: 'Tán lá trung bình, yêu cầu kiểm soát độ ẩm gốc rễ và phân tầng nhiệt độ.'
  },
  'Ớt ngọt (Capsicum annuum)': {
    icon: '🫑',
    defaultRadiusM: 13,
    actuatorRatio: 0.5,
    recommendedSensors: 'Nhiệt ẩm + Ánh sáng lux + EC đất',
    description: 'Nhạy cảm với ẩm độ không khí và cường độ ánh sáng, vùng phủ tổ ong 13m tối ưu.'
  },
  'Dưa leo (Cucumis sativus)': {
    icon: '🥒',
    defaultRadiusM: 11,
    actuatorRatio: 0.7,
    recommendedSensors: 'Nhiệt ẩm vi khí hậu + Độ ẩm giá thể',
    description: 'Thân leo tán dày cản sóng RF và phân tầng vi khí hậu, cần bán kính tổ ong nhỏ (11m).'
  },
  'Xà lách Thủy canh (Lactuca sativa)': {
    icon: '🥬',
    defaultRadiusM: 16,
    actuatorRatio: 0.8,
    recommendedSensors: 'Nhiệt độ nước + pH & EC dung dịch hồi lưu',
    description: 'Môi trường thủy canh thoáng, bán kính tổ ong 16m tối ưu hóa số lượng cảm biến.'
  },
  'Dâu tây (Fragaria ananassa)': {
    icon: '🍓',
    defaultRadiusM: 12,
    actuatorRatio: 0.75,
    recommendedSensors: 'Độ ẩm giá thể giàn treo + Nhiệt độ vi khí hậu',
    description: 'Canh tác giàn treo nhiều tầng, bố trí ô tổ ong 12m đảm bảo độ đồng đều.'
  }
};

// Đơn giá thiết bị IoT chuẩn hoá (VNĐ)
export const HONEYCOMB_UNIT_PRICES = {
  gateway: 3_500_000,     // LoRa Gateway Công nghiệp IP67
  sensor: 850_000,        // Sensor Node Tổ ong (Đa thông số vi khí hậu)
  actuator: 650_000,      // Actuator Node điều khiển van điện từ / rơ-le
  accessories: 150_000,   // Vật tư phụ (cọc inox, cáp chống nhiễu, hộp bảo vệ) / node
  installationFlat: 500_000, // Phí khảo sát, tích hợp & cấu hình mạng mesh tổ ong
};

export const HoneycombEstimator: React.FC<HoneycombEstimatorProps> = ({
  areaM2,
  cropName = 'Cà chua (Solanum lycopersicum)',
  zoneName = 'Phân khu',
  farmId,
  zoneId,
  defaultExpanded = true,
  onApplyEstimate
}) => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);

  // Profile cây trồng hiện tại
  const matchedCropKey = Object.keys(CROP_HONEYCOMB_PROFILES).find(k =>
    cropName.toLowerCase().includes(k.split(' ')[0].toLowerCase())
  ) || 'Cà chua (Solanum lycopersicum)';

  const profile = CROP_HONEYCOMB_PROFILES[matchedCropKey];

  // Bán kính phủ sóng ô lục giác R (mét) mặc định mật độ thưa (R = 25m) tối ưu chi phí
  const [sensingRadius, setSensingRadius] = useState<number>(25);

  // Dữ liệu thiết bị và đơn giá từ Database
  const [hardwareItems, setHardwareItems] = useState<any[]>([]);
  const [hasLoadedHardware, setHasLoadedHardware] = useState<boolean>(false);

  useEffect(() => {
    adminService.getHardwareItems()
      .then((items: any[]) => {
        if (Array.isArray(items) && items.length > 0) {
          setHardwareItems(items);
          setHasLoadedHardware(true);
        }
      })
      .catch((err) => console.warn('Could not fetch hardware items from DB', err));
  }, []);

  const gwItem = useMemo(() => {
    return hardwareItems.find(i => i.category === 'GATEWAY') || {
      name: 'Trạm Central Gateway ESP32-LoRa Dual Antenna',
      model: 'GW-ESP32-DL01',
      unitPrice: HONEYCOMB_UNIT_PRICES.gateway,
    };
  }, [hardwareItems]);

  const sensorItem = useMemo(() => {
    return hardwareItems.find(i => i.category === 'AIR_SENSOR' || i.category === 'SENSOR_NODE') || {
      name: `Node Cảm biến Môi trường Lục giác (${profile.recommendedSensors})`,
      model: 'SN-AIR-SHT30',
      unitPrice: HONEYCOMB_UNIT_PRICES.sensor,
    };
  }, [hardwareItems, profile.recommendedSensors]);

  const actuatorItem = useMemo(() => {
    return hardwareItems.find(i => i.category === 'VALVE' || i.category === 'PUMP') || {
      name: 'Node Điều khiển Van Solenoid Tưới nhỏ giọt 4 Cổng',
      model: 'ACT-VALVE-01',
      unitPrice: HONEYCOMB_UNIT_PRICES.actuator,
    };
  }, [hardwareItems]);

  const accessoriesItem = useMemo(() => {
    return hardwareItems.find(i => i.category === 'SPARE_PART') || {
      name: 'Vật tư phụ kiện (Trụ cọc inox 304, cáp bọc chống nhiễu, hộp IP67)',
      model: 'SPARE-GEN-01',
      unitPrice: HONEYCOMB_UNIT_PRICES.accessories,
    };
  }, [hardwareItems]);

  // Hệ số bù biên (Edge boundary factor) cho hình học thực tế không vuông vức
  const boundaryFactor = 1.12;

  // Tính toán theo Thuật toán Mạng Tổ ong (Hexagonal Tessellation Algorithm)
  const calculation = useMemo(() => {
    const validArea = Math.max(50, Number(areaM2) || 1000);
    const R = Math.max(6, Math.min(30, sensingRadius));

    // 1. Diện tích 1 ô lục giác đều nội tiếp bán kính R: S = (3*sqrt(3)/2) * R^2
    const cellArea = (3 * Math.sqrt(3) / 2) * Math.pow(R, 2);

    // 2. Khoảng cách giữa 2 tâm cảm biến cạnh nhau: D = sqrt(3) * R
    const interNodeDist = Math.sqrt(3) * R;

    // 3. Số ô lục giác lý thuyết và số Sensor Node (áp dụng hệ số phủ biên 1.12)
    const rawCells = validArea / cellArea;
    const sensorsCount = Math.max(2, Math.ceil(rawCells * boundaryFactor));

    // 4. Số bộ điều khiển van/bơm Actuator
    const actuatorsCount = Math.max(1, Math.ceil(sensorsCount * profile.actuatorRatio));

    // 5. Số Gateway (mỗi Gateway LoRa phủ được đến 15.000m2 nhà màng)
    const gatewaysCount = Math.max(1, Math.ceil(validArea / 15000));

    // 6. Chi phí (Đồng bộ trực tiếp theo Đơn giá Database)
    const unitGwPrice = Number(gwItem.unitPrice) || HONEYCOMB_UNIT_PRICES.gateway;
    const unitSensorPrice = Number(sensorItem.unitPrice) || HONEYCOMB_UNIT_PRICES.sensor;
    const unitActuatorPrice = Number(actuatorItem.unitPrice) || HONEYCOMB_UNIT_PRICES.actuator;
    const unitAccessoriesPrice = Number(accessoriesItem.unitPrice) || HONEYCOMB_UNIT_PRICES.accessories;
    const unitInstallationPrice = HONEYCOMB_UNIT_PRICES.installationFlat;

    const gatewayCost = gatewaysCount * unitGwPrice;
    const sensorCost = sensorsCount * unitSensorPrice;
    const actuatorCost = actuatorsCount * unitActuatorPrice;
    const accessoriesCost = (sensorsCount + actuatorsCount) * unitAccessoriesPrice;
    const installationCost = unitInstallationPrice;

    const totalCost = gatewayCost + sensorCost + actuatorCost + accessoriesCost + installationCost;
    const minCost = Math.round(totalCost * 0.88);
    const maxCost = Math.round(totalCost * 1.18);

    const result: HoneycombEstimateResult = {
      sensingRadiusM: R,
      cellAreaM2: Math.round(cellArea),
      interNodeDistanceM: Math.round(interNodeDist * 10) / 10,
      gateways: gatewaysCount,
      sensors: sensorsCount,
      actuators: actuatorsCount,
      totalCostVnd: totalCost,
      minCostVnd: minCost,
      maxCostVnd: maxCost
    };

    return {
      ...result,
      validArea,
      gatewayCost,
      sensorCost,
      actuatorCost,
      accessoriesCost,
      installationCost
    };
  }, [areaM2, sensingRadius, profile.actuatorRatio, gwItem, sensorItem, actuatorItem, accessoriesItem]);

  const formatVND = (n: number) => n.toLocaleString('vi-VN') + ' đ';

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white animate-in fade-in duration-200">
      {/* Header Banner */}
      <div
        className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-[#119653] via-emerald-600 to-emerald-500 text-white cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0">
            <Cpu size={18} className="text-white" />
          </div>
          <div>
            <div className="font-bold text-sm flex items-center gap-2">
              Ước tính Thiết bị IoT & Chi phí Lắp đặt
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30 font-medium">
                Thuật toán Mạng Tổ ong (Hexagonal WSN)
              </span>
            </div>
            <div className="text-[11px] text-emerald-100 mt-0.5">
              Mô hình Mật độ thưa chuẩn hóa ({calculation.sensingRadiusM}m/node) • Không điểm mù • Diện tích: {Number(areaM2 || 0).toLocaleString('vi-VN')} m²
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowFormulaModal(true);
            }}
            className="text-xs bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded-lg border border-white/30 text-white font-semibold flex items-center gap-1 transition-all"
            title="Xem cơ sở toán học & công thức tổ ong"
          >
            <Info size={13} />
            <span className="hidden sm:inline">Cơ sở toán học</span>
          </button>

          <div className="text-white/80">
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>
      </div>

      {/* Expanded Estimator Body */}
      {isExpanded && (
        <div className="p-5 bg-slate-50 space-y-5 text-xs">
          {/* KPI Device Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Gateway */}
            <div className="bg-white border border-sky-200 rounded-xl p-3.5 text-center space-y-1.5 shadow-2xs">
              <div className="w-10 h-10 mx-auto rounded-xl bg-sky-100 border border-sky-200 flex items-center justify-center">
                <Wifi size={20} className="text-sky-700" />
              </div>
              <div className="font-bold text-2xl text-sky-800 font-mono">{calculation.gateways}</div>
              <div className="text-slate-600 font-bold text-xs">Trạm LoRa Gateway</div>
              <div className="text-[10px] text-slate-500">Phủ sóng bán kính 800m</div>
              <div className="text-[11px] text-sky-700 font-bold font-mono border-t border-sky-100 pt-1.5">
                {formatVND(calculation.gatewayCost)}
              </div>
            </div>

            {/* Sensor Nodes */}
            <div className="bg-white border border-emerald-200 rounded-xl p-3.5 text-center space-y-1.5 shadow-2xs">
              <div className="w-10 h-10 mx-auto rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                <Radio size={20} className="text-emerald-700" />
              </div>
              <div className="font-bold text-2xl text-emerald-800 font-mono">{calculation.sensors}</div>
              <div className="text-slate-600 font-bold text-xs">Sensor Node Tổ ong</div>
              <div className="text-[10px] text-slate-500">Mỗi node quản lý ~{calculation.cellAreaM2}m²</div>
              <div className="text-[11px] text-emerald-700 font-bold font-mono border-t border-emerald-100 pt-1.5">
                {formatVND(calculation.sensorCost)}
              </div>
            </div>

            {/* Actuators */}
            <div className="bg-white border border-amber-200 rounded-xl p-3.5 text-center space-y-1.5 shadow-2xs">
              <div className="w-10 h-10 mx-auto rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center">
                <Zap size={20} className="text-amber-700" />
              </div>
              <div className="font-bold text-2xl text-amber-800 font-mono">{calculation.actuators}</div>
              <div className="text-slate-600 font-bold text-xs">Actuator Van/Bơm</div>
              <div className="text-[10px] text-slate-500">Điều khiển tưới theo cụm ô</div>
              <div className="text-[11px] text-amber-700 font-bold font-mono border-t border-amber-100 pt-1.5">
                {formatVND(calculation.actuatorCost)}
              </div>
            </div>
          </div>

          {/* Cost Breakdown Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 font-bold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Package size={14} className="text-emerald-700" /> Bảng Báo Giá Dự Toán Lắp Đặt Hệ Thống (Thuật toán Tổ ong)
              </span>
              <div className="flex items-center gap-2">
                {hasLoadedHardware ? (
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <Database size={10} className="text-emerald-700" /> Giá từ DB (PlatformHardwareItems)
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-500 font-normal">Tiêu chuẩn VietGAP Đà Lạt</span>
                )}
              </div>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              <div className="flex justify-between items-center px-4 py-2.5 text-slate-700">
                <span className="flex items-center gap-2">
                  <Wifi size={13} className="text-sky-600" />
                  <div>
                    <span className="font-medium text-slate-900">{gwItem.name}</span>
                    <span className="text-slate-500 text-[11px]"> ({gwItem.model || 'GATEWAY'}) × {calculation.gateways} trạm</span>
                  </div>
                </span>
                <div className="text-right">
                  <div className="font-mono font-bold text-slate-900">{formatVND(calculation.gatewayCost)}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{formatVND(Number(gwItem.unitPrice) || 0)}/bộ</div>
                </div>
              </div>

              <div className="flex justify-between items-center px-4 py-2.5 text-slate-700">
                <span className="flex items-center gap-2">
                  <Radio size={13} className="text-emerald-600" />
                  <div>
                    <span className="font-medium text-slate-900">{sensorItem.name}</span>
                    <span className="text-slate-500 text-[11px]"> ({sensorItem.model || 'SENSOR_NODE'}) × {calculation.sensors} node</span>
                  </div>
                </span>
                <div className="text-right">
                  <div className="font-mono font-bold text-slate-900">{formatVND(calculation.sensorCost)}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{formatVND(Number(sensorItem.unitPrice) || 0)}/node</div>
                </div>
              </div>

              <div className="flex justify-between items-center px-4 py-2.5 text-slate-700">
                <span className="flex items-center gap-2">
                  <Zap size={13} className="text-amber-600" />
                  <div>
                    <span className="font-medium text-slate-900">{actuatorItem.name}</span>
                    <span className="text-slate-500 text-[11px]"> ({actuatorItem.model || 'ACTUATOR'}) × {calculation.actuators} cụm</span>
                  </div>
                </span>
                <div className="text-right">
                  <div className="font-mono font-bold text-slate-900">{formatVND(calculation.actuatorCost)}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{formatVND(Number(actuatorItem.unitPrice) || 0)}/cụm</div>
                </div>
              </div>

              <div className="flex justify-between items-center px-4 py-2.5 text-slate-700">
                <span className="flex items-center gap-2">
                  <Package size={13} className="text-slate-500" />
                  <div>
                    <span className="font-medium text-slate-900">{accessoriesItem.name}</span>
                    <span className="text-slate-500 text-[11px]"> × {calculation.sensors + calculation.actuators} vị trí</span>
                  </div>
                </span>
                <div className="text-right">
                  <div className="font-mono font-bold text-slate-900">{formatVND(calculation.accessoriesCost)}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{formatVND(Number(accessoriesItem.unitPrice) || 0)}/vị trí</div>
                </div>
              </div>

              <div className="flex justify-between items-center px-4 py-2.5 text-slate-700">
                <span className="flex items-center gap-2">
                  <Wrench size={13} className="text-slate-500" />
                  <span>Chi phí thi công, định vị GPS tọa độ Node & cấu hình mạng mesh tổ ong (flat)</span>
                </span>
                <div className="text-right">
                  <span className="font-mono font-bold text-slate-900">{formatVND(calculation.installationCost)}</span>
                </div>
              </div>

              {/* Total Calculation Row */}
              <div className="flex justify-between items-center px-4 py-3.5 bg-emerald-50/80 border-t-2 border-emerald-300 font-bold text-slate-900">
                <div className="space-y-0.5">
                  <span className="flex items-center gap-1.5 text-emerald-950 text-sm">
                    <TrendingUp size={16} className="text-emerald-700" /> TỔNG CHI PHÍ ƯỚC TÍNH
                  </span>
                  <div className="text-[11px] text-slate-500 font-normal">
                    Biên độ dao động thị trường (±15%): {formatVND(calculation.minCostVnd)} – {formatVND(calculation.maxCostVnd)}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-lg font-black text-emerald-800 font-mono">
                    {formatVND(calculation.totalCostVnd)}
                  </div>
                  <div className="text-[10px] text-emerald-700 font-semibold">
                    Đã bao gồm vật tư & công lắp đặt
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 text-amber-800 text-[11px]">
              <AlertTriangle size={14} className="text-amber-600 shrink-0" />
              <span>Dự toán mang tính tham khảo chuẩn kỹ thuật. Đơn giá chính thức do Kỹ thuật viên xác nhận sau khảo sát.</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onApplyEstimate && (
                <Button
                  size="sm"
                  onClick={() => onApplyEstimate(calculation)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  <CheckCircle2 size={14} className="mr-1" /> Áp Dụng Dự Toán Này
                </Button>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Formula & Scientific Proof Modal */}
      {showFormulaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-xs text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Cpu size={18} className="text-emerald-600" />
                Cơ Sở Toán Học: Thuật Toán Mạng Lục Giác Tổ Ong (Hexagonal WSN)
              </h3>
              <button
                onClick={() => setShowFormulaModal(false)}
                className="text-slate-400 hover:text-slate-600 text-base font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 leading-relaxed">
              <p>
                Trong lý thuyết Mạng Cảm Biến Không Dây (<strong>Wireless Sensor Networks - WSN</strong>), hình lục giác đều là đa giác đều có thể lát kín 100% mặt phẳng mà không tạo khe hở (gap-free) đồng thời tiệm cận tối ưu nhất với hình tròn phủ sóng của anten vô tuyến.
              </p>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 font-mono text-[11px]">
                <div className="text-emerald-800 font-bold font-sans text-xs">Các công thức hình học:</div>
                <div>• Diện tích 1 ô tổ ong: <strong>S = (3√3 / 2) × R² ≈ 2.598 × R²</strong></div>
                <div>• Khoảng cách giữa 2 Node: <strong>D = √3 × R ≈ 1.732 × R</strong></div>
                <div>• Số Sensor Nodes: <strong>N = ⌈ 1.12 × (Diện tích Zone / S) ⌉</strong></div>
                <div>• Hệ số bù biên (1.12): Đảm bảo các cạnh mép không bị thiếu hụt độ phủ.</div>
              </div>

              <p className="text-slate-600">
                <strong>Ưu điểm vượt trội so với mắt lưới vuông:</strong> Giúp tiết kiệm từ 15% đến 22% số lượng Sensor Node trên cùng một diện tích canh tác mà vẫn đảm bảo 100% diện tích không có góc chết vi khí hậu.
              </p>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button onClick={() => setShowFormulaModal(false)} className="bg-emerald-600 text-white font-bold">
                Đã hiểu
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

