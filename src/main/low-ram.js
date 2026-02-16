const { app } = require("electron");
const config = require("../config");

/**
 * Applies performance and resource-usage optimizations to the Electron process.
 * These settings are designed to keep the background footprint of VRSleep minimal.
 */
function applyLowRamSettings() {
  // Limit the V8 heap size to prevent the app from consuming excessive memory over time.
  const maxOldSpace = config.resources.maxOldSpaceMb;
  if (Number.isFinite(maxOldSpace) && maxOldSpace > 0) {
    app.commandLine.appendSwitch(
      "js-flags",
      `--max-old-space-size=${maxOldSpace}`,
    );
  }

  // Disable Hardware Acceleration to free up GPU resources for VR/Games.
  app.disableHardwareAcceleration();

  // Additional Chromium flags to further reduce background resource usage.
  app.commandLine.appendSwitch("disable-gpu-compositing");

  // Fixes an issue where Electron apps might consume more CPU when the window is hidden/occluded.
  app.commandLine.appendSwitch(
    "disable-features",
    "CalculateNativeWinOcclusion",
  );
}

module.exports = {
  applyLowRamSettings,
};
