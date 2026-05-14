import * as XLSX from 'xlsx';
import * as fs from 'fs';

const buf = fs.readFileSync('内置信息.xlsx');
const workbook = XLSX.read(buf, { type: 'buffer' });

const sheetName = '度量值';
const ws = workbook.Sheets[sheetName];
if (!ws) {
  console.error(`Sheet "${sheetName}" not found!`);
  process.exit(1);
}

const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
// Skip header row if exists, but let's see the first 5 rows first
console.log('Sample Rows:');
data.slice(0, 10).forEach((row, i) => console.log(`Row ${i}:`, row));
