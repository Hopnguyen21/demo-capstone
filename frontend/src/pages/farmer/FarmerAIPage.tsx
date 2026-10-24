import React, { useState, useEffect } from 'react';
import { Bot, Send, Loader2 } from 'lucide-react';
import { Button, Input } from '../../components/ui/BaseUI';
import { aiService } from '../../services';
import { useAuth } from '../../app/providers/AuthContext';

const cleanTechnicalIds = (text?: string): string => {
  if (!text) return '';
  return text
    .replace(/\s*\((?:Mã\s*(?:ID|thiết bị)?|ID|ActuatorId)?:?\s*[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\)/gi, '')
    .replace(/(?:mã\s*(?:ID|thiết bị)?|ID\s*thiết\s*bị|thiết\s*bị\s*mã)?:?\s*[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/gi, '')
    .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, '')
    .replace(/\b(\d+)\.0{2,4}(?=[°%a-zA-Z\s,;.\)]|$)/g, '$1')
    .replace(/\b(\d+\.\d*?[1-9])0{2,4}(?=[°%a-zA-Z\s,;.\)]|$)/g, '$1')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

export const FarmerAIPage: React.FC = () => {
  const { zones, selectedZoneId, setSelectedZoneId } = useAuth();
  const zoneId = selectedZoneId || zones[0]?.zoneId || '';
  const currentZone = zones.find(z => z.zoneId === zoneId);
  const zoneName = currentZone?.name || zones[0]?.name || 'Nhà màng';
  const [aiContext, setAiContext] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([
    { id: '1', sender: 'AI', text: 'Chào bạn! Bạn cần tư vấn về vi khí hậu hay sâu bệnh tại Nhà màng được phân công?' }
  ]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!zoneId) {
      setAiContext(null);
      return () => { active = false; };
    }
    setMessages([
      { id: '1', sender: 'AI', text: 'Chào bạn! Bạn cần tư vấn về vi khí hậu hay sâu bệnh tại Nhà màng được phân công?' }
    ]);
    setAiContext(null);
    // Load AI context (zone/crop info)
    aiService.getContext(zoneId)
      .then(ctx => { if (active) setAiContext(ctx); })
      .catch(() => { if (active) setAiContext(null); });
    // Restore chat history
    aiService.getMessages(zoneId)
      .then(hist => {
        if (!active) return;
        if (!Array.isArray(hist) || hist.length === 0) return;
        const sorted = [...hist].sort((a: any, b: any) =>
          new Date(a.createdAtUtc || 0).getTime() - new Date(b.createdAtUtc || 0).getTime()
        );
        const restored: any[] = [];
        sorted.forEach((h: any, idx: number) => {
          if (h.question) {
            restored.push({ id: `hq-${idx}`, sender: 'USER', text: h.question });
          }
          restored.push({
            id: `ha-${idx}`,
            sender: 'AI',
            text: cleanTechnicalIds(h.details || h.summary || 'Trợ lý AI đã ghi nhận câu hỏi.')
          });
        });
        if (restored.length > 0) {
          setMessages([
            { id: '1', sender: 'AI', text: 'Chào bạn! Bạn cần tư vấn về vi khí hậu hay sâu bệnh tại Nhà màng được phân công?' },
            ...restored
          ]);
        }
      })
      .catch(() => {});

    // Auto-refresh telemetry & context every 10 seconds
    const interval = setInterval(() => {
      if (zoneId) {
        aiService.getContext(zoneId)
          .then(ctx => { if (active) setAiContext(ctx); })
          .catch(() => {});
      }
    }, 10000);

    return () => { 
      active = false; 
      clearInterval(interval);
    };
  }, [zoneId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text || loading) return;
    if (!zoneId) {
      setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'AI', text: 'Tài khoản chưa có Zone được phân quyền để tư vấn AI.' }]);
      return;
    }
    const userMsg = text;
    setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'USER', text: userMsg }]);
    setText('');
    setLoading(true);

    try {
      const res = await aiService.ask(zoneId, userMsg);
      // Correct field mapping: AiRecommendationView uses details/summary
      const reply = cleanTechnicalIds((res as any)?.details || (res as any)?.summary || 'AI chưa trả về kết quả phân tích. Vui lòng tải lại dữ liệu hoặc thử lại sau.');
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'AI', text: reply }]);
    } catch {
      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), sender: 'AI', text: 'Không thể kết nối tới Trợ lý AI lúc này. Vui lòng thử lại.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Bot className="text-[#119653]" size={22} /> Trợ lý Nông nghiệp Thực địa
        </h1>
        <p className="text-xs text-slate-500 mt-1">Hỏi nhanh AI về bối cảnh Nhà màng được phân quyền.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl h-[480px] flex flex-col shadow-sm">
        {/* Context header */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs text-slate-600 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>
              <strong className="text-slate-900">{zoneName}</strong>
              {aiContext?.cropName && (
                <span className="ml-1 text-slate-500">• {aiContext.cropName}{aiContext.growthStageName ? ` (${aiContext.growthStageName})` : ''}</span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {zones.length > 1 && (
              <select
                value={zoneId}
                onChange={(e) => setSelectedZoneId(e.target.value)}
                className="text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 rounded px-1.5 py-0.5"
              >
                {zones.map((z) => (
                  <option key={z.zoneId} value={z.zoneId}>
                    {z.name || `Zone ${z.zoneId.slice(0, 6)}`}
                  </option>
                ))}
              </select>
            )}
            {aiContext && (
              <span className="font-mono text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">
                {aiContext.telemetry?.length ?? 0} cảm biến
              </span>
            )}
          </div>
        </div>

        {/* Micro Sensor Bar matching Owner AI Page */}
        {aiContext?.telemetry && aiContext.telemetry.length > 0 && (
          <div className="px-3 py-1.5 bg-slate-100/70 border-b border-slate-200/80 flex items-center gap-2 overflow-x-auto text-[11px] scrollbar-thin">
            {aiContext.telemetry
              .filter((t: any) => !['ph', 'soilph', 'ec', 'soilec'].includes((t.parameterCode || '').toLowerCase()))
              .sort((a: any, b: any) => {
                const order = ['temperature', 'soilmoisture', 'airhumidity', 'light', 'lightintensity'];
                const idxA = order.indexOf((a.parameterCode || '').toLowerCase());
                const idxB = order.indexOf((b.parameterCode || '').toLowerCase());
                return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
              })
              .map((t: any) => {
                const req = aiContext.requirements?.find((r: any) => r.parameterCode === t.parameterCode);
                const formattedValue = !isNaN(Number(t.value)) ? Number(t.value) : t.value;
                const minVal = req?.minValue !== undefined && !isNaN(Number(req.minValue)) ? Number(req.minValue) : req?.minValue;
                const maxVal = req?.maxValue !== undefined && !isNaN(Number(req.maxValue)) ? Number(req.maxValue) : req?.maxValue;

                return (
                  <div key={t.parameterCode} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 shadow-2xs whitespace-nowrap">
                    <span className="text-slate-400 font-medium">
                      {t.parameterCode === 'Temperature' ? '🌡️ Nhiệt độ' :
                       t.parameterCode === 'SoilMoisture' ? '🌱 Ẩm đất' :
                       t.parameterCode === 'AirHumidity' ? '💧 Ẩm KK' :
                       (t.parameterCode === 'Light' || t.parameterCode === 'LightIntensity') ? '☀️ Ánh sáng' : t.parameterCode}:
                    </span>
                    <strong className="text-slate-800 font-mono">{formattedValue} {t.unit}</strong>
                    {req && minVal !== undefined && maxVal !== undefined && (
                      <span className="text-[10px] text-emerald-700 font-sans ml-0.5 font-medium">
                        (chuẩn: {minVal}-{maxVal})
                      </span>
                    )}
                  </div>
                );
              })}
            {aiContext.weather?.temperatureCelsius !== undefined && (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-sky-800 shadow-2xs whitespace-nowrap">
                <span>Dự báo 6h:</span>
                <strong>{aiContext.weather.rainProbabilityNext6HoursMaxPercent ?? 0}% mưa</strong>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
          {messages.map(m => (
            <div key={m.id} className={`p-3 rounded-lg max-w-[85%] leading-relaxed ${
              m.sender === 'USER'
                ? 'ml-auto bg-[#119653] text-white shadow-xs'
                : 'bg-slate-50 text-slate-800 border border-slate-200 shadow-xs'
            }`}>
              {m.text}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-slate-400 text-xs italic p-2">
              <Loader2 size={14} className="animate-spin text-[#119653]" /> Trợ lý AI đang phân tích dữ liệu vi khí hậu...
            </div>
          )}
        </div>
        {/* Quick prompt chips for farmer */}
        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200/80 flex items-center gap-1.5 overflow-x-auto text-[11px]">
          <span className="text-slate-400 font-medium whitespace-nowrap text-[10px]">Hỏi nhanh:</span>
          <button
            type="button"
            onClick={() => { setText('Độ ẩm đất hiện tại có cần tưới thêm không?'); }}
            disabled={loading}
            className="px-2.5 py-1 rounded-full bg-white hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 border border-slate-200 text-[11px] whitespace-nowrap cursor-pointer"
          >
            💧 Kiểm tra độ ẩm đất & tưới
          </button>
          <button
            type="button"
            onClick={() => { setText('Cây trồng giai đoạn này cần chú ý sâu bệnh gì?'); }}
            disabled={loading}
            className="px-2.5 py-1 rounded-full bg-white hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 border border-slate-200 text-[11px] whitespace-nowrap cursor-pointer"
          >
            🐛 Phòng ngừa sâu bệnh
          </button>
        </div>

        <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 flex gap-2 rounded-b-xl">
          <Input value={text} onChange={e => setText(e.target.value)} placeholder="Hỏi AI về vi khí hậu, sâu bệnh, tưới tiêu..." className="flex-1 text-xs" disabled={loading} />
          <Button type="submit" size="sm" disabled={loading || !text.trim()}><Send size={14} /></Button>
        </form>
      </div>
    </div>
  );
};
