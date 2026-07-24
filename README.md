# NC1 Converter

A web-based tool for generating DSTV/NC1 files used in steel fabrication CNC operations.

## Features

- **Shape Support:** HSS Round, HSS Square, HSS Rectangular, Pipe, Channels (C/MC), Angles, Flat Bar
- **Operations:** End conditions, holes, slots, copes, notches, miters
- **Real-time Preview:** Part views rendered directly from the generated NC1 output (per face), plus end view
- **NC1 Output:** Preview, copy, and download NC1 files

## Local Development

Simply open `index.html` in a web browser - no build step required.

## Tests

Golden-file regression tests for the generator (Node, no dependencies):

```
npm test               # verify output against tests/golden/
npm run update-goldens # re-capture goldens after an INTENTIONAL output change
```

Run `npm test` before and after any change to `js/nc1-generator.js`, `js/models.js`,
or `js/utils.js`. When output changes on purpose, review the golden diff - it is
the record of what changed in machine output.

## Deployment

This is a static site ready for deployment on Vercel, Netlify, or any static hosting.

## Version

v1.12.5
