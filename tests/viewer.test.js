/**
 * Round-trip tests for the NC1 viewer parser: every golden file must parse
 * back into sane per-face geometry. This is what the app's "NC1 View" tab
 * relies on to draw the generated output.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { listFixtures } = require('./lib/load.js');
const { NC1Viewer } = require('../js/nc1-viewer.js');

for (const { name, goldenPath } of listFixtures()) {
    test(`${name}: NC1 parses into closed per-face contours`, () => {
        const parsed = NC1Viewer.parse(fs.readFileSync(goldenPath, 'utf8'));
        const faces = Object.keys(parsed.faces);
        assert.ok(faces.length > 0, 'no faces parsed');

        let contourCount = 0;
        for (const face of faces) {
            for (const c of parsed.faces[face].contours) {
                contourCount++;
                assert.ok(c.points.length >= 4, `${face} ${c.type} contour has only ${c.points.length} points`);
                const first = c.points[0];
                const last = c.points[c.points.length - 1];
                assert.ok(
                    Math.abs(first.x - last.x) < 0.02 && Math.abs(first.y - last.y) < 0.02,
                    `${face} ${c.type} contour not closed`
                );
            }
        }
        assert.ok(contourCount > 0, 'no contours parsed');
    });
}
