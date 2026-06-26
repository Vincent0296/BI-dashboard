import ExcelJS from 'exceljs';

async function test() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('模版.xlsx');
  
  const templateSheet = workbook.getWorksheet('项目1');
  if (!templateSheet) {
    throw new Error('Template sheet 项目1 not found');
  }

  // Create a new sheet
  const newSheet = workbook.addWorksheet('测试项目A');
  
  // Copy columns
  newSheet.columns = templateSheet.columns.map(col => ({
    width: col.width,
    style: col.style
  }));

  // Copy rows and cells
  for (let r = 1; r <= templateSheet.rowCount; r++) {
    const srcRow = templateSheet.getRow(r);
    const destRow = newSheet.getRow(r);
    destRow.height = srcRow.height;
    
    for (let c = 1; c <= templateSheet.columnCount; c++) {
      const srcCell = srcRow.getCell(c);
      const destCell = destRow.getCell(c);
      destCell.value = srcCell.value;
      destCell.style = srcCell.style;
    }
  }

  console.log('Original sheets:', workbook.worksheets.map(w => w.name));
  
  // Remove template sheets
  workbook.removeWorksheet('项目1');
  workbook.removeWorksheet('项目2');
  
  console.log('After removal sheets:', workbook.worksheets.map(w => w.name));
  
  await workbook.xlsx.writeFile('scratch_test_output.xlsx');
  console.log('Successfully saved scratch_test_output.xlsx');
}

test().catch(console.error);
