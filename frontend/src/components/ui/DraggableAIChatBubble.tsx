import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, Sparkles, ChevronDown, GripVertical, Send, ArrowRight } from 'lucide-react';

interface DraggableAIChatBubbleProps {
  onOpenConsult?: () => void;
}

export const DraggableAIChatBubble: React.FC<DraggableAIChatBubbleProps> = ({ onOpenConsult }) => {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [quickInput, setQuickInput] = useState('');
  const [quickReplies, setQuickReplies] = useState<string[]>([]);

  const cardRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);
  const dragMovedRef = useRef<boolean>(false);

  // Keep within viewport on window resize
  useEffect(() => {
    const handleResize = () => {
      if (!position || !cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const maxX = Math.max(12, window.innerWidth - rect.width - 12);
      const maxY = Math.max(12, window.innerHeight - rect.height - 12);

      setPosition((prev) => {
        if (!prev) return null;
        return {
          x: Math.min(Math.max(12, prev.x), maxX),
          y: Math.min(Math.max(12, prev.y), maxY),
        };
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [position]);

  // Pointer drag initialization
  const startDrag = (clientX: number, clientY: number) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    dragStartRef.current = {
      mouseX: clientX,
      mouseY: clientY,
      startX: rect.left,
      startY: rect.top,
    };
    dragMovedRef.current = false;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only primary button
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    // Don't drag if clicking input, form buttons, or direct links
    if (target.closest('input, textarea, form button, .no-drag')) return;

    startDrag(e.clientX, e.clientY);
  };

  const handlePointerMove = useCallback((clientX: number, clientY: number) => {
    if (!dragStartRef.current || !cardRef.current) return;
    const deltaX = clientX - dragStartRef.current.mouseX;
    const deltaY = clientY - dragStartRef.current.mouseY;
    const dist = Math.hypot(deltaX, deltaY);

    if (dist > 4) {
      dragMovedRef.current = true;
      setIsDragging(true);

      const rect = cardRef.current.getBoundingClientRect();
      const maxX = Math.max(12, window.innerWidth - rect.width - 12);
      const maxY = Math.max(12, window.innerHeight - rect.height - 12);

      const nextX = Math.min(Math.max(12, dragStartRef.current.startX + deltaX), maxX);
      const nextY = Math.min(Math.max(12, dragStartRef.current.startY + deltaY), maxY);

      setPosition({ x: nextX, y: nextY });
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    dragStartRef.current = null;
    setIsDragging(false);
  }, []);

  useEffect(() => {
    const onWindowPointerMove = (e: PointerEvent) => {
      if (dragStartRef.current) {
        handlePointerMove(e.clientX, e.clientY);
      }
    };

    const onWindowPointerUp = () => {
      handlePointerUp();
    };

    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerUp);

    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const handleBubbleClick = (e: React.MouseEvent) => {
    // If it was a drag, don't toggle
    if (dragMovedRef.current) return;
    setIsExpanded((prev) => !prev);
  };

  const handleQuickSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;
    const text = quickInput.trim();
    setQuickReplies((prev) => [
      ...prev,
      `Bạn: ${text}`,
      'Trợ lý AI: Đã ghi nhận! Tôi sẽ tối ưu chu kỳ tưới và thông số vi khí hậu theo chuẩn VietGAP cho vườn của bạn.',
    ]);
    setQuickInput('');
  };

  return (
    <div
      ref={cardRef}
      onPointerDown={handlePointerDown}
      style={
        position
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
              bottom: 'auto',
              right: 'auto',
            }
          : undefined
      }
      className={`fixed z-50 select-none transition-shadow touch-none ${
        !position ? 'bottom-6 right-6' : ''
      } ${isDragging ? 'cursor-grabbing scale-[1.02] shadow-2xl opacity-95' : 'cursor-grab'}`}
      id="draggable-ai-chat-bubble"
    >
      {/* ───────────────────────────────────────────────────────────── */}
      {/* EXPANDED VIEW: Full AI Assistant Widget Card                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isExpanded ? (
        <div className="w-80 sm:w-88 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border-2 border-emerald-300/80 overflow-hidden ring-1 ring-emerald-500/20 text-left animate-in fade-in zoom-in-95 duration-200">
          {/* Header Bar / Drag Handle */}
          <div className="bg-gradient-to-r from-[#062326] via-[#093d39] to-[#0d5045] text-white px-3.5 py-2.5 flex items-center justify-between border-b border-emerald-800/50 cursor-grab active:cursor-grabbing">
            <div className="flex items-center gap-2">
              <div className="text-emerald-400/80 hover:text-white" title="Kéo để di chuyển khắp màn hình">
                <GripVertical size={16} />
              </div>
              <div className="relative">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
                  <Bot size={16} />
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#062326] animate-pulse" />
              </div>
              <div>
                <div className="text-xs font-bold leading-none flex items-center gap-1.5">
                  <span>Trợ lý AI Nông học VietGAP</span>
                </div>
                <div className="text-[10px] text-emerald-300/90 font-mono mt-0.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  Gemini 2.5 • Trực tuyến 24/7
                </div>
              </div>
            </div>

            {/* Minimize button */}
            <button
              type="button"
              onClick={handleBubbleClick}
              className="no-drag w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Thu nhỏ thành bong bóng chat"
            >
              <ChevronDown size={14} />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-3.5 space-y-3 bg-gradient-to-b from-emerald-50/30 to-white">
            {/* Live Recommendation Speech Bubble */}
            <div className="p-3 rounded-xl bg-white border border-emerald-200/90 shadow-xs relative">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#062326] mb-1">
                <Sparkles size={13} className="text-amber-500" />
                <span>Khuyến nghị vi khí hậu mới nhất:</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                "Thời tiết chiều nay hanh khô, hệ thống đã tự động bù ẩm 15 phút bảo vệ rễ non."
              </p>
              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span className="text-emerald-700 font-semibold">Độ tin cậy: 98.5%</span>
                <span>Vừa xong</span>
              </div>
            </div>

            {/* Quick Chat History (if any) */}
            {quickReplies.length > 0 && (
              <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1 text-xs">
                {quickReplies.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded-lg leading-tight ${
                      msg.startsWith('Bạn:')
                        ? 'bg-emerald-100/70 text-[#062326] ml-4 text-right'
                        : 'bg-slate-100 text-slate-800 mr-4'
                    }`}
                  >
                    {msg}
                  </div>
                ))}
              </div>
            )}

            {/* Quick Ask Input */}
            <form onSubmit={handleQuickSend} className="relative flex items-center">
              <input
                type="text"
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                placeholder="Hỏi AI vi khí hậu, sâu bệnh..."
                className="w-full text-xs py-2 pl-3 pr-8 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-xs"
              />
              <button
                type="submit"
                className="absolute right-1.5 w-6 h-6 rounded-lg bg-[#062326] text-emerald-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Gửi câu hỏi"
              >
                <Send size={12} />
              </button>
            </form>

            {/* Quick Action Footer */}
            <div className="pt-1 flex items-center justify-between gap-2 border-t border-slate-100 text-[11px]">
              <span className="text-slate-500 text-[10px] flex items-center gap-1">
                <GripVertical size={11} className="text-slate-400" /> Kéo thả khắp màn hình
              </span>
              {onOpenConsult && (
                <button
                  type="button"
                  onClick={onOpenConsult}
                  className="no-drag px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-[#062326] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Tư vấn kỹ thuật</span>
                  <ArrowRight size={11} />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ───────────────────────────────────────────────────────────── */
        /* COLLAPSED VIEW: Draggable Floating Chat Bubble (Bong bóng)     */
        /* ───────────────────────────────────────────────────────────── */
        <div
          onClick={handleBubbleClick}
          className="group relative flex items-center gap-2 p-2.5 rounded-full bg-gradient-to-r from-[#062326] via-[#09433d] to-[#047857] text-white shadow-2xl border-2 border-emerald-300/80 hover:brightness-110 transition-all transform hover:scale-105 cursor-grab active:cursor-grabbing active:scale-95"
          title="Nhấn để mở / Kéo để di chuyển khắp màn hình"
        >
          {/* Pulsing ring aura */}
          <span className="absolute -inset-1 rounded-full bg-emerald-400/30 blur-sm animate-pulse pointer-events-none" />

          {/* Bot Avatar Icon */}
          <div className="relative w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-300/40 flex items-center justify-center text-emerald-300 shadow-inner">
            <Bot size={20} />
            {/* Live green dot badge */}
            <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#062326] animate-ping" />
            <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#062326]" />
          </div>

          {/* Bubble Pill Text */}
          <div className="text-left pr-2 hidden sm:block">
            <div className="text-xs font-bold text-white flex items-center gap-1">
              <span>Trợ lý AI VietGAP</span>
              <Sparkles size={11} className="text-amber-300" />
            </div>
            <div className="text-[10px] text-emerald-200/90 font-mono leading-none">
              Kéo thả khắp màn hình
            </div>
          </div>

          {/* Mini Grip Icon */}
          <div className="text-emerald-400/60 group-hover:text-emerald-300 pl-0.5">
            <GripVertical size={14} />
          </div>
        </div>
      )}
    </div>
  );
};
