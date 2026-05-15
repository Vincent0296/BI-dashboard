import React from 'react';
import { X, BookOpen, Filter, MousePointerClick, Download, Settings2, BarChart2, MessageSquareText } from 'lucide-react';

interface HelpModalProps {
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
              <BookOpen className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-black text-slate-800">系统使用技巧与指南</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 bg-white space-y-8">
          
          <section>
            <div className="flex items-center gap-2 mb-3 text-indigo-600">
              <Filter className="w-5 h-5" />
              <h3 className="font-bold text-lg">1. 灵活运用筛选方案</h3>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed ml-7">
              在左侧的过滤器中，你可以保存常用的筛选组合（产权口径、业态等）。点击<strong className="text-slate-800">“保存当前方案”</strong>，即可命名并存储。在“预设方案”下拉菜单中，随时一键切换场景，被选中的方案会<strong className="text-slate-800">高亮显示</strong>；如果你手动微调了切片器，高亮会自动取消，提示你已偏离该预设。
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3 text-emerald-600">
              <MousePointerClick className="w-5 h-5" />
              <h3 className="font-bold text-lg">2. 独创的下钻分析（Drill-down）</h3>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed ml-7 mb-3">
              仪表盘不仅提供大盘预览，更支持深度拆解：
            </p>
            <ul className="list-disc text-slate-600 text-sm ml-12 space-y-2">
              <li>在<strong className="text-slate-800">柱状图或饼图</strong>中点击图表区块，或者在<strong className="text-slate-800">折线图</strong>上点击数据节点，即可在下方唤出详细的“维度拆解表”。</li>
              <li>在拆解表中，支持随时切换<strong className="text-slate-800">列维度</strong>（产权、管理、业态、项目），系统会自动计算升序排列。</li>
              <li>横向数据过长时，可使用快捷按钮一键跳到首尾。</li>
            </ul>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3 text-amber-600">
              <Settings2 className="w-5 h-5" />
              <h3 className="font-bold text-lg">3. 灵活的数据展示模式</h3>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed ml-7">
              在右侧财务指标图表的顶部，我们提供了一个<strong className="text-slate-800">“整数模式”</strong>开关。你可以一键将庞大的财务数据脱水，去除小数位，让汇报界面更加清爽直观；随时关闭即可恢复精确的小数点模式。
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3 text-blue-600">
              <Download className="w-5 h-5" />
              <h3 className="font-bold text-lg">4. 全场景的导出支持</h3>
            </div>
            <ul className="list-disc text-slate-600 text-sm ml-12 space-y-2">
              <li><strong className="text-slate-800">导出 Excel</strong>：主页面和下钻拆解表分别配备了独立的导出按钮，不仅导出的数据结构会自动转置以方便汇报，还会自动附带一张《数据说明》的页签，记录导出时的筛选条件，防范口径歧义。</li>
              <li><strong className="text-slate-800">保存 PDF</strong>：点击图表下方的保存 PDF，系统会自动隐去多余的操作按钮，提供一张纯粹、可直接用于 PPT 报告的图表截图。</li>
            </ul>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3 text-purple-600">
              <BarChart2 className="w-5 h-5" />
              <h3 className="font-bold text-lg">5. 深度多维分析表（核心更新）</h3>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed ml-7 mb-3">
              系统配备了专为复杂财务场景设计的“多维性能矩阵”，支持极高自由度的探索：
            </p>
            <ul className="list-disc text-slate-600 text-sm ml-12 space-y-2">
              <li><strong className="text-slate-800">二级维度钻取</strong>：在 Y 轴维度选择器中开启“二级维度”，即可实现嵌套钻取展示（如：业态 + 产权口径），系统会自动合并单元格。</li>
              <li><strong className="text-slate-800">行列一键互换 (Axis Swap)</strong>：点击按钮可一键切换“指标优先”或“计算项优先”视图，满足不同汇报需求。</li>
              <li><strong className="text-slate-800">指标全量管控</strong>：支持跨计算组多选指标，并配备一键“全选”与“清空”按钮。</li>
            </ul>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3 text-blue-600">
              <Download className="w-5 h-5" />
              <h3 className="font-bold text-lg">6. 专家级 PDF 报告导出</h3>
            </div>
            <ul className="list-disc text-slate-600 text-sm ml-12 space-y-2">
              <li><strong className="text-slate-800">智能横向分页</strong>：针对指标过多的“超宽表”，系统会自动切片分页导出 PDF，彻底告别文字模糊。</li>
              <li><strong className="text-slate-800">页脚合计行固定</strong>：打印出的每一页 PDF 底部都会自动重复显示“合计行”，方便跨页查看汇总。</li>
              <li><strong className="text-slate-800">纯净模式</strong>：自动隐去所有交互按钮，仅保留专业的报表视图。</li>
            </ul>
          </section>

          <section className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2 mb-3 text-indigo-600">
              <Settings2 className="w-5 h-5" />
              <h3 className="font-bold text-lg">7. 指标精度与趋势纠偏</h3>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed ml-7">
              为保证财务报表的专业性，系统对增长率/完成率进行了特殊处理：
              <br />• <strong className="text-slate-800">1位小数精度</strong>：默认显示 1 位小数，确保微小变动可见。
              <br />• <strong className="text-slate-800">趋势纠偏</strong>：若计算结果极小但非零（如 0.02%），将显示为 <strong className="text-slate-800">0.1%</strong>。
              <br />• <strong className="text-slate-800">极值封顶</strong>：极端离群值（&gt;10000%）将显示为 <strong className="text-slate-800">10000%+</strong>。
            </p>
          </section>

        </div>
        
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 active:scale-95"
          >
            我已了解，开始探索
          </button>
        </div>
      </div>
    </div>
  );
};
