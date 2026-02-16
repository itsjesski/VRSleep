const config = require("../config");

/**
 * Shared API Utilities Module.
 * Common functions used across VRChat API modules to reduce duplication.
 */

/**
 * Builds a complete VRChat API URL, optionally appending the API key.
 * @param {string} path - The API endpoint path (e.g., "/auth/user")
 * @returns {string} The complete URL
 */
function buildUrl(path) {
  const apiKey = config.api.apiKey;
  if (!apiKey) return `${config.api.baseUrl}${path}`;
  const joiner = path.includes("?") ? "&" : "?";
  return `${config.api.baseUrl}${path}${joiner}apiKey=${encodeURIComponent(apiKey)}`;
}

/**
 * Returns a consistent User-Agent string for all API requests.
 * @returns {string} The User-Agent header value
 */
function getUserAgent() {
  return config.api.userAgent;
}

/**
 * Validates that a string is a valid user ID format.
 * @param {string} userId - The user ID to validate
 * @returns {boolean} True if valid
 */
function isValidUserId(userId) {
  return typeof userId === "string" && userId.startsWith("usr_") && userId.length > 10;
}

/**
 * Validates that a string is a valid notification ID format.
 * @param {string} notificationId - The notification ID to validate
 * @returns {boolean} True if valid
 */
function isValidNotificationId(notificationId) {
  return typeof notificationId === "string" && notificationId.startsWith("not_") && notificationId.length > 10;
}

/**
 * Sanitizes a message string for API submission.
 * Removes excessive whitespace and ensures max length.
 * @param {string} message - The message to sanitize
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} The sanitized message
 */
function sanitizeMessage(message, maxLength = 256) {
  if (typeof message !== "string") return "";
  return message.trim().slice(0, maxLength);
}

/**
 * Delays execution for a specified time (useful for rate limiting).
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Implements exponential backoff retry logic for API requests.
 * @param {Function} requestFn - Async function that makes the request
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<any>} The result from the successful request
 * @throws {Error} The last error if all retries fail
 */
async function retryWithBackoff(requestFn, maxRetries = config.api.maxRetries) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      
      // Only retry on rate limit errors (429) or temporary server errors (503)
      const shouldRetry = error.status === 429 || error.status === 503;
      const isLastAttempt = attempt === maxRetries - 1;
      
      if (!shouldRetry || isLastAttempt) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s, etc.
      const delayMs = config.api.retryBaseDelay * Math.pow(2, attempt);
      console.log(`[API] Rate limited. Retrying in ${delayMs}ms... (Attempt ${attempt + 1}/${maxRetries})`);
      await delay(delayMs);
    }
  }
  
  throw lastError;
}

module.exports = {
  buildUrl,
  getUserAgent,
  isValidUserId,
  isValidNotificationId,
  sanitizeMessage,
  delay,
  retryWithBackoff,
};
