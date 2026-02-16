const { app } = require("electron");
const fs = require("fs");
const path = require("path");

/**
 * File-based Logger Utility.
 * Logs errors and debug information to a persistent file for troubleshooting.
 */

const LOG_FILE_NAME = "vrsleep.log";
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_LOG_LINES = 10000;

/**
 * Gets the absolute path to the log file.
 * @returns {string} The log file path
 */
function getLogFilePath() {
  return path.join(app.getPath("userData"), LOG_FILE_NAME);
}

/**
 * Formats a log entry with timestamp and level.
 * @param {string} level - Log level (INFO, WARN, ERROR)
 * @param {string} category - Category/module name
 * @param {string} message - Log message
 * @returns {string} Formatted log line
 */
function formatLogEntry(level, category, message) {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] [${category}] ${message}\n`;
}

/**
 * Rotates the log file if it exceeds size limits.
 * Keeps only the most recent entries.
 */
function rotateLogIfNeeded() {
  try {
    const logPath = getLogFilePath();
    if (!fs.existsSync(logPath)) return;

    const stats = fs.statSync(logPath);
    if (stats.size < MAX_LOG_SIZE) return;

    // Read the file and keep only the last N lines
    const content = fs.readFileSync(logPath, "utf8");
    const lines = content.split("\n");
    
    if (lines.length > MAX_LOG_LINES) {
      const keptLines = lines.slice(-MAX_LOG_LINES);
      fs.writeFileSync(logPath, keptLines.join("\n"), "utf8");
      console.log(`[Logger] Rotated log file, kept last ${MAX_LOG_LINES} lines`);
    }
  } catch (error) {
    // Don't let logging errors break the app
    console.error("[Logger] Failed to rotate log:", error.message);
  }
}

/**
 * Writes a log entry to the file.
 * @param {string} level - Log level
 * @param {string} category - Category/module name
 * @param {string} message - Log message
 */
function writeLog(level, category, message) {
  try {
    const logPath = getLogFilePath();
    const entry = formatLogEntry(level, category, message);
    
    // Append to file (creates if doesn't exist)
    fs.appendFileSync(logPath, entry, "utf8");
    
    // Check if rotation is needed (do this periodically, not on every log)
    if (Math.random() < 0.01) { // 1% chance per log
      rotateLogIfNeeded();
    }
  } catch (error) {
    // Fail silently to console to avoid infinite loops
    console.error("[Logger] Failed to write log:", error.message);
  }
}

/**
 * Logs an informational message.
 * @param {string} category - Category/module name (e.g., "SleepMode", "API")
 * @param {string} message - Log message
 */
function logInfo(category, message) {
  writeLog("INFO", category, message);
  console.log(`[${category}] ${message}`);
}

/**
 * Logs a warning message.
 * @param {string} category - Category/module name
 * @param {string} message - Warning message
 */
function logWarn(category, message) {
  writeLog("WARN", category, message);
  console.warn(`[${category}] ${message}`);
}

/**
 * Logs an error message with optional error object.
 * @param {string} category - Category/module name
 * @param {string} message - Error message
 * @param {Error} [error] - Optional error object for stack trace
 */
function logError(category, message, error = null) {
  let fullMessage = message;
  
  if (error) {
    fullMessage += ` | ${error.message}`;
    if (error.stack) {
      fullMessage += `\n${error.stack}`;
    }
  }
  
  writeLog("ERROR", category, fullMessage);
  console.error(`[${category}] ${message}`, error || "");
}

/**
 * Clears the log file.
 */
function clearLog() {
  try {
    const logPath = getLogFilePath();
    if (fs.existsSync(logPath)) {
      fs.unlinkSync(logPath);
      logInfo("Logger", "Log file cleared");
    }
  } catch (error) {
    console.error("[Logger] Failed to clear log:", error.message);
  }
}

/**
 * Gets the log file size in bytes.
 * @returns {number} File size in bytes, or 0 if file doesn't exist
 */
function getLogFileSize() {
  try {
    const logPath = getLogFilePath();
    if (!fs.existsSync(logPath)) return 0;
    const stats = fs.statSync(logPath);
    return stats.size;
  } catch (error) {
    return 0;
  }
}

module.exports = {
  getLogFilePath,
  logInfo,
  logWarn,
  logError,
  clearLog,
  getLogFileSize,
};
