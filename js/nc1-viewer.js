/**
 * NC1 Converter - NC1 text parser and face viewer
 * Parses generated NC1/DSTV text back into per-face contours/holes and
 * renders a face to SVG. Because this draws what the FILE contains (not the
 * in-memory part), it shows exactly what ProCAM / the machine will see.
 */

const NC1Viewer = {

    /**
     * Parse NC1 text into { faces: { v: { contours: [{type, face, points}], holes: [] }, ... } }
     * Each AK/IK keyword line starts one contour; the first point line after it
     * carries the face code. BO lines are one hole each with their own face code.
     */
    parse(text) {
        const faces = {};
        const getFace = (f) => {
            if (!faces[f]) faces[f] = { contours: [], holes: [] };
            return faces[f];
        };

        let mode = null;      // current block keyword (AK/IK/BO/SI/KO)
        let contour = null;   // contour being collected
        let lastBOFace = 'v';

        for (const rawLine of String(text).split(/\r?\n/)) {
            const trimmed = rawLine.trim();
            if (trimmed === '' || trimmed.startsWith('**')) continue;
            if (/^(ST|EN)$/.test(trimmed)) { mode = null; contour = null; continue; }
            if (/^(AK|IK|BO|SI|KO)$/.test(trimmed)) { mode = trimmed; contour = null; continue; }
            if (!mode) continue;  // ST header content

            const nums = trimmed.match(/-?\d+\.\d+/g);
            if (!nums || nums.length < 2) continue;
            const faceMatch = rawLine.match(/^\s{0,4}([vhou])[\s\d-]/);
            const face = faceMatch ? faceMatch[1] : null;

            if (mode === 'AK' || mode === 'IK') {
                if (!contour) {
                    contour = { type: mode, face: face || 'v', points: [] };
                    getFace(contour.face).contours.push(contour);
                }
                contour.points.push({ x: parseFloat(nums[0]), y: parseFloat(nums[1]) });
            } else if (mode === 'BO') {
                const f = face || lastBOFace;
                lastBOFace = f;
                getFace(f).holes.push({
                    x: parseFloat(nums[0]),
                    y: parseFloat(nums[1]),
                    dia: parseFloat(nums[2] || '0'),
                    slot: /\dl(\s|$)/.test(trimmed)
                });
            }
        }

        return { faces };
    },

    /**
     * Render one face of a parsed NC1 into an SVG element (600x200 viewBox).
     * Orientation matches the mirrored side view: DSTV y=0 edge at the top.
     */
    renderFace(parsed, face, svgEl) {
        const data = parsed.faces[face];
        if (!data || data.contours.length === 0) {
            svgEl.innerHTML = '<text x="300" y="100" text-anchor="middle" fill="#64748b" font-size="12">No geometry on this face</text>';
            return;
        }

        // Bounds over all contour points and holes (mm)
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const grow = (x, y) => {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        };
        for (const c of data.contours) {
            for (const p of c.points) grow(p.x, p.y);
        }
        for (const hole of data.holes) {
            grow(hole.x - hole.dia / 2, hole.y - hole.dia / 2);
            grow(hole.x + hole.dia / 2, hole.y + hole.dia / 2);
        }

        const padding = 40;
        const spanX = Math.max(maxX - minX, 1);
        const spanY = Math.max(maxY - minY, 1);
        const scale = Math.min((600 - 2 * padding) / spanX, (200 - 2 * padding) / spanY);
        const drawW = spanX * scale;
        const drawH = spanY * scale;
        const ox = (600 - drawW) / 2;
        const oy = (200 - drawH) / 2;
        const X = (x) => ox + (x - minX) * scale;
        const Y = (y) => oy + (y - minY) * scale;

        // All contours in one path with evenodd fill: IK cutouts and slot
        // contours read as holes in the AK outline automatically
        let path = '';
        for (const c of data.contours) {
            if (!c.points.length) continue;
            path += c.points.map((p, i) =>
                (i === 0 ? 'M' : 'L') + X(p.x).toFixed(1) + ',' + Y(p.y).toFixed(1)
            ).join(' ') + ' Z ';
        }

        let svgContent = `<path d="${path}" fill="#dbeafe" stroke="#3b82f6" stroke-width="1.5" fill-rule="evenodd"/>`;

        for (const hole of data.holes) {
            const r = Math.max((hole.dia / 2) * scale, 2);
            svgContent += `<circle cx="${X(hole.x).toFixed(1)}" cy="${Y(hole.y).toFixed(1)}" r="${r.toFixed(1)}" fill="#ffffff" stroke="#ef4444" stroke-width="1.5"/>`;
        }

        const IN = 25.4;
        svgContent += `<text x="${ox + 4}" y="${oy - 6}" fill="#64748b" font-size="9">` +
            `face ${face} - drawn from NC1 output (${(spanX / IN).toFixed(2)}" x ${(spanY / IN).toFixed(2)}")</text>`;

        svgEl.innerHTML = svgContent;
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NC1Viewer };
}
