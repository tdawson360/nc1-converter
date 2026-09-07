/**
 * Tests for PartTransform (mirror / duplicate).
 * Mirrors are reflections: applying the same one twice must give the
 * original back, and the mirrored part must still generate valid NC1.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { generate, listFixtures } = require('./lib/load.js');
const models = require('../js/models.js');
globalThis.Part = models.Part;   // part-transform.js reads the browser global
const { PartTransform } = require('../js/part-transform.js');

const stripIds = (part) => {
    const j = JSON.parse(JSON.stringify(part.toJSON ? part.toJSON() : part));
    delete j.id; delete j.createdDate; delete j.modifiedDate; delete j.partMark;
    return j;
};
const isAngle = (p) => /^ANGLE/.test(p.shape.profileType);

for (const { name, fixture } of listFixtures()) {
    const original = models.Part.fromJSON(JSON.parse(JSON.stringify(fixture)));

    test(`${name}: mirrorEnds twice returns the original`, () => {
        const once = PartTransform.mirrorEnds(original).part;
        const twice = PartTransform.mirrorEnds(once).part;
        assert.deepStrictEqual(stripIds(twice), stripIds(original));
        assert.notStrictEqual(once.id, original.id, 'mirror must get a new id');
        assert.strictEqual(once.partMark, original.partMark + '-M');
        // Input untouched
        assert.deepStrictEqual(stripIds(original), stripIds(models.Part.fromJSON(JSON.parse(JSON.stringify(fixture)))));
    });

    test(`${name}: mirrorEnds output generates closed, finite NC1`, () => {
        const out = generate(PartTransform.mirrorEnds(original).part.toJSON());
        assert.ok(out.startsWith('ST\n') && out.endsWith('EN\n'));
        for (const bad of ['NaN', 'Infinity', 'undefined', 'null']) assert.ok(!out.includes(bad), bad);
    });

    if (isAngle(original)) {
        test(`${name}: flipNearFar refuses angles`, () => {
            const r = PartTransform.flipNearFar(original);
            assert.strictEqual(r.part, null);
            assert.ok(r.warnings.length > 0);
        });
    } else {
        test(`${name}: flipNearFar twice returns the original`, () => {
            const once = PartTransform.flipNearFar(original).part;
            const twice = PartTransform.flipNearFar(once).part;
            assert.deepStrictEqual(stripIds(twice), stripIds(original));
        });

        test(`${name}: flipNearFar output generates finite NC1`, () => {
            const out = generate(PartTransform.flipNearFar(original).part.toJSON());
            assert.ok(out.startsWith('ST\n') && out.endsWith('EN\n'));
            for (const bad of ['NaN', 'Infinity', 'undefined', 'null']) assert.ok(!out.includes(bad), bad);
        });
    }
}

test('mirrorEnds: X positions, end conditions, copes and notches swap ends', () => {
    const p = models.Part.fromJSON({
        partMark: 'T1', shape: { profileType: 'HSS_RECT', designation: 'x', dimensions: { height: 6, width: 4, tdes: 0.233 } },
        length: 48,
        operations: [
            { type: 'endConditionLeft', cutType: 'miter', webAngle: 30, longPointLocation: 'near' },
            { type: 'hole', face: 'v', x: 6, y: 2, diameter: 0.8125 },
            { type: 'slot', face: 'o', x: 10, y: 1, length: 2, width: 0.8125, angle: 90 },
            { type: 'cope', end: 'right', location: 'top', depth: 1, length: 3, radius: 0 },
            { type: 'notch', location: 'bottom', x: 20, width: 2, depth: 1 }
        ]
    });
    const m = PartTransform.mirrorEnds(p).part;
    const ops = m.operations;
    assert.strictEqual(ops[0].type, 'endConditionRight');
    assert.strictEqual(ops[0].longPointLocation, 'near', 'near/far must not change on an end swap');
    assert.strictEqual(ops[1].x, 42);
    assert.strictEqual(ops[1].y, 2);
    assert.strictEqual(ops[2].x, 38);
    assert.strictEqual(ops[3].end, 'left');
    assert.strictEqual(ops[4].x, 26);   // 48 - 20 - 2
});

test('mirrorEnds: custom plate corners swap left/right and features flip within the part', () => {
    const p = models.Part.fromJSON({
        partMark: 'P1', shape: { profileType: 'FLAT', designation: 'x', dimensions: { thickness: 0.5, width: 12 } },
        length: 24,
        partDefinition: {
            partWidth: 8, partLength: 18, position: 'near', clipHolesToContour: true,
            clipCircle: { diameter: 4, x: 18, y: 3 },
            corners: {
                nearLeft: { type: 'chamfer', dimX: 1, dimY: 1 }, farLeft: { type: 'square', dimX: 0, dimY: 0 },
                nearRight: { type: 'notch', dimX: 2, dimY: 1 }, farRight: { type: 'diagonal', dimX: 3, dimY: 1 }
            }
        },
        operations: [{ type: 'hole', face: 'v', x: 4, y: 2, diameter: 1 }]
    });
    const m = PartTransform.mirrorEnds(p).part;
    const c = m.partDefinition.corners;
    assert.strictEqual(c.nearLeft.type, 'notch');
    assert.strictEqual(c.nearRight.type, 'chamfer');
    assert.strictEqual(c.farLeft.type, 'diagonal');
    assert.strictEqual(c.farRight.type, 'square');
    assert.strictEqual(m.partDefinition.clipCircle.x, 0);   // 18 - 18
    assert.strictEqual(m.operations[0].x, 14);              // part length 18 - 4
});

test('flipNearFar: channel swaps flanges, web-side cuts, miter long point and web Y', () => {
    const p = models.Part.fromJSON({
        partMark: 'S1', shape: { profileType: 'CHANNEL', designation: 'C8X11.5', dimensions: { depth: 8, flange_width: 2.26, web_thickness: 0.22, flange_thickness: 0.39, k: 0.938 } },
        length: 120,
        operations: [
            { type: 'endConditionLeft', cutType: 'miter', webAngle: 35, longPointLocation: 'near' },
            { type: 'endConditionRight', cutType: 'miter', webAngle: 35, longPointLocation: 'top' },
            { type: 'cope', end: 'right', location: 'web', depth: 2, length: 4, radius: 0.5 },
            { type: 'cope', end: 'left', location: 'near_flange', depth: 1, length: 3, radius: 0 },
            { type: 'notch', location: 'far_flange', x: 30, width: 2, depth: 1 },
            { type: 'hole', face: 'v', x: 12, y: 2, diameter: 0.8125 },
            { type: 'hole', face: 'o', x: 12, y: 1, diameter: 0.8125 }
        ]
    });
    const m = PartTransform.flipNearFar(p).part;
    const o = m.operations;
    assert.strictEqual(o[0].type, 'endConditionLeft', 'ends must not swap');
    assert.strictEqual(o[0].longPointLocation, 'far');
    assert.strictEqual(o[1].longPointLocation, 'top', 'top/bottom unchanged');
    assert.strictEqual(o[2].location, 'web_far');
    assert.strictEqual(o[2].end, 'right');
    assert.strictEqual(o[3].location, 'far_flange');
    assert.strictEqual(o[4].location, 'near_flange');
    assert.strictEqual(o[5].y, 6);          // 8 - 2 on the web
    assert.strictEqual(o[6].face, 'u');     // flange hole moves to the other flange
    assert.strictEqual(o[6].y, 1);

    // Header web start angle flips sign, and the far-side web cope lands on y=0 side
    const before = generate(p.toJSON()).split('\n');
    const after = generate(m.toJSON()).split('\n');
    assert.strictEqual(before[18].trim(), '-35.000');
    assert.strictEqual(after[18].trim(), '35.000');
});

test('flipNearFar: HSS swaps v/h faces and flips o/u Y', () => {
    const p = models.Part.fromJSON({
        partMark: 'T2', shape: { profileType: 'HSS_RECT', designation: 'x', dimensions: { height: 6, width: 4, tdes: 0.233 } },
        length: 48,
        operations: [
            { type: 'hole', face: 'v', x: 6, y: 2, diameter: 0.8125 },
            { type: 'hole', face: 'o', x: 6, y: 1, diameter: 0.8125 },
            { type: 'thruHole', axis: 'horizontal', x: 10, y: 1.5, diameter: 0.75 },
            { type: 'endConditionLeft', cutType: 'miter', webAngle: 45, longPointLocation: 'far' }
        ]
    });
    const o = PartTransform.flipNearFar(p).part.operations;
    assert.strictEqual(o[0].face, 'h');
    assert.strictEqual(o[0].y, 2);
    assert.strictEqual(o[1].face, 'o');
    assert.strictEqual(o[1].y, 3);
    assert.strictEqual(o[2].y, 2.5);
    assert.strictEqual(o[3].longPointLocation, 'near');
});

test('duplicate: new id, suffixed mark, same geometry', () => {
    const p = models.Part.fromJSON({ partMark: 'A', shape: { profileType: 'FLAT', designation: 'x', dimensions: { thickness: 0.5, width: 6 } }, length: 10, operations: [{ type: 'hole', face: 'v', x: 1, y: 1, diameter: 0.5 }] });
    const d = PartTransform.duplicate(p);
    assert.notStrictEqual(d.id, p.id);
    assert.strictEqual(d.partMark, 'A-2');
    assert.deepStrictEqual(stripIds(d), stripIds(p));
});
