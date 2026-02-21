import { log } from './log.js';

/**
 * LRU Cache Optimized for Bun/JSC
 */
export class LRUCache {
    constructor(maxSize) {
        this.maxSize = maxSize || 100;
        this.cache = new Map();
    }

    get(key) {
        const item = this.cache.get(key);
        if (item) {
            // Refresh item (Delete & Set is faster than re-ordering array in V8/JSC)
            this.cache.delete(key);
            this.cache.set(key, item);
        }
        return item;
    }

    set(key, value) {
        // Jika key sudah ada, update dan taruh di paling baru
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } 
        // Jika penuh, hapus yang paling tua (elemen pertama di Map iterator)
        else if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }
        this.cache.set(key, value);
    }

    delete(key) {
        return this.cache.delete(key);
    }

    clear() {
        this.cache.clear();
    }

    size() {
        return this.cache.size;
    }
}

/**
 * Memory Monitor with Backpressure support
 * Based on provided memory-monitor.ts but modified to prevent self-leaks
 */
export class MemoryMonitor {
    constructor(options = {}) {
        this.snapshots = [];
        this.maxSnapshots = options.maxSnapshots || 300;
        this.intervalId = null;
        this.threshold = options.threshold || 10;
        this.isPressureHigh = false;
        
        // Initial state
        this.snapshot();
    }

    start(intervalMs = 5000) {
        if (this.intervalId) clearInterval(this.intervalId);
        
        this.intervalId = setInterval(() => {
            this.snapshot();
            
            // Trigger Garbage Collection jika pressure tinggi di Bun
            if (this.isPressureHigh) {
                // false = async execution (tidak memblokir main thread)
                Bun.gc(false); 
            }
        }, intervalMs);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    snapshot() {
        const usage = process.memoryUsage();
        
        // Hitung pressure ratio (Heap Used / Heap Total)
        // Catatan: Di Bun, rss bisa jauh lebih besar dari heapUsed, tapi heapUsed adalah indikator JS object
        const ratio = usage.heapUsed / usage.heapTotal;
        this.isPressureHigh = ratio > this.threshold;

        if (this.isPressureHigh) {
            log.warn({ 
                heapUsed: (usage.heapUsed / 1024 / 1024).toFixed(2) + 'MB',
                ratio: ratio.toFixed(2)
            }, 'Penggunaan memory tinggi - memulai Garbage Colector');
        }

        this.snapshots.push({
            timestamp: Date.now(),
            heapUsed: usage.heapUsed,
            rss: usage.rss
        });

        // Prevent memory leak in monitor itself (FIFO)
        if (this.snapshots.length > this.maxSnapshots) {
            this.snapshots.shift();
        }
    }

    isUnderPressure() {
        return this.isPressureHigh;
    }

    getStats() {
        if (this.snapshots.length === 0) return null;
        const last = this.snapshots[this.snapshots.length - 1];
        return {
            heapUsed: last.heapUsed,
            rss: last.rss,
            isPressureHigh: this.isPressureHigh
        };
    }
}

export const memoryMonitor = new MemoryMonitor();
