/**
 * Golden-file regression tests for the NC1 generator.
 *
 * Each fixture in tests/fixtures/ is a saved Part definition; the
 * generated output must match tests/golden/<name>.nc1 byte for byte.
 * When a change to output is intentional, run `npm run update-goldens`
 * and review the golden diff.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { generate, listFixtures } = require('./lib/load.js');

/**
 * Parse AK/IK contour blocks out of NC1 text.
 * Returns [{ type, points: [{x, y}] }].
 * Contour point lines carry X then Y as the first two decimal numbers.
 */
function parseContours(nc1) {
    const contours = [];
    let current = null;
    for (const line of nc1.split('\n')) {
        const trimmed = line.trim();
        if (trimmed === 'AK' || trimmed === 'IK') {
            current = { type: trimmed, points: [] };
            contours.push(current);
            continue;
        }
        if (/^(ST|EN|BO|SI|KO)$/.test(trimmed)) {
            current = null;
            continue;
        }
        if (current) {
            const nums = line.match(/-?\d+\.\d+/g);
            if (nums && nums.length >= 2) {
                current.points.push({ x: parseFloat(nums[0]), y: parseFloat(nums[1]) });
            }
        }
    }
    return contours;
}

for (const { name, fixture, goldenPath } of listFixtures()) {
    const output = generate(fixture);

    test(`${name}: matches golden file`, () => {
        assert.ok(fs.existsSync(goldenPath),
            `Missing golden file for ${name}. Run: npm run update-goldens`);
        assert.strictEqual(output, fs.readFileSync(goldenPath, 'utf8'),
            `Output changed for ${name}. If intentional, run npm run update-goldens and review the diff.`);
    });

    test(`${name}: structural invariants`, () => {
        assert.ok(output.startsWith('ST\n'), 'must start with ST block');
        assert.ok(output.endsWith('EN\n'), 'must end with EN block');
        for (const bad of ['NaN', 'Infinity', 'undefined', 'null']) {
            assert.ok(!output.includes(bad), `output contains "${bad}"`);
        }
    });

    test(`${name}: contours are closed`, () => {
        const contours = parseContours(output);
        for (const c of contours) {
            if (c.points.length < 3) continue;
            const first = c.points[0];
            const last = c.points[c.points.length - 1];
            assert.ok(
                Math.abs(first.x - last.x) < 0.02 && Math.abs(first.y - last.y) < 0.02,
                `${c.type} contour not closed: starts (${first.x}, ${first.y}), ends (${last.x}, ${last.y})`
            );
        }
    });
}
