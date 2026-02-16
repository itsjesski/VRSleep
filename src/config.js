/**
 * Centralized Configuration Module.
 * All application constants and configurable values in one place.
 */

module.exports = {
  /**
   * API Configuration
   */
  api: {
    // Base URL for VRChat API
    baseUrl: "https://api.vrchat.cloud/api/1",
    
    // Request timeout in milliseconds
    requestTimeout: 15000,
    
    // Default polling interval for sleep mode
    defaultPollMs: 15000,
    
    // Minimum allowed polling interval (prevents API spam)
    minPollMs: 10000,
    
    // Batch size for concurrent message slot requests
    messageBatchSize: 3,
    
    // Delay between batches (ms) to avoid rate limiting
    batchDelay: 200,
    
    // Retry configuration for rate-limited requests
    maxRetries: 3,
    retryBaseDelay: 1000, // Initial delay, doubles each retry
    
    // User agent string for API requests
    userAgent: process.env.VRC_USER_AGENT || 
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    
    // Optional API key (from environment)
    apiKey: process.env.VRC_API_KEY || null,
  },

  /**
   * Resource and Performance Configuration
   */
  resources: {
    // Maximum V8 heap size in MB
    maxOldSpaceMb: Number(process.env.SLEEPCHAT_MAX_OLD_SPACE_MB) || 128,
  },

  /**
   * Security and Data Retention Limits
   */
  security: {
    // Maximum number of invite IDs to track (prevents memory leaks)
    maxHandledInviteIds: 1000,
    
    // Maximum number of sender IDs to track per session
    maxHandledSenderIds: 500,
    
    // Cleanup interval for tracked IDs (ms)
    cleanupInterval: 300000, // 5 minutes
  },

  /**
   * Application Metadata
   */
  app: {
    // Application ID for Windows notifications
    appUserModelId: "com.vrsleep.app",
  },

  /**
   * File Storage Names
   */
  storage: {
    authFile: "auth.json",
    settingsFile: "settings.json",
    whitelistFile: "whitelist.json",
    messageSlotsFile: "message-slots.json",
  },
};
