const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const FILE_NAME = 'settings.json';

const DEFAULT_SETTINGS = {
  sleepStatus: 'none',
  sleepStatusDescription: ''
};

function getFilePath() {
  const folder = app.getPath('userData');
  return path.join(folder, FILE_NAME);
}

function getSettings() {
  const filePath = getFilePath();
  if (!fs.existsSync(filePath)) return { ...DEFAULT_SETTINGS };
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...data };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function setSettings(settings) {
  const filePath = getFilePath();
  const current = getSettings();
  const next = { ...current, ...settings };
  fs.writeFileSync(filePath, JSON.stringify(next, null, 2));
  return next;
}

module.exports = {
  getSettings,
  setSettings
};
