import React, { useState, useEffect } from 'react';
import { X, MessageCircle, ShieldCheck, QrCode } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: { id: string; nickname: string; avatar: string }) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [step, setStep] = useState<'scan' | 'confirm'>('scan');

  if (!isOpen) return null;

  const handleSimulateLogin = () => {
    setStep('confirm');
    setTimeout(() => {
      onLoginSuccess({
        id: 'wx_user_123',
        nickname: '微信用户',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'
      });
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-black text-slate-900">微信登录</h2>
              <p className="text-slate-500 text-sm font-medium">请使用微信扫码以继续操作</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-slate-400" />
            </button>
          </div>

          <div className="flex flex-col items-center py-8">
            <div className="relative group cursor-pointer" onClick={handleSimulateLogin}>
              <div className="absolute -inset-4 bg-emerald-500/10 rounded-[2rem] blur-xl group-hover:bg-emerald-500/20 transition-all"></div>
              <div className="relative bg-white p-4 rounded-3xl border-2 border-slate-100 shadow-sm">
                {step === 'scan' ? (
                  <div className="w-48 h-48 bg-slate-50 flex flex-col items-center justify-center gap-3">
                    <QrCode className="w-24 h-24 text-slate-800" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">点击模拟扫码</span>
                  </div>
                ) : (
                  <div className="w-48 h-48 flex flex-col items-center justify-center gap-4 text-emerald-600 animate-pulse">
                    <ShieldCheck className="w-16 h-16" />
                    <span className="text-sm font-black">正在安全登录...</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 flex items-center gap-2 text-slate-400">
              <MessageCircle className="w-4 h-4 text-emerald-500" />
              <p className="text-xs font-bold">微信官方安全登录服务</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 p-6 border-t border-slate-100">
          <p className="text-[10px] text-center text-slate-400 leading-relaxed font-medium uppercase tracking-tight">
            登录即代表您同意我们的<br/>
            <span className="text-blue-500 cursor-pointer">服务协议</span> 与 <span className="text-blue-500 cursor-pointer">隐私政策</span>
          </p>
        </div>
      </div>
    </div>
  );
};
