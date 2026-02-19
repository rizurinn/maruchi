/**
 * @file shutdown.js
 * Robust shutdown manager for WhatsApp bot with proper resource cleanup
 * 
 * Features:
 * - Graceful shutdown sequencing
 * - Resource cleanup tracking
 * - Timeout protection
 * - Signal handler coordination
 * - Cleanup verification
 */

import pino from 'pino';

const logger = pino({
  level: Bun.env.LOG_LEVEL || 'silent',
  base: { module: 'SHUTDOWN' },
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
// SHUTDOWN MANAGER
// ============================================================================

class ShutdownManager {
  constructor() {
    this.isShuttingDown = false;
    this.resources = new Map();
    this.cleanupOrder = [];
    this.shutdownHandlers = new Map();
    this.timeouts = {
      perResource: 5000,
      total: 30000,
    };
  }

  /**
   * Register a resource for cleanup
   */
  register(name, resource, cleanupFn, options = {}) {
    if (this.resources.has(name)) {
      logger.warn({ name }, 'Resource already registered, replacing');
    }

    this.resources.set(name, {
      resource,
      cleanup: cleanupFn,
      priority: options.priority || 50,
      timeout: options.timeout || this.timeouts.perResource,
      critical: options.critical || false,
    });

    // Rebuild cleanup order
    this._rebuildCleanupOrder();

    logger.debug({ name, priority: options.priority }, 'Resource registered');
  }

  /**
   * Unregister a resource
   */
  unregister(name) {
    const deleted = this.resources.delete(name);
    if (deleted) {
      this._rebuildCleanupOrder();
      logger.debug({ name }, 'Resource unregistered');
    }
    return deleted;
  }

  /**
   * Rebuild cleanup order based on priority (higher = cleanup first)
   */
  _rebuildCleanupOrder() {
    this.cleanupOrder = Array.from(this.resources.entries())
      .sort((a, b) => b[1].priority - a[1].priority)
      .map(([name]) => name);
  }

  /**
   * Execute cleanup for a single resource
   */
  async _cleanupResource(name, config) {
    const { cleanup, timeout, critical } = config;

    try {
      logger.info({ name, timeout }, 'Cleaning up resource');

      await Promise.race([
        cleanup(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Cleanup timeout')), timeout)
        ),
      ]);

      logger.info({ name }, 'Resource cleaned up successfully');
      return { name, success: true };
    } catch (error) {
      logger.error(
        {
          name,
          error: error.message,
          critical,
        },
        'Resource cleanup failed'
      );

      if (critical) {
        throw error;
      }

      return { name, success: false, error: error.message };
    }
  }

  /**
   * Perform graceful shutdown
   */
  async shutdown(reason = 'unknown') {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    const startTime = Date.now();

    logger.info(
      {
        reason,
        resourceCount: this.resources.size,
        order: this.cleanupOrder,
      },
      'Initiating graceful shutdown'
    );

    const results = [];

    try {
      // Execute cleanup in priority order
      for (const name of this.cleanupOrder) {
        const config = this.resources.get(name);
        if (!config) continue;

        const result = await this._cleanupResource(name, config);
        results.push(result);
      }

      // Execute shutdown handlers
      for (const [id, handler] of this.shutdownHandlers) {
        try {
          logger.debug({ id }, 'Executing shutdown handler');
          await handler();
        } catch (error) {
          logger.error({ id, error: error.message }, 'Shutdown handler failed');
        }
      }

      const duration = Date.now() - startTime;
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      logger.info(
        {
          duration,
          total: results.length,
          successful,
          failed,
        },
        'Shutdown completed'
      );

      return {
        success: failed === 0,
        duration,
        results,
      };
    } catch (error) {
      logger.fatal(
        {
          error: error.message,
          stack: error.stack,
        },
        'Critical error during shutdown'
      );

      throw error;
    }
  }

  /**
   * Register a shutdown handler (called after resource cleanup)
   */
  onShutdown(id, handler) {
    this.shutdownHandlers.set(id, handler);
  }

  /**
   * Get shutdown status
   */
  getStatus() {
    return {
      isShuttingDown: this.isShuttingDown,
      resourceCount: this.resources.size,
      resources: Array.from(this.resources.keys()),
    };
  }
}

// ============================================================================
// SIGNAL HANDLER
// ============================================================================

class SignalHandler {
  constructor(shutdownManager) {
    this.shutdownManager = shutdownManager;
    this.signalsRegistered = false;
    this.exitCode = 0;
  }

  /**
   * Register signal handlers
   */
  register() {
    if (this.signalsRegistered) {
      logger.warn('Signal handlers already registered');
      return;
    }

    this.signalsRegistered = true;

    // Graceful shutdown signals
    process.once('SIGTERM', () => this._handleSignal('SIGTERM', 143));
    process.once('SIGINT', () => this._handleSignal('SIGINT', 130));

    // Error handlers
    process.on('uncaughtException', (error) =>
      this._handleError('uncaughtException', error, 1)
    );
    process.on('unhandledRejection', (reason, promise) =>
      this._handleRejection(reason, promise)
    );

    // Exit handler
    process.on('exit', (code) => {
      logger.info({ code }, 'Process exiting');
    });

    logger.info('Signal handlers registered');
  }

  /**
   * Handle termination signals
   */
  async _handleSignal(signal, exitCode) {
    logger.info({ signal }, 'Termination signal received');

    try {
      await this.shutdownManager.shutdown(signal);
      
      // Force exit after shutdown
      const timer = setTimeout(() => {
        logger.warn('Forcing exit after timeout');
        process.exit(exitCode);
      }, 5000);
      
      timer?.unref?.();
      
      process.exit(exitCode);
    } catch (error) {
      logger.fatal({ error: error.message }, 'Shutdown failed');
      process.exit(1);
    }
  }

  /**
   * Handle uncaught exceptions
   */
  async _handleError(type, error, exitCode) {
    logger.error(
      {
        type,
        error: error.message,
        stack: error.stack,
      },
      'Fatal error'
    );

    try {
      await this.shutdownManager.shutdown(type);
    } catch (shutdownError) {
      logger.fatal({ error: shutdownError.message }, 'Shutdown failed');
    }

    // Force exit
    setTimeout(() => process.exit(exitCode), 2000);
  }

  /**
   * Handle unhandled rejections
   */
  async _handleRejection(reason, promise) {
    logger.error(
      {
        reason: reason?.message || String(reason),
        stack: reason?.stack,
      },
      'Unhandled promise rejection'
    );

    // Don't exit on rejection, just log
    // But track for potential issues
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

const shutdownManager = new ShutdownManager();
const signalHandler = new SignalHandler(shutdownManager);

export { shutdownManager, signalHandler, ShutdownManager, SignalHandler };
