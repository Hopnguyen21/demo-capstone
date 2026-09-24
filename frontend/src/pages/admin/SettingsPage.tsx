import React from 'react';
import { Settings, Save, Key, Mail, Globe, Server } from 'lucide-react';
import { Button, Input } from '../../components/ui/BaseUI';

export const SettingsPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="text-[#062326]" size={22} /> Cấu hình Nền tảng SaaS (Platform Settings)
        </h1>
        <p className="text-xs text-slate-600 mt-1">Thiết lập các tham số kết nối API bên thứ ba, cấu hình AI Gemini 1.5 và Mail SMTP.</p>
      </div>

      <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-xs space-y-6">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
            <Key size={16} className="text-amber-600" /> Google Gemini AI API Configuration
          </h3>
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Gemini API Key</label>
              <Input type="password" value="AIzaSyA8x9K...xxxxxx" readOnly />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Model Selection</label>
              <Input value="gemini-1.5-flash (Standard RAG)" readOnly />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
            <Globe size={16} className="text-sky-600" /> Weather API Credentials
          </h3>
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-medium mb-1">OpenWeatherMap API Key</label>
              <Input type="password" value="owm_live_key_99812739182" readOnly />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <Button><Save size={15} className="mr-1.5" /> Lưu Cấu hình</Button>
        </div>
      </div>
    </div>
  );
};
