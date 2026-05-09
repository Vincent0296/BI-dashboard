import React, { useState } from 'react';
import { X, Send, MessageSquareText, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const [text, setText] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSending, setIsSending] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setIsSending(true);
    try {
      const { error } = await supabase.from('feedback').insert([{
        id: Date.now().toString(),
        userId: 'anonymous', // Or pass userId as prop if needed
        content: text,
        timestamp: new Date().toISOString()
      }]);
      if (error) throw new Error('提交失败');
      
      setIsSending(false);
      setIsSubmitted(true);
      setTimeout(() => {
        onClose();
        setIsSubmitted(false);
        setText('');
      }, 2000);
    } catch (err) {
      alert('反馈提交失败，请重试');
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-300">
        <div className="p-8">
          <div className="flex justify-between items-start mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-50 rounded-2xl">
                <MessageSquareText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900">意见反馈</h2>
                <p className="text-slate-500 text-sm font-medium">您的建议是我们进步的动力</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-slate-400" />
            </button>
          </div>

          {!isSubmitted ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="relative">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="请输入您的意见或建议..."
                  className="w-full h-48 p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-700 font-medium resize-none"
                  required
                />
                <div className="absolute bottom-4 right-6 text-xs font-bold text-slate-300">
                  {text.length} / 500
                </div>
              </div>

              <button
                type="submit"
                disabled={!text.trim() || isSending}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-blue-600 transition-all shadow-xl shadow-blue-100 disabled:opacity-50 disabled:bg-slate-200 disabled:shadow-none"
              >
                {isSending ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    提交反馈
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="flex flex-col items-center py-12 text-center animate-in zoom-in duration-500">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="w-12 h-12 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">提交成功</h3>
              <p className="text-slate-500 font-medium">感谢您的反馈，我们会尽快查看！</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
