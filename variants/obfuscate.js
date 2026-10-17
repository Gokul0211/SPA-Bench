// obfuscate.js JOBS.json: [{ "in": "path", "out": "path" }, ...]; level from argv[3]: low | medium | high
// Deterministic: fixed seed per file (seed = 1 + index), so a rebuild gives the same variant.
const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const level = process.argv[3] || 'medium';
const PRESETS = { low: 'low-obfuscation', medium: 'medium-obfuscation', high: 'high-obfuscation' };
if (!PRESETS[level]) throw new Error('level must be low | medium | high');

let ok = 0;
const failed = [];
jobs.forEach((job, i) => {
  try {
    const code = fs.readFileSync(job.in, 'utf8');
    const result = JavaScriptObfuscator.obfuscate(code, {
      optionsPreset: PRESETS[level],
      seed: i + 1,
      sourceMap: false,
      target: 'browser',
    });
    fs.mkdirSync(path.dirname(job.out), { recursive: true });
    fs.writeFileSync(job.out, result.getObfuscatedCode());
    ok += 1;
  } catch (e) {
    failed.push({ file: job.in, error: String(e.message || e).slice(0, 200) });
  }
});
process.stdout.write(JSON.stringify({ level, ok, failed }));
