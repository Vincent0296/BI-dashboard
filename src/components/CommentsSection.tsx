import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Send, Download, Trash2, Edit2, Check, X, Filter, Upload, FileSpreadsheet } from 'lucide-react';
import { AuthState, CommentItem, FilterState, DataRecord } from '../types';

interface CommentsSectionProps {
  authState: AuthState;
  selectedMonth: string;
  filteredData: DataRecord[];
  onAuthRequired: () => void;
}

export const CommentsSection: React.FC<CommentsSectionProps> = ({ 
  authState, selectedMonth, filteredData, onAuthRequired 
}) => {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newProject, setNewProject] = useState('');
  const [newDimension, setNewDimension] = useState('同比');
  const [newText, setNewText] = useState('');
  
  const [filterProject, setFilterProject] = useState('');
  const [filterDimension, setFilterDimension] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');
  const [filterPropertyType, setFilterPropertyType] = useState('');
  const [filterManagement, setFilterManagement] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editProject, setEditProject] = useState('');
  const [editDimension, setEditDimension] = useState('同比');
  const [editText, setEditText] = useState('');
  const [editPeriod, setEditPeriod] = useState('');

  const availableProjects = Array.from(new Set(filteredData.map(d => d.projectName))).sort();
  const projectInfoMap = new Map<string, { propertyType: string, management: string }>();
  filteredData.forEach(d => {
    if (!projectInfoMap.has(d.projectName)) {
      projectInfoMap.set(d.projectName, { propertyType: d.propertyType, management: d.management });
    }
  });

  useEffect(() => {
    fetchComments();
  }, []);

  const fetchComments = async () => {
    try {
      const res = await fetch('/api/comments');
      const data = await res.json();
      // Sort newest first
      data.sort((a: CommentItem, b: CommentItem) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setComments(data);
    } catch (e) {
      console.error('Failed to load comments');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authState.isLoggedIn || !authState.user) {
      onAuthRequired();
      return;
    }
    
    if (!newProject.trim() || !newText.trim()) {
      alert('请选择项目名称和填写评论内容');
      return;
    }

    const info = projectInfoMap.get(newProject) || { propertyType: '全部', management: '全部' };

    const commentData = {
      project: newProject.trim(),
      dimension: newDimension,
      text: newText.trim(),
      period: selectedMonth || '全部',
      date: new Date().toISOString(),
      management: info.management,
      propertyType: info.propertyType,
      authorId: authState.user.id,
      authorName: authState.user.nickname || authState.user.username
    };

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commentData)
      });
      if (res.ok) {
        setNewProject('');
        setNewText('');
        setNewDimension('同比');
        fetchComments();
      }
    } catch (e) {
      alert('提交失败');
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      const info = projectInfoMap.get(editProject) || { propertyType: '未知', management: '未知' };
      const res = await fetch(`/api/comments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: editProject.trim(),
          dimension: editDimension,
          text: editText.trim(),
          period: editPeriod,
          propertyType: info.propertyType,
          management: info.management
        })
      });
      if (res.ok) {
        setEditingId(null);
        fetchComments();
      }
    } catch (e) {
      alert('更新失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条评论吗？')) return;
    try {
      const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' });
      if (res.ok) fetchComments();
    } catch (e) {
      alert('删除失败');
    }
  };

  const exportExcel = () => {
    const exportData = filteredComments.map(c => ({
      '针对项目': c.project,
      '维度': c.dimension,
      '期间': c.period,
      '管理口径': c.management,
      '业态': c.propertyType,
      '评论人': c.authorName,
      '评论内容': c.text,
      '评论日期': new Date(c.date).toLocaleString('zh-CN')
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, "评论列表");
    XLSX.writeFile(wb, `BI_Comments_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const filteredComments = comments.filter(c => {
    const matchProj = filterProject ? c.project === filterProject : true;
    const matchDim = filterDimension ? c.dimension === filterDimension : true;
    const matchPeriod = filterPeriod ? c.period === filterPeriod : true;
    const matchPropType = filterPropertyType ? c.propertyType === filterPropertyType : true;
    const matchMgt = filterManagement ? c.management === filterManagement : true;
    return matchProj && matchDim && matchPeriod && matchPropType && matchMgt;
  });

  const canEdit = (authorId: string) => {
    if (!authState.isLoggedIn || !authState.user) return false;
    return authState.user.username === 'admin' || authState.user.id === authorId;
  };

  const uniqueProjects = Array.from(new Set(comments.map(c => c.project))).sort();
  const uniqueDimensions = Array.from(new Set(comments.map(c => c.dimension))).sort();
  const uniquePeriods = Array.from(new Set(comments.map(c => c.period))).sort();
  const uniquePropertyTypes = Array.from(new Set(comments.map(c => c.propertyType))).sort();
  const uniqueManagements = Array.from(new Set(comments.map(c => c.management))).sort();

  const downloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    
    // 1. Main Sheet (Added first to be the default view)
    const worksheet = workbook.addWorksheet("评论导入模板");

    // 2. Validation Sheet (Hidden)
    const valSheet = workbook.addWorksheet('ValidationData');
    valSheet.state = 'hidden';
    
    // Populate ValidationData
    const projectsList = availableProjects.length > 0 ? availableProjects : uniqueProjects;
    projectsList.forEach((p, idx) => {
      valSheet.getCell(`A${idx + 1}`).value = p;
    });
    
    const availablePeriods = Array.from(new Set(filteredData.map(d => d.month))).sort();
    const periodsList = availablePeriods.length > 0 ? availablePeriods : (uniquePeriods.length > 0 ? uniquePeriods : [selectedMonth]);
    periodsList.forEach((p, idx) => {
      valSheet.getCell(`B${idx + 1}`).value = p;
    });

    // Configure Main Sheet
    worksheet.columns = [
      { header: '针对项目', key: 'project', width: 45 },
      { header: '维度', key: 'dimension', width: 15 },
      { header: '评论内容', key: 'text', width: 50 },
      { header: '期间', key: 'period', width: 15 }
    ];

    const instructionRow = worksheet.addRow({
      project: '*必填，请下拉选择与系统一致的项目',
      dimension: '*必填，请下拉选择',
      text: '*必填',
      period: '*必填，请下拉选择'
    });
    
    worksheet.getRow(1).font = { bold: true };
    instructionRow.font = { italic: true, color: { argb: 'FF888888' } };

    // Apply validations
    for (let i = 3; i <= 200; i++) {
      if (projectsList.length > 0) {
        worksheet.getCell(`A${i}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`ValidationData!$A$1:$A$${projectsList.length}`]
        };
      }
      
      worksheet.getCell(`B${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"同比,环比,预算,其他"']
      };
      
      if (periodsList.length > 0) {
        worksheet.getCell(`D${i}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`ValidationData!$B$1:$B$${periodsList.length}`]
        };
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "BI_Comments_Template.xlsx");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!authState.isLoggedIn || !authState.user) {
      onAuthRequired();
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        
        // Find the correct sheet or fallback to first
        const wsname = wb.SheetNames.includes("评论导入模板") ? "评论导入模板" : wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        const validRows = data.filter(row => {
          if (!row['针对项目'] || !row['维度'] || !row['评论内容'] || !row['期间']) return false;
          // Skip instruction row which starts with *
          if (row['针对项目'].toString().trim().startsWith('*')) return false;
          return true;
        });

        if (validRows.length === 0) {
          alert('未找到有效数据，请检查模板和必填项 (针对项目、维度、评论内容、期间)');
          return;
        }

        const newComments = validRows.map(row => {
          const proj = row['针对项目'].toString().trim();
          const info = projectInfoMap.get(proj) || { propertyType: '未知', management: '未知' };
          
          return {
            project: proj,
            dimension: row['维度'].toString().trim(),
            text: row['评论内容'].toString().trim(),
            period: row['期间'].toString().trim(),
            date: new Date().toISOString(),
            management: info.management,
            propertyType: info.propertyType,
            authorId: authState.user!.id,
            authorName: authState.user!.nickname || authState.user!.username
          };
        });

        const res = await fetch('/api/comments/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newComments)
        });

        if (res.ok) {
          alert(`成功导入 ${newComments.length} 条评论`);
          fetchComments();
        } else {
          alert('导入失败，请稍后重试');
        }
      } catch (err) {
        alert('解析文件出错，请确保是合法的 Excel 模板。');
      } finally {
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mt-6 print:hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-amber-500 rounded-full"></div>
          <h3 className="text-lg font-black text-slate-800">业务评论看板</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            下载模板
          </button>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImport} 
            accept=".xlsx,.xls" 
            className="hidden" 
          />
          <button 
            onClick={() => {
              if (!authState.isLoggedIn) onAuthRequired();
              else fileInputRef.current?.click();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors"
          >
            <Upload className="w-4 h-4" />
            一键导入
          </button>
          
          <button 
            onClick={exportExcel}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-colors ml-2"
          >
            <Download className="w-4 h-4" />
            导出评论
          </button>
        </div>
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-6 flex flex-col gap-3">
        <div className="flex flex-col md:flex-row gap-3">
          <select 
            value={newProject}
            onChange={e => setNewProject(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 flex-1 text-sm font-medium bg-white"
          >
            <option value="">-- 选择项目 --</option>
            {availableProjects.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select 
            value={newDimension}
            onChange={e => setNewDimension(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-bold text-slate-700 bg-white"
          >
            <option value="同比">同比</option>
            <option value="环比">环比</option>
            <option value="预算">预算</option>
            <option value="其他">其他</option>
          </select>
        </div>
        <div className="flex flex-col md:flex-row gap-3">
          <input 
            type="text" 
            placeholder="输入评论内容..."
            value={newText}
            onChange={e => setNewText(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 flex-1 text-sm font-medium"
          />
          <button 
            type="submit"
            className="flex items-center justify-center gap-2 px-6 py-2 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-colors md:w-32"
          >
            <Send className="w-4 h-4" /> 发送
          </button>
        </div>
      </form>

      {/* Table Filters */}
      <div className="flex flex-wrap gap-4 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100 items-center text-sm font-medium">
        <Filter className="w-4 h-4 text-slate-400" />
        <span className="text-slate-500 font-bold">表格筛选:</span>
        
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="bg-white border border-slate-200 rounded-md px-2 py-1 focus:outline-none max-w-[150px] truncate">
          <option value="">所有项目</option>
          {uniqueProjects.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <select value={filterDimension} onChange={e => setFilterDimension(e.target.value)} className="bg-white border border-slate-200 rounded-md px-2 py-1 focus:outline-none">
          <option value="">所有维度</option>
          {uniqueDimensions.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        
        <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} className="bg-white border border-slate-200 rounded-md px-2 py-1 focus:outline-none max-w-[100px] truncate">
          <option value="">所有期间</option>
          {uniquePeriods.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        
        <select value={filterPropertyType} onChange={e => setFilterPropertyType(e.target.value)} className="bg-white border border-slate-200 rounded-md px-2 py-1 focus:outline-none max-w-[120px] truncate">
          <option value="">所有业态</option>
          {uniquePropertyTypes.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        
        <select value={filterManagement} onChange={e => setFilterManagement(e.target.value)} className="bg-white border border-slate-200 rounded-md px-2 py-1 focus:outline-none max-w-[150px] truncate">
          <option value="">所有口径</option>
          {uniqueManagements.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Comments List (Max 10 visible ~ max-h-[600px] assuming ~60px per row) */}
      <div className="overflow-hidden border border-slate-200 rounded-xl">
        <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
          <table className="w-full text-left border-collapse whitespace-nowrap min-w-[900px]">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-3 text-slate-500 font-bold text-xs border-b border-slate-200">针对项目</th>
                <th className="p-3 text-slate-500 font-bold text-xs border-b border-slate-200">维度</th>
                <th className="p-3 text-slate-500 font-bold text-xs border-b border-slate-200 w-1/4">评论内容</th>
                <th className="p-3 text-slate-500 font-bold text-xs border-b border-slate-200">期间</th>
                <th className="p-3 text-slate-500 font-bold text-xs border-b border-slate-200">业态</th>
                <th className="p-3 text-slate-500 font-bold text-xs border-b border-slate-200">口径</th>
                <th className="p-3 text-slate-500 font-bold text-xs border-b border-slate-200">评论人</th>
                <th className="p-3 text-slate-500 font-bold text-xs border-b border-slate-200">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredComments.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors">
                  {editingId === c.id ? (
                    <>
                      <td className="p-3">
                        <select value={editProject} onChange={e=>setEditProject(e.target.value)} className="w-full border rounded px-2 py-1 text-sm bg-white">
                          <option value="">-- 选择项目 --</option>
                          {availableProjects.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </td>
                      <td className="p-3">
                        <select value={editDimension} onChange={e=>setEditDimension(e.target.value)} className="border rounded px-2 py-1 text-sm">
                          <option value="同比">同比</option>
                          <option value="环比">环比</option>
                          <option value="预算">预算</option>
                          <option value="其他">其他</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <input value={editText} onChange={e=>setEditText(e.target.value)} className="w-full border rounded px-2 py-1 text-sm"/>
                      </td>
                      <td className="p-3">
                        <select value={editPeriod} onChange={e=>setEditPeriod(e.target.value)} className="border rounded px-2 py-1 text-sm bg-white max-w-[100px] truncate">
                          {Array.from(new Set(filteredData.map(d => d.month))).sort().map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </td>
                      {(() => {
                        const info = projectInfoMap.get(editProject) || { propertyType: c.propertyType, management: c.management };
                        return (
                          <>
                            <td className="p-3 text-slate-500 text-xs truncate max-w-[100px]" title={info.propertyType}>{info.propertyType}</td>
                            <td className="p-3 text-slate-500 text-xs truncate max-w-[100px]" title={info.management}>{info.management}</td>
                          </>
                        );
                      })()}
                      <td className="p-3 text-slate-500 text-xs">{c.authorName}</td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button onClick={() => handleUpdate(c.id)} className="text-emerald-500 hover:text-emerald-700"><Check className="w-4 h-4"/></button>
                          <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4"/></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-3 text-slate-800 font-bold text-sm">{c.project}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                          c.dimension === '同比' ? 'bg-blue-50 text-blue-600' :
                          c.dimension === '环比' ? 'bg-indigo-50 text-indigo-600' :
                          c.dimension === '预算' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'
                        }`}>{c.dimension}</span>
                      </td>
                      <td className="p-3 text-slate-700 text-sm max-w-[200px] truncate" title={c.text}>{c.text}</td>
                      <td className="p-3 text-slate-500 text-xs">{c.period}</td>
                      <td className="p-3 text-slate-500 text-xs truncate max-w-[100px]" title={c.propertyType}>{c.propertyType}</td>
                      <td className="p-3 text-slate-400 text-xs truncate max-w-[100px]" title={c.management}>{c.management}</td>
                      <td className="p-3 text-slate-600 text-xs font-medium">
                        <div>{c.authorName}</div>
                        <div className="text-slate-400 scale-90 origin-left">{new Date(c.date).toLocaleDateString()}</div>
                      </td>
                      <td className="p-3">
                        {canEdit(c.authorId) && (
                          <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                setEditingId(c.id);
                                setEditProject(c.project);
                                setEditDimension(c.dimension);
                                setEditText(c.text);
                                setEditPeriod(c.period);
                              }} 
                              className="text-slate-400 hover:text-blue-600 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(c.id)}
                              className="text-slate-400 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {filteredComments.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 text-sm">
                    暂无评论数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
