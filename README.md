# 财务 BI 分析仪表盘 (Financial BI Dashboard)

这是一个面向企业级财务分析的轻量化、高性能 BI 仪表盘系统，支持从数据清洗、多维过滤、交互式可视化到协同分析的完整闭环体验。

## 核心功能 (Core Features)

### 📊 1. 动态图表与下钻分析 (Interactive Dashboards)
- **多维指标透视**：支持本年累计、去年同期、同比、环比、预算达成率等 8 大财务视角。
- **逐级下钻 (Drill-down)**：点击柱状图数据柱，可一键在底部表格唤出针对该项财务数据的横向和纵向多维度拆解详情。
- **自定义筛选视图**：提供类似 Excel 的数据切片器，支持自由组合期间、业态、口径、项目，并可“保存预设方案”。

### 📝 2. 业务评论看板 (Business Comments Board)
- **多维联动筛查**：通过全量下拉框过滤历史评论，轻松定位到特定项目或月份的批注记录。
- **智能上下文补全**：在线修改单条评论或填报时，修改“针对项目”，系统会自动匹配并修正对应的“业态”与“管理口径”，实现零差错数据录入。
- **一键导入与导出**：
  - **模板下载**：基于 `exceljs` 生成原生包含下拉列表校验规则的官方 Excel 模板。
  - **极速导入**：智能过滤空行与说明文本，完美支持基于 Excel 的大规模批量批注上报。

### 📄 3. 极客级的导出体验 (Export & Reporting)
- **Excel 转换**：底层数据表格支持一键转置并导出 Excel，附带《数据说明》页签，防范口径歧义。
- **PDF 纯净截图**：提供一键隐去交互按钮、只保留图表与关键数据的防糊 PDF 保存方案，完美适配 PPT 汇报场景。

---

## 技术栈 (Tech Stack)

- **前端**：React 19 + TypeScript + Vite + Tailwind CSS
- **图表与展示**：Recharts / Chart.js
- **文档生态**：SheetJS (XLSX) / ExcelJS / FileSaver.js
- **后端**：Express + Node.js (提供用于评论持久化和权限管控的轻量 RESTful API)

---

## 本地部署与运行 (Getting Started)

### 前置要求
确保本地已安装 [Node.js](https://nodejs.org/) (推荐 v18+)。

### 安装与启动

1. **安装所有依赖**
   ```bash
   npm install
   ```

2. **启动全栈开发环境 (推荐)**
   该指令将同时启动 Vite 前端热更新服务与 Node 后端数据接口服务：
   ```bash
   npm run dev:full
   ```
   > 访问地址：http://localhost:3000

3. 如果只需要打包生产环境：
   ```bash
   npm run build
   ```

---

## 数据源规范 (Data Specification)

- 系统的指标图表主要依赖于 `Dashboard` 内解析的本地 Excel 报表或 JSON 数据结构。
- 评论数据会通过本地 API 持久化存储在项目根目录下的 `/data/comments.json` 以及关联的用户信息表 `/data/users.json` 中。
