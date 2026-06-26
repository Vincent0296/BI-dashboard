const { execSync } = require('child_process');
try {
  console.log('Running git status...');
  console.log(execSync('git status', { encoding: 'utf8' }));

  console.log('Running git add...');
  execSync('git add src/components/Dashboard.tsx src/components/MultiDimTable.tsx vite.config.ts', { stdio: 'inherit' });

  console.log('Running git status after add...');
  console.log(execSync('git status', { encoding: 'utf8' }));
} catch (err) {
  console.error(err);
}
