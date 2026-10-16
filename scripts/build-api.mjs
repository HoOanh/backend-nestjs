import { build } from 'esbuild';

await build({
  entryPoints: {
    index: 'server/index.ts',
    tutor: 'server/tutor.ts',
    tts: 'server/zerotts-api.ts',
    'tts-stream': 'server/zerotts-stream-api.ts'
  },
  outdir: 'api',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external'
});
