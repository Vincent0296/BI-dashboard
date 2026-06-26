import fs from 'fs';
import path from 'path';

const filesToClean = [
  'scratch_inspect.js',
  'scratch_inspect_exceljs.js',
  'scratch_test_exceljs_operations.js',
  'scratch_inspect_numfmt.js',
  'scratch_test_jszip.js',
  'scratch_copy.js'
];

filesToClean.forEach(file => {
  try {
    const filePath = path.resolve(file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Successfully removed ${file}`);
    }
  } catch (err) {
    console.error(`Failed to remove ${file}:`, err);
  }
});
