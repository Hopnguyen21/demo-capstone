import React, { useState, useEffect } from 'react';
import { Settings, Save, Key, Globe, CheckCircle2, SlidersHorizontal, AlertCircle, CreditCard, Copy, Check, ExternalLink, ShieldCheck, RefreshCw, Cloud, Image as ImageIcon, UploadCloud } from 'lucide-react';
import { Button, Input } from '../../components/ui/BaseUI';
import { adminService, paymentService, cloudinaryService } from '../../services';

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

  // PayOS Payment Gateway state
  const [payOSClientId, setPayOSClientId] = useState('');
  const [payOSApiKey, setPayOSApiKey] = useState('');
  const [payOSChecksumKey, setPayOSChecksumKey] = useState('');
  const [payOSApiKeyMasked, setPayOSApiKeyMasked] = useState('');
  const [payOSChecksumKeyMasked, setPayOSChecksumKeyMasked] = useState('');
  const [isEditingPayOSApiKey, setIsEditingPayOSApiKey] = useState(false);
  const [isEditingPayOSChecksumKey, setIsEditingPayOSChecksumKey] = useState(false);
  const [payOSIsConfigured, setPayOSIsConfigured] = useState(false);
  const [payOSSaving, setPayOSSaving] = useState(false);
  const [payOSMessage, setPayOSMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [payOSTesting, setPayOSTesting] = useState(false);
  const [payOSTestResult, setPayOSTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [payOSWebhookRegistering, setPayOSWebhookRegistering] = useState(false);
  const [payOSWebhookResult, setPayOSWebhookResult] = useState<{ ok: boolean; text: string } | null>(null);

  // Cloudinary Media Storage state
  const [cloudinaryCloudName, setCloudinaryCloudName] = useState('');
  const [cloudinaryApiKey, setCloudinaryApiKey] = useState('');
  const [cloudinaryApiSecret, setCloudinaryApiSecret] = useState('');
  const [cloudinaryApiSecretMasked, setCloudinaryApiSecretMasked] = useState('');
  const [isEditingCloudinarySecret, setIsEditingCloudinarySecret] = useState(false);
  const [cloudinaryIsConfigured, setCloudinaryIsConfigured] = useState(false);
  const [cloudinarySaving, setCloudinarySaving] = useState(false);
  const [cloudinaryMessage, setCloudinaryMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [cloudinaryTesting, setCloudinaryTesting] = useState(false);
  const [cloudinaryTestResult, setCloudinaryTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [testUploadLoading, setTestUploadLoading] = useState(false);
  const [testUploadUrl, setTestUploadUrl] = useState<string | null>(null);

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

    paymentService.getPayOSConfig().then((cfg: any) => {
      if (cfg) {
        setPayOSClientId(cfg.clientId || '');
        setPayOSApiKeyMasked(cfg.apiKeyMasked || '');
        setPayOSChecksumKeyMasked(cfg.checksumKeyMasked || '');
        setPayOSIsConfigured(Boolean(cfg.isConfigured));
      }
    }).catch(() => {});

    cloudinaryService.getConfig().then((cfg: any) => {
      if (cfg) {
        setCloudinaryCloudName(cfg.cloudName || '');
        setCloudinaryApiKey(cfg.apiKey || '');
        setCloudinaryApiSecretMasked(cfg.apiSecretMasked || '');
        setCloudinaryIsConfigured(Boolean(cfg.isConfigured));
      }
    }).catch(() => {});
  }, []);

  const handleSaveCloudinary = async () => {
    setCloudinarySaving(true);
    setCloudinaryMessage(null);
    setCloudinaryTestResult(null);
    try {
      const res = await cloudinaryService.updateConfig({
        cloudName: cloudinaryCloudName.trim(),
        apiKey: cloudinaryApiKey.trim(),
        apiSecret: cloudinaryApiSecret.trim() || undefined
      });
      setCloudinaryCloudName(res.cloudName || '');
      setCloudinaryApiKey(res.apiKey || '');
      setCloudinaryApiSecretMasked(res.apiSecretMasked || '');
      setCloudinaryIsConfigured(Boolean(res.isConfigured));
      setCloudinaryApiSecret('');
      setIsEditingCloudinarySecret(false);
      setCloudinaryMessage({ ok: true, text: 'Đã lưu cấu hình Cloudinary thành công!' });
      setTimeout(() => setCloudinaryMessage(null), 4000);
    } catch (err: any) {
      const data = err?.response?.data;
      const detail = data?.errors ? Object.values(data.errors).flat().join(' ') : (data?.detail ?? data?.title ?? 'Không lưu được cấu hình Cloudinary.');
      setCloudinaryMessage({ ok: false, text: String(detail) });
    } finally {
      setCloudinarySaving(false);
    }
  };

  const handleTestCloudinary = async () => {
    setCloudinaryTesting(true);
    setCloudinaryTestResult(null);
    try {
      const res = await cloudinaryService.testConnection();
      setCloudinaryTestResult({ ok: res.success, text: res.message });
    } catch (err: any) {
      const data = err?.response?.data;
      const detail = data?.detail ?? data?.title ?? err.message ?? 'Lỗi kiểm tra kết nối Cloudinary.';
      setCloudinaryTestResult({ ok: false, text: String(detail) });
    } finally {
      setCloudinaryTesting(false);
    }
  };

  const handleTestUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTestUploadLoading(true);
    setTestUploadUrl(null);
    try {
      const res = await cloudinaryService.uploadFile(file, 'smartfarm-test');
      setTestUploadUrl(res.secureUrl || res.url);
    } catch (err: any) {
      const data = err?.response?.data;
      const detail = data?.detail ?? data?.title ?? err.message ?? 'Lỗi upload ảnh lên Cloudinary.';
      alert(String(detail));
    } finally {
      setTestUploadLoading(false);
      e.target.value = '';
    }
  };

  const handleSavePayOS = async () => {
    setPayOSSaving(true);
    setPayOSMessage(null);
    setPayOSTestResult(null);
    try {
      const res = await paymentService.updatePayOSConfig({
        clientId: payOSClientId.trim(),
        apiKey: payOSApiKey.trim() || undefined,
        checksumKey: payOSChecksumKey.trim() || undefined
      });
      setPayOSClientId(res.clientId || '');
      setPayOSApiKeyMasked(res.apiKeyMasked || '');
      setPayOSChecksumKeyMasked(res.checksumKeyMasked || '');
      setPayOSIsConfigured(Boolean(res.isConfigured));
      setPayOSApiKey('');
      setPayOSChecksumKey('');
      setIsEditingPayOSApiKey(false);
      setIsEditingPayOSChecksumKey(false);
      setPayOSMessage({ ok: true, text: 'Đã lưu cấu hình cổng thanh toán PayOS thành công!' });
      setTimeout(() => setPayOSMessage(null), 4000);
    } catch (err: any) {
      const data = err?.response?.data;
      const detail = data?.errors ? Object.values(data.errors).flat().join(' ') : (data?.detail ?? data?.title ?? 'Không lưu được cấu hình PayOS.');
      setPayOSMessage({ ok: false, text: String(detail) });
    } finally {
      setPayOSSaving(false);
    }
  };

  const handleTestPayOS = async () => {
    setPayOSTesting(true);
    setPayOSTestResult(null);
    try {
      const res = await paymentService.testPayOSConnection();
      setPayOSTestResult({ ok: res.success, text: res.message });
    } catch (err: any) {
      const data = err?.response?.data;
      const detail = data?.detail ?? data?.title ?? err.message ?? 'Lỗi kiểm tra kết nối PayOS.';
      setPayOSTestResult({ ok: false, text: String(detail) });
    } finally {
      setPayOSTesting(false);
    }
  };

  const handleRegisterWebhook = async () => {
    const webhookUrl = `${window.location.origin}/api/v1/payments/payos/webhook`;
    setPayOSWebhookRegistering(true);
    setPayOSWebhookResult(null);
    try {
      const res = await paymentService.confirmPayOSWebhook(webhookUrl);
      setPayOSWebhookResult({ ok: true, text: res.message || 'Xác nhận Webhook với PayOS thành công!' });
    } catch (err: any) {
      const data = err?.response?.data;
      const detail = data?.detail ?? data?.title ?? err.message ?? 'Lỗi xác nhận Webhook URL với PayOS.';
      setPayOSWebhookResult({ ok: false, text: String(detail) });
    } finally {
      setPayOSWebhookRegistering(false);
    }
  };

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

      {/* ─── Cổng Thanh Toán Trực Tuyến PayOS (VietQR) ─── */}
      <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-xs space-y-6" data-testid="payos-settings">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CreditCard size={18} className="text-emerald-600" /> Cổng thanh toán PayOS (VietQR / Chuyển khoản tự động)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Tích hợp thanh toán trực tuyến qua PayOS (<a href="https://payos.vn/docs/" target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline inline-flex items-center gap-0.5">payos.vn/docs <ExternalLink size={11} /></a>). Không hardcode mã bảo mật; Admin nhập Client ID, API Key và Checksum Key từ tài khoản PayOS của mình.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {payOSIsConfigured ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck size={13} /> Đã cấu hình
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <AlertCircle size={13} /> Chưa cấu hình
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4 text-xs">
          {/* Client ID */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Client ID <span className="text-rose-500">*</span>
            </label>
            <Input
              value={payOSClientId}
              onChange={e => setPayOSClientId(e.target.value)}
              placeholder="VD: 0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d"
              autoComplete="off"
            />
            <p className="mt-1 text-[11px] text-slate-500">Mã định danh Client ID được cung cấp tại mục Kênh thanh toán trên trang quản trị my.payos.vn.</p>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              API Key <span className="text-rose-500">*</span>
            </label>
            {payOSApiKeyMasked && !isEditingPayOSApiKey ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center justify-between px-3 py-2 bg-emerald-50/50 border border-emerald-200 rounded-lg text-slate-700 font-mono text-[11px]">
                  <span className="flex items-center gap-2 text-slate-800 font-medium">
                    <ShieldCheck size={14} className="text-emerald-600" />
                    {payOSApiKeyMasked}
                  </span>
                  <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-100/70 px-2 py-0.5 rounded">
                    Đã lưu & Đang hoạt động
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditingPayOSApiKey(true)}
                >
                  Đổi khóa mới
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Input
                    type="password"
                    value={payOSApiKey}
                    onChange={e => setPayOSApiKey(e.target.value)}
                    placeholder={payOSApiKeyMasked ? "Dán mã API Key mới từ PayOS..." : "Dán API Key từ PayOS..."}
                    autoComplete="off"
                    autoFocus={Boolean(payOSApiKeyMasked)}
                  />
                  {payOSApiKeyMasked && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => { setPayOSApiKey(''); setIsEditingPayOSApiKey(false); }}
                    >
                      Hủy
                    </Button>
                  )}
                </div>
              </div>
            )}
            <p className="mt-1 text-[11px] text-slate-500">Khoá API Key dùng để xác thực quyền gọi API tạo liên kết thanh toán.</p>
          </div>

          {/* Checksum Key */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Checksum Key (Khóa băm chữ ký HMAC-SHA256) <span className="text-rose-500">*</span>
            </label>
            {payOSChecksumKeyMasked && !isEditingPayOSChecksumKey ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center justify-between px-3 py-2 bg-emerald-50/50 border border-emerald-200 rounded-lg text-slate-700 font-mono text-[11px]">
                  <span className="flex items-center gap-2 text-slate-800 font-medium">
                    <ShieldCheck size={14} className="text-emerald-600" />
                    {payOSChecksumKeyMasked}
                  </span>
                  <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-100/70 px-2 py-0.5 rounded">
                    Đã lưu & Đang hoạt động
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditingPayOSChecksumKey(true)}
                >
                  Đổi khóa mới
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Input
                    type="password"
                    value={payOSChecksumKey}
                    onChange={e => setPayOSChecksumKey(e.target.value)}
                    placeholder={payOSChecksumKeyMasked ? "Dán mã Checksum Key mới từ PayOS..." : "Dán Checksum Key từ PayOS..."}
                    autoComplete="off"
                    autoFocus={Boolean(payOSChecksumKeyMasked)}
                  />
                  {payOSChecksumKeyMasked && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => { setPayOSChecksumKey(''); setIsEditingPayOSChecksumKey(false); }}
                    >
                      Hủy
                    </Button>
                  )}
                </div>
              </div>
            )}
            <p className="mt-1 text-[11px] text-slate-500">Khoá bí mật dùng để tạo chữ ký đơn hàng và xác thực webhook trả về từ máy chủ PayOS.</p>
          </div>

          {/* Webhook URL Helper */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">Webhook URL của hệ thống:</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/api/v1/payments/payos/webhook`);
                  setWebhookCopied(true);
                  setTimeout(() => setWebhookCopied(false), 2000);
                }}
                className="text-emerald-700 hover:text-emerald-800 font-medium inline-flex items-center gap-1"
              >
                {webhookCopied ? <Check size={12} /> : <Copy size={12} />}
                {webhookCopied ? 'Đã sao chép' : 'Sao chép URL'}
              </button>
            </div>
            <code className="block p-2 bg-white border border-slate-200 rounded text-slate-700 font-mono text-[11px] break-all">
              {window.location.origin}/api/v1/payments/payos/webhook
            </code>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-[11px] text-slate-600">
              <span>Đăng ký URL này trên mục Webhook của my.payos.vn để nhận biến động thanh toán tự động tức thì.</span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRegisterWebhook}
                disabled={payOSWebhookRegistering || !payOSIsConfigured}
              >
                {payOSWebhookRegistering ? <RefreshCw size={12} className="animate-spin mr-1" /> : null}
                Đăng ký tự động với PayOS
              </Button>
            </div>
            {payOSWebhookResult && (
              <p className={`text-[11px] mt-1 ${payOSWebhookResult.ok ? 'text-emerald-700 font-medium' : 'text-rose-600'}`}>
                {payOSWebhookResult.text}
              </p>
            )}
          </div>

          {payOSMessage && (
            <div className={`p-3 border rounded-xl text-xs flex items-center gap-2 ${payOSMessage.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
              {payOSMessage.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {payOSMessage.text}
            </div>
          )}

          {payOSTestResult && (
            <div className={`p-3 border rounded-xl text-xs flex items-center gap-2 ${payOSTestResult.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
              {payOSTestResult.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {payOSTestResult.text}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestPayOS}
              disabled={payOSTesting || (!payOSIsConfigured && !payOSClientId)}
            >
              {payOSTesting ? <RefreshCw size={14} className="animate-spin mr-1.5" /> : null}
              {payOSTesting ? 'Đang kiểm tra kết nối...' : 'Kiểm tra kết nối PayOS'}
            </Button>
            <Button
              type="button"
              onClick={handleSavePayOS}
              disabled={payOSSaving || !payOSClientId.trim()}
            >
              <Save size={15} className="mr-1.5" /> {payOSSaving ? 'Đang lưu...' : 'Lưu cấu hình PayOS'}
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Cổng Lưu Trữ Hình Ảnh & Media Cloudinary ─── */}
      <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-xs space-y-6" data-testid="cloudinary-settings">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Cloud size={18} className="text-sky-600" /> Dịch vụ lưu trữ Media & Hình ảnh Cloudinary
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Tích hợp lưu trữ hình ảnh đám mây qua Cloudinary (<a href="https://cloudinary.com/documentation" target="_blank" rel="noopener noreferrer" className="text-sky-700 underline inline-flex items-center gap-0.5">cloudinary.com/docs <ExternalLink size={11} /></a>). Không hardcode; Admin cấu hình Cloud Name, API Key và API Secret từ tài khoản Cloudinary của mình.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {cloudinaryIsConfigured ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck size={13} /> Đã cấu hình
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <AlertCircle size={13} /> Chưa cấu hình
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4 text-xs">
          {/* Cloud Name */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Cloud Name <span className="text-rose-500">*</span>
            </label>
            <Input
              value={cloudinaryCloudName}
              onChange={e => setCloudinaryCloudName(e.target.value)}
              placeholder="VD: dxyz1234a"
              autoComplete="off"
            />
            <p className="mt-1 text-[11px] text-slate-500">Tên Cloud Name hiển thị trên Dashboard tài khoản Cloudinary của bạn.</p>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              API Key <span className="text-rose-500">*</span>
            </label>
            <Input
              value={cloudinaryApiKey}
              onChange={e => setCloudinaryApiKey(e.target.value)}
              placeholder="VD: 123456789012345"
              autoComplete="off"
            />
            <p className="mt-1 text-[11px] text-slate-500">Mã API Key được cung cấp trong mục API Keys của Cloudinary Dashboard.</p>
          </div>

          {/* API Secret */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              API Secret <span className="text-rose-500">*</span>
            </label>
            {cloudinaryApiSecretMasked && !isEditingCloudinarySecret ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center justify-between px-3 py-2 bg-emerald-50/50 border border-emerald-200 rounded-lg text-slate-700 font-mono text-[11px]">
                  <span className="flex items-center gap-2 text-slate-800 font-medium">
                    <ShieldCheck size={14} className="text-emerald-600" />
                    {cloudinaryApiSecretMasked}
                  </span>
                  <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-100/70 px-2 py-0.5 rounded">
                    Đã lưu & Đang hoạt động
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditingCloudinarySecret(true)}
                >
                  Đổi khóa mới
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Input
                    type="password"
                    value={cloudinaryApiSecret}
                    onChange={e => setCloudinaryApiSecret(e.target.value)}
                    placeholder={cloudinaryApiSecretMasked ? "Dán API Secret mới từ Cloudinary..." : "Dán API Secret từ Cloudinary..."}
                    autoComplete="off"
                    autoFocus={Boolean(cloudinaryApiSecretMasked)}
                  />
                  {cloudinaryApiSecretMasked && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => { setCloudinaryApiSecret(''); setIsEditingCloudinarySecret(false); }}
                    >
                      Hủy
                    </Button>
                  )}
                </div>
              </div>
            )}
            <p className="mt-1 text-[11px] text-slate-500">Khoá bí mật dùng để tạo chữ ký SHA-1 upload an toàn. Lưu mã hóa AES-256 trong Database.</p>
          </div>

          {/* Test Image Upload Widget */}
          {cloudinaryIsConfigured && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <span className="font-semibold text-slate-800 block">Tải ảnh thử nghiệm trực tiếp lên Cloudinary:</span>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer font-medium text-xs shadow-2xs">
                  <UploadCloud size={14} className="text-sky-600" />
                  <span>{testUploadLoading ? 'Đang tải lên...' : 'Chọn 1 ảnh để test'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleTestUpload}
                    disabled={testUploadLoading}
                    className="hidden"
                  />
                </label>
                {testUploadUrl && (
                  <div className="flex items-center gap-2">
                    <img
                      src={testUploadUrl}
                      alt="Uploaded preview"
                      className="w-8 h-8 rounded object-cover border border-slate-300 shadow-2xs"
                    />
                    <a
                      href={testUploadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-600 hover:underline font-mono text-[11px] truncate max-w-[280px] inline-flex items-center gap-1"
                    >
                      {testUploadUrl} <ExternalLink size={11} />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {cloudinaryMessage && (
            <div className={`p-3 border rounded-xl text-xs flex items-center gap-2 ${cloudinaryMessage.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
              {cloudinaryMessage.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {cloudinaryMessage.text}
            </div>
          )}

          {cloudinaryTestResult && (
            <div className={`p-3 border rounded-xl text-xs flex items-center gap-2 ${cloudinaryTestResult.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
              {cloudinaryTestResult.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {cloudinaryTestResult.text}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestCloudinary}
              disabled={cloudinaryTesting || (!cloudinaryIsConfigured && !cloudinaryCloudName)}
            >
              {cloudinaryTesting ? <RefreshCw size={14} className="animate-spin mr-1.5" /> : null}
              {cloudinaryTesting ? 'Đang kiểm tra kết nối...' : 'Kiểm tra kết nối Cloudinary'}
            </Button>
            <Button
              type="button"
              onClick={handleSaveCloudinary}
              disabled={cloudinarySaving || !cloudinaryCloudName.trim() || !cloudinaryApiKey.trim()}
            >
              <Save size={15} className="mr-1.5" /> {cloudinarySaving ? 'Đang lưu...' : 'Lưu cấu hình Cloudinary'}
            </Button>
          </div>
        </div>
      </div>

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
