import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');
const webDir = path.resolve('public/powershell/web');

if (fs.existsSync(distDir)) {
  if (fs.existsSync(webDir)) {
    fs.rmSync(webDir, { recursive: true, force: true });
  }
  fs.mkdirSync(webDir, { recursive: true });

  // Copy dist/index.html
  const indexPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    fs.copyFileSync(indexPath, path.join(webDir, 'index.html'));
  }

  // Copy dist/assets
  const distAssets = path.join(distDir, 'assets');
  const webAssets = path.join(webDir, 'assets');
  if (fs.existsSync(distAssets)) {
    fs.cpSync(distAssets, webAssets, { recursive: true });
  }

  console.log('[+] Successfully synchronized compiled React web app to public/powershell/web/');
}
