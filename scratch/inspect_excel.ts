import * as XLSX from 'xlsx';
import * as fs from 'fs';

const buf = fs.readFileSync('导入表.xlsx');
const workbook = XLSX.read(buf, { type: 'buffer' });

console.log('Sheets:', workbook.SheetNames);

workbook.SheetNames.forEach(name => {
  console.log('\n--- Sheet:', name, '---');
  const ws = workbook.Sheets[name];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  console.log('First 5 rows:');
  data.slice(0, 5).forEach((row, i) => {
    console.log(`Row ${i + 1}:`, row);
  });
});
