/**
 * Milk Tracker - Frontend Logic & Settlement Engine
 */
const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbxZvaRTLVbbhfRqFUPnOhMncc_y4WKPhbdrRu84pV6XTfs-5k_NKXWqQ4BerclonMHoxQ/exec"
let selectedPresetQty = 1.0;
let appState = {
  settings: {
    apiUrl: "",
    rate: 65,
    cycleDay: 15
  },
  deliveries: [],
  settlements: []
};

// Elements
const logDateInput = document.getElementById("logDate");
const customQtyInput = document.getElementById("customQty");
const logNotesInput = document.getElementById("logNotes");
const cutoffDateInput = document.getElementById("cutoffDate");
const syncStatus = document.getElementById("syncStatus");

const billRunningAmount = document.getElementById("billRunningAmount");
const billRunningLiters = document.getElementById("billRunningLiters");
const billRunningRate = document.getElementById("billRunningRate");
const billRunningDays = document.getElementById("billRunningDays");
const billPeriodLabel = document.getElementById("billPeriodLabel");

const recentLogsList = document.getElementById("recentLogsList");
const logsCount = document.getElementById("logsCount");

const billModal = document.getElementById("billModal");
const settingsModal = document.getElementById("settingsModal");

// Preset buttons
const presetBtns = document.querySelectorAll(".preset-btn");

window.addEventListener("DOMContentLoaded", () => {
  const todayStr = getTodayISO();
  logDateInput.value = todayStr;
  cutoffDateInput.value = todayStr;

  loadLocalState();
  setupEventListeners();

  if (appState.settings.apiUrl) {
    fetchFromSheet();
  } else {
    updateUI();
  }
});

function getTodayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadLocalState() {
  const cached = localStorage.getItem("milk_tracker_app_data");
  if (cached) {
    try {
      appState = JSON.parse(cached);
    } catch (e) {
      console.error("Error reading localStorage:", e);
    }
  }

  // Ensure default URL is used if empty or missing
  if (!appState.settings.apiUrl || appState.settings.apiUrl.trim() === "") {
    appState.settings.apiUrl = DEFAULT_API_URL;
  }

  document.getElementById("cfgApiUrl").value = appState.settings.apiUrl;
  document.getElementById("cfgRate").value = appState.settings.rate || 65;
  document.getElementById("cfgCycleDay").value = appState.settings.cycleDay || 15;
}

function saveLocalState() {
  localStorage.setItem("milk_tracker_app_data", JSON.stringify(appState));
}

function setupEventListeners() {
  // Preset buttons handling
  presetBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      presetBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedPresetQty = Number(btn.getAttribute("data-qty"));
      customQtyInput.value = "";
    });
  });

  customQtyInput.addEventListener("input", () => {
    presetBtns.forEach(b => b.classList.remove("active"));
    selectedPresetQty = null;
  });

  // Action buttons
  document.getElementById("saveEntryBtn").addEventListener("click", handleSaveEntry);
  document.getElementById("calcBillBtn").addEventListener("click", handleCalculatePreview);
  document.getElementById("confirmSettleBtn").addEventListener("click", handleConfirmSettlement);

  // Modals
  document.getElementById("openSettingsBtn").addEventListener("click", () => openModal(settingsModal));
  document.getElementById("closeSettingsModalBtn").addEventListener("click", () => closeModal(settingsModal));
  document.getElementById("closeBillModalBtn").addEventListener("click", () => closeModal(billModal));
  document.getElementById("saveSettingsBtn").addEventListener("click", handleSaveSettings);
}

function openModal(modal) {
  modal.classList.add("open");
}

function closeModal(modal) {
  modal.classList.remove("open");
}

async function handleSaveSettings() {
  const rateVal = Number(document.getElementById("cfgRate").value) || 65;
  const cycleVal = Number(document.getElementById("cfgCycleDay").value) || 15;
  const apiUrlVal = document.getElementById("cfgApiUrl").value.trim();

  appState.settings.apiUrl = apiUrlVal;
  appState.settings.rate = rateVal;
  appState.settings.cycleDay = cycleVal;

  saveLocalState();
  closeModal(settingsModal);
  updateUI();

  if (appState.settings.apiUrl) {
    syncStatus.innerText = "Saving settings to Google Sheet...";
    try {
      await fetch(appState.settings.apiUrl, {
        method: "POST",
        body: JSON.stringify({
          action: "updateSettings",
          rate: rateVal,
          cycleDay: cycleVal
        }),
        headers: { "Content-Type": "text/plain;charset=utf-8" }
      });
      syncStatus.innerText = "Settings synced with Google Sheet ✓";
    } catch (err) {
      console.error(err);
      syncStatus.innerText = "Saved locally (Sheet sync failed)";
    }
  }
}

// Read from Google Sheets
async function fetchFromSheet() {
  if (!appState.settings.apiUrl) return;

  syncStatus.innerText = "Syncing with Google Sheet...";
  try {
    const res = await fetch(`${appState.settings.apiUrl}?action=getData`);
    const data = await res.json();

    if (data.success) {
      appState.deliveries = data.deliveries || [];
      appState.settlements = data.settlements || [];
      
      // Sync settings from sheet
      if (data.settings) {
        if (data.settings.rate) {
          appState.settings.rate = Number(data.settings.rate);
          document.getElementById("cfgRate").value = appState.settings.rate;
        }
        if (data.settings.cycleDay) {
          appState.settings.cycleDay = Number(data.settings.cycleDay);
          document.getElementById("cfgCycleDay").value = appState.settings.cycleDay;
        }
      }
      saveLocalState();
      syncStatus.innerText = "Synced with Google Sheet ✓";
    } else {
      syncStatus.innerText = "Google Sheet error: " + (data.error || "Unknown");
    }
  } catch (err) {
    console.error(err);
    syncStatus.innerText = "Offline (Using locally cached data)";
  }
  updateUI();
}

// Log delivery
async function handleSaveEntry() {
  const date = logDateInput.value;
  if (!date) {
    alert("Please select a date.");
    return;
  }

  let qty = selectedPresetQty;
  if (customQtyInput.value !== "") {
    qty = parseFloat(customQtyInput.value);
  }

  if (isNaN(qty) || qty < 0) {
    alert("Please provide a valid milk quantity.");
    return;
  }

  const notes = logNotesInput.value.trim();

  // Optimistic update locally
  const existingIdx = appState.deliveries.findIndex(d => d.date === date);
  if (existingIdx >= 0) {
    appState.deliveries[existingIdx].liters = qty;
    appState.deliveries[existingIdx].notes = notes;
  } else {
    appState.deliveries.push({
      date: date,
      liters: qty,
      status: "unbilled",
      billId: "",
      notes: notes,
      loggedAt: new Date().toISOString()
    });
  }

  saveLocalState();
  updateUI();

  // Push to Google Sheets if connected
  if (appState.settings.apiUrl) {
    syncStatus.innerText = "Saving to Google Sheet...";
    try {
      await fetch(appState.settings.apiUrl, {
        method: "POST",
        body: JSON.stringify({
          action: "logDelivery",
          date: date,
          liters: qty,
          notes: notes
        }),
        headers: { "Content-Type": "text/plain;charset=utf-8" }
      });
      syncStatus.innerText = "Saved to Google Sheet ✓";
    } catch (e) {
      console.error(e);
      syncStatus.innerText = "Saved locally (Sheet sync failed)";
    }
  }

  alert(`Logged ${qty} L for ${date}`);
  logNotesInput.value = "";
}

// Calculate Bill Preview
function handleCalculatePreview() {
  const cutoff = cutoffDateInput.value;
  if (!cutoff) {
    alert("Please choose a cutoff date.");
    return;
  }

  // Filter unbilled days up to cutoff
  const unbilled = appState.deliveries.filter(d => d.status === "unbilled" && d.date <= cutoff);

  if (unbilled.length === 0) {
    alert("No unbilled entries found on or before " + cutoff);
    return;
  }

  let totalLiters = 0;
  let milkDays = 0;
  let skipDays = 0;
  let earliestDate = cutoff;

  unbilled.forEach(d => {
    totalLiters += Number(d.liters);
    if (Number(d.liters) > 0) {
      milkDays++;
    } else {
      skipDays++;
    }
    if (d.date < earliestDate) earliestDate = d.date;
  });

  const rate = appState.settings.rate || 65;
  const grandTotal = totalLiters * rate;

  document.getElementById("modalPeriod").innerText = `${earliestDate} → ${cutoff}`;
  document.getElementById("modalMilkDays").innerText = `${milkDays} days`;
  document.getElementById("modalSkipDays").innerText = `${skipDays} days`;
  document.getElementById("modalTotalLiters").innerText = `${totalLiters.toFixed(1)} L`;
  document.getElementById("modalRate").innerText = `₹${rate} / L`;
  document.getElementById("modalGrandTotal").innerText = `₹${grandTotal.toFixed(2)}`;

  openModal(billModal);
}

// Mark Paid and Settle
async function handleConfirmSettlement() {
  const cutoff = cutoffDateInput.value;
  closeModal(billModal);

  // Locally mark as billed
  appState.deliveries.forEach(d => {
    if (d.status === "unbilled" && d.date <= cutoff) {
      d.status = "billed";
    }
  });

  saveLocalState();
  updateUI();

  if (appState.settings.apiUrl) {
    syncStatus.innerText = "Settling bill in Google Sheet...";
    try {
      await fetch(appState.settings.apiUrl, {
        method: "POST",
        body: JSON.stringify({
          action: "settleBill",
          cutoffDate: cutoff,
          rate: appState.settings.rate
        }),
        headers: { "Content-Type": "text/plain;charset=utf-8" }
      });
      fetchFromSheet();
    } catch (e) {
      console.error(e);
      syncStatus.innerText = "Settled locally (Sheet update failed)";
    }
  }

  alert("Cycle successfully settled and marked as paid!");
}

// Render dynamic UI
function updateUI() {
  const rate = appState.settings.rate || 65;
  const unbilled = appState.deliveries.filter(d => d.status === "unbilled");

  let totalLiters = 0;
  let earliestDate = null;

  unbilled.forEach(d => {
    totalLiters += Number(d.liters);
    if (!earliestDate || d.date < earliestDate) earliestDate = d.date;
  });

  const totalCost = totalLiters * rate;

  billRunningAmount.innerText = `₹${totalCost.toFixed(2)}`;
  billRunningLiters.innerText = `${totalLiters.toFixed(1)} L`;
  billRunningRate.innerText = `₹${rate} / L`;
  billRunningDays.innerText = `${unbilled.length} Days`;

  if (earliestDate) {
    billPeriodLabel.innerText = `Unbilled deliveries since ${earliestDate}`;
  } else {
    billPeriodLabel.innerText = `All prior days settled (₹0 due)`;
  }

  // Render recent 8 logs
  const sorted = [...appState.deliveries].sort((a, b) => b.date.localeCompare(a.date));
  logsCount.innerText = `${sorted.length} total`;

  if (sorted.length === 0) {
    recentLogsList.innerHTML = `<li class="empty-state">No deliveries recorded yet.</li>`;
  } else {
    recentLogsList.innerHTML = sorted.slice(0, 8).map(d => `
      <li class="log-item">
        <div class="log-info">
          <div class="log-date">${d.date}</div>
          <div class="log-tag-group">
            <span class="badge badge-${d.status}">${d.status}</span>
            ${d.notes ? `<span class="log-notes">• ${d.notes}</span>` : ""}
          </div>
        </div>
        <div class="log-liters">${Number(d.liters).toFixed(1)} L</div>
      </li>
    `).join("");
  }
}