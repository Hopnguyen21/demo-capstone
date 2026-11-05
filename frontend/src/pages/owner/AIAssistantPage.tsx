import React, { useState } from 'react';
import { mockAIMessages, mockAIRecommendations } from '../../mocks/mockData';
import { Bot, Send, CheckCircle2, XCircle, Sparkles, Sprout, ShieldAlert, Cpu } from 'lucide-react';
import { Button, Input } from '../../components/ui/BaseUI';
import { aiService } from '../../services';

export const AIAssistantPage: React.FC = () => {
  const [messages, setMessages] = useState(mockAIMessages);
  const [inputText, setInputText] = useState('');
  const [recommendations, setRecommendations] = useState(mockAIRecommendations);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const userMsg = await aiService.sendMessage(inputText);
    setMessages([...mockAIMessages]);
    setInputText('');
  };

  const handleApply = async (id: string) => {
    await aiService.applyRecommendation(id);
    setRecommendations([...mockAIRecommendations]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Bot className="text-[#062326]" size={24} /> Trợ lý AI Nông học VietGAP (Gemini 1.5 Flash + RAG)
          </h1>
          <p className="text-xs text-slate-600 mt-1">Phân tích vi khí hậu thời gian thực, chẩn đoán sâu bệnh và đề xuất tưới thông minh theo bối cảnh Nông trang.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Chat Interface */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col h-[600px] overflow-hidden">
          {/* Chat Context Header */}
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Bối cảnh AI: <strong className="text-slate-900">Nhà màng 01 (Cà chua Beefsteak - Ra hoa)</strong></span>
            </div>
            <span className="text-[10px] font-mono bg-emerald-50 text-[#062326] px-2 py-0.5 rounded border border-emerald-200 font-semibold">
              Context Loaded (4 Sensors + Weather)
            </span>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs bg-slate-50/50">
            {messages.map(msg => (
              <div key={msg.messageId} className={`flex gap-3 ${msg.senderType === 'USER' ? 'justify-end' : 'justify-start'}`}>
                {msg.senderType === 'AI' && (
                  <div className="w-8 h-8 rounded-full bg-[#062326] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Bot size={18} />
                  </div>
                )}

                <div className={`max-w-[85%] p-4 rounded-xl space-y-2 ${msg.senderType === 'USER' ? 'bg-[#062326] text-white rounded-br-none shadow-xs' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-xs'}`}>
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.messageText}</p>

                  {/* Embedded Recommendation Card inside AI message */}
                  {msg.recommendation && (
                    <div className="mt-3 p-3 bg-emerald-50/80 border border-emerald-200 rounded-lg space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[#062326] font-bold">
                        <span className="flex items-center gap-1"><Sparkles size={14} /> {msg.recommendation.title}</span>
                        <span className="text-[10px] bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200 font-mono">
                          {msg.recommendation.confidenceScore}% Confidence
                        </span>
                      </div>
                      <p className="text-slate-700">{msg.recommendation.recommendationText}</p>
                      <div className="text-[11px] text-slate-700 bg-white p-2 rounded border border-emerald-100 font-mono">
                        {msg.recommendation.reasoning}
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        {msg.recommendation.status === 'ACCEPTED' ? (
                          <span className="text-[#062326] font-bold flex items-center gap-1"><CheckCircle2 size={14} /> Đã áp dụng</span>
                        ) : (
                          <Button size="sm" onClick={() => handleApply(msg.recommendation!.recommendationId)}>
                            <CheckCircle2 size={13} className="mr-1" /> Áp dụng Khuyến nghị
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  <span className={`text-[9px] block text-right opacity-70 ${msg.senderType === 'USER' ? 'text-slate-200' : 'text-slate-400'}`}>{msg.createdAt}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Input Bar */}
          <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 flex gap-2">
            <Input
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Hỏi AI về lượng nước tưới, triệu chứng lá vàng, cảnh báo vi khí hậu..."
              className="flex-1"
            />
            <Button type="submit"><Send size={15} /></Button>
          </form>
        </div>

        {/* Right Col: Active Recommendation Cards Inbox */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sparkles size={16} className="text-[#062326]" /> Danh sách Khuyến nghị Chờ Duyệt (Owner Approval Queue)
          </h3>

          {recommendations.map(rec => (
            <div key={rec.recommendationId} className="p-4 bg-white border border-emerald-300 rounded-xl space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-[#062326] border border-emerald-200">
                  {rec.recommendationType}
                </span>
                <span className="text-xs font-mono font-bold text-[#062326]">{rec.confidenceScore}% An toàn</span>
              </div>

              <h4 className="text-xs font-bold text-slate-900 leading-snug">{rec.title}</h4>
              <p className="text-[11px] text-slate-600">{rec.recommendationText}</p>

              <div className="p-2.5 bg-slate-50 rounded-lg text-[10px] text-slate-700 font-mono leading-relaxed border border-slate-200">
                <strong>Lý do:</strong> {rec.reasoning}
              </div>

              <div className="flex items-center justify-between pt-1">
                {rec.status === 'ACCEPTED' ? (
                  <span className="text-xs text-[#062326] font-bold flex items-center gap-1"><CheckCircle2 size={14} /> Đã phê duyệt</span>
                ) : (
                  <div className="flex gap-1.5 w-full">
                    <Button size="sm" variant="outline" className="w-1/2 text-xs"><XCircle size={13} className="mr-1" /> Từ chối</Button>
                    <Button size="sm" variant="primary" className="w-1/2 text-xs" onClick={() => handleApply(rec.recommendationId)}>
                      <CheckCircle2 size={13} className="mr-1" /> Duyệt
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
