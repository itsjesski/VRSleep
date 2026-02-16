const { app, safeStorage } = require("electron");
const fs = require("fs");
const path = require("path");

/**
 * Authentication Storage Module.
 * Manages the persistent storage of VRChat credentials using Electron's safeStorage API
 * to ensure that cookies and user IDs are encrypted at rest.
 */

/**
 * @typedef {Object} AuthData
 * @property {string} cookies - Encrypted authentication cookies
 * @property {string|null} userId - The authenticated user's VRChat ID
 * @property {Object|null} user - The full user object from VRChat
 */

const FILE_NAME = "auth.json";
let cachedAuth = null;

/**
 * Returns the absolute path to the authentication data file.
 */
function getFilePath() {
  return path.join(app.getPath("userData"), FILE_NAME);
}

/**
 * Loads and decrypts authentication data from disk.
 * Returns null if no session exists or if decryption fails.
 * @returns {AuthData|null} The decrypted authentication data or null
 */
function loadAuth() {
  if (cachedAuth) return cachedAuth;

  const filePath = getFilePath();
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const payload = JSON.parse(raw);

    if (!payload?.data) return null;

    // Verify system support for encryption (required for safeStorage)
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("Encryption is not available on this system.");
    }

    const decrypted = safeStorage.decryptString(
      Buffer.from(payload.data, "base64"),
    );

    cachedAuth = JSON.parse(decrypted);
    return cachedAuth;
  } catch (error) {
    // If decryption or parsing fails, we assume the session is invalid
    return null;
  }
}

/**
 * Encrypts and saves authentication data to disk.
 * @param {AuthData} auth - The authentication object containing cookies and user data.
 */
function saveAuth(auth) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Encryption is not available on this system.");
  }

  const filePath = getFilePath();
  const dataString = JSON.stringify(auth);

  // Encrypt the session data using the OS-level credential manager (DPAPI on Windows, Keychain on macOS)
  const encryptedBuffer = safeStorage.encryptString(dataString);

  fs.writeFileSync(
    filePath,
    JSON.stringify({ data: encryptedBuffer.toString("base64") }),
  );

  cachedAuth = auth;
}

/**
 * Deletes the authentication data from disk and clears the memory cache.
 */
function clearAuth() {
  cachedAuth = null;
  const filePath = getFilePath();
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      // Silent fail if file cannot be deleted
    }
  }
}

module.exports = {
  loadAuth,
  saveAuth,
  clearAuth,
};
