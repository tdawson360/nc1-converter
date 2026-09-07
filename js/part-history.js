/**
 * NC1 Converter - Recent parts history
 *
 * Keeps the last MAX parts in this browser's localStorage so a part can be
 * recalled, edited or mirrored without rebuilding it. Storage is per person
 * and per browser; use Export/Import JSON to move a part between people.
 * Every access is wrapped in try/catch: storage can be missing or blocked.
 */

const PartHistory = {
    KEY: 'nc1-converter.history.v1',
    MAX: 50,

    /** @returns {Array<{savedAt: string, part: Object}>} newest first */
    list() {
        try {
            const raw = localStorage.getItem(this.KEY);
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    },

    _write(list) {
        try {
            localStorage.setItem(this.KEY, JSON.stringify(list.slice(0, this.MAX)));
            return true;
        } catch (e) {
            return false;
        }
    },

    /**
     * Save (or refresh) a part. An entry with the same part id is replaced
     * and moved to the top, so re-downloading an edited part updates it.
     */
    add(part) {
        const data = part.toJSON ? part.toJSON() : part;
        if (!data || !data.id) return false;
        const list = this.list().filter(e => e.part && e.part.id !== data.id);
        list.unshift({ savedAt: new Date().toISOString(), part: JSON.parse(JSON.stringify(data)) });
        return this._write(list);
    },

    get(id) {
        const entry = this.list().find(e => e.part && e.part.id === id);
        return entry ? entry.part : null;
    },

    remove(id) {
        return this._write(this.list().filter(e => !(e.part && e.part.id === id)));
    },

    clear() {
        return this._write([]);
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PartHistory };
}
