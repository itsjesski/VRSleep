const { getAuthHeaders, requestJson } = require("./vrcauth");
const { buildUrl, isValidUserId, isValidNotificationId, sanitizeMessage, delay, retryWithBackoff } = require("./api-utils");
const config = require("../config");
const { logError } = require("../utils/logger");

/**
 * Retrieves authentication headers or throws if not logged in.
 */
function getHeaders() {
  const headers = getAuthHeaders();
  if (!headers) throw new Error("Not authenticated");
  return headers;
}

/**
 * Internal helper to parse VRChat's varied message slot responses.
 * The API sometimes returns a single object, a raw string, or an array of all slots.
 */
function parseSlotResponse(json, expectedSlot) {
  if (Array.isArray(json)) {
    return (
      json.find((s) => s.slot === Number(expectedSlot)) || {
        slot: Number(expectedSlot),
        message: "",
        remainingCooldownMinutes: 0,
      }
    );
  }
  return {
    slot: Number(expectedSlot),
    message: json?.message || (typeof json === "string" ? json : ""),
    remainingCooldownMinutes: json?.remainingCooldownMinutes || 0,
  };
}

/**
 * Fetches pending invite requests from other users.
 */
async function fetchInvites() {
  const { json: data } = await requestJson(
    "/auth/user/notifications?n=50&offset=0",
    {
      method: "GET",
      headers: getHeaders(),
    },
  );

  if (!Array.isArray(data)) return [];

  return data
    .filter((item) => item.type === "requestInvite" && item.senderUserId)
    .map((item) => ({
      id: item.id || item._id,
      senderId: item.senderUserId || item.senderId || item.userId,
      senderDisplayName:
        item.senderDisplayName || item.senderUsername || item.displayName,
    }));
}

/**
 * Sends an invite to a specific user.
 * Automatically resolves the current user's location to ensure the invite is valid.
 */
async function sendInvite(
  userId,
  message = "",
  messageSlot = null,
  messageType = "message",
) {
  // Security: Validate user ID
  if (!userId || !isValidUserId(userId)) {
    throw new Error("Invalid user ID");
  }

  const { json: userData } = await requestJson("/auth/user", {
    method: "GET",
    headers: getHeaders(),
  });

  const location = userData.location || "offline";
  const presenceInstance = userData.presence?.instance;
  const presenceWorld = userData.presence?.world;

  let inviteLocation;
  if (presenceWorld && presenceInstance) {
    inviteLocation = `${presenceWorld}:${presenceInstance}`;
  } else if (presenceInstance && presenceInstance.includes("~")) {
    inviteLocation = presenceInstance;
  } else if (location && location !== "offline") {
    inviteLocation = location;
  }

  if (!inviteLocation || inviteLocation === "offline") {
    throw new Error("Cannot send invite: No valid world location found.");
  }

  const body = { instanceId: inviteLocation };
  if (message && message.trim()) {
    // Security: Sanitize message content
    body.message = sanitizeMessage(message, 256);
  } else if (messageSlot !== null && messageSlot !== undefined) {
    const slotNum = Number(messageSlot);
    if (!Number.isInteger(slotNum) || slotNum < 0 || slotNum > 11) {
      throw new Error("Invalid message slot (must be 0-11)");
    }
    body.messageSlot = slotNum;
    body.messageType = messageType;
  }

  const { json } = await requestJson(`/invite/${encodeURIComponent(userId)}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  return json;
}

/**
 * Hides/deletes a notification from the user's feed.
 */
async function deleteNotification(notificationId) {
  // Security: Validate notification ID
  if (!notificationId || !isValidNotificationId(notificationId)) {
    throw new Error("Invalid notification ID");
  }
  const { json } = await requestJson(
    `/auth/user/notifications/${encodeURIComponent(notificationId)}/hide`,
    {
      method: "PUT",
      headers: getHeaders(),
    },
  );
  return json;
}

/**
 * Fetches the full list of friends for the current user.
 */
async function getFriends() {
  let allFriends = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const { json: friends } = await requestJson(
      `/auth/user/friends?n=${limit}&offset=${offset}`,
      {
        method: "GET",
        headers: getHeaders(),
      },
    );

    if (!Array.isArray(friends) || friends.length === 0) {
      hasMore = false;
      break;
    }

    allFriends.push(...friends);
    if (friends.length < limit) {
      hasMore = false;
    } else {
      offset += limit;
    }
  }

  return allFriends.map((friend) => ({
    id: friend.id,
    displayName: friend.displayName,
    username: friend.username,
    status: friend.status || "offline",
    statusDescription: friend.statusDescription || "",
    thumbnailUrl:
      friend.currentAvatarThumbnailImageUrl || friend.profilePicOverride || "",
  }));
}

/**
 * Retrieves the currently authenticated user's data.
 */
async function getCurrentUser() {
  const { json } = await requestJson("/auth/user", {
    method: "GET",
    headers: getHeaders(),
  });
  return json;
}

/**
 * Updates the user's status (Active, Join Me, etc.) and status description.
 */
async function updateStatus(userId, status, statusDescription) {
  // Security: Validate inputs
  if (!userId || !isValidUserId(userId)) {
    throw new Error("Invalid user ID");
  }
  
  const validStatuses = ["active", "join me", "ask me", "busy", "offline"];
  if (!validStatuses.includes(status)) {
    throw new Error("Invalid status value");
  }
  
  const sanitizedDescription = sanitizeMessage(statusDescription || "", 32);
  
  const { json } = await requestJson(`/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify({ status, statusDescription: sanitizedDescription }),
  });
  return json;
}

/**
 * Fetches a single message slot.
 */
async function getMessageSlot(userId, type, slot) {
  // Security: Validate inputs
  if (!userId || !isValidUserId(userId)) {
    throw new Error("Invalid user ID");
  }
  const slotNum = Number(slot);
  if (!Number.isInteger(slotNum) || slotNum < 0 || slotNum > 11) {
    throw new Error("Invalid slot number (must be 0-11)");
  }
  
  const path = `/message/${encodeURIComponent(userId)}/${type}/${slotNum}`;
  const { json } = await requestJson(path, {
    method: "GET",
    headers: getHeaders(),
  });
  return parseSlotResponse(json, slotNum);
}

/**
 * Fetches all 12 message slots for a given type in small batches.
 * Sequential batching is used to strictly avoid VRChat API rate limits (429).
 */
async function getMessageSlots(userId, type = "requestResponse") {
  // Security: Validate user ID
  if (!userId || !isValidUserId(userId)) {
    throw new Error("Invalid user ID");
  }

  const results = [];
  const batchSize = config.api.messageBatchSize;

  for (let i = 0; i < 12; i += batchSize) {
    const batchPromises = [];
    for (let j = i; j < i + batchSize && j < 12; j++) {
      const path = `/message/${encodeURIComponent(userId)}/${type}/${j}`;
      batchPromises.push(
        requestJson(path, {
          method: "GET",
          headers: getHeaders(),
        })
          .then(({ json }) => parseSlotResponse(json, j))
          .catch((err) => {
            logError("VRChatAPI", `Error fetching slot ${j} for ${type}`, err);
            return { slot: j, message: "", remainingCooldownMinutes: 0 };
          }),
      );
    }
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    if (i + batchSize < 12) {
      await delay(config.api.batchDelay);
    }
  }

  return results.sort((a, b) => a.slot - b.slot);
}

/**
 * Updates a message slot. VRChat's response includes the state of all 12 slots,
 * which the application uses to synchronize the entire local cache.
 */
async function updateMessageSlot(userId, type, slot, message) {
  // Security: Validate inputs
  if (!userId || !isValidUserId(userId)) {
    throw new Error("Invalid user ID");
  }
  const slotNum = Number(slot);
  if (!Number.isInteger(slotNum) || slotNum < 0 || slotNum > 11) {
    throw new Error("Invalid slot number (must be 0-11)");
  }
  
  console.log(`[API] updateMessageSlot: type=${type}, slot=${slotNum}`);
  
  // Security: Sanitize message content
  const sanitized = sanitizeMessage(message, 256);

  const { json } = await requestJson(
    `/message/${encodeURIComponent(userId)}/${type}/${slotNum}`,
    {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify({ message: sanitized }),
    },
  );

  // Normalize response: VRChat may return an array of all 12 slots or a single slot object
  if (Array.isArray(json)) {
    return json;
  }
  // If single object, wrap in array for consistent handling
  return [parseSlotResponse(json, slot)];
}

/**
 * VRChat API interaction module.
 */
module.exports = {
  fetchInvites,
  sendInvite,
  deleteNotification,
  getFriends,
  getCurrentUser,
  updateStatus,
  getMessageSlot,
  getMessageSlots,
  updateMessageSlot,
};
