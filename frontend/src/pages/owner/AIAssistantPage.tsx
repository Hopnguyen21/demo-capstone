import React, { useState, useEffect } from 'react';
import { Bot, Send, CheckCircle2, XCircle, Sparkles, Sprout, ShieldAlert, Cpu, Clock } from 'lucide-react';
import { Button, Input } from '../../components/ui/BaseUI';
import { aiService } from '../../services';
import { useAuth } from '../../app/providers/AuthContext';

export const AIAssistantPage: React.FC = () => {
  const { zones, selectedZoneId, setSelectedZoneId } = useAuth();
  const currentZoneId = selectedZoneId || zones[0]?.zoneId || '32000000-0000-0000-0000-000000000001';
  
  const [aiContext, setAiContext] = useState<any>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [messages, setMessages] = useState<any[]>([
    { messageId: 'm1', sender: 'AI', text: 'Xin chào! Tôi là Trợ lý AI Nông học VietGAP. Tôi có thể hỗ trợ bạn theo dõi vi khí hậu, tưới tiêu và phát hiện sâu bệnh.', timestamp: 'Hôm nay' }
  ]);
  const [inputText, setInputText] = useState('');
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  useEffect(() => {
    if (currentZoneId) {
      setLoadingContext(true);
      // Immediately reset chat and recommendations to prevent showing old zone data
      setMessages([
        { messageId: 'm1', sender: 'AI', text: 'Xin chào! Tôi là Trợ lý AI Nông học VietGAP. Tôi có thể hỗ trợ bạn theo dõi vi khí hậu, tưới tiêu và phát hiện sâu bệnh.', timestamp: 'Hôm nay' }
      ]);
      setRecommendations([]);

      aiService.getContext(currentZoneId)
        .then(ctx => setAiContext(ctx))
        .catch(err => {
          console.error('Failed to load AI context:', err);
          setAiContext(null);
        })
        .finally(() => setLoadingContext(false));

      aiService.getMessages(currentZoneId)
        .then(hist => {
          if (Array.isArray(hist) && hist.length > 0) {
            // Restore chat messages from history (oldest first)
            const sortedHist = [...hist].sort((a: any, b: any) => 
              new Date(a.createdAtUtc || 0).getTime() - new Date(b.createdAtUtc || 0).getTime()
            );

            const restoredChat: any[] = [];
            sortedHist.forEach((h: any, idx: number) => {
              const timeStr = h.createdAtUtc ? new Date(h.createdAtUtc).toLocaleTimeString() : 'Trước';
              if (h.question) {
                restoredChat.push({
                  messageId: `hist-q-${h.recommendationId || idx}`,
                  sender: 'USER',
                  text: h.question,
                  timestamp: timeStr
                });
              }
              const hasAction = h.isActionable && h.proposedAction;
              restoredChat.push({
                messageId: `hist-a-${h.recommendationId || idx}`,
                sender: 'AI',
                text: h.details || h.summary || 'Khuyến nghị đã được ghi nhận.',
                recommendation: hasAction ? {
                  recommendationId: h.recommendationId,
                  title: h.summary || 'Khuyến nghị Vi khí hậu',
                  recommendationText: h.details || h.summary,
                  reasoning: h.limitations?.join('; ') || 'Dựa trên bối cảnh cảm biến và quy chuẩn VietGAP',
                  confidenceScore: Math.round((h.confidence || 0.85) * 100),
                  status: (h.status || 'READY').toUpperCase(),
                  proposedAction: h.proposedAction,
                  proposedDurationSeconds: h.proposedDurationSeconds,
                  validUntilUtc: h.validUntilUtc
                } : undefined,
                timestamp: timeStr
              });
            });

            if (restoredChat.length > 0) {
              setMessages([
                { messageId: 'm1', sender: 'AI', text: 'Xin chào! Tôi là Trợ lý AI Nông học VietGAP. Tôi có thể hỗ trợ bạn theo dõi vi khí hậu, tưới tiêu và phát hiện sâu bệnh.', timestamp: 'Hôm nay' },
                ...restoredChat
              ]);
            }

            // Restore actionable queue for right column: ONLY pending/ready items
            const nowIso = new Date().toISOString();
            const mapped = hist
              .filter((h: any) => 
                h.isActionable && 
                h.proposedAction && 
                (h.status === 'Ready' || h.status === 'READY') &&
                (!h.validUntilUtc || h.validUntilUtc > nowIso)
              )
              .map((h: any) => ({
                recommendationId: h.recommendationId,
                title: h.summary || 'Khuyến nghị Vi khí hậu',
                recommendationText: h.details || h.summary,
                reasoning: h.limitations?.join('; ') || 'Dựa trên bối cảnh cảm biến và quy chuẩn VietGAP',
                confidenceScore: Math.round((h.confidence || 0.85) * 100),
                status: 'READY',
                proposedAction: h.proposedAction,
                proposedDurationSeconds: h.proposedDurationSeconds
              }));
            setRecommendations(mapped);
          } else {
            setRecommendations([]);
          }
        })
        .catch(() => {
          setRecommendations([]);
        });
    }
  }, [currentZoneId]);

  const handleSend = async (e?: React.FormEvent, customQuestion?: string) => {
    if (e) e.preventDefault();
    const userText = (customQuestion || inputText).trim();
    if (!userText || isSending) return;
    setInputText('');
    setIsSending(true);
    setMessages(prev => [...prev, { messageId: `msg-${Date.now()}`, sender: 'USER', text: userText, timestamp: new Date().toLocaleTimeString() }]);
    try {
      const reply = await aiService.sendMessage(currentZoneId, userText);
      const textToDisplay = reply?.details || reply?.summary || reply?.text || reply?.answer || 'Mô hình AI Nông học đã ghi nhận yêu cầu.';
      const hasActionableRec = reply?.recommendationId && reply?.isActionable && reply?.proposedAction;
      setMessages(prev => [...prev, { 
        messageId: `msg-${Date.now() + 1}`, 
        sender: 'AI', 
        text: textToDisplay,
        recommendation: hasActionableRec ? {
          recommendationId: reply.recommendationId,
          title: reply.summary || 'Khuyến nghị Vi khí hậu',
          recommendationText: reply.details || reply.summary,
          reasoning: reply.limitations?.join('; ') || 'Dựa trên bối cảnh cảm biến và quy chuẩn VietGAP',
          confidenceScore: Math.round((reply.confidence || 0.85) * 100),
          status: 'READY',
          proposedAction: reply.proposedAction,
          proposedDurationSeconds: reply.proposedDurationSeconds,
          validUntilUtc: reply.validUntilUtc
        } : undefined,
        timestamp: new Date().toLocaleTimeString() 
      }]);

      if (hasActionableRec) {
        setRecommendations(prev => [
          {
            recommendationId: reply.recommendationId,
            title: reply.summary || 'Khuyến nghị Vi khí hậu',
            recommendationText: reply.details || reply.summary,
            reasoning: reply.limitations?.join('; ') || 'Dựa trên bối cảnh cảm biến và quy chuẩn VietGAP',
            confidenceScore: Math.round((reply.confidence || 0.85) * 100),
            status: 'READY',
            proposedAction: reply.proposedAction,
            proposedDurationSeconds: reply.proposedDurationSeconds,
            validUntilUtc: reply.validUntilUtc
          },
          ...prev
        ]);
      }
    } catch {
      setMessages(prev => [...prev, { messageId: `msg-${Date.now() + 1}`, sender: 'AI', text: 'Khuyến nghị: Duy trì độ ẩm đất 65-70% và thông gió nhẹ.', timestamp: new Date().toLocaleTimeString() }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleApply = async (id: string) => {
    try {
      await aiService.applyRecommendation(currentZoneId, id, 'Accepted');
      // Update inside messages list
      setMessages(prev => prev.map(m => {
        if (m.recommendation && m.recommendation.recommendationId === id) {
          return { ...m, recommendation: { ...m.recommendation, status: 'ACCEPTED' } };
        }
        return m;
      }));
      // Remove from right queue
      setRecommendations(prev => prev.filter(r => (r.recommendationId || r.id) !== id));
    } catch (err: any) {
      console.error('Failed to apply recommendation:', err);
      const detailMsg = err?.response?.data?.detail || err?.response?.data?.title || 'Điều kiện vi khí hậu không cho phép thực hiện lúc này.';
      
      // 1. Thêm tin nhắn thông báo vào khung chat
      setMessages(prev => [
        ...prev.map(m => {
          if (m.recommendation && m.recommendation.recommendationId === id) {
            return { ...m, recommendation: { ...m.recommendation, status: 'REJECTED' } };
          }
          return m;
        }),
        {
          messageId: `msg-alert-${Date.now()}`,
          sender: 'AI',
          text: `⚠️ **TẠM HOÃN / HỦY KHUYẾN NGHỊ:** ${detailMsg}\n\nHệ thống đã tự động hủy đề xuất kích hoạt thiết bị để bảo vệ cây trồng và tiết kiệm năng lượng.`,
          timestamp: new Date().toLocaleTimeString()
        }
      ]);

      // 2. Hủy khuyến nghị trên backend & xóa khỏi hàng đợi chờ duyệt bên phải
      setRecommendations(prev => prev.filter(r => (r.recommendationId || r.id) !== id));
      aiService.applyRecommendation(currentZoneId, id, 'Rejected', detailMsg).catch(() => {});
    }
  };

  const handleReject = async (id: string) => {
    try {
      await aiService.applyRecommendation(currentZoneId, id, 'Rejected', 'Từ chối bởi chủ trang trại');
      setMessages(prev => prev.map(m => {
        if (m.recommendation && m.recommendation.recommendationId === id) {
          return { ...m, recommendation: { ...m.recommendation, status: 'REJECTED' } };
        }
        return m;
      }));
      setRecommendations(prev => prev.filter(r => (r.recommendationId || r.id) !== id));
    } catch (err) {
      console.error('Failed to reject recommendation:', err);
      // Still remove from queue locally
      setRecommendations(prev => prev.filter(r => (r.recommendationId || r.id) !== id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Bot className="text-[#119653]" size={24} /> Trợ lý AI Nông học VietGAP (Gemini 2.5 Flash + RAG)
          </h1>
          <p className="text-xs text-slate-600 mt-1">Phân tích vi khí hậu thời gian thực, chẩn đoán sâu bệnh và đề xuất tưới thông minh theo từng Khu vực trồng (Zone).</p>
        </div>

        {/* Zone Selector */}
        {zones.length > 0 && (
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Chọn Khu Vực (Zone):</span>
            <select
              value={currentZoneId}
              onChange={(e) => setSelectedZoneId(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              {zones.map((z) => (
                <option key={z.zoneId} value={z.zoneId}>
                  {z.name || `Zone ${z.zoneId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Chat Interface */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col h-[600px] overflow-hidden">
          {/* Chat Context Header */}
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>
                Bối cảnh AI: <strong className="text-slate-900">
                  {aiContext?.zoneName || 'Demo Greenhouse Zone'} 
                  ({aiContext?.cropName ? `${aiContext.cropName} - ${aiContext.growthStageName || 'Sinh trưởng'}` : 'Đang tải dữ liệu...'})
                </strong>
              </span>
            </div>
            <span className="text-[10px] font-mono bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
              {loadingContext ? 'Đang cập nhật...' : `Context Loaded (${aiContext?.telemetry?.length || 4} Sensors + Thời tiết)`}
            </span>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs bg-slate-50/50">
            {messages.map(msg => {
              const isUser = msg.senderType === 'USER' || msg.sender === 'USER';
              const textContent = msg.messageText || msg.text || '';
              return (
                <div key={msg.messageId} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser && (
                    <div className="w-8 h-8 rounded-full bg-[#119653] text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Bot size={18} />
                    </div>
                  )}

                  <div className={`max-w-[85%] p-4 rounded-xl space-y-2 ${isUser ? 'bg-[#119653] text-white rounded-br-none shadow-xs' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-xs'}`}>
                    <p className="leading-relaxed whitespace-pre-wrap">{textContent}</p>

                  {/* Embedded Recommendation Card inside AI message */}
                  {msg.recommendation && (
                    <div className="mt-3 p-4 bg-gradient-to-br from-emerald-50/90 to-teal-50/50 border border-emerald-200/90 rounded-xl space-y-3 shadow-xs">
                      {/* Header with Title and Badges */}
                      <div className="flex items-start justify-between gap-2 border-b border-emerald-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                            <Sparkles size={13} />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200 inline-block mb-0.5">
                              Đề xuất giải pháp
                            </span>
                            <h4 className="text-xs font-bold text-slate-900">{msg.recommendation.title}</h4>
                          </div>
                        </div>

                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono shrink-0">
                          {msg.recommendation.confidenceScore}% Tin cậy
                        </span>
                      </div>

                      {/* Action proposal if available */}
                      {msg.recommendation.proposedAction && (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-100/70 border border-emerald-300 text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center shrink-0">
                              <Cpu size={14} />
                            </div>
                            <div>
                              <div className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider">Hành động đề xuất</div>
                              <div className="text-slate-900 font-bold text-xs">
                                {msg.recommendation.proposedAction === 'TurnOn' ? 'Bật máy bơm tưới nước' : msg.recommendation.proposedAction}
                              </div>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded bg-white font-mono font-bold text-emerald-800 border border-emerald-200 text-xs">
                            ⏱️ {msg.recommendation.proposedDurationSeconds ? `${msg.recommendation.proposedDurationSeconds / 60} phút (${msg.recommendation.proposedDurationSeconds}s)` : 'Theo chu kỳ'}
                          </span>
                        </div>
                      )}

                      {/* Details text */}
                      <p className="text-slate-700 text-xs leading-relaxed font-sans bg-white/80 p-2.5 rounded-lg border border-emerald-100/80">
                        {msg.recommendation.recommendationText}
                      </p>

                      {/* Analysis and Notes */}
                      {msg.recommendation.reasoning && (
                        <div className="text-[11px] text-slate-600 bg-slate-50/90 p-2.5 rounded-lg border border-slate-200/70 space-y-1">
                          <div className="font-semibold text-slate-700 flex items-center gap-1">
                            <ShieldAlert size={12} className="text-emerald-600" /> Căn cứ kỹ thuật & Lưu ý:
                          </div>
                          <p className="leading-relaxed text-slate-600">{msg.recommendation.reasoning}</p>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-slate-500 italic">Xác nhận để kích hoạt thiết bị</span>
                        {msg.recommendation.status === 'ACCEPTED' ? (
                          <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 font-semibold text-xs border border-emerald-300">
                            <CheckCircle2 size={14} className="text-emerald-600" /> Đã gửi lệnh bật máy bơm
                          </div>
                        ) : msg.recommendation.status === 'REJECTED' ? (
                          <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 font-semibold text-xs border border-rose-200">
                            <XCircle size={14} className="text-rose-600" /> Đã từ chối khuyến nghị
                          </div>
                        ) : (msg.recommendation.validUntilUtc && new Date(msg.recommendation.validUntilUtc) <= new Date()) ? (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 font-medium text-xs border border-slate-200">
                            <Clock size={13} className="text-slate-400" /> Khuyến nghị đã hết hạn (15p)
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="text-xs text-slate-600 border-slate-300 hover:bg-slate-100 px-3 py-1.5 rounded-lg"
                              onClick={() => handleReject(msg.recommendation!.recommendationId)}
                            >
                              <XCircle size={13} className="mr-1 text-slate-500" /> Bỏ qua
                            </Button>
                            <Button 
                              size="sm" 
                              className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-xs px-3.5 py-1.5 rounded-lg transition-all"
                              onClick={() => handleApply(msg.recommendation!.recommendationId)}
                            >
                              <CheckCircle2 size={13} className="mr-1" /> 
                              {msg.recommendation.proposedAction === 'TurnOn' 
                                ? `Bật bơm (${msg.recommendation.proposedDurationSeconds ? `${msg.recommendation.proposedDurationSeconds}s` : '10p'})` 
                                : 'Áp dụng'}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <span className={`text-[9px] block text-right opacity-70 ${msg.senderType === 'USER' ? 'text-slate-200' : 'text-slate-400'}`}>{msg.createdAt || msg.timestamp}</span>
                </div>
              </div>
            );
          })}

          {/* AI Thinking Indicator */}
          {isSending && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-[#119653] text-white">
                <Bot size={14} className="animate-pulse" />
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-2 text-slate-500 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.4s]" />
                <span className="text-[11px] text-slate-400 font-mono ml-1">AI đang đối chiếu dữ liệu cảm biến & quy chuẩn VietGAP...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Suggestions */}
          <div className="px-3 py-1.5 bg-slate-50/80 border-t border-slate-200/80 flex items-center gap-1.5 overflow-x-auto text-[11px]">
            <span className="text-slate-400 font-medium whitespace-nowrap text-[10px]">Gợi ý nhanh:</span>
            <button
              type="button"
              onClick={() => handleSend(undefined, 'Nhiệt độ và độ ẩm hiện tại thế nào, có cần tưới không?')}
              disabled={isSending}
              className="px-2.5 py-1 rounded-full bg-white hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 border border-slate-200 hover:border-emerald-300 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              💧 Kiểm tra vi khí hậu & tưới
            </button>
            <button
              type="button"
              onClick={() => handleSend(undefined, 'Có lịch tưới tự động nào sắp chạy trong hôm nay không?')}
              disabled={isSending}
              className="px-2.5 py-1 rounded-full bg-white hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 border border-slate-200 hover:border-emerald-300 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              ⏰ Xem lịch tưới sắp tới
            </button>
            <button
              type="button"
              onClick={() => handleSend(undefined, 'Cây trồng giai đoạn này cần lưu ý phòng ngừa bệnh gì?')}
              disabled={isSending}
              className="px-2.5 py-1 rounded-full bg-white hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 border border-slate-200 hover:border-emerald-300 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              🌿 Khuyến nghị chăm sóc VietGAP
            </button>
          </div>

          {/* Input Bar */}
          <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 flex gap-2">
            <Input
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Hỏi AI về lượng nước tưới, triệu chứng vi khí hậu, lịch tưới..."
              className="flex-1"
              disabled={isSending}
            />
            <Button type="submit" disabled={isSending || !inputText.trim()}>
              <Send size={15} />
            </Button>
          </form>
        </div>

        {/* Right Col: Active Recommendation Cards Inbox */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles size={16} className="text-emerald-600" /> Hàng đợi Duyệt Khuyến nghị
            </h3>
            {recommendations.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                {recommendations.length}
              </span>
            )}
          </div>

          {recommendations.length === 0 ? (
            <div className="p-6 bg-white border border-dashed border-slate-300 rounded-xl text-center space-y-2">
              <Sprout size={28} className="mx-auto text-slate-400" />
              <p className="text-xs text-slate-600 font-medium">Chưa có khuyến nghị mới cần duyệt</p>
              <p className="text-[11px] text-slate-400">Các đề xuất tưới tiêu hoặc vi khí hậu từ AI sẽ xuất hiện tại đây.</p>
            </div>
          ) : (
            recommendations.map((rec, idx) => (
              <div key={rec.recommendationId || rec.id || `rec-${idx}`} className="p-4 bg-white border border-emerald-200 hover:border-emerald-300 rounded-xl space-y-3 shadow-xs hover:shadow-sm transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {rec.recommendationType || 'NÔNG HỌC VIETGAP'}
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {rec.confidenceScore}% Tin cậy
                  </span>
                </div>

                <h4 className="text-xs font-bold text-slate-900 leading-snug">{rec.title}</h4>
                <p className="text-[11px] text-slate-600 line-clamp-3 leading-relaxed">{rec.recommendationText}</p>

                {rec.reasoning && (
                  <div className="p-2.5 bg-slate-50/80 rounded-lg text-[10px] text-slate-600 font-mono leading-relaxed border border-slate-200">
                    <strong className="text-slate-700">Căn cứ:</strong> {rec.reasoning}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  {rec.status === 'ACCEPTED' ? (
                    <span className="text-xs text-emerald-700 font-bold flex items-center gap-1"><CheckCircle2 size={14} /> Đã phê duyệt</span>
                  ) : (
                    <div className="flex gap-2 w-full">
                      <Button size="sm" variant="outline" className="w-1/2 text-xs" onClick={() => handleReject(rec.recommendationId || rec.id)}>
                        <XCircle size={13} className="mr-1 text-slate-500" /> Bỏ qua
                      </Button>
                      <Button size="sm" className="w-1/2 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-medium" onClick={() => handleApply(rec.recommendationId || rec.id)}>
                        <CheckCircle2 size={13} className="mr-1" /> Duyệt bật bơm
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
