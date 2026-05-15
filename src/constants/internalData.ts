import { MetricMetadata, TimeGroupMetadata } from '../types';
// Auto-generated indicators from 内置信息.xlsx
export const MAIN_INDICATORS = [
  "收入YTD",
  "2经营性采购支出",
  "3外购材料",
  "4食材耗用",
  "5物料消耗",
  "6油气管材",
  "7其他材料",
  "8外购燃料",
  "9外购动力",
  "10商旅采购成本",
  "11酒店佣金",
  "12运输费",
  "13经营性税费",
  "14油气分成支出",
  "15用工薪酬成本",
  "16外包劳务支出",
  "17维修费",
  "18租赁费",
  "19物业采暖费",
  "20绿化环境卫生费",
  "21五项费用",
  "22财产性税费",
  "23折旧折耗及摊销",
  "24其他固定成本",
  "25行政性罚款",
  "26信用减值损失",
  "27存货差额调整",
  "28财务费用",
  "29利息支出",
  "30资产处置损益",
  "31资产减值损失",
  "32营业外收支净额",
  "33投资收益",
  "34其他收益",
  "35其他非经常性损益",
  "36利润总额",
  "37所得税费用",
  "利润YTD"
];
export const OPERATING_METRICS = [
  "对标利润",
  "对标利润率",
  "经营利润率",
  "食材成本率",
  "百元收入人工成本",
  "百元收入能源成本",
  "百元收入材料成本"
];

export const TIME_SERIES_ALLOWED_METRICS = [...MAIN_INDICATORS, ...OPERATING_METRICS];
export const THREE_YEAR_BENEFIT_METRICS = [
  "目标收入",
  "目标外购材料",
  "目标薪酬及外包",
  "目标折旧摊销",
  "目标能源动力",
  "目标维修维护",
  "目标其他",
  "目标利润",
  "目标利润率",
  "目标百元收入人工成本",
  "目标百元收入能源成本",
  "目标百元收入材料成本"
];

export const BUDGET_METRICS = [
  "2026全年预算收入-内部",
  "2026全年预算利润-内部",
  "2026全年预算收入",
  "2026全年预算利润",
  "预算收入完成率",
  "预算利润完成率",
  "预算收入完成率-内部",
  "预算利润完成率-内部"
];
export const BUSINESS_METRICS = [
  "项目人数",
  "实际服务面积",
  "总服务面积",
  "用餐人数"
];

export const DEFAULT_METRICS_METADATA: MetricMetadata[] = [
  {
    "name": "收入YTD",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "2经营性采购支出",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "3外购材料",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "4食材耗用",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "5物料消耗",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "6油气管材",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "7其他材料",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "8外购燃料",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "9外购动力",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "10商旅采购成本",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "11酒店佣金",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "12运输费",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "13经营性税费",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "14油气分成支出",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "15用工薪酬成本",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "16外包劳务支出",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "17维修费",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "18租赁费",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "19物业采暖费",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "20绿化环境卫生费",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "21五项费用",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "22财产性税费",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "23折旧折耗及摊销",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "24其他固定成本",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "25行政性罚款",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "26信用减值损失",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "27存货差额调整",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "28财务费用",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "29利息支出",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "30资产处置损益",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "31资产减值损失",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "32营业外收支净额",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "33投资收益",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "34其他收益",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "35其他非经常性损益",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "36利润总额",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "37所得税费用",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "利润YTD",
    "formula": "来自数据源的直接列合计数",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "目标收入",
    "formula": "来自数据源的直接列合计数",
    "source": "calculated",
    "unit": "元"
  },
  {
    "name": "目标外购材料",
    "formula": "来自数据源的直接列合计数",
    "source": "calculated",
    "unit": "元"
  },
  {
    "name": "目标薪酬及外包",
    "formula": "来自数据源的直接列合计数",
    "source": "calculated",
    "unit": "元"
  },
  {
    "name": "目标折旧摊销",
    "formula": "来自数据源的直接列合计数",
    "source": "calculated",
    "unit": "元"
  },
  {
    "name": "目标能源动力",
    "formula": "来自数据源的直接列合计数",
    "source": "calculated",
    "unit": "元"
  },
  {
    "name": "目标维修维护",
    "formula": "来自数据源的直接列合计数",
    "source": "calculated",
    "unit": "元"
  },
  {
    "name": "目标其他",
    "formula": "来自数据源的直接列合计数",
    "source": "calculated",
    "unit": "元"
  },
  {
    "name": "目标利润",
    "formula": "来自数据源的直接列合计数",
    "source": "calculated",
    "unit": "元"
  },
  {
    "name": "2026全年预算收入-内部",
    "formula": "来自数据源的直接列合计数",
    "source": "calculated",
    "unit": "元"
  },
  {
    "name": "2026全年预算利润-内部",
    "formula": "来自数据源的直接列合计数",
    "source": "calculated",
    "unit": "元"
  },
  {
    "name": "2026全年预算收入",
    "formula": "来自数据源的直接列合计数",
    "source": "calculated",
    "unit": "元"
  },
  {
    "name": "2026全年预算利润",
    "formula": "来自数据源的直接列合计数",
    "source": "calculated",
    "unit": "元"
  },
  {
    "name": "项目人数",
    "formula": "来自数据源的直接列合计数",
    "source": "calculated",
    "unit": "元"
  },
  {
    "name": "实际服务面积",
    "formula": "来自数据源的直接列合计数",
    "source": "calculated",
    "unit": "元"
  },
  {
    "name": "总服务面积",
    "formula": "来自数据源的直接列合计数",
    "source": "calculated",
    "unit": "元"
  },
  {
    "name": "用餐人数",
    "formula": "来自数据源的直接列合计数",
    "source": "calculated",
    "unit": "元"
  },
  {
    "name": "目标利润率",
    "formula": "=目标利润/目标收入",
    "source": "calculated",
    "unit": "元"
  },
  {
    "name": "目标百元收入人工成本",
    "formula": "=目标薪酬及外包/目标收入",
    "source": "calculated",
    "unit": "元"
  },
  {
    "name": "目标百元收入能源成本",
    "formula": "=目标能源动力/目标收入",
    "source": "calculated",
    "unit": "元"
  },
  {
    "name": "目标百元收入材料成本",
    "formula": "=目标外购材料/目标收入",
    "source": "calculated",
    "unit": "元"
  },
  {
    "name": "预算收入完成率",
    "formula": "=收入YTD/2026全年预算收入",
    "source": "calculated",
    "unit": "元"
  },
  {
    "name": "预算利润完成率",
    "formula": "=(1+(利润YTD-2026全年预算利润)/ABS(2026全年预算利润))",
    "source": "calculated",
    "unit": "元"
  },
  {
    "name": "预算收入完成率-内部",
    "formula": "=收入YTD/2026全年预算收入-内部",
    "source": "calculated",
    "unit": "元"
  },
  {
    "name": "预算利润完成率-内部",
    "formula": "=(1+(利润YTD-2026全年预算利润-内部)/ABS(2026全年预算利润-内部))",
    "source": "calculated",
    "unit": "元"
  },
  {
    "name": "对标利润",
    "formula": "=IF(业态=\"酒店业务\",36利润总额+18租赁费+23折旧折耗及摊销+22财产性税费+26信用减值损失+32营业外收支净额+34其他收益+33投资收益+30资产处置损益,36利润总额+32营业外收支净额+34其他收益+33投资收益+30资产处置损益+31资产减值损失)",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "对标利润率",
    "formula": "=对标利润/收入YTD",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "食材成本率",
    "formula": "=4食材耗用/收入YTD",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "百元收入人工成本",
    "formula": "=(15用工薪酬成本+16外包劳务支出)/收入YTD",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "百元收入能源成本",
    "formula": "=(8外购燃料+9外购动力)/收入YTD",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "百元收入材料成本",
    "formula": "=3外购材料/收入YTD",
    "source": "operating",
    "unit": "元"
  },
  {
    "name": "经营利润率",
    "formula": "=利润YTD/收入YTD",
    "source": "operating",
    "unit": "元"
  }
];

export const DEFAULT_TIME_GROUPS: TimeGroupMetadata[] = [
  { name: '本年累计', formula: '', applyToAll: true },
  { name: '去年同期', formula: '', applyToAll: false },
  { name: '同比增减额', formula: '', applyToAll: false },
  { name: '同比增减率', formula: '', applyToAll: false },
  { name: '当月发生额', formula: '', applyToAll: false },
  { name: '上月发生额', formula: '', applyToAll: false },
  { name: '环比增减额', formula: '', applyToAll: false },
  { name: '环比增减率', formula: '', applyToAll: false },
];

export const DEFAULT_CATEGORIES_ORDER = [
  ...MAIN_INDICATORS,
  ...OPERATING_METRICS,
  ...THREE_YEAR_BENEFIT_METRICS,
  ...BUDGET_METRICS,
  ...BUSINESS_METRICS
];
