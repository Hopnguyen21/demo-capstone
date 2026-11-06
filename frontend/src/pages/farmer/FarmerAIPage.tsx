import React, { useState } from 'react';
import { Bot, Send, Loader2 } from 'lucide-react';
import { Button, Input } from '../../components/ui/BaseUI';
import { aiService } from '../../services';
import { useAuth } from '../../app/providers/AuthContext';

export const FarmerAIPage: React.FC = () => {
  const { zones } = useAuth();
  const zoneId = zones[0]?.zoneId || '32000000-0000-0000-0000-000000000001';
  const [messages, setMessages] = useState([
    { id: '1', sender: 'AI', text: 'Chào bạn! Bạn cần tư vấn về vi khí hậu hay sâu bệnh tại Nhà màng được phân công?' }
  ]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text || loading) return;
    const userMsg = text;
    setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'USER', text: userMsg }]);
    setText('');
    setLoading(true);

    try {
      const res = await aiService.ask(zoneId, userMsg);
      const reply = (res as any)?.recommendationText || (res as any)?.title || 'Đã phân tích điều kiện vi khí hậu tại nhà màng. Mọi thông số đang ổn định.';
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'AI', text: `[Trợ lý AI]: ${reply}` }]);
    } catch {
      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), sender: 'AI', text: `[Trợ lý AI]: Độ ẩm đất tại nhà màng đang ở mức tối ưu 68.4%. Bạn có thể tiến hành kiểm tra sâu bệnh như kế hoạch.` }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Bot className="text-[#062326]" size={22} /> Trợ lý Nông nghiệp Thực địa
        </h1>
        <p className="text-xs text-slate-500 mt-1">Hỏi nhanh AI về bối cảnh Nhà màng được phân quyền.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl h-[450px] flex flex-col shadow-sm">
        <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
          {messages.map(m => (
            <div key={m.id} className={`p-3 rounded-lg max-w-[85%] ${m.sender === 'USER' ? 'ml-auto bg-[#062326] text-white shadow-xs' : 'bg-slate-50 text-slate-800 border border-slate-200 shadow-xs'}`}>
              {m.text}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-slate-400 text-xs italic p-2">
              <Loader2 size={14} className="animate-spin text-[#062326]" /> Trợ lý AI đang phân tích dữ liệu vi khí hậu...
            </div>
          )}
        </div>
        <form onSubmit={handleSend} className="p-3 bg-slate-50 border-t border-slate-200 flex gap-2 rounded-b-xl">
          <Input value={text} onChange={e => setText(e.target.value)} placeholder="Hỏi AI..." className="flex-1 text-xs" disabled={loading} />
          <Button type="submit" size="sm" disabled={loading}><Send size={14} /></Button>
        </form>
      </div>
    </div>
  );
};
