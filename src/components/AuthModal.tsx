import React, { useState } from 'react';
import { X, ShieldCheck, User, Lock, ArrowRight, KeyRound, CheckCircle2 } from 'lucide-react';
import { User as UserType } from '../types';
import { supabase } from '../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserType) => void;
}

type AuthMode = 'login' | 'register' | 'reset';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data, error: dbError } = await supabase
        .from('users')
        .select('*')
        .or(`username.eq.${username},nickname.eq.${username}`)
        .eq('password', password)
        .single();

      if (dbError || !data) throw new Error('用户名或密码错误');

      // Update last login
      await supabase.from('users').update({
        lastLoginTime: new Date().toISOString()
      }).eq('id', data.id);

      const { password: _, ...userWithoutPassword } = data;
      onLoginSuccess(userWithoutPassword);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single();

      if (existingUser) throw new Error('用户名已存在');

      const newUser = {
        id: Date.now().toString(),
        username,
        password,
        nickname: username,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
        lastLoginTime: new Date().toISOString()
      };

      const { error: insertError } = await supabase.from('users').insert([newUser]);
      if (insertError) throw new Error('注册失败');

      const { password: _, ...userWithoutPassword } = newUser;
      onLoginSuccess(userWithoutPassword);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data: existingUser, error: findError } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single();

      if (findError || !existingUser) throw new Error('找不到该用户');

      const { error: updateError } = await supabase
        .from('users')
        .update({ password })
        .eq('id', existingUser.id);

      if (updateError) throw new Error('重置失败');

      setSuccess('密码已成功重置，请使用新密码登录');
      setTimeout(() => {
        setMode('login');
        setSuccess('');
      }, 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="text-2xl font-black text-slate-900">
                {mode === 'login' ? '账号登录' : mode === 'register' ? '创建账号' : '重置密码'}
              </h2>
              <p className="text-slate-500 text-sm font-medium">
                {mode === 'login' ? '输入您的凭据以继续' : mode === 'register' ? '加入我们的数据分析平台' : '请输入您的用户名设置新密码'}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <X className="w-6 h-6 text-slate-400" />
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-xs font-bold flex items-center gap-2">
              <div className="w-1 h-4 bg-red-500 rounded-full"></div>
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {success}
            </div>
          )}

          <form onSubmit={mode === 'login' ? handleLogin : mode === 'register' ? handleRegister : handleReset} className="space-y-4">
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="用户名或昵称"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 transition-all text-sm font-bold"
                required
              />
            </div>
            <div className="relative">
              {mode === 'reset' ? <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" /> : <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />}
              <input
                type="password"
                placeholder={mode === 'reset' ? "输入新密码" : "密码"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 transition-all text-sm font-bold"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-blue-600 transition-all shadow-xl shadow-blue-100"
            >
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (
                <>
                  {mode === 'login' ? '登录' : mode === 'register' ? '注册并登录' : '重置密码'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
            
            <div className="flex flex-col items-center gap-3 pt-4">
              <button 
                type="button"
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setSuccess(''); setError(''); }}
                className="text-xs font-bold text-slate-400 hover:text-blue-500 transition-colors"
              >
                {mode === 'login' ? '还没有账号？立即注册' : '已有账号？返回登录'}
              </button>
              
              {mode === 'login' && (
                <button 
                  type="button"
                  onClick={() => setMode('reset')}
                  className="text-xs font-bold text-slate-300 hover:text-red-400 transition-colors"
                >
                  忘记密码？
                </button>
              )}
              
              {mode === 'reset' && (
                <button 
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-xs font-bold text-slate-400 hover:underline"
                >
                  返回登录
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="bg-slate-50 p-6 border-t border-slate-100">
          <div className="flex items-center gap-2 justify-center text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <p className="text-[10px] font-black uppercase tracking-widest">安全加密传输控制</p>
          </div>
        </div>
      </div>
    </div>
  );
};
