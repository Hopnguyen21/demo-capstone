import React, { useState, useEffect } from 'react';
import { Settings, Save, Key, Globe, CheckCircle2, SlidersHorizontal, AlertCircle } from 'lucide-react';
import { Button, Input } from '../../components/ui/BaseUI';
import { adminService } from '../../services';

interface BusinessSetting { key: string; value: string; group: string; description?: string | null; }
const BUSINESS_PREFIXES = ['control.', 'contract.', 'ai.'];
const GROUP_LABELS: Record<string, string> = { Control: 'Điều khiển tưới', Contract: 'Hợp đồng & thanh toán', Ai: 'Trợ lý AI' };

export const SettingsPage: React.FC = () => {
  const [business, setBusiness] = useState<BusinessSetting[]>([]);
  const [businessEdits, setBusinessEdits] = useState<Record<string, string>>({});
  const [businessSaving, setBusinessSaving] = useState(false);
  const [businessMessage, setBusinessMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [geminiKey, setGeminiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash');
  const [weatherKey, setWeatherKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    adminService.getSettings().then((settings: any[]) => {
      if (Array.isArray(settings)) {
        setBusiness(settings.filter(x => BUSINESS_PREFIXES.some(p => String(x.key).startsWith(p))));
        const gk = settings.find(s => s.key === 'Gemini:ApiKey');
        if (gk) setGeminiKey(gk.value);
        const gm = settings.find(s => s.key === 'Gemini:Model');
        if (gm) setGeminiModel(gm.value);
        const wk = settings.find(s => s.key === 'Weather:ApiKey');
        if (wk) setWeatherKey(wk.value);
      }
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      await adminService.updateSettings([
        { key: 'Gemini:ApiKey', value: geminiKey },
        { key: 'Gemini:Model', value: geminiModel },
        { key: 'Weather:ApiKey', value: weatherKey }
      ]);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBusiness = async () => {
    const changed = Object.entries(businessEdits)
      .filter(([k, v]) => business.find(b => b.key === k)?.value !== v)
      .map(([key, value]) => ({ key, value }));
    if (changed.length === 0) { setBusinessMessage({ ok: true, text: 'Không có thay đổi để lưu.' }); return; }
    setBusinessSaving(true);
    setBusinessMessage(null);
    try {
      const updated = await adminService.updateSettings(changed);
      if (Array.isArray(updated)) setBusiness(updated.filter((x: any) => BUSINESS_PREFIXES.some(p => String(x.key).startsWith(p))));
      setBusinessEdits({});
      setBusinessMessage({ ok: true, text: 'Đã lưu. Giá trị mới có hiệu lực ngay ở lần sử dụng kế tiếp, không cần khởi động lại.' });
    } catch (err: any) {
      const data = err?.response?.data;
      const detail = data?.errors ? Object.values(data.errors).flat().join(' ') : (data?.detail ?? data?.title ?? 'Không lưu được cấu hình.');
      setBusinessMessage({ ok: false, text: String(detail) });
    } finally {
      setBusinessSaving(false);
    }
  };

  const groupedBusiness = business.reduce<Record<string, BusinessSetting[]>>((acc, b) => {
    (acc[b.group] ||= []).push(b);
    return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="text-[#119653]" size={22} /> Cấu hình Nền tảng SaaS (Platform Settings)
        </h1>
        <p className="text-xs text-slate-600 mt-1">Thiết lập các tham số kết nối API bên thứ ba, cấu hình AI Gemini và Weather API.</p>
      </div>

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 size={16} /> Lưu cấu hình nền tảng thành công!
        </div>
      )}


      {business.length > 0 && (
        <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-xs space-y-5" data-testid="business-settings">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <SlidersHorizontal size={16} className="text-emerald-700" /> Tham số nghiệp vụ
            </h3>
            <p className="text-xs text-slate-600 mt-2">Các giá trị này được đọc từ cơ sở dữ liệu mỗi lần dùng; sửa xong có hiệu lực ngay. Mọi thay đổi được ghi vào nhật ký Audit.</p>
          </div>
          {Object.entries(groupedBusiness).map(([group, items]) => (
            <div key={group} className="space-y-3">
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{GROUP_LABELS[group] ?? group}</div>
              {items.map(item => (
                <div key={item.key} className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-2 items-start text-xs">
                  <div>
                    <div className="font-mono text-[11px] text-slate-500">{item.key}</div>
                    <div className="text-slate-700">{item.description}</div>
                  </div>
                  <Input
                    type="number"
                    step="any"
                    value={businessEdits[item.key] ?? item.value}
                    onChange={e => setBusinessEdits(prev => ({ ...prev, [item.key]: e.target.value }))}
                    aria-label={item.key}
                  />
                </div>
              ))}
            </div>
          ))}
          {businessMessage && (
            <div className={`p-3 border rounded-xl text-xs flex items-center gap-2 ${businessMessage.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
              {businessMessage.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {businessMessage.text}
            </div>
          )}
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <Button onClick={handleSaveBusiness} disabled={businessSaving}>
              <Save size={15} className="mr-1.5" /> {businessSaving ? 'Đang lưu...' : 'Lưu tham số nghiệp vụ'}
            </Button>
          </div>
        </div>
      )}

      <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-xs space-y-6">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
            <Key size={16} className="text-amber-600" /> Google Gemini AI API Configuration
          </h3>
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Gemini API Key</label>
              <Input
                type="password"
                value={geminiKey}
                onChange={e => setGeminiKey(e.target.value)}
                placeholder="AIzaSyA8..."
              />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Model Selection</label>
              <Input
                value={geminiModel}
                onChange={e => setGeminiModel(e.target.value)}
                placeholder="gemini-2.5-flash"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
            <Globe size={16} className="text-sky-600" /> Weather API Credentials
          </h3>
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Weather API Key</label>
              <Input
                type="password"
                value={weatherKey}
                onChange={e => setWeatherKey(e.target.value)}
                placeholder="Nhập khóa API thời tiết..."
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <Button onClick={handleSave} disabled={loading}>
            <Save size={15} className="mr-1.5" /> {loading ? 'Đang lưu...' : 'Lưu Cấu hình'}
          </Button>
        </div>
      </div>
    </div>
  );
};
