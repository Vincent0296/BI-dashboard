import xlsx from 'xlsx';
import path from 'path';

const filePath = '/Users/Vincent/Documents/Test/project/模版.xlsx';
const workbook = xlsx.readFile(filePath);

const sheet = workbook.Sheets['项目1'];
const ref = sheet['!ref'];
const range = xlsx.utils.decode_range(ref);

console.log('Printing all rows for 项目1:');
for (let r = range.s.r; r <= range.e.r; r++) {
  const row = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cellRef = xlsx.utils.encode_cell({ r, c });
    const cell = sheet[cellRef];
    row.push(cell ? String(cell.v).trim() : '');
  }
  console.log(`Row ${r + 1}:`, row.join(' | '));
}
