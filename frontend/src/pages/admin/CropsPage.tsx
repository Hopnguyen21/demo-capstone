import React, { useState } from 'react';
import { mockCrops, mockVarieties } from '../../mocks/mockData';
import { Button, Input, Modal, StatusBadge } from '../../components/ui/BaseUI';
import { Sprout, Plus, Search, Layers, BookOpen } from 'lucide-react';

export const CropsPage: React.FC = () => {
  const [crops, setCrops] = useState(mockCrops);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCrop, setNewCrop] = useState({ name: '', scientificName: '', description: '' });

  const filtered = crops.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const created = {
      cropId: `crop-${Date.now()}`,
      name: newCrop.name,
      scientificName: newCrop.scientificName,
      description: newCrop.description,
      isSystemDefined: true,
      createdAt: new Date().toISOString(),
      varietiesCount: 0,
    };
    setCrops([...crops, created]);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Sprout className="text-[#062326]" size={22} /> Thư viện Cây trồng Chuẩn (System Crop Library)
          </h1>
          <p className="text-xs text-slate-600 mt-1">Danh mục các loài cây nông nghiệp mẫu VietGAP được cấu hình sẵn trên toàn sàn.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus size={16} className="mr-1.5" /> Bổ sung Cây trồng Mới
        </Button>
      </div>

      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Tìm kiếm loài cây..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <span className="text-xs text-slate-500">Tổng số: {filtered.length} cây</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {filtered.map(c => (
          <div key={c.cropId} className="p-5 bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs hover:border-[#062326]/30 transition-all">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">{c.name}</h3>
                <p className="text-xs italic text-[#062326] font-serif font-medium">{c.scientificName}</p>
              </div>
              <StatusBadge status={c.isSystemDefined ? 'ACTIVE' : 'WARNING'} label={c.isSystemDefined ? 'System Crop' : 'Custom'} />
            </div>

            <p className="text-xs text-slate-600 line-clamp-2">{c.description}</p>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><Layers size={14} className="text-[#062326]" /> {c.varietiesCount || 2} Giống cây</span>
              <button className="text-[#062326] hover:underline font-semibold flex items-center gap-1">
                <BookOpen size={13} /> Quy trình & Giống
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Thêm Cây trồng Mới vào Thư viện">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Tên cây trồng</label>
            <Input required value={newCrop.name} onChange={e => setNewCrop({ ...newCrop, name: e.target.value })} placeholder="Ví dụ: Dâu tây Đà Lạt" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Tên khoa học (Scientific Name)</label>
            <Input value={newCrop.scientificName} onChange={e => setNewCrop({ ...newCrop, scientificName: e.target.value })} placeholder="Fragaria × ananassa" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Mô tả đặc tính nông học</label>
            <Input value={newCrop.description} onChange={e => setNewCrop({ ...newCrop, description: e.target.value })} placeholder="Cây trồng ưa khí hậu mát mẻ..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>Hủy</Button>
            <Button type="submit">Lưu Cây trồng</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
