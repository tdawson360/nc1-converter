/**
 * NC1 Converter - Part transforms (mirror)
 *
 * Two mirrors, both true reflections that produce the opposite-hand part:
 *
 *  mirrorEnds    Swap the left and right ends (reflect across the plane at
 *                mid-length). Every X becomes span - X, end conditions and
 *                copes trade ends. Faces, Y values and near/far stay put.
 *                Works for every profile.
 *
 *  flipNearFar   Swap the near and far sides (reflect across the plane at
 *                mid-width). Same cuts at the same end, flanges on the
 *                opposite side - the stair stringer case. Faces o<->u (or
 *                v<->h on tubes) and Y values on the affected faces flip.
 *                Not available for angles: the L section is not symmetric
 *                across that plane, so the result is not a loadable part.
 *
 * Both return a NEW Part (new id) and never touch the input.
 */

const PartTransform = {

    /** Round away floating-point noise from span - x arithmetic. */
    _r(v) {
        return Math.round(v * 10000) / 10000;
    },

    /** Deep copy into a fresh Part with a new id and a suffixed mark. */
    _copy(part, suffix) {
        const data = JSON.parse(JSON.stringify(part.toJSON ? part.toJSON() : part));
        const copy = Part.fromJSON(data);
        copy.id = copy.generateId();
        copy.partMark = (part.partMark || '') + (suffix || '');
        copy.createdDate = new Date().toISOString();
        copy.modifiedDate = copy.createdDate;
        return copy;
    },

    /** Plain copy with a new id (for "same part, new mark"). */
    duplicate(part, suffix = '-2') {
        return this._copy(part, suffix);
    },

    _isCustomPlate(part) {
        const pd = part.partDefinition;
        return part.shape.profileType === 'FLAT' && !!pd && pd.partWidth > 0 && pd.partLength > 0;
    },

    _swapEnd(end) {
        if (end === 'left' || end === 'start') return 'right';
        if (end === 'right' || end === 'end') return 'left';
        return end;
    },

    /**
     * Mirror by swapping the left and right ends.
     * @returns {{ part: Part, warnings: string[] }}
     */
    mirrorEnds(part, suffix = '-M') {
        const copy = this._copy(part, suffix);
        const warnings = [];
        const custom = this._isCustomPlate(copy);
        // Holes/slots on a custom part are entered relative to the part
        const span = custom ? copy.partDefinition.partLength : copy.length;
        const r = this._r;

        for (const op of copy.operations) {
            switch (op.type) {
                case 'endConditionLeft':
                    op.type = 'endConditionRight';
                    break;
                case 'endConditionRight':
                    op.type = 'endConditionLeft';
                    break;
                case 'hole':
                case 'thruHole':
                case 'slot':
                case 'thruSlot':
                    op.x = r(span - op.x);
                    break;
                case 'layoutMark':
                    // Marks are not offset into a custom part by the generator
                    op.x = r(copy.length - op.x);
                    if (op.markType === 'line') op.x2 = r(copy.length - (op.x2 || 0));
                    break;
                case 'cope':
                case 'pipeCope':
                    op.end = this._swapEnd(op.end);
                    break;
                case 'notch':
                    op.x = r(span - op.x - (op.width || 0));
                    break;
            }
        }

        if (custom) {
            const c = copy.partDefinition.corners;
            if (c) {
                [c.nearLeft, c.nearRight] = [c.nearRight, c.nearLeft];
                [c.farLeft, c.farRight] = [c.farRight, c.farLeft];
            }
            const cc = copy.partDefinition.clipCircle;
            if (cc) cc.x = r(span - cc.x);
        }

        return { part: copy, warnings };
    },

    /**
     * Mirror by swapping the near and far sides.
     * @returns {{ part: Part|null, warnings: string[] }} part is null when the
     *          profile cannot be flipped.
     */
    flipNearFar(part, suffix = '-M') {
        const type = part.shape.profileType;
        const dims = part.shape.dimensions || {};
        const r = this._r;

        if (type === 'ANGLE_EQUAL' || type === 'ANGLE_UNEQUAL') {
            return { part: null, warnings: ['Near/far flip is not available for angles. Use Mirror: Swap Ends instead.'] };
        }

        const copy = this._copy(part, suffix);
        const warnings = [];
        const custom = this._isCustomPlate(copy);

        // Width of the face whose Y flips, per profile
        let webDepth = 0, flangeWidth = 0, plateWidth = 0, circumference = 0;
        switch (type) {
            case 'CHANNEL':
                webDepth = dims.depth || 0;          // v-face y flips
                break;
            case 'HSS_SQUARE':
            case 'HSS_RECT':
                flangeWidth = dims.width || 0;       // o/u-face y flips
                break;
            case 'FLAT':
                plateWidth = custom ? copy.partDefinition.partWidth : (dims.width || 0);
                break;
            case 'PIPE':
            case 'HSS_ROUND':
                circumference = Math.PI * (dims.od || 0);
                break;
            default:
                return { part: null, warnings: ['Near/far flip is not supported for this profile.'] };
        }

        const flipNearFarWord = (v) => v === 'near' ? 'far' : v === 'far' ? 'near' : v;
        const swapOU = (f) => f === 'o' ? 'u' : f === 'u' ? 'o' : f;
        const swapVH = (f) => f === 'v' ? 'h' : f === 'h' ? 'v' : f;

        // Flip one face-located feature (hole, slot, mark) in place
        const flipFaced = (op) => {
            switch (type) {
                case 'CHANNEL':
                    if (op.face === 'v' || op.face === 'h') op.y = r(webDepth - op.y);
                    else op.face = swapOU(op.face);
                    break;
                case 'HSS_SQUARE':
                case 'HSS_RECT':
                    if (op.face === 'o' || op.face === 'u') op.y = r(flangeWidth - op.y);
                    else op.face = swapVH(op.face);
                    break;
                case 'FLAT':
                    op.y = r(plateWidth - op.y);
                    break;
                case 'PIPE':
                case 'HSS_ROUND':
                    op.y = r(circumference - op.y);
                    break;
            }
        };

        // Flip a thru feature (axis based) in place
        const flipThru = (op) => {
            switch (type) {
                case 'CHANNEL':
                    if (op.axis === 'vertical') op.y = r(webDepth - op.y);
                    break;
                case 'HSS_SQUARE':
                case 'HSS_RECT':
                    if (op.axis === 'horizontal') op.y = r(flangeWidth - op.y);
                    break;
                case 'FLAT':
                    op.y = r(plateWidth - op.y);
                    break;
                case 'PIPE':
                case 'HSS_ROUND':
                    op.y = r(circumference - op.y);
                    break;
            }
        };

        for (const op of copy.operations) {
            switch (op.type) {
                case 'endConditionLeft':
                case 'endConditionRight':
                    if (op.cutType === 'miter') op.longPointLocation = flipNearFarWord(op.longPointLocation);
                    // Double miter and slotted ends are symmetric near/far
                    break;
                case 'hole':
                case 'slot':
                case 'layoutMark':
                    flipFaced(op);
                    break;
                case 'thruHole':
                case 'thruSlot':
                    flipThru(op);
                    break;
                case 'cope':
                case 'notch':
                    if (type === 'CHANNEL') {
                        const map = { near_flange: 'far_flange', far_flange: 'near_flange', web: 'web_far', web_far: 'web' };
                        if (map[op.location]) op.location = map[op.location];
                    }
                    // HSS copes/notches are top/bottom: same on both webs
                    break;
                case 'pipeCope':
                    op.rotation = r((360 - (op.rotation || 0)) % 360);
                    break;
            }
        }

        if (custom) {
            const c = copy.partDefinition.corners;
            if (c) {
                [c.nearLeft, c.farLeft] = [c.farLeft, c.nearLeft];
                [c.nearRight, c.farRight] = [c.farRight, c.nearRight];
            }
            const cc = copy.partDefinition.clipCircle;
            if (cc) cc.y = r(plateWidth - cc.y);
        }

        return { part: copy, warnings };
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PartTransform };
}
