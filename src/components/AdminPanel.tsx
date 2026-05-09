import React, { useEffect, useState } from 'react';
import { Users, MessageSquare, ArrowLeft, RefreshCw, Clock, ShieldCheck } from 'lucide-react';
import { User } from '../types';
import { supabase } from '../lib/supabase';

interface AdminData {
  users: User[];
  feedback: any[];
}

interface AdminPanelProps {
  onBack: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onBack }) => {
  const [data, setData] = useState<AdminData>({ users: [], feedback: [] });
  const [loading, setLoading] = useState(true);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('lastLoginTime', { ascending: false });

      const { data: feedbackData, error: feedbackError } = await supabase
        .from('feedback')
        .select('*')
        .order('timestamp', { ascending: false });

      if (usersError || feedbackError) throw new Error('Failed to fetch admin data');

      setData({
        users: usersData || [],
        feedback: feedbackData || []
      });
    } catch (err: any) {
      console.error('Admin Panel Fetch Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '未知时间';
    try {
      return new Date(dateStr).toLocaleString('zh-CN', { 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return '格式错误';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-xl">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-white">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tight">管理后台</h1>
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">System Administration</p>
          </div>
        </div>
        <button onClick={fetchAdminData} className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-700 transition-all">
          <RefreshCw className={loading ? "w-4 h-4 animate-spin" : "w-4 h-4"} />
          刷新数据
        </button>
      </header>

      <main className="flex-1 p-6 space-y-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center justify-between group hover:border-blue-500 transition-colors">
            <div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">注册用户总量</p>
              <h3 className="text-5xl font-black text-slate-900">{data.users.length}</h3>
            </div>
            <div className="p-6 bg-blue-50 rounded-3xl text-blue-600 group-hover:scale-110 transition-transform">
              <Users className="w-10 h-10" />
            </div>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center justify-between group hover:border-emerald-500 transition-colors">
            <div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">收到反馈总量</p>
              <h3 className="text-5xl font-black text-slate-900">{data.feedback.length}</h3>
            </div>
            <div className="p-6 bg-emerald-50 rounded-3xl text-emerald-600 group-hover:scale-110 transition-transform">
              <MessageSquare className="w-10 h-10" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex items-center gap-3">
              <Users className="w-5 h-5 text-blue-600" />
              <h4 className="font-black text-slate-800 uppercase tracking-tight">最新注册用户</h4>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[600px] p-4 space-y-3">
              {data.users.map((user) => (
                <div key={user.id} className="flex flex-col gap-2 p-4 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
                  <div className="flex items-center gap-3">
                    <img src={user.avatar} alt="avatar" className="w-10 h-10 rounded-full border border-white shadow-sm" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800 truncate">{user.nickname}</p>
                      <p className="text-[10px] font-medium text-slate-400 truncate">@{user.username}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1 text-[9px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                      <ShieldCheck className="w-2.5 h-2.5 text-blue-500" />
                      IP: {user.lastLoginIp || '未知'}
                    </div>
                    {user.lastLoginTime && (
                      <div className="flex items-center gap-1 text-[9px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                        <Clock className="w-2.5 h-2.5 text-emerald-500" />
                        {formatDate(user.lastLoginTime)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-emerald-600" />
              <h4 className="font-black text-slate-800 uppercase tracking-tight">用户反馈流</h4>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[600px] p-6 space-y-6">
              {data.feedback.length === 0 ? (
                <div className="text-center py-20 text-slate-400 font-bold">暂无反馈数据</div>
              ) : (
                data.feedback.slice().reverse().map((f) => (
                  <div key={f.id} className="relative pl-8 border-l-2 border-slate-100">
                    <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-emerald-500 shadow-sm"></div>
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                          <Clock className="w-3 h-3" />
                          {formatDate(f.timestamp)}
                        </div>
                        <span className="text-[10px] font-black bg-white px-2 py-1 rounded-md border border-slate-200 text-slate-400">ID: {f.id}</span>
                      </div>
                      <p className="text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">{f.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
