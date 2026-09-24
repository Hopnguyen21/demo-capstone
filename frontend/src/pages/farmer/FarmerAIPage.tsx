import React, { useState } from 'react';
import { Bot, Send } from 'lucide-react';
import { Button, Input } from '../../components/ui/BaseUI';

export const FarmerAIPage: React.FC = () => {
  const [messages, setMessages] = useState([
    { id: '1', sender: 'AI', text: 'Chào anh Bình! Anh cần tư vấn về vi khí hậu hay sâu bệnh tại Nhà màng 01?' }
  ]);
  const [text, setText] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text) return;
    setMessages([
      ...messages,
      { id: Date.now().toString(), sender: 'USER', text },
      { id: (Date.now() + 1).toString(), sender: 'AI', text: `[Trợ lý AI]: Độ ẩm đất tại Nhà màng 01 đang ở mức 68.4% rất tốt. Anh có thể tiến hành kiểm tra sâu bệnh như kế hoạch.` }
    ]);
    setText('');
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
        </div>
        <form onSubmit={handleSend} className="p-3 bg-slate-50 border-t border-slate-200 flex gap-2 rounded-b-xl">
          <Input value={text} onChange={e => setText(e.target.value)} placeholder="Hỏi AI..." className="flex-1 text-xs" />
          <Button type="submit" size="sm"><Send size={14} /></Button>
        </form>
      </div>
    </div>
  );
};
