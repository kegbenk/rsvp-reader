import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const rootConfigPath = path.resolve('capacitor.config.json');
const iosConfigPath = path.resolve('ios', 'App', 'App', 'capacitor.config.json');

const requiredPackageClassList = [
  'FileViewerPlugin.FileViewerPlugin',
  'FilesystemPlugin.FilesystemPlugin',
  'FolioReaderPlugin.FolioReaderPlugin'
];

async function loadJson(filePath) {
  const data = await readFile(filePath, 'utf8');
  return JSON.parse(data);
}

async function main() {
  const rootConfig = await loadJson(rootConfigPath);
  const iosConfig = await loadJson(iosConfigPath);

  const nextList = rootConfig.packageClassList ?? requiredPackageClassList;

  iosConfig.packageClassList = nextList;

  await writeFile(iosConfigPath, JSON.stringify(iosConfig, null, 2) + '\n');

  console.log('[fix-capacitor-config] iOS capacitor.config.json updated.');
}

main().catch((error) => {
  console.error('[fix-capacitor-config] Failed:', error);
  process.exit(1);
});
