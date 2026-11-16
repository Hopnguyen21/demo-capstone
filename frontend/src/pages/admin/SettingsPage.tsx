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

  // Khoá Gemini luôn về dạng che (****abcd) từ API: chỉ gửi lại khi Admin gõ khoá mới, không bao giờ ghi đè khoá đang lưu bằng chuỗi che.
  // Nhiều khoá (mỗi khoá một project để cộng dồn quota). Khoá đã lưu chỉ hiện dạng che; khoá mới gõ ở các ô bên dưới.
  const [savedKeys, setSavedKeys] = useState<string[]>([]);
  const [newKeys, setNewKeys] = useState<string[]>(['']);
  const [primaryMasked, setPrimaryMasked] = useState('');
  const [removePrimary, setRemovePrimary] = useState(false);
  const [savedKeysChanged, setSavedKeysChanged] = useState(false);
  const [geminiModel, setGeminiModel] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const applyKeySettings = (settings: any[]) => {
    setPrimaryMasked(settings.find(x => x.key === 'Gemini:ApiKey')?.value ?? '');
    setRemovePrimary(false);
    try {
      const parsed = JSON.parse(settings.find(x => x.key === 'Gemini:ApiKeys')?.value || '[]');
      setSavedKeys(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch { setSavedKeys([]); }
    setNewKeys(['']);
  };

  useEffect(() => {
    adminService.getSettings().then((settings: any[]) => {
      if (Array.isArray(settings)) {
        setBusiness(settings.filter(x => BUSINESS_PREFIXES.some(p => String(x.key).startsWith(p))));
        applyKeySettings(settings);
        const gm = settings.find(s => s.key === 'Gemini:Model');
        if (gm) setGeminiModel(gm.value);
      }
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setAiError(null);
    try {
      const typed = newKeys.map(k => k.trim()).filter(Boolean);
      const items = [{ key: 'Gemini:Model', value: geminiModel.trim() }];
      if (removePrimary) items.push({ key: 'Gemini:ApiKey', value: '' });
      // Khoá đã lưu gửi lại ở dạng che (server giữ nguyên khoá thật); khoá bị xoá thì không có trong danh sách.
      if (typed.length > 0 || savedKeysChanged) items.push({ key: 'Gemini:ApiKeys', value: JSON.stringify([...savedKeys, ...typed]) });
      const updated = await adminService.updateSettings(items);
      if (Array.isArray(updated)) applyKeySettings(updated);
      setSavedKeysChanged(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      const data = err?.response?.data;
      setAiError(String(data?.errors ? Object.values(data.errors).flat().join(' ') : (data?.detail ?? data?.title ?? 'Không lưu được cấu hình AI.')));
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
              <label className="block text-slate-700 font-medium mb-1">Gemini API Key (có thể thêm nhiều khoá để cộng dồn quota)</label>
              <ul className="space-y-1.5 mb-2">
                {primaryMasked && !removePrimary && (
                  <li className="flex items-center gap-2">
                    <code className="flex-1 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-700">{primaryMasked}</code>
                    <button type="button" className="text-red-600 hover:underline" onClick={() => setRemovePrimary(true)}>Xóa</button>
                  </li>
                )}
                {savedKeys.map((k, i) => (
                  <li key={k + i} className="flex items-center gap-2">
                    <code className="flex-1 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-700">{k}</code>
                    <button type="button" className="text-red-600 hover:underline"
                      onClick={() => { setSavedKeys(savedKeys.filter((_, j) => j !== i)); setSavedKeysChanged(true); }}>Xóa</button>
                  </li>
                ))}
              </ul>
              {newKeys.map((k, i) => (
                <div key={i} className="flex items-center gap-2 mb-1.5">
                  <Input
                    type="password"
                    value={k}
                    onChange={e => setNewKeys(newKeys.map((v, j) => (j === i ? e.target.value : v)))}
                    placeholder="Dán khoá mới (AIzaSyA8...)"
                    autoComplete="off"
                  />
                  {newKeys.length > 1 && (
                    <button type="button" className="text-slate-500 hover:underline" onClick={() => setNewKeys(newKeys.filter((_, j) => j !== i))}>Bỏ</button>
                  )}
                </div>
              ))}
              <button type="button" className="text-emerald-700 hover:underline" onClick={() => setNewKeys([...newKeys, ''])}>+ Thêm khoá</button>
              <p className="mt-1 text-[11px] text-slate-500">
                Hệ thống chỉ dùng các khoá nhập ở đây (không đọc khoá từ cấu hình máy chủ). Chưa có khoá nào thì AI không hoạt động. Khoá đã lưu được mã hoá trong cơ sở dữ liệu,
                chỉ hiện 4 ký tự cuối và có hiệu lực ngay, không cần khởi động lại. Khoá lỗi hoặc hết quota sẽ tự chuyển sang khoá kế tiếp trong danh sách. Tối đa 10 khoá.
              </p>
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Model Selection</label>
              <Input
                value={geminiModel}
                onChange={e => setGeminiModel(e.target.value)}
                placeholder="Để trống để dùng model mặc định của máy chủ"
              />
            </div>
            {aiError && <p className="text-[11px] text-red-600">{aiError}</p>}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
            <Globe size={16} className="text-sky-600" /> Dữ liệu thời tiết
          </h3>
          <p className="text-xs text-slate-600">Thời tiết lấy từ Open-Meteo, không cần khoá API nên không có gì để nhập ở đây.</p>
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
