/**
 * NC1 Converter - Main Application
 */

class NC1ConverterApp {
    constructor() {
        this.shapesData = null;
        this.currentPart = new Part();
        this.project = new Project();
        this.generator = new NC1Generator();
        this.unitMode = 'inches';  // 'inches' or 'feet-inches'
        
        this.init();
    }
    
    init() {
        // Load shape data synchronously (it's already embedded)
        this.loadShapesData();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize UI
        this.updateUI();
        
        // Verify initialization
        console.log('NC1 Converter initialized');
        console.log('Shape data loaded:', this.shapesData ? 'YES' : 'NO');
        if (this.shapesData) {
            console.log('Categories:', Object.keys(this.shapesData));
        }
        const shapeTypeEl = document.getElementById('shapeType');
        console.log('shapeType element found:', shapeTypeEl ? 'YES' : 'NO');
    }
    
    loadShapesData() {
        // Use embedded data (SHAPES_DATA from shapes-data.js)
        // This avoids fetch() issues when running locally via file:// protocol
        if (typeof SHAPES_DATA !== 'undefined') {
            this.shapesData = SHAPES_DATA;
            console.log('Shapes data loaded:', {
                angle_equal: this.shapesData.angle_equal.length,
                angle_unequal: this.shapesData.angle_unequal.length,
                hss_round: this.shapesData.hss_round.length,
                hss_square: this.shapesData.hss_square.length,
                hss_rect: this.shapesData.hss_rect.length,
                pipe: this.shapesData.pipe.length,
                channel: this.shapesData.channel.length,
                flat: this.shapesData.flat.length
            });
        } else {
            console.error('SHAPES_DATA not found');
            this.showMessage('Failed to load shape database', 'error');
        }
    }
    
    populateShapeSelectors() {
        const sizeSelect = document.getElementById('shapeSize');
        if (!sizeSelect) return;
        
        sizeSelect.innerHTML = '<option value="">Select size...</option>';
    }
    
    setupEventListeners() {
        // Shape type dropdown
        const shapeTypeSelect = document.getElementById('shapeType');
        if (shapeTypeSelect) {
            shapeTypeSelect.addEventListener('change', (e) => this.handleShapeTypeSelect(e));
        }
        
        // Shape size selection
        const sizeSelect = document.getElementById('shapeSize');
        if (sizeSelect) {
            sizeSelect.addEventListener('change', (e) => this.handleShapeSizeSelect(e));
        }
        
        // Part mark input
        const partMarkInput = document.getElementById('partMark');
        if (partMarkInput) {
            partMarkInput.addEventListener('input', (e) => {
                this.currentPart.partMark = e.target.value;
                this.updatePreview();
            });
        }
        
        // Length input
        const lengthInput = document.getElementById('partLength');
        if (lengthInput) {
            lengthInput.addEventListener('input', (e) => this.handleLengthInput(e));
        }
        
        // Quantity input
        const qtyInput = document.getElementById('partQty');
        if (qtyInput) {
            qtyInput.addEventListener('input', (e) => {
                this.currentPart.quantity = parseInt(e.target.value) || 1;
                this.updatePreview();
            });
        }
        
        // Unit toggle
        document.querySelectorAll('.unit-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleUnitToggle(e));
        });
        
        // Add operation button
        const addOpBtn = document.getElementById('addOperation');
        if (addOpBtn) {
            addOpBtn.addEventListener('click', () => this.showOperationModal());
        }
        
        // Generate NC1 button - direct download
        const generateBtn = document.getElementById('generateNC1');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.downloadNC1());
        }
        
        // Copy NC1 button
        const copyBtn = document.getElementById('copyNC1');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyNC1ToClipboard());
        }
        
        // Clear part button
        const clearBtn = document.getElementById('clearPart');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearCurrentPart());
        }
        
        // Operation type select in modal
        const opTypeSelect = document.getElementById('operationType');
        if (opTypeSelect) {
            opTypeSelect.addEventListener('change', (e) => this.updateOperationForm(e.target.value));
        }
        
        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });
        
        // Modal save button
        const saveOpBtn = document.getElementById('saveOperation');
        if (saveOpBtn) {
            saveOpBtn.addEventListener('click', () => this.saveOperation());
        }
        
        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.handleTabSwitch(e));
        });
        
        // Preview tab switching
        document.querySelectorAll('.preview-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.updatePartPreview();
            });
        });
        
        // Part definition inputs (FLAT)
        const partDefInputs = ['partDefWidth', 'partDefLength'];
        partDefInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', () => this.updatePartDefinition());
            }
        });
        
        const partDefPosition = document.getElementById('partDefPosition');
        if (partDefPosition) {
            partDefPosition.addEventListener('change', () => this.updatePartDefinition());
        }
        
        // Corner dimension inputs (X and Y for each corner)
        const corners = ['nearLeft', 'farLeft', 'nearRight', 'farRight'];
        corners.forEach(corner => {
            const cornerKey = corner.charAt(0).toUpperCase() + corner.slice(1);
            const dimInputX = document.getElementById(`corner${cornerKey}DimX`);
            const dimInputY = document.getElementById(`corner${cornerKey}DimY`);
            if (dimInputX) {
                dimInputX.addEventListener('input', () => this.updatePartDefinition());
            }
            if (dimInputY) {
                dimInputY.addEventListener('input', () => this.updatePartDefinition());
            }
        });
    }
    
    handleShapeTypeSelect(e) {
        const shapeType = e.target.value;
        console.log('=== Shape Type Changed ===');
        console.log('Shape type selected:', shapeType);
        console.log('Shapes data available:', this.shapesData ? 'yes' : 'no');
        
        if (!shapeType) {
            document.getElementById('shapeSize').innerHTML = '<option value="">Select shape type first...</option>';
            this.updateShapeDiagram(null);
            this.hideCustomPartCheckbox();
            this.hidePartDefinition();
            return;
        }
        
        // Populate size dropdown
        this.populateSizeDropdown(shapeType);
        
        // Update diagram
        this.updateShapeDiagram(shapeType);
        
        // Store profile type on current part
        this.currentPart.shape.profileType = shapeType;
        
        // Show/hide custom part checkbox for FLAT
        if (shapeType === 'FLAT') {
            this.showCustomPartCheckbox();
        } else {
            this.hideCustomPartCheckbox();
            this.hidePartDefinition();
        }
    }
    
    populateSizeDropdown(shapeType) {
        console.log('=== populateSizeDropdown ===');
        console.log('Shape type:', shapeType);
        
        const sizeSelect = document.getElementById('shapeSize');
        if (!sizeSelect) {
            console.error('ERROR: shapeSize element not found');
            return;
        }
        console.log('sizeSelect found:', sizeSelect);
        
        if (!this.shapesData) {
            console.error('ERROR: shapesData not loaded');
            return;
        }
        console.log('shapesData keys:', Object.keys(this.shapesData));
        
        sizeSelect.innerHTML = '<option value="">Select size...</option>';
        
        let shapes = null;
        let dataKey = '';
        
        switch(shapeType) {
            case 'ANGLE_EQUAL':
                dataKey = 'angle_equal';
                break;
            case 'ANGLE_UNEQUAL':
                dataKey = 'angle_unequal';
                break;
            case 'HSS_ROUND':
                dataKey = 'hss_round';
                break;
            case 'HSS_SQUARE':
                dataKey = 'hss_square';
                break;
            case 'HSS_RECT':
                dataKey = 'hss_rect';
                break;
            case 'PIPE':
                dataKey = 'pipe';
                break;
            case 'CHANNEL':
                dataKey = 'channel';
                break;
            case 'FLAT':
                dataKey = 'flat';
                break;
            default:
                console.error('Unknown shape type:', shapeType);
                return;
        }
        
        shapes = this.shapesData[dataKey];
        console.log('Data key:', dataKey);
        console.log('Shapes found:', shapes ? shapes.length : 'NONE');
        
        if (!shapes || shapes.length === 0) {
            console.error('No shapes found for:', dataKey);
            return;
        }
        
        // Populate based on shape type
        shapes.forEach((shape, index) => {
            const opt = document.createElement('option');
            
            if (shapeType === 'ANGLE_EQUAL') {
                opt.value = shape.label;
                opt.textContent = shape.label;
                opt.dataset.dims = JSON.stringify({
                    long_leg: shape.long_leg,
                    short_leg: shape.short_leg,
                    t: shape.t,
                    k: shape.k
                });
            } else if (shapeType === 'ANGLE_UNEQUAL') {
                opt.value = shape.label;
                opt.textContent = shape.label;
                opt.dataset.dims = JSON.stringify({
                    long_leg: shape.long_leg,
                    short_leg: shape.short_leg,
                    t: shape.t,
                    k: shape.k
                });
            } else if (shapeType === 'FLAT') {
                const label = `${Utils.toFraction(shape.thickness)}" x ${Utils.toFraction(shape.width)}"`;
                opt.value = label;
                opt.textContent = label;
                opt.dataset.dims = JSON.stringify({
                    thickness: shape.thickness,
                    width: shape.width
                });
            } else if (shapeType === 'HSS_ROUND' || shapeType === 'PIPE') {
                opt.value = shape.label;
                opt.textContent = shape.label;
                opt.dataset.dims = JSON.stringify({
                    od: shape.od,
                    id: shape.id,
                    tdes: shape.tdes,
                    tnom: shape.tnom
                });
            } else if (shapeType === 'HSS_SQUARE' || shapeType === 'HSS_RECT') {
                opt.value = shape.label;
                opt.textContent = shape.label;
                opt.dataset.dims = JSON.stringify({
                    height: shape.height,
                    width: shape.width,
                    tdes: shape.tdes,
                    tnom: shape.tnom
                });
            } else if (shapeType === 'CHANNEL') {
                opt.value = shape.label;
                opt.textContent = shape.label;
                opt.dataset.dims = JSON.stringify({
                    depth: shape.depth,
                    flange_width: shape.flange_width,
                    web_thickness: shape.web_thickness,
                    flange_thickness: shape.flange_thickness
                });
            }
            
            sizeSelect.appendChild(opt);
        });
        
        console.log('Options added:', sizeSelect.options.length - 1);
    }
    
    handleShapeSizeSelect(e) {
        const select = e.target;
        const selectedOption = select.options[select.selectedIndex];
        
        if (!selectedOption || !selectedOption.value) return;
        
        const dims = JSON.parse(selectedOption.dataset.dims || '{}');
        const shapeType = document.getElementById('shapeType')?.value;
        
        this.currentPart.setShape(shapeType, selectedOption.value, dims);
        this.updatePreview();
        this.updateShapeDiagram(shapeType, dims);
    }
    
    handleLengthInput(e) {
        const value = e.target.value;
        let inches = 0;
        
        if (this.unitMode === 'feet-inches') {
            inches = Utils.parseFeetInches(value);
        } else {
            inches = parseFloat(value) || 0;
        }
        
        this.currentPart.length = inches;
        this.updatePreview();
    }
    
    handleUnitToggle(e) {
        const mode = e.currentTarget.dataset.unit;
        this.unitMode = mode;
        
        document.querySelectorAll('.unit-toggle').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.unit === mode);
        });
        
        // Update unit label
        const unitLabel = document.querySelector('.input-unit');
        if (unitLabel) {
            unitLabel.textContent = mode === 'feet-inches' ? 'ft-in' : 'in';
        }
        
        // Update placeholder
        const lengthInput = document.getElementById('partLength');
        if (lengthInput) {
            lengthInput.placeholder = mode === 'feet-inches' ? "e.g., 10'-6\"" : 'e.g., 126';
        }
    }
    
    handleTabSwitch(e) {
        const tab = e.currentTarget;
        const tabId = tab.dataset.tab;
        
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(tabId)?.classList.add('active');
    }
    
    updateShapeDiagram(shapeType, dims = null) {
        const container = document.getElementById('shapeDiagram');
        if (!container) return;
        
        let svg = '';
        
        switch(shapeType) {
            case 'ANGLE_EQUAL':
                svg = this.drawAngleDiagram(dims, true);
                break;
            case 'ANGLE_UNEQUAL':
                svg = this.drawAngleDiagram(dims, false);
                break;
            case 'HSS_ROUND':
                svg = this.drawHSSRoundDiagram(dims);
                break;
            case 'HSS_SQUARE':
            case 'HSS_RECT':
                svg = this.drawHSSDiagram(dims, shapeType === 'HSS_SQUARE');
                break;
            case 'PIPE':
                svg = this.drawPipeDiagram(dims);
                break;
            case 'CHANNEL':
                svg = this.drawChannelDiagram(dims);
                break;
            case 'FLAT':
                svg = this.drawFlatDiagram(dims);
                break;
            default:
                svg = '<svg viewBox="0 0 200 100"><text x="100" y="50" text-anchor="middle" fill="#64748b" font-size="12">Select a shape type</text></svg>';
        }
        
        container.innerHTML = svg;
    }
    
    drawAngleDiagram(dims, isEqual = true) {
        const longLeg = dims?.long_leg || 4;
        const shortLeg = dims?.short_leg || (isEqual ? 4 : 3);
        const t = dims?.t || 0.375;
        
        const scale = 10;
        const sLong = longLeg * scale;
        const sShort = shortLeg * scale;
        const st = Math.max(t * scale, 3);
        
        // Position for L-shape (heel at origin, oriented heel-up)
        const ox = 70;  // Origin x
        const oy = 100; // Origin y (bottom of diagram)
        
        // Draw L-shape: vertical leg goes up, horizontal leg goes right
        // Heel is at bottom-left corner
        return `
        <svg viewBox="0 0 200 130" class="diagram-svg">
            <!-- L-shape outline -->
            <path d="M ${ox} ${oy}
                     L ${ox} ${oy - sLong}
                     L ${ox + st} ${oy - sLong}
                     L ${ox + st} ${oy - sLong + st}
                     L ${ox + st} ${oy - st}
                     L ${ox + sShort} ${oy - st}
                     L ${ox + sShort} ${oy}
                     Z"
                  fill="none" stroke="#2563eb" stroke-width="2"/>
            <!-- Heel marker -->
            <circle cx="${ox}" cy="${oy}" r="3" fill="#dc2626"/>
            <text x="${ox - 8}" y="${oy + 12}" text-anchor="middle" fill="#dc2626" font-size="8">heel</text>
            <!-- Long leg dimension (vertical) -->
            <line x1="${ox - 15}" y1="${oy}" x2="${ox - 15}" y2="${oy - sLong}" stroke="#64748b" stroke-width="1"/>
            <text x="${ox - 20}" y="${oy - sLong/2}" text-anchor="end" fill="#64748b" font-size="9">${longLeg}"</text>
            <!-- Short leg dimension (horizontal) -->
            <line x1="${ox}" y1="${oy + 15}" x2="${ox + sShort}" y2="${oy + 15}" stroke="#64748b" stroke-width="1"/>
            <text x="${ox + sShort/2}" y="${oy + 25}" text-anchor="middle" fill="#64748b" font-size="9">${shortLeg}"</text>
            <!-- Thickness -->
            <text x="${ox + sShort + 8}" y="${oy - st/2}" fill="#64748b" font-size="8">t=${t}"</text>
            <!-- Label -->
            <text x="100" y="12" text-anchor="middle" fill="#2563eb" font-size="10">${isEqual ? 'Equal Leg Angle' : 'Unequal Leg Angle'}</text>
            <!-- Orientation note -->
            <text x="160" y="50" text-anchor="start" fill="#64748b" font-size="7">Long leg: away</text>
            <text x="160" y="60" text-anchor="start" fill="#64748b" font-size="7">Short leg: toward</text>
            <text x="160" y="70" text-anchor="start" fill="#64748b" font-size="7">(operator view)</text>
        </svg>`;
    }
    
    drawHSSRoundDiagram(dims) {
        const od = dims?.od || 6;
        const t = dims?.tdes || 0.25;
        
        const scale = 8;
        const r = (od/2) * scale;
        const ri = r - (t * scale);
        
        const cx = 100;
        const cy = 60;
        
        return `
        <svg viewBox="0 0 200 120" class="diagram-svg">
            <!-- Outer circle -->
            <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#2563eb" stroke-width="2"/>
            <!-- Inner circle -->
            <circle cx="${cx}" cy="${cy}" r="${ri}" fill="#f8fafc" stroke="#2563eb" stroke-width="1"/>
            <!-- OD dimension -->
            <line x1="${cx - r}" y1="${cy + r + 15}" x2="${cx + r}" y2="${cy + r + 15}" 
                  stroke="#64748b" stroke-width="1"/>
            <text x="${cx}" y="${cy + r + 28}" text-anchor="middle" fill="#64748b" font-size="10">OD ${od}"</text>
            <!-- Wall thickness -->
            <text x="${cx + r + 5}" y="${cy}" fill="#64748b" font-size="9">t=${t}"</text>
            <!-- Label -->
            <text x="${cx}" y="15" text-anchor="middle" fill="#2563eb" font-size="10">HSS Round</text>
        </svg>`;
    }
    
    drawHSSDiagram(dims, isSquare = false) {
        const h = dims?.height || (isSquare ? 6 : 6);
        const w = dims?.width || (isSquare ? 6 : 4);
        const t = dims?.tdes || 0.25;
        
        // Scale for display
        const scale = 15;
        const sh = h * scale;
        const sw = w * scale;
        const st = Math.max(t * scale, 3);
        
        const cx = 100;
        const cy = 60;
        
        return `
        <svg viewBox="0 0 200 120" class="diagram-svg">
            <!-- Outer rectangle -->
            <rect x="${cx - sw/2}" y="${cy - sh/2}" width="${sw}" height="${sh}" 
                  fill="none" stroke="#2563eb" stroke-width="2"/>
            <!-- Inner rectangle (hollow) -->
            <rect x="${cx - sw/2 + st}" y="${cy - sh/2 + st}" 
                  width="${sw - st*2}" height="${sh - st*2}" 
                  fill="#f8fafc" stroke="#2563eb" stroke-width="1"/>
            <!-- Dimension lines -->
            <line x1="${cx - sw/2 - 15}" y1="${cy - sh/2}" x2="${cx - sw/2 - 15}" y2="${cy + sh/2}" 
                  stroke="#64748b" stroke-width="1"/>
            <text x="${cx - sw/2 - 20}" y="${cy}" text-anchor="end" fill="#64748b" font-size="10">${h}"</text>
            <line x1="${cx - sw/2}" y1="${cy + sh/2 + 15}" x2="${cx + sw/2}" y2="${cy + sh/2 + 15}" 
                  stroke="#64748b" stroke-width="1"/>
            <text x="${cx}" y="${cy + sh/2 + 28}" text-anchor="middle" fill="#64748b" font-size="10">${w}"</text>
            <!-- Wall thickness -->
            <text x="${cx + sw/2 + 5}" y="${cy}" fill="#64748b" font-size="9">t=${t}"</text>
        </svg>`;
    }
    
    drawPipeDiagram(dims) {
        const od = dims?.od || 6;
        const t = dims?.tdes || 0.25;
        
        const scale = 8;
        const r = (od/2) * scale;
        const ri = r - (t * scale);
        
        const cx = 100;
        const cy = 60;
        
        return `
        <svg viewBox="0 0 200 120" class="diagram-svg">
            <!-- Outer circle -->
            <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#2563eb" stroke-width="2"/>
            <!-- Inner circle -->
            <circle cx="${cx}" cy="${cy}" r="${ri}" fill="#f8fafc" stroke="#2563eb" stroke-width="1"/>
            <!-- OD dimension -->
            <line x1="${cx - r}" y1="${cy + r + 15}" x2="${cx + r}" y2="${cy + r + 15}" 
                  stroke="#64748b" stroke-width="1"/>
            <text x="${cx}" y="${cy + r + 28}" text-anchor="middle" fill="#64748b" font-size="10">OD ${od}"</text>
            <!-- Wall thickness -->
            <text x="${cx + r + 5}" y="${cy}" fill="#64748b" font-size="9">t=${t}"</text>
        </svg>`;
    }
    
    drawChannelDiagram(dims) {
        const d = dims?.depth || 8;
        const bf = dims?.flange_width || 2.5;
        const tw = dims?.web_thickness || 0.3;
        const tf = dims?.flange_thickness || 0.4;
        
        const scale = 8;
        const sd = d * scale;
        const sbf = bf * scale;
        const stw = Math.max(tw * scale, 2);
        const stf = Math.max(tf * scale, 3);
        
        const cx = 100;
        const cy = 65;
        
        // Channel orientation: toes down, web up
        // Draw as upside-down U shape
        return `
        <svg viewBox="0 0 200 130" class="diagram-svg">
            <text x="${cx}" y="12" text-anchor="middle" fill="#64748b" font-size="8">Toes Down, Web Up</text>
            <!-- C-shape (toes down) - web at top, flanges going down -->
            <path d="M ${cx - sd/2} ${cy - sbf/2}
                     L ${cx + sd/2} ${cy - sbf/2}
                     L ${cx + sd/2} ${cy + sbf/2}
                     L ${cx + sd/2 - stf} ${cy + sbf/2}
                     L ${cx + sd/2 - stf} ${cy - sbf/2 + stw}
                     L ${cx - sd/2 + stf} ${cy - sbf/2 + stw}
                     L ${cx - sd/2 + stf} ${cy + sbf/2}
                     L ${cx - sd/2} ${cy + sbf/2}
                     Z"
                  fill="none" stroke="#2563eb" stroke-width="2"/>
            <!-- Web label (top) -->
            <text x="${cx}" y="${cy - sbf/2 - 5}" text-anchor="middle" fill="#22c55e" font-size="8">Web (v)</text>
            <!-- Near flange label (left) -->
            <text x="${cx - sd/2 - 5}" y="${cy + 5}" text-anchor="end" fill="#f97316" font-size="8">Near (o)</text>
            <!-- Far flange label (right) -->
            <text x="${cx + sd/2 + 5}" y="${cy + 5}" text-anchor="start" fill="#f97316" font-size="8">Far (u)</text>
            <!-- Toes label -->
            <text x="${cx}" y="${cy + sbf/2 + 12}" text-anchor="middle" fill="#64748b" font-size="8">Toes</text>
            <!-- Depth dimension -->
            <text x="${cx}" y="125" text-anchor="middle" fill="#64748b" font-size="9">d=${d}" bf=${bf}"</text>
        </svg>`;
    }
    
    drawFlatDiagram(dims) {
        const t = dims?.thickness || 0.5;
        const w = dims?.width || 4;
        
        const scale = 15;
        const st = Math.max(t * scale, 8);
        const sw = w * scale;
        
        const cx = 100;
        const cy = 60;
        
        return `
        <svg viewBox="0 0 200 120" class="diagram-svg">
            <!-- Flat bar -->
            <rect x="${cx - sw/2}" y="${cy - st/2}" width="${sw}" height="${st}" 
                  fill="none" stroke="#2563eb" stroke-width="2"/>
            <!-- Width dimension -->
            <line x1="${cx - sw/2}" y1="${cy + st/2 + 15}" x2="${cx + sw/2}" y2="${cy + st/2 + 15}" 
                  stroke="#64748b" stroke-width="1"/>
            <text x="${cx}" y="${cy + st/2 + 28}" text-anchor="middle" fill="#64748b" font-size="10">${w}"</text>
            <!-- Thickness dimension -->
            <text x="${cx + sw/2 + 10}" y="${cy + 4}" fill="#64748b" font-size="9">t=${t}"</text>
        </svg>`;
    }
    
    showOperationModal() {
        const modal = document.getElementById('operationModal');
        if (modal) {
            modal.classList.add('active');
            
            // Update dropdown to show which end conditions are already defined
            this.updateOperationTypeDropdown();
            
            // Default to first available option
            const opTypeSelect = document.getElementById('operationType');
            if (opTypeSelect) {
                // Find first non-disabled option
                const firstEnabled = Array.from(opTypeSelect.options).find(opt => !opt.disabled);
                if (firstEnabled) {
                    opTypeSelect.value = firstEnabled.value;
                    this.updateOperationForm(firstEnabled.value);
                }
            }
        }
    }
    
    updateOperationTypeDropdown() {
        const opTypeSelect = document.getElementById('operationType');
        if (!opTypeSelect) return;
        
        // Check which end conditions already exist
        const hasLeftEnd = this.currentPart.operations.some(op => op.type === 'endConditionLeft');
        const hasRightEnd = this.currentPart.operations.some(op => op.type === 'endConditionRight');
        
        // Get profile type
        const profileType = this.currentPart.shape.profileType;
        const isPipe = profileType === 'PIPE' || profileType === 'HSS_ROUND';
        const isHSS = profileType === 'HSS_RECT' || profileType === 'HSS_SQUARE';
        const isChannel = profileType === 'CHANNEL';
        const supportsCopeNotch = isHSS || isChannel;
        
        // Update dropdown options
        Array.from(opTypeSelect.options).forEach(opt => {
            if (opt.value === 'endConditionLeft') {
                opt.disabled = hasLeftEnd;
                opt.textContent = hasLeftEnd ? 'End Condition - Left (already defined)' : 'End Condition - Left';
            } else if (opt.value === 'endConditionRight') {
                opt.disabled = hasRightEnd;
                opt.textContent = hasRightEnd ? 'End Condition - Right (already defined)' : 'End Condition - Right';
            } else if (opt.value === 'pipeCope') {
                // Only show pipe cope for pipe/round shapes
                opt.style.display = isPipe ? '' : 'none';
                opt.disabled = !isPipe;
            } else if (opt.value === 'cope') {
                // Show cope for HSS and Channel shapes
                opt.style.display = supportsCopeNotch ? '' : 'none';
                opt.disabled = !supportsCopeNotch;
            } else if (opt.value === 'notch') {
                // Show notch for HSS and Channel shapes
                opt.style.display = supportsCopeNotch ? '' : 'none';
                opt.disabled = !supportsCopeNotch;
            }
        });
    }
    
    closeModal() {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.classList.remove('active');
        });
    }
    
    updateEndConditionForm(end) {
        const cutType = document.getElementById('opCutType')?.value;
        const endCapitalized = end.charAt(0).toUpperCase() + end.slice(1);
        const miterOptions = document.getElementById(`miterOptions${endCapitalized}`);
        const doubleMiterOptions = document.getElementById(`doubleMiterOptions${endCapitalized}`);
        const slottedOptions = document.getElementById(`slottedOptions${endCapitalized}`);
        const diagramSvg = document.getElementById(`diagram${endCapitalized}Svg`);
        
        if (!diagramSvg) return;
        
        // Hide all option panels first
        if (miterOptions) miterOptions.classList.add('hidden');
        if (doubleMiterOptions) doubleMiterOptions.classList.add('hidden');
        if (slottedOptions) slottedOptions.classList.add('hidden');
        
        if (cutType === 'miter') {
            if (miterOptions) miterOptions.classList.remove('hidden');
            // Update diagram to show miter options
            if (end === 'left') {
                diagramSvg.setAttribute('viewBox', '0 0 200 100');
                diagramSvg.innerHTML = `
                    <text x="100" y="12" text-anchor="middle" fill="#64748b" font-size="9">LEFT END - MITER CUT</text>
                    <text x="50" y="30" text-anchor="middle" fill="#64748b" font-size="8">Long point TOP:</text>
                    <line x1="30" y1="40" x2="90" y2="40" stroke="#2563eb" stroke-width="2"/>
                    <line x1="30" y1="60" x2="90" y2="60" stroke="#2563eb" stroke-width="2"/>
                    <line x1="30" y1="40" x2="45" y2="60" stroke="#dc2626" stroke-width="2"/>
                    <text x="150" y="30" text-anchor="middle" fill="#64748b" font-size="8">Long point BOTTOM:</text>
                    <line x1="110" y1="40" x2="170" y2="40" stroke="#2563eb" stroke-width="2"/>
                    <line x1="110" y1="60" x2="170" y2="60" stroke="#2563eb" stroke-width="2"/>
                    <line x1="125" y1="40" x2="110" y2="60" stroke="#dc2626" stroke-width="2"/>
                    <circle cx="30" cy="40" r="3" fill="#22c55e"/>
                    <circle cx="110" cy="60" r="3" fill="#22c55e"/>
                    <text x="100" y="80" text-anchor="middle" fill="#22c55e" font-size="8">Green dot = long point</text>
                `;
            } else {
                diagramSvg.setAttribute('viewBox', '0 0 200 100');
                diagramSvg.innerHTML = `
                    <text x="100" y="12" text-anchor="middle" fill="#64748b" font-size="9">RIGHT END - MITER CUT</text>
                    <text x="50" y="30" text-anchor="middle" fill="#64748b" font-size="8">Long point TOP:</text>
                    <line x1="10" y1="40" x2="70" y2="40" stroke="#2563eb" stroke-width="2"/>
                    <line x1="10" y1="60" x2="70" y2="60" stroke="#2563eb" stroke-width="2"/>
                    <line x1="55" y1="40" x2="70" y2="60" stroke="#dc2626" stroke-width="2"/>
                    <text x="150" y="30" text-anchor="middle" fill="#64748b" font-size="8">Long point BOTTOM:</text>
                    <line x1="110" y1="40" x2="170" y2="40" stroke="#2563eb" stroke-width="2"/>
                    <line x1="110" y1="60" x2="170" y2="60" stroke="#2563eb" stroke-width="2"/>
                    <line x1="170" y1="40" x2="155" y2="60" stroke="#dc2626" stroke-width="2"/>
                    <circle cx="70" cy="40" r="3" fill="#22c55e"/>
                    <circle cx="170" cy="60" r="3" fill="#22c55e"/>
                    <text x="100" y="80" text-anchor="middle" fill="#22c55e" font-size="8">Green dot = long point</text>
                `;
            }
        } else if (cutType === 'doubleMiter') {
            if (doubleMiterOptions) doubleMiterOptions.classList.remove('hidden');
            // Add input listeners to calculate angles
            this.setupDoubleMiterListeners(end);
            // Update diagram to show double miter
            if (end === 'left') {
                diagramSvg.setAttribute('viewBox', '0 0 200 120');
                diagramSvg.innerHTML = `
                    <text x="100" y="12" text-anchor="middle" fill="#64748b" font-size="9">LEFT END - DOUBLE MITER</text>
                    <rect x="30" y="25" width="140" height="70" fill="none" stroke="#2563eb" stroke-width="2"/>
                    <polygon points="30,25 50,25 30,50" fill="#fee2e2" stroke="#dc2626" stroke-width="2"/>
                    <polygon points="30,95 70,95 30,50" fill="#fee2e2" stroke="#dc2626" stroke-width="2"/>
                    <circle cx="30" cy="50" r="3" fill="#22c55e"/>
                    <text x="22" y="54" text-anchor="end" fill="#22c55e" font-size="7">Long Pt</text>
                    <line x1="30" y1="20" x2="50" y2="20" stroke="#64748b" stroke-width="1"/>
                    <text x="40" y="18" text-anchor="middle" fill="#64748b" font-size="7">Top CB</text>
                    <line x1="30" y1="100" x2="70" y2="100" stroke="#64748b" stroke-width="1"/>
                    <text x="50" y="112" text-anchor="middle" fill="#64748b" font-size="7">Bottom CB</text>
                    <line x1="20" y1="25" x2="20" y2="50" stroke="#64748b" stroke-width="1"/>
                    <text x="10" y="40" text-anchor="middle" fill="#64748b" font-size="7">Drop</text>
                `;
            } else {
                diagramSvg.setAttribute('viewBox', '0 0 200 120');
                diagramSvg.innerHTML = `
                    <text x="100" y="12" text-anchor="middle" fill="#64748b" font-size="9">RIGHT END - DOUBLE MITER</text>
                    <rect x="30" y="25" width="140" height="70" fill="none" stroke="#2563eb" stroke-width="2"/>
                    <polygon points="170,25 150,25 170,50" fill="#fee2e2" stroke="#dc2626" stroke-width="2"/>
                    <polygon points="170,95 130,95 170,50" fill="#fee2e2" stroke="#dc2626" stroke-width="2"/>
                    <circle cx="170" cy="50" r="3" fill="#22c55e"/>
                    <text x="178" y="54" text-anchor="start" fill="#22c55e" font-size="7">Long Pt</text>
                    <line x1="150" y1="20" x2="170" y2="20" stroke="#64748b" stroke-width="1"/>
                    <text x="160" y="18" text-anchor="middle" fill="#64748b" font-size="7">Top CB</text>
                    <line x1="130" y1="100" x2="170" y2="100" stroke="#64748b" stroke-width="1"/>
                    <text x="150" y="112" text-anchor="middle" fill="#64748b" font-size="7">Bottom CB</text>
                    <line x1="180" y1="25" x2="180" y2="50" stroke="#64748b" stroke-width="1"/>
                    <text x="190" y="40" text-anchor="middle" fill="#64748b" font-size="7">Drop</text>
                `;
            }
        } else if (cutType === 'slotted') {
            const slottedOptions = document.getElementById(`slottedOptions${endCapitalized}`);
            if (slottedOptions) slottedOptions.classList.remove('hidden');
            // Update diagram to show slotted end
            if (end === 'left') {
                diagramSvg.setAttribute('viewBox', '0 0 200 100');
                diagramSvg.innerHTML = `
                    <text x="100" y="12" text-anchor="middle" fill="#64748b" font-size="9">LEFT END - SLOTTED CONNECTION</text>
                    <rect x="30" y="25" width="140" height="50" fill="none" stroke="#2563eb" stroke-width="2"/>
                    <rect x="30" y="40" width="60" height="20" fill="#fee2e2" stroke="#dc2626" stroke-width="2"/>
                    <text x="60" y="54" text-anchor="middle" fill="#dc2626" font-size="7">SLOT</text>
                    <text x="100" y="90" text-anchor="middle" fill="#64748b" font-size="8">Slot centered on Y axis</text>
                `;
            } else {
                diagramSvg.setAttribute('viewBox', '0 0 200 100');
                diagramSvg.innerHTML = `
                    <text x="100" y="12" text-anchor="middle" fill="#64748b" font-size="9">RIGHT END - SLOTTED CONNECTION</text>
                    <rect x="30" y="25" width="140" height="50" fill="none" stroke="#2563eb" stroke-width="2"/>
                    <rect x="110" y="40" width="60" height="20" fill="#fee2e2" stroke="#dc2626" stroke-width="2"/>
                    <text x="140" y="54" text-anchor="middle" fill="#dc2626" font-size="7">SLOT</text>
                    <text x="100" y="90" text-anchor="middle" fill="#64748b" font-size="8">Slot centered on Y axis</text>
                `;
            }
        } else {
            // Square cut
            if (end === 'left') {
                diagramSvg.setAttribute('viewBox', '0 0 200 80');
                diagramSvg.innerHTML = `
                    <text x="100" y="12" text-anchor="middle" fill="#64748b" font-size="9">LEFT END - SQUARE CUT</text>
                    <line x1="50" y1="30" x2="150" y2="30" stroke="#2563eb" stroke-width="2"/>
                    <line x1="50" y1="60" x2="150" y2="60" stroke="#2563eb" stroke-width="2"/>
                    <line x1="50" y1="30" x2="50" y2="60" stroke="#dc2626" stroke-width="2"/>
                    <text x="100" y="75" text-anchor="middle" fill="#64748b" font-size="8">90 degree square cut</text>
                `;
            } else {
                diagramSvg.setAttribute('viewBox', '0 0 200 80');
                diagramSvg.innerHTML = `
                    <text x="100" y="12" text-anchor="middle" fill="#64748b" font-size="9">RIGHT END - SQUARE CUT</text>
                    <line x1="50" y1="30" x2="150" y2="30" stroke="#2563eb" stroke-width="2"/>
                    <line x1="50" y1="60" x2="150" y2="60" stroke="#2563eb" stroke-width="2"/>
                    <line x1="150" y1="30" x2="150" y2="60" stroke="#dc2626" stroke-width="2"/>
                    <text x="100" y="75" text-anchor="middle" fill="#64748b" font-size="8">90 degree square cut</text>
                `;
            }
        }
    }
    
    setupDoubleMiterListeners(end) {
        const endCapitalized = end.charAt(0).toUpperCase() + end.slice(1);
        const anglesDiv = document.getElementById(`doubleMiterAngles${endCapitalized}`);
        const topCutbackInput = document.getElementById('opTopCutback');
        const bottomCutbackInput = document.getElementById('opBottomCutback');
        const dropdownInput = document.getElementById('opDropdown');
        
        if (!anglesDiv || !topCutbackInput || !bottomCutbackInput || !dropdownInput) return;
        
        const updateAngles = () => {
            const topCutback = Utils.parseFeetInches(topCutbackInput.value) || 0;
            const bottomCutback = Utils.parseFeetInches(bottomCutbackInput.value) || 0;
            const dropdown = Utils.parseFeetInches(dropdownInput.value) || 0;
            
            // Get shape height
            const dims = this.currentPart?.shape?.dimensions;
            const height = dims?.height || 0;
            
            if (dropdown > 0 && topCutback > 0) {
                const topAngle = Math.atan(topCutback / dropdown) * 180 / Math.PI;
                let angleText = `Top angle: ${topAngle.toFixed(2)} deg`;
                
                if (height > dropdown && bottomCutback > 0) {
                    const bottomAngle = Math.atan(bottomCutback / (height - dropdown)) * 180 / Math.PI;
                    angleText += ` | Bottom angle: ${bottomAngle.toFixed(2)} deg`;
                }
                
                anglesDiv.textContent = angleText;
            } else {
                anglesDiv.textContent = 'Enter values to calculate angles';
            }
        };
        
        topCutbackInput.addEventListener('input', updateAngles);
        bottomCutbackInput.addEventListener('input', updateAngles);
        dropdownInput.addEventListener('input', updateAngles);
    }
    
    // ========== Part Definition Functions (FLAT plates) ==========
    
    showCustomPartCheckbox() {
        const container = document.getElementById('customPartCheckboxContainer');
        if (container) {
            container.classList.remove('hidden');
        }
    }
    
    hideCustomPartCheckbox() {
        const container = document.getElementById('customPartCheckboxContainer');
        const checkbox = document.getElementById('customPartCheckbox');
        if (container) {
            container.classList.add('hidden');
        }
        if (checkbox) {
            checkbox.checked = false;
        }
    }
    
    togglePartDefinition() {
        const checkbox = document.getElementById('customPartCheckbox');
        if (checkbox && checkbox.checked) {
            this.showPartDefinition();
        } else {
            this.hidePartDefinition();
        }
    }
    
    showPartDefinition() {
        const card = document.getElementById('partDefinitionCard');
        if (card) {
            card.classList.remove('hidden');
            // Initialize part definition if not exists
            if (!this.currentPart.partDefinition) {
                this.currentPart.partDefinition = {
                    partWidth: 0,
                    partLength: 0,
                    position: 'centered',
                    clipHolesToContour: false,
                    clipCircle: null,
                    corners: {
                        nearLeft: { type: 'square', dimX: 0, dimY: 0 },
                        farLeft: { type: 'square', dimX: 0, dimY: 0 },
                        nearRight: { type: 'square', dimX: 0, dimY: 0 },
                        farRight: { type: 'square', dimX: 0, dimY: 0 }
                    }
                };
            }
            this.drawPartDefinitionDiagram();
        }
    }
    
    hidePartDefinition() {
        const card = document.getElementById('partDefinitionCard');
        if (card) {
            card.classList.add('hidden');
        }
        // Reset clip holes checkbox and inputs
        const clipCheckbox = document.getElementById('clipHolesToContour');
        if (clipCheckbox) clipCheckbox.checked = false;
        const clipInputs = document.getElementById('clipCircleInputs');
        if (clipInputs) clipInputs.classList.add('hidden');
        // Clear part definition when hidden
        this.currentPart.partDefinition = null;
        this.updatePreview();
    }
    
    updateCornerInput(corner) {
        const cornerKey = corner.charAt(0).toUpperCase() + corner.slice(1);
        const select = document.getElementById(`corner${cornerKey}`);
        const dimInputX = document.getElementById(`corner${cornerKey}DimX`);
        const dimInputY = document.getElementById(`corner${cornerKey}DimY`);
        
        if (!select || !dimInputX || !dimInputY) return;
        
        const type = select.value;
        if (type === 'square') {
            dimInputX.classList.add('hidden');
            dimInputY.classList.add('hidden');
            dimInputX.value = '';
            dimInputY.value = '';
        } else if (type === 'chamfer') {
            // Chamfer: show only X input (equal X and Y)
            dimInputX.classList.remove('hidden');
            dimInputY.classList.add('hidden');
            dimInputX.placeholder = 'chamfer size (in)';
            dimInputY.value = '';
        } else if (type === 'diagonal') {
            // Diagonal: show both X and Y inputs
            dimInputX.classList.remove('hidden');
            dimInputY.classList.remove('hidden');
            dimInputX.placeholder = 'X cut (in)';
            dimInputY.placeholder = 'Y cut (in)';
        } else if (type === 'notch') {
            // Notch: show both X and Y inputs
            dimInputX.classList.remove('hidden');
            dimInputY.classList.remove('hidden');
            dimInputX.placeholder = 'X notch (in)';
            dimInputY.placeholder = 'Y notch (in)';
        }
        
        this.updatePartDefinition();
    }
    
    updatePartDefinition() {
        if (!this.currentPart.partDefinition) return;
        
        // Get values from inputs
        const partWidth = Utils.parseFeetInches(document.getElementById('partDefWidth')?.value) || 0;
        const partLength = Utils.parseFeetInches(document.getElementById('partDefLength')?.value) || 0;
        const position = 'near';  // Always align to near edge
        
        // Update part definition
        this.currentPart.partDefinition.partWidth = partWidth;
        this.currentPart.partDefinition.partLength = partLength;
        this.currentPart.partDefinition.position = position;
        
        // Update clip holes toggle
        const clipCheckbox = document.getElementById('clipHolesToContour');
        this.currentPart.partDefinition.clipHolesToContour = clipCheckbox ? clipCheckbox.checked : false;
        
        // Update clip circle definition
        if (this.currentPart.partDefinition.clipHolesToContour) {
            const diameter = Utils.parseFeetInches(document.getElementById('clipCircleDiameter')?.value) || 0;
            const cx = Utils.parseFeetInches(document.getElementById('clipCircleX')?.value) || 0;
            const cy = Utils.parseFeetInches(document.getElementById('clipCircleY')?.value) || 0;
            this.currentPart.partDefinition.clipCircle = { diameter, x: cx, y: cy };
        } else {
            this.currentPart.partDefinition.clipCircle = null;
        }
        
        // Update corners
        const corners = ['nearLeft', 'farLeft', 'nearRight', 'farRight'];
        
        corners.forEach(corner => {
            const cornerKey = corner.charAt(0).toUpperCase() + corner.slice(1);
            const selectElement = document.getElementById(`corner${cornerKey}`);
            const dimInputX = document.getElementById(`corner${cornerKey}DimX`);
            const dimInputY = document.getElementById(`corner${cornerKey}DimY`);
            const type = selectElement?.value || 'square';
            let dimX = Utils.parseFeetInches(dimInputX?.value) || 0;
            let dimY = Utils.parseFeetInches(dimInputY?.value) || 0;
            
            // For chamfer, use X value for both dimensions
            if (type === 'chamfer') {
                dimY = dimX;
            }
            
            this.currentPart.partDefinition.corners[corner] = { type, dimX, dimY };
        });
        
        // Update diagram and preview
        this.drawPartDefinitionDiagram();
        this.updatePreview();
    }
    
    toggleClipCircle() {
        const checkbox = document.getElementById('clipHolesToContour');
        const inputs = document.getElementById('clipCircleInputs');
        if (checkbox && inputs) {
            if (checkbox.checked) {
                inputs.classList.remove('hidden');
            } else {
                inputs.classList.add('hidden');
                // Clear inputs
                const diam = document.getElementById('clipCircleDiameter');
                const cx = document.getElementById('clipCircleX');
                const cy = document.getElementById('clipCircleY');
                if (diam) diam.value = '';
                if (cx) cx.value = '';
                if (cy) cy.value = '';
            }
        }
        this.updatePartDefinition();
    }
    
    drawPartDefinitionDiagram() {
        const svg = document.getElementById('partDefDiagram');
        if (!svg) return;
        
        const stockWidth = this.currentPart.shape.dimensions?.width || 6;
        const stockLength = this.currentPart.length || 24;
        const partDef = this.currentPart.partDefinition;
        
        if (!partDef || partDef.partWidth <= 0 || partDef.partLength <= 0) {
            svg.innerHTML = `
                <rect x="20" y="30" width="260" height="90" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1"/>
                <text x="150" y="75" text-anchor="middle" fill="#64748b" font-size="10">Enter part dimensions</text>
                <text x="150" y="90" text-anchor="middle" fill="#94a3b8" font-size="8">Stock: ${stockWidth}" x ${stockLength}"</text>
            `;
            return;
        }
        
        // Calculate scale to fit in diagram
        const maxDrawWidth = 260;
        const maxDrawHeight = 90;
        const scaleX = maxDrawWidth / stockLength;
        const scaleY = maxDrawHeight / stockWidth;
        const scale = Math.min(scaleX, scaleY);
        
        const drawStockW = stockLength * scale;
        const drawStockH = stockWidth * scale;
        const drawPartW = partDef.partLength * scale;
        const drawPartH = partDef.partWidth * scale;
        
        const offsetX = (300 - drawStockW) / 2;
        const offsetY = (150 - drawStockH) / 2;
        
        // Calculate part position
        // Part shares the NEAR SIDE edge (bottom of stock in diagram)
        // Part is centered along the stock length (X in diagram)
        const partX = offsetX + (drawStockW - drawPartW) / 2;  // centered along length
        let partY = offsetY + drawStockH - drawPartH;  // flush with bottom (near side)
        
        let svgContent = '';
        
        // Stock outline
        svgContent += `<rect x="${offsetX}" y="${offsetY}" width="${drawStockW}" height="${drawStockH}" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1"/>`;
        
        // Part outline with corner treatments
        // Get X and Y dimensions for each corner
        const corners = partDef.corners;
        const cNL_X = (corners.nearLeft.dimX || 0) * scale;
        const cNL_Y = (corners.nearLeft.dimY || 0) * scale;
        const cFL_X = (corners.farLeft.dimX || 0) * scale;
        const cFL_Y = (corners.farLeft.dimY || 0) * scale;
        const cNR_X = (corners.nearRight.dimX || 0) * scale;
        const cNR_Y = (corners.nearRight.dimY || 0) * scale;
        const cFR_X = (corners.farRight.dimX || 0) * scale;
        const cFR_Y = (corners.farRight.dimY || 0) * scale;
        
        // Build path for part
        // Note: SVG Y is inverted (0 at top), so "near" is top and "far" is bottom
        let path = '';
        const x1 = partX, y1 = partY;  // Top-left (near-left)
        const x2 = partX + drawPartW, y2 = partY;  // Top-right (near-right)
        const x3 = partX + drawPartW, y3 = partY + drawPartH;  // Bottom-right (far-right)
        const x4 = partX, y4 = partY + drawPartH;  // Bottom-left (far-left)
        
        // Start near-left corner
        if ((corners.nearLeft.type === 'chamfer' || corners.nearLeft.type === 'diagonal') && cNL_X > 0) {
            path += `M ${x1 + cNL_X} ${y1} `;
        } else if (corners.nearLeft.type === 'notch' && cNL_X > 0) {
            path += `M ${x1 + cNL_X} ${y1} `;
        } else {
            path += `M ${x1} ${y1} `;
        }
        
        // To near-right corner
        if ((corners.nearRight.type === 'chamfer' || corners.nearRight.type === 'diagonal') && cNR_X > 0) {
            path += `L ${x2 - cNR_X} ${y2} L ${x2} ${y2 + cNR_Y} `;
        } else if (corners.nearRight.type === 'notch' && cNR_X > 0) {
            path += `L ${x2 - cNR_X} ${y2} L ${x2 - cNR_X} ${y2 + cNR_Y} L ${x2} ${y2 + cNR_Y} `;
        } else {
            path += `L ${x2} ${y2} `;
        }
        
        // To far-right corner
        if ((corners.farRight.type === 'chamfer' || corners.farRight.type === 'diagonal') && cFR_X > 0) {
            path += `L ${x3} ${y3 - cFR_Y} L ${x3 - cFR_X} ${y3} `;
        } else if (corners.farRight.type === 'notch' && cFR_X > 0) {
            path += `L ${x3} ${y3 - cFR_Y} L ${x3 - cFR_X} ${y3 - cFR_Y} L ${x3 - cFR_X} ${y3} `;
        } else {
            path += `L ${x3} ${y3} `;
        }
        
        // To far-left corner
        if ((corners.farLeft.type === 'chamfer' || corners.farLeft.type === 'diagonal') && cFL_X > 0) {
            path += `L ${x4 + cFL_X} ${y4} L ${x4} ${y4 - cFL_Y} `;
        } else if (corners.farLeft.type === 'notch' && cFL_X > 0) {
            path += `L ${x4 + cFL_X} ${y4} L ${x4 + cFL_X} ${y4 - cFL_Y} L ${x4} ${y4 - cFL_Y} `;
        } else {
            path += `L ${x4} ${y4} `;
        }
        
        // Back to near-left corner
        if ((corners.nearLeft.type === 'chamfer' || corners.nearLeft.type === 'diagonal') && cNL_Y > 0) {
            path += `L ${x1} ${y1 + cNL_Y} L ${x1 + cNL_X} ${y1} Z`;
        } else if (corners.nearLeft.type === 'notch' && cNL_X > 0) {
            path += `L ${x1} ${y1 + cNL_Y} L ${x1 + cNL_X} ${y1 + cNL_Y} L ${x1 + cNL_X} ${y1} Z`;
        } else {
            path += `L ${x1} ${y1} Z`;
        }
        
        svgContent += `<path d="${path}" fill="#dbeafe" stroke="#3b82f6" stroke-width="2"/>`;
        
        // Draw clip circle if defined
        if (partDef.clipHolesToContour && partDef.clipCircle && partDef.clipCircle.diameter > 0) {
            const cc = partDef.clipCircle;
            const circleCX = partX + cc.x * scale;
            // SVG Y is inverted: part origin (0,0) is at top-left in SVG but bottom-left in part coords
            const circleCY = partY + drawPartH - cc.y * scale;
            const circleR = (cc.diameter / 2) * scale;
            
            // Draw the full circle as dashed outline
            svgContent += `<circle cx="${circleCX}" cy="${circleCY}" r="${circleR}" fill="none" stroke="#ef4444" stroke-width="1" stroke-dasharray="3,2" opacity="0.6"/>`;
            
            // Draw center crosshair
            svgContent += `<line x1="${circleCX - 3}" y1="${circleCY}" x2="${circleCX + 3}" y2="${circleCY}" stroke="#ef4444" stroke-width="1"/>`;
            svgContent += `<line x1="${circleCX}" y1="${circleCY - 3}" x2="${circleCX}" y2="${circleCY + 3}" stroke="#ef4444" stroke-width="1"/>`;
            
            // Clip the part shape to show what the result would look like
            // Create a clip path that is the part rectangle minus the circle
            const clipId = 'clipCircleMask';
            svgContent += `<defs>`;
            svgContent += `<clipPath id="${clipId}">`;
            svgContent += `<path d="${path}"/>`;
            svgContent += `</clipPath>`;
            svgContent += `</defs>`;
            // Draw the circle interior that overlaps the part as a shaded area (material removed)
            svgContent += `<circle cx="${circleCX}" cy="${circleCY}" r="${circleR}" fill="#fecaca" stroke="none" opacity="0.4" clip-path="url(#${clipId})"/>`;
        }
        
        // Labels
        svgContent += `<text x="150" y="12" text-anchor="middle" fill="#1e293b" font-size="9">Stock: ${stockWidth}" x ${stockLength}" | Part: ${partDef.partWidth}" x ${partDef.partLength}"</text>`;
        svgContent += `<text x="${partX + 5}" y="${partY + 12}" fill="#3b82f6" font-size="7">NL</text>`;
        svgContent += `<text x="${partX + drawPartW - 12}" y="${partY + 12}" fill="#3b82f6" font-size="7">NR</text>`;
        svgContent += `<text x="${partX + 5}" y="${partY + drawPartH - 5}" fill="#3b82f6" font-size="7">FL</text>`;
        svgContent += `<text x="${partX + drawPartW - 12}" y="${partY + drawPartH - 5}" fill="#3b82f6" font-size="7">FR</text>`;
        
        svg.innerHTML = svgContent;
    }
    
    updatePipeCopePreview() {
        const svg = document.getElementById('pipeCopePreviewSvg');
        if (!svg) return;
        
        // Get values
        const headerPipeSelect = document.getElementById('opHeaderPipe');
        const headerODInput = document.getElementById('opHeaderOD');
        const angleInput = document.getElementById('opIntersectionAngle');
        
        let headerOD = 0;
        if (headerODInput && headerODInput.value) {
            headerOD = parseFloat(headerODInput.value);
            // Clear dropdown if manual entry
            if (headerPipeSelect) headerPipeSelect.value = '';
        } else if (headerPipeSelect && headerPipeSelect.value) {
            headerOD = parseFloat(headerPipeSelect.value);
            // Clear manual input if dropdown used
            if (headerODInput) headerODInput.value = '';
        }
        
        const angle = angleInput ? parseFloat(angleInput.value) || 90 : 90;
        
        // Get branch pipe OD from current part
        let branchOD = 4; // default for preview
        if (this.currentPart && this.currentPart.shape.dimensions) {
            branchOD = this.currentPart.shape.dimensions.od || 4;
        }
        
        // Update SVG preview
        const headerRadius = headerOD > 0 ? Math.min(headerOD * 4, 50) : 30;
        const branchRadius = Math.min(branchOD * 3, 20);
        
        // Calculate saddle curve based on angle
        const angleRad = angle * Math.PI / 180;
        const saddleDepth = headerRadius * Math.cos(angleRad) * 0.5;
        
        svg.innerHTML = `
            <text x="140" y="15" text-anchor="middle" fill="#1e293b" font-size="10" font-weight="bold">PIPE COPE (Saddle Cut)</text>
            <text x="140" y="30" text-anchor="middle" fill="#64748b" font-size="8">${angle} degree intersection</text>
            <!-- Header pipe (horizontal) -->
            <ellipse cx="140" cy="95" rx="${headerRadius}" ry="${headerRadius * 0.5}" fill="#dbeafe" stroke="#3b82f6" stroke-width="2"/>
            <text x="140" y="130" text-anchor="middle" fill="#3b82f6" font-size="9">Header ${headerOD > 0 ? headerOD.toFixed(2) + '" OD' : ''}</text>
            <!-- Branch pipe (vertical) -->
            <rect x="${140 - branchRadius}" y="40" width="${branchRadius * 2}" height="55" fill="#fee2e2" stroke="#ef4444" stroke-width="2"/>
            <text x="140" y="55" text-anchor="middle" fill="#ef4444" font-size="8">${branchOD.toFixed(2)}"</text>
            <!-- Saddle cut indication -->
            <path d="M ${140 - branchRadius} ${95 - saddleDepth} Q 140 ${95 - saddleDepth - 15} ${140 + branchRadius} ${95 - saddleDepth}" 
                  fill="none" stroke="#22c55e" stroke-width="2" stroke-dasharray="4,2"/>
            <text x="210" y="75" fill="#22c55e" font-size="8">Saddle</text>
            <text x="210" y="85" fill="#22c55e" font-size="8">cut profile</text>
        `;
    }
    
    updateOperationForm(opType) {
        const formContainer = document.getElementById('operationFormFields');
        if (!formContainer) return;
        
        // Check if current shape supports near/far miter options (HSS and Channel)
        const shapeType = this.currentPart?.shape?.profileType;
        const supportsNearFar = shapeType === 'HSS_SQUARE' || shapeType === 'HSS_RECT' || shapeType === 'CHANNEL';
        const nearFarOptions = supportsNearFar ? `
                                <option value="near">Near</option>
                                <option value="far">Far</option>` : '';
        const miterHelperText = supportsNearFar ? 
            '<small class="text-muted">Top/Bottom = web angle, Near/Far = flange angle</small>' : '';
        
        let html = '';
        
        switch(opType) {
            case 'endConditionLeft':
                // Check if shape supports double miter (HSS rectangular only)
                const leftSupportsDoubleMiter = shapeType === 'HSS_SQUARE' || shapeType === 'HSS_RECT';
                const leftIsRectangular = shapeType === 'HSS_RECT';
                const leftDoubleMiterOption = leftSupportsDoubleMiter ? '<option value="doubleMiter">Double Miter</option>' : '';
                const leftSlottedOption = leftSupportsDoubleMiter ? '<option value="slotted">Slotted End Connection</option>' : '';
                
                // Face selection for rectangular tubes (slot can go through webs or flanges)
                const leftFaceSelectHtml = leftIsRectangular ? `
                        <div class="form-group" id="slotFaceSelectLeft" style="display:none;">
                            <label class="form-label">Slot Through Faces</label>
                            <select class="form-select" id="opSlotFaces">
                                <option value="webs">Webs (v/h) - taller faces</option>
                                <option value="flanges">Flanges (o/u) - shorter faces</option>
                            </select>
                        </div>` : '';
                
                html = `
                    <div class="form-group">
                        <label class="form-label">Cut Type</label>
                        <select class="form-select" id="opCutType" onchange="app.updateEndConditionForm('left')">
                            <option value="square">Square (90)</option>
                            <option value="miter">Miter</option>
                            ${leftDoubleMiterOption}
                            ${leftSlottedOption}
                        </select>
                    </div>
                    <div id="miterOptionsLeft" class="hidden">
                        <div class="form-group">
                            <label class="form-label">Angle (degrees from square)</label>
                            <input type="number" class="form-input" id="opWebAngle" value="45" min="1" max="89">
                            <small class="text-muted">e.g. 45 for a 45-degree miter</small>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Long Point Location</label>
                            <select class="form-select" id="opLongPoint">
                                <option value="top">Top</option>
                                <option value="bottom">Bottom</option>
                                ${nearFarOptions}
                            </select>
                            ${miterHelperText}
                        </div>
                    </div>
                    <div id="doubleMiterOptionsLeft" class="hidden">
                        <div class="form-group">
                            <label class="form-label">Top Cutback (from long point to top corner)</label>
                            <input type="text" class="form-input" id="opTopCutback" placeholder="inches">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Bottom Cutback (from long point to bottom corner)</label>
                            <input type="text" class="form-input" id="opBottomCutback" placeholder="inches">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Dropdown (from top corner to long point)</label>
                            <input type="text" class="form-input" id="opDropdown" placeholder="inches">
                        </div>
                        <div id="doubleMiterAnglesLeft" class="text-muted text-sm" style="margin-top: 8px;"></div>
                    </div>
                    <div id="slottedOptionsLeft" class="hidden">
                        ${leftIsRectangular ? `
                        <div class="form-group">
                            <label class="form-label">Slot Through Faces</label>
                            <select class="form-select" id="opSlotFaces">
                                <option value="webs">Webs (v/h faces)</option>
                                <option value="flanges">Flanges (o/u faces)</option>
                            </select>
                        </div>` : ''}
                        <div class="form-group">
                            <label class="form-label">Slot Length</label>
                            <input type="text" class="form-input" id="opSlotLength" placeholder="inches">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Slot Width</label>
                            <input type="text" class="form-input" id="opSlotWidth" placeholder="inches">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Slot End Type</label>
                            <select class="form-select" id="opSlotEndType">
                                <option value="radiused">Radiused</option>
                                <option value="square">Square</option>
                            </select>
                        </div>
                    </div>
                    <div class="diagram-container" id="diagramLeft">
                        <svg viewBox="0 0 200 80" class="diagram-svg" id="diagramLeftSvg">
                            <text x="100" y="12" text-anchor="middle" fill="#64748b" font-size="9">LEFT END - SQUARE CUT</text>
                            <line x1="50" y1="30" x2="150" y2="30" stroke="#2563eb" stroke-width="2"/>
                            <line x1="50" y1="60" x2="150" y2="60" stroke="#2563eb" stroke-width="2"/>
                            <line x1="50" y1="30" x2="50" y2="60" stroke="#dc2626" stroke-width="2"/>
                            <text x="100" y="75" text-anchor="middle" fill="#64748b" font-size="8">90 degree square cut</text>
                        </svg>
                    </div>
                `;
                break;
                
            case 'endConditionRight':
                // Check if shape supports double miter (HSS rectangular only)
                const rightSupportsDoubleMiter = shapeType === 'HSS_SQUARE' || shapeType === 'HSS_RECT';
                const rightIsRectangular = shapeType === 'HSS_RECT';
                const rightDoubleMiterOption = rightSupportsDoubleMiter ? '<option value="doubleMiter">Double Miter</option>' : '';
                const rightSlottedOption = rightSupportsDoubleMiter ? '<option value="slotted">Slotted End Connection</option>' : '';
                
                html = `
                    <div class="form-group">
                        <label class="form-label">Cut Type</label>
                        <select class="form-select" id="opCutType" onchange="app.updateEndConditionForm('right')">
                            <option value="square">Square (90)</option>
                            <option value="miter">Miter</option>
                            ${rightDoubleMiterOption}
                            ${rightSlottedOption}
                        </select>
                    </div>
                    <div id="miterOptionsRight" class="hidden">
                        <div class="form-group">
                            <label class="form-label">Angle (degrees from square)</label>
                            <input type="number" class="form-input" id="opWebAngle" value="45" min="1" max="89">
                            <small class="text-muted">e.g. 45 for a 45-degree miter</small>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Long Point Location</label>
                            <select class="form-select" id="opLongPoint">
                                <option value="top">Top</option>
                                <option value="bottom">Bottom</option>
                                ${nearFarOptions}
                            </select>
                            ${miterHelperText}
                        </div>
                    </div>
                    <div id="doubleMiterOptionsRight" class="hidden">
                        <div class="form-group">
                            <label class="form-label">Top Cutback (from long point to top corner)</label>
                            <input type="text" class="form-input" id="opTopCutback" placeholder="inches">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Bottom Cutback (from long point to bottom corner)</label>
                            <input type="text" class="form-input" id="opBottomCutback" placeholder="inches">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Dropdown (from top corner to long point)</label>
                            <input type="text" class="form-input" id="opDropdown" placeholder="inches">
                        </div>
                        <div id="doubleMiterAnglesRight" class="text-muted text-sm" style="margin-top: 8px;"></div>
                    </div>
                    <div id="slottedOptionsRight" class="hidden">
                        ${rightIsRectangular ? `
                        <div class="form-group">
                            <label class="form-label">Slot Through Faces</label>
                            <select class="form-select" id="opSlotFaces">
                                <option value="webs">Webs (v/h faces)</option>
                                <option value="flanges">Flanges (o/u faces)</option>
                            </select>
                        </div>` : ''}
                        <div class="form-group">
                            <label class="form-label">Slot Length</label>
                            <input type="text" class="form-input" id="opSlotLength" placeholder="inches">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Slot Width</label>
                            <input type="text" class="form-input" id="opSlotWidth" placeholder="inches">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Slot End Type</label>
                            <select class="form-select" id="opSlotEndType">
                                <option value="radiused">Radiused</option>
                                <option value="square">Square</option>
                            </select>
                        </div>
                    </div>
                    <div class="diagram-container" id="diagramRight">
                        <svg viewBox="0 0 200 80" class="diagram-svg" id="diagramRightSvg">
                            <text x="100" y="12" text-anchor="middle" fill="#64748b" font-size="9">RIGHT END - SQUARE CUT</text>
                            <line x1="50" y1="30" x2="150" y2="30" stroke="#2563eb" stroke-width="2"/>
                            <line x1="50" y1="60" x2="150" y2="60" stroke="#2563eb" stroke-width="2"/>
                            <line x1="150" y1="30" x2="150" y2="60" stroke="#dc2626" stroke-width="2"/>
                            <text x="100" y="75" text-anchor="middle" fill="#64748b" font-size="8">90 degree square cut</text>
                        </svg>
                    </div>
                `;
                break;
                
            case 'hole':
                // Get face options based on current shape type
                const holeShapeType = this.currentPart.shape.profileType;
                let holeFaceOptions = '';
                if (holeShapeType === 'ANGLE_EQUAL') {
                    holeFaceOptions = `
                        <option value="v">Vertical Leg (outer)</option>
                        <option value="h">Horizontal Leg (outer)</option>
                    `;
                } else if (holeShapeType === 'ANGLE_UNEQUAL') {
                    holeFaceOptions = `
                        <option value="v">Vertical Leg (long leg outer)</option>
                        <option value="h">Horizontal Leg (short leg outer)</option>
                    `;
                } else {
                    holeFaceOptions = `
                        <option value="v">Front (v)</option>
                        <option value="h">Back (h)</option>
                        <option value="o">Top (o)</option>
                        <option value="u">Bottom (u)</option>
                    `;
                }
                html = `
                    <div class="form-group">
                        <label class="form-label">Face</label>
                        <select class="form-select" id="opFace">
                            ${holeFaceOptions}
                        </select>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">X Position (from left end)</label>
                            <input type="text" class="form-input" id="opX" placeholder="inches">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Y Position (from bottom edge)</label>
                            <input type="text" class="form-input" id="opY" placeholder="inches">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Diameter</label>
                        <input type="text" class="form-input" id="opDiameter" placeholder="inches">
                    </div>
                    <div class="diagram-container">
                        <svg viewBox="0 0 280 120" class="diagram-svg">
                            <text x="140" y="12" text-anchor="middle" fill="#1e293b" font-size="10" font-weight="bold">SIDE VIEW (looking at selected face)</text>
                            <rect x="30" y="25" width="220" height="60" fill="#dbeafe" stroke="#3b82f6" stroke-width="2"/>
                            <circle cx="100" cy="55" r="10" fill="#fee2e2" stroke="#ef4444" stroke-width="2"/>
                            <line x1="30" y1="95" x2="100" y2="95" stroke="#64748b" stroke-width="1"/>
                            <line x1="30" y1="90" x2="30" y2="100" stroke="#64748b" stroke-width="1"/>
                            <line x1="100" y1="90" x2="100" y2="100" stroke="#64748b" stroke-width="1"/>
                            <text x="65" y="108" text-anchor="middle" fill="#ef4444" font-size="10" font-weight="bold">X</text>
                            <line x1="260" y1="85" x2="260" y2="55" stroke="#64748b" stroke-width="1"/>
                            <line x1="255" y1="85" x2="265" y2="85" stroke="#64748b" stroke-width="1"/>
                            <line x1="255" y1="55" x2="265" y2="55" stroke="#64748b" stroke-width="1"/>
                            <text x="270" y="73" fill="#ef4444" font-size="10" font-weight="bold">Y</text>
                            <text x="30" y="22" fill="#64748b" font-size="9">Left End</text>
                            <text x="30" y="93" fill="#64748b" font-size="8">Bottom Edge (Y=0)</text>
                        </svg>
                    </div>
                `;
                break;
                
            case 'thruHole':
                html = `
                    <div class="form-group">
                        <label class="form-label">Hole Axis</label>
                        <select class="form-select" id="opAxis">
                            <option value="vertical">Through Front/Back (v/h faces)</option>
                            <option value="horizontal">Through Top/Bottom (o/u faces)</option>
                        </select>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">X Position (from left end)</label>
                            <input type="text" class="form-input" id="opX" placeholder="inches">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Y Position (from bottom/outer edge)</label>
                            <input type="text" class="form-input" id="opY" placeholder="inches">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Diameter</label>
                        <input type="text" class="form-input" id="opDiameter" placeholder="inches">
                    </div>
                    <div class="diagram-container">
                        <svg viewBox="0 0 280 140" class="diagram-svg">
                            <text x="140" y="12" text-anchor="middle" fill="#1e293b" font-size="10" font-weight="bold">THRU HOLE - Holes on BOTH opposite faces</text>
                            <text x="70" y="28" text-anchor="middle" fill="#64748b" font-size="9">End View</text>
                            <rect x="30" y="35" width="80" height="50" fill="#dbeafe" stroke="#3b82f6" stroke-width="2"/>
                            <rect x="38" y="43" width="64" height="34" fill="#f1f5f9" stroke="#3b82f6" stroke-width="1"/>
                            <circle cx="70" cy="35" r="6" fill="#fee2e2" stroke="#ef4444" stroke-width="2"/>
                            <circle cx="70" cy="85" r="6" fill="#fee2e2" stroke="#ef4444" stroke-width="2"/>
                            <line x1="70" y1="41" x2="70" y2="79" stroke="#ef4444" stroke-width="1" stroke-dasharray="3,2"/>
                            <text x="200" y="28" text-anchor="middle" fill="#64748b" font-size="9">Side View</text>
                            <rect x="140" y="45" width="120" height="40" fill="#dbeafe" stroke="#3b82f6" stroke-width="2"/>
                            <circle cx="180" cy="65" r="8" fill="#fee2e2" stroke="#ef4444" stroke-width="2"/>
                            <line x1="140" y1="95" x2="180" y2="95" stroke="#64748b" stroke-width="1"/>
                            <line x1="140" y1="90" x2="140" y2="100" stroke="#64748b" stroke-width="1"/>
                            <line x1="180" y1="90" x2="180" y2="100" stroke="#64748b" stroke-width="1"/>
                            <text x="160" y="108" text-anchor="middle" fill="#ef4444" font-size="10" font-weight="bold">X</text>
                            <line x1="265" y1="85" x2="265" y2="65" stroke="#64748b" stroke-width="1"/>
                            <line x1="260" y1="85" x2="270" y2="85" stroke="#64748b" stroke-width="1"/>
                            <line x1="260" y1="65" x2="270" y2="65" stroke="#64748b" stroke-width="1"/>
                            <text x="275" y="78" fill="#ef4444" font-size="10" font-weight="bold">Y</text>
                            <text x="140" y="130" fill="#64748b" font-size="8">Dashed line = hole passes through both walls</text>
                        </svg>
                    </div>
                `;
                break;
                
            case 'slot':
                // Get face options based on current shape type
                const slotShapeType = this.currentPart.shape.profileType;
                let slotFaceOptions = '';
                if (slotShapeType === 'ANGLE_EQUAL' || slotShapeType === 'ANGLE_UNEQUAL') {
                    slotFaceOptions = `
                        <option value="v">Vertical Leg</option>
                        <option value="h">Horizontal Leg</option>
                    `;
                } else {
                    slotFaceOptions = `
                        <option value="v">Front (v)</option>
                        <option value="h">Back (h)</option>
                        <option value="o">Top (o)</option>
                        <option value="u">Bottom (u)</option>
                    `;
                }
                html = `
                    <div class="form-group">
                        <label class="form-label">Face</label>
                        <select class="form-select" id="opFace">
                            ${slotFaceOptions}
                        </select>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">X Position (center, from left end)</label>
                            <input type="text" class="form-input" id="opX" placeholder="inches">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Y Position (center, from bottom)</label>
                            <input type="text" class="form-input" id="opY" placeholder="inches">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Length (overall slot length)</label>
                            <input type="text" class="form-input" id="opLength" placeholder="inches">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Width (slot width / end diameter)</label>
                            <input type="text" class="form-input" id="opWidth" placeholder="inches">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Orientation</label>
                        <select class="form-select" id="opOrientation">
                            <option value="horizontal">Horizontal (along member length)</option>
                            <option value="vertical">Vertical (perpendicular to length)</option>
                        </select>
                    </div>
                    <div class="diagram-container">
                        <svg viewBox="0 0 300 130" class="diagram-svg">
                            <text x="150" y="12" text-anchor="middle" fill="#1e293b" font-size="10" font-weight="bold">SLOT - Obround hole with rounded ends</text>
                            <rect x="30" y="25" width="240" height="60" fill="#dbeafe" stroke="#3b82f6" stroke-width="2"/>
                            <rect x="80" y="43" width="60" height="20" rx="10" ry="10" fill="#fee2e2" stroke="#ef4444" stroke-width="2"/>
                            <text x="45" y="55" fill="#64748b" font-size="8">Horiz</text>
                            <rect x="190" y="35" width="20" height="40" rx="10" ry="10" fill="#fee2e2" stroke="#ef4444" stroke-width="2"/>
                            <text x="220" y="55" fill="#64748b" font-size="8">Vert</text>
                            <line x1="30" y1="95" x2="110" y2="95" stroke="#64748b" stroke-width="1"/>
                            <line x1="30" y1="90" x2="30" y2="100" stroke="#64748b" stroke-width="1"/>
                            <line x1="110" y1="90" x2="110" y2="100" stroke="#64748b" stroke-width="1"/>
                            <text x="70" y="108" text-anchor="middle" fill="#ef4444" font-size="10" font-weight="bold">X (center)</text>
                            <text x="80" y="38" fill="#f97316" font-size="9">Length</text>
                            <text x="145" y="58" fill="#f97316" font-size="9">Width</text>
                            <text x="150" y="122" fill="#64748b" font-size="8">Ends are always rounded (radius = width/2)</text>
                        </svg>
                    </div>
                `;
                break;
                
            case 'thruSlot':
                html = `
                    <div class="form-group">
                        <label class="form-label">Through Axis</label>
                        <select class="form-select" id="opAxis">
                            <option value="vertical">Through Front/Back (v/h faces)</option>
                            <option value="horizontal">Through Top/Bottom (o/u faces)</option>
                        </select>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">X Position (center, from left end)</label>
                            <input type="text" class="form-input" id="opX" placeholder="inches">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Y Position (center, from bottom)</label>
                            <input type="text" class="form-input" id="opY" placeholder="inches">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Length (overall slot length)</label>
                            <input type="text" class="form-input" id="opLength" placeholder="inches">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Width (slot width / end diameter)</label>
                            <input type="text" class="form-input" id="opWidth" placeholder="inches">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Orientation</label>
                        <select class="form-select" id="opOrientation">
                            <option value="horizontal">Horizontal (along member length)</option>
                            <option value="vertical">Vertical (perpendicular to length)</option>
                        </select>
                    </div>
                    <div class="diagram-container">
                        <svg viewBox="0 0 300 140" class="diagram-svg">
                            <text x="150" y="12" text-anchor="middle" fill="#1e293b" font-size="10" font-weight="bold">THRU SLOT - Slots on BOTH opposite faces</text>
                            <text x="70" y="28" text-anchor="middle" fill="#64748b" font-size="9">End View</text>
                            <rect x="30" y="35" width="80" height="50" fill="#dbeafe" stroke="#3b82f6" stroke-width="2"/>
                            <rect x="38" y="43" width="64" height="34" fill="#f1f5f9" stroke="#3b82f6" stroke-width="1"/>
                            <rect x="55" y="32" width="30" height="8" rx="4" fill="#e0f2fe" stroke="#0ea5e9" stroke-width="2"/>
                            <rect x="55" y="82" width="30" height="8" rx="4" fill="#e0f2fe" stroke="#0ea5e9" stroke-width="2"/>
                            <line x1="70" y1="40" x2="70" y2="82" stroke="#0ea5e9" stroke-width="1" stroke-dasharray="3,2"/>
                            <text x="200" y="28" text-anchor="middle" fill="#64748b" font-size="9">Side View</text>
                            <rect x="140" y="45" width="120" height="40" fill="#dbeafe" stroke="#3b82f6" stroke-width="2"/>
                            <rect x="165" y="57" width="30" height="16" rx="8" fill="#e0f2fe" stroke="#0ea5e9" stroke-width="2"/>
                            <line x1="140" y1="95" x2="180" y2="95" stroke="#64748b" stroke-width="1"/>
                            <line x1="140" y1="90" x2="140" y2="100" stroke="#64748b" stroke-width="1"/>
                            <line x1="180" y1="90" x2="180" y2="100" stroke="#64748b" stroke-width="1"/>
                            <text x="160" y="108" text-anchor="middle" fill="#0ea5e9" font-size="10" font-weight="bold">X</text>
                            <text x="140" y="130" fill="#64748b" font-size="8">Dashed line = slot passes through both walls</text>
                        </svg>
                    </div>
                `;
                break;
                
            case 'cope':
                // Check if current shape is a channel for location options
                // Channel orientation: toes down, web up
                // Near/Far flanges extend downward, web is horizontal at top
                const copeShapeType = this.currentPart?.shape?.profileType;
                const isCopeChannel = copeShapeType === 'CHANNEL';
                const copeLocationOptions = isCopeChannel ? `
                            <option value="near_flange">Near Flange (o-face)</option>
                            <option value="far_flange">Far Flange (u-face)</option>
                            <option value="both">Both Flanges</option>
                            <option value="web">Web (v-face, top)</option>
                ` : `
                            <option value="top">Top</option>
                            <option value="bottom">Bottom</option>
                            <option value="both">Both</option>
                `;
                
                html = `
                    <div class="form-group">
                        <label class="form-label">End</label>
                        <select class="form-select" id="opEnd">
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Location</label>
                        <select class="form-select" id="opLocation">
                            ${copeLocationOptions}
                        </select>
                        ${isCopeChannel ? '<small class="text-muted">Channel loaded with toes down, web up</small>' : ''}
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Depth</label>
                            <input type="text" class="form-input" id="opDepth" placeholder="inches">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Length</label>
                            <input type="text" class="form-input" id="opLength" placeholder="inches">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Corner Radius</label>
                        <input type="text" class="form-input" id="opRadius" placeholder="inches (0 for square)">
                    </div>
                    <div class="diagram-container">
                        <svg viewBox="0 0 200 80" class="diagram-svg">
                            <path d="M 20 25 L 20 55 L 180 55 L 180 25 L 60 25 L 60 40 L 20 40 L 20 25" 
                                  fill="none" stroke="#2563eb" stroke-width="2"/>
                            <line x1="20" y1="65" x2="60" y2="65" stroke="#64748b" stroke-width="1"/>
                            <text x="40" y="75" text-anchor="middle" fill="#64748b" font-size="8">Length</text>
                            <line x1="65" y1="25" x2="65" y2="40" stroke="#64748b" stroke-width="1"/>
                            <text x="75" y="35" fill="#64748b" font-size="8">Depth</text>
                        </svg>
                    </div>
                `;
                break;
            
            case 'pipeCope':
                // Build header pipe size options from shapes data
                let headerPipeOptions = '<option value="">-- Select Header Pipe --</option>';
                headerPipeOptions += '<optgroup label="Standard Pipe">';
                if (SHAPES_DATA.pipe) {
                    SHAPES_DATA.pipe.forEach(p => {
                        headerPipeOptions += `<option value="${p.od}" data-label="${p.label}">${p.label} (OD: ${p.od}")</option>`;
                    });
                }
                headerPipeOptions += '</optgroup><optgroup label="HSS Round">';
                if (SHAPES_DATA.hss_round) {
                    SHAPES_DATA.hss_round.forEach(p => {
                        headerPipeOptions += `<option value="${p.od}" data-label="${p.label}">${p.label} (OD: ${p.od}")</option>`;
                    });
                }
                headerPipeOptions += '</optgroup>';
                
                html = `
                    <div class="form-group">
                        <label class="form-label">End</label>
                        <select class="form-select" id="opEnd">
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Header Pipe (pipe being coped into)</label>
                        <select class="form-select" id="opHeaderPipe" onchange="app.updatePipeCopePreview()">
                            ${headerPipeOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Or enter Header OD manually (inches)</label>
                        <input type="text" class="form-input" id="opHeaderOD" placeholder="e.g. 6.625" onchange="app.updatePipeCopePreview()">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Intersection Angle (degrees)</label>
                        <input type="number" class="form-input" id="opIntersectionAngle" value="90" min="15" max="90" onchange="app.updatePipeCopePreview()">
                        <small class="text-muted">90 = perpendicular, lower angles = more acute</small>
                    </div>
                    <div class="form-group hidden" id="pipeCopeAdvanced">
                        <label class="form-label">Offset from center (inches)</label>
                        <input type="text" class="form-input" id="opOffset" value="0" placeholder="0 = centered">
                        <small class="text-muted">Lateral offset if branch doesn't hit header at center</small>
                    </div>
                    <div class="form-group hidden">
                        <label class="form-label">Rotation (degrees)</label>
                        <input type="number" class="form-input" id="opRotation" value="0" min="0" max="360">
                        <small class="text-muted">Angular position around the working pipe (0 = top)</small>
                    </div>
                    <div class="diagram-container">
                        <svg viewBox="0 0 280 140" class="diagram-svg" id="pipeCopePreviewSvg">
                            <text x="140" y="15" text-anchor="middle" fill="#1e293b" font-size="10" font-weight="bold">PIPE COPE (Saddle Cut)</text>
                            <text x="140" y="30" text-anchor="middle" fill="#64748b" font-size="8">Branch pipe fitting into header pipe</text>
                            <!-- Header pipe (horizontal) -->
                            <ellipse cx="140" cy="90" rx="60" ry="30" fill="#dbeafe" stroke="#3b82f6" stroke-width="2"/>
                            <text x="140" y="130" text-anchor="middle" fill="#3b82f6" font-size="9">Header Pipe</text>
                            <!-- Branch pipe (vertical) -->
                            <rect x="125" y="40" width="30" height="50" fill="#fee2e2" stroke="#ef4444" stroke-width="2"/>
                            <text x="140" y="55" text-anchor="middle" fill="#ef4444" font-size="8">Branch</text>
                            <!-- Saddle cut indication -->
                            <path d="M 125 90 Q 140 70 155 90" fill="none" stroke="#22c55e" stroke-width="2" stroke-dasharray="4,2"/>
                            <text x="200" y="80" fill="#22c55e" font-size="8">Saddle cut</text>
                        </svg>
                    </div>
                `;
                break;
                
            case 'layoutMark':
                html = `
                    <div class="form-group">
                        <label class="form-label">Face</label>
                        <select class="form-select" id="opFace">
                            <option value="v">Front (v)</option>
                            <option value="h">Back (h)</option>
                            <option value="o">Top (o)</option>
                            <option value="u">Bottom (u)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Mark Type</label>
                        <select class="form-select" id="opMarkType">
                            <option value="line">Line</option>
                            <option value="crosshair">Crosshair/Point</option>
                            <option value="text">Text</option>
                        </select>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">X Position</label>
                            <input type="text" class="form-input" id="opX" placeholder="inches">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Y Position</label>
                            <input type="text" class="form-input" id="opY" placeholder="inches">
                        </div>
                    </div>
                    <div class="form-group" id="markTextGroup">
                        <label class="form-label">Text (if text mark)</label>
                        <input type="text" class="form-input" id="opText" placeholder="Mark text">
                    </div>
                `;
                break;
                
            case 'notch':
                // Get face options based on current shape type
                const notchShapeType = this.currentPart.shape.profileType;
                let notchFaceOptions = '';
                let notchHelperText = '';
                if (notchShapeType === 'ANGLE_EQUAL') {
                    notchFaceOptions = `
                        <option value="v">Vertical Leg (outer)</option>
                        <option value="h">Horizontal Leg (outer)</option>
                    `;
                } else if (notchShapeType === 'ANGLE_UNEQUAL') {
                    notchFaceOptions = `
                        <option value="v">Vertical Leg (long leg outer)</option>
                        <option value="h">Horizontal Leg (short leg outer)</option>
                    `;
                } else if (notchShapeType === 'CHANNEL') {
                    // Channel orientation: toes down, web up
                    notchFaceOptions = `
                        <option value="near_flange">Near Flange (o-face)</option>
                        <option value="far_flange">Far Flange (u-face)</option>
                        <option value="web">Web (v-face, top)</option>
                    `;
                    notchHelperText = '<small class="text-muted">Channel loaded with toes down, web up</small>';
                } else {
                    notchFaceOptions = `
                        <option value="top">Top</option>
                        <option value="bottom">Bottom</option>
                    `;
                }
                html = `
                    <div class="form-group">
                        <label class="form-label">Location</label>
                        <select class="form-select" id="opLocation">
                            ${notchFaceOptions}
                        </select>
                        ${notchHelperText}
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">X Position (notch start from left end)</label>
                            <input type="text" class="form-input" id="opX" placeholder="inches">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Width (along length)</label>
                            <input type="text" class="form-input" id="opWidth" placeholder="inches">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Depth (into profile)</label>
                            <input type="text" class="form-input" id="opDepth" placeholder="inches">
                        </div>
                    </div>
                    <div class="diagram-container">
                        <svg viewBox="0 0 300 140" class="diagram-svg">
                            <text x="150" y="14" text-anchor="middle" fill="#1e293b" font-size="10" font-weight="bold">NOTCH - Rectangular cut from edge</text>
                            <text x="30" y="32" fill="#64748b" font-size="9">Left End</text>
                            <rect x="30" y="38" width="230" height="60" fill="#dbeafe" stroke="#3b82f6" stroke-width="2"/>
                            <rect x="100" y="38" width="50" height="25" fill="#f1f5f9" stroke="#f97316" stroke-width="2"/>
                            <line x1="30" y1="108" x2="100" y2="108" stroke="#64748b" stroke-width="1"/>
                            <line x1="30" y1="103" x2="30" y2="113" stroke="#64748b" stroke-width="1"/>
                            <line x1="100" y1="103" x2="100" y2="113" stroke="#64748b" stroke-width="1"/>
                            <text x="65" y="125" text-anchor="middle" fill="#f97316" font-size="10" font-weight="bold">X</text>
                            <line x1="100" y1="30" x2="150" y2="30" stroke="#64748b" stroke-width="1"/>
                            <line x1="100" y1="25" x2="100" y2="35" stroke="#64748b" stroke-width="1"/>
                            <line x1="150" y1="25" x2="150" y2="35" stroke="#64748b" stroke-width="1"/>
                            <text x="125" y="25" text-anchor="middle" fill="#f97316" font-size="10" font-weight="bold">Width</text>
                            <line x1="158" y1="38" x2="158" y2="63" stroke="#64748b" stroke-width="1"/>
                            <line x1="153" y1="38" x2="163" y2="38" stroke="#64748b" stroke-width="1"/>
                            <line x1="153" y1="63" x2="163" y2="63" stroke="#64748b" stroke-width="1"/>
                            <text x="172" y="54" fill="#f97316" font-size="10" font-weight="bold">Depth</text>
                            <text x="220" y="54" fill="#64748b" font-size="8">Top Edge</text>
                        </svg>
                    </div>
                `;
                break;
        }
        
        formContainer.innerHTML = html;
    }
    
    saveOperation() {
        const opType = document.getElementById('operationType')?.value;
        let operation = null;
        
        switch(opType) {
            case 'endConditionLeft':
                operation = new EndConditionLeft();
                operation.cutType = document.getElementById('opCutType')?.value || 'square';
                operation.webAngle = parseFloat(document.getElementById('opWebAngle')?.value) || 45;
                operation.longPointLocation = document.getElementById('opLongPoint')?.value || 'top';
                // Double miter fields
                if (operation.cutType === 'doubleMiter') {
                    operation.topCutback = Utils.parseFeetInches(document.getElementById('opTopCutback')?.value) || 0;
                    operation.bottomCutback = Utils.parseFeetInches(document.getElementById('opBottomCutback')?.value) || 0;
                    operation.dropdown = Utils.parseFeetInches(document.getElementById('opDropdown')?.value) || 0;
                    
                    // Validation
                    const dims = this.currentPart?.shape?.dimensions;
                    const height = dims?.height || 0;
                    if (height > 0 && operation.dropdown > height) {
                        this.showMessage(`Dropdown (${operation.dropdown}") cannot exceed shape height (${height}")`, 'error');
                        return;
                    }
                    if (operation.dropdown <= 0) {
                        this.showMessage('Dropdown must be greater than 0', 'error');
                        return;
                    }
                    if (operation.topCutback <= 0 && operation.bottomCutback <= 0) {
                        this.showMessage('At least one cutback must be greater than 0', 'error');
                        return;
                    }
                }
                // Slotted end fields
                if (operation.cutType === 'slotted') {
                    operation.slotLength = Utils.parseFeetInches(document.getElementById('opSlotLength')?.value) || 0;
                    operation.slotWidth = Utils.parseFeetInches(document.getElementById('opSlotWidth')?.value) || 0;
                    operation.slotEndType = document.getElementById('opSlotEndType')?.value || 'radiused';
                    operation.slotFaces = document.getElementById('opSlotFaces')?.value || 'webs';
                    
                    // Validation
                    if (operation.slotLength <= 0) {
                        this.showMessage('Slot length must be greater than 0', 'error');
                        return;
                    }
                    if (operation.slotWidth <= 0) {
                        this.showMessage('Slot width must be greater than 0', 'error');
                        return;
                    }
                    const dims = this.currentPart?.shape?.dimensions;
                    const tubeHeight = dims?.height || 0;
                    if (tubeHeight > 0 && operation.slotWidth >= tubeHeight) {
                        this.showMessage(`Slot width (${operation.slotWidth}") must be less than tube height (${tubeHeight}")`, 'error');
                        return;
                    }
                }
                break;
                
            case 'endConditionRight':
                operation = new EndConditionRight();
                operation.cutType = document.getElementById('opCutType')?.value || 'square';
                operation.webAngle = parseFloat(document.getElementById('opWebAngle')?.value) || 45;
                operation.longPointLocation = document.getElementById('opLongPoint')?.value || 'top';
                // Double miter fields
                if (operation.cutType === 'doubleMiter') {
                    operation.topCutback = Utils.parseFeetInches(document.getElementById('opTopCutback')?.value) || 0;
                    operation.bottomCutback = Utils.parseFeetInches(document.getElementById('opBottomCutback')?.value) || 0;
                    operation.dropdown = Utils.parseFeetInches(document.getElementById('opDropdown')?.value) || 0;
                    
                    // Validation
                    const dims = this.currentPart?.shape?.dimensions;
                    const height = dims?.height || 0;
                    if (height > 0 && operation.dropdown > height) {
                        this.showMessage(`Dropdown (${operation.dropdown}") cannot exceed shape height (${height}")`, 'error');
                        return;
                    }
                    if (operation.dropdown <= 0) {
                        this.showMessage('Dropdown must be greater than 0', 'error');
                        return;
                    }
                    if (operation.topCutback <= 0 && operation.bottomCutback <= 0) {
                        this.showMessage('At least one cutback must be greater than 0', 'error');
                        return;
                    }
                }
                // Slotted end fields
                if (operation.cutType === 'slotted') {
                    operation.slotLength = Utils.parseFeetInches(document.getElementById('opSlotLength')?.value) || 0;
                    operation.slotWidth = Utils.parseFeetInches(document.getElementById('opSlotWidth')?.value) || 0;
                    operation.slotEndType = document.getElementById('opSlotEndType')?.value || 'radiused';
                    operation.slotFaces = document.getElementById('opSlotFaces')?.value || 'webs';
                    
                    // Validation
                    if (operation.slotLength <= 0) {
                        this.showMessage('Slot length must be greater than 0', 'error');
                        return;
                    }
                    if (operation.slotWidth <= 0) {
                        this.showMessage('Slot width must be greater than 0', 'error');
                        return;
                    }
                    const dims = this.currentPart?.shape?.dimensions;
                    const tubeHeight = dims?.height || 0;
                    if (tubeHeight > 0 && operation.slotWidth >= tubeHeight) {
                        this.showMessage(`Slot width (${operation.slotWidth}") must be less than tube height (${tubeHeight}")`, 'error');
                        return;
                    }
                }
                break;
                
            case 'hole':
                operation = new Hole();
                operation.face = document.getElementById('opFace')?.value || 'v';
                operation.x = Utils.parseFeetInches(document.getElementById('opX')?.value) || 0;
                operation.y = Utils.parseFeetInches(document.getElementById('opY')?.value) || 0;
                operation.diameter = Utils.parseFeetInches(document.getElementById('opDiameter')?.value) || 0;
                break;
                
            case 'thruHole':
                operation = new ThruHole();
                operation.axis = document.getElementById('opAxis')?.value || 'vertical';
                operation.x = Utils.parseFeetInches(document.getElementById('opX')?.value) || 0;
                operation.y = Utils.parseFeetInches(document.getElementById('opY')?.value) || 0;
                operation.diameter = Utils.parseFeetInches(document.getElementById('opDiameter')?.value) || 0;
                break;
                
            case 'slot':
                operation = new Slot();
                operation.face = document.getElementById('opFace')?.value || 'v';
                operation.x = Utils.parseFeetInches(document.getElementById('opX')?.value) || 0;
                operation.y = Utils.parseFeetInches(document.getElementById('opY')?.value) || 0;
                operation.length = Utils.parseFeetInches(document.getElementById('opLength')?.value) || 0;
                operation.width = Utils.parseFeetInches(document.getElementById('opWidth')?.value) || 0;
                operation.angle = document.getElementById('opOrientation')?.value === 'vertical' ? 90 : 0;
                operation.endType = 'round';  // BO format always creates rounded ends
                break;
                
            case 'thruSlot':
                operation = new ThruSlot();
                operation.axis = document.getElementById('opAxis')?.value || 'vertical';
                operation.x = Utils.parseFeetInches(document.getElementById('opX')?.value) || 0;
                operation.y = Utils.parseFeetInches(document.getElementById('opY')?.value) || 0;
                operation.length = Utils.parseFeetInches(document.getElementById('opLength')?.value) || 0;
                operation.width = Utils.parseFeetInches(document.getElementById('opWidth')?.value) || 0;
                operation.angle = document.getElementById('opOrientation')?.value === 'vertical' ? 90 : 0;
                break;
                
            case 'cope':
                operation = new Cope();
                operation.end = document.getElementById('opEnd')?.value || 'left';
                operation.location = document.getElementById('opLocation')?.value || 'top';
                operation.depth = Utils.parseFeetInches(document.getElementById('opDepth')?.value) || 0;
                operation.length = Utils.parseFeetInches(document.getElementById('opLength')?.value) || 0;
                operation.radius = Utils.parseFeetInches(document.getElementById('opRadius')?.value) || 0;
                break;
            
            case 'pipeCope':
                operation = new PipeCope();
                operation.end = document.getElementById('opEnd')?.value || 'left';
                // Get header OD from dropdown or manual input
                const headerPipeSelect = document.getElementById('opHeaderPipe');
                const headerODInput = document.getElementById('opHeaderOD');
                if (headerODInput && headerODInput.value) {
                    operation.headerOD = parseFloat(headerODInput.value) || 0;
                } else if (headerPipeSelect && headerPipeSelect.value) {
                    operation.headerOD = parseFloat(headerPipeSelect.value) || 0;
                }
                operation.intersectionAngle = parseFloat(document.getElementById('opIntersectionAngle')?.value) || 90;
                operation.offset = Utils.parseFeetInches(document.getElementById('opOffset')?.value) || 0;
                operation.rotation = parseFloat(document.getElementById('opRotation')?.value) || 0;
                break;
                
            case 'layoutMark':
                operation = new LayoutMark();
                operation.face = document.getElementById('opFace')?.value || 'v';
                operation.markType = document.getElementById('opMarkType')?.value || 'line';
                operation.x = Utils.parseFeetInches(document.getElementById('opX')?.value) || 0;
                operation.y = Utils.parseFeetInches(document.getElementById('opY')?.value) || 0;
                operation.text = document.getElementById('opText')?.value || '';
                break;
                
            case 'notch':
                operation = new Notch();
                operation.location = document.getElementById('opLocation')?.value || 'top';
                operation.x = Utils.parseFeetInches(document.getElementById('opX')?.value) || 0;
                operation.width = Utils.parseFeetInches(document.getElementById('opWidth')?.value) || 0;
                operation.depth = Utils.parseFeetInches(document.getElementById('opDepth')?.value) || 0;
                break;
        }
        
        if (operation) {
            // Check for duplicate end conditions (backstop)
            if (opType === 'endConditionLeft' || opType === 'endConditionRight') {
                const existingIndex = this.currentPart.operations.findIndex(op => op.type === opType);
                if (existingIndex !== -1) {
                    // Replace existing instead of adding duplicate
                    this.currentPart.operations[existingIndex] = operation;
                    this.showMessage('End condition updated (replaced existing)', 'info');
                } else {
                    this.currentPart.addOperation(operation);
                }
            } else {
                this.currentPart.addOperation(operation);
            }
            this.updateOperationsList();
            this.updatePreview();
            this.closeModal();
        }
    }
    
    updateOperationsList() {
        const container = document.getElementById('operationsList');
        if (!container) return;
        
        if (this.currentPart.operations.length === 0) {
            container.innerHTML = '<div class="text-muted text-center">No operations added</div>';
            return;
        }
        
        let html = '';
        this.currentPart.operations.forEach((op, index) => {
            let icon = 'O';
            let typeName = op.type;
            let params = '';
            
            switch(op.type) {
                case 'endConditionLeft':
                    icon = 'L';
                    typeName = 'End Condition - Left';
                    if (op.cutType === 'square') {
                        params = 'Square';
                    } else if (op.cutType === 'doubleMiter') {
                        params = `Double Miter: top ${op.topCutback}", bot ${op.bottomCutback}", drop ${op.dropdown}"`;
                    } else if (op.cutType === 'slotted') {
                        params = `Slotted: ${op.slotLength}" x ${op.slotWidth}" (${op.slotEndType})`;
                    } else {
                        params = `${op.webAngle} deg, long point ${op.longPointLocation}`;
                    }
                    break;
                case 'endConditionRight':
                    icon = 'R';
                    typeName = 'End Condition - Right';
                    if (op.cutType === 'square') {
                        params = 'Square';
                    } else if (op.cutType === 'doubleMiter') {
                        params = `Double Miter: top ${op.topCutback}", bot ${op.bottomCutback}", drop ${op.dropdown}"`;
                    } else if (op.cutType === 'slotted') {
                        params = `Slotted: ${op.slotLength}" x ${op.slotWidth}" (${op.slotEndType})`;
                    } else {
                        params = `${op.webAngle} deg, long point ${op.longPointLocation}`;
                    }
                    break;
                case 'hole':
                    icon = 'O';
                    typeName = 'Hole';
                    params = `${op.diameter}" dia @ X:${op.x}" Y:${op.y}" (${op.face})`;
                    break;
                case 'thruHole':
                    icon = 'T';
                    typeName = 'Thru Hole';
                    params = `${op.diameter}" dia @ X:${op.x}" Y:${op.y}" (${op.axis})`;
                    break;
                case 'slot':
                    icon = 'S';
                    typeName = 'Slot';
                    const orient = op.angle === 90 ? 'vert' : 'horiz';
                    params = `${op.length}" x ${op.width}" @ X:${op.x}" Y:${op.y}" (${orient}, ${op.face})`;
                    break;
                case 'thruSlot':
                    icon = 'TS';
                    typeName = 'Thru Slot';
                    const tsOrient = op.angle === 90 ? 'vert' : 'horiz';
                    params = `${op.length}" x ${op.width}" @ X:${op.x}" Y:${op.y}" (${tsOrient}, ${op.axis})`;
                    break;
                case 'cope':
                    icon = 'C';
                    typeName = 'Cope';
                    params = `${op.end}, ${op.depth}" x ${op.length}"`;
                    break;
                case 'pipeCope':
                    icon = 'PC';
                    typeName = 'Pipe Cope';
                    params = `${op.end} end, header ${op.headerOD}" OD, ${op.intersectionAngle} deg`;
                    break;
                case 'layoutMark':
                    icon = 'M';
                    typeName = 'Layout Mark';
                    params = `${op.markType} @ X:${op.x}" Y:${op.y}"`;
                    break;
                case 'notch':
                    icon = 'N';
                    typeName = 'Notch';
                    params = `${op.location}, ${op.width}" x ${op.depth}" @ X:${op.x}"`;
                    break;
            }
            
            html += `
                <div class="operation-item" data-id="${op.id}">
                    <div class="operation-icon">${icon}</div>
                    <div class="operation-details">
                        <div class="operation-type">${typeName}</div>
                        <div class="operation-params">${params}</div>
                    </div>
                    <div class="operation-actions">
                        <button class="btn btn-sm btn-danger" onclick="app.removeOperation('${op.id}')">X</button>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }
    
    removeOperation(opId) {
        this.currentPart.removeOperation(opId);
        this.updateOperationsList();
        this.updatePreview();
    }
    
    updatePreview() {
        const previewContainer = document.getElementById('nc1Preview');
        if (!previewContainer) return;
        
        const validation = this.currentPart.validate();
        
        // Always update the part preview diagram (wrapped in try-catch)
        try {
            this.updatePartPreview();
        } catch (error) {
            console.error('Part preview error:', error);
        }
        
        if (!validation.valid) {
            previewContainer.innerHTML = `<span class="text-muted">Complete part definition to see preview...</span>`;
            return;
        }
        
        try {
            console.log('Generating NC1 for part:', {
                profileType: this.currentPart.shape.profileType,
                designation: this.currentPart.shape.designation,
                dimensions: this.currentPart.shape.dimensions
            });
            const nc1Content = this.generator.generate(this.currentPart);
            previewContainer.textContent = nc1Content;
        } catch (error) {
            console.error('NC1 generation error:', error);
            previewContainer.innerHTML = `<span style="color: #dc2626;">Error generating preview: ${error.message}</span>`;
        }
    }
    
    /**
     * Update the graphical part preview (SVG diagram)
     */
    updatePartPreview() {
        const svg = document.getElementById('partPreviewSvg');
        const legend = document.getElementById('previewLegend');
        if (!svg) return;
        
        // Check if we have enough info to show a preview
        if (!this.currentPart.shape.profileType || !this.currentPart.length) {
            svg.innerHTML = '<text x="300" y="100" text-anchor="middle" fill="#64748b" font-size="14">Define part to see preview</text>';
            if (legend) legend.classList.add('hidden');
            return;
        }
        
        // Show legend
        if (legend) legend.classList.remove('hidden');
        
        // Get current view mode
        const activeTab = document.querySelector('.preview-tab.active');
        const viewMode = activeTab ? activeTab.dataset.view : 'side';
        
        if (viewMode === 'side') {
            this.renderSideView(svg);
        } else {
            this.renderEndView(svg);
        }
    }
    
    /**
     * Render side view of the part
     */
    renderSideView(svg) {
        const part = this.currentPart;
        const dims = part.shape.dimensions || {};
        const profileType = part.shape.profileType;
        
        // Calculate dimensions in display units
        const length = part.length || 1;  // inches, default to 1 to avoid division by zero
        let height = 0;
        
        switch (profileType) {
            case 'HSS_SQUARE':
            case 'HSS_RECT':
                height = dims.height || 4;
                break;
            case 'ANGLE_EQUAL':
            case 'ANGLE_UNEQUAL':
                height = dims.long_leg || 4;
                break;
            case 'CHANNEL':
            case 'WF':
                height = dims.depth || 4;
                break;
            case 'FLAT':
                height = dims.width || 4;
                break;
            case 'HSS_ROUND':
            case 'PIPE':
                height = dims.od || 4;
                break;
            default:
                height = 4;
        }
        
        // Ensure height is valid
        if (!height || height <= 0) height = 4;
        
        // Scale to fit SVG viewBox (600 x 200, with padding)
        const padding = 40;
        const availWidth = 600 - (padding * 2);
        const availHeight = 200 - (padding * 2);
        
        const scaleX = availWidth / length;
        const scaleY = availHeight / height;
        const scale = Math.min(scaleX, scaleY, 10);  // Cap scale at 10
        
        const drawWidth = length * scale;
        const drawHeight = height * scale;
        const offsetX = (600 - drawWidth) / 2;
        const offsetY = (200 - drawHeight) / 2;
        
        let svgContent = '';
        
        // Get operations
        const leftCut = part.operations.find(op => op.type === 'endConditionLeft');
        const rightCut = part.operations.find(op => op.type === 'endConditionRight');
        const notches = part.operations.filter(op => op.type === 'notch');
        const copes = part.operations.filter(op => op.type === 'cope');
        const holes = part.operations.filter(op => op.type === 'hole');
        const thruHoles = part.operations.filter(op => op.type === 'thruHole');
        const slots = part.operations.filter(op => op.type === 'slot');
        const thruSlots = part.operations.filter(op => op.type === 'thruSlot');
        
        // Process copes
        const leftTopCope = copes.find(c => c.end === 'left' && (c.location === 'top' || c.location === 'both'));
        const leftBottomCope = copes.find(c => c.end === 'left' && (c.location === 'bottom' || c.location === 'both'));
        const rightTopCope = copes.find(c => c.end === 'right' && (c.location === 'top' || c.location === 'both'));
        const rightBottomCope = copes.find(c => c.end === 'right' && (c.location === 'bottom' || c.location === 'both'));
        
        // Calculate miter offsets
        let leftTopOffset = 0, leftBottomOffset = 0;
        let rightTopOffset = 0, rightBottomOffset = 0;
        
        if (leftCut && leftCut.cutType === 'miter') {
            const angle = leftCut.webAngle || 45;
            const miterOffset = height * Math.tan(angle * Math.PI / 180);
            if (leftCut.longPointLocation === 'top') {
                leftBottomOffset = miterOffset;
            } else {
                leftTopOffset = miterOffset;
            }
        }
        
        if (rightCut && rightCut.cutType === 'miter') {
            const angle = rightCut.webAngle || 45;
            const miterOffset = height * Math.tan(angle * Math.PI / 180);
            if (rightCut.longPointLocation === 'top') {
                rightBottomOffset = miterOffset;
            } else {
                rightTopOffset = miterOffset;
            }
        }
        
        // Build profile path with notches and copes integrated
        let pathPoints = [];
        
        // Start at bottom-left (accounting for left bottom cope)
        let startY = leftBottomCope ? height - leftBottomCope.depth : height;
        pathPoints.push({ x: leftBottomOffset, y: startY });
        
        // Left bottom cope step
        if (leftBottomCope) {
            pathPoints.push({ x: leftBottomCope.length, y: startY });
            pathPoints.push({ x: leftBottomCope.length, y: height });
        }
        
        // Bottom edge (accounting for right bottom cope)
        if (rightBottomCope) {
            pathPoints.push({ x: length - rightBottomCope.length, y: height });
            pathPoints.push({ x: length - rightBottomCope.length, y: height - rightBottomCope.depth });
            pathPoints.push({ x: length - rightBottomOffset, y: height - rightBottomCope.depth });
        } else {
            pathPoints.push({ x: length - rightBottomOffset, y: height });
        }
        
        // Right top cope step
        if (rightTopCope) {
            pathPoints.push({ x: length - rightTopOffset, y: rightTopCope.depth });
            pathPoints.push({ x: length - rightTopCope.length, y: rightTopCope.depth });
            pathPoints.push({ x: length - rightTopCope.length, y: 0 });
        } else {
            pathPoints.push({ x: length - rightTopOffset, y: 0 });
        }
        
        // Top edge with notches (right to left)
        const sortedNotches = [...notches].sort((a, b) => b.x - a.x);
        let currentX = rightTopCope ? length - rightTopCope.length : length - rightTopOffset;
        
        for (const notch of sortedNotches) {
            const notchRight = notch.x + notch.width;
            const notchLeft = notch.x;
            const notchBottom = notch.depth;
            
            if (notchRight < currentX) {
                pathPoints.push({ x: notchRight, y: 0 });
                pathPoints.push({ x: notchRight, y: notchBottom });
                pathPoints.push({ x: notchLeft, y: notchBottom });
                pathPoints.push({ x: notchLeft, y: 0 });
                currentX = notchLeft;
            }
        }
        
        // Left top cope step
        if (leftTopCope) {
            pathPoints.push({ x: leftTopCope.length, y: 0 });
            pathPoints.push({ x: leftTopCope.length, y: leftTopCope.depth });
            pathPoints.push({ x: leftTopOffset, y: leftTopCope.depth });
        } else {
            pathPoints.push({ x: leftTopOffset, y: 0 });
        }
        
        // Close path back to start
        pathPoints.push({ x: leftBottomOffset, y: startY });
        
        // Convert to SVG path
        const pathD = pathPoints.map((p, i) => {
            const x = offsetX + p.x * scale;
            const y = offsetY + p.y * scale;
            return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
        }).join(' ') + ' Z';
        
        // Profile fill
        svgContent += `<path d="${pathD}" fill="#dbeafe" stroke="#3b82f6" stroke-width="2"/>`;
        
        // Draw miter indicators
        if (leftCut && leftCut.cutType === 'miter') {
            const x1 = offsetX + leftBottomOffset * scale;
            const y1 = offsetY + height * scale;
            const x2 = offsetX + leftTopOffset * scale;
            const y2 = offsetY;
            svgContent += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#8b5cf6" stroke-width="3"/>`;
        }
        
        if (rightCut && rightCut.cutType === 'miter') {
            const x1 = offsetX + (length - rightBottomOffset) * scale;
            const y1 = offsetY + height * scale;
            const x2 = offsetX + (length - rightTopOffset) * scale;
            const y2 = offsetY;
            svgContent += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#8b5cf6" stroke-width="3"/>`;
        }
        
        // Draw notch outlines
        for (const notch of notches) {
            const nx = offsetX + notch.x * scale;
            const ny = offsetY;
            const nw = notch.width * scale;
            const nd = notch.depth * scale;
            svgContent += `<rect x="${nx}" y="${ny}" width="${nw}" height="${nd}" fill="none" stroke="#f97316" stroke-width="2" stroke-dasharray="4,2"/>`;
        }
        
        // Draw cope outlines
        for (const cope of copes) {
            const copeLen = cope.length * scale;
            const copeDepth = cope.depth * scale;
            let cx, cy;
            
            if (cope.end === 'left') {
                cx = offsetX;
            } else {
                cx = offsetX + (length - cope.length) * scale;
            }
            
            if (cope.location === 'top' || cope.location === 'both') {
                cy = offsetY;
                svgContent += `<rect x="${cx}" y="${cy}" width="${copeLen}" height="${copeDepth}" fill="none" stroke="#f97316" stroke-width="2" stroke-dasharray="4,2"/>`;
            }
            if (cope.location === 'bottom' || cope.location === 'both') {
                cy = offsetY + (height - cope.depth) * scale;
                svgContent += `<rect x="${cx}" y="${cy}" width="${copeLen}" height="${copeDepth}" fill="none" stroke="#f97316" stroke-width="2" stroke-dasharray="4,2"/>`;
            }
        }
        
        // Draw holes
        for (const hole of holes) {
            const hx = offsetX + hole.x * scale;
            const hy = offsetY + (height - hole.y) * scale;
            const hr = (hole.diameter / 2) * scale;
            svgContent += `<circle cx="${hx}" cy="${hy}" r="${Math.max(hr, 3)}" fill="#fee2e2" stroke="#ef4444" stroke-width="2"/>`;
        }
        
        // Draw thru holes (with crosshair to indicate through both sides)
        for (const hole of thruHoles) {
            const hx = offsetX + hole.x * scale;
            const hy = offsetY + (height - hole.y) * scale;
            const hr = (hole.diameter / 2) * scale;
            const r = Math.max(hr, 3);
            svgContent += `<circle cx="${hx}" cy="${hy}" r="${r}" fill="#fef3c7" stroke="#ef4444" stroke-width="2"/>`;
            svgContent += `<line x1="${hx - r - 2}" y1="${hy}" x2="${hx + r + 2}" y2="${hy}" stroke="#ef4444" stroke-width="1"/>`;
            svgContent += `<line x1="${hx}" y1="${hy - r - 2}" x2="${hx}" y2="${hy + r + 2}" stroke="#ef4444" stroke-width="1"/>`;
        }
        
        // Draw slots (always rounded ends)
        for (const slot of slots) {
            const sx = offsetX + slot.x * scale;
            const sy = offsetY + (height - slot.y) * scale;
            let slotW, slotH;
            if (slot.angle === 90) {
                slotW = slot.width * scale;
                slotH = slot.length * scale;
            } else {
                slotW = slot.length * scale;
                slotH = slot.width * scale;
            }
            const rx = Math.min(slotW, slotH) / 2;  // Always rounded
            svgContent += `<rect x="${sx - slotW/2}" y="${sy - slotH/2}" width="${slotW}" height="${slotH}" rx="${rx}" fill="#e0f2fe" stroke="#0ea5e9" stroke-width="2"/>`;
        }
        
        // Draw thru slots (with crosshair to indicate through both sides)
        for (const slot of thruSlots) {
            const sx = offsetX + slot.x * scale;
            const sy = offsetY + (height - slot.y) * scale;
            let slotW, slotH;
            if (slot.angle === 90) {
                slotW = slot.width * scale;
                slotH = slot.length * scale;
            } else {
                slotW = slot.length * scale;
                slotH = slot.width * scale;
            }
            const rx = Math.min(slotW, slotH) / 2;
            svgContent += `<rect x="${sx - slotW/2}" y="${sy - slotH/2}" width="${slotW}" height="${slotH}" rx="${rx}" fill="#fef3c7" stroke="#0ea5e9" stroke-width="2"/>`;
            svgContent += `<line x1="${sx - slotW/2 - 2}" y1="${sy}" x2="${sx + slotW/2 + 2}" y2="${sy}" stroke="#0ea5e9" stroke-width="1"/>`;
            svgContent += `<line x1="${sx}" y1="${sy - slotH/2 - 2}" x2="${sx}" y2="${sy + slotH/2 + 2}" stroke="#0ea5e9" stroke-width="1"/>`;
        }
        
        // Dimension text
        svgContent += `<text x="${offsetX + drawWidth/2}" y="${offsetY + drawHeight + 25}" text-anchor="middle" fill="#64748b" font-size="12">${length}" length</text>`;
        svgContent += `<text x="${offsetX - 10}" y="${offsetY + drawHeight/2}" text-anchor="end" fill="#64748b" font-size="11">${height.toFixed(2)}"</text>`;
        
        svg.innerHTML = svgContent;
    }
    
    /**
     * Render end view (cross-section) of the part
     */
    renderEndView(svg) {
        const part = this.currentPart;
        const dims = part.shape.dimensions || {};
        const profileType = part.shape.profileType;
        
        const padding = 40;
        let svgContent = '';
        
        // Draw cross-section based on profile type
        switch (profileType) {
            case 'HSS_SQUARE':
            case 'HSS_RECT': {
                const h = dims.height || 4;
                const w = dims.width || 4;
                const t = dims.tdes || dims.tnom || 0.25;
                const scale = Math.min((600 - padding*2) / w, (200 - padding*2) / h, 15);
                const dw = w * scale;
                const dh = h * scale;
                const dt = t * scale;
                const ox = (600 - dw) / 2;
                const oy = (200 - dh) / 2;
                
                // Outer rectangle
                svgContent += `<rect x="${ox}" y="${oy}" width="${dw}" height="${dh}" fill="#dbeafe" stroke="#3b82f6" stroke-width="2"/>`;
                // Inner rectangle (hollow)
                svgContent += `<rect x="${ox + dt}" y="${oy + dt}" width="${dw - dt*2}" height="${dh - dt*2}" fill="#f1f5f9" stroke="#3b82f6" stroke-width="1"/>`;
                svgContent += `<text x="300" y="${oy + dh + 20}" text-anchor="middle" fill="#64748b" font-size="12">${w}" x ${h}" x ${t}" wall</text>`;
                break;
            }
            
            case 'HSS_ROUND':
            case 'PIPE': {
                const od = dims.od || 4;
                const t = dims.tdes || dims.tnom || 0.25;
                const id = od - (t * 2);
                const scale = Math.min((600 - padding*2) / od, (200 - padding*2) / od, 15);
                const dod = od * scale;
                const did = id * scale;
                const cx = 300;
                const cy = 100;
                
                svgContent += `<circle cx="${cx}" cy="${cy}" r="${dod/2}" fill="#dbeafe" stroke="#3b82f6" stroke-width="2"/>`;
                svgContent += `<circle cx="${cx}" cy="${cy}" r="${did/2}" fill="#f1f5f9" stroke="#3b82f6" stroke-width="1"/>`;
                svgContent += `<text x="300" y="${cy + dod/2 + 20}" text-anchor="middle" fill="#64748b" font-size="12">OD: ${od}" / Wall: ${t}"</text>`;
                break;
            }
            
            case 'ANGLE_EQUAL':
            case 'ANGLE_UNEQUAL': {
                const ll = dims.long_leg || 4;
                const sl = dims.short_leg || 4;
                const t = dims.t || 0.25;
                const maxDim = Math.max(ll, sl);
                const scale = Math.min((600 - padding*2) / sl, (200 - padding*2) / ll, 15);
                const ox = (600 - sl * scale) / 2;
                const oy = (200 - ll * scale) / 2;
                
                // L-shape path
                const path = `M ${ox} ${oy} 
                    L ${ox} ${oy + ll * scale} 
                    L ${ox + t * scale} ${oy + ll * scale}
                    L ${ox + t * scale} ${oy + t * scale}
                    L ${ox + sl * scale} ${oy + t * scale}
                    L ${ox + sl * scale} ${oy}
                    Z`;
                svgContent += `<path d="${path}" fill="#dbeafe" stroke="#3b82f6" stroke-width="2"/>`;
                svgContent += `<text x="300" y="${oy + ll * scale + 20}" text-anchor="middle" fill="#64748b" font-size="12">${ll}" x ${sl}" x ${t}"</text>`;
                break;
            }
            
            case 'CHANNEL': {
                const d = dims.depth || 4;
                const fw = dims.flange_width || 2;
                const tw = dims.web_thickness || 0.25;
                const tf = dims.flange_thickness || 0.25;
                const scale = Math.min((600 - padding*2) / fw, (200 - padding*2) / d, 15);
                const ox = (600 - fw * scale) / 2;
                const oy = (200 - d * scale) / 2;
                
                // C-shape path
                const path = `M ${ox} ${oy}
                    L ${ox + fw * scale} ${oy}
                    L ${ox + fw * scale} ${oy + tf * scale}
                    L ${ox + tw * scale} ${oy + tf * scale}
                    L ${ox + tw * scale} ${oy + (d - tf) * scale}
                    L ${ox + fw * scale} ${oy + (d - tf) * scale}
                    L ${ox + fw * scale} ${oy + d * scale}
                    L ${ox} ${oy + d * scale}
                    Z`;
                svgContent += `<path d="${path}" fill="#dbeafe" stroke="#3b82f6" stroke-width="2"/>`;
                svgContent += `<text x="300" y="${oy + d * scale + 20}" text-anchor="middle" fill="#64748b" font-size="12">${part.shape.designation}</text>`;
                break;
            }
            
            case 'FLAT': {
                const w = dims.width || 4;
                const t = dims.thickness || 0.25;
                const scale = Math.min((600 - padding*2) / w, (200 - padding*2) / t, 15);
                const dw = w * scale;
                const dt = Math.max(t * scale, 10);
                const ox = (600 - dw) / 2;
                const oy = (200 - dt) / 2;
                
                svgContent += `<rect x="${ox}" y="${oy}" width="${dw}" height="${dt}" fill="#dbeafe" stroke="#3b82f6" stroke-width="2"/>`;
                svgContent += `<text x="300" y="${oy + dt + 20}" text-anchor="middle" fill="#64748b" font-size="12">${w}" x ${t}"</text>`;
                break;
            }
            
            default:
                svgContent = '<text x="300" y="100" text-anchor="middle" fill="#64748b" font-size="14">End view not available</text>';
        }
        
        svg.innerHTML = svgContent;
    }
    
    downloadNC1() {
        const validation = this.currentPart.validate();
        
        if (!validation.valid) {
            this.showMessage('Please fix errors: ' + validation.errors.join(', '), 'error');
            return;
        }
        
        try {
            const nc1Content = this.generator.generate(this.currentPart);
            const filename = this.generator.generateFilename(this.currentPart);
            Utils.downloadFile(nc1Content, filename);
            this.showMessage(`Downloaded ${filename}`, 'success');
        } catch (error) {
            this.showMessage('Error generating NC1: ' + error.message, 'error');
        }
    }
    
    copyNC1ToClipboard() {
        const nc1Preview = document.getElementById('nc1Preview');
        if (nc1Preview && nc1Preview.textContent && !nc1Preview.textContent.includes('Complete part definition')) {
            navigator.clipboard.writeText(nc1Preview.textContent).then(() => {
                this.showMessage('NC1 copied to clipboard', 'success');
            }).catch(() => {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = nc1Preview.textContent;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                this.showMessage('NC1 copied to clipboard', 'success');
            });
        } else {
            this.showMessage('No NC1 content to copy', 'error');
        }
    }
    
    clearCurrentPart() {
        this.currentPart = new Part();
        
        // Reset form
        document.getElementById('partMark').value = '';
        document.getElementById('partLength').value = '';
        document.getElementById('partQty').value = '1';
        document.getElementById('shapeType').value = '';
        document.getElementById('shapeSize').innerHTML = '<option value="">Select shape type first...</option>';
        
        // Reset custom part checkbox and part definition
        this.hideCustomPartCheckbox();
        this.hidePartDefinition();
        
        // Reset part definition inputs
        const partDefInputs = ['partDefWidth', 'partDefLength'];
        partDefInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = '';
        });
        
        const partDefPosition = document.getElementById('partDefPosition');
        if (partDefPosition) partDefPosition.value = 'centered';
        
        // Reset corner dropdowns
        const corners = ['NearLeft', 'FarLeft', 'NearRight', 'FarRight'];
        corners.forEach(corner => {
            const select = document.getElementById(`corner${corner}`);
            const dimInput = document.getElementById(`corner${corner}Dim`);
            if (select) select.value = 'square';
            if (dimInput) {
                dimInput.value = '';
                dimInput.classList.add('hidden');
            }
        });
        
        this.updateOperationsList();
        this.updatePreview();
        this.updateShapeDiagram(null);
    }
    
    updateUI() {
        this.updateOperationsList();
        this.updatePreview();
    }
    
    showMessage(text, type = 'info') {
        const container = document.getElementById('messages');
        if (!container) return;
        
        const msg = document.createElement('div');
        msg.className = `message message-${type}`;
        msg.textContent = text;
        container.appendChild(msg);
        
        setTimeout(() => msg.remove(), 5000);
    }
}

// Initialize app when DOM is ready
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new NC1ConverterApp();
});
