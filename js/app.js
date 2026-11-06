/**
 * Milk Tracker - Frontend Logic & Settlement Engine
 */

// 1. Hardcode your Google Apps Script Web App URL here:
const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbxZvaRTLVbbhfRqFUPnOhMncc_y4WKPhbdrRu84pV6XTfs-5k_NKXWqQ4BerclonMHoxQ/exec";

// Translations Dictionary
const translations = {
  en: {
    appTitle: "Milk Tracker",
    langButtonText: "मराठी",
    totalVolume: "Total Volume",
    currentRate: "Current Rate",
    unbilledDays: "Unbilled Days",
    unbilledSince: "Unbilled deliveries since",
    allSettled: "All prior days settled (₹0 due)",
    logDailyMilk: "Log Daily Milk",
    deliveryDate: "Delivery Date",
    quantityPreset: "Quantity",
    skipMilk: "0 L (Skipped)",
    customLiters: "Custom Liters",
    customPlaceholder: "e.g. 2.0",
    noteLabel: "Note (optional)",
    notePlaceholder: "e.g. Guests",
    saveEntry: "Save Entry",
    billingTitle: "Settlement & Billing",
    billingDesc: "Calculate all unbilled deliveries up to your chosen cutoff date.",
    cutoffDate: "Cutoff Date",
    calcBillBtn: "⚡ Calculate Bill to Date",
    recentEntries: "Recent Entries",
    noEntries: "No deliveries recorded yet.",
    billSummaryTitle: "Bill Calculation Preview",
    modalPeriod: "Billing Window",
    modalMilkDays: "Milk Received Days",
    modalSkipDays: "Skipped Days (0 L)",
    modalTotalLiters: "Total Volume",
    modalRate: "Applied Rate",
    modalGrandTotal: "Total Payable",
    cancelBtn: "Cancel",
    settleBtn: "Mark as Paid & Clear",
    settingsTitle: "Configuration",
    cfgApiUrl: "Google Apps Script Web App URL",
    cfgRate: "Milk Rate (₹ / Liter)",
    cfgCycleDay: "Billing Cycle Anchor Day",
    closeBtn: "Close",
    saveBtn: "Save & Sync",
    badgeUnbilled: "UNBILLED",
    badgeBilled: "PAID",
    alertSaved: "Logged successfully for ",
    alertSettled: "Bill successfully cleared and marked as paid!"
  },
  mr: {
    appTitle: "दूध हिशोब",
    langButtonText: "English",
    totalVolume: "एकूण दूध",
    currentRate: "दूध दर",
    unbilledDays: "बाकी दिवस",
    unbilledSince: "पासून बाकी असलेले दूध:",
    allSettled: "मागील सर्व हिशोब पूर्ण आहे (₹0 बाकी)",
    logDailyMilk: "रोजचे दूध नोंदवा",
    deliveryDate: "तारीख",
    quantityPreset: "प्रमाण (लिटर)",
    skipMilk: "0 L (नाही घेतले)",
    customLiters: "इतर लिटर",
    customPlaceholder: "उदा. 2.0",
    noteLabel: "टीप (पर्यायी)",
    notePlaceholder: "उदा. पाहुणे आले",
    saveEntry: "नोंद जतन करा",
    billingTitle: "हिशोब आणि बिल",
    billingDesc: "निवडलेल्या तारखेपर्यंतचा एकूण बाकी हिशोब आणि रक्कम काढा.",
    cutoffDate: "हिशोबाची शेवटची तारीख",
    calcBillBtn: "⚡ बिलाचा हिशोब करा",
    recentEntries: "मागील नोंदी",
    noEntries: "अद्याप कोणतीही नोंद नाही.",
    billSummaryTitle: "बिलाचा तपशील",
    modalPeriod: "हिशोबाचा कालावधी",
    modalMilkDays: "दूध घेतलेले दिवस",
    modalSkipDays: "दूध न घेतलेले दिवस (0 L)",
    modalTotalLiters: "एकूण लिटर",
    modalRate: "दर (प्रति लिटर)",
    modalGrandTotal: "एकूण देय रक्कम",
    cancelBtn: "रद्द करा",
    settleBtn: "पैसे दिले (हिशोब पूर्ण करा)",
    settingsTitle: "सेटिंग्ज",
    cfgApiUrl: "गूगल शीट वेब ॲप लिंक",
    cfgRate: "दूध दर (₹ / लिटर)",
    cfgCycleDay: "हिशोब चक्र तारीख (उदा. 15)",
    closeBtn: "बंद करा",
    saveBtn: "जतन करा",
    badgeUnbilled: "बाकी",
    badgeBilled: "दिले",
    alertSaved: "नोंद यशस्वीरित्या जतन झाली: ",
    alertSettled: "बिल पूर्ण झाले आणि नोंदवले गेले!"
  }
};

// Check saved preference; defaults strictly to 'mr' on any new device
function getInitialLanguage() {
  const saved = localStorage.getItem("milk_tracker_lang");
  if (saved && (saved === "en" || saved === "mr")) {
    return saved;
  }
  localStorage.setItem("milk_tracker_lang", "mr");
  return "mr";
}

let currentLang = getInitialLanguage();
let selectedPresetQty = 1.0;

let appState = {
  settings: {
    apiUrl: DEFAULT_API_URL,
    rate: 65,
    cycleDay: 15
  },
  deliveries: [],
  settlements: []
};

// DOM references
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
const langToggleBtn = document.getElementById("langToggleBtn");
const presetBtns = document.querySelectorAll(".preset-btn");

window.addEventListener("DOMContentLoaded", () => {
  const todayStr = getTodayISO();
  logDateInput.value = todayStr;
  cutoffDateInput.value = todayStr;

  loadLocalState();
  applyLanguage(currentLang);
  setupEventListeners();

  if (appState.settings.apiUrl && !appState.settings.apiUrl.includes("YOUR_DEPLOYMENT_ID")) {
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

// Language toggle and DOM replacement
function applyLanguage(lang) {
  currentLang = lang;
  localStorage.setItem("milk_tracker_lang", lang);

  const t = translations[lang];
  if (!t) return;

  if (langToggleBtn) {
    langToggleBtn.innerText = t.langButtonText;
  }

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (t[key]) {
      el.innerText = t[key];
    }
  });

  if (customQtyInput) customQtyInput.placeholder = t.customPlaceholder;
  if (logNotesInput) logNotesInput.placeholder = t.notePlaceholder;

  updateUI();
}

function toggleLanguage() {
  const nextLang = currentLang === "mr" ? "en" : "mr";
  applyLanguage(nextLang);
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

  if (!appState.settings) {
    appState.settings = { apiUrl: DEFAULT_API_URL, rate: 65, cycleDay: 15 };
  }

  if (!appState.settings.apiUrl || appState.settings.apiUrl.includes("YOUR_DEPLOYMENT_ID")) {
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
  if (langToggleBtn) {
    langToggleBtn.addEventListener("click", toggleLanguage);
  }

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

  document.getElementById("saveEntryBtn").addEventListener("click", handleSaveEntry);
  document.getElementById("calcBillBtn").addEventListener("click", handleCalculatePreview);
  document.getElementById("confirmSettleBtn").addEventListener("click", handleConfirmSettlement);

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

function handleSaveSettings() {
  const rateVal = Number(document.getElementById("cfgRate").value) || 65;
  const cycleVal = Number(document.getElementById("cfgCycleDay").value) || 15;
  const apiUrlVal = document.getElementById("cfgApiUrl").value.trim() || DEFAULT_API_URL;

  appState.settings.apiUrl = apiUrlVal;
  appState.settings.rate = rateVal;
  appState.settings.cycleDay = cycleVal;

  saveLocalState();
  closeModal(settingsModal);
  updateUI();

  if (appState.settings.apiUrl && !appState.settings.apiUrl.includes("YOUR_DEPLOYMENT_ID")) {
    syncStatus.innerText = currentLang === "mr" ? "सेटिंग्ज जतन होत आहेत..." : "Syncing settings...";
    fetch(appState.settings.apiUrl, {
      method: "POST",
      body: JSON.stringify({
        action: "updateSettings",
        rate: rateVal,
        cycleDay: cycleVal
      }),
      headers: { "Content-Type": "text/plain;charset=utf-8" }
    })
    .then(() => {
      syncStatus.innerText = currentLang === "mr" ? "सेटिंग्ज जतन झाल्या ✓" : "Settings synced ✓";
    })
    .catch(() => {
      syncStatus.innerText = currentLang === "mr" ? "स्थानिक जतन केले" : "Saved locally";
    });
  }
}

async function fetchFromSheet() {
  if (!appState.settings.apiUrl || appState.settings.apiUrl.includes("YOUR_DEPLOYMENT_ID")) return;

  syncStatus.innerText = currentLang === "mr" ? "माहिती लोड होत आहे..." : "Syncing...";
  try {
    const res = await fetch(`${appState.settings.apiUrl}?action=getData`);
    const data = await res.json();

    if (data.success) {
      appState.deliveries = data.deliveries || [];
      appState.settlements = data.settlements || [];
      if (data.settings) {
        if (data.settings.rate) appState.settings.rate = Number(data.settings.rate);
        if (data.settings.cycleDay) appState.settings.cycleDay = Number(data.settings.cycleDay);
        document.getElementById("cfgRate").value = appState.settings.rate;
        document.getElementById("cfgCycleDay").value = appState.settings.cycleDay;
      }
      saveLocalState();
      syncStatus.innerText = currentLang === "mr" ? "गूगल शीट कनेक्ट झाले ✓" : "Synced with Google Sheet ✓";
    }
  } catch (err) {
    console.error(err);
    syncStatus.innerText = currentLang === "mr" ? "ऑफलाईन मोड" : "Offline Mode";
  }
  updateUI();
}

async function handleSaveEntry() {
  const date = logDateInput.value;
  if (!date) return;

  let qty = selectedPresetQty;
  if (customQtyInput.value !== "") {
    qty = parseFloat(customQtyInput.value);
  }

  if (isNaN(qty) || qty < 0) return;

  const notes = logNotesInput.value.trim();
  const t = translations[currentLang];

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

  if (appState.settings.apiUrl && !appState.settings.apiUrl.includes("YOUR_DEPLOYMENT_ID")) {
    fetch(appState.settings.apiUrl, {
      method: "POST",
      body: JSON.stringify({ action: "logDelivery", date, liters: qty, notes }),
      headers: { "Content-Type": "text/plain;charset=utf-8" }
    });
  }

  alert(`${t.alertSaved}${qty} L (${date})`);
  logNotesInput.value = "";
}

function handleCalculatePreview() {
  const cutoff = cutoffDateInput.value;
  if (!cutoff) return;

  const unbilled = appState.deliveries.filter(d => d.status === "unbilled" && d.date <= cutoff);
  if (unbilled.length === 0) {
    alert(currentLang === "mr" ? "या तारखेपर्यंत कोणतीही बाकी नोंद नाही." : "No unbilled entries found up to this date.");
    return;
  }

  let totalLiters = 0;
  let milkDays = 0;
  let skipDays = 0;
  let earliestDate = cutoff;

  unbilled.forEach(d => {
    totalLiters += Number(d.liters);
    if (Number(d.liters) > 0) milkDays++; else skipDays++;
    if (d.date < earliestDate) earliestDate = d.date;
  });

  const rate = appState.settings.rate || 65;
  const grandTotal = totalLiters * rate;

  document.getElementById("modalPeriod").innerText = `${earliestDate} → ${cutoff}`;
  document.getElementById("modalMilkDays").innerText = `${milkDays} ${currentLang === 'mr' ? 'दिवस' : 'days'}`;
  document.getElementById("modalSkipDays").innerText = `${skipDays} ${currentLang === 'mr' ? 'दिवस' : 'days'}`;
  document.getElementById("modalTotalLiters").innerText = `${totalLiters.toFixed(1)} L`;
  document.getElementById("modalRate").innerText = `₹${rate} / L`;
  document.getElementById("modalGrandTotal").innerText = `₹${grandTotal.toFixed(2)}`;

  openModal(billModal);
}

async function handleConfirmSettlement() {
  const cutoff = cutoffDateInput.value;
  const t = translations[currentLang];
  closeModal(billModal);

  appState.deliveries.forEach(d => {
    if (d.status === "unbilled" && d.date <= cutoff) {
      d.status = "billed";
    }
  });

  saveLocalState();
  updateUI();

  if (appState.settings.apiUrl && !appState.settings.apiUrl.includes("YOUR_DEPLOYMENT_ID")) {
    fetch(appState.settings.apiUrl, {
      method: "POST",
      body: JSON.stringify({ action: "settleBill", cutoffDate: cutoff, rate: appState.settings.rate }),
      headers: { "Content-Type": "text/plain;charset=utf-8" }
    }).then(() => fetchFromSheet());
  }

  alert(t.alertSettled);
}

function updateUI() {
  const t = translations[currentLang];
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
  billRunningDays.innerText = `${unbilled.length} ${currentLang === 'mr' ? 'दिवस' : 'Days'}`;

  if (earliestDate) {
    billPeriodLabel.innerText = `${t.unbilledSince} ${earliestDate}`;
  } else {
    billPeriodLabel.innerText = t.allSettled;
  }

  const sorted = [...appState.deliveries].sort((a, b) => b.date.localeCompare(a.date));
  logsCount.innerText = `${sorted.length} ${currentLang === 'mr' ? 'एकूण' : 'total'}`;

  if (sorted.length === 0) {
    recentLogsList.innerHTML = `<li class="empty-state">${t.noEntries}</li>`;
  } else {
    recentLogsList.innerHTML = sorted.slice(0, 8).map(d => {
      const badgeText = d.status === "unbilled" ? t.badgeUnbilled : t.badgeBilled;
      return `
        <li class="log-item">
          <div class="log-info">
            <div class="log-date">${d.date}</div>
            <div class="log-tag-group">
              <span class="badge badge-${d.status}">${badgeText}</span>
              ${d.notes ? `<span class="log-notes">• ${d.notes}</span>` : ""}
            </div>
          </div>
          <div class="log-liters">${Number(d.liters).toFixed(1)} L</div>
        </li>
      `;
    }).join("");
  }
}