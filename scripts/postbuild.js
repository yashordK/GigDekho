import fs from 'fs';
import path from 'path';

const src = path.resolve('public');
const dest = path.resolve('build/client');

try {
  fs.cpSync(src, dest, { recursive: true });
  console.log('Successfully copied public assets to build/client');
} catch (err) {
  console.error('Error copying public assets:', err);
  process.exit(1);
}
