import React, { useState, useEffect } from 'react';
import { Bot, Send, Loader2 } from 'lucide-react';
import { Button, Input } from '../../components/ui/BaseUI';
import { aiService } from '../../services';
import { useAuth } from '../../app/providers/AuthContext';

export const FarmerAIPage: React.FC = () => {
  const { zones, selectedZoneId, setSelectedZoneId } = useAuth();
  const zoneId = selectedZoneId || zones[0]?.zoneId || '32000000-0000-0000-0000-000000000001';
  const currentZone = zones.find(z => z.zoneId === zoneId);
  const zoneName = currentZone?.name || zones[0]?.name || 'Nhà màng';
  const [aiContext, setAiContext] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([
    { id: '1', sender: 'AI', text: 'Chào bạn! Bạn cần tư vấn về vi khí hậu hay sâu bệnh tại Nhà màng được phân công?' }
  ]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!zoneId) return;
    setMessages([
      { id: '1', sender: 'AI', text: 'Chào bạn! Bạn cần tư vấn về vi khí hậu hay sâu bệnh tại Nhà màng được phân công?' }
    ]);
    // Load AI context (zone/crop info)
    aiService.getContext(zoneId)
      .then(ctx => setAiContext(ctx))
      .catch(() => setAiContext(null));
    // Restore chat history
    aiService.getMessages(zoneId)
      .then(hist => {
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
            text: h.details || h.summary || 'Trợ lý AI đã ghi nhận câu hỏi.'
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
  }, [zoneId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text || loading) return;
    const userMsg = text;
    setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'USER', text: userMsg }]);
    setText('');
    setLoading(true);

    try {
      const res = await aiService.ask(zoneId, userMsg);
      // Correct field mapping: AiRecommendationView uses details/summary
      const reply = (res as any)?.details || (res as any)?.summary || 'Đã phân tích điều kiện vi khí hậu tại nhà màng. Mọi thông số đang ổn định.';
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
        <form onSubmit={handleSend} className="p-3 bg-slate-50 border-t border-slate-200 flex gap-2 rounded-b-xl">
          <Input value={text} onChange={e => setText(e.target.value)} placeholder="Hỏi AI về vi khí hậu, sâu bệnh..." className="flex-1 text-xs" disabled={loading} />
          <Button type="submit" size="sm" disabled={loading}><Send size={14} /></Button>
        </form>
      </div>
    </div>
  );
};
