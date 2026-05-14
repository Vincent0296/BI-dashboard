import * as XLSX from 'xlsx';
import * as fs from 'fs';

const buf = fs.readFileSync('内置信息.xlsx');
const workbook = XLSX.read(buf, { type: 'buffer' });
const ws = workbook.Sheets['度量值'];
const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

const groups = new Set(data.slice(1).map(row => row[3]));
console.log('Groups found:', Array.from(groups));
