// Solmarina — the gta6-01 hand-in program (Node 22, standard library only).
//
// The game itself is the plain static folder game/ next to this file: an
// index.html page plus ES modules, no libraries, no network requests, fully
// playable in a desktop browser offline. This program's only job is to hand
// it in: copy game/ and screenshots/ into the output directory and write
// dossier.json, the summary the judge reads, using the vendored make.fun
// library in vendor/ (a kit copy, left byte-identical).
//
// Local run:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Local play: node serve.ts, then open http://localhost:8080 in a browser.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
const shotDir = join(repoRoot, 'screenshots');
if (existsSync(shotDir)) cpSync(shotDir, join(outputDir, 'screenshots'), { recursive: true });

// The gate caps from reference/gate.json, enforced here so an entry the
// scorer would refuse fails loudly at build time instead: at most 4
// screenshots, each at most 256 KiB; game/ at most 993 entries and 48 MiB
// in total, with no path under game/ longer than 1000 bytes.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
