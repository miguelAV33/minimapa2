// Prepara la carpeta www/ que Capacitor mete dentro del APK.
// Variables de entorno opcionales (las pone GitHub Actions):
//   VERSION_NAME  1.1.42        VERSION_CODE  42
//   REMOTE_BASE   https://usuario.github.io/minimapa/   (de ahí la app descarga radares y precios actualizados)
//   REPO          usuario/minimapa                       (para avisar de versiones nuevas del APK)
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'www');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const items = ['index.html', 'car.html', 'manifest.webmanifest', 'css', 'js', 'vendor', 'fonts', 'icons'];
for (const it of items) cpSync(join(root, it), join(out, it), { recursive: true });
mkdirSync(join(out, 'data'), { recursive: true });
for (const f of ['radares.json', 'gasolineras.json', 'zbe.json']) {
  const p = join(root, 'data', f);
  if (existsSync(p)) cpSync(p, join(out, 'data', f));
}

const build = {
  version: process.env.VERSION_NAME || pkg.version,
  code: Number(process.env.VERSION_CODE || 0),
  remoteBase: process.env.REMOTE_BASE || '',
  repo: process.env.REPO || '',
  native: true,
  builtAt: new Date().toISOString(),
};
writeFileSync(join(out, 'js', 'build-info.js'), `// Generado por scripts/build-web.mjs\nexport const BUILD = ${JSON.stringify(build, null, 2)};\n`);
console.log('www/ listo:', build);
