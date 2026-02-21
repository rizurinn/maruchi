import { Glob } from 'bun';
import path from 'path';
import pino from 'pino';
import { LRUCache, memoryMonitor } from '../../lib/memory.js';

const log = pino({
  level: Bun.env.LOG_LEVEL || "silent",
  base: { module: "PLUGIN LOADER" },
  transport: {
    target: "pino-pretty",
    options: { colorize: true, translateTime: Bun.env.LOG_TIME_FORMAT, ignore: Bun.env.LOG_IGNORE }
  }
});

export default class PluginLoader {
  constructor(pluginDir, opts = {}) {
    this.pluginDir = pluginDir || process.cwd();
    this.opts = { 
      maxModules: 500, 
      ...opts 
    };
    
    // Cache
    this.moduleCache = new LRUCache(this.opts.maxModules);
    this.plugins = new Map();
    this.router = { commands: new Map(), regex: [], all: [], before: [], custom: [] };
    this._importCache = new Map();

    // Monitor Memori (Opsional, matikan jika ingin sangat hemat)
    memoryMonitor.start(30000); 
  }

  // ========================================================================
  // CORE LOADING LOGIC
  // ========================================================================

  async loadAll() {
    // Bersihkan memori sebelum load
    Bun.gc(false);
    this.plugins.clear();
    
    // Scan file manual saat startup
    const files = await this._scanFiles();
    log.info(`Memuat ${files.length} plugin...`);
    
    let ok = 0, fail = 0;
    
    const results = await Promise.allSettled(files.map(async (full) => {
        const resolved = path.resolve(full);
        const rel = path.relative(this.pluginDir, resolved);
        
        const plugin = await this._importModule(resolved);
        if (plugin) {
            this.plugins.set(rel, plugin);
            return true;
        }
        throw new Error('Plugin tidak valid');
    }));

    results.forEach(res => res.status === 'fulfilled' ? ok++ : fail++);

    log.info(`Berhasil memuat: ${ok} ok, ${fail} gagal`);
    this.buildRouter();
    Bun.gc(false);
    
    return { ok, fail, total: this.plugins.size };
  }

  // Fitur Baru: Manual Reload Single File
  async reloadPlugin(query) {
    try {
      // 1. Cari file berdasarkan query (nama file atau command)
      const filepath = await this._resolvePath(query);
      if (!filepath) {
        return { success: false, error: 'File plugin tidak ditemukan' };
      }

      const rel = path.relative(this.pluginDir, filepath);
      
      // 2. Bersihkan cache lama
      this._cleanupCache(filepath);
      
      // 3. Import ulang
      const plugin = await this._importModule(filepath);
      
      if (!plugin) {
         // Jika gagal import (misal syntax error), plugin dihapus dari map
         this.plugins.delete(rel);
         this.buildRouter();
         return { success: false, error: 'Gagal mengimport module (Syntax Error?)' };
      }

      // 4. Update map & router
      this.plugins.set(rel, plugin);
      this.buildRouter();
      
      log.info(`Manual Reload Success: ${rel}`);
      return { success: true, file: rel };

    } catch (e) {
      log.error({ err: e.message }, 'Manual reload gagal');
      return { success: false, error: e.message };
    }
  }

  // ========================================================================
  // INTERNAL UTILS
  // ========================================================================

  async _scanFiles() {
    try {
      const glob = new Glob("**/*.{js,mjs}");
      const files = [];
      for await (const file of glob.scan({ cwd: this.pluginDir, onlyFiles: true })) {
        if (!file.startsWith('.') && !file.includes('node_modules')) {
          files.push(path.join(this.pluginDir, file));
        }
      }
      return files;
    } catch (err) {
      return [];
    }
  }

  async _importModule(fullpath) {
    try {
      const resolved = path.resolve(fullpath);
      
      // Cache Busting Strategy
      const fileUrl = 'file://' + resolved.replace(/\\/g, '/');
      const importUrl = `${fileUrl}?t=${Date.now()}`;

      // Hapus referensi lama
      if (this._importCache.has(resolved)) {
        this._importCache.delete(resolved);
      }

      // Dynamic Import
      const mod = await import(importUrl);
      const plugin = mod?.default ?? mod;

      if (!plugin) return null;

      this._importCache.set(resolved, importUrl);
      this.moduleCache.set(resolved, plugin);

      return plugin;
    } catch (e) {
      log.error({ error: e.message, file: fullpath }, 'Import gagal');
      // Jangan throw, return null agar bot tidak crash
      return null;
    }
  }

  _cleanupCache(resolvedPath) {
    this.moduleCache.delete(resolvedPath);
    this._importCache.delete(resolvedPath);
  }

  // Helper pintar untuk mencari file berdasarkan input user yang tidak lengkap
  // Contoh input: "menu" -> ketemu "plugin/main/menu.js"
  async _resolvePath(query) {
    const fullPathExact = path.resolve(this.pluginDir, query);
    if (await Bun.file(fullPathExact).exists()) return fullPathExact;

    // Cari di dalam map plugin yang sudah terload
    for (const [relPath, _] of this.plugins) {
        if (relPath.includes(query) || relPath.endsWith(query + '.js')) {
            return path.resolve(this.pluginDir, relPath);
        }
    }
    return null;
  }

  buildRouter() {
    const commandsMap = new Map();
    const regex = [];
    const all = [];
    const before = [];
    const custom = [];

    for (const [filename, plugin] of this.plugins) {
      if (!plugin) continue;

      const baseHandler = typeof plugin === 'function' ? plugin : (plugin.handler || plugin.run || null);

      if (typeof plugin.before === 'function') before.push({ fn: plugin.before, filename, plugin });
      if (typeof plugin.all === 'function') all.push({ fn: plugin.all, filename, plugin });
      
      if (plugin.customPrefix) {
         custom.push({ matcher: this._createMatcher(plugin.customPrefix), fn: baseHandler, filename, plugin });
      }

      const cmds = Array.isArray(plugin.command) ? plugin.command : (plugin.command ? [plugin.command] : []);
      for (const c of cmds) {
          if (!baseHandler) continue;
          if (c instanceof RegExp) {
              regex.push({ regex: c, fn: baseHandler, filename, plugin });
          } else if (typeof c === 'string') {
              const cmdName = c.replace(/^[/!.|•√§∆%✓&?]/g, '').trim().toLowerCase();
              if (cmdName) {
                  if (!commandsMap.has(cmdName)) commandsMap.set(cmdName, []);
                  commandsMap.get(cmdName).push({ fn: baseHandler, filename, plugin });
              }
          }
      }
      
      if (cmds.length === 0 && !plugin.customPrefix && typeof baseHandler === 'function') {
          all.push({ fn: baseHandler, filename, plugin });
      }
    }

    this.router = { commands: commandsMap, regex, custom, all, before };
    log.info(`Router rebuilt: ${commandsMap.size} cmds`);
  }
  
  _createMatcher(customPrefix) {
      if (typeof customPrefix === 'string') return (t) => t.startsWith(customPrefix);
      if (customPrefix instanceof RegExp) return (t) => customPrefix.test(t);
      if (Array.isArray(customPrefix)) return (t) => customPrefix.some(p => p instanceof RegExp ? p.test(t) : t.startsWith(p));
      return null;
  }
  
  // Public Accessors
  findByCommand(cmd) { return this.router.commands.get(cmd) || []; }
  getAllHandlers() { return this.router.all; }
  getBeforeHandlers() { return this.router.before; }
  findByCustomPrefix(text) { return this.router.custom.filter(c => c.matcher(text)); }

  destroy() {
      this.moduleCache.clear();
      this.plugins.clear();
      memoryMonitor.stop();
  }
}
