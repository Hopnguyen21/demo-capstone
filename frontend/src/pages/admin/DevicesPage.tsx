import React, { useState, useEffect } from 'react';
import { StatusBadge, Button, Input, Modal } from '../../components/ui/BaseUI';
import { adminService } from '../../services';
import {
  Package, Cpu, Radio, Activity, Wifi, Battery, Plus, Search,
  Filter, CheckCircle2, ShieldCheck, Wrench, Layers, Tag, MapPin, Trash2, Edit
} from 'lucide-react';

export interface InventoryDevice {
  id: string;
  code: string;
  name: string;
  category: 'GATEWAY' | 'SENSOR_NODE' | 'SOIL_SENSOR' | 'AIR_SENSOR' | 'VALVE' | 'PUMP';
  serialNumber: string;
  macAddress: string;
  model: string;
  manufacturer: string;
  quantityInStock: number;
  locationRack: string;
  status: 'AVAILABLE' | 'DEPLOYED' | 'MAINTENANCE';
  addedAt: string;
}

export const DevicesPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Initial Inventory Devices Stock List
  const [devices, setDevices] = useState<InventoryDevice[]>([
    {
      id: 'inv-01',
      code: 'GW-ESP32-DL01',
      name: 'Trạm Central Gateway ESP32-LoRa Dual Antenna',
      category: 'GATEWAY',
      serialNumber: 'SN-GW-2026-0089',
      macAddress: '24:DC:C3:98:A1:04',
      model: 'ESP32-S3 WROOM-32U',
      manufacturer: 'DFRobot IoT',
      quantityInStock: 8,
      locationRack: 'Kệ A1 - Tầng 2 (Kho Trung tâm)',
      status: 'AVAILABLE',
      addedAt: '2026-08-10',
    },
    {
      id: 'inv-02',
      code: 'GW-ESP32-DT02',
      name: 'Gateway Trạm Phụ ESP32-LoRa Outdoor',
      category: 'GATEWAY',
      serialNumber: 'SN-GW-2026-0092',
      macAddress: '24:DC:C3:98:B5:12',
      model: 'ESP32 LoRa IP67',
      manufacturer: 'Satech IoT',
      quantityInStock: 4,
      locationRack: 'Kệ A1 - Tầng 3',
      status: 'AVAILABLE',
      addedAt: '2026-08-15',
    },
    {
      id: 'inv-03',
      code: 'SN-SOIL-01',
      name: 'Node Cảm biến Độ ẩm & Nhiệt độ Đất RS485 Probe',
      category: 'SOIL_SENSOR',
      serialNumber: 'SN-2026-SL-01',
      macAddress: '24:DC:C3:98:SL-01',
      model: 'Modbus RS485 3-in-1',
      manufacturer: 'Rika Sensor',
      quantityInStock: 15,
      locationRack: 'Kệ B2 - Tầng 1',
      status: 'AVAILABLE',
      addedAt: '2026-09-01',
    },
    {
      id: 'inv-04',
      code: 'SN-AIR-02',
      name: 'Node Cảm biến Vi khí hậu Không khí SHT30',
      category: 'AIR_SENSOR',
      serialNumber: 'SN-2026-AIR-02',
      macAddress: '24:DC:C3:98:AR-02',
      model: 'Sensirion SHT30 + CO2',
      manufacturer: 'Sensirion AG',
      quantityInStock: 12,
      locationRack: 'Kệ B2 - Tầng 2',
      status: 'AVAILABLE',
      addedAt: '2026-09-02',
    },
    {
      id: 'inv-05',
      code: 'ACT-VALVE-01',
      name: 'Node Điều khiển Van Solenoid Tưới nhỏ giọt 4 Cổng',
      category: 'VALVE',
      serialNumber: 'ACT-2026-VAL-01',
      macAddress: '24:DC:C3:98:VL-01',
      model: 'Relay Module 4-CH 24V',
      manufacturer: 'Omron Automation',
      quantityInStock: 10,
      locationRack: 'Kệ C1 - Tầng 1',
      status: 'AVAILABLE',
      addedAt: '2026-09-05',
    },
    {
      id: 'inv-06',
      code: 'ACT-PUMP-02',
      name: 'Node Điều khiển Bơm Phân Dinh dưỡng Châm tự động',
      category: 'PUMP',
      serialNumber: 'ACT-2026-PMP-02',
      macAddress: '24:DC:C3:98:PM-02',
      model: 'PWM Peristaltic Pump Driver',
      manufacturer: 'Kamoer Pump',
      quantityInStock: 6,
      locationRack: 'Kệ C1 - Tầng 2',
      status: 'AVAILABLE',
      addedAt: '2026-09-10',
    },
    {
      id: 'inv-07',
      code: 'SN-LORA-001',
      name: 'Node Cảm biến Vi khí hậu SN-TOM-01 (Đà Lạt A1)',
      category: 'SENSOR_NODE',
      serialNumber: 'SN-NODE-9901',
      macAddress: '24:DC:C3:88:11:01',
      model: 'Custom LoRa Node v2.1',
      manufacturer: 'SmartFarm Core',
      quantityInStock: 0,
      locationRack: 'Đã xuất thực địa (Trang trại Đà Lạt)',
      status: 'DEPLOYED',
      addedAt: '2026-07-20',
    },
    {
      id: 'inv-08',
      code: 'SN-LORA-002',
      name: 'Node Cảm biến Độ ẩm Đất SN-CHILI-02 (Đức Trọng)',
      category: 'SOIL_SENSOR',
      serialNumber: 'SN-NODE-9902',
      macAddress: '24:DC:C3:88:11:02',
      model: 'Custom LoRa Node v2.1',
      manufacturer: 'SmartFarm Core',
      quantityInStock: 0,
      locationRack: 'Đã xuất thực địa (Nông trang Đức Trọng)',
      status: 'DEPLOYED',
      addedAt: '2026-07-22',
    },
  ]);

  useEffect(() => {
    adminService.getHardwareItems().then((items: any[]) => {
      if (Array.isArray(items) && items.length > 0) {
        setDevices(items.map((i: any) => ({
          id: i.id,
          code: i.code,
          name: i.name,
          category: (i.category || 'GATEWAY').toUpperCase(),
          serialNumber: i.serialNumber || '',
          macAddress: i.macAddress || '',
          model: i.model || '',
          manufacturer: i.manufacturer || '',
          quantityInStock: i.quantityInStock || 0,
          locationRack: i.locationRack || '',
          status: (i.status || 'AVAILABLE').toUpperCase(),
          addedAt: i.createdAtUtc ? i.createdAtUtc.substring(0, 10) : '2026-08-10',
        })));
      }
    }).catch(() => {});
  }, []);

  // Form State for Adding New Hardware Item
  const [newItem, setNewItem] = useState({
    code: '',
    name: '',
    category: 'GATEWAY' as InventoryDevice['category'],
    serialNumber: '',
    macAddress: '',
    model: '',
    manufacturer: '',
    quantityInStock: 10,
    locationRack: 'Kệ A1 - Kho Trung tâm',
  });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.code || !newItem.name) {
      alert('⚠️ Vui lòng nhập đầy đủ Mã và Tên linh kiện!');
      return;
    }

    const created: InventoryDevice = {
      id: `inv-${Date.now()}`,
      code: newItem.code.toUpperCase(),
      name: newItem.name,
      category: newItem.category,
      serialNumber: newItem.serialNumber || `SN-${Date.now().toString().slice(-6)}`,
      macAddress: newItem.macAddress || `24:DC:C3:${Math.floor(Math.random() * 89 + 10)}:${Math.floor(Math.random() * 89 + 10)}:${Math.floor(Math.random() * 89 + 10)}`,
      model: newItem.model || 'Tiêu chuẩn Công nghiệp',
      manufacturer: newItem.manufacturer || 'Satech IoT Hardware',
      quantityInStock: Number(newItem.quantityInStock) || 1,
      locationRack: newItem.locationRack || 'Kệ A1 - Kho Trung tâm',
      status: 'AVAILABLE',
      addedAt: new Date().toISOString().split('T')[0],
    };

    try {
      await adminService.createHardwareItem({
        code: created.code,
        name: created.name,
        category: created.category,
        model: created.model,
        manufacturer: created.manufacturer,
        serialNumber: created.serialNumber,
        macAddress: created.macAddress,
        quantityInStock: created.quantityInStock,
        locationRack: created.locationRack,
        unitPrice: 0,
        status: created.status
      });
    } catch {
      // Keep optimistic update
    }

    setDevices(prev => [created, ...prev]);
    setIsAddModalOpen(false);
    setSuccessNotice(`Đã thêm mới thành công thiết bị [${created.code}] - ${created.name} vào Kho!`);
    setTimeout(() => setSuccessNotice(null), 4000);

    // Reset Form
    setNewItem({
      code: '',
      name: '',
      category: 'GATEWAY',
      serialNumber: '',
      macAddress: '',
      model: '',
      manufacturer: '',
      quantityInStock: 10,
      locationRack: 'Kệ A1 - Kho Trung tâm',
    });
  };

  // Filter Logic
  const filteredDevices = devices.filter(item => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.macAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.serialNumber.toLowerCase().includes(searchTerm.toLowerCase());

    if (selectedCategory === 'ALL') return matchesSearch;
    if (selectedCategory === 'AVAILABLE') return matchesSearch && item.status === 'AVAILABLE';
    if (selectedCategory === 'DEPLOYED') return matchesSearch && item.status === 'DEPLOYED';
    return matchesSearch && item.category === selectedCategory;
  });

  // Calculate Counters
  const totalItemsCount = devices.reduce((sum, d) => sum + (d.status === 'AVAILABLE' ? d.quantityInStock : 1), 0);
  const totalAvailableStock = devices.filter(d => d.status === 'AVAILABLE').reduce((sum, d) => sum + d.quantityInStock, 0);
  const totalGatewaysCount = devices.filter(d => d.category === 'GATEWAY').length;
  const totalDeployedCount = devices.filter(d => d.status === 'DEPLOYED').length;

  const getCategoryLabel = (category: InventoryDevice['category']) => {
    switch (category) {
      case 'GATEWAY':
        return <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">📡 Gateway ESP32</span>;
      case 'SOIL_SENSOR':
        return <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold text-[10px]">🌱 Cảm biến Đất</span>;
      case 'AIR_SENSOR':
        return <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-900 font-bold text-[10px]">☁️ Vi khí hậu</span>;
      case 'VALVE':
        return <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-bold text-[10px]">💧 Van Solenoid</span>;
      case 'PUMP':
        return <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-bold text-[10px]">⚡ Bơm Dinh dưỡng</span>;
      default:
        return <span className="px-2 py-0.5 rounded bg-[#062326]/10 text-[#062326] font-bold text-[10px]">📟 Sensor Node</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-gradient-to-r from-slate-900 via-[#062326] to-emerald-950 text-white rounded-2xl shadow-md">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-2 border border-emerald-500/30">
            <Package size={14} /> Quản trị Platform Admin & Kho Vật tư
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            Quản lý Kho Vật tư, Thiết bị & Linh kiện IoT (Hardware Inventory Stock)
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Admin nhập linh kiện mới vào kho, xem tồn kho trạm Gateway, Sensor Node, Van solenoid và cấp phát cho các dự án nông nghiệp.
          </p>
        </div>

        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold shrink-0 flex items-center gap-1.5 shadow-lg"
        >
          <Plus size={16} /> Thêm Thiết bị / Linh kiện mới vào Kho
        </Button>
      </div>

      {successNotice && (
        <div className="p-3.5 bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* KPI Inventory Counter Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-1">
          <span className="text-slate-500 block text-[11px]">Tổng Tồn kho Vật tư</span>
          <div className="text-xl font-bold text-[#062326] flex items-center gap-2">
            <Package size={20} className="text-emerald-600" />
            <span>{totalAvailableStock} sản phẩm</span>
          </div>
          <span className="text-[10px] text-emerald-700 font-semibold block">Sẵn sàng cấp phát thực địa</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-1">
          <span className="text-slate-500 block text-[11px]">Trạm Gateway ESP32</span>
          <div className="text-xl font-bold text-amber-700 flex items-center gap-2">
            <Radio size={20} className="text-amber-600" />
            <span>{totalGatewaysCount} mã trạm</span>
          </div>
          <span className="text-[10px] text-amber-800 font-semibold block">Trạm trung tâm LoRa</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-1">
          <span className="text-slate-500 block text-[11px]">Đã xuất Lắp đặt Thực địa</span>
          <div className="text-xl font-bold text-sky-700 flex items-center gap-2">
            <Activity size={20} className="text-sky-600" />
            <span>{totalDeployedCount} thiết bị</span>
          </div>
          <span className="text-[10px] text-sky-800 font-semibold block">Đang vận hành tại Trang trại</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-1">
          <span className="text-slate-500 block text-[11px]">Danh mục Mã Linh kiện</span>
          <div className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Cpu size={20} className="text-[#062326]" />
            <span>{devices.length} mã loại</span>
          </div>
          <span className="text-[10px] text-slate-500 block">Đã đăng ký trong hệ thống</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="🔍 Tìm theo Tên thiết bị, Mã (vd: GW-ESP32, SN-SOIL), MAC hoặc S/N..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#062326]"
            />
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto text-xs pb-1 sm:pb-0">
            <span className="text-slate-500 font-bold shrink-0 text-[11px]">Phân loại:</span>
            {[
              { id: 'ALL', label: 'Tất cả' },
              { id: 'AVAILABLE', label: 'Sẵn sàng trong Kho' },
              { id: 'GATEWAY', label: 'Gateway' },
              { id: 'SOIL_SENSOR', label: 'Cảm biến Đất' },
              { id: 'AIR_SENSOR', label: 'Vi khí hậu' },
              { id: 'VALVE', label: 'Van & Bơm' },
              { id: 'DEPLOYED', label: 'Đã xuất Thực địa' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-2.5 py-1 rounded-lg transition-colors shrink-0 text-xs ${
                  selectedCategory === tab.id
                    ? 'bg-[#062326] text-white font-bold'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Inventory Devices Table List */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Layers size={17} className="text-[#062326]" /> Danh sách Tồn kho Vật tư ({filteredDevices.length})
          </h3>
          <span className="text-xs text-slate-500 font-mono">Quản lý kho dành cho Admin Platform</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 uppercase font-bold text-[10px] tracking-wider">
              <tr>
                <th className="p-3.5">Mã & Tên Linh kiện</th>
                <th className="p-3.5">Phân loại</th>
                <th className="p-3.5">Địa chỉ MAC / Serial</th>
                <th className="p-3.5">Model & Nhà sản xuất</th>
                <th className="p-3.5 text-center">Tồn kho</th>
                <th className="p-3.5">Vị trí Kệ Kho</th>
                <th className="p-3.5">Trạng thái</th>
                <th className="p-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Không tìm thấy linh kiện nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredDevices.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-[#062326] font-mono text-xs">{item.code}</div>
                      <div className="font-medium text-slate-900 text-xs mt-0.5">{item.name}</div>
                    </td>
                    <td className="p-3.5">{getCategoryLabel(item.category)}</td>
                    <td className="p-3.5 font-mono text-[11px] text-slate-600">
                      <div>MAC: <strong className="text-slate-800 font-bold">{item.macAddress}</strong></div>
                      <div className="text-slate-400 text-[10px]">S/N: {item.serialNumber}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-800">{item.model}</div>
                      <div className="text-[10px] text-slate-500">{item.manufacturer}</div>
                    </td>
                    <td className="p-3.5 text-center font-mono">
                      {item.status === 'AVAILABLE' ? (
                        <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-900 font-bold text-xs">
                          {item.quantityInStock} bộ
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium text-[11px]">0 bộ (Thực địa)</span>
                      )}
                    </td>
                    <td className="p-3.5 text-slate-600 font-mono text-[11px]">
                      <span className="flex items-center gap-1">
                        <MapPin size={12} className="text-slate-400 shrink-0" /> {item.locationRack}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="p-3.5 text-right space-x-1">
                      <button
                        onClick={() => {
                          const newQty = prompt(`Cập nhật số lượng kho cho [${item.code}]:`, String(item.quantityInStock));
                          if (newQty !== null && !isNaN(Number(newQty))) {
                            setDevices(prev => prev.map(d => d.id === item.id ? { ...d, quantityInStock: Number(newQty) } : d));
                            setSuccessNotice(`Đã cập nhật số lượng tồn kho cho ${item.code} thành ${newQty} bộ.`);
                            setTimeout(() => setSuccessNotice(null), 3000);
                          }
                        }}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-emerald-100 hover:text-emerald-900 text-slate-700 text-[11px] font-bold transition-colors"
                      >
                        Sửa kho
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Modal: Add New Hardware Component into Inventory */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="➕ Thêm Thiết bị / Linh kiện Mới vào Kho Admin">
        <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 flex items-start gap-2">
            <ShieldCheck size={16} className="text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <strong>Quyền hạn Admin Platform:</strong> Linh kiện sau khi thêm sẽ hiển thị trong Kho tổng và sẵn sàng để Kỹ thuật viên chọn cấp phát khi thực hiện yêu cầu lắp đặt.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-800 mb-1">Tên Thiết bị / Linh kiện *</label>
              <Input
                value={newItem.name}
                onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                placeholder="Ví dụ: Cảm biến Nồng độ NPK & EC Đất..."
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">Mã Linh kiện (Hardware Code) *</label>
              <Input
                value={newItem.code}
                onChange={e => setNewItem({ ...newItem, code: e.target.value })}
                placeholder="Ví dụ: SN-NPK-EC-05"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-800 mb-1">Phân loại Linh kiện *</label>
              <select
                value={newItem.category}
                onChange={e => setNewItem({ ...newItem, category: e.target.value as any })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-[#062326]"
              >
                <option value="GATEWAY">📡 Gateway Central Station (ESP32)</option>
                <option value="SOIL_SENSOR">🌱 Node Cảm biến Đất (RS485 / NPK)</option>
                <option value="AIR_SENSOR">☁️ Node Vi khí hậu Không khí (SHT30)</option>
                <option value="VALVE">💧 Node Điều khiển Van Solenoid</option>
                <option value="PUMP">⚡ Node Điều khiển Bơm Dinh dưỡng</option>
                <option value="SENSOR_NODE">📟 Sensor Node Tiêu chuẩn</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">Địa chỉ MAC / Bluetooth ID</label>
              <Input
                value={newItem.macAddress}
                onChange={e => setNewItem({ ...newItem, macAddress: e.target.value })}
                placeholder="Ví dụ: 24:DC:C3:98:C1:88"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-800 mb-1">Số Serial Number (S/N)</label>
              <Input
                value={newItem.serialNumber}
                onChange={e => setNewItem({ ...newItem, serialNumber: e.target.value })}
                placeholder="Ví dụ: SN-2026-NPK-88"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">Số lượng Nhập kho (Bộ)</label>
              <Input
                type="number"
                value={newItem.quantityInStock}
                onChange={e => setNewItem({ ...newItem, quantityInStock: Number(e.target.value) })}
                min={1}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-800 mb-1">Model & Chipset</label>
              <Input
                value={newItem.model}
                onChange={e => setNewItem({ ...newItem, model: e.target.value })}
                placeholder="Ví dụ: Modbus RS485 Industrial Grade"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">Vị trí Kệ lưu kho</label>
              <Input
                value={newItem.locationRack}
                onChange={e => setNewItem({ ...newItem, locationRack: e.target.value })}
                placeholder="Ví dụ: Kệ B3 - Kho Trung tâm"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Hủy bỏ
            </Button>
            <Button type="submit" className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold shadow-md">
              <Plus size={16} className="mr-1.5" /> Nhập Thiết bị vào Kho
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
