/**
 * NC1 Converter - Core Data Models
 * Architecture designed for future expansion:
 * - AI Vision import
 * - DXF import
 * - DSTV import/edit
 * - WF shapes
 */

// ============================================
// SHAPE PROFILE DEFINITIONS
// ============================================

const PROFILE_TYPES = {
    ANGLE_EQUAL: {
        code: 'L',           // DSTV code for L-profile
        name: 'Angle (Equal Leg)',
        faces: ['v', 'h'],   // vertical leg outer, horizontal leg outer
        faceNames: {
            v: 'Vertical Leg (outer)',
            h: 'Horizontal Leg (outer)'
        }
    },
    ANGLE_UNEQUAL: {
        code: 'L',           // DSTV code for L-profile
        name: 'Angle (Unequal Leg)',
        faces: ['v', 'h'],   // vertical leg outer (long), horizontal leg outer (short)
        faceNames: {
            v: 'Vertical Leg (long leg outer)',
            h: 'Horizontal Leg (short leg outer)'
        }
    },
    HSS_ROUND: {
        code: 'B',           // DSTV code - pipes represented as unrolled flat bars
        name: 'HSS Round Tube',
        faces: ['v'],        // unrolled surface (front face)
        faceNames: {
            v: 'Unrolled Surface'
        }
    },
    HSS_SQUARE: {
        code: 'M',           // DSTV code for rectangular/square tube
        name: 'HSS Square Tube',
        faces: ['v', 'h', 'o', 'u'],  // front, back, top, bottom
        faceNames: {
            v: 'Front',
            h: 'Back', 
            o: 'Top',
            u: 'Bottom'
        }
    },
    HSS_RECT: {
        code: 'M',           // DSTV code for rectangular/square tube
        name: 'HSS Rectangular Tube',
        faces: ['v', 'h', 'o', 'u'],  // front, back, top, bottom
        faceNames: {
            v: 'Front',
            h: 'Back', 
            o: 'Top',
            u: 'Bottom'
        }
    },
    PIPE: {
        code: 'B',           // DSTV code - pipes represented as unrolled flat bars
        name: 'Pipe',
        faces: ['v'],        // unrolled surface (front face)
        faceNames: {
            v: 'Unrolled Surface'
        }
    },
    CHANNEL: {
        code: 'U',           // DSTV code for U-profile
        name: 'Channel',
        faces: ['v', 'h', 'o', 'u'],
        faceNames: {
            v: 'Web (Outside)',
            h: 'Web (Inside)',
            o: 'Top Flange',
            u: 'Bottom Flange'
        }
    },
    FLAT: {
        code: 'B',           // DSTV code for plate
        name: 'Flat Bar',
        faces: ['v', 'h'],   // top, bottom (flat has 2 main faces)
        faceNames: {
            v: 'Top',
            h: 'Bottom'
        }
    },
    // Future: Wide Flange
    WF: {
        code: 'I',           // DSTV code for I-profile
        name: 'Wide Flange',
        faces: ['v', 'h', 'o', 'u'],
        faceNames: {
            v: 'Web (Near Side)',
            h: 'Web (Far Side)',
            o: 'Top Flange (Top)',
            u: 'Bottom Flange (Top)'
            // Note: DSTV also supports flange undersides
        }
    }
};

// ============================================
// OPERATION TYPES
// ============================================

const OPERATION_TYPES = {
    END_CONDITION_LEFT: 'endConditionLeft',
    END_CONDITION_RIGHT: 'endConditionRight',
    HOLE: 'hole',
    THRU_HOLE: 'thruHole',
    SLOT: 'slot',
    THRU_SLOT: 'thruSlot',
    COPE: 'cope',
    PIPE_COPE: 'pipeCope',
    NOTCH: 'notch',
    LAYOUT_MARK: 'layoutMark',
    WELD_PREP: 'weldPrep'
};

// ============================================
// PART CLASS - Core Data Model
// ============================================

class Part {
    constructor() {
        // Identification
        this.id = this.generateId();
        this.partMark = '';
        this.quantity = 1;
        
        // Source tracking (for future AI/DXF import)
        this.source = {
            type: 'manual',  // 'manual', 'ai_vision', 'dxf', 'dstv_import'
            file: null,
            confidence: null,
            importDate: null
        };
        
        // Shape definition
        this.shape = {
            profileType: null,    // HSS, PIPE, CHANNEL, FLAT, WF
            designation: null,    // e.g., "HSS6X4X1/4"
            dimensions: {}        // Profile-specific dimensions
        };
        
        // Part geometry
        this.length = 0;          // inches (stock length for FLAT)
        
        // Part definition for FLAT (custom plate cutting)
        this.partDefinition = null;  // Set when FLAT with custom part
        
        // Operations array - all cuts, holes, marks, etc.
        this.operations = [];
        
        // Metadata
        this.notes = '';
        this.createdDate = new Date().toISOString();
        this.modifiedDate = new Date().toISOString();
    }
    
    generateId() {
        return 'part_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    setShape(profileType, designation, dimensions) {
        this.shape.profileType = profileType;
        this.shape.designation = designation;
        this.shape.dimensions = dimensions;
        this.modifiedDate = new Date().toISOString();
    }
    
    addOperation(operation) {
        operation.id = 'op_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        this.operations.push(operation);
        this.modifiedDate = new Date().toISOString();
        return operation.id;
    }
    
    removeOperation(operationId) {
        this.operations = this.operations.filter(op => op.id !== operationId);
        this.modifiedDate = new Date().toISOString();
    }
    
    updateOperation(operationId, updates) {
        const op = this.operations.find(op => op.id === operationId);
        if (op) {
            Object.assign(op, updates);
            this.modifiedDate = new Date().toISOString();
        }
    }
    
    // Validation
    validate() {
        const errors = [];
        
        if (!this.partMark) errors.push('Part mark is required');
        if (!this.shape.profileType) errors.push('Shape type is required');
        if (!this.shape.designation) errors.push('Shape size is required');
        if (this.length <= 0) errors.push('Length must be greater than 0');
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
    
    // Clone for quantity production
    clone() {
        const newPart = new Part();
        newPart.partMark = this.partMark;
        newPart.quantity = this.quantity;
        newPart.shape = JSON.parse(JSON.stringify(this.shape));
        newPart.length = this.length;
        newPart.operations = JSON.parse(JSON.stringify(this.operations));
        newPart.notes = this.notes;
        newPart.source = { ...this.source };
        return newPart;
    }
    
    // Export to plain object (for JSON serialization)
    toJSON() {
        return {
            id: this.id,
            partMark: this.partMark,
            quantity: this.quantity,
            source: this.source,
            shape: this.shape,
            length: this.length,
            operations: this.operations,
            notes: this.notes,
            createdDate: this.createdDate,
            modifiedDate: this.modifiedDate
        };
    }
    
    // Import from plain object
    static fromJSON(data) {
        const part = new Part();
        Object.assign(part, data);
        return part;
    }
}

// ============================================
// OPERATION CLASSES
// ============================================

class EndConditionLeft {
    constructor() {
        this.type = OPERATION_TYPES.END_CONDITION_LEFT;
        this.cutType = 'square';  // 'square', 'miter', 'doubleMiter'
        
        // Angle (degrees from square, e.g. 45 for a 45-degree miter)
        this.webAngle = 45;
        this.flangeAngle = 90;    // For compound cuts (future)
        
        // Long point location
        this.longPointLocation = 'top';  // 'top' or 'bottom'
        
        // Double miter properties (inches)
        this.topCutback = 0;      // Distance from long point to top flange corner
        this.bottomCutback = 0;   // Distance from long point to bottom flange corner
        this.dropdown = 0;        // Distance from top corner down to long point on web
    }
}

class EndConditionRight {
    constructor() {
        this.type = OPERATION_TYPES.END_CONDITION_RIGHT;
        this.cutType = 'square';  // 'square', 'miter', 'doubleMiter'
        
        // Angle (degrees from square, e.g. 45 for a 45-degree miter)
        this.webAngle = 45;
        this.flangeAngle = 90;    // For compound cuts (future)
        
        // Long point location
        this.longPointLocation = 'top';  // 'top' or 'bottom'
        
        // Double miter properties (inches)
        this.topCutback = 0;      // Distance from long point to top flange corner
        this.bottomCutback = 0;   // Distance from long point to bottom flange corner
        this.dropdown = 0;        // Distance from top corner down to long point on web
    }
}

class Hole {
    constructor() {
        this.type = OPERATION_TYPES.HOLE;
        this.face = 'v';          // Which face
        this.x = 0;               // Distance from start
        this.y = 0;               // Distance from reference edge
        this.diameter = 0;
        this.holeType = 'through';  // 'through', 'blind', 'countersunk', 'tapped'
        
        // For slotted holes
        this.slotLength = 0;      // 0 = round hole
        this.slotAngle = 0;       // Slot orientation
        
        // Additional
        this.depth = null;        // For blind holes
        this.thread = null;       // For tapped holes (e.g., "1/2-13")
    }
}

class Slot {
    constructor() {
        this.type = OPERATION_TYPES.SLOT;
        this.face = 'v';
        this.x = 0;               // Center X from start
        this.y = 0;               // Center Y from reference
        this.length = 0;          // Slot length
        this.width = 0;           // Slot width
        this.angle = 0;           // Rotation angle
        this.endType = 'round';   // 'round', 'square'
    }
}

class Cope {
    constructor() {
        this.type = OPERATION_TYPES.COPE;
        this.end = 'start';       // 'start' or 'end'
        this.location = 'top';    // 'top', 'bottom', 'both'
        this.depth = 0;           // How deep into web
        this.length = 0;          // Along the length
        this.radius = 0;          // Corner radius
        this.flangeSetback = 0;   // Flange cut setback
    }
}

class PipeCope {
    constructor() {
        this.type = OPERATION_TYPES.PIPE_COPE;
        this.end = 'left';              // 'left' or 'right'
        this.headerOD = 0;              // OD of header pipe (inches)
        this.intersectionAngle = 90;    // Angle between pipes (degrees)
        this.offset = 0;                // Lateral offset from center (inches)
        this.rotation = 0;              // Angular position around pipe (degrees)
    }
}

class Notch {
    constructor() {
        this.type = OPERATION_TYPES.NOTCH;
        this.face = 'v';
        this.x = 0;               // Start position
        this.y = 0;               // Y position
        this.width = 0;
        this.depth = 0;
        this.radius = 0;          // Corner radius
    }
}

class ThruHole {
    constructor() {
        this.type = 'thruHole';
        this.axis = 'vertical';   // 'vertical' (v/h faces) or 'horizontal' (o/u faces)
        this.x = 0;               // Distance from start
        this.y = 0;               // Distance from reference edge
        this.diameter = 0;
    }
}

class ThruSlot {
    constructor() {
        this.type = 'thruSlot';
        this.axis = 'vertical';   // 'vertical' (v/h faces) or 'horizontal' (o/u faces)
        this.x = 0;               // Center X from start
        this.y = 0;               // Center Y from reference
        this.length = 0;          // Slot length
        this.width = 0;           // Slot width (end diameter)
        this.angle = 0;           // 0 = horizontal, 90 = vertical
    }
}

class LayoutMark {
    constructor() {
        this.type = OPERATION_TYPES.LAYOUT_MARK;
        this.face = 'v';
        this.markType = 'line';   // 'line', 'point', 'text', 'crosshair'
        this.x = 0;
        this.y = 0;
        
        // For lines
        this.x2 = 0;
        this.y2 = 0;
        
        // For text
        this.text = '';
        this.textHeight = 0.25;
        
        // For crosshairs/points
        this.size = 0.5;
    }
}

class WeldPrep {
    constructor() {
        this.type = OPERATION_TYPES.WELD_PREP;
        this.end = 'start';
        this.face = 'all';        // 'all', 'v', 'h', 'o', 'u'
        this.prepType = 'bevel';  // 'bevel', 'vGroove', 'jGroove', 'kGroove'
        this.angle = 37.5;        // Bevel angle
        this.rootFace = 0.0625;   // Land/root face
        this.rootGap = 0.125;     // Root opening
    }
}

// ============================================
// PROJECT CLASS - Container for multiple parts
// ============================================

class Project {
    constructor(name = 'Untitled Project') {
        this.id = 'proj_' + Date.now();
        this.name = name;
        this.parts = [];
        this.createdDate = new Date().toISOString();
        this.modifiedDate = new Date().toISOString();
        this.settings = {
            units: 'inches',      // 'inches' or 'mm'
            precision: 4          // Decimal places
        };
    }
    
    addPart(part) {
        this.parts.push(part);
        this.modifiedDate = new Date().toISOString();
    }
    
    removePart(partId) {
        this.parts = this.parts.filter(p => p.id !== partId);
        this.modifiedDate = new Date().toISOString();
    }
    
    getPart(partId) {
        return this.parts.find(p => p.id === partId);
    }
    
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            parts: this.parts.map(p => p.toJSON()),
            createdDate: this.createdDate,
            modifiedDate: this.modifiedDate,
            settings: this.settings
        };
    }
    
    static fromJSON(data) {
        const project = new Project(data.name);
        project.id = data.id;
        project.parts = data.parts.map(p => Part.fromJSON(p));
        project.createdDate = data.createdDate;
        project.modifiedDate = data.modifiedDate;
        project.settings = data.settings || project.settings;
        return project;
    }
}

// ============================================
// EXPORT
// ============================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PROFILE_TYPES,
        OPERATION_TYPES,
        Part,
        EndCut,
        Hole,
        Slot,
        Cope,
        PipeCope,
        Notch,
        LayoutMark,
        WeldPrep,
        Project
    };
}
