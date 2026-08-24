import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';

// Read CLI arguments or default to workspace values
const args = process.argv.slice(2);
const targetDir = args[0] ? path.resolve(args[0]) : '/Users/Vincent/Documents/Test/project/scratch/预算执行分析202607';
const csvPath = args[1] ? path.resolve(args[1]) : '/Users/Vincent/Documents/Test/project/scratch/重命名模版.csv';

interface Rule {
  keyword: string;
  target: string;
}

async function run() {
  if (!fs.existsSync(targetDir)) {
    throw new Error(`Target directory does not exist: ${targetDir}`);
  }
  if (!fs.existsSync(csvPath)) {
    throw new Error(`Mapping CSV template does not exist: ${csvPath}`);
  }

  console.log(`Target Directory: ${targetDir}`);
  console.log(`CSV Template Path: ${csvPath}`);

  // 1. Read and parse rules from GBK encoded CSV
  const csvBuffer = fs.readFileSync(csvPath);
  const csvContent = new TextDecoder('gbk').decode(csvBuffer);
  const lines = csvContent.split(/\r?\n/);
  const rules: Rule[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('原文件名包含元素')) {
      continue;
    }
    const parts = trimmed.split(',');
    if (parts.length >= 2) {
      rules.push({
        keyword: parts[0].trim(),
        target: parts[1].trim()
      });
    }
  }

  console.log('Parsed Rules:', rules);

  // 2. Read excel files
  const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.xlsx'));
  console.log('Found files to process:', files);

  if (files.length === 0) {
    console.log('No Excel (.xlsx) files found in the directory.');
    return;
  }

  // 3. Process each file (clear numbers)
  for (const file of files) {
    const filePath = path.join(targetDir, file);
    console.log(`Clearing numbers in: ${file}`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    workbook.worksheets.forEach(sheet => {
      sheet.eachRow({ includeEmpty: true }, (row) => {
        row.eachCell({ includeEmpty: true }, (cell) => {
          if (cell.type === ExcelJS.ValueType.Number) {
            cell.value = null;
          } else if (cell.type === ExcelJS.ValueType.Formula) {
            const val = cell.value;
            if (val && typeof val === 'object' && 'result' in val) {
              if (typeof val.result === 'number') {
                cell.value = null;
              }
            }
          }
        });
      });
    });

    await workbook.xlsx.writeFile(filePath);
    console.log(`Cleared and saved: ${file}`);
  }

  // 4. Map files to targets and group them
  const groups = new Map<string, string[]>();
  const unmatched: string[] = [];

  for (const file of files) {
    let matchedRule: Rule | null = null;
    for (const rule of rules) {
      if (file.includes(rule.keyword)) {
        matchedRule = rule;
        break;
      }
    }

    if (matchedRule) {
      const list = groups.get(matchedRule.target) || [];
      list.push(file);
      groups.set(matchedRule.target, list);
    } else {
      unmatched.push(file);
    }
  }

  console.log('\nGrouping results:');
  groups.forEach((list, target) => {
    console.log(`Target [${target}]:`, list);
  });
  if (unmatched.length > 0) {
    console.warn('Warning: Unmatched files:', unmatched);
  }

  // 5. Generate rename operations
  const renameOps: { from: string; to: string }[] = [];

  groups.forEach((fileList, targetBase) => {
    if (fileList.length === 1) {
      renameOps.push({
        from: fileList[0],
        to: `${targetBase}.xlsx`
      });
    } else {
      fileList.forEach((file, index) => {
        const suffix = index === 0 ? '' : `${index}`;
        renameOps.push({
          from: file,
          to: `${targetBase}${suffix}.xlsx`
        });
      });
    }
  });

  // 6. Perform renaming in two stages using temp names to avoid collisions
  console.log('\nRenaming files...');
  console.log('Stage 1: Renaming to temporary names...');
  const tempRenameOps = renameOps.map((op, index) => {
    const tempName = `_temp_rename_${index}_${op.to}`;
    fs.renameSync(path.join(targetDir, op.from), path.join(targetDir, tempName));
    return { tempName, finalName: op.to };
  });

  console.log('Stage 2: Renaming to final names...');
  for (const op of tempRenameOps) {
    fs.renameSync(path.join(targetDir, op.tempName), path.join(targetDir, op.finalName));
    console.log(`Renamed file to: ${op.finalName}`);
  }

  console.log('\nProcessing completed successfully!');
}

run().catch(console.error);
