import React, { useState, useEffect, useMemo } from 'react';
import { StatusBadge, Button, Input, Modal } from '../../components/ui/BaseUI';
import { adminService, userService } from '../../services';
import {
  Package, Cpu, Radio, Activity, Wifi, Battery, Plus, Search,
  Filter, CheckCircle2, ShieldCheck, Wrench, Layers, Tag, MapPin, Trash2, Edit, Eye
} from 'lucide-react';

export interface InventoryDevice {
  id: string;
  code: string;
  name: string;
  category: 'GATEWAY' | 'NODE_MODULE' | 'SENSOR' | 'PERIPHERAL';
  serialNumber: string;
  macAddress: string;
  model: string;
  manufacturer: string;
  quantityInStock: number;
  unitPrice: number;
  unit: string;
  locationRack: string;
  status: 'InWarehouse' | 'Allocated' | 'InTechnicianStock' | 'Deployed' | 'Maintenance' | 'Faulty' | 'Returned';
  assignedTechnicianId?: string;
  /** Vai trò Node do Admin gán (SensorNode/ActuatorNode/ValveNode/PumpNode/Gateway/InstallKit); rỗng = chưa gán. */
  estimateRole?: string;
  addedAt: string;
}

/** Vai trò Node trong kho: quyết định hàng này dùng làm Node cảm biến hay Node điều khiển khi KTV gắn Node (backend chặn dùng sai loại). */
const NODE_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Chưa gán' },
  { value: 'SensorNode', label: 'Node cảm biến' },
  { value: 'ActuatorNode', label: 'Node điều khiển (rơ-le)' },
  { value: 'ValveNode', label: 'Node điều khiển van' },
  { value: 'PumpNode', label: 'Node điều khiển bơm' },
  { value: 'Gateway', label: 'Gateway' },
  { value: 'InstallKit', label: 'Bộ phụ kiện lắp đặt' },
];
const nodeRoleLabel = (value?: string) => NODE_ROLE_OPTIONS.find(o => o.value === (value || ''))?.label || value || 'Chưa gán';

const normalizeCategory = (value: unknown): InventoryDevice['category'] => {
  const v = String(value || '').toUpperCase();
  if (v.includes('GATEWAY')) return 'GATEWAY';
  if (v.includes('NODE') || v === 'R3' || v === 'NANO') return 'NODE_MODULE';
  if (v.includes('SENSOR')) return 'SENSOR';
  return 'PERIPHERAL';
};

const normalizeStatus = (value: unknown): InventoryDevice['status'] => {
  const v = String(value || '').toUpperCase();
  if (v.includes('FAULT')) return 'Faulty';
  if (v.includes('TECHNICIAN')) return 'InTechnicianStock';
  if (v.includes('DEPLOY') || v.includes('FIELD')) return 'Deployed';
  if (v.includes('ALLOCAT') || v.includes('ISSU')) return 'Allocated';
  if (v.includes('MAINT')) return 'Maintenance';
  if (v.includes('RETURN')) return 'Returned';
  return 'InWarehouse';
};

const normalizeMac = (value: string) => value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

export const DevicesPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryDevice | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [issueItem, setIssueItem] = useState<InventoryDevice | null>(null);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isBulkIssueModalOpen, setIsBulkIssueModalOpen] = useState(false);
  const [technicianSearch, setTechnicianSearch] = useState('');
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('');
  const [bulkDeviceSearch, setBulkDeviceSearch] = useState('');
  const [bulkDeviceCategory, setBulkDeviceCategory] = useState('ALL');
  const [bulkDeviceStatus, setBulkDeviceStatus] = useState('ALL');
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [selectedDeviceQuantities, setSelectedDeviceQuantities] = useState<Record<string, number>>({});
  const [allocationRequests, setAllocationRequests] = useState<any[]>([]);
  const [selectedAllocationRequest, setSelectedAllocationRequest] = useState<any | null>(null);
  const [activeInventoryTab, setActiveInventoryTab] = useState<'INVENTORY' | 'PRICES' | 'REQUESTS'>('INVENTORY');
  const [bulkPrices, setBulkPrices] = useState<Record<string, number>>({});
  const [savingPriceCode, setSavingPriceCode] = useState<string | null>(null);
  const [issueQuantity, setIssueQuantity] = useState(1);

  // Initial Inventory Devices Stock List
  const [devices, setDevices] = useState<InventoryDevice[]>([]); /*[
    {
      id: 'inv-01',
      code: 'GW-ESP32-DL01',
      name: 'Trạm Central Gateway ESP32-LoRa Dual Antenna',
      category: 'GATEWAY',
      serialNumber: 'SN-GW-2026-0089',
      macAddress: '24:DC:C3:98:A1:04',
      model: 'ESP32-S3 WROOM-32U',
      manufacturer: 'DFRobot IoT',
      quantityInStock: 1,
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
      quantityInStock: 1,
      locationRack: 'Kệ A1 - Tầng 3',
      status: 'AVAILABLE',
      addedAt: '2026-08-15',
    },
    {
      id: 'inv-03',
      code: 'SN-SOIL-01',
      name: 'Node Cảm biến Độ ẩm & Nhiệt độ Đất RS485 Probe',
      category: 'SENSOR',
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
      category: 'SENSOR',
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
      category: 'PERIPHERAL',
      serialNumber: 'ACT-2026-VAL-01',
      macAddress: '24:DC:C3:98:VL-01',
      model: 'Relay Module 4-CH 24V',
      manufacturer: 'Omron Automation',
      quantityInStock: 1,
      locationRack: 'Kệ C1 - Tầng 1',
      status: 'AVAILABLE',
      addedAt: '2026-09-05',
    },
    {
      id: 'inv-06',
      code: 'ACT-PUMP-02',
      name: 'Node Điều khiển Bơm Phân Dinh dưỡng Châm tự động',
      category: 'PERIPHERAL',
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
      category: 'NODE_MODULE',
      serialNumber: 'SN-NODE-9901',
      macAddress: '24:DC:C3:88:11:01',
      model: 'Custom LoRa Node v2.1',
      manufacturer: 'SmartFarm Core',
      quantityInStock: 0,
      locationRack: 'Đã xuất thực địa (Trang trại Đà Lạt)',
      status: 'FIELD_INSTALLED',
      addedAt: '2026-07-20',
    },
    {
      id: 'inv-08',
      code: 'SN-LORA-002',
      name: 'Node Cảm biến Độ ẩm Đất SN-CHILI-02 (Đức Trọng)',
      category: 'SENSOR',
      serialNumber: 'SN-NODE-9902',
      macAddress: '24:DC:C3:88:11:02',
      model: 'Custom LoRa Node v2.1',
      manufacturer: 'SmartFarm Core',
      quantityInStock: 0,
      locationRack: 'Đã xuất thực địa (Nông trang Đức Trọng)',
      status: 'FIELD_INSTALLED',
      addedAt: '2026-07-22',
    },
  ]); */

  useEffect(() => {
    adminService.getHardwareItems().then((items: any[]) => {
      if (Array.isArray(items)) {
        setDevices(items.map((i: any) => ({
          id: i.id,
          code: i.code,
          name: i.name,
          category: normalizeCategory(i.category),
          serialNumber: i.serialNumber || '',
          macAddress: i.macAddress || '',
          model: i.model || '',
          manufacturer: i.manufacturer || '',
          quantityInStock: i.quantityInStock || 0,
          unitPrice: Number(i.unitPrice || 0),
          unit: i.unit || (normalizeCategory(i.category) === 'GATEWAY' || normalizeCategory(i.category) === 'NODE_MODULE' ? 'Cái' : 'Bộ'),
          locationRack: i.locationRack || '',
          status: normalizeStatus(i.status),
          assignedTechnicianId: i.assignedTechnicianId,
          estimateRole: i.estimateRole || '',
          addedAt: i.createdAtUtc ? i.createdAtUtc.substring(0, 10) : '2026-08-10',
        })));
      }
    }).catch(() => {});
  }, []);

  const loadAllocationRequests = () => adminService.getHardwareAllocationRequests().then((items: any[]) => setAllocationRequests(Array.isArray(items) ? items : [])).catch(() => setAllocationRequests([]));
  useEffect(() => { loadAllocationRequests(); }, []);

  const approveAllocationRequest = async (requestId: string) => {
    try {
      await adminService.approveHardwareAllocationRequest(requestId);
      setSuccessNotice('Đã duyệt đơn và chuyển thiết bị vào tồn kho kỹ thuật viên.');
      loadAllocationRequests();
      const refreshed = await adminService.getHardwareItems();
      if (Array.isArray(refreshed)) setDevices(refreshed.map((i: any) => ({ id: i.id, code: i.code, name: i.name, category: normalizeCategory(i.category), serialNumber: i.serialNumber || '', macAddress: i.macAddress || '', model: i.model || '', manufacturer: i.manufacturer || '', quantityInStock: i.quantityInStock || 0, unitPrice: Number(i.unitPrice || 0), unit: i.unit || 'Cái', locationRack: i.locationRack || '', status: normalizeStatus(i.status), assignedTechnicianId: i.assignedTechnicianId, estimateRole: i.estimateRole || '', addedAt: i.createdAtUtc ? i.createdAtUtc.substring(0, 10) : '' })));
    } catch (err: any) { alert(`❌ Không thể duyệt đơn: ${err?.response?.data?.detail || err?.message || 'Lỗi không xác định'}`); }
  };
  const rejectAllocationRequest = async (requestId: string) => { const reason = window.prompt('Lý do từ chối đơn cấp phát:'); if (!reason?.trim()) return; try { await adminService.rejectHardwareAllocationRequest(requestId, reason.trim()); setSuccessNotice('Đã từ chối đơn cấp phát.'); loadAllocationRequests(); } catch (err: any) { alert(`Không thể từ chối đơn: ${err?.response?.data?.detail || err?.message || 'Lỗi không xác định'}`); } };

  useEffect(() => {
    userService.getUsers().then((users: any[]) => setTechnicians((users || []).filter(u => String(u.role || u.userRole || '').toUpperCase().includes('TECHNICIAN')))).catch(() => setTechnicians([]));
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
    quantityInStock: 1,
    unitPrice: 0,
    unit: 'Cái',
    locationRack: 'Kệ A1 - Kho Trung tâm',
    estimateRole: '',
  });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.code || !newItem.name) {
      alert('⚠️ Vui lòng nhập đầy đủ Mã và Tên linh kiện!');
      return;
    }

    const normalizedCode = newItem.code.trim().toUpperCase();
    const normalizedMac = normalizeMac(newItem.macAddress);
    const requiresUniqueRecord = newItem.category === 'GATEWAY' || newItem.category === 'NODE_MODULE';

    if (newItem.category === 'GATEWAY') {
      if (!newItem.serialNumber.trim()) {
        alert('⚠️ Gateway bắt buộc phải có Serial Number.');
        return;
      }
      if (!normalizedMac) {
        alert('⚠️ Gateway bắt buộc phải có Địa chỉ MAC.');
        return;
      }
      if (normalizedMac.length !== 12 || !/^[0-9A-F]{12}$/.test(normalizedMac)) {
        alert('⚠️ Địa chỉ MAC Gateway không hợp lệ. Phải gồm 12 ký tự hex (ví dụ: 24:DC:C3:98:A1:04).');
        return;
      }
    }

    if (newItem.category === 'NODE_MODULE' && !newItem.serialNumber.trim()) {
      alert('⚠️ Node/Controller bắt buộc phải có mã định danh riêng.');
      return;
    }

    if (requiresUniqueRecord && devices.some(item => item.code.trim().toUpperCase() === normalizedCode)) {
      alert('⚠️ Mã linh kiện đã tồn tại. Gateway và Mô-đun nút phải có bản ghi riêng biệt duy nhất.');
      return;
    }

    if (newItem.category === 'GATEWAY' && devices.some(item => normalizeMac(item.macAddress) === normalizedMac)) {
      alert('⚠️ Địa chỉ MAC Gateway đã tồn tại. Vui lòng nhập MAC duy nhất.');
      return;
    }

    const isNonGatewayOrNode = newItem.category !== 'GATEWAY' && newItem.category !== 'NODE_MODULE';
    const effectiveUnit = isNonGatewayOrNode ? (newItem.unit?.trim() || 'Bộ') : 'Cái';

    const payload = {
      code: normalizedCode,
      name: newItem.name.trim(),
      category: newItem.category,
      model: newItem.model?.trim() || 'Tiêu chuẩn Công nghiệp',
      manufacturer: newItem.manufacturer?.trim() || 'Satech IoT Hardware',
      serialNumber: newItem.serialNumber.trim(),
      macAddress: newItem.category === 'NODE_MODULE' ? '' : (newItem.category === 'GATEWAY' ? normalizedMac.match(/.{1,2}/g)?.join(':') || normalizedMac : newItem.macAddress?.trim() || ''),
      quantityInStock: requiresUniqueRecord ? 1 : Number(newItem.quantityInStock) || 1,
      unitPrice: Number(newItem.unitPrice) || 0,
      unit: effectiveUnit,
      locationRack: newItem.locationRack?.trim() || 'Kệ A1 - Kho Trung tâm',
      status: 'InWarehouse',
      estimateRole: newItem.estimateRole || undefined,
    };

    try {
      const result = await adminService.createHardwareItem(payload);
      const createdItem: InventoryDevice = {
        id: result?.id || `inv-${Date.now()}`,
        code: result?.code || payload.code,
        name: result?.name || payload.name,
        category: normalizeCategory(result?.category || payload.category),
        serialNumber: result?.serialNumber || payload.serialNumber,
        macAddress: result?.macAddress || payload.macAddress,
        model: result?.model || payload.model,
        manufacturer: result?.manufacturer || payload.manufacturer,
        quantityInStock: result?.quantityInStock ?? payload.quantityInStock,
        unitPrice: Number(result?.unitPrice ?? payload.unitPrice),
        unit: result?.unit || payload.unit,
        locationRack: result?.locationRack || payload.locationRack,
        status: normalizeStatus(result?.status || payload.status),
        estimateRole: result?.estimateRole || payload.estimateRole || '',
        addedAt: new Date().toISOString().split('T')[0],
      };

      setDevices(prev => [createdItem, ...prev]);
      setIsAddModalOpen(false);
      setSuccessNotice(`Đã thêm mới thành công thiết bị [${createdItem.code}] - ${createdItem.name} vào Kho!`);
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
        quantityInStock: 1,
      unitPrice: 0,
        unit: 'Cái',
        locationRack: 'Kệ A1 - Kho Trung tâm',
        estimateRole: '',
      });
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Lỗi khi lưu thiết bị vào kho.';
      alert(`❌ Không thể thêm thiết bị vào kho: ${errMsg}`);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    if ((editingItem.category === 'GATEWAY' || editingItem.category === 'NODE_MODULE') && !editingItem.serialNumber.trim()) {
      alert(editingItem.category === 'GATEWAY'
        ? '⚠️ Gateway bắt buộc phải có Serial Number.'
        : '⚠️ Node/Controller bắt buộc phải có mã định danh riêng.');
      return;
    }
    if (editingItem.category === 'GATEWAY' && !normalizeMac(editingItem.macAddress)) {
      alert('⚠️ Gateway bắt buộc phải có Địa chỉ MAC.');
      return;
    }

    const isNonGatewayOrNode = editingItem.category !== 'GATEWAY' && editingItem.category !== 'NODE_MODULE';
    const effectiveUnit = isNonGatewayOrNode ? (editingItem.unit?.trim() || 'Bộ') : 'Cái';

    const payload = {
      name: editingItem.name.trim(),
      category: editingItem.category,
      model: editingItem.model?.trim() || '',
      manufacturer: editingItem.manufacturer?.trim() || '',
      serialNumber: editingItem.serialNumber?.trim() || '',
      macAddress: editingItem.macAddress?.trim() || '',
      quantityInStock: editingItem.category === 'GATEWAY' || editingItem.category === 'NODE_MODULE' ? 1 : Number(editingItem.quantityInStock),
      unitPrice: Number(editingItem.unitPrice) || 0,
      unit: effectiveUnit,
      locationRack: editingItem.locationRack?.trim() || '',
      status: editingItem.status,
      // rỗng = bỏ vai trò (backend: null giữ nguyên, rỗng xóa)
      estimateRole: editingItem.estimateRole || '',
    };

    try {
      if (editingItem.id && editingItem.id.length === 36 && editingItem.id.includes('-')) {
        await adminService.updateHardwareItem(editingItem.id, payload);
      }
      setDevices(prev => prev.map(d => d.id === editingItem.id ? { ...editingItem, ...payload } : d));
      setSuccessNotice(`✅ Đã cập nhật thành công thông tin kho cho [${editingItem.code}]!`);
      setIsEditModalOpen(false);
      setEditingItem(null);
      setTimeout(() => setSuccessNotice(null), 3000);
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Lỗi khi cập nhật thiết bị.';
      alert(`❌ Không thể cập nhật thiết bị: ${errMsg}`);
    }
  };

  const issueDevices = async (ids: string[]) => {
    if (!selectedTechnicianId || ids.length === 0) { alert('⚠️ Vui lòng chọn kỹ thuật viên và ít nhất một thiết bị.'); return; }
    try {
      const assigned = await Promise.all(ids.filter(id => id.length === 36).map(id => adminService.assignHardwareItem(id, selectedTechnicianId, selectedDeviceQuantities[id] || (issueItem?.id === id ? issueQuantity : 1))));
      setDevices(prev => prev.map(item => {
        const found = assigned.find(a => a.id === item.id);
        if (found) {
          return {
            ...item,
            status: normalizeStatus(found.status),
            quantityInStock: found.quantityInStock,
            assignedTechnicianId: found.assignedTechnicianId
          };
        }
        return item;
      }));
      setSuccessNotice(`Đã cấp phát ${ids.length} thiết bị cho kỹ thuật viên (trạng thái: InTechnicianStock).`);
      setIsIssueModalOpen(false); setIsBulkIssueModalOpen(false); setIssueItem(null); setSelectedDeviceIds([]); setSelectedDeviceQuantities({}); setSelectedTechnicianId(''); setIssueQuantity(1);
    } catch { alert('❌ Không thể cấp phát thiết bị. Vui lòng thử lại.'); }
  };

  const technicianName = (id?: string) => technicians.find(t => (t.id || t.userId) === id)?.fullName || technicians.find(t => (t.id || t.userId) === id)?.name || id || 'Chưa cấp phát';

  // Filter Logic
  const filteredDevices = (devices || []).filter(item => {
    if (!item) return false;
    const query = String(searchTerm || '').toLowerCase().trim();
    const matchesSearch = !query ||
      String(item.name || '').toLowerCase().includes(query) ||
      String(item.code || '').toLowerCase().includes(query) ||
      String(item.macAddress || '').toLowerCase().includes(query) ||
      String(item.serialNumber || '').toLowerCase().includes(query);

    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
    const matchesStatus = selectedStatus === 'ALL' || item.status === selectedStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Calculate Counters
  const totalItemsCount = devices.reduce((sum, d) => sum + (d.status === 'InWarehouse' ? d.quantityInStock : 1), 0);
  const totalAvailableStock = devices.filter(d => d.status === 'InWarehouse').reduce((sum, d) => sum + d.quantityInStock, 0);
  const totalGatewaysCount = devices.filter(d => d.category === 'GATEWAY').length;
  const totalDeployedCount = devices.filter(d => d.status === 'Deployed').length;

  const getCategoryLabel = (category: InventoryDevice['category']) => {
    switch (category) {
      case 'GATEWAY':
        return <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">📡 Gateway ESP32</span>;
      case 'NODE_MODULE':
        return <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 font-bold text-[10px]">🔌 Node Module (R3, Nano)</span>;
      case 'SENSOR':
        return <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-900 font-bold text-[10px]">🌱 Sensor</span>;
      case 'PERIPHERAL':
        return <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-bold text-[10px]">⚙️ Module & Peripheral Device</span>;
      default:
        return <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">📟 Sensor Node</span>;
    }
  };

  const getPriceGroup = (item: InventoryDevice) => {
    const text = `${item.code} ${item.name} ${item.model} ${item.category}`.toUpperCase();
    const groups: Array<[string, RegExp]> = [
      ['DHT', /\bDHT\d*\b|SHT\d*/], ['LORA', /LORA|SX12|RA-02/], ['SOIL', /SOIL|ĐẤT|MOISTURE|EC[_ -]?PH/],
      ['RELAY', /RELAY/], ['VALVE', /VALVE|VAN/], ['PUMP', /PUMP|BƠM/], ['GATEWAY', /GATEWAY|ESP32/],
      ['NODE', /NODE|MÔ-ĐUN NÚT/], ['CABLE', /CABLE|DÂY|WIRE/], ['RESISTOR', /RESISTOR|ĐIỆN TRỞ/]
    ];
    return groups.find(([, pattern]) => pattern.test(text))?.[0] || item.category;
  };
  const priceGroupLabel = (key: string) => ({ DHT: 'DHT / SHT – nhiệt độ, độ ẩm', LORA: 'LoRa / module truyền thông', SOIL: 'Cảm biến đất / EC / pH', RELAY: 'Relay', VALVE: 'Van tưới', PUMP: 'Bơm', GATEWAY: 'Gateway ESP32', NODE: 'Mô-đun Node', CABLE: 'Dây / cáp', RESISTOR: 'Điện trở' } as Record<string, string>)[key] || key;
  const priceGroups = useMemo(() => {
    const groups = new Map<string, InventoryDevice[]>();
    devices.forEach(item => {
      const key = getPriceGroup(item);
      groups.set(key, [...(groups.get(key) || []), item]);
    });
    return Array.from(groups.entries()).map(([key, items]) => ({ key, items, price: Number(items[0]?.unitPrice || 0) }));
  }, [devices]);

  const saveBulkPrice = async (group: { key: string; items: InventoryDevice[]; price: number }) => {
    const price = Number(bulkPrices[group.key] ?? group.price);
    if (!Number.isFinite(price) || price <= 0) { alert('Đơn giá phải lớn hơn 0 VNĐ.'); return; }
    setSavingPriceCode(group.key);
    try {
      await Promise.all(group.items.map(item => adminService.updateHardwareItem(item.id, {
        name: item.name, category: item.category, model: item.model, manufacturer: item.manufacturer,
        serialNumber: item.serialNumber, macAddress: item.macAddress, quantityInStock: item.quantityInStock,
        unitPrice: price, unit: item.unit, locationRack: item.locationRack, status: item.status
      })));
      setDevices(previous => previous.map(item => getPriceGroup(item) === group.key ? { ...item, unitPrice: price } : item));
      setBulkPrices(previous => ({ ...previous, [group.key]: price }));
      setSuccessNotice(`Đã cập nhật đơn giá cho toàn bộ nhóm ${priceGroupLabel(group.key)}.`);
    } catch (err: any) { alert(`Không thể lưu đơn giá: ${err?.response?.data?.detail || err?.message || 'Lỗi không xác định'}`); }
    finally { setSavingPriceCode(null); }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-gradient-to-r from-[#119653] via-emerald-600 to-emerald-500 text-white rounded-2xl shadow-md border border-emerald-400/40">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-800/30 text-emerald-100 text-xs font-semibold mb-2 border border-emerald-300/30 backdrop-blur-xs">
            <Package size={14} /> Quản trị Platform Admin & Kho Vật tư
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            Quản lý Kho Vật tư, Thiết bị & Linh kiện IoT (Hardware Inventory Stock)
          </h1>
          <p className="text-xs text-emerald-100 mt-1">
            Admin nhập linh kiện mới vào kho, xem tồn kho trạm Gateway, Sensor Node, Van solenoid và cấp phát cho các dự án nông nghiệp.
          </p>
        </div>

        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-white hover:bg-emerald-50 text-[#119653] font-bold shrink-0 flex items-center gap-1.5 shadow-sm"
        >
          <Plus size={16} /> Thêm Thiết bị / Linh kiện mới vào Kho
        </Button>
        <Button onClick={() => setIsBulkIssueModalOpen(true)} className="bg-amber-500 hover:bg-amber-600 text-white font-bold">
          Cấp phát thiết bị
        </Button>
      </div>

      {successNotice && (
        <div className="p-3.5 bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-slate-200">
        <button type="button" onClick={() => setActiveInventoryTab('INVENTORY')} className={`px-4 py-3 text-sm font-bold border-b-2 ${activeInventoryTab === 'INVENTORY' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500'}`}>Kho thiết bị</button>
        <button type="button" onClick={() => setActiveInventoryTab('PRICES')} className={`px-4 py-3 text-sm font-bold border-b-2 ${activeInventoryTab === 'PRICES' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500'}`}>Cấu hình giá thiết bị</button>
        <button type="button" onClick={() => setActiveInventoryTab('REQUESTS')} className={`px-4 py-3 text-sm font-bold border-b-2 ${activeInventoryTab === 'REQUESTS' ? 'border-amber-500 text-amber-700' : 'border-transparent text-slate-500'}`}>Đơn cấp phát chờ duyệt {allocationRequests.length > 0 && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs">{allocationRequests.length}</span>}</button>
      </div>

      {activeInventoryTab === 'REQUESTS' && <div className="bg-white border border-amber-200 rounded-2xl shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between"><h2 className="font-bold text-slate-900">Đơn lấy thiết bị chờ duyệt</h2><span className="text-xs text-amber-700 font-semibold">{allocationRequests.length} đơn</span></div>
        {allocationRequests.length === 0 && <p className="text-sm text-slate-500 py-4">Không có đơn cấp phát đang chờ duyệt.</p>}
        {allocationRequests.map(request => <div key={request.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
          <div className="text-xs"><div className="font-bold text-slate-900">Kỹ thuật viên: {request.technicianName || 'Chưa xác định'}</div><div className="text-slate-600">{(request.items || []).length} loại thiết bị · {new Date(request.createdAtUtc).toLocaleString('vi-VN')}</div></div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" className="border-slate-300 text-slate-700" onClick={() => setSelectedAllocationRequest(request)}><Eye size={14} /> Xem chi tiết</Button>
            {request.status === 'Pending' ? <><Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white font-bold" onClick={() => approveAllocationRequest(request.id)}>Duyệt và cấp phát</Button><Button size="sm" variant="outline" className="border-rose-300 text-rose-700" onClick={() => rejectAllocationRequest(request.id)}>Từ chối</Button></> : <span className="text-xs font-bold text-slate-600">{request.status}</span>}
          </div>
        </div>)}
      </div>}

      {activeInventoryTab === 'PRICES' && <div className="bg-white border border-emerald-200 rounded-2xl shadow-sm p-4 space-y-4">
        <div><h2 className="font-bold text-slate-900">Cấu hình giá thiết bị</h2><p className="text-sm text-slate-500 mt-1">Mỗi mã thiết bị chỉ nhập một giá. Khi lưu, giá được cập nhật cho toàn bộ bản ghi cùng mã để làm cơ sở lập hợp đồng.</p></div>
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {priceGroups.map(group => <div key={group.key} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4">
            <div><div className="font-bold text-emerald-800">{priceGroupLabel(group.key)}</div><div className="text-sm text-slate-800">{group.items.map(item => item.name).filter((name, index, all) => all.indexOf(name) === index).slice(0, 3).join(' · ')}</div><div className="text-xs text-slate-500">{group.items.length} thiết bị thuộc nhóm · áp dụng chung, không theo mã</div></div>
            <div className="flex items-end gap-2"><label className="text-xs font-semibold text-slate-600">Đơn giá nhóm (VNĐ)<Input type="number" min={1} step={1000} value={bulkPrices[group.key] ?? (group.price || '')} onChange={event => setBulkPrices(previous => ({ ...previous, [group.key]: Number(event.target.value) || 0 }))} /></label><Button type="button" className="bg-emerald-600 text-white" disabled={savingPriceCode === group.key} onClick={() => saveBulkPrice(group)}>{savingPriceCode === group.key ? 'Đang lưu...' : 'Lưu giá nhóm'}</Button></div>
          </div>)}
          {priceGroups.length === 0 && <div className="p-6 text-center text-slate-500">Chưa có thiết bị trong kho.</div>}
        </div>
      </div>}

      <Modal isOpen={Boolean(selectedAllocationRequest)} onClose={() => setSelectedAllocationRequest(null)} title="Chi tiết yêu cầu bổ sung thiết bị" size="lg">
        {selectedAllocationRequest && <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Kỹ thuật viên</div><div className="font-bold text-slate-900">{selectedAllocationRequest.technicianName || 'Chưa xác định'}</div></div>
            <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Thời gian gửi</div><div className="font-semibold text-slate-900">{new Date(selectedAllocationRequest.createdAtUtc).toLocaleString('vi-VN')}</div></div>
            <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Trạng thái</div><div className="font-bold text-amber-700">{selectedAllocationRequest.status}</div></div>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="grid grid-cols-[1fr_7rem_6rem] gap-3 bg-slate-100 px-4 py-3 text-xs font-bold text-slate-600"><span>Thiết bị</span><span className="text-right">Số lượng</span><span className="text-right">Tồn hiện tại</span></div>
            {(selectedAllocationRequest.items || []).map((item: any) => {
              const device = devices.find(d => d.id === item.hardwareItemId);
              return <div key={item.hardwareItemId} className="grid grid-cols-[1fr_7rem_6rem] gap-3 border-t border-slate-100 px-4 py-3 text-sm">
                <div><div className="font-bold text-slate-900">{device?.name || 'Thiết bị không còn trong danh mục'}</div><div className="text-xs text-slate-500">{device?.code || item.hardwareItemId}{device?.model ? ` · ${device.model}` : ''}</div></div>
                <div className="text-right font-bold text-slate-900">{item.quantity}</div>
                <div className="text-right text-slate-600">{device?.quantityInStock ?? '—'}</div>
              </div>;
            })}
          </div>
          <div className="flex justify-end"><Button variant="outline" onClick={() => setSelectedAllocationRequest(null)}>Đóng</Button></div>
        </div>}
      </Modal>

      {activeInventoryTab === 'INVENTORY' && <>

      {/* KPI Inventory Counter Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-1">
          <span className="text-slate-500 block text-[11px]">Tổng Tồn kho Vật tư</span>
          <div className="text-xl font-bold text-[#119653] flex items-center gap-2">
            <Package size={20} className="text-[#119653]" />
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
            <Cpu size={20} className="text-[#119653]" />
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
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#119653]"
            />
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto text-xs pb-1 sm:pb-0">
            <span className="text-slate-500 font-bold shrink-0 text-[11px]">Phân loại:</span>
            {[
              { id: 'ALL', label: 'Tất cả' },
              { id: 'GATEWAY', label: 'Gateway' },
              { id: 'NODE_MODULE', label: 'Mô-đun nút' },
              { id: 'SENSOR', label: 'Cảm biến' },
              { id: 'PERIPHERAL', label: 'Mô-đun & thiết bị ngoại vi' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-2.5 py-1 rounded-lg transition-colors shrink-0 text-xs ${
                  selectedCategory === tab.id
                    ? 'bg-[#119653] text-white font-bold'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} className="px-2.5 py-1 rounded-lg bg-slate-100 border-0 text-xs text-slate-700">
              <option value="ALL">Tất cả trạng thái</option>
              <option value="InWarehouse">InWarehouse (Đang ở kho)</option>
              <option value="Allocated">Allocated (Đã cấp phát)</option>
              <option value="InTechnicianStock">InTechnicianStock (KTV đang giữ)</option>
              <option value="Deployed">Deployed (Đã triển khai)</option>
              <option value="Maintenance">Maintenance (Đang bảo trì)</option>
              <option value="Faulty">Faulty (Thiết bị lỗi)</option>
              <option value="Returned">Returned (Đã trả về kho)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Inventory Devices Table List */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Layers size={17} className="text-[#119653]" /> Danh sách Tồn kho Vật tư ({filteredDevices.length})
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
                <th className="p-3.5 text-right">Đơn giá (VNĐ)</th>
                <th className="p-3.5">Vị trí Kệ Kho</th>
                <th className="p-3.5">Trạng thái</th>
                <th className="p-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    Không tìm thấy linh kiện nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredDevices.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-emerald-800 font-mono text-xs">{item.code}</div>
                      <div className="font-medium text-slate-900 text-xs mt-0.5">{item.name}</div>
                    </td>
                    <td className="p-3.5">
                      <div>{getCategoryLabel(item.category)}</div>
                      <div className={`text-[10px] mt-0.5 font-semibold ${item.estimateRole ? 'text-emerald-700' : 'text-amber-600'}`}>Vai trò: {nodeRoleLabel(item.estimateRole)}</div>
                    </td>
                    <td className="p-3.5 font-mono text-[11px] text-slate-600">
                      <div>MAC: <strong className="text-slate-800 font-bold">{item.macAddress}</strong></div>
                      <div className="text-slate-400 text-[10px]">S/N: {item.serialNumber}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-800">{item.model}</div>
                      <div className="text-[10px] text-slate-500">{item.manufacturer}</div>
                    </td>
                    <td className="p-3.5 text-center font-mono">
                      {item.status === 'InWarehouse' ? (
                        <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-900 font-bold text-xs">
                          {item.quantityInStock} {item.category !== 'GATEWAY' && item.category !== 'NODE_MODULE' ? item.unit || 'Bộ' : 'Cái'}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium text-[11px]">
                          0 {item.category !== 'GATEWAY' && item.category !== 'NODE_MODULE' ? item.unit || 'Bộ' : 'Cái'} ({item.status})
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                      {Number(item.unitPrice || 0).toLocaleString('vi-VN')} đ
                    </td>
                    <td className="p-3.5 text-slate-600 font-mono text-[11px]">
                      <span className="flex items-center gap-1">
                        <MapPin size={12} className="text-slate-400 shrink-0" /> {item.locationRack}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                        item.status === 'InWarehouse' ? 'bg-emerald-100 text-emerald-800' :
                        item.status === 'Allocated' ? 'bg-blue-100 text-blue-800' :
                        item.status === 'InTechnicianStock' ? 'bg-cyan-100 text-cyan-800' :
                        item.status === 'Deployed' ? 'bg-purple-100 text-purple-800' :
                        item.status === 'Maintenance' ? 'bg-amber-100 text-amber-800' :
                        item.status === 'Faulty' ? 'bg-red-100 text-red-800 font-extrabold' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {item.status === 'InWarehouse' ? 'InWarehouse (Đang ở kho)' :
                         item.status === 'Allocated' ? 'Allocated (Đã cấp phát)' :
                         item.status === 'InTechnicianStock' ? 'InTechnicianStock (KTV giữ)' :
                         item.status === 'Deployed' ? 'Deployed (Đã triển khai)' :
                         item.status === 'Maintenance' ? 'Maintenance (Đang bảo trì)' :
                         item.status === 'Faulty' ? 'Faulty (Thiết bị lỗi)' :
                         'Returned (Đã trả về kho)'}
                      </span>
                      {item.assignedTechnicianId && <div className="mt-1 text-[10px] text-slate-500">Người giữ: {technicianName(item.assignedTechnicianId)}</div>}
                    </td>
                    <td className="p-3.5 text-right space-x-1 sticky right-0 bg-white/95">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItem({ ...item });
                          setIsEditModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-900 text-emerald-800 border border-emerald-200 text-[11px] font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                        title="Chỉnh sửa số lượng, vị trí kệ và thông số kho"
                      >
                        <Edit size={12} className="text-emerald-700" /> Chỉnh sửa
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      </>}

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

          <div>
            <label className="block font-bold text-slate-800 mb-1">Đơn giá nhập / đơn giá hợp đồng (VNĐ) *</label>
            <Input type="number" min={0} step={1000} value={newItem.unitPrice} onChange={e => setNewItem({ ...newItem, unitPrice: Math.max(0, Number(e.target.value) || 0) })} placeholder="Ví dụ: 950000" required />
            <p className="mt-1 text-[10px] text-slate-500">Giá này được dùng làm đơn giá mặc định khi lập hợp đồng.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-800 mb-1">Phân loại Linh kiện *</label>
              <select
                value={newItem.category}
                onChange={e => setNewItem({ ...newItem, category: e.target.value as any })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-[#119653]"
              >
                <option value="GATEWAY">Cổng Gateway (ESP32)</option>
                <option value="NODE_MODULE">Mô-đun nút (R3, Nano)</option>
                <option value="SENSOR">Cảm biến độ ẩm, nhiệt độ, đất, v.v.</option>
                <option value="PERIPHERAL">Mô-đun & thiết bị ngoại vi (rơ-le, bơm, nguồn, mô-đun LoRa, v.v.)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">Vai trò Node</label>
              <select
                value={newItem.estimateRole}
                onChange={e => setNewItem({ ...newItem, estimateRole: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-[#119653]"
              >
                {NODE_ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <p className="mt-1 text-[10px] text-slate-500">Cảm biến hay điều khiển: kỹ thuật viên chỉ gắn được hàng này vào đúng loại Node. Nên gán cho mọi Node, van, bơm, rơ-le.</p>
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">Địa chỉ MAC / Mã Bluetooth</label>
              <Input
                value={newItem.macAddress}
                onChange={e => setNewItem({ ...newItem, macAddress: e.target.value })}
                placeholder="Ví dụ: 24:DC:C3:98:C1:88"
                disabled={newItem.category === 'NODE_MODULE'}
              />
              {newItem.category === 'NODE_MODULE' && <p className="mt-1 text-[10px] text-slate-500">R3/Nano không có MAC phần cứng; trường này để trống.</p>}
              {newItem.category !== 'GATEWAY' && newItem.category !== 'NODE_MODULE' && <p className="mt-1 text-[10px] text-slate-500">Linh kiện này được quản lý theo tồn kho số lượng và không yêu cầu bản ghi riêng duy nhất.</p>}
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
              {(newItem.category === 'GATEWAY' || newItem.category === 'NODE_MODULE') && <p className="mt-1 text-[10px] text-amber-700">Bắt buộc đối với Gateway và Node/Controller.</p>}
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Số lượng Nhập kho {newItem.category !== 'GATEWAY' && newItem.category !== 'NODE_MODULE' ? `(${newItem.unit || 'Bộ'})` : '(Cái)'} *
              </label>
              <Input
                type="number"
                value={newItem.category === 'GATEWAY' || newItem.category === 'NODE_MODULE' ? 1 : newItem.quantityInStock}
                onChange={e => setNewItem({ ...newItem, quantityInStock: Number(e.target.value) })}
                min={1}
                max={newItem.category === 'GATEWAY' || newItem.category === 'NODE_MODULE' ? 1 : undefined}
                readOnly={newItem.category === 'GATEWAY' || newItem.category === 'NODE_MODULE'}
                required
              />
              {newItem.category === 'GATEWAY' || newItem.category === 'NODE_MODULE'
                ? <p className="mt-1 text-[10px] text-slate-500">Số lượng cố định là 1 cho Gateway và Mô-đun nút.</p>
                : <p className="mt-1 text-[10px] text-slate-500">Số lượng tồn kho theo lô nhập.</p>}
            </div>
          </div>

          {newItem.category !== 'GATEWAY' && newItem.category !== 'NODE_MODULE' && (
            <div>
              <label className="block font-bold text-slate-800 mb-1">Đơn vị đo lường (Chỉ áp dụng cho linh kiện / cảm biến / ngoại vi) *</label>
              <Input
                value={newItem.unit}
                onChange={e => setNewItem({ ...newItem, unit: e.target.value })}
                placeholder="Ví dụ: Bộ, Cái, Mét, Cuộn, Chiếc, Cặp..."
                required
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-800 mb-1">Mẫu mã & Chip</label>
              <Input
                value={newItem.model}
                onChange={e => setNewItem({ ...newItem, model: e.target.value })}
                placeholder="Ví dụ: Modbus RS485 Industrial Grade"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">Nhà sản xuất</label>
              <Input
                value={newItem.manufacturer}
                onChange={e => setNewItem({ ...newItem, manufacturer: e.target.value })}
                placeholder="Ví dụ: Espressif, Arduino, DFRobot"
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

      {/* Admin Modal: Edit Hardware Component in Inventory */}
      <Modal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setEditingItem(null); }} title={`🛠️ Chỉnh Sửa Thông Tin Kho Vật Tư [${editingItem?.code || ''}]`}>
        {editingItem && (
          <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 flex items-start gap-2">
              <ShieldCheck size={16} className="text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Cập nhật kho lưu trữ vật tư và thiết bị nền tảng</span>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  Mã thiết bị: <strong className="font-mono text-emerald-900">{editingItem.code}</strong>. Thay đổi số lượng tồn kho, kệ lưu trữ và trạng thái.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Tên thiết bị / linh kiện *</label>
              <Input
                value={editingItem.name}
                onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Vai trò Node</label>
              <select
                value={editingItem.estimateRole || ''}
                onChange={e => setEditingItem({ ...editingItem, estimateRole: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-800"
              >
                {NODE_ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <p className="mt-1 text-[10px] text-slate-500">Quyết định hàng dùng làm Node cảm biến hay điều khiển khi kỹ thuật viên gắn Node.</p>
              {newItem.category !== 'GATEWAY' && newItem.category !== 'NODE_MODULE' && <p className="mt-1 text-[10px] text-slate-500">Số lượng tồn kho theo lô nhập.</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Số lượng tồn kho {editingItem.category !== 'GATEWAY' && editingItem.category !== 'NODE_MODULE' ? `(${editingItem.unit || 'Bộ'})` : '(Cái)'} *
                </label>
                <Input
                  type="number"
                  min="0"
                  value={editingItem.category === 'GATEWAY' || editingItem.category === 'NODE_MODULE' ? 1 : editingItem.quantityInStock}
                  onChange={e => setEditingItem({ ...editingItem, quantityInStock: Math.max(0, parseInt(e.target.value) || 0) })}
                  readOnly={editingItem.category === 'GATEWAY' || editingItem.category === 'NODE_MODULE'}
                  required
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Đơn giá (VNĐ) *</label>
                <Input type="number" min="0" step="1000" value={editingItem.unitPrice} onChange={e => setEditingItem({ ...editingItem, unitPrice: Math.max(0, Number(e.target.value) || 0) })} required />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Trạng thái thiết bị</label>
                <select
                  value={editingItem.status}
                  onChange={e => setEditingItem({ ...editingItem, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-800"
                >
                  <option value="InWarehouse">InWarehouse (Đang ở kho)</option>
                  <option value="Allocated">Allocated (Đã cấp phát)</option>
                  <option value="InTechnicianStock">InTechnicianStock (KTV đang giữ)</option>
                  <option value="Deployed">Deployed (Đã triển khai)</option>
                  <option value="Maintenance">Maintenance (Đang bảo trì)</option>
                  <option value="Faulty">Faulty (Thiết bị lỗi)</option>
                  <option value="Returned">Returned (Đã trả về kho)</option>
                </select>
              </div>
            </div>

            {editingItem.category !== 'GATEWAY' && editingItem.category !== 'NODE_MODULE' && (
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Đơn vị đo lường (Chỉ áp dụng cho linh kiện / cảm biến / ngoại vi) *</label>
                <Input
                  value={editingItem.unit || ''}
                  onChange={e => setEditingItem({ ...editingItem, unit: e.target.value })}
                  placeholder="Ví dụ: Bộ, Cái, Mét, Cuộn, Chiếc, Cặp..."
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Vị trí kệ kho (Rack Location)</label>
              <Input
                value={editingItem.locationRack}
                onChange={e => setEditingItem({ ...editingItem, locationRack: e.target.value })}
                placeholder="VD: Kệ A1 - Tầng 2 (Kho Trung tâm)"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Model phần cứng</label>
                <Input
                  value={editingItem.model}
                  onChange={e => setEditingItem({ ...editingItem, model: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nhà sản xuất</label>
                <Input
                  value={editingItem.manufacturer}
                  onChange={e => setEditingItem({ ...editingItem, manufacturer: e.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-200">
              <Button
                type="button"
                size="sm"
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={async () => {
                  if (confirm(`Bạn có chắc muốn xóa vĩnh viễn thiết bị [${editingItem.code}] khỏi kho không?`)) {
                    try {
                      if (editingItem.id && editingItem.id.length === 36 && editingItem.id.includes('-')) {
                        await adminService.deleteHardwareItem(editingItem.id);
                      }
                      setDevices(prev => prev.filter(d => d.id !== editingItem.id));
                      setSuccessNotice(`Đã xóa thành công [${editingItem.code}] khỏi cơ sở dữ liệu kho!`);
                      setIsEditModalOpen(false);
                      setEditingItem(null);
                      setTimeout(() => setSuccessNotice(null), 3000);
                    } catch (err: any) {
                      const errMsg = err?.response?.data?.message || err?.message || 'Lỗi khi xóa thiết bị khỏi database.';
                      alert(`❌ Không thể xóa thiết bị: ${errMsg}`);
                    }
                  }
                }}
              >
                Xóa khỏi kho
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => { setIssueItem(editingItem); setIsIssueModalOpen(true); }}>Cấp phát</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingItem({ ...editingItem, status: 'Maintenance' })}>Bảo trì</Button>
              <Button type="button" size="sm" variant="outline" className="text-red-700 border-red-200 hover:bg-red-50" onClick={() => setEditingItem({ ...editingItem, status: 'Faulty' })}>Báo lỗi</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => { setIsEditModalOpen(false); setEditingItem(null); }}>
                Hủy bỏ
              </Button>
              <Button type="submit" size="sm" className="bg-[#119653] hover:bg-emerald-700 text-white font-bold">
                Lưu thay đổi vào kho
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={isIssueModalOpen} onClose={() => setIsIssueModalOpen(false)} title="Cấp phát thiết bị cho kỹ thuật viên">
        <div className="space-y-4 text-xs">
          <p className="font-semibold text-slate-800">Thiết bị: {issueItem?.code} - {issueItem?.name}</p>
          <label className="block font-bold text-slate-800">Số lượng cấp phát
            <Input type="number" min={1} max={issueItem?.quantityInStock || 1} value={issueQuantity} disabled={issueItem?.category === 'GATEWAY' || issueItem?.category === 'NODE_MODULE'} onChange={e => setIssueQuantity(Math.max(1, Number(e.target.value) || 1))} />
          </label>
          <label className="block font-bold text-slate-800">Tìm kỹ thuật viên</label>
          <Input value={technicianSearch} onChange={e => setTechnicianSearch(e.target.value)} placeholder="Nhập tên hoặc email kỹ thuật viên" />
          <select value={selectedTechnicianId} onChange={e => setSelectedTechnicianId(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2.5">
            <option value="">-- Chọn kỹ thuật viên --</option>
            {technicians.filter(t => `${t.fullName || t.name || ''} ${t.email || ''}`.toLowerCase().includes(technicianSearch.toLowerCase())).map(t => <option key={t.id || t.userId} value={t.id || t.userId}>{t.fullName || t.name || t.email}</option>)}
          </select>
          <Button type="button" className="w-full bg-emerald-600 text-white" onClick={() => issueDevices(issueItem ? [issueItem.id] : [])}>Cấp phát</Button>
        </div>
      </Modal>

      <Modal isOpen={isBulkIssueModalOpen} onClose={() => setIsBulkIssueModalOpen(false)} title="Cấp phát nhiều thiết bị">
        <div className="space-y-4 text-xs">
          <div className="border border-slate-200 rounded-lg p-3 space-y-2">
            <label className="block font-bold text-slate-800">Chọn kỹ thuật viên</label>
            <Input value={technicianSearch} onChange={e => setTechnicianSearch(e.target.value)} placeholder="Tìm trong danh sách kỹ thuật viên" />
            <div className="max-h-36 overflow-y-auto border rounded-lg divide-y">
              {technicians.filter(t => `${t.fullName || t.name || ''} ${t.email || ''}`.toLowerCase().includes(technicianSearch.toLowerCase())).map(t => <button type="button" key={t.id || t.userId} onClick={() => setSelectedTechnicianId(t.id || t.userId)} className={`block w-full text-left p-2 hover:bg-emerald-50 ${selectedTechnicianId === (t.id || t.userId) ? 'bg-emerald-100 font-bold' : ''}`}>{t.fullName || t.name || t.email}</button>)}
            </div>
            <div className="text-[11px] text-emerald-700">Đã chọn: {technicianName(selectedTechnicianId)}</div>
          </div>

          <div className="border border-slate-200 rounded-lg p-3 space-y-2">
            <label className="block font-bold text-slate-800">Chọn thiết bị</label>
            <Input value={bulkDeviceSearch} onChange={e => setBulkDeviceSearch(e.target.value)} placeholder="Tìm trong danh sách theo mã hoặc tên" />
            <div className="grid grid-cols-2 gap-2">
              <select value={bulkDeviceCategory} onChange={e => setBulkDeviceCategory(e.target.value)} className="border rounded-lg p-2">
                <option value="ALL">Tất cả danh mục</option><option value="GATEWAY">Gateway</option><option value="NODE_MODULE">Mô-đun nút</option><option value="SENSOR">Cảm biến</option><option value="PERIPHERAL">Thiết bị ngoại vi</option>
              </select>
              <select value={bulkDeviceStatus} onChange={e => setBulkDeviceStatus(e.target.value)} className="border rounded-lg p-2">
                <option value="ALL">Tất cả trạng thái</option>
                <option value="InWarehouse">InWarehouse (Đang ở kho)</option>
                <option value="Allocated">Allocated (Đã cấp phát)</option>
                <option value="InTechnicianStock">InTechnicianStock (KTV đang giữ)</option>
                <option value="Deployed">Deployed (Đã triển khai)</option>
                <option value="Maintenance">Maintenance (Đang bảo trì)</option>
                <option value="Faulty">Faulty (Thiết bị lỗi)</option>
                <option value="Returned">Returned (Đã trả về kho)</option>
              </select>
            </div>
          <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
            {devices.filter(d => (bulkDeviceCategory === 'ALL' || d.category === bulkDeviceCategory) && (bulkDeviceStatus === 'ALL' || d.status === bulkDeviceStatus) && `${d.code} ${d.name}`.toLowerCase().includes(bulkDeviceSearch.toLowerCase())).map(device => <label key={device.id} className="flex items-center gap-2 p-2 hover:bg-slate-50"><input type="checkbox" checked={selectedDeviceIds.includes(device.id)} onChange={e => setSelectedDeviceIds(prev => e.target.checked ? [...prev, device.id] : prev.filter(id => id !== device.id))} /><span className="flex-1"><strong>{device.code}</strong> - {device.name}</span>{device.category !== 'GATEWAY' && device.category !== 'NODE_MODULE' && selectedDeviceIds.includes(device.id) && <Input type="number" min={1} max={device.quantityInStock} value={selectedDeviceQuantities[device.id] || 1} onChange={e => setSelectedDeviceQuantities(prev => ({ ...prev, [device.id]: Math.min(device.quantityInStock, Math.max(1, Number(e.target.value) || 1)) }))} className="w-16" />}</label>)}
          </div>
          </div>
          <Button type="button" className="w-full bg-emerald-600 text-white" onClick={() => issueDevices(selectedDeviceIds)}>Cấp phát thiết bị đã chọn</Button>
        </div>
      </Modal>
    </div>
  );
};
