import ExcelJS from 'exceljs';
import path from 'path';

const filePath = '/Users/Vincent/Documents/Test/project/模版.xlsx';
const workbook = new ExcelJS.Workbook();

async function inspect() {
  await workbook.xlsx.readFile(filePath);
  const ws = workbook.getWorksheet('项目1');
  
  // A2 cell
  const cellA2 = ws.getCell('A2');
  console.log('Cell A2 value:', cellA2.value);
  console.log('Cell A2 style:', JSON.stringify({
    font: cellA2.font,
    fill: cellA2.fill,
    border: cellA2.border,
    alignment: cellA2.alignment,
    numFmt: cellA2.numFmt
  }, null, 2));

  // B1 cell
  const cellB1 = ws.getCell('B1');
  console.log('Cell B1 value:', cellB1.value);
  console.log('Cell B1 style:', JSON.stringify({
    font: cellB1.font,
    fill: cellB1.fill,
    border: cellB1.border,
    alignment: cellB1.alignment,
    numFmt: cellB1.numFmt
  }, null, 2));
}

inspect().catch(console.error);
