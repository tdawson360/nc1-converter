/**
 * Unit tests for Utils.parseFeetInches - every format the estimator
 * actually types must parse to the right decimal inches.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { Utils } = require('../js/utils.js');

const CASES = [
    // [input, expected inches]
    ['12', 12],
    ['12.5', 12.5],
    ['18"', 18],
    ['18.5"', 18.5],        // regression: parsed as 5 before the trailing-quote fix
    ['0.8125', 0.8125],
    ['1/2', 0.5],
    ['1/2"', 0.5],          // regression: parsed as 2.5 before the trailing-quote fix
    ['3/4"', 0.75],
    ['6-1/2', 6.5],
    ['6-1/2"', 6.5],
    ['6 1/2"', 6.5],
    ["1'", 12],
    ["2'", 24],
    ["1'-6\"", 18],
    ["1' 6\"", 18],
    ["1'6\"", 18],
    ["1'-6-1/2\"", 18.5],
    ["1' 6 1/2\"", 18.5],
    [42, 42],               // numbers pass through
];

for (const [input, expected] of CASES) {
    test(`parseFeetInches(${JSON.stringify(input)}) = ${expected}`, () => {
        assert.strictEqual(Utils.parseFeetInches(input), expected);
    });
}

test('parseFeetInches returns 0 for empty/garbage input', () => {
    assert.strictEqual(Utils.parseFeetInches(''), 0);
    assert.strictEqual(Utils.parseFeetInches('"'), 0);
    assert.strictEqual(Utils.parseFeetInches('abc'), 0);
});
