import fs from 'fs';
import path from 'path';

const TOKEN = "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";
const OWNER = "Vincent0296";
const REPO = "BI-dashboard";
const BRANCH = "main";

const filesToPush = [
  "vite.config.ts",
  "src/components/Dashboard.tsx",
  "src/components/MultiDimTable.tsx"
];

async function getFileSha(filePath) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}?ref=${BRANCH}`;
  try {
    const res = await fetch(url, {
      headers: {
        "Authorization": `token ${TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Antigravity-Agent"
      }
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Failed to get SHA: ${res.statusText}`);
    }
    const data = await res.json();
    return data.sha;
  } catch (err) {
    console.error(`Error getting SHA for ${filePath}:`, err);
    return null;
  }
}

async function pushFile(filePath) {
  const localPath = path.resolve(filePath);
  const contentBytes = fs.readFileSync(localPath);
  const contentB64 = contentBytes.toString('base64');
  
  const sha = await getFileSha(filePath);
  
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;
  const payload = {
    message: `feat: add batch export by caliber and serve template configuration for ${filePath}`,
    content: contentB64,
    branch: BRANCH
  };
  if (sha) {
    payload.sha = sha;
  }
  
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      "Authorization": `token ${TOKEN}`,
      "Content-Type": "application/json",
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "Antigravity-Agent"
    },
    body: JSON.stringify(payload)
  });
  
  if (res.ok) {
    console.log(`Successfully pushed ${filePath}`);
  } else {
    const text = await res.text();
    console.error(`Failed to push ${filePath}:`, text);
  }
}

async function main() {
  for (const file of filesToPush) {
    await pushFile(file);
  }
}

main().catch(console.error);
