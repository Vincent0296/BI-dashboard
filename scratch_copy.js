import fs from 'fs';
import path from 'path';

try {
  const src = path.resolve('模版.xlsx');
  const dest = path.resolve('public', '模版.xlsx');
  
  console.log('Reading source file...');
  const data = fs.readFileSync(src);
  console.log('Source file read successfully, size:', data.length);
  
  console.log('Writing to destination...');
  fs.writeFileSync(dest, data);
  console.log('Successfully wrote to public/模版.xlsx');
} catch (err) {
  console.error('Operation failed:', err);
}
