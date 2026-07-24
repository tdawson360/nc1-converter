/**
 * Loads the browser-global scripts into Node for testing.
 *
 * The app scripts are plain <script> tags that share globals:
 * nc1-generator.js reads PROFILE_TYPES (defined in models.js) from
 * the global scope, so we mirror that here before requiring it.
 */
const fs = require('fs');
const path = require('path');

const models = require('../../js/models.js');
globalThis.PROFILE_TYPES = models.PROFILE_TYPES;
globalThis.OPERATION_TYPES = models.OPERATION_TYPES;

const { Utils } = require('../../js/utils.js');
globalThis.Utils = Utils;

const { NC1Generator } = require('../../js/nc1-generator.js');

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');
const GOLDEN_DIR = path.join(__dirname, '..', 'golden');

/**
 * Generate NC1 output for a fixture (a Part as plain JSON).
 * The generator logs debug output via console.log; silence it
 * so test output stays readable.
 */
function generate(fixture) {
    const part = models.Part.fromJSON(JSON.parse(JSON.stringify(fixture)));
    const origLog = console.log;
    console.log = () => {};
    try {
        const gen = new NC1Generator();
        return gen.generate(part);
    } finally {
        console.log = origLog;
    }
}

/** List all fixtures as { name, fixture, goldenPath }. */
function listFixtures() {
    return fs.readdirSync(FIXTURES_DIR)
        .filter(f => f.endsWith('.json'))
        .sort()
        .map(f => {
            const name = f.replace(/\.json$/, '');
            return {
                name,
                fixture: JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, f), 'utf8')),
                goldenPath: path.join(GOLDEN_DIR, name + '.nc1')
            };
        });
}

module.exports = { generate, listFixtures, models, NC1Generator, GOLDEN_DIR };
