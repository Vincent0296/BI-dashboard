import ExcelJS from 'exceljs';

async function check() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('模版.xlsx');
  const ws = workbook.getWorksheet('项目1');
  
  // Inspect column B row 2-10 cell styles
  for (let r = 2; r <= 10; r++) {
    const cell = ws.getCell(`B${r}`);
    console.log(`Row ${r}: value=${cell.value}, numFmt=${cell.numFmt}, font=${JSON.stringify(cell.font)}`);
  }
}

check().catch(console.error);
