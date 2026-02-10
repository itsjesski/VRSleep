const { loadAuth, saveAuth, clearAuth } = require("../stores/auth-store");

const API_BASE = "https://api.vrchat.cloud/api/1";
let inMemoryAuth = null;

/**
 * Builds a complete VRChat API URL.
 */
function buildUrl(path) {
  const apiKey = process.env.VRC_API_KEY;
  if (!apiKey) return `${API_BASE}${path}`;
  const joiner = path.includes("?") ? "&" : "?";
  return `${API_BASE}${path}${joiner}apiKey=${encodeURIComponent(apiKey)}`;
}

/**
 * Returns a consistent User-Agent string for all requests.
 */
function getUserAgent() {
  return (
    process.env.VRC_USER_AGENT ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  );
}

/**
 * Parses a cookie string into a key-value object.
 */
function parseCookieString(cookieString) {
  if (!cookieString) return {};
  return cookieString
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((acc, item) => {
      const [name, ...rest] = item.split("=");
      if (!name) return acc;
      acc[name] = rest.join("=");
      return acc;
    }, {});
}

/**
 * Merges new cookies from a 'set-cookie' header into the existing cookie jar.
 */
function mergeCookies(existing, setCookies) {
  const jar = parseCookieString(existing);
  const newCookies = Array.isArray(setCookies) ? setCookies : [setCookies];

  for (const setCookie of newCookies) {
    const [cookiePair] = setCookie.split(";");
    const [name, ...rest] = cookiePair.trim().split("=");
    if (!name) continue;
    jar[name] = rest.join("=");
  }

  return Object.entries(jar)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

/**
 * Extracts and merges cookies from an HTTP response.
 */
function updateCookies(current, response) {
  if (!response?.headers) return current;

  let setCookies = null;
  // Modern fetch API support
  if (typeof response.headers.getSetCookie === "function") {
    setCookies = response.headers.getSetCookie();
  }

  // Fallback for older environments
  if (!setCookies) {
    const setCookieHeader = response.headers.get("set-cookie");
    if (setCookieHeader) {
      setCookies = setCookieHeader.split(",").map((item) => item.trim());
    }
  }

  if (!setCookies || setCookies.length === 0) return current;
  return mergeCookies(current, setCookies);
}

/**
 * Returns the cached or persistently stored authentication data.
 */
function getStoredAuth() {
  if (!inMemoryAuth) {
    inMemoryAuth = loadAuth();
  }
  return inMemoryAuth;
}

/**
 * Saves authentication data both in memory and to persistent storage.
 */
function setStoredAuth(auth) {
  inMemoryAuth = auth;
  saveAuth(auth);
}

/**
 * Constructs the standard authentication headers for VRChat API calls.
 */
function getAuthHeaders() {
  const auth = getStoredAuth();
  if (!auth?.cookies) return null;
  return {
    "User-Agent": getUserAgent(),
    "Content-Type": "application/json",
    Cookie: auth.cookies,
  };
}

/**
 * Checks if the application has the necessary credentials to make API calls.
 */
function isReadyForApi() {
  const auth = getStoredAuth();
  return Boolean(auth?.cookies);
}

/**
 * Core helper for making JSON requests to the VRChat API.
 * Includes a 15-second timeout and automatic error parsing.
 */
async function requestJson(path, options = {}) {
  const url = buildUrl(path);
  console.log("[API] Fetching:", url);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      ...options,
      credentials: "include",
      signal: controller.signal,
    });

    const text = await response.text();
    const json = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const message =
        json?.error?.message || json?.message || `HTTP ${response.status}`;
      const err = new Error(message);
      err.status = response.status;
      err.data = json; // Attach full error details (like cooldown messages)
      throw err;
    }

    return { response, json };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetches the initial VRChat config to establish an initial session cookie.
 */
async function getConfig() {
  const { response, json } = await requestJson("/config", {
    method: "GET",
    headers: { "User-Agent": getUserAgent() },
  });

  const cookies = updateCookies(inMemoryAuth?.cookies || "", response);
  inMemoryAuth = { cookies, userId: null };
  return json;
}

/**
 * Primary login flow using Basic Auth.
 * Returns either an 'ok' status with user data or a '2fa' status with required methods.
 */
async function login({ username, password }) {
  try {
    await getConfig();
  } catch (error) {
    throw new Error("Failed to connect to VRChat API");
  }

  const authHeader = Buffer.from(`${username}:${password}`).toString("base64");

  const { response, json } = await requestJson("/auth/user", {
    method: "GET",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "User-Agent": getUserAgent(),
    },
  });

  const cookies = updateCookies(inMemoryAuth?.cookies, response);
  inMemoryAuth = { cookies, userId: json?.id || null };

  if (json?.requiresTwoFactorAuth) {
    return {
      status: "2fa",
      methods: json.requiresTwoFactorAuth,
    };
  }

  if (json?.id && cookies) {
    setStoredAuth({ cookies, userId: json.id, user: json });
  }

  return { status: "ok", user: json };
}

/**
 * Verifies a 2FA code (TOTP, Email, or Backup Code).
 */
async function verifyTwoFactor(type, code) {
  const auth = inMemoryAuth || getStoredAuth();
  if (!auth?.cookies) throw new Error("No pending authentication cookies.");

  const map = {
    totp: "/auth/twofactorauth/totp/verify",
    otp: "/auth/twofactorauth/otp/verify",
    email: "/auth/twofactorauth/emailotp/verify",
  };

  const endpoint = map[type];
  if (!endpoint) throw new Error("Unsupported 2FA type.");

  const { response } = await requestJson(endpoint, {
    method: "POST",
    headers: {
      "User-Agent": getUserAgent(),
      "Content-Type": "application/json",
      Cookie: auth.cookies,
    },
    body: JSON.stringify({ code }),
  });

  const cookies = updateCookies(auth.cookies, response);
  inMemoryAuth = { ...auth, cookies };

  // Fetch the full user profile now that verification is complete
  const { json: user } = await requestJson("/auth/user", {
    method: "GET",
    headers: {
      "User-Agent": getUserAgent(),
      "Content-Type": "application/json",
      Cookie: cookies,
    },
  });

  if (user?.id) {
    setStoredAuth({ cookies, userId: user.id, user });
  }

  return user;
}

/**
 * Clears all authentication data.
 */
async function logout() {
  inMemoryAuth = null;
  clearAuth();
  return true;
}

/**
 * Returns the current authentication status and user identity.
 */
function getAuthStatus() {
  const auth = getStoredAuth();
  return {
    authenticated: Boolean(auth?.cookies),
    userId: auth?.userId || null,
    user: auth?.user || null,
  };
}

module.exports = {
  login,
  verifyTwoFactor,
  logout,
  getAuthStatus,
  getAuthHeaders,
  isReadyForApi,
  getConfig,
  requestJson,
};
