/**
 * NC1 Converter - DSTV/NC1 File Generator
 * Generates NC1 files compliant with DSTV standard
 * Version: 1.12.4.1
 */

class NC1Generator {
    constructor() {
        // DSTV format uses millimeters internally
        this.INCH_TO_MM = 25.4;
        console.log('NC1Generator v1.12.4.1 loaded - IK cutout with arc clipping on all edges');
    }
    
    /**
     * Generate NC1 file content from a Part object
     * @param {Part} part - The part to generate NC1 for
     * @param {Object} options - Generation options
     * @returns {string} NC1 file content
     */
    generate(part, options = {}) {
        const useMetric = options.useMetric || false;
        const scale = useMetric ? 1 : this.INCH_TO_MM;
        
        // Pre-process: detect circles that extend beyond plate boundaries
        // and convert them to arc contour clips for the AK block
        if (part.shape.profileType === 'FLAT') {
            // For custom part definitions, only clip if the toggle is enabled
            if (part.partDefinition && part.partDefinition.partWidth > 0 && part.partDefinition.partLength > 0) {
                if (part.partDefinition.clipHolesToContour) {
                    this._clippedArcs = this.clipOversizedCircles(part, scale);
                } else {
                    this._clippedArcs = [];
                }
            } else {
                this._clippedArcs = this.clipOversizedCircles(part, scale);
            }
        } else {
            this._clippedArcs = [];
        }
        
        let nc1 = '';
        
        // Header block (ST)
        nc1 += this.generateHeader(part);
        
        // Profile/Section block (depends on shape type)
        nc1 += this.generateProfileBlock(part, scale);
        
        // Process operations by type and face
        nc1 += this.generateOperations(part, scale);
        
        // End block
        nc1 += 'EN\n';
        
        // Clean up
        this._clippedArcs = [];
        // Remove temporary _clipped flags from operations
        part.operations.forEach(op => { delete op._clipped; });
        
        return nc1;
    }
    
    /**
     * Pre-process holes on plates: detect circles that extend beyond the plate
     * boundary and convert them to arc polyline data for integration into the AK contour.
     * Returns array of clipped arc objects; also marks those holes for exclusion from BO output.
     * 
     * Each clipped arc contains:
     *   - edge: which plate edge the circle intersects ('right', 'left', 'top', 'bottom')
     *   - points: array of {x, y} polyline points tracing the arc inside the plate
     *   - intersections: the two points where the circle crosses the plate edge
     *   - holeIndex: index into the operations array (for exclusion from BO)
     */
    clipOversizedCircles(part, scale) {
        const profileType = part.shape.profileType;
        if (profileType !== 'FLAT') return [];
        
        const dims = part.shape.dimensions;
        
        // Determine plate dimensions in mm
        let plateW, plateL;
        if (part.partDefinition && part.partDefinition.partWidth > 0 && part.partDefinition.partLength > 0) {
            plateL = part.partDefinition.partLength * this.INCH_TO_MM;
            plateW = part.partDefinition.partWidth * this.INCH_TO_MM;
        } else {
            plateL = part.length * this.INCH_TO_MM;
            plateW = dims.width * this.INCH_TO_MM;
        }
        
        const clippedArcs = [];
        
        // Check each hole operation
        part.operations.forEach((op, idx) => {
            if (op.type !== 'hole') return;
            
            const cx = op.x * scale;
            const cy = op.y * scale;
            const r = (op.diameter / 2) * scale;
            
            const result = this._computeClippedArc(cx, cy, r, plateL, plateW);
            if (result) {
                result.holeIndex = idx;
                clippedArcs.push(result);
                op._clipped = true;
                console.log('Circle clipping: (' + cx.toFixed(1) + ',' + cy.toFixed(1) + ') r=' + r.toFixed(1) + 
                    ' clipped to ' + result.points.length + ' point arc on ' + Array.from(result.edges).join('/') + ' edge(s)');
            }
        });
        
        // Also process clip circle defined in part definition
        if (part.partDefinition && part.partDefinition.clipHolesToContour && part.partDefinition.clipCircle) {
            const cc = part.partDefinition.clipCircle;
            if (cc.diameter > 0) {
                const cx = cc.x * scale;
                const cy = cc.y * scale;
                const r = (cc.diameter / 2) * scale;
                
                console.log('Clip circle: cx=' + cx.toFixed(1) + ' cy=' + cy.toFixed(1) + ' r=' + r.toFixed(1) + 
                    ' plateL=' + plateL.toFixed(1) + ' plateW=' + plateW.toFixed(1));
                
                const result = this._computeClippedArc(cx, cy, r, plateL, plateW);
                if (result) {
                    result.holeIndex = -1;
                    clippedArcs.push(result);
                    console.log('Clip circle from part def: (' + cx.toFixed(1) + ',' + cy.toFixed(1) + ') r=' + r.toFixed(1) + 
                        ' clipped to ' + result.points.length + ' point arc on ' + Array.from(result.edges).join('/') + ' edge(s)');
                } else {
                    console.log('Clip circle from part def: (' + cx.toFixed(1) + ',' + cy.toFixed(1) + ') r=' + r.toFixed(1) + 
                        ' - no valid arc produced');
                }
            }
        }
        
        return clippedArcs;
    }
    
    /**
     * Compute a clipped arc for a circle that extends beyond plate boundaries.
     * Handles 2, 3, or 4 intersection points by finding the correct inside arc.
     * Returns a clipped arc object or null if no valid arc can be produced.
     */
    _computeClippedArc(cx, cy, r, plateL, plateW) {
        const extendsLeft   = (cx - r) < 0;
        const extendsRight  = (cx + r) > plateL;
        const extendsBottom = (cy - r) < 0;
        const extendsTop    = (cy + r) > plateW;
        
        if (!extendsLeft && !extendsRight && !extendsBottom && !extendsTop) return null;
        
        // Find all intersection points with plate edges
        const intersections = [];
        
        // Right edge (x = plateL)
        const dxR = plateL - cx;
        const discR = r * r - dxR * dxR;
        if (discR >= 0 && Math.abs(dxR) <= r) {
            const sqrtR = Math.sqrt(discR);
            const y1 = cy + sqrtR;
            const y2 = cy - sqrtR;
            if (y1 >= -0.01 && y1 <= plateW + 0.01) intersections.push({ x: plateL, y: Math.max(0, Math.min(plateW, y1)), edge: 'right' });
            if (y2 >= -0.01 && y2 <= plateW + 0.01 && Math.abs(y1 - y2) > 0.01) intersections.push({ x: plateL, y: Math.max(0, Math.min(plateW, y2)), edge: 'right' });
        }
        
        // Left edge (x = 0)
        const dxL = 0 - cx;
        const discL = r * r - dxL * dxL;
        if (discL >= 0 && Math.abs(dxL) <= r) {
            const sqrtL = Math.sqrt(discL);
            const y1 = cy + sqrtL;
            const y2 = cy - sqrtL;
            if (y1 >= -0.01 && y1 <= plateW + 0.01) intersections.push({ x: 0, y: Math.max(0, Math.min(plateW, y1)), edge: 'left' });
            if (y2 >= -0.01 && y2 <= plateW + 0.01 && Math.abs(y1 - y2) > 0.01) intersections.push({ x: 0, y: Math.max(0, Math.min(plateW, y2)), edge: 'left' });
        }
        
        // Top edge (y = plateW)
        const dyT = plateW - cy;
        const discT = r * r - dyT * dyT;
        if (discT >= 0 && Math.abs(dyT) <= r) {
            const sqrtT = Math.sqrt(discT);
            const x1 = cx + sqrtT;
            const x2 = cx - sqrtT;
            if (x1 >= -0.01 && x1 <= plateL + 0.01) intersections.push({ x: Math.max(0, Math.min(plateL, x1)), y: plateW, edge: 'top' });
            if (x2 >= -0.01 && x2 <= plateL + 0.01 && Math.abs(x1 - x2) > 0.01) intersections.push({ x: Math.max(0, Math.min(plateL, x2)), y: plateW, edge: 'top' });
        }
        
        // Bottom edge (y = 0)
        const dyB = 0 - cy;
        const discB = r * r - dyB * dyB;
        if (discB >= 0 && Math.abs(dyB) <= r) {
            const sqrtB = Math.sqrt(discB);
            const x1 = cx + sqrtB;
            const x2 = cx - sqrtB;
            if (x1 >= -0.01 && x1 <= plateL + 0.01) intersections.push({ x: Math.max(0, Math.min(plateL, x1)), y: 0, edge: 'bottom' });
            if (x2 >= -0.01 && x2 <= plateL + 0.01 && Math.abs(x1 - x2) > 0.01) intersections.push({ x: Math.max(0, Math.min(plateL, x2)), y: 0, edge: 'bottom' });
        }
        
        // Remove duplicate intersection points (can happen at exact corners)
        const uniqueInts = [];
        for (const pt of intersections) {
            const isDup = uniqueInts.some(u => Math.abs(u.x - pt.x) < 0.1 && Math.abs(u.y - pt.y) < 0.1);
            if (!isDup) uniqueInts.push(pt);
        }
        
        console.log('Clip arc: ' + uniqueInts.length + ' unique intersections from ' + intersections.length + ' raw');
        
        if (uniqueInts.length < 2) return null;
        
        // Sort intersection points by angle from circle center (CCW)
        uniqueInts.forEach(pt => {
            pt.angle = Math.atan2(pt.y - cy, pt.x - cx);
        });
        uniqueInts.sort((a, b) => a.angle - b.angle);
        
        // For 2 intersections: use the existing logic
        // For 3+ intersections: find the adjacent pair whose arc is inside the plate
        // Strategy: test each adjacent pair of intersection points.
        // The arc between them that stays inside the plate is the one we want.
        
        let bestPair = null;
        let bestArcAngle = 0;
        
        const n = uniqueInts.length;
        for (let i = 0; i < n; i++) {
            const p1 = uniqueInts[i];
            const p2 = uniqueInts[(i + 1) % n];
            
            // CCW arc from p1 to p2
            let arcAngle = p2.angle - p1.angle;
            if (arcAngle <= 0) arcAngle += 2 * Math.PI;
            
            // Test midpoint of this arc
            const midAngle = p1.angle + arcAngle / 2;
            const midX = cx + r * Math.cos(midAngle);
            const midY = cy + r * Math.sin(midAngle);
            
            const midInside = midX >= -0.5 && midX <= plateL + 0.5 && midY >= -0.5 && midY <= plateW + 0.5;
            
            if (midInside && arcAngle > bestArcAngle) {
                bestArcAngle = arcAngle;
                bestPair = { p1, p2, startAngle: p1.angle, endAngle: p2.angle, arcAngle };
            }
        }
        
        if (!bestPair) {
            console.log('Clip arc: no valid inside arc found among ' + n + ' intersections');
            return null;
        }
        
        const { p1, p2, startAngle, arcAngle } = bestPair;
        
        // Generate polyline points along the arc
        const numSegments = 20;
        const points = [];
        
        for (let i = 0; i <= numSegments; i++) {
            const frac = i / numSegments;
            const angle = startAngle + frac * arcAngle;
            const px = cx + r * Math.cos(angle);
            const py = cy + r * Math.sin(angle);
            points.push({ x: px, y: py });
        }
        
        const edges = new Set([p1.edge, p2.edge]);
        
        return {
            edges: edges,
            edge: p1.edge,
            points: points,
            startPoint: points[0],
            endPoint: points[points.length - 1],
            intersections: [p1, p2],
            cx: cx,
            cy: cy,
            r: r
        };
    }
    
    /**
     * Generate header block (ST) - matches working NC1 format
     */
    generateHeader(part) {
        const lines = [];
        
        // Line 1: Block identifier
        lines.push('ST');
        
        // Line 2: Comment with filename
        const filename = (part.partMark || 'PART').toLowerCase() + '.nc1';
        lines.push('** ' + filename);
        
        // Line 3: Order/Project number
        lines.push(this.formatField('1', 6));
        
        // Line 4: Drawing number
        lines.push(this.formatField('1', 6));
        
        // Line 5: Phase
        lines.push(this.formatField(part.partMark || 'PART', 8));
        
        // Line 6: Piece identification
        lines.push(this.formatField(part.partMark || 'PART', 8));
        
        // Line 7: Steel quality
        lines.push(this.formatField('A36', 6));
        
        // Line 8: Quantity
        lines.push(this.formatField((part.quantity || 1).toString(), 4));
        
        // Line 9: Profile designation
        lines.push(this.formatField(part.shape.designation || 'UNKNOWN', 12));
        
        // Line 10: Profile code
        const profileTypeKey = part.shape.profileType;
        const profileType = PROFILE_TYPES[profileTypeKey];
        const codeValue = profileType ? profileType.code : 'I';
        lines.push(this.formatField(codeValue, 4));
        
        // Line 11: Length in mm (always stock length - custom part uses IK cutout)
        let effectiveLength = part.length;
        const lengthMM = effectiveLength * this.INCH_TO_MM;
        lines.push(this.formatDecimal(lengthMM, 10, 2));
        
        // Lines 12+: Profile-specific dimensions
        const dims = part.shape.dimensions;
        
        switch(profileTypeKey) {
            case 'ANGLE_EQUAL':
            case 'ANGLE_UNEQUAL':
                // L-profile: height (long leg), width (short leg), thickness
                lines.push(this.formatDecimal(dims.long_leg * this.INCH_TO_MM, 10, 2));
                lines.push(this.formatDecimal(dims.short_leg * this.INCH_TO_MM, 10, 2));
                lines.push(this.formatDecimal(dims.t * this.INCH_TO_MM, 10, 2));
                lines.push(this.formatDecimal(dims.t * this.INCH_TO_MM, 10, 2));  // Same as t for angles
                lines.push(this.formatDecimal((dims.k || 0) * this.INCH_TO_MM, 10, 2));  // Radius/k
                break;
                
            case 'CHANNEL':
                // U-profile: height, flange width, flange thickness, web thickness, radius
                // Note: DSTV order is tf (flange) before tw (web)
                lines.push(this.formatDecimal((dims.depth || 0) * this.INCH_TO_MM, 10, 2));
                lines.push(this.formatDecimal((dims.flange_width || 0) * this.INCH_TO_MM, 10, 2));
                lines.push(this.formatDecimal((dims.flange_thickness || 0) * this.INCH_TO_MM, 10, 2)); // tf first
                lines.push(this.formatDecimal((dims.web_thickness || 0) * this.INCH_TO_MM, 10, 2));    // tw second
                // Fillet radius = k - tf
                const channelRadius = dims.k ? (dims.k - (dims.flange_thickness || 0)) : 0;
                lines.push(this.formatDecimal(Math.max(0, channelRadius) * this.INCH_TO_MM, 10, 2));
                break;
                
            case 'HSS_SQUARE':
            case 'HSS_RECT':
                // M-profile (rectangular tube): height, width, wall thickness
                lines.push(this.formatDecimal(dims.height * this.INCH_TO_MM, 10, 2));
                lines.push(this.formatDecimal(dims.width * this.INCH_TO_MM, 10, 2));
                lines.push(this.formatDecimal((dims.tdes || dims.tnom) * this.INCH_TO_MM, 10, 2));
                lines.push(this.formatDecimal((dims.tdes || dims.tnom) * this.INCH_TO_MM, 10, 2));
                lines.push(this.formatDecimal(0, 10, 2));  // No radius for HSS
                break;
                
            case 'HSS_ROUND':
            case 'PIPE':
                // Pipes are represented as unrolled flat bars in DSTV
                // Profile code B with width = circumference (π × OD)
                const circumference = Math.PI * dims.od * this.INCH_TO_MM;
                const wallThickness = (dims.tdes || dims.tnom) * this.INCH_TO_MM;
                lines.push(this.formatDecimal(circumference, 10, 2));
                lines.push(this.formatDecimal(wallThickness, 10, 2));
                lines.push(this.formatDecimal(wallThickness, 10, 2));
                lines.push(this.formatDecimal(wallThickness, 10, 2));
                lines.push(this.formatDecimal(0, 10, 2));
                break;
                
            case 'WF':
                // I-profile: height, flange width, web thickness, flange thickness, radius
                lines.push(this.formatDecimal(dims.depth * this.INCH_TO_MM, 10, 2));
                lines.push(this.formatDecimal(dims.flange_width * this.INCH_TO_MM, 10, 2));
                lines.push(this.formatDecimal(dims.web_thickness * this.INCH_TO_MM, 10, 2));
                lines.push(this.formatDecimal(dims.flange_thickness * this.INCH_TO_MM, 10, 2));
                lines.push(this.formatDecimal((dims.k || 0) * this.INCH_TO_MM, 10, 2));
                break;
                
            case 'FLAT':
                // B-profile (plate): width, 0, 0, thickness, 0
                // Line 12: width (always stock width - custom part uses IK cutout)
                let effectiveWidth = dims.width;
                lines.push(this.formatDecimal(effectiveWidth * this.INCH_TO_MM, 10, 2));  // Line 12: width
                lines.push(this.formatDecimal(0, 10, 2));                                  // Line 13: 0
                lines.push(this.formatDecimal(0, 10, 2));                                  // Line 14: 0
                lines.push(this.formatDecimal(dims.thickness * this.INCH_TO_MM, 10, 2));  // Line 15: thickness
                lines.push(this.formatDecimal(0, 10, 2));                                  // Line 16: 0
                break;
                
            default:
                // Default dimensions
                lines.push(this.formatDecimal(100, 10, 2));
                lines.push(this.formatDecimal(100, 10, 2));
                lines.push(this.formatDecimal(10, 10, 2));
                lines.push(this.formatDecimal(10, 10, 2));
                lines.push(this.formatDecimal(0, 10, 2));
        }
        
        // Weight per meter (estimate or 0)
        lines.push(this.formatDecimal(0, 10, 3));
        
        // Painting surface per meter
        lines.push(this.formatDecimal(0, 10, 3));
        
        // Cut angles: web start, flange start, web end, flange end
        const leftCut = part.operations.find(op => op.type === 'endConditionLeft');
        const rightCut = part.operations.find(op => op.type === 'endConditionRight');
        const isChannel = profileTypeKey === 'CHANNEL';
        
        let webStartAngle = 0, flangeStartAngle = 0, webEndAngle = 0, flangeEndAngle = 0;
        
        if (leftCut && leftCut.cutType === 'miter') {
            const longPoint = leftCut.longPointLocation;
            
            if (isChannel) {
                // Channel: Near/Far = web angle, Top/Bottom = flange angle
                if (longPoint === 'near') {
                    webStartAngle = -leftCut.webAngle;
                } else if (longPoint === 'far') {
                    webStartAngle = leftCut.webAngle;
                } else if (longPoint === 'top') {
                    flangeStartAngle = -leftCut.webAngle;
                } else if (longPoint === 'bottom') {
                    flangeStartAngle = leftCut.webAngle;
                }
            } else {
                // HSS: Top/Bottom = web angle, Near/Far = flange angle
                if (longPoint === 'top') {
                    webStartAngle = -leftCut.webAngle;
                } else if (longPoint === 'bottom') {
                    webStartAngle = leftCut.webAngle;
                } else if (longPoint === 'near') {
                    flangeStartAngle = -leftCut.webAngle;
                } else if (longPoint === 'far') {
                    flangeStartAngle = leftCut.webAngle;
                }
            }
        }
        
        if (rightCut && rightCut.cutType === 'miter') {
            const longPoint = rightCut.longPointLocation;
            
            if (isChannel) {
                // Channel: Near/Far = web angle, Top/Bottom = flange angle
                if (longPoint === 'near') {
                    webEndAngle = rightCut.webAngle;
                } else if (longPoint === 'far') {
                    webEndAngle = -rightCut.webAngle;
                } else if (longPoint === 'top') {
                    flangeEndAngle = rightCut.webAngle;
                } else if (longPoint === 'bottom') {
                    flangeEndAngle = -rightCut.webAngle;
                }
            } else {
                // HSS: Top/Bottom = web angle, Near/Far = flange angle
                if (longPoint === 'top') {
                    webEndAngle = rightCut.webAngle;
                } else if (longPoint === 'bottom') {
                    webEndAngle = -rightCut.webAngle;
                } else if (longPoint === 'near') {
                    flangeEndAngle = rightCut.webAngle;
                } else if (longPoint === 'far') {
                    flangeEndAngle = -rightCut.webAngle;
                }
            }
        }
        
        lines.push(this.formatDecimal(webStartAngle, 10, 3));
        lines.push(this.formatDecimal(flangeStartAngle, 10, 3));
        lines.push(this.formatDecimal(webEndAngle, 10, 3));
        lines.push(this.formatDecimal(flangeEndAngle, 10, 3));
        
        // Empty lines before contour blocks
        lines.push('');
        lines.push('');
        lines.push('');
        lines.push('');
        
        return lines.join('\n') + '\n';
    }
    
    /**
     * Format a text field, right-justified
     */
    formatField(value, width) {
        return value.toString().padStart(width);
    }
    
    /**
     * Format a decimal number, right-justified with fixed decimals
     */
    formatDecimal(value, width, decimals) {
        return value.toFixed(decimals).padStart(width);
    }
    
    /**
     * Generate contour blocks (AK) for the profile shape
     * Profile dimensions are now in header, this generates the outline contours
     */
    generateProfileBlock(part, scale) {
        const dims = part.shape.dimensions;
        const profileType = part.shape.profileType;
        const lengthMM = part.length * this.INCH_TO_MM;
        
        // Get miter cut info
        const leftCut = part.operations.find(op => op.type === 'endConditionLeft');
        const rightCut = part.operations.find(op => op.type === 'endConditionRight');
        
        // Get notches and copes for HSS integration
        const notches = part.operations.filter(op => op.type === 'notch');
        const copes = part.operations.filter(op => op.type === 'cope');
        
        let block = '';
        
        // Generate AK (external contour) blocks based on profile type
        switch(profileType) {
            case 'ANGLE_EQUAL':
            case 'ANGLE_UNEQUAL':
                block += this.generateAngleContours(dims, lengthMM, leftCut, rightCut);
                break;
                
            case 'CHANNEL':
                block += this.generateChannelContours(dims, lengthMM, leftCut, rightCut, notches, copes, scale);
                break;
                
            case 'HSS_SQUARE':
            case 'HSS_RECT':
                block += this.generateRectTubeContours(dims, lengthMM, leftCut, rightCut, notches, copes, scale);
                break;
                
            case 'HSS_ROUND':
            case 'PIPE':
                // Round tubes - get pipe cope operations
                const pipeCopes = part.operations.filter(op => op.type === 'pipeCope');
                block += this.generateRoundTubeContours(dims, lengthMM, leftCut, rightCut, pipeCopes, scale);
                break;
                
            case 'WF':
                block += this.generateWFContours(dims, lengthMM, leftCut, rightCut);
                break;
                
            case 'FLAT':
                block += this.generatePlateContours(dims, lengthMM, leftCut, rightCut, part.partDefinition);
                break;
        }
        
        return block;
    }
    
    /**
     * Generate AK contours for angle profiles
     */
    generateAngleContours(dims, length, leftCut, rightCut) {
        const h = dims.long_leg * this.INCH_TO_MM;   // Vertical leg height
        const w = dims.short_leg * this.INCH_TO_MM;  // Horizontal leg width
        const t = dims.t * this.INCH_TO_MM;          // Thickness
        
        let block = '';
        
        // v-face (vertical leg outer)
        block += 'AK\n';
        block += this.formatAKLine('v', 0, 'u', 0);
        block += this.formatAKLine('', length, '', 0);
        block += this.formatAKLine('', length, '', h);
        block += this.formatAKLine('', 0, '', h);
        block += this.formatAKLine('', 0, '', 0);
        
        // u-face (horizontal leg outer) - NOT 'h'!
        block += 'AK\n';
        block += this.formatAKLine('u', 0, 'o', 0);
        block += this.formatAKLine('', length, '', 0);
        block += this.formatAKLine('', length, '', w);
        block += this.formatAKLine('', 0, '', w);
        block += this.formatAKLine('', 0, '', 0);
        
        return block;
    }
    
    /**
     * Generate AK contours for channel profiles
     * Channels have 3 faces: v (web), o (top flange), u (bottom flange)
     * Supports miters, copes and notches on flanges and web
     */
    generateChannelContours(dims, length, leftCut, rightCut, notches, copes, scale) {
        const h = (dims.depth || 0) * this.INCH_TO_MM;       // Web height (depth)
        const w = (dims.flange_width || 0) * this.INCH_TO_MM; // Flange width
        
        // Track miter types
        // Near/Far = diagonal on web (v-face), flanges different lengths
        // Top/Bottom = diagonal on flanges (o/u faces), web rectangular
        let leftIsWebMiter = false, rightIsWebMiter = false;       // Near/Far
        let leftIsFlangeMiter = false, rightIsFlangeMiter = false; // Top/Bottom
        
        // Web miter offsets - for Near/Far, diagonal on web
        // nearOffset = X position at near side of web, farOffset = X position at far side
        let leftNearOffset = 0, leftFarOffset = 0;
        let rightNearOffset = 0, rightFarOffset = 0;
        
        // Flange miter offsets - for Top/Bottom, diagonal on flanges
        // topOffset = X position at web (top of flange), bottomOffset = X position at toes
        let leftTopOffset = 0, leftBottomOffset = 0;
        let rightTopOffset = 0, rightBottomOffset = 0;
        
        if (leftCut && leftCut.cutType === 'miter') {
            const angle = leftCut.webAngle || 45;
            const longPoint = leftCut.longPointLocation;
            
            if (longPoint === 'near' || longPoint === 'far') {
                // Web miter - diagonal on web face, uses depth dimension
                leftIsWebMiter = true;
                const miterOffset = h * Math.tan(angle * Math.PI / 180);
                if (longPoint === 'near') {
                    leftNearOffset = 0;
                    leftFarOffset = miterOffset;
                } else {
                    leftNearOffset = miterOffset;
                    leftFarOffset = 0;
                }
            } else if (longPoint === 'top' || longPoint === 'bottom') {
                // Flange miter - diagonal on flange faces, uses flange_width dimension
                leftIsFlangeMiter = true;
                const miterOffset = w * Math.tan(angle * Math.PI / 180);
                if (longPoint === 'top') {
                    leftTopOffset = 0;
                    leftBottomOffset = miterOffset;
                } else {
                    leftTopOffset = miterOffset;
                    leftBottomOffset = 0;
                }
            }
        }
        
        if (rightCut && rightCut.cutType === 'miter') {
            const angle = rightCut.webAngle || 45;
            const longPoint = rightCut.longPointLocation;
            
            if (longPoint === 'near' || longPoint === 'far') {
                // Web miter - diagonal on web face
                rightIsWebMiter = true;
                const miterOffset = h * Math.tan(angle * Math.PI / 180);
                if (longPoint === 'near') {
                    rightNearOffset = 0;
                    rightFarOffset = miterOffset;
                } else {
                    rightNearOffset = miterOffset;
                    rightFarOffset = 0;
                }
            } else if (longPoint === 'top' || longPoint === 'bottom') {
                // Flange miter - diagonal on flange faces
                rightIsFlangeMiter = true;
                const miterOffset = w * Math.tan(angle * Math.PI / 180);
                if (longPoint === 'top') {
                    rightTopOffset = 0;
                    rightBottomOffset = miterOffset;
                } else {
                    rightTopOffset = miterOffset;
                    rightBottomOffset = 0;
                }
            }
        }
        
        // Process notches by location
        // Channel orientation: toes down, web up
        // near_flange = o-face, far_flange = u-face, web = v-face
        const webNotches = (notches || []).filter(n => n.location === 'web').map(n => ({
            x: n.x * scale,
            width: n.width * scale,
            depth: n.depth * scale
        })).sort((a, b) => a.x - b.x);
        
        const nearFlangeNotches = (notches || []).filter(n => n.location === 'near_flange').map(n => ({
            x: n.x * scale,
            width: n.width * scale,
            depth: n.depth * scale
        })).sort((a, b) => a.x - b.x);
        
        const farFlangeNotches = (notches || []).filter(n => n.location === 'far_flange').map(n => ({
            x: n.x * scale,
            width: n.width * scale,
            depth: n.depth * scale
        })).sort((a, b) => a.x - b.x);
        
        // Process copes
        const processedCopes = (copes || []).map(c => ({
            end: c.end || 'right',
            location: c.location || 'near_flange',
            length: c.length * scale,
            depth: c.depth * scale,
            radius: (c.radius || 0) * scale
        }));
        
        // Find copes by position (near_flange = o-face, far_flange = u-face)
        const leftNearCope = processedCopes.find(c => c.end === 'left' && (c.location === 'near_flange' || c.location === 'both'));
        const leftFarCope = processedCopes.find(c => c.end === 'left' && (c.location === 'far_flange' || c.location === 'both'));
        const rightNearCope = processedCopes.find(c => c.end === 'right' && (c.location === 'near_flange' || c.location === 'both'));
        const rightFarCope = processedCopes.find(c => c.end === 'right' && (c.location === 'far_flange' || c.location === 'both'));
        
        let block = '';
        
        // ========== v-face (web) ==========
        // Web miter (Near/Far): parallelogram from nearOffset to farOffset
        // Flange miter (Top/Bottom): rectangle shortened to match flange tops
        block += 'AK\n';
        
        let vLeftNear, vLeftFar, vRightNear, vRightFar;
        
        if (leftIsWebMiter) {
            // Diagonal across web
            vLeftNear = leftNearOffset;
            vLeftFar = leftFarOffset;
        } else if (leftIsFlangeMiter) {
            // Rectangle at top offset (web connects to tops of flanges)
            vLeftNear = leftTopOffset;
            vLeftFar = leftTopOffset;
        } else {
            // Rectangle (same X at near and far side)
            vLeftNear = 0;
            vLeftFar = 0;
        }
        
        if (rightIsWebMiter) {
            vRightNear = length - rightNearOffset;
            vRightFar = length - rightFarOffset;
        } else if (rightIsFlangeMiter) {
            // Rectangle at top offset (web connects to tops of flanges)
            vRightNear = length - rightTopOffset;
            vRightFar = length - rightTopOffset;
        } else {
            vRightNear = length;
            vRightFar = length;
        }
        
        // Web contour: Y=0 is near side, Y=h is far side
        block += this.formatAKLine('v', vLeftNear, 'u', 0);
        block += this.formatAKLine('', vRightNear, '', 0);
        block += this.formatAKLine('', vRightFar, '', h);
        
        // Add web notches (from right to left along far edge)
        for (let i = webNotches.length - 1; i >= 0; i--) {
            const notch = webNotches[i];
            block += this.formatAKLine('', notch.x + notch.width, '', h);
            block += this.formatAKLine('', notch.x + notch.width, '', h - notch.depth);
            block += this.formatAKLine('', notch.x, '', h - notch.depth);
            block += this.formatAKLine('', notch.x, '', h);
        }
        
        block += this.formatAKLine('', vLeftFar, '', h);
        block += this.formatAKLine('', vLeftNear, '', 0);
        
        // ========== o-face (near flange) ==========
        // Web miter (Near/Far): rectangle at farOffset (aligns with web's far edge)
        // Flange miter (Top/Bottom): parallelogram from topOffset to bottomOffset
        block += 'AK\n';
        
        let oLeftTop, oLeftBottom, oRightTop, oRightBottom;
        
        if (leftIsFlangeMiter) {
            // Diagonal across flange: Y=0 is at web (top), Y=w is at toes (bottom)
            oLeftTop = leftTopOffset;
            oLeftBottom = leftBottomOffset;
        } else if (leftIsWebMiter) {
            // Rectangle at far offset (o-face aligns with far side of web)
            oLeftTop = leftFarOffset;
            oLeftBottom = leftFarOffset;
        } else {
            const oLeftStart = leftNearCope ? leftNearCope.length : 0;
            oLeftTop = oLeftStart;
            oLeftBottom = oLeftStart;
        }
        
        if (rightIsFlangeMiter) {
            oRightTop = length - rightTopOffset;
            oRightBottom = length - rightBottomOffset;
        } else if (rightIsWebMiter) {
            oRightTop = length - rightFarOffset;
            oRightBottom = length - rightFarOffset;
        } else {
            const oRightEnd = rightNearCope ? length - rightNearCope.length : length;
            oRightTop = oRightEnd;
            oRightBottom = oRightEnd;
        }
        
        // Flange contour: Y=0 is at web, Y=w is at toes
        block += this.formatAKLine('o', oLeftTop, 'o', 0);
        block += this.formatAKLine('', oLeftBottom, '', w);
        block += this.formatAKLine('', oRightBottom, '', w);
        block += this.formatAKLine('', oRightTop, '', 0);
        block += this.formatAKLine('', oLeftTop, '', 0);
        
        // ========== u-face (far flange) ==========
        // Web miter (Near/Far): rectangle at nearOffset (aligns with web's near edge)
        // Flange miter (Top/Bottom): parallelogram from topOffset to bottomOffset
        block += 'AK\n';
        
        let uLeftTop, uLeftBottom, uRightTop, uRightBottom;
        
        if (leftIsFlangeMiter) {
            // Diagonal across flange: same as o-face
            uLeftTop = leftTopOffset;
            uLeftBottom = leftBottomOffset;
        } else if (leftIsWebMiter) {
            // Rectangle at near offset (u-face aligns with near side of web)
            uLeftTop = leftNearOffset;
            uLeftBottom = leftNearOffset;
        } else {
            const uLeftStart = leftFarCope ? leftFarCope.length : 0;
            uLeftTop = uLeftStart;
            uLeftBottom = uLeftStart;
        }
        
        if (rightIsFlangeMiter) {
            uRightTop = length - rightTopOffset;
            uRightBottom = length - rightBottomOffset;
        } else if (rightIsWebMiter) {
            uRightTop = length - rightNearOffset;
            uRightBottom = length - rightNearOffset;
        } else {
            const uRightEnd = rightFarCope ? length - rightFarCope.length : length;
            uRightTop = uRightEnd;
            uRightBottom = uRightEnd;
        }
        
        // Flange contour: Y=0 is at web, Y=w is at toes
        block += this.formatAKLine('u', uLeftTop, 'o', 0);
        block += this.formatAKLine('', uRightTop, '', 0);
        block += this.formatAKLine('', uRightBottom, '', w);
        block += this.formatAKLine('', uLeftBottom, '', w);
        block += this.formatAKLine('', uLeftTop, '', 0);
        
        // Add IK blocks for web notches (internal cutouts on v-face)
        for (const notch of webNotches) {
            block += 'IK\n';
            block += this.formatAKLine('v', notch.x, 'o', 0);
            block += this.formatAKLine('', notch.x, '', notch.depth);
            block += this.formatAKLine('', notch.x + notch.width, '', notch.depth);
            block += this.formatAKLine('', notch.x + notch.width, '', 0);
            block += this.formatAKLine('', notch.x, '', 0);
        }
        
        return block;
    }
    
    /**
     * Generate AK contours for round tube profiles (Pipe/HSS Round)
     * Pipes are represented as unrolled flat bars with v-face
     * Width = circumference (π × OD)
     * Handles pipe cope (saddle cut) operations
     */
    generateRoundTubeContours(dims, length, leftCut, rightCut, pipeCopes, scale) {
        const od = dims.od * this.INCH_TO_MM;
        const branchRadius = od / 2;
        const circumference = Math.PI * od;
        
        // Find left and right pipe copes
        const leftCope = (pipeCopes || []).find(c => c.end === 'left');
        const rightCope = (pipeCopes || []).find(c => c.end === 'right');
        
        let block = '';
        block += 'AK\n';
        
        // Start at origin
        block += this.formatAKLine('v', 0, 'u', 0);
        
        // If right cope exists, generate saddle cut at right end
        if (rightCope) {
            const headerRadius = (rightCope.headerOD * scale) / 2;
            const angle = rightCope.intersectionAngle || 90;
            
            // Generate saddle cut points along the right end
            // First, straight line along bottom to start of cope
            block += this.formatAKLine('', length, '', 0);
            
            // Generate saddle curve points (going up the right side)
            const numPoints = 24; // Number of points for smooth curve
            for (let i = 1; i <= numPoints; i++) {
                const theta = (i / numPoints) * Math.PI * 2; // 0 to 2π
                const y = (theta / (Math.PI * 2)) * circumference;
                
                // Calculate saddle cut depth at this angle
                // For 90° intersection: depth = R_h - sqrt(R_h² - (R_b × sin(θ))²)
                let depth = 0;
                const sinTheta = Math.sin(theta);
                const term = branchRadius * sinTheta;
                
                if (Math.abs(term) <= headerRadius) {
                    depth = headerRadius - Math.sqrt(headerRadius * headerRadius - term * term);
                }
                
                // Adjust for non-90° angles
                if (angle !== 90) {
                    const angleRad = angle * Math.PI / 180;
                    depth = depth / Math.sin(angleRad);
                }
                
                const x = length - depth;
                block += this.formatAKLine('', x, '', y);
            }
        } else {
            // No right cope - straight edges
            block += this.formatAKLine('', length, '', 0);
            block += this.formatAKLine('', length, '', circumference);
        }
        
        // If left cope exists, generate saddle cut at left end
        if (leftCope) {
            const headerRadius = (leftCope.headerOD * scale) / 2;
            const angle = leftCope.intersectionAngle || 90;
            
            // Generate saddle curve points (going down the left side)
            const numPoints = 24;
            for (let i = numPoints; i >= 0; i--) {
                const theta = (i / numPoints) * Math.PI * 2; // 2π to 0
                const y = (theta / (Math.PI * 2)) * circumference;
                
                // Calculate saddle cut depth
                let depth = 0;
                const sinTheta = Math.sin(theta);
                const term = branchRadius * sinTheta;
                
                if (Math.abs(term) <= headerRadius) {
                    depth = headerRadius - Math.sqrt(headerRadius * headerRadius - term * term);
                }
                
                // Adjust for non-90° angles
                if (angle !== 90) {
                    const angleRad = angle * Math.PI / 180;
                    depth = depth / Math.sin(angleRad);
                }
                
                const x = depth;
                block += this.formatAKLine('', x, '', y);
            }
        } else {
            // No left cope - straight edges
            block += this.formatAKLine('', 0, '', circumference);
            block += this.formatAKLine('', 0, '', 0);
        }
        
        return block;
    }
    
    /**
     * Generate AK contours for rectangular tube profiles (HSS)
     * All 4 faces: v (front), h (back), o (top), u (bottom)
     * Applies miter cuts, double miters, and notches to contour geometry
     */
    generateRectTubeContours(dims, length, leftCut, rightCut, notches, copes, scale) {
        const h = dims.height * this.INCH_TO_MM;
        const w = dims.width * this.INCH_TO_MM;
        
        // Calculate miter offsets for web miters (top/bottom)
        let leftTopOffset = 0, leftBottomOffset = 0;
        let rightTopOffset = 0, rightBottomOffset = 0;
        
        // Calculate miter offsets for flange miters (near/far)
        let leftNearOffset = 0, leftFarOffset = 0;
        let rightNearOffset = 0, rightFarOffset = 0;
        
        // Track miter types
        let leftIsWebMiter = false, rightIsWebMiter = false;
        let leftIsFlangeMiter = false, rightIsFlangeMiter = false;
        let leftIsDoubleMiter = false, rightIsDoubleMiter = false;
        let leftIsSlotted = false, rightIsSlotted = false;
        
        // Double miter data (in mm)
        let leftDoubleMiter = null, rightDoubleMiter = null;
        
        // Slotted end data (in mm)
        let leftSlotted = null, rightSlotted = null;
        
        if (leftCut && leftCut.cutType === 'doubleMiter') {
            leftIsDoubleMiter = true;
            leftDoubleMiter = {
                topCutback: (leftCut.topCutback || 0) * this.INCH_TO_MM,
                bottomCutback: (leftCut.bottomCutback || 0) * this.INCH_TO_MM,
                dropdown: (leftCut.dropdown || 0) * this.INCH_TO_MM
            };
        } else if (leftCut && leftCut.cutType === 'slotted') {
            leftIsSlotted = true;
            leftSlotted = {
                length: (leftCut.slotLength || 0) * this.INCH_TO_MM,
                width: (leftCut.slotWidth || 0) * this.INCH_TO_MM,
                endType: leftCut.slotEndType || 'radiused',
                faces: leftCut.slotFaces || 'webs'
            };
        } else if (leftCut && leftCut.cutType === 'miter') {
            const angle = leftCut.webAngle || 45;
            const longPoint = leftCut.longPointLocation;
            
            if (longPoint === 'top' || longPoint === 'bottom') {
                leftIsWebMiter = true;
                const miterOffset = h * Math.tan(angle * Math.PI / 180);
                if (longPoint === 'top') {
                    leftTopOffset = 0;
                    leftBottomOffset = miterOffset;
                } else {
                    leftTopOffset = miterOffset;
                    leftBottomOffset = 0;
                }
            } else if (longPoint === 'near' || longPoint === 'far') {
                leftIsFlangeMiter = true;
                const miterOffset = w * Math.tan(angle * Math.PI / 180);
                if (longPoint === 'near') {
                    leftNearOffset = 0;
                    leftFarOffset = miterOffset;
                } else {
                    leftNearOffset = miterOffset;
                    leftFarOffset = 0;
                }
            }
        }
        
        if (rightCut && rightCut.cutType === 'doubleMiter') {
            rightIsDoubleMiter = true;
            rightDoubleMiter = {
                topCutback: (rightCut.topCutback || 0) * this.INCH_TO_MM,
                bottomCutback: (rightCut.bottomCutback || 0) * this.INCH_TO_MM,
                dropdown: (rightCut.dropdown || 0) * this.INCH_TO_MM
            };
        } else if (rightCut && rightCut.cutType === 'slotted') {
            rightIsSlotted = true;
            rightSlotted = {
                length: (rightCut.slotLength || 0) * this.INCH_TO_MM,
                width: (rightCut.slotWidth || 0) * this.INCH_TO_MM,
                endType: rightCut.slotEndType || 'radiused',
                faces: rightCut.slotFaces || 'webs'
            };
        } else if (rightCut && rightCut.cutType === 'miter') {
            const angle = rightCut.webAngle || 45;
            const longPoint = rightCut.longPointLocation;
            
            if (longPoint === 'top' || longPoint === 'bottom') {
                rightIsWebMiter = true;
                const miterOffset = h * Math.tan(angle * Math.PI / 180);
                if (longPoint === 'top') {
                    rightTopOffset = 0;
                    rightBottomOffset = miterOffset;
                } else {
                    rightTopOffset = miterOffset;
                    rightBottomOffset = 0;
                }
            } else if (longPoint === 'near' || longPoint === 'far') {
                rightIsFlangeMiter = true;
                const miterOffset = w * Math.tan(angle * Math.PI / 180);
                if (longPoint === 'near') {
                    rightNearOffset = 0;
                    rightFarOffset = miterOffset;
                } else {
                    rightNearOffset = miterOffset;
                    rightFarOffset = 0;
                }
            }
        }
        
        // Process notches - filter for top notches and convert to mm
        const topNotches = (notches || []).filter(n => n.location === 'top' || !n.location).map(n => ({
            x: n.x * scale,
            width: n.width * scale,
            depth: n.depth * scale
        })).sort((a, b) => a.x - b.x);  // Sort by x position
        
        // Process copes - convert to mm
        const processedCopes = (copes || []).map(c => ({
            end: c.end || 'right',
            location: c.location || 'top',
            length: c.length * scale,
            depth: c.depth * scale,
            radius: (c.radius || 0) * scale
        }));
        
        // Find copes by position
        const leftTopCope = processedCopes.find(c => c.end === 'left' && (c.location === 'top' || c.location === 'both'));
        const leftBottomCope = processedCopes.find(c => c.end === 'left' && (c.location === 'bottom' || c.location === 'both'));
        const rightTopCope = processedCopes.find(c => c.end === 'right' && (c.location === 'top' || c.location === 'both'));
        const rightBottomCope = processedCopes.find(c => c.end === 'right' && (c.location === 'bottom' || c.location === 'both'));
        
        let block = '';
        
        // ========== v-face (front/far side) ==========
        // Web miter: parallelogram (bottomOffset to topOffset)
        // Flange miter: rectangle at farOffset position
        // Double miter: pentagon with long point at dropdown position
        block += 'AK\n';
        
        // Start at bottom-left, trace counter-clockwise
        let startY = leftBottomCope ? leftBottomCope.depth : 0;
        
        if (leftIsDoubleMiter || rightIsDoubleMiter) {
            // Handle double miter on v-face (and h-face similarly)
            // Left end coordinates
            let vLeftBottom, vLeftTop, vLeftLongPointX, vLeftLongPointY;
            if (leftIsDoubleMiter) {
                vLeftBottom = leftDoubleMiter.bottomCutback;
                vLeftTop = leftDoubleMiter.topCutback;
                vLeftLongPointX = 0;
                vLeftLongPointY = h - leftDoubleMiter.dropdown;  // Dropdown measured from TOP
            } else if (leftIsFlangeMiter) {
                vLeftBottom = leftFarOffset;
                vLeftTop = leftFarOffset;
                vLeftLongPointX = null; // No long point for simple miters
                vLeftLongPointY = null;
            } else {
                vLeftBottom = leftBottomOffset;
                vLeftTop = leftTopOffset;
                vLeftLongPointX = null;
                vLeftLongPointY = null;
            }
            
            // Right end coordinates
            let vRightBottom, vRightTop, vRightLongPointX, vRightLongPointY;
            if (rightIsDoubleMiter) {
                vRightBottom = length - rightDoubleMiter.bottomCutback;
                vRightTop = length - rightDoubleMiter.topCutback;
                vRightLongPointX = length;
                vRightLongPointY = h - rightDoubleMiter.dropdown;  // Dropdown measured from TOP
            } else if (rightIsFlangeMiter) {
                vRightBottom = length - rightFarOffset;
                vRightTop = length - rightFarOffset;
                vRightLongPointX = null;
                vRightLongPointY = null;
            } else {
                vRightBottom = length - rightBottomOffset;
                vRightTop = length - rightTopOffset;
                vRightLongPointX = null;
                vRightLongPointY = null;
            }
            
            // Generate v-face contour
            // Start at bottom-left corner
            block += this.formatAKLine('v', vLeftBottom, 'u', 0);
            
            // Left side - if double miter, go to long point then to top
            if (leftIsDoubleMiter) {
                block += this.formatAKLine('', vLeftLongPointX, '', vLeftLongPointY);
                block += this.formatAKLine('', vLeftTop, '', h);
            } else {
                block += this.formatAKLine('', vLeftTop, '', h);
            }
            
            // Top edge (right to left for notches would go here, but we're going left to right)
            // Go to right top
            if (rightIsDoubleMiter) {
                block += this.formatAKLine('', vRightTop, '', h);
                block += this.formatAKLine('', vRightLongPointX, '', vRightLongPointY);
                block += this.formatAKLine('', vRightBottom, '', 0);
            } else {
                block += this.formatAKLine('', vRightTop, '', h);
                block += this.formatAKLine('', vRightBottom, '', 0);
            }
            
            // Close contour
            block += this.formatAKLine('', vLeftBottom, '', 0);
            
            // ========== h-face (back/near side) - mirror of v-face ==========
            block += 'AK\n';
            
            // For h-face, use nearOffset instead of farOffset for flange miters
            // Double miter is the same on both web faces
            let hLeftBottom, hLeftTop, hLeftLongPointX, hLeftLongPointY;
            if (leftIsDoubleMiter) {
                hLeftBottom = leftDoubleMiter.bottomCutback;
                hLeftTop = leftDoubleMiter.topCutback;
                hLeftLongPointX = 0;
                hLeftLongPointY = h - leftDoubleMiter.dropdown;  // Dropdown measured from TOP
            } else if (leftIsFlangeMiter) {
                hLeftBottom = leftNearOffset;
                hLeftTop = leftNearOffset;
                hLeftLongPointX = null;
                hLeftLongPointY = null;
            } else {
                hLeftBottom = leftBottomOffset;
                hLeftTop = leftTopOffset;
                hLeftLongPointX = null;
                hLeftLongPointY = null;
            }
            
            let hRightBottom, hRightTop, hRightLongPointX, hRightLongPointY;
            if (rightIsDoubleMiter) {
                hRightBottom = length - rightDoubleMiter.bottomCutback;
                hRightTop = length - rightDoubleMiter.topCutback;
                hRightLongPointX = length;
                hRightLongPointY = h - rightDoubleMiter.dropdown;  // Dropdown measured from TOP
            } else if (rightIsFlangeMiter) {
                hRightBottom = length - rightNearOffset;
                hRightTop = length - rightNearOffset;
                hRightLongPointX = null;
                hRightLongPointY = null;
            } else {
                hRightBottom = length - rightBottomOffset;
                hRightTop = length - rightTopOffset;
                hRightLongPointX = null;
                hRightLongPointY = null;
            }
            
            // Generate h-face contour
            block += this.formatAKLine('h', hLeftBottom, 'u', 0);
            
            if (leftIsDoubleMiter) {
                block += this.formatAKLine('', hLeftLongPointX, '', hLeftLongPointY);
                block += this.formatAKLine('', hLeftTop, '', h);
            } else {
                block += this.formatAKLine('', hLeftTop, '', h);
            }
            
            if (rightIsDoubleMiter) {
                block += this.formatAKLine('', hRightTop, '', h);
                block += this.formatAKLine('', hRightLongPointX, '', hRightLongPointY);
                block += this.formatAKLine('', hRightBottom, '', 0);
            } else {
                block += this.formatAKLine('', hRightTop, '', h);
                block += this.formatAKLine('', hRightBottom, '', 0);
            }
            
            block += this.formatAKLine('', hLeftBottom, '', 0);
            
        } else {
            // Original logic for non-double-miter cases
            // Determine X positions at bottom and top of v-face
            const vLeftBottom = leftIsFlangeMiter ? leftFarOffset : leftBottomOffset;
            const vLeftTop = leftIsFlangeMiter ? leftFarOffset : leftTopOffset;
            const vRightBottom = leftIsFlangeMiter ? length - rightFarOffset : length - rightBottomOffset;
            const vRightTop = rightIsFlangeMiter ? length - rightFarOffset : length - rightTopOffset;
            
            block += this.formatAKLine('v', vLeftBottom, 'u', startY);
            
            // Left bottom cope step down
            if (leftBottomCope) {
                block += this.formatAKLine('', leftBottomCope.length, '', leftBottomCope.depth);
                block += this.formatAKLine('', leftBottomCope.length, '', 0);
            }
            
            // Right bottom cope step up
            if (rightBottomCope) {
                block += this.formatAKLine('', length - rightBottomCope.length, '', 0);
                block += this.formatAKLine('', length - rightBottomCope.length, '', rightBottomCope.depth);
                block += this.formatAKLine('', vRightBottom, '', rightBottomCope.depth);
            } else {
                block += this.formatAKLine('', vRightBottom, '', 0);
            }
            
            // Right top cope step down
            if (rightTopCope) {
                block += this.formatAKLine('', vRightTop, '', h - rightTopCope.depth);
                if (rightTopCope.radius > 0) {
                    // Arc at inside corner - negative radius for counter-clockwise
                    block += this.formatAKLineWithRadius('', length - rightTopCope.length + rightTopCope.radius, '', h - rightTopCope.depth, -rightTopCope.radius);
                    block += this.formatAKLine('', length - rightTopCope.length, '', h - rightTopCope.depth + rightTopCope.radius);
                } else {
                    block += this.formatAKLine('', length - rightTopCope.length, '', h - rightTopCope.depth);
                }
                block += this.formatAKLine('', length - rightTopCope.length, '', h);
            } else {
                block += this.formatAKLine('', vRightTop, '', h);
            }
            
            // Add notch geometry (from right to left along top edge)
            for (let i = topNotches.length - 1; i >= 0; i--) {
                const notch = topNotches[i];
                block += this.formatAKLine('', notch.x + notch.width, '', h);
                block += this.formatAKLine('', notch.x + notch.width, '', h - notch.depth);
                block += this.formatAKLine('', notch.x, '', h - notch.depth);
                block += this.formatAKLine('', notch.x, '', h);
            }
            
            // Left top cope step up
            if (leftTopCope) {
                block += this.formatAKLine('', leftTopCope.length, '', h);
                block += this.formatAKLine('', leftTopCope.length, '', h - leftTopCope.depth);
                block += this.formatAKLine('', vLeftTop, '', h - leftTopCope.depth);
            } else {
                block += this.formatAKLine('', vLeftTop, '', h);
            }
            
            // Close contour
            block += this.formatAKLine('', vLeftBottom, '', startY);
            
            // ========== h-face (back/near side) ==========
            // Web miter: parallelogram (same as v-face)
            // Flange miter: rectangle at nearOffset position
            block += 'AK\n';
            
            const hLeftBottom = leftIsFlangeMiter ? leftNearOffset : leftBottomOffset;
            const hLeftTop = leftIsFlangeMiter ? leftNearOffset : leftTopOffset;
            const hRightBottom = rightIsFlangeMiter ? length - rightNearOffset : length - rightBottomOffset;
            const hRightTop = rightIsFlangeMiter ? length - rightNearOffset : length - rightTopOffset;
            
            block += this.formatAKLine('h', hLeftBottom, 'u', startY);
            
            if (leftBottomCope) {
                block += this.formatAKLine('', leftBottomCope.length, '', leftBottomCope.depth);
                block += this.formatAKLine('', leftBottomCope.length, '', 0);
            }
            
            if (rightBottomCope) {
                block += this.formatAKLine('', length - rightBottomCope.length, '', 0);
                block += this.formatAKLine('', length - rightBottomCope.length, '', rightBottomCope.depth);
                block += this.formatAKLine('', hRightBottom, '', rightBottomCope.depth);
            } else {
                block += this.formatAKLine('', hRightBottom, '', 0);
            }
            
            if (rightTopCope) {
                block += this.formatAKLine('', hRightTop, '', h - rightTopCope.depth);
                block += this.formatAKLine('', length - rightTopCope.length, '', h - rightTopCope.depth);
                block += this.formatAKLine('', length - rightTopCope.length, '', h);
            } else {
                block += this.formatAKLine('', hRightTop, '', h);
            }
            
            for (let i = topNotches.length - 1; i >= 0; i--) {
                const notch = topNotches[i];
                block += this.formatAKLine('', notch.x + notch.width, '', h);
                block += this.formatAKLine('', notch.x + notch.width, '', h - notch.depth);
                block += this.formatAKLine('', notch.x, '', h - notch.depth);
                block += this.formatAKLine('', notch.x, '', h);
            }
            
            if (leftTopCope) {
                block += this.formatAKLine('', leftTopCope.length, '', h);
                block += this.formatAKLine('', leftTopCope.length, '', h - leftTopCope.depth);
                block += this.formatAKLine('', hLeftTop, '', h - leftTopCope.depth);
            } else {
                block += this.formatAKLine('', hLeftTop, '', h);
            }
            
            block += this.formatAKLine('', hLeftBottom, '', startY);
        }
        
        // ========== o-face (top) ==========
        // Web miter: rectangle at topOffset position
        // Flange miter: parallelogram (nearOffset to farOffset)
        // Double miter: rectangle at topCutback position
        block += 'AK\n';
        
        let oLeftNear, oLeftFar, oRightNear, oRightFar;
        
        if (leftIsDoubleMiter) {
            // Rectangle at topCutback position
            oLeftNear = leftDoubleMiter.topCutback;
            oLeftFar = leftDoubleMiter.topCutback;
        } else if (leftIsFlangeMiter) {
            // Parallelogram for flange miter
            oLeftNear = leftNearOffset;
            oLeftFar = leftFarOffset;
        } else {
            // Rectangle for web miter or no miter
            const oLeftStart = leftTopCope ? leftTopCope.length : leftTopOffset;
            oLeftNear = oLeftStart;
            oLeftFar = oLeftStart;
        }
        
        if (rightIsDoubleMiter) {
            // Rectangle at topCutback position
            oRightNear = length - rightDoubleMiter.topCutback;
            oRightFar = length - rightDoubleMiter.topCutback;
        } else if (rightIsFlangeMiter) {
            oRightNear = length - rightNearOffset;
            oRightFar = length - rightFarOffset;
        } else {
            const oRightEnd = rightTopCope ? length - rightTopCope.length : length - rightTopOffset;
            oRightNear = oRightEnd;
            oRightFar = oRightEnd;
        }
        
        block += this.formatAKLine('o', oLeftNear, 'o', 0);
        block += this.formatAKLine('', oLeftFar, '', w);
        block += this.formatAKLine('', oRightFar, '', w);
        block += this.formatAKLine('', oRightNear, '', 0);
        block += this.formatAKLine('', oLeftNear, '', 0);
        
        // Add IK blocks for each notch on o-face (cutouts)
        for (const notch of topNotches) {
            block += 'IK\n';
            block += this.formatAKLine('o', notch.x, 'o', 0);
            block += this.formatAKLine('', notch.x, '', w);
            block += this.formatAKLine('', notch.x + notch.width, '', w);
            block += this.formatAKLine('', notch.x + notch.width, '', 0);
            block += this.formatAKLine('', notch.x, '', 0);
        }
        
        // ========== u-face (bottom) ==========
        // Web miter: rectangle at bottomOffset position
        // Flange miter: parallelogram (nearOffset to farOffset)
        // Double miter: rectangle at bottomCutback position
        block += 'AK\n';
        
        let uLeftNear, uLeftFar, uRightNear, uRightFar;
        
        if (leftIsDoubleMiter) {
            // Rectangle at bottomCutback position
            uLeftNear = leftDoubleMiter.bottomCutback;
            uLeftFar = leftDoubleMiter.bottomCutback;
        } else if (leftIsFlangeMiter) {
            // Parallelogram for flange miter
            uLeftNear = leftNearOffset;
            uLeftFar = leftFarOffset;
        } else {
            // Rectangle for web miter or no miter
            const uLeftStart = leftBottomCope ? leftBottomCope.length : leftBottomOffset;
            uLeftNear = uLeftStart;
            uLeftFar = uLeftStart;
        }
        
        if (rightIsDoubleMiter) {
            // Rectangle at bottomCutback position
            uRightNear = length - rightDoubleMiter.bottomCutback;
            uRightFar = length - rightDoubleMiter.bottomCutback;
        } else if (rightIsFlangeMiter) {
            uRightNear = length - rightNearOffset;
            uRightFar = length - rightFarOffset;
        } else {
            const uRightEnd = rightBottomCope ? length - rightBottomCope.length : length - rightBottomOffset;
            uRightNear = uRightEnd;
            uRightFar = uRightEnd;
        }
        
        block += this.formatAKLine('u', uLeftNear, 'o', 0);
        block += this.formatAKLine('', uLeftFar, '', w);
        block += this.formatAKLine('', uRightFar, '', w);
        block += this.formatAKLine('', uRightNear, '', 0);
        block += this.formatAKLine('', uLeftNear, '', 0);
        
        // ========== Slotted End Connections ==========
        // Slot is OPEN at tube end, semicircle at inner end
        // Use BO format with 'l' marker - position so tube-end semicircle "floats" past edge
        // The AK contour of the tube will cut off the floating semicircle
        
        if (leftIsSlotted && leftSlotted) {
            const useWebs = leftSlotted.faces === 'webs';
            const slotDimension = useWebs ? h : w;
            const slotCenterY = slotDimension / 2;
            const slotLength = leftSlotted.length;
            const slotWidth = leftSlotted.width;
            const slotRadius = slotWidth / 2;
            
            const face1 = useWebs ? 'v' : 'o';
            const face2 = useWebs ? 'h' : 'u';
            const yRef = useWebs ? 'u' : 'o';
            
            if (leftSlotted.endType === 'radiused') {
                // Position slot so left semicircle extends past X=0 (floats off tube end)
                // X = 0 means straight section starts at tube end
                // Left semicircle extends from -radius to 0 (cut off by tube)
                // Right semicircle ends at slotLength
                const xPos = 0;
                const extension = slotLength - slotRadius;  // Straight section + right semicircle = slotLength
                
                // BO block for first face
                block += 'BO\n';
                const faceStr1 = '  ' + face1;
                const xStr = xPos.toFixed(2).padStart(10);
                const yStr = slotCenterY.toFixed(2).padStart(10);
                const diameterStr = slotWidth.toFixed(2).padStart(10);
                const extensionStr = extension.toFixed(2).padStart(10);
                block += faceStr1 + xStr + yRef + yStr + diameterStr + '      0.00l' + extensionStr + '      0.00      0.00\n';
                
                // BO block for second face
                block += 'BO\n';
                const faceStr2 = '  ' + face2;
                block += faceStr2 + xStr + yRef + yStr + diameterStr + '      0.00l' + extensionStr + '      0.00      0.00\n';
            } else {
                // Square inner end - use IK contours (open at tube end)
                const slotBottomY = slotCenterY - slotRadius;
                const slotTopY = slotCenterY + slotRadius;
                
                block += 'IK\n';
                block += this.formatAKLine(face1, 0, yRef, slotBottomY);
                block += this.formatAKLine('', slotLength, '', slotBottomY);
                block += this.formatAKLine('', slotLength, '', slotTopY);
                block += this.formatAKLine('', 0, '', slotTopY);
                block += this.formatAKLine('', 0, '', slotBottomY);
                
                block += 'IK\n';
                block += this.formatAKLine(face2, 0, yRef, slotBottomY);
                block += this.formatAKLine('', slotLength, '', slotBottomY);
                block += this.formatAKLine('', slotLength, '', slotTopY);
                block += this.formatAKLine('', 0, '', slotTopY);
                block += this.formatAKLine('', 0, '', slotBottomY);
            }
        }
        
        if (rightIsSlotted && rightSlotted) {
            const useWebs = rightSlotted.faces === 'webs';
            const slotDimension = useWebs ? h : w;
            const slotCenterY = slotDimension / 2;
            const slotLength = rightSlotted.length;
            const slotWidth = rightSlotted.width;
            const slotRadius = slotWidth / 2;
            const slotStartX = length - slotLength;  // Inner end of slot
            
            const face1 = useWebs ? 'v' : 'o';
            const face2 = useWebs ? 'h' : 'u';
            const yRef = useWebs ? 'u' : 'o';
            
            if (rightSlotted.endType === 'radiused') {
                // Position slot so right semicircle extends past X=length (floats off tube end)
                // Left semicircle starts at slotStartX
                // X = slotStartX + radius (start of straight section)
                // Right semicircle extends past tube end
                const xPos = slotStartX + slotRadius;
                const extension = slotLength - slotRadius;  // Straight section length
                
                // BO block for first face
                block += 'BO\n';
                const faceStr1 = '  ' + face1;
                const xStr = xPos.toFixed(2).padStart(10);
                const yStr = slotCenterY.toFixed(2).padStart(10);
                const diameterStr = slotWidth.toFixed(2).padStart(10);
                const extensionStr = extension.toFixed(2).padStart(10);
                block += faceStr1 + xStr + yRef + yStr + diameterStr + '      0.00l' + extensionStr + '      0.00      0.00\n';
                
                // BO block for second face
                block += 'BO\n';
                const faceStr2 = '  ' + face2;
                block += faceStr2 + xStr + yRef + yStr + diameterStr + '      0.00l' + extensionStr + '      0.00      0.00\n';
            } else {
                // Square inner end - use IK contours (open at tube end)
                const slotBottomY = slotCenterY - slotRadius;
                const slotTopY = slotCenterY + slotRadius;
                
                block += 'IK\n';
                block += this.formatAKLine(face1, slotStartX, yRef, slotBottomY);
                block += this.formatAKLine('', slotStartX, '', slotTopY);
                block += this.formatAKLine('', length, '', slotTopY);
                block += this.formatAKLine('', length, '', slotBottomY);
                block += this.formatAKLine('', slotStartX, '', slotBottomY);
                
                block += 'IK\n';
                block += this.formatAKLine(face2, slotStartX, yRef, slotBottomY);
                block += this.formatAKLine('', slotStartX, '', slotTopY);
                block += this.formatAKLine('', length, '', slotTopY);
                block += this.formatAKLine('', length, '', slotBottomY);
                block += this.formatAKLine('', slotStartX, '', slotBottomY);
            }
        }
        
        return block;
    }
    
    /**
     * Generate AK contours for wide flange profiles
     */
    generateWFContours(dims, length, leftCut, rightCut) {
        const h = dims.depth * this.INCH_TO_MM;
        const w = dims.flange_width * this.INCH_TO_MM;
        
        let block = '';
        
        // v-face (web)
        block += 'AK\n';
        block += this.formatAKLine('v', 0, 'u', 0);
        block += this.formatAKLine('', length, '', 0);
        block += this.formatAKLine('', length, '', h);
        block += this.formatAKLine('', 0, '', h);
        block += this.formatAKLine('', 0, '', 0);
        
        // o-face (top flange)
        block += 'AK\n';
        block += this.formatAKLine('o', 0, 'o', 0);
        block += this.formatAKLine('', 0, '', w);
        block += this.formatAKLine('', length, '', w);
        block += this.formatAKLine('', length, '', 0);
        block += this.formatAKLine('', 0, '', 0);
        
        // u-face (bottom flange)
        block += 'AK\n';
        block += this.formatAKLine('u', 0, 'o', 0);
        block += this.formatAKLine('', length, '', 0);
        block += this.formatAKLine('', length, '', w);
        block += this.formatAKLine('', 0, '', w);
        block += this.formatAKLine('', 0, '', 0);
        
        return block;
    }
    
    /**
     * Generate AK contours for plate profiles
     * If partDefinition exists, AK = stock rectangle, IK = custom part cutout (open 3-sided path)
     */
    generatePlateContours(dims, length, leftCut, rightCut, partDefinition) {
        const t = dims.thickness * this.INCH_TO_MM;
        
        let block = '';
        
        // If custom part definition exists: AK = stock rectangle, IK = custom part cutout
        if (partDefinition && partDefinition.partWidth > 0 && partDefinition.partLength > 0) {
            const stockW = dims.width * this.INCH_TO_MM;
            const partW = partDefinition.partWidth * this.INCH_TO_MM;
            const partL = partDefinition.partLength * this.INCH_TO_MM;
            
            // Custom part shares the NEAR SIDE edge (y=0) with the stock.
            // The torch fires up off the near side of the stock and moves in,
            // cutting like a lengthwise edge cut — no pierce through the part.
            //
            // Part is centered along X (stock length direction).
            // Part width extends into the stock from y=0 toward y=partW.
            // No rotation needed: part X = stock X, part Y = stock Y.
            
            const partOffsetX = (length - partL) / 2;  // centered along stock length
            const partOffsetY = 0;  // shares near side edge (y=0)
            
            // Part corners in stock coordinate space
            const px1 = partOffsetX;           // left end of part
            const px2 = partOffsetX + partL;   // right end of part
            const py1 = 0;                     // near side (shared with stock edge)
            const py2 = partW;                 // far side of part (into stock)
            
            // Corner dimensions in mm
            const corners = partDefinition.corners;
            let cNL_X = (corners.nearLeft.dimX || 0) * this.INCH_TO_MM;
            let cNL_Y = (corners.nearLeft.dimY || 0) * this.INCH_TO_MM;
            let cFL_X = (corners.farLeft.dimX || 0) * this.INCH_TO_MM;
            let cFL_Y = (corners.farLeft.dimY || 0) * this.INCH_TO_MM;
            let cNR_X = (corners.nearRight.dimX || 0) * this.INCH_TO_MM;
            let cNR_Y = (corners.nearRight.dimY || 0) * this.INCH_TO_MM;
            let cFR_X = (corners.farRight.dimX || 0) * this.INCH_TO_MM;
            let cFR_Y = (corners.farRight.dimY || 0) * this.INCH_TO_MM;
            
            // === AK: Stock rectangle (outer boundary) ===
            block += 'AK\n';
            block += this.formatAKLinePlate('v', 0, 'u', 0);
            block += this.formatAKLinePlate('v', length, 'u', 0);
            block += this.formatAKLinePlate('v', length, 'u', stockW);
            block += this.formatAKLinePlate('v', 0, 'u', stockW);
            block += this.formatAKLinePlate('v', 0, 'u', 0);
            
            // === IK: Custom part cutout (closed path, shares NEAR SIDE y=0) ===
            // The torch starts off the near side, cuts in, traces the part, exits back out.
            // No coordinate rotation needed — part coords map directly to stock coords with offset.
            //
            // IK path in part-local: NL(0,0) -> FL(0,partW) -> FR(partL,partW) -> NR(partL,0) -> close
            // Shared edge: near side (y=0) — the closing segment along y=0

            // Direct mapping: stock X = partOffsetX + partLocalX, stock Y = partLocalY
            const toStockX = (partLocalX) => partOffsetX + partLocalX;
            const toStockY = (partLocalY) => partLocalY;
            
            const arcs = this._clippedArcs || [];
            
            console.log('IK generation: ' + arcs.length + ' clipped arcs total');
            arcs.forEach((a, i) => {
                console.log('  Arc ' + i + ': edges=' + Array.from(a.edges).join('/') + 
                    ' points=' + a.points.length + 
                    ' start=(' + a.startPoint.x.toFixed(1) + ',' + a.startPoint.y.toFixed(1) + ')' +
                    ' end=(' + a.endPoint.x.toFixed(1) + ',' + a.endPoint.y.toFixed(1) + ')');
            });
            
            // partL and partW already declared above
            const partLocalW = partW;
            
            block += 'IK\n';
            
            // Build path points for the part contour in part-local coords.
            // Path goes: NL(0,0) -> FL(0,partW) -> FR(partL,partW) -> NR(partL,0) -> close to NL
            // Notches add extra steps at corners. Chamfers/diagonals add a single diagonal cut.
            
            const buildCornerPoints = () => {
                const pts = [];
                
                // NL corner (start)
                if (corners.nearLeft.type === 'notch' && cNL_X > 0 && cNL_Y > 0) {
                    pts.push({ x: cNL_X, y: 0 });
                } else if ((corners.nearLeft.type === 'chamfer' || corners.nearLeft.type === 'diagonal') && cNL_X > 0) {
                    pts.push({ x: cNL_X, y: 0 });
                } else {
                    pts.push({ x: 0, y: 0 });
                }
                
                // Left edge up to FL corner
                if (corners.nearLeft.type === 'notch' && cNL_X > 0 && cNL_Y > 0) {
                    // Notch step at NL on the left edge going up
                    // Already started at (cNL_X, 0), now step to (cNL_X, cNL_Y) then (0, cNL_Y)
                    pts.push({ x: cNL_X, y: cNL_Y });
                    pts.push({ x: 0, y: cNL_Y });
                }
                
                // FL corner
                if (corners.farLeft.type === 'notch' && cFL_X > 0 && cFL_Y > 0) {
                    pts.push({ x: 0, y: partLocalW - cFL_Y });
                    pts.push({ x: cFL_X, y: partLocalW - cFL_Y });
                    pts.push({ x: cFL_X, y: partLocalW });
                } else if ((corners.farLeft.type === 'chamfer' || corners.farLeft.type === 'diagonal') && cFL_X > 0) {
                    pts.push({ x: 0, y: partLocalW - cFL_Y });
                    pts.push({ x: cFL_X, y: partLocalW });
                } else {
                    pts.push({ x: 0, y: partLocalW });
                }
                
                // FR corner
                if (corners.farRight.type === 'notch' && cFR_X > 0 && cFR_Y > 0) {
                    pts.push({ x: partL - cFR_X, y: partLocalW });
                    pts.push({ x: partL - cFR_X, y: partLocalW - cFR_Y });
                    pts.push({ x: partL, y: partLocalW - cFR_Y });
                } else if ((corners.farRight.type === 'chamfer' || corners.farRight.type === 'diagonal') && cFR_X > 0) {
                    pts.push({ x: partL - cFR_X, y: partLocalW });
                    pts.push({ x: partL, y: partLocalW - cFR_Y });
                } else {
                    pts.push({ x: partL, y: partLocalW });
                }
                
                // NR corner
                if (corners.nearRight.type === 'notch' && cNR_X > 0 && cNR_Y > 0) {
                    pts.push({ x: partL, y: cNR_Y });
                    pts.push({ x: partL - cNR_X, y: cNR_Y });
                    pts.push({ x: partL - cNR_X, y: 0 });
                } else if ((corners.nearRight.type === 'chamfer' || corners.nearRight.type === 'diagonal') && cNR_X > 0) {
                    pts.push({ x: partL, y: cNR_Y });
                    pts.push({ x: partL - cNR_X, y: 0 });
                } else {
                    pts.push({ x: partL, y: 0 });
                }
                
                // Close back to start
                pts.push({ ...pts[0] });
                
                return pts;
            };
            
            const cornerPts = buildCornerPoints();
            
            if (arcs.length === 0) {
                // No arcs - output the corner points directly
                for (const pt of cornerPts) {
                    block += this.formatAKLinePlate('v', toStockX(pt.x), 'u', toStockY(pt.y));
                }
            } else {
                // Has arcs - splice arc into the corner path
                const arc = arcs[0];
                const arcStart = { x: arc.startPoint.x, y: arc.startPoint.y };
                const arcEnd = { x: arc.endPoint.x, y: arc.endPoint.y };
                
                // Calculate perimeter distance for each corner point
                // Use cumulative distance along the path
                const perimDists = [0];
                for (let i = 1; i < cornerPts.length; i++) {
                    const dx = cornerPts[i].x - cornerPts[i-1].x;
                    const dy = cornerPts[i].y - cornerPts[i-1].y;
                    perimDists.push(perimDists[i-1] + Math.sqrt(dx*dx + dy*dy));
                }
                const totalPerim = perimDists[perimDists.length - 1];
                
                // Find perimeter position for a point by projecting onto path segments
                const getPerimDist = (pt) => {
                    let bestDist = Infinity;
                    let bestPerim = 0;
                    for (let i = 0; i < cornerPts.length - 1; i++) {
                        const ax = cornerPts[i].x, ay = cornerPts[i].y;
                        const bx = cornerPts[i+1].x, by = cornerPts[i+1].y;
                        const segLen = Math.sqrt((bx-ax)*(bx-ax) + (by-ay)*(by-ay));
                        if (segLen < 0.01) continue;
                        let t = ((pt.x-ax)*(bx-ax) + (pt.y-ay)*(by-ay)) / (segLen*segLen);
                        t = Math.max(0, Math.min(1, t));
                        const projX = ax + t*(bx-ax);
                        const projY = ay + t*(by-ay);
                        const dist = Math.sqrt((pt.x-projX)*(pt.x-projX) + (pt.y-projY)*(pt.y-projY));
                        if (dist < bestDist) {
                            bestDist = dist;
                            bestPerim = perimDists[i] + t * (perimDists[i+1] - perimDists[i]);
                        }
                    }
                    return bestPerim;
                };
                
                let arcStartDist = getPerimDist(arcStart);
                let arcEndDist = getPerimDist(arcEnd);
                let arcPts = arc.points;
                
                if (arcStartDist > arcEndDist) {
                    const tmp = arcStartDist;
                    arcStartDist = arcEndDist;
                    arcEndDist = tmp;
                    arcPts = [...arc.points].reverse();
                }
                
                console.log('Arc perim dists: start=' + arcStartDist.toFixed(1) + ' end=' + arcEndDist.toFixed(1) + ' total=' + totalPerim.toFixed(1));
                
                // Output path: corners before arc, then arc, then corners after arc
                let arcInserted = false;
                
                // Output first point
                block += this.formatAKLinePlate('v', toStockX(cornerPts[0].x), 'u', toStockY(cornerPts[0].y));
                
                for (let i = 1; i < cornerPts.length; i++) {
                    const segStart = perimDists[i-1];
                    const segEnd = perimDists[i];
                    
                    if (!arcInserted && arcStartDist >= segStart && arcStartDist <= segEnd) {
                        // Arc starts in this segment - output arc start
                        block += this.formatAKLinePlate('v', toStockX(arcPts[0].x), 'u', toStockY(arcPts[0].y));
                        // Arc polyline
                        for (let j = 1; j < arcPts.length - 1; j++) {
                            block += this.formatAKLinePlate('v', toStockX(arcPts[j].x), 'u', toStockY(arcPts[j].y));
                        }
                        // Arc end
                        block += this.formatAKLinePlate('v', toStockX(arcPts[arcPts.length-1].x), 'u', toStockY(arcPts[arcPts.length-1].y));
                        arcInserted = true;
                        
                        // Skip corners within the arc span
                        while (i < cornerPts.length - 1 && perimDists[i] <= arcEndDist) {
                            i++;
                        }
                        // Output corner after arc
                        if (i < cornerPts.length) {
                            block += this.formatAKLinePlate('v', toStockX(cornerPts[i].x), 'u', toStockY(cornerPts[i].y));
                        }
                    } else if (arcInserted || arcStartDist > segEnd) {
                        // Normal corner point
                        block += this.formatAKLinePlate('v', toStockX(cornerPts[i].x), 'u', toStockY(cornerPts[i].y));
                    } else {
                        block += this.formatAKLinePlate('v', toStockX(cornerPts[i].x), 'u', toStockY(cornerPts[i].y));
                    }
                }
            }
        } else {
            // No custom part - simple stock rectangle (with optional arc clipping)
            const stockW = dims.width * this.INCH_TO_MM;
            
            block += 'AK\n';
            
            // Check for clipped arcs that modify the plate contour
            const arcs = this._clippedArcs || [];
            
            if (arcs.length === 0) {
                // Standard rectangle - no clipping needed
                block += this.formatAKLinePlate('v', 0, 'u', 0);
                block += this.formatAKLinePlate('v', length, 'u', 0);
                block += this.formatAKLinePlate('v', length, 'u', stockW);
                block += this.formatAKLinePlate('v', 0, 'u', stockW);
                block += this.formatAKLinePlate('v', 0, 'u', 0);
            } else {
                // Build contour with arc segments replacing straight edges
                // Plate edges: bottom (y=0), right (x=length), top (y=stockW), left (x=0)
                // Contour goes: origin -> bottom-right -> top-right -> top-left -> origin
                
                // Group arcs by edge and sort by position along that edge
                const rightArcs = arcs.filter(a => a.edges.has('right')).sort((a, b) => {
                    const aMinY = Math.min(a.startPoint.y, a.endPoint.y);
                    const bMinY = Math.min(b.startPoint.y, b.endPoint.y);
                    return aMinY - bMinY;
                });
                const leftArcs = arcs.filter(a => a.edges.has('left')).sort((a, b) => {
                    const aMaxY = Math.max(a.startPoint.y, a.endPoint.y);
                    const bMaxY = Math.max(b.startPoint.y, b.endPoint.y);
                    return bMaxY - aMaxY;  // top to bottom for left edge (going down)
                });
                const topArcs = arcs.filter(a => a.edges.has('top')).sort((a, b) => {
                    const aMaxX = Math.max(a.startPoint.x, a.endPoint.x);
                    const bMaxX = Math.max(b.startPoint.x, b.endPoint.x);
                    return bMaxX - aMaxX;  // right to left for top edge
                });
                const bottomArcs = arcs.filter(a => a.edges.has('bottom')).sort((a, b) => {
                    const aMinX = Math.min(a.startPoint.x, a.endPoint.x);
                    const bMinX = Math.min(b.startPoint.x, b.endPoint.x);
                    return aMinX - bMinX;  // left to right for bottom edge
                });
                
                // Start at origin
                block += this.formatAKLinePlate('v', 0, 'u', 0);
                
                // === Bottom edge (y=0, going left to right) ===
                for (const arc of bottomArcs) {
                    const sorted = [...arc.intersections].filter(p => p.edge === 'bottom').sort((a, b) => a.x - b.x);
                    if (sorted.length === 2) {
                        block += this.formatAKLinePlate('v', sorted[0].x, 'u', 0);
                        const pts = arc.points[0].x < arc.points[arc.points.length - 1].x ? arc.points : [...arc.points].reverse();
                        for (let i = 1; i < pts.length - 1; i++) {
                            block += this.formatAKLinePlate('v', pts[i].x, 'u', pts[i].y);
                        }
                        block += this.formatAKLinePlate('v', sorted[1].x, 'u', 0);
                    }
                }
                
                // Bottom-right corner
                block += this.formatAKLinePlate('v', length, 'u', 0);
                
                // === Right edge (x=length, going bottom to top) ===
                for (const arc of rightArcs) {
                    // Find the two intersection Y values on the right edge
                    const rightInts = arc.intersections.filter(p => p.edge === 'right').sort((a, b) => a.y - b.y);
                    if (rightInts.length === 2) {
                        // Line from current position to lower intersection
                        block += this.formatAKLinePlate('v', length, 'u', rightInts[0].y);
                        // Insert arc points (sorted bottom to top by Y), skip first/last (they match intersections)
                        const pts = arc.points[0].y < arc.points[arc.points.length - 1].y ? arc.points : [...arc.points].reverse();
                        for (let i = 1; i < pts.length - 1; i++) {
                            block += this.formatAKLinePlate('v', pts[i].x, 'u', pts[i].y);
                        }
                        // Back to right edge at upper intersection
                        block += this.formatAKLinePlate('v', length, 'u', rightInts[1].y);
                    }
                }
                
                // Top-right corner
                block += this.formatAKLinePlate('v', length, 'u', stockW);
                
                // === Top edge (y=stockW, going right to left) ===
                for (const arc of topArcs) {
                    const sorted = [...arc.intersections].filter(p => p.edge === 'top').sort((a, b) => b.x - a.x);
                    if (sorted.length === 2) {
                        block += this.formatAKLinePlate('v', sorted[0].x, 'u', stockW);
                        const pts = arc.points[0].x > arc.points[arc.points.length - 1].x ? arc.points : [...arc.points].reverse();
                        for (let i = 1; i < pts.length - 1; i++) {
                            block += this.formatAKLinePlate('v', pts[i].x, 'u', pts[i].y);
                        }
                        block += this.formatAKLinePlate('v', sorted[1].x, 'u', stockW);
                    }
                }
                
                // Top-left corner
                block += this.formatAKLinePlate('v', 0, 'u', stockW);
                
                // === Left edge (x=0, going top to bottom) ===
                for (const arc of leftArcs) {
                    const leftInts = arc.intersections.filter(p => p.edge === 'left').sort((a, b) => b.y - a.y);
                    if (leftInts.length === 2) {
                        block += this.formatAKLinePlate('v', 0, 'u', leftInts[0].y);
                        const pts = arc.points[0].y > arc.points[arc.points.length - 1].y ? arc.points : [...arc.points].reverse();
                        for (let i = 1; i < pts.length - 1; i++) {
                            block += this.formatAKLinePlate('v', pts[i].x, 'u', pts[i].y);
                        }
                        block += this.formatAKLinePlate('v', 0, 'u', leftInts[1].y);
                    }
                }
                
                // Close back to origin
                block += this.formatAKLinePlate('v', 0, 'u', 0);
            }
        }
        
        return block;
    }
    
    /**
     * Format an AK contour line (for HSS, Channel, WF, etc.)
     */
    formatAKLine(face, x, yRef, y) {
        const faceStr = face ? ('  ' + face) : '   ';
        const xStr = x.toFixed(2).padStart(10);
        const yRefStr = yRef || ' ';
        const yStr = y.toFixed(2).padStart(10);
        const zeros = '       0.00       0.00       0.00       0.00       0.00';
        return faceStr + xStr + yRefStr + yStr + zeros + '\n';
    }
    
    /**
     * Format an AK contour line with radius (for HSS, Channel, WF, Pipe copes, etc.)
     * Radius is in column 5 (after X, Y, Z, DZ)
     */
    formatAKLineWithRadius(face, x, yRef, y, radius) {
        const faceStr = face ? ('  ' + face) : '   ';
        const xStr = x.toFixed(2).padStart(10);
        const yRefStr = yRef || ' ';
        const yStr = y.toFixed(2).padStart(10);
        const radiusStr = radius.toFixed(2).padStart(11);
        return faceStr + xStr + yRefStr + yStr + '       0.00       0.00' + radiusStr + '       0.00       0.00\n';
    }
    
    /**
     * Format an AK contour line for plates (simpler format)
     * Reference format: face X yRef Y 0.00 0.00
     */
    formatAKLinePlate(face, x, yRef, y) {
        const faceStr = face ? ('  ' + face) : '  v';
        const xStr = x.toFixed(2).padStart(10);
        const yRefStr = yRef || 'u';
        const yStr = y.toFixed(2).padStart(10);
        return faceStr + xStr + yRefStr + yStr + '     0.00     0.00\n';
    }
    
    /**
     * Format an AK contour line with radius for plate arcs
     * Radius value defines arc from previous point to this point
     */
    formatAKLinePlateWithRadius(face, x, yRef, y, radius) {
        const faceStr = face ? ('  ' + face) : '  v';
        const xStr = x.toFixed(2).padStart(10);
        const yRefStr = yRef || 'u';
        const yStr = y.toFixed(2).padStart(10);
        const radiusStr = radius.toFixed(2).padStart(10);
        return faceStr + xStr + yRefStr + yStr + radiusStr + '\n';
    }
    
    /**
     * Generate operation blocks
     */
    generateOperations(part, scale) {
        let blocks = '';
        
        // Group operations by type
        let holes = part.operations.filter(op => op.type === 'hole' && !op._clipped);
        const thruHoles = part.operations.filter(op => op.type === 'thruHole');
        let slots = part.operations.filter(op => op.type === 'slot');
        const thruSlots = part.operations.filter(op => op.type === 'thruSlot');
        const copes = part.operations.filter(op => op.type === 'cope');
        const marks = part.operations.filter(op => op.type === 'layoutMark');
        
        // Expand thruHoles into two holes on opposite faces
        for (const th of thruHoles) {
            if (th.axis === 'vertical') {
                // Through front/back (v/h faces)
                holes.push({ type: 'hole', face: 'v', x: th.x, y: th.y, diameter: th.diameter });
                holes.push({ type: 'hole', face: 'h', x: th.x, y: th.y, diameter: th.diameter });
            } else {
                // Through top/bottom (o/u faces)
                holes.push({ type: 'hole', face: 'o', x: th.x, y: th.y, diameter: th.diameter });
                holes.push({ type: 'hole', face: 'u', x: th.x, y: th.y, diameter: th.diameter });
            }
        }
        
        // Expand thruSlots into two slots on opposite faces
        for (const ts of thruSlots) {
            if (ts.axis === 'vertical') {
                // Through front/back (v/h faces)
                slots.push({ type: 'slot', face: 'v', x: ts.x, y: ts.y, length: ts.length, width: ts.width, angle: ts.angle, endType: 'round' });
                slots.push({ type: 'slot', face: 'h', x: ts.x, y: ts.y, length: ts.length, width: ts.width, angle: ts.angle, endType: 'round' });
            } else {
                // Through top/bottom (o/u faces)
                slots.push({ type: 'slot', face: 'o', x: ts.x, y: ts.y, length: ts.length, width: ts.width, angle: ts.angle, endType: 'round' });
                slots.push({ type: 'slot', face: 'u', x: ts.x, y: ts.y, length: ts.length, width: ts.width, angle: ts.angle, endType: 'round' });
            }
        }
        
        // For HSS tubes, notches and copes are handled in generateRectTubeContours
        // For other profiles, handle notches and copes separately
        const profileType = part.shape.profileType;
        const isHSS = profileType === 'HSS_SQUARE' || profileType === 'HSS_RECT';
        const notches = isHSS ? [] : part.operations.filter(op => op.type === 'notch');
        const copesToProcess = isHSS ? [] : copes;
        
        // Generate hole blocks (BO)
        if (holes.length > 0) {
            blocks += this.generateHoleBlock(holes, part, scale);
        }
        
        // Generate slot blocks (IK - internal contour)
        if (slots.length > 0) {
            blocks += this.generateSlotBlock(slots, part, scale);
        }
        
        // Generate contour cuts (AK - external contour) - skip notches/copes for HSS (handled in profile contours)
        if (copesToProcess.length > 0 || notches.length > 0) {
            blocks += this.generateContourBlock(copesToProcess, notches, part, scale);
        }
        
        // Generate marking blocks (KO)
        if (marks.length > 0) {
            blocks += this.generateMarkingBlock(marks, part, scale);
        }
        
        return blocks;
    }
    
    /**
     * Generate hole block (BO) - matches working NC1 format
     * Format: face Xs Y diameter
     * Example:   v        305s        64         13
     */
    generateHoleBlock(holes, part, scale) {
        // Determine profile type
        const profileType = part.shape?.profileType || '';
        const isPlate = profileType === 'FLAT';
        const isAngle = profileType === 'ANGLE_EQUAL' || profileType === 'ANGLE_UNEQUAL';
        
        // Calculate part offset for custom part definitions
        // Holes are entered relative to the custom part with Y=0 at the far-left (bottom of preview).
        // NC1 Y=0 is the near side. So we flip Y: stockY = partW - userY
        let holeOffsetX = 0;
        let holeFlipY = false;
        let holePartW = 0;
        if (isPlate && part.partDefinition && part.partDefinition.partWidth > 0 && part.partDefinition.partLength > 0) {
            const partL = part.partDefinition.partLength * this.INCH_TO_MM;
            const stockLength = part.length * this.INCH_TO_MM;
            holeOffsetX = (stockLength - partL) / 2;  // centered along stock length
            holeFlipY = true;
            holePartW = part.partDefinition.partWidth * this.INCH_TO_MM;
        }
        
        console.log('generateHoleBlock: isPlate=' + isPlate + ', isAngle=' + isAngle + ', holes=' + holes.length + 
            ', holeOffsetX=' + holeOffsetX.toFixed(1) + ', holeFlipY=' + holeFlipY);
        
        // Group holes by face
        const holesByFace = {};
        
        holes.forEach(hole => {
            // Convert to mm and apply part offset for custom parts
            const x = hole.x * scale + holeOffsetX;
            const y = holeFlipY ? (holePartW - hole.y * scale) : (hole.y * scale);
            const diameter = hole.diameter * scale;
            
            // Face codes:
            // For plates: v (from reference p1268.nc1)
            // For angles: v=vertical leg, u=horizontal leg (NOT h!)
            // For other profiles: v=web, o=top flange, u=bottom flange, h=back
            let face;
            if (isPlate) {
                face = 'v';  // Plates use 'v' face
            } else if (isAngle) {
                // Map 'h' (horizontal leg input) to 'u' (correct DSTV code)
                face = (hole.face === 'h') ? 'u' : (hole.face || 'v');
            } else {
                face = hole.face || 'v';
            }
            
            if (!holesByFace[face]) {
                holesByFace[face] = [];
            }
            
            holesByFace[face].push({ x, y, diameter, isPlate });
        });
        
        console.log('Faces found:', Object.keys(holesByFace));
        
        // Generate separate BO block for each face
        let block = '';
        
        for (const face in holesByFace) {
            console.log('Generating BO for face:', face);
            block += 'BO\n';
            
            holesByFace[face].forEach(hole => {
                const faceStr = '  ' + face;
                const xStr = hole.x.toFixed(2).padStart(10);
                // yRef: 'o' for plates, 'u' for angles
                const yRef = hole.isPlate ? 'o' : 'u';
                const yStr = hole.y.toFixed(2).padStart(10);
                const diaStr = hole.diameter.toFixed(2).padStart(10);
                
                block += faceStr + xStr + yRef + yStr + diaStr + '\n';
            });
        }
        
        console.log('Final hole block:\n' + block);
        return block;
    }
    
    /**
     * Generate slot block
     * Uses BO format with 'l' marker for slots
     */
    generateSlotBlock(slots, part, scale) {
        const profileType = part.shape?.profileType || '';
        const isPlate = profileType === 'FLAT';
        const isAngle = profileType === 'ANGLE_EQUAL' || profileType === 'ANGLE_UNEQUAL';
        
        // Calculate part offset for custom part definitions
        let slotOffsetX = 0;
        let slotFlipY = false;
        let slotPartW = 0;
        if (isPlate && part.partDefinition && part.partDefinition.partWidth > 0 && part.partDefinition.partLength > 0) {
            const partL = part.partDefinition.partLength * this.INCH_TO_MM;
            const stockLength = part.length * this.INCH_TO_MM;
            slotOffsetX = (stockLength - partL) / 2;
            slotFlipY = true;
            slotPartW = part.partDefinition.partWidth * this.INCH_TO_MM;
        }
        
        console.log('generateSlotBlock: profileType=' + profileType + ', isPlate=' + isPlate + ', isAngle=' + isAngle);
        
        // Group slots by face
        const slotsByFace = {};
        
        slots.forEach(slot => {
            // Face codes:
            // For plates: v (from reference p1268.nc1)
            // For angles: v=vertical leg, u=horizontal leg (map 'h' -> 'u')
            // For HSS: use provided face
            let face;
            if (isPlate) {
                face = 'v';  // Plates use 'v' face
            } else if (isAngle) {
                face = (slot.face === 'h') ? 'u' : (slot.face || 'v');
            } else {
                face = slot.face || 'v';
            }
            
            if (!slotsByFace[face]) {
                slotsByFace[face] = [];
            }
            
            // Calculate slot extension (total length minus diameter)
            // User inputs total slot length, NC1 needs extension beyond the semicircular ends
            const diameter = slot.width * scale;
            const totalLength = slot.length * scale;
            const extension = Math.max(0, totalLength - diameter);  // Extension = total length - diameter
            
            // User enters CENTER position relative to custom part, apply offset and Y flip
            let xPos = slot.x * scale + slotOffsetX;
            let yPos = slotFlipY ? (slotPartW - slot.y * scale) : (slot.y * scale);
            
            if (slot.angle === 90) {
                // Vertical slot - adjust Y to be start of straight section
                yPos = yPos - (extension / 2);
            } else {
                // Horizontal slot - adjust X to be start of straight section
                xPos = xPos - (extension / 2);
            }
            
            slotsByFace[face].push({
                x: xPos,
                y: yPos,
                width: diameter,           // Slot width = diameter
                extension: extension,      // Slot extension (straight section)
                angle: slot.angle || 0,
                isPlate: isPlate
            });
        });
        
        // Generate separate BO block for each face
        let block = '';
        
        for (const face in slotsByFace) {
            block += 'BO\n';
            
            slotsByFace[face].forEach(slot => {
                // BO slot format from reference (p1268.nc1 for plates, a20.nc1 for angles):
                // face X yRef Y diameter 0.00l col6 slotExtension col8
                // The extension is the straight section between semicircular ends
                // Total slot length = diameter + extension
                
                const faceStr = '  ' + face;
                const xStr = slot.x.toFixed(2).padStart(10);
                // yRef: 'o' for plates, 'u' for angles/HSS
                const yRef = slot.isPlate ? 'o' : 'u';
                const yStr = slot.y.toFixed(2).padStart(10);
                const diameterStr = slot.width.toFixed(2).padStart(10);
                const depthStr = '      0.00l';  // 'l' marker indicates slot
                
                // Slot extension and orientation
                let col6, extensionStr, col8;
                if (slot.angle === 90) {
                    // Vertical slot - extension in col7
                    col6 = '      0.00';
                    extensionStr = slot.extension.toFixed(2).padStart(10);
                    col8 = '      0.00';
                } else {
                    // Horizontal slot - extension in col6
                    col6 = slot.extension.toFixed(2).padStart(10);
                    extensionStr = '      0.00';
                    col8 = '      0.00';
                }
                
                block += faceStr + xStr + yRef + yStr + diameterStr + depthStr + col6 + extensionStr + col8 + '\n';
            });
        }
        
        return block;
    }
    
    /**
     * Generate contour block for copes and notches (AK/IK)
     * Uses proper DSTV fixed-width formatting
     */
    generateContourBlock(copes, notches, part, scale) {
        let block = '';
        
        // Copes - use AK for external contour modifications
        copes.forEach(cope => {
            block += 'AK\n';
            
            // Determine face based on cope location
            let face = 'o';  // Top
            if (cope.location === 'bottom') face = 'u';
            
            const startX = cope.end === 'start' ? 0 : (part.length * scale - cope.length * scale);
            const endX = cope.end === 'start' ? (cope.length * scale) : (part.length * scale);
            const depth = cope.depth * scale;
            const radius = cope.radius * scale;
            
            // Cope contour points using proper formatting
            if (radius > 0) {
                block += this.formatAKLine(face, startX, 'o', 0);
                block += this.formatAKLine('', startX, '', depth - radius);
                // Arc point would need radius in column - simplified for now
                block += this.formatAKLine('', startX + radius, '', depth);
                block += this.formatAKLine('', endX, '', depth);
                block += this.formatAKLine('', startX, '', 0);
            } else {
                block += this.formatAKLine(face, startX, 'o', 0);
                block += this.formatAKLine('', startX, '', depth);
                block += this.formatAKLine('', endX, '', depth);
                block += this.formatAKLine('', endX, '', 0);
                block += this.formatAKLine('', startX, '', 0);
            }
        });
        
        // Notches - use IK for internal contours (cutouts)
        notches.forEach(notch => {
            block += 'IK\n';  // IK for internal contour
            
            const face = notch.face || 'o';
            const x = notch.x * scale;
            const y = notch.y * scale;
            const w = notch.width * scale;
            const d = notch.depth * scale;
            const r = notch.radius * scale;
            
            if (r > 0) {
                // Notch with radius corners - closed contour
                block += this.formatAKLine(face, x, 'o', y);
                block += this.formatAKLine('', x, '', y + d - r);
                block += this.formatAKLine('', x + r, '', y + d);
                block += this.formatAKLine('', x + w - r, '', y + d);
                block += this.formatAKLine('', x + w, '', y + d - r);
                block += this.formatAKLine('', x + w, '', y);
                block += this.formatAKLine('', x, '', y);  // Close contour
            } else {
                // Square notch - closed contour
                block += this.formatAKLine(face, x, 'o', y);
                block += this.formatAKLine('', x, '', y + d);
                block += this.formatAKLine('', x + w, '', y + d);
                block += this.formatAKLine('', x + w, '', y);
                block += this.formatAKLine('', x, '', y);  // Close contour
            }
        });
        
        return block;
    }
    
    /**
     * Generate marking block (KO)
     * Uses proper DSTV fixed-width formatting
     */
    generateMarkingBlock(marks, part, scale) {
        let block = '';
        
        marks.forEach(mark => {
            const face = mark.face || 'v';
            
            switch(mark.markType) {
                case 'line':
                    block += 'KO\n';
                    block += this.formatAKLine(face, mark.x * scale, 'o', mark.y * scale);
                    block += this.formatAKLine('', mark.x2 * scale, '', mark.y2 * scale);
                    break;
                    
                case 'point':
                case 'crosshair':
                    // Crosshair as two short lines
                    const size = (mark.size || 0.5) * scale;
                    const cx = mark.x * scale;
                    const cy = mark.y * scale;
                    block += 'KO\n';
                    block += this.formatAKLine(face, cx - size/2, 'o', cy);
                    block += this.formatAKLine('', cx + size/2, '', cy);
                    block += 'KO\n';
                    block += this.formatAKLine(face, cx, 'o', cy - size/2);
                    block += this.formatAKLine('', cx, '', cy + size/2);
                    break;
                    
                case 'text':
                    // Text marking (SI block)
                    block += 'SI\n';
                    block += this.formatAKLine(face, mark.x * scale, 'o', mark.y * scale);
                    // Text content on separate line
                    block += '  ' + (mark.text || '') + '\n';
                    break;
            }
        });
        
        return block;
    }
    
    /**
     * Format number for NC1 output
     */
    formatNumber(value, decimals = 1) {
        if (value === null || value === undefined || isNaN(value)) return '0';
        return value.toFixed(decimals);
    }
    
    /**
     * Generate filename for the NC1 file
     */
    generateFilename(part) {
        const mark = part.partMark || 'PART';
        const clean = mark.replace(/[^a-zA-Z0-9_-]/g, '_');
        return `${clean}.nc1`;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NC1Generator };
}
