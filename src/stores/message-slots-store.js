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

const DEFAULT_COOLDOWNS = {
  message: {},
  response: {},
  request: {},
  requestResponse: {},
};

function getFilePath() {
  const folder = app.getPath("userData");
  return path.join(folder, FILE_NAME);
}

function getData() {
  const filePath = getFilePath();
  if (!fs.existsSync(filePath))
    return { slots: DEFAULT_SLOTS, cooldowns: DEFAULT_COOLDOWNS };
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    return {
      slots: data.slots || DEFAULT_SLOTS,
      cooldowns: data.cooldowns || DEFAULT_COOLDOWNS,
    };
  } catch {
    return { slots: DEFAULT_SLOTS, cooldowns: DEFAULT_COOLDOWNS };
  }
}

function saveData(data) {
  const filePath = getFilePath();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function getCachedSlots() {
  return getData().slots;
}

function saveCachedSlots(slots) {
  const data = getData();
  data.slots = slots;
  saveData(data);
}

function updateCachedSlot(type, slotIndex, message) {
  const data = getData();
  if (!data.slots[type]) data.slots[type] = Array(12).fill("");
  data.slots[type][slotIndex] = message;
  saveData(data);
  return data.slots;
}

function getSlotCooldowns() {
  return getData().cooldowns;
}

function updateSlotCooldown(type, slotIndex, unlockTime) {
  const data = getData();
  if (!data.cooldowns[type]) data.cooldowns[type] = {};
  data.cooldowns[type][slotIndex] = unlockTime;
  saveData(data);
}

module.exports = {
  getCachedSlots,
  saveCachedSlots,
  updateCachedSlot,
  getSlotCooldowns,
  updateSlotCooldown,
};
