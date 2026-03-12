/**
 * Message slot customization logic.
 */

function updateApplyButtonState() {
  const type = "message";
  const slot = Number(inviteMessageSlot.value);

  if (isApplying) {
    return;
  }

  if (
    [
      getUiText("applyButtonApplying"),
      getUiText("applyButtonChecking"),
      getUiText("applyButtonLoading"),
    ].includes(applySlotButton.textContent)
  ) {
    applySlotButton.textContent = getUiText("applyButtonLabel");
  }

  const unlockTime = slotCooldowns[type]?.[slot] || 0;
  const now = Date.now();

  const currentSlotData = cachedSlotsData[type]?.[slot] || null;
  const currentVrcMessage = currentSlotData
    ? typeof currentSlotData.message === "string"
      ? currentSlotData.message
      : ""
    : null;

  const isDuplicate =
    currentVrcMessage === null || inviteSlotPreview.value === currentVrcMessage;

  if (unlockTime > now) {
    const remainingSeconds = Math.ceil((unlockTime - now) / 1000);
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;

    applySlotButton.disabled = true;
    applySlotButton.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
    applySlotButton.classList.add("countdown-mode");
    applySlotButton.classList.remove("primary");
  } else if (isDuplicate) {
    applySlotButton.disabled = true;
    applySlotButton.textContent = getUiText("applyButtonLabel");
    applySlotButton.classList.remove("countdown-mode", "primary");
    applySlotButton.classList.add("secondary");
  } else {
    applySlotButton.disabled = false;
    applySlotButton.textContent = getUiText("applyButtonLabel");
    applySlotButton.classList.remove("countdown-mode", "secondary");
    applySlotButton.classList.add("primary");
  }
}

function startCustomizationTimers() {
  setInterval(() => {
    updateApplyButtonState();
  }, 500);

  setInterval(async () => {
    if (currentUser && !isApplying) {
      const type = "message";
      try {
        const result = await window.sleepchat.getMessageSlot(
          type,
          Number(inviteMessageSlot.value),
        );
        if (result?.sessionExpired) {
          await handleSessionExpired(result.error);
          return;
        }
        if (result.ok) {
          const slot = Number(inviteMessageSlot.value);
          if (!cachedSlotsData[type]) {
            cachedSlotsData[type] = Array(12)
              .fill("")
              .map((_, i) => ({ slot: i, message: "" }));
          }
          const data = result.slotData;
          const message = typeof data === "string" ? data : data?.message || "";
          cachedSlotsData[type][slot] = { slot, message };

          const cooldowns = await window.sleepchat.getCooldowns();
          if (cooldowns) slotCooldowns = cooldowns;
          updateSlotPreviews();
        }
      } catch (e) {
        console.error("Background poll failed:", e);
      }
    }
  }, 60000);
}

async function fetchSlots() {
  const CACHE_TTL = 60000;
  const type = "message";
  const slot = Number(inviteMessageSlot.value);

  const cachedSlot = cachedSlotsData[type]?.[slot];
  if (cachedSlot && Date.now() - slotsCacheTime < CACHE_TTL) {
    updateSlotPreviews();
    updateApplyButtonState();
    return;
  }

  try {
    const result = await window.sleepchat.getMessageSlot(type, slot);
    if (result?.sessionExpired) {
      await handleSessionExpired(result.error);
      return;
    }
    if (result.ok) {
      const data = result.slotData;
      const message = typeof data === "string" ? data : data?.message || "";

      if (!cachedSlotsData[type]) {
        cachedSlotsData[type] = Array(12)
          .fill("")
          .map((_, i) => ({ slot: i, message: "" }));
      }
      cachedSlotsData[type][slot] = { slot, message };
      slotsCacheTime = Date.now();

      const cooldowns = await window.sleepchat.getCooldowns();
      if (cooldowns) slotCooldowns = cooldowns;

      updateSlotPreviews();
    }
  } catch (error) {
    console.error("Slot fetch failed:", error);
  } finally {
    updateApplyButtonState();
  }
}

async function fetchAllSlotsSequentially() {
  const types = ["message"];
  for (const type of types) {
    try {
      const result = await window.sleepchat.getMessageSlots(type);
      if (result?.sessionExpired) {
        await handleSessionExpired(result.error);
        return;
      }
      if (result.ok && Array.isArray(result.messages)) {
        cachedSlotsData[type] = result.messages;
      }
      await new Promise((r) => setTimeout(r, 300));
    } catch (e) {
      console.error(`Fetch failed for ${type}:`, e);
    }
  }
  slotsCacheTime = Date.now();
  updateSlotPreviews();
}

function updateSlotPreviews() {
  const type = "message";
  const slot = Number(inviteMessageSlot.value);
  const slotData = cachedSlotsData[type]?.[slot];

  inviteSlotPreview.value = slotData
    ? typeof slotData.message === "string"
      ? slotData.message
      : ""
    : "";

  const len = inviteSlotPreview.value.length;
  inviteCharCount.textContent = `${len}/64`;
  inviteCharCount.style.color = len >= 64 ? "#f87171" : "var(--color-muted)";

  updateApplyButtonState();
}
