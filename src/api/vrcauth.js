const { loadAuth, saveAuth, clearAuth } = require("../stores/auth-store");

const API_BASE = "https://api.vrchat.cloud/api/1";
let inMemoryAuth = null;

function buildUrl(path) {
  const apiKey = process.env.VRC_API_KEY;
  if (!apiKey) return `${API_BASE}${path}`;
  const joiner = path.includes("?") ? "&" : "?";
  return `${API_BASE}${path}${joiner}apiKey=${encodeURIComponent(apiKey)}`;
}

function getUserAgent() {
  return (
    process.env.VRC_USER_AGENT ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  );
}

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

function parseSetCookies(setCookies) {
  if (!setCookies) return [];
  if (Array.isArray(setCookies)) return setCookies;
  return [setCookies];
}

function mergeCookies(existing, setCookies) {
  const jar = parseCookieString(existing);
  for (const setCookie of parseSetCookies(setCookies)) {
    const [cookiePair] = setCookie.split(";");
    const [name, ...rest] = cookiePair.trim().split("=");
    if (!name) continue;
    jar[name] = rest.join("=");
  }
  return Object.entries(jar)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function getStoredAuth() {
  if (!inMemoryAuth) {
    inMemoryAuth = loadAuth();
  }
  return inMemoryAuth;
}

function setStoredAuth(auth) {
  inMemoryAuth = auth;
  saveAuth(auth);
}

function updateCookies(current, response) {
  if (!response?.headers) return current;

  let setCookies = null;
  if (typeof response.headers.getSetCookie === "function") {
    setCookies = response.headers.getSetCookie();
  }

  if (!setCookies) {
    const setCookieHeader = response.headers.get("set-cookie");
    if (setCookieHeader) {
      setCookies = setCookieHeader.split(",").map((item) => item.trim());
    }
  }

  if (!setCookies && typeof response.headers.forEach === "function") {
    const cookies = [];
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "set-cookie") {
        cookies.push(value);
      }
    });
    if (cookies.length > 0) setCookies = cookies;
  }

  if (!setCookies || (Array.isArray(setCookies) && setCookies.length === 0)) {
    return current;
  }

  return mergeCookies(current, setCookies);
}

function getAuthHeaders() {
  const auth = getStoredAuth();
  if (!auth?.cookies) return null;
  return {
    "User-Agent": getUserAgent(),
    "Content-Type": "application/json",
    Cookie: auth.cookies,
  };
}

function isReadyForApi() {
  const auth = getStoredAuth();
  return Boolean(auth?.cookies);
}

async function requestJson(path, options = {}) {
  const url = buildUrl(path);
  console.log("[API] Fetching:", url);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const response = await fetch(url, {
      ...options,
      credentials: "include",
      signal: controller.signal,
    });
    const text = await response.text();
    console.log("[API] Response status:", response.status);
    const json = text ? JSON.parse(text) : null;
    if (!response.ok) {
      console.log("[API] Response text:", text.substring(0, 1000));
      const message =
        json?.error?.message || json?.message || `HTTP ${response.status}`;
      throw new Error(message);
    }
    return { response, json };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getConfig() {
  console.log("[CONFIG] Fetching /config");
  const { response, json } = await requestJson("/config", {
    method: "GET",
    headers: {
      "User-Agent": getUserAgent(),
    },
  });

  const cookies = updateCookies(inMemoryAuth?.cookies || "", response);
  inMemoryAuth = { cookies, userId: null };
  return json;
}

async function login({ username, password }) {
  try {
    await getConfig();
  } catch (error) {
    throw new Error("Failed to connect to VRChat API");
  }

  const authHeader = Buffer.from(`${username}:${password}`).toString("base64");

  let response;
  let json;
  try {
    const result = await requestJson("/auth/user", {
      method: "GET",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "User-Agent": getUserAgent(),
      },
    });
    response = result.response;
    json = result.json;
  } catch (error) {
    throw error;
  }

  const cookies = updateCookies(inMemoryAuth?.cookies, response);
  inMemoryAuth = { cookies, userId: json?.id || null };

  if (json?.requiresTwoFactorAuth) {
    return {
      status: "2fa",
      methods: json.requiresTwoFactorAuth,
    };
  }

  if (json?.id && cookies) {
    try {
      setStoredAuth({ cookies, userId: json.id, user: json });
    } catch (error) {
      throw new Error(`Secure storage error: ${error.message}`);
    }
  }

  return {
    status: "ok",
    user: json,
  };
}

async function verifyTwoFactor(type, code) {
  const auth = inMemoryAuth || getStoredAuth();
  if (!auth?.cookies) {
    throw new Error("No pending authentication cookies.");
  }

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

  const { json: user } = await requestJson("/auth/user", {
    method: "GET",
    headers: {
      "User-Agent": getUserAgent(),
      "Content-Type": "application/json",
      Cookie: cookies,
    },
  });

  if (user?.id) {
    try {
      setStoredAuth({ cookies, userId: user.id, user });
    } catch (error) {
      throw new Error(`Secure storage error: ${error.message}`);
    }
  }

  return user;
}

async function logout() {
  inMemoryAuth = null;
  clearAuth();
  return true;
}

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
