import * as XLSX from 'xlsx';
import * as fs from 'fs';

const buf = fs.readFileSync('内置信息.xlsx');
const workbook = XLSX.read(buf, { type: 'buffer' });
const ws = workbook.Sheets['度量值'];
const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

const metrics = data.slice(1).map(row => ({
  source: row[0],
  name: row[1],
  formula: row[2],
  group: row[3],
  applyCalcGroup: row[4] === '是'
})).filter(m => m.name);

const mainIndicators = metrics.filter(m => m.group === '利润表项目').map(m => m.name);
const operatingMetrics = metrics.filter(m => m.group === '经营指标').map(m => m.name);
// Updated group name check
const threeYearMetrics = metrics.filter(m => m.group === '预算或三年达标指标' || m.group === '预算及三年达标指标').map(m => m.name);
const businessMetrics = metrics.filter(m => m.group === '业务指标').map(m => m.name);

console.log('// Auto-generated indicators from 内置信息.xlsx');
console.log('export const MAIN_INDICATORS = ' + JSON.stringify(mainIndicators, null, 2) + ';');
console.log('export const OPERATING_METRICS = ' + JSON.stringify(operatingMetrics, null, 2) + ';');
console.log('export const THREE_YEAR_BENEFIT_METRICS = ' + JSON.stringify(threeYearMetrics, null, 2) + ';');
console.log('export const BUSINESS_METRICS = ' + JSON.stringify(businessMetrics, null, 2) + ';');

const metadata = metrics.map(m => ({
  name: m.name,
  formula: m.formula,
  source: m.applyCalcGroup ? 'operating' : 'calculated',
  unit: '元'
}));

console.log('\nexport const DEFAULT_METRICS_METADATA: MetricMetadata[] = ' + JSON.stringify(metadata, null, 2) + ';');
