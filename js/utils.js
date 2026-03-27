/**
 * NC1 Converter - Utility Functions
 */

const Utils = {
    
    // ============================================
    // UNIT CONVERSION
    // ============================================
    
    /**
     * Parse feet-inches string to decimal inches
     * Accepts formats: 12, 12.5, 1'-6", 1' 6", 1'6", 18", 1'-6-1/2", 1' 6 1/2"
     */
    parseFeetInches(input) {
        if (typeof input === 'number') return input;
        
        let str = String(input).trim().toUpperCase();
        
        // Handle pure decimal inches
        if (/^[\d.]+$/.test(str)) {
            return parseFloat(str);
        }
        
        // Handle fractions like "1/2", "3/4"
        const fractionMatch = str.match(/^(\d+)\/(\d+)$/);
        if (fractionMatch) {
            return parseInt(fractionMatch[1]) / parseInt(fractionMatch[2]);
        }
        
        // Handle mixed number like "6-1/2" or "6 1/2"
        const mixedMatch = str.match(/^(\d+)[\s-]+(\d+)\/(\d+)$/);
        if (mixedMatch) {
            return parseInt(mixedMatch[1]) + parseInt(mixedMatch[2]) / parseInt(mixedMatch[3]);
        }
        
        let totalInches = 0;
        
        // Extract feet
        const feetMatch = str.match(/(\d+)\s*['\u2032]/);
        if (feetMatch) {
            totalInches += parseInt(feetMatch[1]) * 12;
        }
        
        // Extract inches (whole number)
        const inchMatch = str.match(/(\d+)\s*["\u2033]?(?:\s|$)/);
        if (inchMatch && !feetMatch) {
            // Only inches, no feet
            totalInches += parseFloat(inchMatch[1]);
        } else if (inchMatch && feetMatch) {
            // Both feet and inches present - need to extract inches after feet
            const afterFeet = str.substring(str.indexOf(feetMatch[0]) + feetMatch[0].length);
            const pureInchMatch = afterFeet.match(/(\d+(?:\.\d+)?)/);
            if (pureInchMatch) {
                totalInches += parseFloat(pureInchMatch[1]);
            }
        }
        
        // Extract fraction of inch
        const fracMatch = str.match(/(\d+)\/(\d+)/);
        if (fracMatch) {
            totalInches += parseInt(fracMatch[1]) / parseInt(fracMatch[2]);
        }
        
        return totalInches || parseFloat(str) || 0;
    },
    
    /**
     * Convert decimal inches to feet-inches string
     */
    toFeetInches(decimalInches, includeFraction = true) {
        const feet = Math.floor(decimalInches / 12);
        let inches = decimalInches % 12;
        
        if (includeFraction) {
            const wholeInches = Math.floor(inches);
            const fraction = inches - wholeInches;
            
            // Convert to nearest 1/16
            const sixteenths = Math.round(fraction * 16);
            let fracStr = '';
            
            if (sixteenths > 0) {
                // Reduce fraction
                const gcd = this.gcd(sixteenths, 16);
                const num = sixteenths / gcd;
                const den = 16 / gcd;
                fracStr = ` ${num}/${den}`;
            }
            
            if (feet > 0) {
                return `${feet}'-${wholeInches}${fracStr}"`;
            } else {
                return `${wholeInches}${fracStr}"`;
            }
        } else {
            if (feet > 0) {
                return `${feet}'-${inches.toFixed(2)}"`;
            } else {
                return `${inches.toFixed(2)}"`;
            }
        }
    },
    
    /**
     * Greatest common divisor
     */
    gcd(a, b) {
        return b === 0 ? a : this.gcd(b, a % b);
    },
    
    /**
     * Convert inches to millimeters
     */
    inchesToMM(inches) {
        return inches * 25.4;
    },
    
    /**
     * Convert millimeters to inches
     */
    mmToInches(mm) {
        return mm / 25.4;
    },
    
    // ============================================
    // VALIDATION
    // ============================================
    
    /**
     * Validate numeric input
     */
    isValidNumber(value, min = null, max = null) {
        const num = parseFloat(value);
        if (isNaN(num)) return false;
        if (min !== null && num < min) return false;
        if (max !== null && num > max) return false;
        return true;
    },
    
    /**
     * Validate angle (0-360)
     */
    isValidAngle(value) {
        return this.isValidNumber(value, 0, 360);
    },
    
    /**
     * Sanitize string for filename
     */
    sanitizeFilename(str) {
        return str.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
    },
    
    // ============================================
    // SHAPE HELPERS
    // ============================================
    
    /**
     * Parse HSS designation to extract dimensions
     * e.g., "HSS6X4X1/4" -> { height: 6, width: 4, thickness: 0.25 }
     */
    parseHSSDesignation(designation) {
        const match = designation.match(/HSS(\d+(?:\.\d+)?)[X×](\d+(?:\.\d+)?)[X×](.+)/i);
        if (match) {
            return {
                height: parseFloat(match[1]),
                width: parseFloat(match[2]),
                thickness: this.parseFraction(match[3])
            };
        }
        return null;
    },
    
    /**
     * Parse fraction string to decimal
     * e.g., "1/4" -> 0.25, "3/8" -> 0.375
     */
    parseFraction(str) {
        str = String(str).trim();
        
        // Already decimal
        if (/^[\d.]+$/.test(str)) {
            return parseFloat(str);
        }
        
        // Fraction
        const match = str.match(/(\d+)\/(\d+)/);
        if (match) {
            return parseInt(match[1]) / parseInt(match[2]);
        }
        
        return parseFloat(str) || 0;
    },
    
    /**
     * Format fraction for display
     * e.g., 0.25 -> "1/4", 0.375 -> "3/8"
     */
    toFraction(decimal, maxDenominator = 16) {
        if (decimal === Math.floor(decimal)) {
            return String(Math.floor(decimal));
        }
        
        const tolerance = 1 / (maxDenominator * 2);
        
        for (let den = 2; den <= maxDenominator; den *= 2) {
            for (let num = 1; num < den; num++) {
                if (Math.abs(decimal - num/den) < tolerance) {
                    const gcd = this.gcd(num, den);
                    return `${num/gcd}/${den/gcd}`;
                }
            }
        }
        
        return decimal.toFixed(3);
    },
    
    // ============================================
    // FILE HANDLING
    // ============================================
    
    /**
     * Download text as file
     */
    downloadFile(content, filename, mimeType = 'text/plain') {
        // For NC1/DSTV files, ensure clean formatting
        if (filename.endsWith('.nc1') || filename.endsWith('.nc')) {
            // Remove any non-ASCII characters
            content = content.replace(/[^\x00-\x7F]/g, '');
            // Ensure Windows-style CRLF line endings
            content = content.replace(/\r?\n/g, '\r\n');
        }
        const blob = new Blob([content], { type: 'text/plain; charset=us-ascii' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    
    /**
     * Read file as text
     */
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = e => reject(e);
            reader.readAsText(file);
        });
    },
    
    // ============================================
    // GEOMETRY HELPERS
    // ============================================
    
    /**
     * Calculate angle between two points
     */
    angleBetweenPoints(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
    },
    
    /**
     * Calculate distance between two points
     */
    distanceBetweenPoints(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    },
    
    /**
     * Rotate point around origin
     */
    rotatePoint(x, y, angleDeg, cx = 0, cy = 0) {
        const rad = angleDeg * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const nx = (x - cx) * cos - (y - cy) * sin + cx;
        const ny = (x - cx) * sin + (y - cy) * cos + cy;
        return { x: nx, y: ny };
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Utils };
}
