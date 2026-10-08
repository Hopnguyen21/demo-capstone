import React, { useState, useEffect } from 'react';
import { Settings, Save, Key, Globe, CheckCircle2 } from 'lucide-react';
import { Button, Input } from '../../components/ui/BaseUI';
import { adminService } from '../../services';

export const SettingsPage: React.FC = () => {
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash');
  const [weatherKey, setWeatherKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    adminService.getSettings().then((settings: any[]) => {
      if (Array.isArray(settings)) {
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

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="text-[#062326]" size={22} /> Cấu hình Nền tảng SaaS (Platform Settings)
        </h1>
        <p className="text-xs text-slate-600 mt-1">Thiết lập các tham số kết nối API bên thứ ba, cấu hình AI Gemini và Weather API.</p>
      </div>

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 size={16} /> Lưu cấu hình nền tảng thành công!
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
