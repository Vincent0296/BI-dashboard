const { execSync } = require('child_process');
try {
  const diff = execSync('git diff', { encoding: 'utf8' });
  console.log(diff);
} catch (err) {
  console.error(err);
}
