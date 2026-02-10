const { app } = require("electron");
const fs = require("fs");
const path = require("path");

const FILE_NAME = "message-slots.json";

// Types: message (Invite), response, request, requestResponse
const DEFAULT_SLOTS = {
  message: Array(12).fill(""),
  response: Array(12).fill(""),
  request: Array(12).fill(""),
  requestResponse: Array(12).fill(""),
};

function getFilePath() {
  const folder = app.getPath("userData");
  return path.join(folder, FILE_NAME);
}

function getCachedSlots() {
  const filePath = getFilePath();
  if (!fs.existsSync(filePath)) return { ...DEFAULT_SLOTS };
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    return { ...DEFAULT_SLOTS, ...data };
  } catch {
    return { ...DEFAULT_SLOTS };
  }
}

function saveCachedSlots(slots) {
  const filePath = getFilePath();
  fs.writeFileSync(filePath, JSON.stringify(slots, null, 2));
}

function updateCachedSlot(type, slotIndex, message) {
  const slots = getCachedSlots();
  if (slots[type]) {
    slots[type][slotIndex] = message;
    saveCachedSlots(slots);
  }
  return slots;
}

module.exports = {
  getCachedSlots,
  saveCachedSlots,
  updateCachedSlot,
};
