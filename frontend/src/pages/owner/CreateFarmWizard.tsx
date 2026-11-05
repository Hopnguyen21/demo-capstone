import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sprout, CheckCircle2, ArrowRight, ArrowLeft, MapPin, Layers, Cpu } from 'lucide-react';
import { Button, Input } from '../../components/ui/BaseUI';

export const CreateFarmWizard: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    farmName: 'Trang trại Nông nghiệp Đà Lạt 2',
    address: 'Phường 12, TP. Đà Lạt',
    areaM2: '35000',
    fieldName: 'Lô Đất A1',
    zoneName: 'Nhà màng Cà chua 01',
    crop: 'Cà chua (Tomato)',
    seasonName: 'Vụ Cà chua Đông Xuân 2026',
    gatewaysNeeded: '1',
    nodesNeeded: '4',
  });

  const steps = [
    'Thông tin Cơ bản',
    'Tọa độ GPS / Map',
    'Diện tích Quy hoạch',
    'Khởi tạo Field',
    'Khởi tạo Zone',
    'Cây trồng & Giống',
    'Vụ mùa đầu tiên',
    'Gửi yêu cầu IoT',
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Sprout className="text-[#062326]" size={22} /> Hướng dẫn Khởi tạo Nông trang Mới (8-Step Multi-Step Setup Wizard)
        </h1>
        <p className="text-xs text-slate-600 mt-1">Thiết lập cấu trúc GIS Nông trang từ Trang trại ➔ Lô đất ➔ Nhà màng ➔ Cây trồng ➔ Gửi yêu cầu Kỹ thuật viên cấp phát IoT.</p>
      </div>

      {/* Stepper Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2 text-center text-[10px] font-semibold">
          {steps.map((st, idx) => (
            <div key={idx} className={`p-2 rounded-lg border transition-all ${step === idx + 1 ? 'bg-[#062326] text-white border-[#062326] shadow-xs' : step > idx + 1 ? 'bg-emerald-50 text-[#062326] border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
              <div className="font-bold mb-0.5">Bước {idx + 1}</div>
              <div className="truncate">{st}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Form Content per Step */}
      <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-xs space-y-6">
        {step === 1 && (
          <div className="space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900">Bước 1: Thông tin Tên & Địa điểm Nông trang</h3>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Tên Trang trại</label>
              <Input value={formData.farmName} onChange={e => setFormData({ ...formData, farmName: e.target.value })} />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Địa chỉ chi tiết</label>
              <Input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900">Bước 2: Tọa độ GPS & Ranh giới GIS</h3>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <span className="text-slate-700">Vĩ độ / Kinh độ Trung tâm: <strong className="text-slate-900">11.9404, 108.4583</strong></span>
              <Button size="sm" variant="outline"><MapPin size={14} className="mr-1" /> Ghim trên Bản đồ</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900">Bước 3: Diện tích Quy hoạch</h3>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Diện tích (m²)</label>
              <Input value={formData.areaM2} onChange={e => setFormData({ ...formData, areaM2: e.target.value })} />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900">Bước 4: Phân khu Lô đất (Field) đầu tiên</h3>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Tên Phân khu / Lô đất</label>
              <Input value={formData.fieldName} onChange={e => setFormData({ ...formData, fieldName: e.target.value })} />
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900">Bước 5: Tạo Khu vực Nhà màng (Zone)</h3>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Tên Nhà màng / Luống trồng</label>
              <Input value={formData.zoneName} onChange={e => setFormData({ ...formData, zoneName: e.target.value })} />
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900">Bước 6: Chọn Cây trồng & Giống</h3>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Loài cây canh tác</label>
              <select className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:border-[#062326] shadow-xs">
                <option>Cà chua (Tomato) - Beefsteak F1</option>
                <option>Ớt ngọt (Bell Pepper) - Hà Lan Red</option>
                <option>Dưa leo (Cucumber) - Baby F1</option>
              </select>
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900">Bước 7: Kích hoạt Vụ mùa (Planting Season)</h3>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Tên vụ mùa</label>
              <Input value={formData.seasonName} onChange={e => setFormData({ ...formData, seasonName: e.target.value })} />
            </div>
          </div>
        )}

        {step === 8 && (
          <div className="space-y-4 text-xs text-center p-6 bg-emerald-50 border border-emerald-200 rounded-xl">
            <CheckCircle2 size={48} className="text-[#062326] mx-auto" />
            <h3 className="text-base font-bold text-slate-900">Hoàn tất Khởi tạo Nông trang!</h3>
            <p className="text-slate-600">Yêu cầu cấp phát 1 Gateway và 4 Node cảm biến đã được gửi tới Đội ngũ Kỹ thuật viên Platform.</p>
          </div>
        )}

        {/* Wizard Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <Button variant="ghost" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>
            <ArrowLeft size={15} className="mr-1" /> Quay lại
          </Button>

          {step < 8 ? (
            <Button onClick={() => setStep(step + 1)}>
              Bước tiếp theo <ArrowRight size={15} className="ml-1" />
            </Button>
          ) : (
            <Button onClick={() => navigate('/owner/farms')}>
              Về Danh sách Trang trại <CheckCircle2 size={15} className="ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
