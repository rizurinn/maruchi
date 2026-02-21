/**
 * @file connection.js
 * Enhanced connection manager for WhatsApp bot with persistent reconnection
 * 
 * Features:
 * - Exponential backoff with jitter
 * - Circuit breaker pattern
 * - Connection state machine
 * - Health monitoring
 * - Automatic session recovery
 */

import { DisconnectReason } from 'baileys';
import pino from 'pino';

const logger = pino({
  level: Bun.env.LOG_LEVEL || 'silent',
  base: { module: 'CONNECTION' },
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: Bun.env.LOG_TIME_FORMAT,
      ignore: Bun.env.LOG_IGNORE,
    },
  },
});

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  reconnect: {
    maxAttemptsPerHour: 10,
    windowMs: 3600000, // 1 hour
    minDelayMs: 2000,
    maxDelayMs: 60000,
    jitterPercent: 0.2,
  },

  circuitBreaker: {
    failureThreshold: 5,
    resetTimeoutMs: 300000, // 5 minutes
    halfOpenAttempts: 1,
  },

  health: {
    checkIntervalMs: 60000, // 1 minute
    timeoutThreshold: 300000, // 5 minutes
  },

  session: {
    clearCodes: [401, 403, 405, 411, DisconnectReason.loggedOut],
    restoreCodes: [500, 503, 515, DisconnectReason.badSession, DisconnectReason.timedOut],
    quickReconnectCodes: [
      408,
      428,
      DisconnectReason.connectionClosed,
      DisconnectReason.connectionLost,
      DisconnectReason.connectionReplaced,
    ],
  },
};

// ============================================================================
// CONNECTION STATE MACHINE
// ============================================================================

const ConnectionState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  FAILED: 'failed',
};

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || CONFIG.circuitBreaker.failureThreshold;
    this.resetTimeout = options.resetTimeoutMs || CONFIG.circuitBreaker.resetTimeoutMs;
    this.halfOpenAttempts = options.halfOpenAttempts || CONFIG.circuitBreaker.halfOpenAttempts;

    this.state = 'closed'; // closed, open, half-open
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.halfOpenSuccesses = 0;
  }

  canAttempt() {
    if (this.state === 'closed') {
      return true;
    }

    if (this.state === 'half-open') {
      return this.halfOpenSuccesses < this.halfOpenAttempts;
    }

    // Open state - check if we should transition to half-open
    if (Date.now() - this.lastFailureTime > this.resetTimeout) {
      this.state = 'half-open';
      this.halfOpenSuccesses = 0;
      logger.info('Circuit breaker: open -> half-open');
      return true;
    }

    return false;
  }

  recordSuccess() {
    if (this.state === 'half-open') {
      this.halfOpenSuccesses++;

      if (this.halfOpenSuccesses >= this.halfOpenAttempts) {
        this.state = 'closed';
        this.failureCount = 0;
        logger.info('Circuit breaker: half-open -> closed');
      }
    } else if (this.state === 'closed') {
      this.failureCount = 0;
    }
  }

  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      this.state = 'open';
      logger.warn('Circuit breaker: half-open -> open');
    } else if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
      logger.warn(
        {
          failures: this.failureCount,
          threshold: this.failureThreshold,
        },
        'Circuit breaker: closed -> open'
      );
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  reset() {
    this.state = 'closed';
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.halfOpenSuccesses = 0;
    logger.info('Pemutus arus dimuat ulang');
  }
}

// ============================================================================
// CONNECTION MANAGER
// ============================================================================

export class ConnectionManager {
  constructor() {
    this.state = ConnectionState.DISCONNECTED;
    this.circuitBreaker = new CircuitBreaker();

    // Reconnection tracking
    this.reconnectAttempts = 0;
    this.reconnectWindow = [];
    this.isReconnecting = false;
    this.reconnectTimer = null;

    // Connection tracking
    this.lastConnectedTime = 0;
    this.lastDisconnectTime = 0;
    this.connectionAttempts = 0;
    this.totalUptime = 0;

    // Health monitoring
    this.healthCheckTimer = null;
    this.lastHealthCheck = Date.now();

    // Callbacks
    this.onStateChange = null;
  }

  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================

  setState(newState) {
    const oldState = this.state;
    this.state = newState;

    logger.info(
      {
        from: oldState,
        to: newState,
      },
      'Koneksi diperbaharui'
    );

    if (this.onStateChange) {
      this.onStateChange(newState, oldState);
    }
  }

  getState() {
    return this.state;
  }

  // ==========================================================================
  // RECONNECTION LOGIC
  // ==========================================================================

  canReconnect() {
    // Check if already reconnecting
    if (this.isReconnecting) {
      logger.debug('Reconnection siap diproses');
      return false;
    }

    // Check circuit breaker
    if (!this.circuitBreaker.canAttempt()) {
      logger.warn('Pemutus arus terbuka, menghalangi penyambungan kembali');
      return false;
    }

    // Clean old attempts outside window
    const now = Date.now();
    this.reconnectWindow = this.reconnectWindow.filter(
      (time) => now - time < CONFIG.reconnect.windowMs
    );

    // Check rate limit
    if (this.reconnectWindow.length >= CONFIG.reconnect.maxAttemptsPerHour) {
      logger.error(
        {
          attempts: this.reconnectWindow.length,
          limit: CONFIG.reconnect.maxAttemptsPerHour,
        },
        'Reconnection mencapai batas'
      );
      return false;
    }

    return true;
  }

  calculateReconnectDelay() {
    const attemptCount = this.reconnectWindow.length;
    const baseDelay = CONFIG.reconnect.minDelayMs;
    const exponentialDelay = baseDelay * Math.pow(2, attemptCount);
    const cappedDelay = Math.min(exponentialDelay, CONFIG.reconnect.maxDelayMs);

    // Add jitter
    const jitter = cappedDelay * CONFIG.reconnect.jitterPercent * Math.random();

    return Math.floor(cappedDelay + jitter);
  }

  async scheduleReconnect(reason, customDelay = null, callback) {
    if (!this.canReconnect()) {
      logger.error('Tidak dapat terhubung ulang saat ini');
      return false;
    }

    // Clear existing timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    this.reconnectWindow.push(Date.now());

    const delay = customDelay !== null ? customDelay : this.calculateReconnectDelay();

    logger.info(
      {
        reason,
        delay,
        attempt: this.reconnectWindow.length,
        maxAttempts: CONFIG.reconnect.maxAttemptsPerHour,
      },
      'Menjadwalkan reconnection'
    );

    this.setState(ConnectionState.RECONNECTING);

    this.reconnectTimer = setTimeout(async () => {
      try {
        logger.info('Mengeksekusi reconnection');
        await callback();
        this.circuitBreaker.recordSuccess();
      } catch (error) {
        logger.error(
          {
            error: error.message,
            stack: error.stack,
          },
          'Reconnection callback gagal'
        );
        this.circuitBreaker.recordFailure();
      } finally {
        this.isReconnecting = false;
        this.reconnectTimer = null;
      }
    }, delay);

    return true;
  }

  // ==========================================================================
  // CONNECTION UPDATE HANDLER
  // ==========================================================================

  async handleConnectionUpdate(update, context) {
    const { connection, lastDisconnect, isNewLogin } = update;
    const {
      conn,
      authStore,
      setupPairingCode,
      pluginLoader,
      store,
      reconnectCallback,
    } = context;

    try {
      // ========== CONNECTION OPEN ==========
      if (connection === 'open') {
        this.setState(ConnectionState.CONNECTED);
        this.connectionAttempts = 0;
        this.lastConnectedTime = Date.now();
        this.circuitBreaker.recordSuccess();

        const userId = conn.user?.id || 'Unknown';
        const userName = conn.user?.name || 'Bot';

        logger.info(
          {
            user: userName,
            id: userId,
            uptime: this.getUptime(),
          },
          'Koneksi dimulai'
        );

        // Reload store
        if (store && typeof store.reloadData === 'function') {
          try {
            await store.reloadData();
          } catch (error) {
            logger.error({ error: error.message }, 'Gagal memuat store');
          }
        }

        // Load plugins
        if (pluginLoader) {
          try {
            await pluginLoader.loadAll();
          } catch (error) {
            logger.error({ error: error.message }, 'Gagal memuat plugin');
          }
        }

        // Start health monitoring
        this.startHealthMonitoring();

        return;
      }

      // ========== CONNECTION CLOSE ==========
      if (connection === 'close') {
        this.setState(ConnectionState.DISCONNECTED);
        this.lastDisconnectTime = Date.now();
        this.circuitBreaker.recordFailure();

        const error = lastDisconnect?.error;
        const statusCode = this._getStatusCode(error);

        logger.error(
          {
            statusCode,
            error: error?.message,
            output: error?.output,
          },
          'Koneksi ditutup'
        );

        // Stop health monitoring
        this.stopHealthMonitoring();

        // Stop plugins
        if (pluginLoader) {
          try {
            pluginLoader.destroy();
            logger.debug('Plugin dihentikan');
          } catch (error) {
            logger.error({ error: error.message }, 'Gagal menghentikan plugin');
          }
        }

        // Handle different disconnect reasons
        await this._handleDisconnectReason(statusCode, authStore, reconnectCallback);

        return;
      }

      // ========== CONNECTING ==========
      if (connection === 'connecting') {
        this.setState(ConnectionState.CONNECTING);
        this.connectionAttempts++;

        logger.info(
          {
            attempt: this.connectionAttempts,
          },
          'Menghubungkan WhatsApp'
        );

        // Try pairing code
        if (conn && !conn.authState?.creds?.registered && setupPairingCode) {
          try {
            await setupPairingCode(conn);
          } catch (error) {
            logger.error({ error: error.message }, 'Penyiapan pairing kode gagal');
          }
        }

        return;
      }

      // ========== NEW LOGIN ==========
      if (isNewLogin) {
        logger.info('Login baru terdeteksi');

        if (authStore && typeof authStore.saveCredentials === 'function') {
          try {
            authStore.saveCredentials();
            logger.debug('Credentials saved');
          } catch (error) {
            logger.error({ error: error.message }, 'Gagal menyimpan kredensial');
          }
        }

        return;
      }
    } catch (error) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
          connection,
        },
        'Connection update handler error'
      );

      // Record error in auth store
      if (authStore && typeof authStore.recordError === 'function') {
        const { shouldClear } = authStore.recordError(error);

        if (shouldClear) {
          logger.error('Terlalu banyak error - membersihkan session');
          await authStore.clearSession?.();
        }
      }
    }
  }

  async _handleDisconnectReason(statusCode, authStore, reconnectCallback) {
    const { clearCodes, restoreCodes, quickReconnectCodes } = CONFIG.session;

    try {
      // ===== CLEAR SESSION =====
      if (clearCodes.includes(statusCode)) {
        logger.error({ statusCode }, 'Session tidak valid - membersihkan');

        if (authStore && typeof authStore.clearSession === 'function') {
          await authStore.clearSession();
        }

        await this.scheduleReconnect('session_cleared', 3000, reconnectCallback);
        return;
      }

      // ===== RESTORE SESSION =====
      if (restoreCodes.includes(statusCode)) {
        logger.warn({ statusCode }, 'Session corrupted - memulai perbaikan');

        if (authStore && typeof authStore.restoreSession === 'function') {
          const result = await authStore.restoreSession();

          if (result?.success) {
            logger.info('Session restored successfully');
            await this.scheduleReconnect('session_restored', 2000, reconnectCallback);
            return;
          }

          if (result?.shouldClearSession) {
            logger.warn('Session restore failed - clearing');
            await authStore.clearSession();
            await this.scheduleReconnect('session_cleared_after_restore', 3000, reconnectCallback);
            return;
          }
        }
      }

      // ===== QUICK RECONNECT =====
      if (quickReconnectCodes.includes(statusCode)) {
        logger.info({ statusCode }, 'Quick reconnect triggered');
        await this.scheduleReconnect(`quick_reconnect_${statusCode}`, 1000, reconnectCallback);
        return;
      }

      // ===== DEFAULT RECONNECT =====
      logger.warn({ statusCode }, 'Default reconnect strategy');
      await this.scheduleReconnect(`disconnect_${statusCode}`, null, reconnectCallback);
    } catch (error) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
        },
        'Disconnect handler error'
      );

      // Fallback: schedule reconnect with delay
      await this.scheduleReconnect('error_recovery', 10000, reconnectCallback);
    }
  }

  // ==========================================================================
  // HEALTH MONITORING
  // ==========================================================================

  startHealthMonitoring() {
    if (this.healthCheckTimer) {
      return;
    }

    this.healthCheckTimer = setInterval(() => {
      this._performHealthCheck();
    }, CONFIG.health.checkIntervalMs);

    this.healthCheckTimer?.unref?.();
    logger.debug('Monitoring kesehatan dimulai');
  }

  stopHealthMonitoring() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      logger.debug('Monitoring kesehatan berhenti');
    }
  }

  _performHealthCheck() {
    const now = Date.now();
    this.lastHealthCheck = now;

    // Check if connection is stale
    if (this.state === ConnectionState.CONNECTED) {
      const connectionAge = now - this.lastConnectedTime;

      if (connectionAge > CONFIG.health.timeoutThreshold) {
        logger.warn(
          {
            age: connectionAge,
            threshold: CONFIG.health.timeoutThreshold,
          },
          'Koneksi mungkin basi'
        );
      }
    }
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  _getStatusCode(error) {
    if (!error) return 0;
    return error.output?.statusCode || error.statusCode || error.status || 0;
  }

  getUptime() {
    if (this.state === ConnectionState.CONNECTED && this.lastConnectedTime > 0) {
      return Date.now() - this.lastConnectedTime;
    }
    return 0;
  }

  getStats() {
    return {
      state: this.state,
      reconnectAttempts: this.reconnectAttempts,
      reconnectWindow: this.reconnectWindow.length,
      connectionAttempts: this.connectionAttempts,
      lastConnectedTime: this.lastConnectedTime,
      lastDisconnectTime: this.lastDisconnectTime,
      uptime: this.getUptime(),
      circuitBreaker: this.circuitBreaker.getState(),
      isReconnecting: this.isReconnecting,
    };
  }

  logStats() {
    logger.info(this.getStats(), 'Statistik koneksi');
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  cleanup() {
    logger.info('Cleaning up connection manager');

    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Stop health monitoring
    this.stopHealthMonitoring();

    // Reset circuit breaker
    this.circuitBreaker.reset();

    // Reset state
    this.setState(ConnectionState.DISCONNECTED);
    this.isReconnecting = false;

    logger.info('Connection manager cleanup berhasil');
  }
}

export default ConnectionManager;
