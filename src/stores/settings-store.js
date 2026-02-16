const { app } = require("electron");
const fs = require("fs");
const path = require("path");

/**
 * Settings Storage Module.
 * Manages the persistent storage of user preferences and application configuration.
 */

/**
 * @typedef {Object} AppSettings
 * @property {string} sleepStatus - The VRChat status to set during sleep mode
 * @property {string} sleepStatusDescription - The status description text
 * @property {number} inviteMessageSlot - Which message slot to use for invites (0-11)
 * @property {string} inviteMessageType - The type of message ("message", "response", etc.)
 * @property {boolean} autoStatusEnabled - Whether to automatically change status
 * @property {boolean} inviteMessageEnabled - Whether to use message slots for invites
 * @property {string} activeTab - The last active UI tab
 */

const FILE_NAME = "settings.json";

// Default configuration for fresh installations.
const DEFAULT_SETTINGS = {
  sleepStatus: "none",
  sleepStatusDescription: "",
  inviteMessageSlot: 0,
  inviteMessageType: "message",
  autoStatusEnabled: false,
  inviteMessageEnabled: false,
  activeTab: "whitelist", // Track the user's last active tab for UX continuity.
};

/**
 * Returns the absolute path to the settings data file.
 */
function getFilePath() {
  const folder = app.getPath("userData");
  return path.join(folder, FILE_NAME);
}

/**
 * Retrieves the current settings from disk, merged with defaults.
 * @returns {AppSettings} The complete settings object.
 */
function getSettings() {
  const filePath = getFilePath();
  if (!fs.existsSync(filePath)) return { ...DEFAULT_SETTINGS };

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    // Merge with defaults to ensure new settings (from app updates) are always present.
    return { ...DEFAULT_SETTINGS, ...data };
  } catch (error) {
    // Return defaults if parsing fails to avoid breaking the application.
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Partially or fully updates the application settings.
 * @param {Partial<AppSettings>} settings - An object containing the settings to update.
 * @returns {AppSettings} The newly saved, complete settings object.
 */
function setSettings(settings) {
  const filePath = getFilePath();
  const current = getSettings();
  const next = { ...current, ...settings };

  try {
    fs.writeFileSync(filePath, JSON.stringify(next, null, 2));
  } catch (error) {
    console.error("Failed to save settings:", error);
  }

  return next;
}

module.exports = {
  getSettings,
  setSettings,
};
