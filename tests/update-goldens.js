/**
 * Regenerates the golden .nc1 files from the current generator output.
 *
 * Run ONLY when an output change is intentional (a fix or new feature),
 * and review the git diff of tests/golden/ before committing — the diff
 * IS the record of what the change did to machine output.
 *
 * Usage: npm run update-goldens
 */
const fs = require('fs');
const { generate, listFixtures, GOLDEN_DIR } = require('./lib/load.js');

fs.mkdirSync(GOLDEN_DIR, { recursive: true });

for (const { name, fixture, goldenPath } of listFixtures()) {
    const output = generate(fixture);
    const existed = fs.existsSync(goldenPath);
    const changed = !existed || fs.readFileSync(goldenPath, 'utf8') !== output;
    fs.writeFileSync(goldenPath, output);
    console.log(`${changed ? (existed ? 'UPDATED  ' : 'CREATED  ') : 'unchanged'} ${name}.nc1`);
}
