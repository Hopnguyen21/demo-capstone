import React, { useState } from 'react';
import { CpuIcon, QrCode, Wifi, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button, Input } from '../../components/ui/BaseUI';

export const ProvisioningPage: React.FC = () => {
  const [mac, setMac] = useState('24:DC:C3:98:A1:04');
  const [deviceCode, setDeviceCode] = useState('GW-ESP32-DL03');
  const [step, setStep] = useState(1);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <CpuIcon className="text-[#062326]" size={22} /> Quy trình Cấp phát Thiết bị IoT (Provisioning Wizard)
        </h1>
        <p className="text-xs text-slate-600 mt-1">Quét mã QR tem thiết bị, nạp Whitelist MAC vào Gateway ESP32 và xác nhận kết nối MQTT.</p>
      </div>

      <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-xs space-y-6">
        {/* Stepper Header */}
        <div className="grid grid-cols-3 gap-2 pb-4 border-b border-slate-100 text-xs font-semibold">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-[#062326]' : 'text-slate-400'}`}>
            <span className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold">1</span>
            <span>Quét QR / Nhập MAC</span>
          </div>
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-[#062326]' : 'text-slate-400'}`}>
            <span className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold">2</span>
            <span>Captive Portal</span>
          </div>
          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-[#062326]' : 'text-slate-400'}`}>
            <span className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold">3</span>
            <span>Hoàn tất Nạp Whitelist</span>
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-4 text-xs">
            <div className="p-8 border-2 border-dashed border-slate-200 bg-slate-50 rounded-xl flex flex-col items-center justify-center text-center">
              <QrCode size={48} className="text-[#062326] mb-2 animate-pulse" />
              <span className="font-bold text-slate-900 text-sm">Đặt mã QR tem Gateway / Node vào tầm nhìn Camera</span>
              <p className="text-slate-500 text-[11px] mt-1">Hệ thống sẽ tự động trích xuất MAC Address & Serial Number</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Mã MAC Address ESP32</label>
                <Input value={mac} onChange={e => setMac(e.target.value)} className="font-mono" />
              </div>
              <div>
                <label className="block text-slate-700 font-medium mb-1">Mã thiết bị định danh (Device Code)</label>
                <Input value={deviceCode} onChange={e => setDeviceCode(e.target.value)} className="font-mono" />
              </div>
            </div>

            <Button onClick={() => setStep(2)} className="w-full">
              Tiếp tục Captive Portal <ArrowRight size={15} className="ml-1" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-sky-700 font-bold">
                <Wifi size={16} /> Đã kết nối WiFi Access Point: SmartFarm-ESP32-AP
              </div>
              <p className="text-slate-600 text-[11px]">Đang gửi thông số WiFi SSID, MQTT Broker Endpoint và Tenant Encryption Keys...</p>
            </div>

            <Button onClick={() => setStep(3)} className="w-full">
              Nạp Whitelist & Hoàn tất <CheckCircle2 size={15} className="ml-1" />
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-3">
            <CheckCircle2 size={40} className="text-[#062326] mx-auto" />
            <h3 className="text-base font-bold text-slate-900">Cấp phát Thiết bị Thành công!</h3>
            <p className="text-xs text-slate-600">Gateway {deviceCode} ({mac}) đã được nạp Whitelist và sẵn sàng nhận payload LoRa.</p>
            <Button onClick={() => setStep(1)} variant="outline">Cấp phát thiết bị tiếp theo</Button>
          </div>
        )}
      </div>
    </div>
  );
};
