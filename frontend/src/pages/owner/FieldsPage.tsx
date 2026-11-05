import React from 'react';
import { mockFields } from '../../mocks/mockData';
import { MapPin, Plus } from 'lucide-react';
import { Button, StatusBadge } from '../../components/ui/BaseUI';

export const FieldsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="text-[#062326]" size={22} /> Phân khu Đất canh tác (Fields)
          </h1>
          <p className="text-xs text-slate-600 mt-1">Các phân khu lô đất lớn trong trang trại chứa các nhà màng / khu vực tưới nhỏ hơn.</p>
        </div>
        <Button><Plus size={16} className="mr-1.5" /> Tạo Field Mới</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mockFields.map(field => (
          <div key={field.fieldId} className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">{field.name}</h3>
              <StatusBadge status={field.status} />
            </div>
            <p className="text-xs text-slate-600">{field.description}</p>
            <div className="text-xs text-slate-500">Diện tích: <strong className="text-[#062326]">{(field.areaM2/10000).toFixed(1)} ha</strong></div>
          </div>
        ))}
      </div>
    </div>
  );
};
