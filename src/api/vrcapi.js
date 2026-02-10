const API_BASE = "https://api.vrchat.cloud/api/1";
const { getAuthHeaders, requestJson } = require("./vrcauth");

function buildUrl(path) {
  const apiKey = process.env.VRC_API_KEY;
  if (!apiKey) return `${API_BASE}${path}`;
  const joiner = path.includes("?") ? "&" : "?";
  return `${API_BASE}${path}${joiner}apiKey=${encodeURIComponent(apiKey)}`;
}

function getHeaders() {
  const headers = getAuthHeaders();
  if (!headers) throw new Error("Not authenticated");
  return headers;
}

async function fetchInvites() {
  const { json: data } = await requestJson(
    "/auth/user/notifications?n=50&offset=0",
    {
      method: "GET",
      headers: getHeaders(),
    },
  );

  if (!Array.isArray(data)) return [];

  // Filter for requestInvite notifications (when someone asks you to invite them)
  const inviteNotifications = data.filter((item) => {
    return item.type === "requestInvite" && item.senderUserId;
  });

  const invites = inviteNotifications.map((item) => ({
    id: item.id || item._id,
    senderId: item.senderUserId || item.senderId || item.userId,
    senderDisplayName:
      item.senderDisplayName || item.senderUsername || item.displayName,
  }));
  return invites;
}

async function sendInvite(
  userId,
  message = "",
  messageSlot = null,
  messageType = "message",
) {
  if (!userId) throw new Error("Missing user id");

  // Get current user location
  const { json: userData } = await requestJson("/auth/user", {
    method: "GET",
    headers: getHeaders(),
  });

  const location = userData.location || "offline";
  const presenceInstance = userData.presence?.instance;
  const presenceWorld = userData.presence?.world;

  // Construct proper location format: worldId:instanceId
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

  const body = {
    instanceId: inviteLocation,
  };

  if (message && message.trim()) {
    body.message = message.trim();
  } else if (messageSlot !== null && messageSlot !== undefined) {
    body.messageSlot = Number(messageSlot);
    body.messageType = messageType;
  }

  const { json } = await requestJson(`/invite/${encodeURIComponent(userId)}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  return json;
}

async function deleteNotification(notificationId) {
  if (!notificationId) throw new Error("Missing notification id");

  const { json } = await requestJson(
    `/auth/user/notifications/${encodeURIComponent(notificationId)}/hide`,
    {
      method: "PUT",
      headers: getHeaders(),
    },
  );

  return json;
}

async function getFriends() {
  let allFriends = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  // Fetch all friends with pagination (don't include offline param to get ALL friends)
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

    // If we got fewer results than the limit, we've reached the end
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

async function getCurrentUser() {
  const { json } = await requestJson("/auth/user", {
    method: "GET",
    headers: getHeaders(),
  });
  return json;
}

async function updateStatus(userId, status, statusDescription) {
  if (!userId) throw new Error("Missing user id");
  const { json } = await requestJson(`/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify({
      status,
      statusDescription,
    }),
  });

  return json;
}

async function getMessageSlot(userId, type, slot) {
  if (!userId) throw new Error("Missing user id");
  const path = `/message/${encodeURIComponent(userId)}/${encodeURIComponent(type)}/${encodeURIComponent(slot)}`;
  const { json } = await requestJson(path, {
    method: "GET",
    headers: getHeaders(),
  });

  // If the API returns an array, find the specific slot object
  if (Array.isArray(json)) {
    return (
      json.find((s) => s.slot === Number(slot)) || {
        slot,
        message: "",
        remainingCooldownMinutes: 0,
      }
    );
  }

  return json;
}

async function getMessageSlots(userId, type = "requestResponse") {
  if (!userId) throw new Error("Missing user id");

  const results = [];
  const batchSize = 3;

  for (let i = 0; i < 12; i += batchSize) {
    const batchPromises = [];
    for (let j = i; j < i + batchSize && j < 12; j++) {
      const path = `/message/${encodeURIComponent(userId)}/${encodeURIComponent(type)}/${j}`;
      batchPromises.push(
        requestJson(path, {
          method: "GET",
          headers: getHeaders(),
        })
          .then(({ json }) => {
            // json could be an object {message, slot, remainingCooldownMinutes, ...}
            // or an array of slot objects if we hit the base endpoint
            if (Array.isArray(json)) {
              return (
                json.find((s) => s.slot === j) || {
                  slot: j,
                  message: "",
                  remainingCooldownMinutes: 0,
                }
              );
            }
            return {
              slot: j,
              message: json?.message || (typeof json === "string" ? json : ""),
              remainingCooldownMinutes: json?.remainingCooldownMinutes || 0,
            };
          })
          .catch((err) => {
            console.error(`Error fetching slot ${j} for ${type}:`, err.message);
            return { slot: j, message: "", remainingCooldownMinutes: 0 };
          }),
      );
    }
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Small delay between batches
    if (i + batchSize < 12) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  // Ensure we return a consistent format: [{ slot: 0, message: "..." }, ...]
  return results
    .sort((a, b) => a.slot - b.slot)
    .map((r) => ({
      slot: r.slot,
      message: typeof r.message === "string" ? r.message : "",
    }));
}

async function updateMessageSlot(userId, type, slot, message) {
  if (!userId) throw new Error("Missing user id");
  console.log(
    `[API] updateMessageSlot: userId=${userId}, type=${type}, slot=${slot}, message="${message}"`,
  );

  const { json } = await requestJson(
    `/message/${encodeURIComponent(userId)}/${encodeURIComponent(type)}/${encodeURIComponent(slot)}`,
    {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify({
        message,
      }),
    },
  );
  console.log(`[API] updateMessageSlot result:`, json);

  return json;
}

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
