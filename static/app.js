// Family Hub Touchscreen & Calendar Frontend

let appState = {
  members: [],
  events: [],
  chores: [],
  rewards: [],
  rewardRedemptions: [],
  activeRewardsFilter: "all",
  routinesPeriod: "auto", // auto, morning, afternoon, evening, all
  lists: [],
  meals: {},
  feeds: [],
  settings: {},
  photos: [],
  weather: {},
  activeMemberFilter: "all",
  activeNav: "calendar",
  calendarView: "week", // day, 3day, week, month, schedule
  currentDateOffset: 0,
  selectedDailyDate: null,
  splitScreen: false,
  splitMode: "photos", // photos, chores, lists, meals
  slideshowIndex: 0,
  slideshowPaused: false,
};

let slideshowTimer = null;
let sleepCheckTimer = null;

// Built-in high quality family wallpaper images for demo photo frame
const FALLBACK_PHOTOS = [
  { url: "https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=1600&auto=format&fit=crop", caption: "Family Sunset Beach Walk 🏖️" },
  { url: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=1600&auto=format&fit=crop", caption: "Alpine Lake Hiking Adventure 🌲" },
  { url: "https://images.unsplash.com/photo-1543353071-873f17a7a088?q=80&w=1600&auto=format&fit=crop", caption: "Kids Soccer Saturday ⚽" },
  { url: "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?q=80&w=1600&auto=format&fit=crop", caption: "Fall Pumpkin Patch & Leaves 🍂" },
];

async function init() {
  loadSavedTheme();
  startClock();
  await loadState();
  startSleepScheduler();
  startPhotoSlideshow();
  initScreensaverActivityListeners();
  resetScreensaverIdleTimer();
  requestScreenWakeLock();
  initDragToScroll();

  // On mobile phone screens, default calendar view to Schedule for best vertical readability
  if (window.innerWidth <= 768 && appState.calendarView === "week") {
    appState.calendarView = "schedule";
    document.querySelectorAll(".view-btn:not(.split-btn)").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-view") === "schedule");
    });
    renderCalendar();
  }

  // If first-time setup has not been completed, launch the wizard
  if (!appState.settings || !appState.settings.setupCompleted) {
    setTimeout(() => {
      openSetupWizard();
    }, 400);
  }
  
  // Real-time auto sync polling every 6 seconds
  setInterval(async () => {
    try {
      const res = await fetch("/api/state");
      const data = await res.json();
      appState.members = data.members || [];
      appState.events = data.events || [];
      appState.chores = data.chores || [];
      appState.rewards = data.rewards || [];
      appState.rewardRedemptions = data.rewardRedemptions || [];
      appState.lists = data.lists || [];
      appState.meals = data.meals || {};
      appState.feeds = data.feeds || [];
      appState.photos = data.photos || [];
      if (data.settings) appState.settings = data.settings;
      if (data.weather) {
        appState.weather = data.weather;
        renderWeather();
      }
      renderActiveNav();
      if (appState.splitScreen) renderSplitSidePane();
    } catch (_) {}
  }, 6000);
}

function startClock() {
  function update() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const dateStr = now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
    
    const clk = document.getElementById("clock-display");
    const dte = document.getElementById("date-display");
    const slpClk = document.getElementById("sleep-clock-text");
    
    if (clk) clk.textContent = timeStr;
    if (dte) dte.textContent = dateStr;
    if (slpClk) slpClk.textContent = timeStr;
  }
  update();
  setInterval(update, 1000);
}

async function loadState() {
  try {
    const res = await fetch("/api/state");
    const data = await res.json();
    appState.members = data.members || [];
    appState.events = data.events || [];
    appState.chores = data.chores || [];
    appState.rewards = data.rewards || [];
    appState.rewardRedemptions = data.rewardRedemptions || [];
    appState.lists = data.lists || [];
    appState.meals = data.meals || {};
    appState.feeds = data.feeds || [];
    appState.settings = data.settings || {};
    appState.photos = data.photos || [];
    appState.weather = data.weather || {};

    renderMemberPills();
    renderWeather();
    renderActiveNav();
    if (appState.splitScreen) {
      renderSplitSidePane();
    }
    populateSelectDropdowns();
  } catch (err) {
    console.error("Failed to load initial state:", err);
  }
}

// ---------------------------------------------------------------------------
// Family Member Color-Coding & Filter Pills
// ---------------------------------------------------------------------------
function renderMemberPills() {
  const bar = document.getElementById("member-pills-bar");
  if (!bar) return;
  bar.innerHTML = "";

  // 'All Family' Pill
  const allBtn = document.createElement("button");
  allBtn.className = `member-pill ${appState.activeMemberFilter === "all" ? "active" : ""}`;
  allBtn.innerHTML = `<span>👨‍👩‍👧‍👦</span><span>All Family</span>`;
  allBtn.onclick = () => {
    appState.activeMemberFilter = "all";
    renderMemberPills();
    renderActiveNav();
    if (appState.splitScreen) renderSplitSidePane();
  };
  bar.appendChild(allBtn);

  for (const m of appState.members) {
    const isActive = appState.activeMemberFilter === m.id;
    const pill = document.createElement("button");
    pill.className = `member-pill ${isActive ? "active" : ""}`;
    if (isActive) {
      pill.style.borderColor = m.color;
      pill.style.boxShadow = `0 0 0 1px ${m.color}, 0 2px 8px rgba(0,0,0,0.06)`;
    }
    pill.innerHTML = `
      <span class="member-dot" style="background: ${m.color}"></span>
      <span style="font-size: 1.15rem;">${m.avatar || "👤"}</span>
      <span style="font-weight: 700;">${m.name}</span>
    `;
    pill.onclick = () => {
      appState.activeMemberFilter = m.id;
      renderMemberPills();
      renderActiveNav();
      if (appState.splitScreen) renderSplitSidePane();
    };
    bar.appendChild(pill);
  }
}

function getMember(memberId) {
  return appState.members.find((m) => m.id === memberId) || { name: "Family", color: "#38bdf8", avatar: "🏡" };
}

function populateSelectDropdowns() {
  const selects = ["ev-member", "magic-member", "ch-member", "feed-member", "reward-member-id"];
  for (const sId of selects) {
    const el = document.getElementById(sId);
    if (!el) continue;
    el.innerHTML = "";
    if (sId === "feed-member" || sId === "ev-member" || sId === "magic-member") {
      const allOpt = document.createElement("option");
      allOpt.value = "all";
      allOpt.textContent = "🏡 Entire Family (Shared)";
      el.appendChild(allOpt);
    }
    if (sId === "reward-member-id") {
      const allOpt = document.createElement("option");
      allOpt.value = "all";
      allOpt.textContent = "🏡 Entire Family (Shared Goal)";
      el.appendChild(allOpt);
    }
    const excludedRewards = (appState.settings && Array.isArray(appState.settings.excludedRewardMemberIds))
      ? appState.settings.excludedRewardMemberIds
      : [];
    for (const m of appState.members) {
      if (sId === "reward-member-id" && m.id === "m5") continue;
      const opt = document.createElement("option");
      opt.value = m.id;
      if (sId === "reward-member-id" && excludedRewards.includes(m.id)) {
        opt.textContent = `${m.avatar || "👤"} ${m.name} (Excluded from Rewards)`;
      } else {
        opt.textContent = `${m.avatar || "👤"} ${m.name}`;
      }
      el.appendChild(opt);
    }
    if (sId === "ch-member") {
      const allOpt = document.createElement("option");
      allOpt.value = "all";
      allOpt.textContent = "🏡 Entire Family (Shared)";
      el.appendChild(allOpt);
    }
  }
}

// ---------------------------------------------------------------------------
// Multi-Member Selection Helpers (Tasks, Routines, Rewards)
// ---------------------------------------------------------------------------
function renderMultiMemberPicker(containerId, selectedIds = [], isReward = false) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  const selSet = new Set((selectedIds && selectedIds.length > 0) ? selectedIds : ["all"]);
  const excludedRewards = (isReward && appState.settings && Array.isArray(appState.settings.excludedRewardMemberIds))
    ? appState.settings.excludedRewardMemberIds
    : [];

  // Entire Family (Shared)
  const isAllSelected = selSet.has("all");
  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = `member-chip-select ${isAllSelected ? "selected" : ""}`;
  allBtn.dataset.memberId = "all";
  allBtn.style.setProperty("--member-color", "var(--primary)");
  allBtn.onclick = () => handleMemberChipClick(containerId, "all");
  allBtn.innerHTML = `
    <span class="member-chip-avatar">🏡</span>
    <span class="member-chip-name">${isReward ? "Entire Family (Shared Goal)" : "Entire Family (Shared)"}</span>
    <span class="member-chip-check">✓</span>
  `;
  container.appendChild(allBtn);

  // Individual Members
  for (const m of appState.members || []) {
    if (m.id === "m5") continue;
    if (isReward && excludedRewards.includes(m.id)) continue;

    const isSelected = selSet.has(m.id);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `member-chip-select ${isSelected ? "selected" : ""}`;
    btn.dataset.memberId = m.id;
    btn.style.setProperty("--member-color", m.color || "var(--primary)");
    btn.onclick = () => handleMemberChipClick(containerId, m.id);
    btn.innerHTML = `
      <span class="member-chip-avatar">${m.avatar || "👤"}</span>
      <span class="member-chip-name">${escapeHtml(m.name)}</span>
      <span class="member-chip-check">✓</span>
    `;
    container.appendChild(btn);
  }

  syncPickerToHiddenInput(containerId);
}

function getSelectedPickerMembers(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return ["all"];
  const selected = Array.from(container.querySelectorAll(".member-chip-select.selected"))
    .map((btn) => btn.dataset.memberId)
    .filter(Boolean);
  return selected.length > 0 ? selected : ["all"];
}

function handleMemberChipClick(containerId, clickedVal) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const allBtn = container.querySelector(`.member-chip-select[data-member-id="all"]`);
  const clickedBtn = container.querySelector(`.member-chip-select[data-member-id="${clickedVal}"]`);
  if (!clickedBtn) return;

  if (clickedVal === "all") {
    container.querySelectorAll(".member-chip-select").forEach((b) => b.classList.remove("selected"));
    allBtn.classList.add("selected");
  } else {
    if (allBtn) allBtn.classList.remove("selected");
    clickedBtn.classList.toggle("selected");

    const anySelected = container.querySelectorAll(".member-chip-select.selected").length > 0;
    if (!anySelected && allBtn) {
      allBtn.classList.add("selected");
    }
  }

  syncPickerToHiddenInput(containerId);
}

function toggleAllPickerMembers(containerId, selectAll) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const allBtn = container.querySelector(`.member-chip-select[data-member-id="all"]`);
  const individualBtns = Array.from(container.querySelectorAll(`.member-chip-select:not([data-member-id="all"])`));

  if (selectAll) {
    if (allBtn) allBtn.classList.remove("selected");
    individualBtns.forEach((b) => b.classList.add("selected"));
  } else {
    individualBtns.forEach((b) => b.classList.remove("selected"));
    if (allBtn) allBtn.classList.add("selected");
  }

  syncPickerToHiddenInput(containerId);
}

function syncPickerToHiddenInput(containerId) {
  const hiddenInputMap = {
    "ch-members-picker": "ch-member",
    "reward-members-picker": "reward-member-id",
    "preset-members-picker": "preset-member-select"
  };
  const hiddenInputId = hiddenInputMap[containerId];
  if (hiddenInputId) {
    const hiddenEl = document.getElementById(hiddenInputId);
    if (hiddenEl) {
      const currentSelected = getSelectedPickerMembers(containerId);
      hiddenEl.value = currentSelected[0] || "all";
    }
  }
}

// ---------------------------------------------------------------------------
// Weather Widget Display & Forecast Modal
// ---------------------------------------------------------------------------
function renderWeather() {
  const w = appState.weather;
  if (!w) return;
  const tEl = document.getElementById("weather-temp");
  const iEl = document.getElementById("weather-icon");
  const dEl = document.getElementById("weather-desc");
  const lEl = document.getElementById("weather-location");

  if (tEl) tEl.textContent = w.temp ?? 68;
  if (iEl) iEl.textContent = w.icon ?? "⛅";
  if (dEl) dEl.textContent = w.desc ?? "Partly Sunny";
  if (lEl) {
    const loc = w.location || (appState.settings && appState.settings.weatherLocation) || "";
    lEl.textContent = loc;
    lEl.style.display = "inline-block";
  }
}

function openWeatherModal() {
  const w = appState.weather || {};
  const iconEl = document.getElementById("mw-icon");
  const tempEl = document.getElementById("mw-temp");
  const descEl = document.getElementById("mw-desc");
  const locEl = document.getElementById("mw-location");
  const container = document.getElementById("forecast-cards-container");

  if (iconEl) iconEl.textContent = w.icon || "⛅";
  if (tempEl) tempEl.textContent = `${w.temp ?? 68}°F`;
  if (descEl) descEl.textContent = `${w.desc || "Partly Sunny"} • Humidity: ${w.humidity || 50}% • Wind: ${w.wind || "5 mph"}`;
  if (locEl) locEl.textContent = w.location || (appState.settings && appState.settings.weatherLocation) || "Local Weather";

  if (container && w.forecast && w.forecast.length > 0) {
    container.innerHTML = w.forecast.map(day => `
      <div style="background: var(--bg-card); padding: 0.75rem 0.5rem; border-radius: 8px; border: 1px solid var(--border-subtle); display: flex; flex-direction: column; align-items: center;">
        <div style="font-weight: 700; font-size: 0.85rem; margin-bottom: 2px;">${day.dayName || day.date}</div>
        <div style="font-size: 1.8rem; margin: 4px 0;">${day.icon || "⛅"}</div>
        <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">${day.high ?? "--"}°</div>
        <div style="font-size: 0.78rem; color: var(--text-muted);">${day.low ?? "--"}°</div>
        <div style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 2px; text-align: center;">${day.desc || ""}</div>
      </div>
    `).join("");
  }
  openModal("modal-weather");
}

function toggleTheme() {
  const isDark = document.body.classList.toggle("theme-dark");
  localStorage.setItem("familyhub-theme", isDark ? "dark" : "light");
  const icon = document.getElementById("theme-icon");
  const label = document.getElementById("theme-label");
  if (icon) icon.textContent = isDark ? "☀️" : "🌙";
  if (label) label.textContent = isDark ? "Day" : "Night";
}

function loadSavedTheme() {
  const saved = localStorage.getItem("familyhub-theme") || localStorage.getItem("skylight-theme");
  const icon = document.getElementById("theme-icon");
  const label = document.getElementById("theme-label");
  if (saved === "dark") {
    document.body.classList.add("theme-dark");
    if (icon) icon.textContent = "☀️";
    if (label) label.textContent = "Day";
  } else {
    document.body.classList.remove("theme-dark");
    if (icon) icon.textContent = "🌙";
    if (label) label.textContent = "Night";
  }
}

function triggerSleep() {
  if (isScreensaverActive) {
    dismissScreensaver();
  }
  const overlay = document.getElementById("sleep-overlay");
  if (overlay) overlay.classList.remove("hidden");
}

function refreshApplication() {
  const logos = document.querySelectorAll(".hub-logo-arch");
  logos.forEach((el) => el.classList.add("refreshing-spin"));
  setTimeout(() => {
    window.location.reload();
  }, 220);
}

// ---------------------------------------------------------------------------
// Navigation & Views
// ---------------------------------------------------------------------------
function switchNav(navKey) {
  appState.activeNav = navKey;
  document.querySelectorAll(".nav-item, .nav-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === navKey);
  });

  const panels = ["calendar", "chores", "rewards", "lists", "meals", "photo-frame"];
  for (const p of panels) {
    const el = document.getElementById(`panel-${p}`);
    if (el) el.classList.toggle("hidden", p !== navKey);
  }

  const calViews = document.getElementById("cal-view-selector");
  if (calViews) {
    calViews.style.display = navKey === "calendar" ? "inline-flex" : "none";
  }

  renderActiveNav();
}

function renderActiveNav() {
  if (appState.activeNav === "calendar") renderCalendar();
  else if (appState.activeNav === "chores") renderChores();
  else if (appState.activeNav === "rewards") renderRewards();
  else if (appState.activeNav === "lists") renderLists();
  else if (appState.activeNav === "meals") renderMeals();
  else if (appState.activeNav === "photo-frame") renderPhotoFrame();
  initDragToScroll();
}

// ---------------------------------------------------------------------------
// Universal Touch & Mouse Drag-to-Scroll Controller
// ---------------------------------------------------------------------------
function initDragToScroll() {
  const panelSelectors = [
    "#panel-chores",
    "#panel-rewards",
    "#panel-lists",
    "#panel-meals",
    ".daily-events-pane",
  ];

  panelSelectors.forEach((selector) => {
    const el = document.querySelector(selector);
    if (!el || el.dataset.dragScrollInit) return;
    el.dataset.dragScrollInit = "true";

    let isDown = false;
    let startY = 0;
    let scrollTop = 0;
    let isDragging = false;

    el.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      const target = e.target;
      if (target.closest("button, input, select, textarea, a, .chore-checkbox, .filter-pill, .routine-filter-btn, .mini-btn, .member-points-pill, .modal-card, .btn-hub")) {
        return;
      }
      isDown = true;
      isDragging = false;
      startY = e.pageY;
      scrollTop = el.scrollTop;
    });

    window.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      const dy = e.pageY - startY;
      if (Math.abs(dy) > 5) {
        isDragging = true;
        el.scrollTop = scrollTop - dy;
      }
    });

    window.addEventListener("mouseup", (e) => {
      if (isDown) {
        isDown = false;
        if (isDragging) {
          const captureClick = (ev) => {
            ev.stopPropagation();
            ev.preventDefault();
            window.removeEventListener("click", captureClick, true);
          };
          window.addEventListener("click", captureClick, true);
        }
        isDragging = false;
      }
    });
  });
}

function setCalendarView(viewName) {
  if (viewName === "split") {
    toggleSplitScreen();
    return;
  }
  appState.calendarView = viewName;
  document.querySelectorAll(".view-btn:not(.split-btn)").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-view") === viewName);
  });
  renderCalendar();
}

function toggleSplitScreen(targetMode) {
  if (targetMode) {
    appState.splitScreen = true;
    appState.splitMode = targetMode;
  } else {
    appState.splitScreen = !appState.splitScreen;
    if (appState.splitScreen && !appState.splitMode) {
      appState.splitMode = (appState.settings && appState.settings.splitDefault) || "photos";
    }
  }
  const splitBtn = document.querySelector(".view-btn.split-btn");
  const splitPane = document.getElementById("split-photos-pane");
  
  if (splitBtn) splitBtn.classList.toggle("active", appState.splitScreen);
  if (splitPane) splitPane.classList.toggle("hidden", !appState.splitScreen);
  
  if (appState.splitScreen) {
    renderSplitSidePane();
  }
}

// ---------------------------------------------------------------------------
// Screen Wake Lock (Prevents tablet/display sleep during active daytime hours)
// ---------------------------------------------------------------------------
let screenWakeLock = null;

async function requestScreenWakeLock() {
  if ("wakeLock" in navigator) {
    try {
      if (!screenWakeLock) {
        screenWakeLock = await navigator.wakeLock.request("screen");
        screenWakeLock.addEventListener("release", () => {
          screenWakeLock = null;
        });
        console.log("Screen Wake Lock active (prevents tablet sleep)");
      }
    } catch (err) {
      console.warn("Could not acquire screen wake lock:", err);
    }
  }
}

// Re-acquire wake lock when tablet is unlocked or tab becomes visible
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible") {
    await requestScreenWakeLock();
  }
});
window.addEventListener("touchstart", () => { requestScreenWakeLock(); }, { once: true, passive: true });
window.addEventListener("click", () => { requestScreenWakeLock(); }, { once: true, passive: true });

function switchSplitTab(tabName) {
  appState.splitMode = tabName;
  renderSplitSidePane();
}

function renderSplitSidePane() {
  const mode = appState.splitMode || "photos";
  
  // Highlight active split tab
  document.querySelectorAll(".split-tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-split-tab") === mode);
  });
  
  // Toggle subviews
  const photoView = document.getElementById("split-view-photos");
  const choresView = document.getElementById("split-view-chores");
  const listsView = document.getElementById("split-view-lists");
  const mealsView = document.getElementById("split-view-meals");
  
  if (photoView) photoView.classList.toggle("hidden", mode !== "photos");
  if (choresView) choresView.classList.toggle("hidden", mode !== "chores");
  if (listsView) listsView.classList.toggle("hidden", mode !== "lists");
  if (mealsView) mealsView.classList.toggle("hidden", mode !== "meals");
  
  if (mode === "photos") {
    updateSlideshowImage("split-slideshow-img", "split-slideshow-caption");
  } else if (mode === "chores") {
    renderSplitChores();
  } else if (mode === "lists") {
    renderSplitLists();
  } else if (mode === "meals") {
    renderSplitMeals();
  }
}

function toggleSlideshowPause(e) {
  if (e) e.stopPropagation();
  appState.slideshowPaused = !appState.slideshowPaused;
  const btn = document.getElementById("split-pause-btn");
  if (btn) btn.textContent = appState.slideshowPaused ? "▶" : "⏸";
  const metaEl = document.getElementById("split-slideshow-meta");
  if (metaEl) {
    if (appState.slideshowPaused) {
      metaEl.textContent = "⏸ Slideshow Paused • Tap photo to resume";
    } else {
      metaEl.textContent = "📸 Rotating Slideshow • Tap photo to pause";
    }
  }
}

function prevSlideshowPhoto(e) {
  if (e) e.stopPropagation();
  const photos = getActivePhotos();
  if (photos.length === 0) return;
  appState.slideshowIndex = (appState.slideshowIndex - 2 + photos.length) % photos.length;
  updateSlideshowImage("split-slideshow-img", "split-slideshow-caption");
}

function nextSlideshowPhoto(e) {
  if (e) e.stopPropagation();
  updateSlideshowImage("split-slideshow-img", "split-slideshow-caption");
}

function renderSplitChores() {
  const container = document.getElementById("split-chores-list");
  const countBadge = document.getElementById("split-chores-count");
  if (!container) return;
  container.innerHTML = "";
  
  const chores = appState.activeMemberFilter === "all"
    ? (appState.chores || [])
    : (appState.chores || []).filter((c) => c.memberId === appState.activeMemberFilter || c.memberId === "all");
    
  const pending = chores.filter((c) => !c.completed);
  if (countBadge) countBadge.textContent = `${pending.length} left`;
  
  if (chores.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted);">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">⭐</div>
        <div style="font-weight: 600; font-size: 0.9rem;">No chores scheduled today!</div>
        <div style="font-size: 0.78rem; margin-top: 4px;">Tap "+ Add" above to create family routines.</div>
      </div>
    `;
    return;
  }
  
  const subcats = [
    { key: "Daily", label: "Daily Routines", icon: "🌅" },
    { key: "Weekly", label: "Weekly Tasks", icon: "📅" },
    { key: "As Needed", label: "As Needed / One-Time", icon: "⚡" },
  ];

  for (const sub of subcats) {
    const choresInSub = chores.filter(c => getChoreFrequencyCategory(c.frequency) === sub.key);
    if (choresInSub.length === 0) continue;

    const subHeader = document.createElement("div");
    subHeader.style.cssText = `
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 8px 0 4px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    `;
    subHeader.innerHTML = `
      <span>${sub.icon} ${sub.label}</span>
      <span class="badge-count">${choresInSub.filter(c => !c.completed).length}</span>
    `;
    container.appendChild(subHeader);

    for (const chore of choresInSub) {
      const m = getMember(chore.memberId);
      const memberColor = m.color || "#0284c7";
      const item = document.createElement("div");
      item.className = `split-chore-item ${chore.completed ? "done" : ""}`;
      item.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        background: ${chore.completed ? "var(--bg-card-alt)" : `linear-gradient(90deg, ${memberColor}15 0%, var(--bg-surface) 40%)`};
        border-radius: var(--radius-md);
        border: 1px solid var(--border-subtle);
        border-left: 5px solid ${memberColor};
        transition: all 0.15s ease;
        ${chore.completed ? "opacity: 0.55; text-decoration: line-through;" : ""}
      `;
      item.innerHTML = `
        <div class="split-chore-check" title="Tap to mark complete" style="
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px solid ${memberColor};
          background: ${chore.completed ? memberColor : "transparent"};
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 700;
          flex-shrink: 0;
          cursor: pointer;
        ">${chore.completed ? "✓" : ""}</div>
        <div class="split-chore-body" title="Tap to edit task" style="flex: 1; min-width: 0; cursor: pointer;">
          <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${chore.title}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted); display: flex; gap: 6px; align-items: center; margin-top: 2px; flex-wrap: wrap;">
            <span class="chore-member-tag" style="background: ${memberColor}18; color: ${memberColor}; border: 1px solid ${memberColor}35;">${m.avatar} ${m.name}</span>
            <span style="color: var(--accent-gold); font-weight: 700;">+${chore.points} ⭐</span>
            ${chore.isRoutine && chore.timeOfDay ? `<span class="routine-time-badge">${chore.timeOfDay}</span>` : ""}
          </div>
        </div>
        <button type="button" class="btn-split-chore-edit" title="Edit or delete task" style="border: none; background: transparent; color: var(--text-muted); cursor: pointer; padding: 4px; font-size: 0.82rem;">✏️</button>
      `;

      const chk = item.querySelector(".split-chore-check");
      chk.onclick = async (e) => {
        e.stopPropagation();
        try {
          const res = await fetch(`/api/chores/${chore.id}/toggle`, { method: "POST" });
          const data = await res.json();
          if (data.reward) {
            triggerRewardConfetti(data.reward);
          }
          await loadState();
          renderSplitChores();
        } catch (err) {
          console.error("Failed to toggle chore:", err);
        }
      };

      const bodyEl = item.querySelector(".split-chore-body");
      bodyEl.onclick = (e) => {
        e.stopPropagation();
        openEditChoreModal(chore.id);
      };

      const editBtn = item.querySelector(".btn-split-chore-edit");
      editBtn.onclick = (e) => {
        e.stopPropagation();
        openEditChoreModal(chore.id);
      };

      container.appendChild(item);
    }
  }
}

let currentSplitListId = null;

function renderSplitLists() {
  const selectEl = document.getElementById("split-list-select");
  const itemsContainer = document.getElementById("split-list-items");
  const countBadge = document.getElementById("split-list-count");
  if (!itemsContainer || !selectEl) return;
  
  const lists = appState.lists || [];
  if (lists.length === 0) {
    itemsContainer.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.85rem;">No lists created yet.</div>`;
    return;
  }
  
  if (!currentSplitListId || !lists.find(l => l.id === currentSplitListId)) {
    currentSplitListId = lists[0].id;
  }
  
  selectEl.innerHTML = lists.map(l => `<option value="${l.id}" ${l.id === currentSplitListId ? "selected" : ""}>${l.title}</option>`).join("");
  
  const activeList = lists.find(l => l.id === currentSplitListId) || lists[0];
  const items = activeList.items || [];
  const unchecked = items.filter(i => !i.checked);
  if (countBadge) countBadge.textContent = `${unchecked.length} left`;
  
  itemsContainer.innerHTML = "";
  if (items.length === 0) {
    itemsContainer.innerHTML = `<div style="text-align: center; padding: 1.5rem; color: var(--text-muted); font-size: 0.8rem;">List is empty. Add items below!</div>`;
    return;
  }
  
  for (const item of items) {
    const row = document.createElement("div");
    row.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      background: var(--bg-surface);
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-subtle);
      transition: background 0.15s;
    `;
    row.innerHTML = `
      <input type="checkbox" ${item.checked ? "checked" : ""} style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--primary);" />
      <span style="flex: 1; font-size: 0.85rem; color: var(--text-primary); ${item.checked ? "text-decoration: line-through; opacity: 0.5;" : ""}">${item.text}</span>
      <button type="button" style="border: none; background: transparent; color: var(--text-muted); cursor: pointer; font-size: 0.8rem; padding: 2px 6px;">✕</button>
    `;
    const chk = row.querySelector("input");
    chk.onchange = async () => {
      await fetch(`/api/lists/${activeList.id}/items/${item.id}/toggle`, { method: "POST" });
      await loadState();
      renderSplitLists();
    };
    const delBtn = row.querySelector("button");
    delBtn.onclick = async (e) => {
      e.stopPropagation();
      await fetch(`/api/lists/${activeList.id}/items/${item.id}`, { method: "DELETE" });
      await loadState();
      renderSplitLists();
    };
    itemsContainer.appendChild(row);
  }
}

function switchSplitList(listId) {
  currentSplitListId = listId;
  renderSplitLists();
}

async function addSplitListItem() {
  const inp = document.getElementById("split-list-input");
  if (!inp || !inp.value.trim() || !currentSplitListId) return;
  const text = inp.value.trim();
  inp.value = "";
  const activeMem = appState.activeMemberFilter !== "all" ? getMember(appState.activeMemberFilter).name : "Kitchen Hub";
  await fetch(`/api/lists/${currentSplitListId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, addedBy: activeMem }),
  });
  await loadState();
  renderSplitLists();
}

function handleSplitListKey(e) {
  if (e.key === "Enter") addSplitListItem();
}

function renderSplitMeals() {
  const container = document.getElementById("split-meals-content");
  if (!container) return;
  container.innerHTML = "";
  
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayName = days[new Date().getDay()];
  const tomorrowName = days[(new Date().getDay() + 1) % 7];
  
  const todayMeals = (appState.meals && appState.meals[todayName]) || { breakfast: "Eggs & toast", lunch: "Salad wrap", dinner: "Family Dinner" };
  const tomorrowMeals = (appState.meals && appState.meals[tomorrowName]) || { dinner: "Taco Night" };
  
  container.innerHTML = `
    <div style="background: var(--primary-light); padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid rgba(2, 132, 199, 0.2); margin-bottom: 8px;">
      <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--primary); letter-spacing: 0.5px; margin-bottom: 8px;">
        📅 Today's Menu (${todayName})
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface); padding: 8px 10px; border-radius: 6px; cursor: pointer;" onclick="editMealPrompt('${todayName}', 'breakfast', '${todayMeals.breakfast}')">
          <div>
            <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted);">🍳 BREAKFAST</div>
            <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); margin-top: 1px;">${todayMeals.breakfast || "Tap to set"}</div>
          </div>
          <span style="font-size: 0.8rem; color: var(--text-muted);">✏️</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface); padding: 8px 10px; border-radius: 6px; cursor: pointer;" onclick="editMealPrompt('${todayName}', 'lunch', '${todayMeals.lunch}')">
          <div>
            <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted);">🥪 LUNCH</div>
            <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); margin-top: 1px;">${todayMeals.lunch || "Tap to set"}</div>
          </div>
          <span style="font-size: 0.8rem; color: var(--text-muted);">✏️</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface); padding: 8px 10px; border-radius: 6px; cursor: pointer;" onclick="editMealPrompt('${todayName}', 'dinner', '${todayMeals.dinner}')">
          <div>
            <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted);">🍲 DINNER</div>
            <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); margin-top: 1px;">${todayMeals.dinner || "Tap to set"}</div>
          </div>
          <span style="font-size: 0.8rem; color: var(--text-muted);">✏️</span>
        </div>
      </div>
    </div>
    
    <div style="background: var(--bg-surface); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
      <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px;">
        🔮 Tomorrow's Dinner (${tomorrowName})
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="editMealPrompt('${tomorrowName}', 'dinner', '${tomorrowMeals.dinner}')">
        <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">${tomorrowMeals.dinner || "Tap to plan tomorrow's dinner"}</div>
        <span style="font-size: 0.8rem; color: var(--text-muted);">✏️</span>
      </div>
    </div>
  `;
}

function navigateDate(delta) {
  appState.currentDateOffset += delta;
  renderCalendar();
}

function goToToday() {
  appState.currentDateOffset = 0;
  renderCalendar();
}

// ---------------------------------------------------------------------------
// 1. Calendar Engine (Day, 3-Day, Week, Month, Schedule)
// ---------------------------------------------------------------------------
function isEventOnDate(ev, dateIso) {
  if (!ev || !ev.date || !dateIso) return false;
  if (ev.date === dateIso) return true;

  const repeat = ev.repeat || "none";
  if (repeat === "none") return false;

  // Repeating occurrences only happen on or after the event's start date
  if (dateIso < ev.date) return false;

  // Check optional repeatUntil cutoff
  if (ev.repeatUntil && dateIso > ev.repeatUntil) return false;

  const [tY, tM, tD] = dateIso.split("-").map(Number);
  const [eY, eM, eD] = ev.date.split("-").map(Number);

  const targetDate = new Date(tY, tM - 1, tD);
  const origDate = new Date(eY, eM - 1, eD);

  switch (repeat) {
    case "daily":
      return true;

    case "weekdays": {
      const day = targetDate.getDay();
      return day >= 1 && day <= 5; // Mon through Fri
    }

    case "weekly":
      return targetDate.getDay() === origDate.getDay();

    case "biweekly": {
      if (targetDate.getDay() !== origDate.getDay()) return false;
      const diffDays = Math.round((targetDate.getTime() - origDate.getTime()) / (1000 * 60 * 60 * 24));
      const diffWeeks = Math.round(diffDays / 7);
      return diffWeeks % 2 === 0;
    }

    case "monthly":
      return tD === eD;

    case "yearly":
      return tM === eM && tD === eD;

    default:
      return false;
  }
}

function toggleRepeatUntilVisibility() {
  const rep = document.getElementById("ev-repeat");
  const grp = document.getElementById("ev-repeat-until-group");
  if (rep && grp) {
    grp.style.display = rep.value !== "none" ? "block" : "none";
  }
}

function getFilteredEvents() {
  if (appState.activeMemberFilter === "all") {
    return appState.events;
  }
  return appState.events.filter((e) => e.memberId === appState.activeMemberFilter);
}

function getBaseDate() {
  const d = new Date();
  d.setDate(d.getDate() + (appState.currentDateOffset * (appState.calendarView === "month" ? 30 : appState.calendarView === "3day" ? 3 : 7)));
  return d;
}

function renderCalendar() {
  const mount = document.getElementById("calendar-grid-mount");
  const titleLabel = document.getElementById("calendar-title-label");
  if (!mount) return;
  mount.innerHTML = "";

  const view = appState.calendarView;
  const filteredEvents = getFilteredEvents();

  if (view === "week") {
    renderWeekView(mount, titleLabel, filteredEvents);
  } else if (view === "day" || view === "schedule") {
    renderDailyScheduleView(mount, titleLabel, filteredEvents);
  } else if (view === "3day") {
    renderDayView(mount, titleLabel, filteredEvents, 3);
  } else if (view === "month") {
    renderMonthView(mount, titleLabel, filteredEvents);
  }
}

function renderWeekView(mount, titleLabel, events) {
  mount.className = "calendar-grid week-grid";
  const curr = new Date();
  curr.setDate(curr.getDate() + appState.currentDateOffset * 7);
  
  // Start on Monday of current week
  const dayOfWeek = curr.getDay(); // 0 is Sunday
  const distanceToMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(curr);
  monday.setDate(curr.getDate() - distanceToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  if (titleLabel) {
    titleLabel.textContent = `${monday.toLocaleDateString([], { month: "short", day: "numeric" })} - ${sunday.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`;
  }

  const todayIso = new Date().toISOString().split("T")[0];

  for (let i = 0; i < 7; i++) {
    const colDate = new Date(monday);
    colDate.setDate(monday.getDate() + i);
    const dateIso = colDate.toISOString().split("T")[0];
    const isToday = dateIso === todayIso;

    const col = document.createElement("div");
    col.className = `week-col ${isToday ? "today" : ""}`;
    col.innerHTML = `
      <div class="week-col-header">
        <div class="week-col-day">${colDate.toLocaleDateString([], { weekday: "short" })}</div>
        <div class="week-col-num">${colDate.getDate()}</div>
      </div>
      <div class="week-col-events" id="week-col-${dateIso}"></div>
    `;

    const eventsContainer = col.querySelector(".week-col-events");
    const dayEvents = events
      .filter((e) => isEventOnDate(e, dateIso))
      .sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"));

    for (const ev of dayEvents) {
      const card = createEventCard(ev);
      eventsContainer.appendChild(card);
    }

    mount.appendChild(col);
  }
}

// ---------------------------------------------------------------------------
// Daily Schedule Split View (Interactive Mini-Calendar + Stacked Pastel Cards)
// ---------------------------------------------------------------------------
function formatTimeString(t) {
  if (!t) return "";
  if (t.toLowerCase().includes("am") || t.toLowerCase().includes("pm")) return t;
  const parts = t.split(":");
  if (parts.length < 2) return t;
  let h = parseInt(parts[0], 10);
  const m = parts[1];
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

function formatEventDisplayTime(startTime, endTime) {
  if (!startTime || startTime === "All Day") return "All Day";
  const startFmt = formatTimeString(startTime);
  if (!endTime) return startFmt;
  const endFmt = formatTimeString(endTime);
  const startParts = startFmt.split(" ");
  const endParts = endFmt.split(" ");
  if (startParts.length === 2 && endParts.length === 2 && startParts[1] === endParts[1]) {
    return `${startParts[0]} - ${endParts[0]} ${endParts[1]}`;
  }
  return `${startFmt} - ${endFmt}`;
}

function openNewEventForDate(dateIso) {
  openNewEventModal();
  const dInput = document.getElementById("ev-date");
  if (dInput && dateIso) dInput.value = dateIso;
}

function navDailyDay(offset) {
  if (!appState.selectedDailyDate) {
    appState.selectedDailyDate = new Date().toISOString().split("T")[0];
  }
  const d = new Date(appState.selectedDailyDate + "T00:00:00");
  d.setDate(d.getDate() + offset);
  appState.selectedDailyDate = d.toISOString().split("T")[0];
  renderCalendar();
}

function navMiniCalMonth(offset) {
  if (!appState.selectedDailyDate) {
    appState.selectedDailyDate = new Date().toISOString().split("T")[0];
  }
  const d = new Date(appState.selectedDailyDate + "T00:00:00");
  d.setMonth(d.getMonth() + offset);
  appState.selectedDailyDate = d.toISOString().split("T")[0];
  renderCalendar();
}

function goToTodayDaily() {
  appState.selectedDailyDate = new Date().toISOString().split("T")[0];
  renderCalendar();
}

function renderDailyScheduleView(mount, titleLabel, events) {
  mount.className = "calendar-grid-container";
  mount.innerHTML = "";

  if (!appState.selectedDailyDate) {
    const today = new Date();
    appState.selectedDailyDate = today.toISOString().split("T")[0];
  }

  const selectedD = new Date(appState.selectedDailyDate + "T00:00:00");
  const monthYearStr = selectedD.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const dateFormatted = selectedD.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const weekdayStr = selectedD.toLocaleDateString("en-US", { weekday: "long" });

  if (titleLabel) {
    titleLabel.textContent = `${weekdayStr}, ${dateFormatted}`;
  }

  // Master 2-pane layout container
  const layout = document.createElement("div");
  layout.className = "daily-schedule-layout";

  // --- LEFT PANE: Mini Month Calendar ---
  const leftCard = document.createElement("aside");
  leftCard.className = "daily-mini-cal-card";

  // Mini Calendar Header with Month/Year & Controls
  const navHeader = document.createElement("div");
  navHeader.className = "mini-cal-nav";
  navHeader.innerHTML = `
    <span class="mini-cal-month-title">${monthYearStr}</span>
    <div class="mini-cal-nav-btns">
      <button type="button" class="mini-cal-btn" onclick="navMiniCalMonth(-1)" title="Previous Month">‹</button>
      <button type="button" class="mini-cal-btn today-btn" onclick="goToTodayDaily()" title="Go to Today">Today</button>
      <button type="button" class="mini-cal-btn" onclick="navMiniCalMonth(1)" title="Next Month">›</button>
    </div>
  `;
  leftCard.appendChild(navHeader);

  // Weekday Headers: Sun Mon Tue Wed Thu Fri Sat
  const dayNamesHeader = document.createElement("div");
  dayNamesHeader.className = "mini-cal-grid-header";
  const daysShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  dayNamesHeader.innerHTML = daysShort.map(d => `<span>${d}</span>`).join("");
  leftCard.appendChild(dayNamesHeader);

  // Days Grid
  const daysGrid = document.createElement("div");
  daysGrid.className = "mini-cal-days-grid";

  // Compute month bounds
  const year = selectedD.getFullYear();
  const month = selectedD.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDay.getDay(); // 0 is Sunday
  const daysInMonth = lastDay.getDate();

  // Days from previous month
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const prevDate = prevMonthLastDay - i;
    const prevMonthIdx = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const prevDateIso = `${prevYear}-${String(prevMonthIdx + 1).padStart(2, "0")}-${String(prevDate).padStart(2, "0")}`;
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "mini-cal-cell other-month";
    cell.textContent = prevDate;
    cell.onclick = () => {
      appState.selectedDailyDate = prevDateIso;
      renderCalendar();
    };
    daysGrid.appendChild(cell);
  }

  const todayIso = new Date().toISOString().split("T")[0];

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const curDateIso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const isSelected = curDateIso === appState.selectedDailyDate;
    const isToday = curDateIso === todayIso;
    const hasEvents = (appState.events || []).some(e => isEventOnDate(e, curDateIso));

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = `mini-cal-cell ${isSelected ? "selected" : ""} ${isToday ? "today" : ""} ${hasEvents ? "has-events" : ""}`;
    cell.innerHTML = `
      <span class="mini-cal-cell-num">${day}</span>
      ${hasEvents ? '<span class="mini-cal-event-dot"></span>' : ''}
    `;
    cell.onclick = () => {
      appState.selectedDailyDate = curDateIso;
      renderCalendar();
    };
    daysGrid.appendChild(cell);
  }

  // Fill remaining cells for 35 or 42 grid
  const totalRendered = startingDayOfWeek + daysInMonth;
  const nextMonthCells = totalRendered <= 35 ? 35 - totalRendered : 42 - totalRendered;
  for (let day = 1; day <= nextMonthCells; day++) {
    const nextMonthIdx = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const nextDateIso = `${nextYear}-${String(nextMonthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "mini-cal-cell other-month";
    cell.textContent = day;
    cell.onclick = () => {
      appState.selectedDailyDate = nextDateIso;
      renderCalendar();
    };
    daysGrid.appendChild(cell);
  }

  leftCard.appendChild(daysGrid);
  layout.appendChild(leftCard);

  // --- RIGHT PANE: Daily Schedule Timeline Cards ---
  const rightPane = document.createElement("div");
  rightPane.className = "daily-events-pane";

  // Top header with big date title e.g. Oct 27
  const header = document.createElement("div");
  header.className = "daily-events-header";
  header.innerHTML = `
    <div class="daily-header-left">
      <h1 class="daily-selected-date">${dateFormatted}</h1>
      <span class="daily-selected-weekday">${weekdayStr}</span>
    </div>
    <div class="daily-header-actions">
      <button type="button" class="btn-hub ghost mini-btn" onclick="navDailyDay(-1)" title="Previous Day">‹ Prev</button>
      <button type="button" class="btn-hub ghost mini-btn" onclick="goToTodayDaily()">Today</button>
      <button type="button" class="btn-hub ghost mini-btn" onclick="navDailyDay(1)" title="Next Day">Next ›</button>
      <button type="button" class="btn-hub primary mini-btn" onclick="openNewEventForDate('${appState.selectedDailyDate}')">+ Add Event</button>
    </div>
  `;
  rightPane.appendChild(header);

  // Check today's meal dinner
  const weekdayName = selectedD.toLocaleDateString("en-US", { weekday: "long" });
  const dayMeal = appState.meals && appState.meals[weekdayName];
  const dinner = dayMeal && dayMeal.dinner && dayMeal.dinner.trim();

  // Cards Stack Container
  const stack = document.createElement("div");
  stack.className = "daily-events-stack";

  // 1. Dinner Card (matches "Lasagna / For Dinner" in screenshot)
  if (dinner) {
    const mealCard = document.createElement("div");
    mealCard.className = "daily-schedule-card meal-dinner-card";
    mealCard.title = "Tap to open Meal Planner";
    mealCard.innerHTML = `
      <div class="daily-card-title">${dinner}</div>
      <div class="daily-card-subtitle">🍽️ For Dinner</div>
    `;
    mealCard.onclick = () => switchNav("meals");
    stack.appendChild(mealCard);
  }

  // 2. Day's Events
  const dayEvents = (events || [])
    .filter(e => isEventOnDate(e, appState.selectedDailyDate))
    .sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"));

  if (dayEvents.length === 0 && !dinner) {
    stack.innerHTML = `
      <div class="daily-no-events">
        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📅</div>
        <div style="font-weight: 700; font-size: 1.15rem; color: var(--text-primary);">No events scheduled for ${dateFormatted}</div>
        <div style="font-size: 0.88rem; color: var(--text-muted); margin: 6px 0 18px;">Enjoy family downtime or schedule activities!</div>
        <button type="button" class="btn-hub primary mini-btn" onclick="openNewEventForDate('${appState.selectedDailyDate}')">+ Schedule Event</button>
      </div>
    `;
  } else {
    for (const ev of dayEvents) {
      const m = getMember(ev.memberId);
      const color = m ? m.color : "#0284c7";
      const avatar = m ? m.avatar : "👤";
      const name = m ? m.name : "Entire Family";
      const timeDisplay = formatEventDisplayTime(ev.time, ev.endTime);
      const isRepeating = ev.repeat && ev.repeat !== "none";
      const repeatTag = isRepeating ? `<span style="font-size: 0.72rem; color: var(--text-muted); margin-left: 4px;">🔁 ${ev.repeat}</span>` : "";

      const evCard = document.createElement("div");
      evCard.className = "daily-schedule-card";
      evCard.style.backgroundColor = `${color}1f`; // soft pastel tint
      evCard.style.borderLeft = `6px solid ${color}`;
      evCard.title = `Click to edit ${ev.title}${isRepeating ? ' (Repeats ' + ev.repeat + ')' : ''}`;

      evCard.innerHTML = `
        <div class="daily-card-title">${ev.title}</div>
        <div class="daily-card-subtitle">
          <span class="daily-card-time">${timeDisplay}</span>
          <span class="daily-card-member" style="color: ${color};">
            <span>${avatar}</span>
            <span>${name}</span>
          </span>
          ${repeatTag}
          ${ev.location ? `<span class="daily-card-location">📍 ${ev.location}</span>` : ""}
        </div>
      `;
      evCard.onclick = () => openEventDetail(ev);
      stack.appendChild(evCard);
    }
  }

  rightPane.appendChild(stack);
  layout.appendChild(rightPane);
  mount.appendChild(layout);
}

function renderDayView(mount, titleLabel, events, daysCount = 1) {
  mount.className = daysCount === 1 ? "calendar-grid" : "calendar-grid three-day-grid";
  const start = new Date();
  start.setDate(start.getDate() + appState.currentDateOffset * daysCount);

  if (titleLabel) {
    if (daysCount === 1) {
      titleLabel.textContent = start.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    } else {
      const end = new Date(start);
      end.setDate(start.getDate() + 2);
      titleLabel.textContent = `${start.toLocaleDateString([], { month: "short", day: "numeric" })} - ${end.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`;
    }
  }

  for (let i = 0; i < daysCount; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateIso = d.toISOString().split("T")[0];
    const isToday = dateIso === new Date().toISOString().split("T")[0];

    const col = document.createElement("div");
    col.className = `week-col ${isToday ? "today" : ""}`;
    col.innerHTML = `
      <div class="week-col-header">
        <div class="week-col-day">${d.toLocaleDateString([], { weekday: "long" })}</div>
        <div class="week-col-num">${d.toLocaleDateString([], { month: "short", day: "numeric" })}</div>
      </div>
      <div class="week-col-events" style="padding: 12px; gap: 10px;"></div>
    `;

    const container = col.querySelector(".week-col-events");
    const dayEvents = events
      .filter((e) => isEventOnDate(e, dateIso))
      .sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"));

    if (dayEvents.length === 0) {
      container.innerHTML = `<div style="color: var(--text-dim); text-align: center; margin-top: 3rem;">No events scheduled ✨</div>`;
    } else {
      for (const ev of dayEvents) {
        container.appendChild(createEventCard(ev, true));
      }
    }
    mount.appendChild(col);
  }
}

function renderMonthView(mount, titleLabel, events) {
  mount.className = "calendar-grid month-grid";
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + appState.currentDateOffset);

  if (titleLabel) {
    titleLabel.textContent = d.toLocaleDateString([], { month: "long", year: "numeric" });
  }

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (const day of days) {
    const h = document.createElement("div");
    h.className = "month-header-cell";
    h.textContent = day;
    mount.appendChild(h);
  }

  const year = d.getFullYear();
  const month = d.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const todayIso = new Date().toISOString().split("T")[0];

  // Empty leading cells
  for (let i = 0; i < firstDayIndex; i++) {
    const empty = document.createElement("div");
    empty.className = "month-cell";
    empty.style.opacity = "0.3";
    mount.appendChild(empty);
  }

  for (let day = 1; day <= totalDays; day++) {
    const cellDate = new Date(year, month, day);
    const dateIso = cellDate.toISOString().split("T")[0];
    const isToday = dateIso === todayIso;

    const cell = document.createElement("div");
    cell.className = `month-cell ${isToday ? "today" : ""}`;
    cell.innerHTML = `<span class="month-cell-num">${day}</span>`;

    const dayEvents = events.filter((e) => isEventOnDate(e, dateIso));
    for (const ev of dayEvents.slice(0, 3)) {
      const m = getMember(ev.memberId);
      const dot = document.createElement("div");
      dot.style.cssText = `font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; background: ${m.color}33; border-left: 3px solid ${m.color}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer;`;
      dot.textContent = `${ev.time || ""} ${ev.title}`;
      dot.onclick = () => openEventDetail(ev);
      cell.appendChild(dot);
    }
    if (dayEvents.length > 3) {
      const more = document.createElement("span");
      more.style.cssText = "font-size: 0.7rem; color: var(--text-dim); margin-top: auto;";
      more.textContent = `+${dayEvents.length - 3} more`;
      cell.appendChild(more);
    }
    mount.appendChild(cell);
  }
}

function renderScheduleListView(mount, titleLabel, events) {
  mount.className = "calendar-grid";
  if (titleLabel) titleLabel.textContent = "Comprehensive Schedule View";

  const listContainer = document.createElement("div");
  listContainer.className = "schedule-list";

  const sorted = [...events].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const groups = {};
  for (const e of sorted) {
    groups[e.date] = groups[e.date] || [];
    groups[e.date].push(e);
  }

  for (const [dt, evs] of Object.entries(groups)) {
    const dObj = new Date(dt + "T00:00:00");
    const grp = document.createElement("div");
    grp.className = "schedule-day-group";
    grp.innerHTML = `
      <div class="schedule-day-title">
        <span>📅</span>
        <span>${dObj.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;"></div>
    `;
    const box = grp.querySelector("div:last-child");
    for (const ev of evs) {
      box.appendChild(createEventCard(ev, true));
    }
    listContainer.appendChild(grp);
  }

  mount.appendChild(listContainer);
}

function createEventCard(ev, detailed = false) {
  const m = getMember(ev.memberId);
  const card = document.createElement("div");
  card.className = "event-card";
  card.style.borderLeftColor = m.color;
  const isRepeating = ev.repeat && ev.repeat !== "none";
  const repeatIcon = isRepeating ? `<span title="Repeats ${ev.repeat}" style="font-size: 0.75rem; opacity: 0.9; margin-right: 2px;">🔁</span>` : "";
  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <span class="event-card-time">${ev.time || "All Day"}${ev.endTime ? " - " + ev.endTime : ""}</span>
      <div style="display: flex; align-items: center; gap: 4px;">
        ${repeatIcon}
        <span style="font-size: 0.85rem;" title="${m.name}">${m.avatar || "👤"}</span>
      </div>
    </div>
    <div class="event-card-title">${ev.title}</div>
    ${ev.location ? `<div class="event-card-loc">📍 ${ev.location}</div>` : ""}
    ${detailed && ev.notes ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">📝 ${ev.notes}</div>` : ""}
  `;
  card.onclick = () => openEventDetail(ev);
  return card;
}

function openEventDetail(ev) {
  if (!ev) return;

  const titleEl = document.getElementById("modal-event-title");
  if (titleEl) titleEl.textContent = "✏️ Edit Calendar Event";

  const idInput = document.getElementById("ev-id");
  if (idInput) idInput.value = ev.id || "";

  const titleInput = document.getElementById("ev-title");
  if (titleInput) titleInput.value = ev.title || "";

  const dateInput = document.getElementById("ev-date");
  if (dateInput) dateInput.value = ev.date || "";

  const timeInput = document.getElementById("ev-time");
  if (timeInput) timeInput.value = ev.time && ev.time !== "All Day" ? ev.time : "09:00";

  const endTimeInput = document.getElementById("ev-end-time");
  if (endTimeInput) endTimeInput.value = ev.endTime && ev.endTime !== "All Day" ? ev.endTime : "10:00";

  const repInput = document.getElementById("ev-repeat");
  if (repInput) repInput.value = ev.repeat || "none";

  const untilInput = document.getElementById("ev-repeat-until");
  if (untilInput) untilInput.value = ev.repeatUntil || "";

  toggleRepeatUntilVisibility();

  populateSelectDropdowns();
  const memberSel = document.getElementById("ev-member");
  if (memberSel && ev.memberId) memberSel.value = ev.memberId;

  const locInput = document.getElementById("ev-loc");
  if (locInput) locInput.value = ev.location || "";

  const notesInput = document.getElementById("ev-notes");
  if (notesInput) notesInput.value = ev.notes || "";

  const banner = document.getElementById("ev-synced-banner");
  if (banner) {
    if (ev.isSynced || ev.feedId) {
      banner.style.display = "block";
      banner.textContent = `📅 Synced Calendar Event (${ev.category || "External Calendar"})`;
    } else {
      banner.style.display = "none";
    }
  }

  const btnDel = document.getElementById("ev-btn-delete");
  if (btnDel) btnDel.style.display = "inline-block";

  const btnSub = document.getElementById("ev-btn-submit");
  if (btnSub) btnSub.textContent = "Update Event";

  openModal("modal-event");
}

function getCurrentRoutinePeriod() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";    // Midnight - Noon: Morning
  if (hour < 18) return "afternoon";  // Noon - 6pm: Afternoon
  return "evening";                   // 6pm - Midnight: Evening
}

function setRoutinesPeriod(period) {
  appState.routinesPeriod = period;
  document.querySelectorAll(".routines-period-selector .period-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-period") === period);
  });
  renderChores();
}

function getChoreSubcategory(chore) {
  const f = (chore.frequency || "Daily").toLowerCase();
  if (f.includes("week")) return "Weekly";
  if (f.includes("need") || f.includes("one") || f.includes("time")) return "As Needed";
  const tod = (chore.timeOfDay || "morning").toLowerCase();
  if (tod.includes("afternoon")) return "afternoon";
  if (tod.includes("evening") || tod.includes("night")) return "evening";
  return "morning";
}

function isChoreActiveToday(chore) {
  if (!chore.daysOfWeek || chore.daysOfWeek.length === 0) return true;
  const todayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()];
  return chore.daysOfWeek.includes(todayShort);
}

function setChoreType(type) {
  const isRoutine = type === "routine";
  const btnR = document.getElementById("type-btn-routine");
  const btnC = document.getElementById("type-btn-chore");
  const isREl = document.getElementById("ch-is-routine");
  const pGroup = document.getElementById("routine-period-group");
  const dGroup = document.getElementById("routine-days-group");
  const lblTitle = document.getElementById("lbl-chore-title");
  const subBtn = document.getElementById("ch-btn-submit");

  if (btnR) btnR.classList.toggle("active", isRoutine);
  if (btnC) btnC.classList.toggle("active", !isRoutine);
  if (isREl) isREl.value = isRoutine ? "true" : "false";
  if (pGroup) pGroup.style.display = isRoutine ? "block" : "none";
  if (dGroup) dGroup.style.display = isRoutine ? "block" : "none";
  if (lblTitle) lblTitle.textContent = isRoutine ? "Routine Title" : "Chore Title";
  if (subBtn && !document.getElementById("ch-id").value) {
    subBtn.textContent = isRoutine ? "Save Routine" : "Add Chore";
  }

  const freqSel = document.getElementById("ch-freq");
  if (freqSel) {
    freqSel.value = isRoutine ? "Daily" : "Weekly";
  }
}

function selectChoreEmoji(emoji) {
  const el = document.getElementById("ch-icon");
  if (el) el.value = emoji;
}

function setChorePoints(pts) {
  const el = document.getElementById("ch-points");
  if (el) el.value = pts;
}

function selectRoutineTimeOfDay(period) {
  const input = document.getElementById("ch-time-of-day");
  if (input) input.value = period;
  document.querySelectorAll(".routine-period-chips .period-chip").forEach((chip) => {
    chip.classList.toggle("active", chip.id === `chip-time-${period}`);
  });
}

function handleChoreFreqChange() {
  const freq = document.getElementById("ch-freq").value;
  const dGroup = document.getElementById("routine-days-group");
  if (dGroup) {
    dGroup.style.display = freq === "As Needed" ? "none" : "block";
  }
}

function toggleRoutineDay(btn) {
  btn.classList.toggle("active");
}

function getSelectedRoutineDays() {
  const days = [];
  document.querySelectorAll(".days-pill-picker .day-chip.active").forEach((btn) => {
    days.push(btn.getAttribute("data-day"));
  });
  return days;
}

function setSelectedRoutineDays(daysList) {
  const set = new Set(daysList || ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  document.querySelectorAll(".days-pill-picker .day-chip").forEach((btn) => {
    const day = btn.getAttribute("data-day");
    btn.classList.toggle("active", set.has(day));
  });
}

function getChoreFrequencyCategory(freq) {
  if (!freq) return "Daily";
  const f = freq.toLowerCase();
  if (f.includes("week")) return "Weekly";
  if (f.includes("need") || f.includes("one") || f.includes("time")) return "As Needed";
  return "Daily";
}

function openNewChoreForMember(memberId) {
  openNewChoreModal(memberId);
}

// ---------------------------------------------------------------------------
// 2. Interactive Chore & Routines Tracker with Confetti Rewards
// ---------------------------------------------------------------------------
function renderChores() {
  const grid = document.getElementById("chores-grid");
  const lb = document.getElementById("chores-leaderboard");
  if (!grid) return;
  grid.innerHTML = "";
  if (lb) lb.innerHTML = "";

  // 1. Render Leaderboard
  const sortedMembers = [...appState.members].sort((a, b) => (b.points || 0) - (a.points || 0));
  for (const m of sortedMembers) {
    if (m.id === "m5") continue;
    const card = document.createElement("div");
    card.className = "chores-leaderboard-card";
    card.style.borderLeft = `4px solid ${m.color || "#0284c7"}`;
    card.title = `Click to edit ${m.name}'s points`;
    card.innerHTML = `
      <span style="font-size: 2rem;">${m.avatar}</span>
      <div style="flex: 1;">
        <div style="font-weight: 700; font-size: 1rem;">${m.name}</div>
        <div style="color: var(--accent-gold); font-weight: 800; font-size: 1.1rem; display: flex; align-items: center; gap: 4px;">
          <span>${m.points || 0} ⭐</span>
          <span style="font-size: 0.72rem; color: var(--text-muted); opacity: 0.8;">✏️</span>
        </div>
      </div>
    `;
    card.onclick = () => openEditPointsModal(m.id);
    lb.appendChild(card);
  }

  // 2. Routines Period & Time of Day Management
  const curPeriod = getCurrentRoutinePeriod(); // morning, afternoon, evening
  const curPeriodTitle = curPeriod.charAt(0).toUpperCase() + curPeriod.slice(1);
  const activePeriod = (appState.routinesPeriod === "auto" || !appState.routinesPeriod) ? curPeriod : appState.routinesPeriod;

  // Update banner text & auto button pill
  const bannerText = document.getElementById("routines-current-time-text");
  const autoText = document.getElementById("auto-period-text");
  if (autoText) autoText.textContent = curPeriodTitle;
  if (bannerText) {
    if (appState.routinesPeriod === "auto" || !appState.routinesPeriod) {
      bannerText.innerHTML = `Current Time: <strong>${curPeriodTitle}</strong> (Auto-displaying ${curPeriodTitle} Routines)`;
    } else if (appState.routinesPeriod === "all") {
      bannerText.innerHTML = `Displaying: <strong>All Routines</strong> across the day`;
    } else {
      const pTitle = appState.routinesPeriod.charAt(0).toUpperCase() + appState.routinesPeriod.slice(1);
      bannerText.innerHTML = `Manual Filter: <strong>${pTitle} Routines</strong> (Tap Auto to auto-switch by time of day)`;
    }
  }

  // Highlight active period pill
  document.querySelectorAll(".routines-period-selector .period-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-period") === (appState.routinesPeriod || "auto"));
  });

  // Define subcategories according to activePeriod
  let subcats = [];
  if (activePeriod === "all") {
    subcats = [
      { key: "morning", label: "Morning Routines", icon: "🌅" },
      { key: "afternoon", label: "Afternoon Routines", icon: "☀️" },
      { key: "evening", label: "Evening Routines", icon: "🌙" },
      { key: "Weekly", label: "Weekly Tasks", icon: "📅" },
      { key: "As Needed", label: "As Needed / One-Time", icon: "⚡" },
    ];
  } else if (activePeriod === "morning") {
    subcats = [
      { key: "morning", label: "Morning Routines (Midnight - Noon)", icon: "🌅" },
      { key: "Weekly", label: "Weekly Tasks", icon: "📅" },
      { key: "As Needed", label: "As Needed / One-Time", icon: "⚡" },
    ];
  } else if (activePeriod === "afternoon") {
    subcats = [
      { key: "afternoon", label: "Afternoon Routines (Noon - 6 PM)", icon: "☀️" },
      { key: "Weekly", label: "Weekly Tasks", icon: "📅" },
      { key: "As Needed", label: "As Needed / One-Time", icon: "⚡" },
    ];
  } else if (activePeriod === "evening") {
    subcats = [
      { key: "evening", label: "Evening Routines (6 PM - Midnight)", icon: "🌙" },
      { key: "Weekly", label: "Weekly Tasks", icon: "📅" },
      { key: "As Needed", label: "As Needed / One-Time", icon: "⚡" },
    ];
  }

  // 3. Identify assigned family members to display (e.g. 4 members side-by-side)
  let membersToDisplay = appState.activeMemberFilter === "all"
    ? [...appState.members]
    : appState.members.filter((m) => m.id === appState.activeMemberFilter);

  if (membersToDisplay.length === 0) {
    grid.innerHTML = `<div style="text-align: center; padding: 3rem; color: var(--text-muted); width: 100%;">No family members found. Add profiles in Settings!</div>`;
    return;
  }

  // On mobile phone screens (<= 768px), stack 1 column for thumb-friendly mobile reading
  if (window.innerWidth <= 768) {
    grid.style.gridTemplateColumns = "1fr";
    lb.style.gridTemplateColumns = "repeat(2, 1fr)";
  } else if (membersToDisplay.length === 4) {
    grid.style.gridTemplateColumns = "repeat(4, minmax(0, 1fr))";
    lb.style.gridTemplateColumns = "repeat(4, minmax(0, 1fr))";
  } else if (membersToDisplay.length === 1) {
    grid.style.gridTemplateColumns = "minmax(0, 640px)";
    lb.style.gridTemplateColumns = "minmax(0, 320px)";
  } else {
    grid.style.gridTemplateColumns = `repeat(${Math.min(membersToDisplay.length, 4)}, minmax(0, 1fr))`;
    lb.style.gridTemplateColumns = `repeat(${Math.min(membersToDisplay.length, 4)}, minmax(0, 1fr))`;
  }

  for (const member of membersToDisplay) {
    // Show each member's personal chores + shared family chores with 🏡 badge
    const memberChores = (appState.chores || []).filter((c) => {
      return c.memberId === member.id || c.memberId === "all";
    });
    const completedCount = memberChores.filter((c) => c.completed).length;
    const totalCount = memberChores.length;

    const col = document.createElement("div");
    col.className = "member-tasks-column";
    col.style.borderTop = `4px solid ${member.color || "#0284c7"}`;

    col.innerHTML = `
      <div class="member-tasks-header">
        <div class="member-tasks-info">
          <span class="member-tasks-avatar">${member.avatar || "👤"}</span>
          <div>
            <div class="member-tasks-name">${member.name}</div>
            <div class="member-tasks-progress">
              <span>${completedCount}/${totalCount} completed</span>
              ${member.id !== "all" ? `<span class="member-points-pill" onclick="openEditPointsModal('${member.id}')" title="Edit points">${member.points || 0} ⭐</span>` : ""}
            </div>
          </div>
        </div>
        <div style="display: flex; gap: 4px; align-items: center;">
          <button type="button" class="btn-hub ghost mini-btn" onclick="openPresetRoutinesModal('${member.id}')" title="Pre-set age routines for ${member.name}">✨ Presets</button>
          <button type="button" class="btn-hub ghost mini-btn" onclick="openNewChoreForMember('${member.id}')" title="Add task for ${member.name}">+ Task</button>
        </div>
      </div>
      <div class="member-subcategories-container"></div>
    `;

    const subcatsContainer = col.querySelector(".member-subcategories-container");

    for (const sub of subcats) {
      const choresInSub = memberChores.filter(
        (c) => getChoreSubcategory(c) === sub.key && isChoreActiveToday(c)
      );

      const subGroup = document.createElement("div");
      subGroup.className = "chore-subcategory-group";
      subGroup.innerHTML = `
        <div class="chore-subcategory-title">
          <span>${sub.icon} ${sub.label}</span>
          <span class="subcategory-badge">${choresInSub.filter(c => !c.completed).length} left</span>
        </div>
        <div class="chore-subcategory-list"></div>
      `;

      const listContainer = subGroup.querySelector(".chore-subcategory-list");

      if (choresInSub.length === 0) {
        listContainer.innerHTML = `
          <div class="chore-empty-sub">
            <span>No ${sub.label.toLowerCase()} today</span>
          </div>
        `;
      } else {
        for (const chore of choresInSub) {
          const isShared = chore.memberId === "all" && member.id !== "all";
          const assignedMember = (chore.memberId && chore.memberId !== "all") ? getMember(chore.memberId) : member;
          const memberColor = isShared ? "#0284c7" : (assignedMember.color || member.color || "#0284c7");
          const memberAvatar = assignedMember.avatar || member.avatar || "👤";
          const memberName = assignedMember.name || member.name || "Member";

          const card = document.createElement("div");
          card.className = `chore-card ${chore.completed ? "done" : ""}`;
          card.style.borderLeft = `5px solid ${memberColor}`;
          if (!chore.completed) {
            card.style.background = `linear-gradient(90deg, ${memberColor}15 0%, var(--bg-surface) 45%)`;
          } else {
            card.style.borderLeftColor = `${memberColor}80`;
          }

          card.innerHTML = `
            <div class="chore-left">
              <div class="chore-checkbox" title="Tap to mark complete" style="border-color: ${memberColor}; ${chore.completed ? `background-color: ${memberColor}; border-color: ${memberColor};` : ''}">${chore.completed ? "✓" : ""}</div>
              ${chore.icon ? `<span class="chore-emoji" title="${chore.title}">${chore.icon}</span>` : ""}
              <div class="chore-info" title="Tap to edit task">
                <h3>${chore.title}</h3>
                <div class="chore-meta">
                  <span class="chore-member-tag" style="background: ${memberColor}18; color: ${memberColor}; border: 1px solid ${memberColor}35;">
                    ${isShared ? "🏡 Shared" : `${memberAvatar} ${memberName}`}
                  </span>
                  ${chore.isRoutine && chore.timeOfDay ? `<span class="routine-time-badge">${chore.timeOfDay}</span>` : ""}
                  ${chore.repeat && chore.repeat !== "none" ? `<span title="Repeats ${chore.repeat}" style="font-size: 0.72rem; opacity: 0.85;">🔁 ${chore.repeat}</span>` : ""}
                </div>
              </div>
            </div>
            <div class="chore-card-actions">
              <div class="chore-points" style="background: ${memberColor}18; color: ${memberColor}; border: 1px solid ${memberColor}35;">+${chore.points} ⭐</div>
              <button type="button" class="btn-chore-edit" title="Edit or delete task">✏️</button>
            </div>
          `;

          const chk = card.querySelector(".chore-checkbox");
          chk.onclick = async (e) => {
            e.stopPropagation();
            try {
              const res = await fetch(`/api/chores/${chore.id}/toggle`, { method: "POST" });
              const data = await res.json();
              chore.completed = data.chore.completed;
              if (data.reward) {
                triggerRewardConfetti(data.reward);
              }
              await loadState();
            } catch (err) {
              console.error("Failed to toggle chore:", err);
            }
          };

          const editBtn = card.querySelector(".btn-chore-edit");
          editBtn.onclick = (e) => {
            e.stopPropagation();
            openEditChoreModal(chore.id);
          };

          const choreInfo = card.querySelector(".chore-info");
          choreInfo.onclick = (e) => {
            e.stopPropagation();
            openEditChoreModal(chore.id);
          };

          listContainer.appendChild(card);
        }
      }

      subcatsContainer.appendChild(subGroup);
    }

    grid.appendChild(col);
  }
}

function triggerRewardConfetti(reward) {
  // Fire Canvas Confetti
  if (window.confetti) {
    window.confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
      colors: ["#fbbf24", "#38bdf8", "#34d399", "#f43f5e", "#a855f7"],
    });
  }

  const modal = document.getElementById("reward-modal");
  const av = document.getElementById("reward-avatar");
  const tit = document.getElementById("reward-title");
  const pts = document.getElementById("reward-points");
  const tot = document.getElementById("reward-total");

  if (av) av.textContent = reward.avatar || "🎉";
  if (tit) tit.textContent = `Great Job, ${reward.member}!`;
  if (pts) pts.textContent = `+${reward.points} PTS`;
  if (tot) tot.textContent = `Total Points: ${reward.total} ⭐`;

  if (modal) modal.classList.remove("hidden");

  // Auto close after 3.5s
  setTimeout(closeReward, 3500);
}

function closeReward() {
  const modal = document.getElementById("reward-modal");
  if (modal) modal.classList.add("hidden");
}

function showToast(message) {
  let toast = document.getElementById("hub-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "hub-toast";
    toast.style.cssText = "position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: #1e293b; color: #f8fafc; padding: 10px 20px; border-radius: 30px; font-weight: 600; font-size: 0.9rem; z-index: 10000; box-shadow: 0 4px 16px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); transition: opacity 0.3s ease; opacity: 0; pointer-events: none;";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = "1";
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.opacity = "0";
  }, 3200);
}

// ---------------------------------------------------------------------------
// 2.5 Rewards & Star Goals Hub
// ---------------------------------------------------------------------------
function setRewardsFilter(filterKey) {
  appState.activeRewardsFilter = filterKey;
  document.querySelectorAll(".rewards-filter-pills .filter-pill").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-reward-filter") === filterKey);
  });
  renderRewards();
}

function renderRewards() {
  const grid = document.getElementById("rewards-grid");
  const lb = document.getElementById("rewards-leaderboard");
  if (!grid) return;
  grid.innerHTML = "";
  if (lb) lb.innerHTML = "";

  const rewards = appState.rewards || [];
  const excluded = (appState.settings && Array.isArray(appState.settings.excludedRewardMemberIds))
    ? appState.settings.excludedRewardMemberIds
    : [];

  // Update excluded summary pill on Rewards screen
  const summaryEl = document.getElementById("rewards-excluded-summary");
  if (summaryEl) {
    if (excluded.length > 0) {
      const excludedNames = appState.members
        .filter((m) => excluded.includes(m.id))
        .map((m) => m.name)
        .join(", ");
      summaryEl.innerHTML = `<span>👥 Excluded: <strong>${excludedNames}</strong> (${excluded.length})</span> <span style="text-decoration: underline; opacity: 0.85;">• Edit</span>`;
      summaryEl.style.display = "flex";
    } else {
      summaryEl.innerHTML = `<span>👥 All members active</span> <span style="text-decoration: underline; opacity: 0.85;">• Edit</span>`;
      summaryEl.style.display = "flex";
    }
  }

  // 1. Render Family Star Balance Leaderboard Cards (participating members only)
  const sortedMembers = [...appState.members].sort((a, b) => (b.points || 0) - (a.points || 0));
  for (const m of sortedMembers) {
    if (m.id === "m5" || excluded.includes(m.id)) continue;
    const card = document.createElement("div");
    card.className = "chores-leaderboard-card";
    card.style.borderLeft = `4px solid ${m.color || "#0284c7"}`;
    card.title = `Click to give or remove stars for ${m.name}`;
    card.innerHTML = `
      <span style="font-size: 2rem;">${m.avatar || "👤"}</span>
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 700; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${m.name}</div>
        <div style="color: var(--accent-gold); font-weight: 800; font-size: 1.1rem; display: flex; align-items: center; gap: 4px;">
          <span>${m.points || 0} ⭐</span>
          <span style="font-size: 0.72rem; color: var(--text-muted); opacity: 0.8;" title="Adjust stars">✏️</span>
        </div>
      </div>
    `;
    card.onclick = () => openEditPointsModal(m.id);
    lb.appendChild(card);
  }

  // Count ready to redeem for participating members
  let readyCount = 0;
  for (const m of appState.members) {
    if (m.id === "m5" || excluded.includes(m.id)) continue;
    for (const r of rewards) {
      if (r.memberId === "all" || r.memberId === m.id) {
        if ((m.points || 0) >= (r.starCost || 0) && !r.completed) {
          readyCount++;
        }
      }
    }
  }
  const badgeReady = document.getElementById("ready-rewards-count");
  if (badgeReady) badgeReady.textContent = readyCount;

  // 2. Identify assigned family members to display (dynamically sized columns side-by-side)
  const participatingMembers = appState.members.filter((m) => m.id !== "m5" && !excluded.includes(m.id));
  let membersToDisplay = appState.activeMemberFilter === "all"
    ? participatingMembers
    : participatingMembers.filter((m) => m.id === appState.activeMemberFilter);

  if (membersToDisplay.length === 0) {
    grid.innerHTML = `
      <div style="text-align: center; padding: 3rem 1.5rem; color: var(--text-muted); width: 100%; grid-column: 1 / -1;">
        <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">⭐</div>
        <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.35rem;">No Participating Members on Rewards Screen</div>
        <p style="font-size: 0.85rem; max-width: 420px; margin: 0 auto 1.25rem; line-height: 1.45;">
          All family members are currently excluded from Rewards or filtered out. Tap below to choose who participates.
        </p>
        <button type="button" class="btn-hub primary" onclick="openRewardsMemberExclusionModal()">Configure Participation</button>
      </div>
    `;
    return;
  }

  if (window.innerWidth <= 768) {
    grid.style.gridTemplateColumns = "1fr";
  } else {
    // Dynamic column allocation: 2 kids = 2 wide columns side by side, 3 kids = 3 columns, etc.
    grid.style.gridTemplateColumns = `repeat(${Math.max(1, membersToDisplay.length)}, minmax(0, 1fr))`;
  }

  for (const member of membersToDisplay) {
    const col = document.createElement("div");
    col.className = "member-tasks-column";
    col.style.borderTop = `4px solid ${member.color || "var(--primary)"}`;

    // Goals for this member (assigned to member OR assigned to all)
    let memberGoals = rewards.filter((r) => r.memberId === "all" || r.memberId === member.id);

    // Apply Filter (all, ready, inprogress)
    if (appState.activeRewardsFilter === "ready") {
      memberGoals = memberGoals.filter((r) => (member.points || 0) >= (r.starCost || 0) && !r.completed);
    } else if (appState.activeRewardsFilter === "inprogress") {
      memberGoals = memberGoals.filter((r) => (member.points || 0) < (r.starCost || 0) && !r.completed);
    }

    col.innerHTML = `
      <div class="member-tasks-header">
        <div class="member-tasks-info">
          <span class="member-tasks-avatar">${member.avatar || "👤"}</span>
          <div>
            <div class="member-tasks-name">${member.name}</div>
            <div class="member-tasks-progress">
              <span class="member-points-pill" onclick="openEditPointsModal('${member.id}')" title="Adjust stars">${member.points || 0} ⭐ balance</span>
            </div>
          </div>
        </div>
        <button type="button" class="btn-hub ghost mini-btn" onclick="openNewRewardForMember('${member.id}')" title="Add goal for ${member.name}">+ Goal</button>
      </div>
      <div class="member-subcategories-container" id="reward-list-${member.id}" style="gap: 8px;"></div>
    `;

    const listContainer = col.querySelector(`#reward-list-${member.id}`);

    if (memberGoals.length === 0) {
      listContainer.innerHTML = `
        <div class="chore-empty-sub" style="padding: 1.25rem 0.5rem;">
          <span>No reward goals ${appState.activeRewardsFilter === "all" ? "yet" : "matching filter"}</span>
        </div>
      `;
    } else {
      for (const reward of memberGoals) {
        const currentStars = member.points || 0;
        const starCost = reward.starCost || 50;
        const isReady = currentStars >= starCost && !reward.completed;
        const pct = Math.min(100, Math.round((currentStars / starCost) * 100));
        const needed = Math.max(0, starCost - currentStars);
        const isShared = reward.memberId === "all";
        const assignedMember = (reward.memberId && reward.memberId !== "all") ? getMember(reward.memberId) : member;
        const memberColor = isShared ? "#0284c7" : (assignedMember.color || member.color || "#0284c7");
        const memberAvatar = assignedMember.avatar || member.avatar || "👤";
        const memberName = assignedMember.name || member.name || "Member";

        const card = document.createElement("div");
        card.className = `reward-goal-card ${isReady ? "ready-to-redeem" : ""}`;
        card.style.borderLeft = `5px solid ${memberColor}`;
        if (!isReady) {
          card.style.background = `linear-gradient(90deg, ${memberColor}15 0%, var(--bg-surface) 45%)`;
        }
        card.innerHTML = `
          <div class="reward-goal-header">
            <div class="reward-goal-info">
              <span class="reward-goal-icon">${reward.icon || "🎁"}</span>
              <div class="reward-goal-titles">
                <div class="reward-goal-title">${reward.title}</div>
                ${reward.description ? `<div class="reward-goal-desc">${reward.description}</div>` : ""}
                <div class="chore-meta" style="margin-top: 3px;">
                  <span class="chore-member-tag" style="background: ${memberColor}18; color: ${memberColor}; border: 1px solid ${memberColor}35;">
                    ${isShared ? "🏡 Shared Goal" : `${memberAvatar} ${memberName}`}
                  </span>
                </div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
              <span class="reward-cost-badge" style="background: ${memberColor}18; color: ${memberColor}; border: 1px solid ${memberColor}35;">${starCost} ⭐</span>
              <button type="button" class="btn-chore-edit" onclick="openEditRewardModal('${reward.id}')" title="Edit goal">✏️</button>
            </div>
          </div>

          <!-- Visual Progress Bar -->
          <div style="display: flex; flex-direction: column; gap: 3px;">
            <div class="reward-progress-track">
              <div class="reward-progress-fill" style="width: ${pct}%; background: ${isReady ? 'linear-gradient(90deg, #10b981, #34d399)' : `linear-gradient(90deg, ${memberColor}, #f59e0b)`};"></div>
            </div>
            <div class="reward-progress-labels">
              <span>${currentStars} / ${starCost} ⭐</span>
              <span>${pct}%</span>
            </div>
          </div>

          <!-- Redeem Button / Status -->
          ${
            isReady
              ? `<button type="button" class="btn-redeem active" onclick="confirmRedeemReward('${reward.id}', '${member.id}')">
                   <span>⭐</span> REDEEM REWARD!
                 </button>`
              : `<button type="button" class="btn-redeem locked" disabled>
                   <span>🔒</span> Need ${needed} more ⭐
                 </button>`
          }
        `;
        listContainer.appendChild(card);
      }
    }

    grid.appendChild(col);
  }
}

function openNewRewardModal(preferredMemberId) {
  document.getElementById("modal-reward-title").textContent = "+ Add Reward Goal";
  document.getElementById("reward-id").value = "";
  document.getElementById("reward-title").value = "";
  document.getElementById("reward-icon").value = "🍦";
  document.getElementById("reward-star-cost").value = 50;
  populateSelectDropdowns();
  const selMember = preferredMemberId || "all";
  renderMultiMemberPicker("reward-members-picker", [selMember], true);
  document.getElementById("reward-autorenew").checked = true;
  document.getElementById("reward-desc").value = "";
  const delBtn = document.getElementById("btn-delete-reward");
  if (delBtn) delBtn.style.display = "none";
  openModal("modal-reward");
}

function openNewRewardForMember(memberId) {
  openNewRewardModal(memberId);
}

function openEditRewardModal(rewardId) {
  const r = (appState.rewards || []).find((x) => x.id === rewardId);
  if (!r) return;
  document.getElementById("modal-reward-title").textContent = "Edit Reward Goal";
  document.getElementById("reward-id").value = r.id;
  document.getElementById("reward-title").value = r.title || "";
  document.getElementById("reward-icon").value = r.icon || "🎁";
  document.getElementById("reward-star-cost").value = r.starCost || 50;
  populateSelectDropdowns();
  renderMultiMemberPicker("reward-members-picker", [r.memberId || "all"], true);
  document.getElementById("reward-autorenew").checked = r.autoRenew !== false;
  document.getElementById("reward-desc").value = r.description || "";
  const delBtn = document.getElementById("btn-delete-reward");
  if (delBtn) delBtn.style.display = "inline-block";
  openModal("modal-reward");
}

function selectRewardIcon(icon) {
  const el = document.getElementById("reward-icon");
  if (el) el.value = icon;
}

function setRewardCost(cost) {
  const el = document.getElementById("reward-star-cost");
  if (el) el.value = cost;
}

async function saveReward(e) {
  e.preventDefault();
  const rewId = document.getElementById("reward-id").value;
  const title = document.getElementById("reward-title").value.trim();
  const icon = document.getElementById("reward-icon").value.trim() || "🎁";
  const starCost = parseInt(document.getElementById("reward-star-cost").value) || 50;
  const autoRenew = document.getElementById("reward-autorenew").checked;
  const description = document.getElementById("reward-desc").value.trim();
  const selectedMembers = getSelectedPickerMembers("reward-members-picker");

  if (!title) {
    showToast("Please enter a reward title");
    return;
  }

  try {
    if (rewId) {
      const memberId = selectedMembers[0] || "all";
      const payload = {
        title,
        icon,
        starCost,
        memberId,
        autoRenew,
        description,
        id: rewId
      };
      const res = await fetch(`/api/rewards/${rewId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const saved = await res.json();
      const idx = (appState.rewards || []).findIndex((x) => x.id === rewId);
      if (idx !== -1) appState.rewards[idx] = saved;
      showToast("Reward goal updated!");
    } else if (selectedMembers.length > 1) {
      const payloadList = selectedMembers.map((mId) => ({
        title,
        icon,
        starCost,
        memberId: mId,
        autoRenew,
        description
      }));
      const res = await fetch("/api/rewards/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadList)
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        appState.rewards = appState.rewards || [];
        appState.rewards.push(...data);
      } else if (data && Array.isArray(data.items)) {
        appState.rewards = appState.rewards || [];
        appState.rewards.push(...data.items);
      }
      showToast(`Created ${Array.isArray(data) ? data.length : (data.count || payloadList.length)} reward goals!`);
    } else {
      const memberId = selectedMembers[0] || "all";
      const payload = {
        title,
        icon,
        starCost,
        memberId,
        autoRenew,
        description
      };
      const res = await fetch("/api/rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const saved = await res.json();
      appState.rewards = appState.rewards || [];
      appState.rewards.push(saved);
      showToast("Reward goal saved!");
    }
    closeModal("modal-reward");
    await loadState();
  } catch (err) {
    console.error("Failed to save reward:", err);
    showToast("Error saving reward goal");
  }
}

async function deleteReward() {
  const rewId = document.getElementById("reward-id").value;
  if (!rewId) return;
  const confirmed = await showAppConfirm("Are you sure you want to delete this reward goal?", {
    title: "Delete Reward Goal?",
    confirmText: "Delete",
    isDanger: true,
    icon: "🗑️"
  });
  if (!confirmed) return;

  try {
    await fetch(`/api/rewards/${rewId}`, { method: "DELETE" });
    appState.rewards = (appState.rewards || []).filter((x) => x.id !== rewId);
    closeModal("modal-reward");
    renderRewards();
    showToast("Reward goal deleted");
  } catch (err) {
    console.error("Failed to delete reward:", err);
    showToast("Error deleting reward");
  }
}

async function confirmRedeemReward(rewardId, memberId) {
  const reward = (appState.rewards || []).find((x) => x.id === rewardId);
  const member = appState.members.find((x) => x.id === memberId);
  if (!reward || !member) return;

  const currentPts = member.points || 0;
  const newPts = Math.max(0, currentPts - reward.starCost);

  const confirmed = await showAppConfirm(
    `Redeem "${reward.title}" for ${member.name}? This will use ${reward.starCost} ⭐ from their star balance (${currentPts} ⭐ → ${newPts} ⭐).`,
    {
      title: `🎉 Redeem Reward?`,
      confirmText: `Redeem for ${reward.starCost} ⭐`,
      isDanger: false,
      icon: "⭐"
    }
  );
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/rewards/${rewardId}/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId })
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.detail || "Could not redeem reward");
      return;
    }
    const data = await res.json();
    member.points = data.member.points;
    if (data.reward && !data.reward.autoRenew) {
      const rIdx = (appState.rewards || []).findIndex((x) => x.id === rewardId);
      if (rIdx !== -1) appState.rewards[rIdx] = data.reward;
    }

    // Trigger celebratory confetti
    if (typeof confetti === "function") {
      confetti({
        particleCount: 160,
        spread: 90,
        origin: { y: 0.6 }
      });
    }

    renderRewards();
    if (appState.activeNav === "chores") renderChores();
    showToast(`🎉 ${member.name} redeemed "${reward.title}"!`);
  } catch (err) {
    console.error("Redemption failed:", err);
    showToast("Failed to redeem reward");
  }
}

async function openRedemptionHistoryModal() {
  const listEl = document.getElementById("redemptions-history-list");
  if (!listEl) return;
  listEl.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 1rem;">Loading history...</div>`;
  openModal("modal-redemptions");

  try {
    const res = await fetch("/api/reward-redemptions");
    const items = await res.json();
    if (!items || items.length === 0) {
      listEl.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No rewards redeemed yet. Keep completing chores to earn stars! ⭐</div>`;
      return;
    }
    listEl.innerHTML = "";
    for (const item of items) {
      const dateStr = item.redeemedAt ? new Date(item.redeemedAt).toLocaleDateString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
      const div = document.createElement("div");
      div.className = "redemption-history-item";
      div.innerHTML = `
        <div class="redemption-history-left">
          <span class="redemption-history-avatar">${item.memberAvatar || "👤"}</span>
          <div>
            <div class="redemption-history-title">${item.rewardIcon || "🎁"} ${item.rewardTitle}</div>
            <div class="redemption-history-meta">Redeemed by <strong>${item.memberName}</strong> • ${dateStr}</div>
          </div>
        </div>
        <div class="redemption-history-cost">-${item.starCost} ⭐</div>
      `;
      listEl.appendChild(div);
    }
  } catch (err) {
    listEl.innerHTML = `<div style="color: #ef4444; text-align: center; padding: 1rem;">Failed to load history</div>`;
  }
}

// ---------------------------------------------------------------------------
// Rewards Member Exclusion & Participation Management
// ---------------------------------------------------------------------------
function openRewardsMemberExclusionModal() {
  const container = document.getElementById("rewards-members-checklist");
  if (!container) return;
  container.innerHTML = "";

  const excluded = (appState.settings && Array.isArray(appState.settings.excludedRewardMemberIds))
    ? appState.settings.excludedRewardMemberIds
    : [];

  const eligibleMembers = appState.members.filter((m) => m.id !== "m5");
  if (eligibleMembers.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No family profiles found. Add members in Settings first!</div>`;
  } else {
    for (const m of eligibleMembers) {
      const isParticipating = !excluded.includes(m.id);
      const row = document.createElement("label");
      row.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: var(--bg-hover); border-radius: 8px; border: 1px solid var(--border-color); cursor: pointer; user-select: none; transition: background 0.15s ease;";
      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 1.6rem;">${m.avatar || "👤"}</span>
          <div>
            <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
              <span>${m.name}</span>
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${m.color || "#0284c7"};"></span>
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">${m.points || 0} ⭐ currently</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span class="participation-label" style="font-size: 0.8rem; font-weight: 700; color: ${isParticipating ? "var(--accent-green, #10b981)" : "var(--text-muted)"};">
            ${isParticipating ? "Participating" : "Excluded"}
          </span>
          <input type="checkbox" class="reward-member-checkbox" data-member-id="${m.id}" ${isParticipating ? "checked" : ""} style="width: 22px; height: 22px; accent-color: var(--primary); cursor: pointer;" onchange="
            const label = this.parentElement.querySelector('.participation-label');
            if (label) {
              label.textContent = this.checked ? 'Participating' : 'Excluded';
              label.style.color = this.checked ? 'var(--accent-green, #10b981)' : 'var(--text-muted)';
            }
          " />
        </div>
      `;
      container.appendChild(row);
    }
  }

  openModal("modal-rewards-members");
}

async function saveRewardsMemberExclusions() {
  const checkboxes = document.querySelectorAll(".reward-member-checkbox");
  const newExcluded = [];
  checkboxes.forEach((cb) => {
    if (!cb.checked) {
      newExcluded.push(cb.getAttribute("data-member-id"));
    }
  });

  if (!appState.settings) appState.settings = {};
  appState.settings.excludedRewardMemberIds = newExcluded;

  try {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(appState.settings),
    });
    if (!res.ok) throw new Error("Failed to save settings");
    const updated = await res.json();
    appState.settings = updated;
    closeModal("modal-rewards-members");
    populateSelectDropdowns();
    renderRewards();
    updateSettingsRewardsExclusionSummary();
    const participatingCount = appState.members.filter((m) => m.id !== "m5" && !newExcluded.includes(m.id)).length;
    showToast(`⭐ Rewards participation saved (${participatingCount} active, ${newExcluded.length} excluded)`);
  } catch (err) {
    console.error("Failed to save reward exclusions:", err);
    showToast("Error updating participation settings");
  }
}

function updateSettingsRewardsExclusionSummary() {
  const el = document.getElementById("settings-rewards-exclusion-summary");
  if (!el) return;
  const excluded = (appState.settings && Array.isArray(appState.settings.excludedRewardMemberIds))
    ? appState.settings.excludedRewardMemberIds
    : [];
  if (excluded.length > 0) {
    const names = appState.members.filter((m) => excluded.includes(m.id)).map((m) => m.name).join(", ");
    el.textContent = `Excluded: ${names} (${excluded.length} hidden from Rewards)`;
  } else {
    el.textContent = "All family members participate in Rewards";
  }
}

// ---------------------------------------------------------------------------
// 3. To-Do & Grocery Lists Engine
// ---------------------------------------------------------------------------
function renderLists() {
  const container = document.getElementById("lists-container");
  if (!container) return;
  container.innerHTML = "";

  for (const lst of appState.lists) {
    const col = document.createElement("div");
    col.className = "list-column";
    col.innerHTML = `
      <div class="list-header">
        <h3>${lst.title}</h3>
        <span style="font-size: 0.85rem; color: var(--text-dim);">${(lst.items || []).filter((i) => !i.checked).length} left</span>
      </div>
      <div class="list-items-box" id="list-items-${lst.id}"></div>
      <div class="list-input-box">
        <input type="text" placeholder="Add item (e.g. Milk, Bread)..." id="input-${lst.id}" style="flex: 1;" />
        <button class="btn-touch primary" onclick="addItemToList('${lst.id}')">Add</button>
      </div>
    `;

    const itemsBox = col.querySelector(".list-items-box");
    const input = col.querySelector(`#input-${lst.id}`);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addItemToList(lst.id);
    });

    for (const it of lst.items || []) {
      const row = document.createElement("div");
      row.className = `list-item-row ${it.checked ? "checked" : ""}`;
      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <input type="checkbox" ${it.checked ? "checked" : ""} style="width: 18px; height: 18px;" />
          <span style="font-size: 1rem; font-weight: 500;">${it.text}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          ${it.addedBy ? `<span style="font-size: 0.75rem; color: var(--text-dim);">${it.addedBy}</span>` : ""}
          <button style="background: none; border: none; color: var(--text-dim); cursor: pointer;" onclick="deleteListItem(event, '${lst.id}', '${it.id}')">✕</button>
        </div>
      `;
      row.onclick = async (e) => {
        if (e.target.tagName === "BUTTON") return;
        await fetch(`/api/lists/${lst.id}/items/${it.id}/toggle`, { method: "POST" });
        it.checked = !it.checked;
        renderLists();
      };
      itemsBox.appendChild(row);
    }

    container.appendChild(col);
  }
}

async function addItemToList(listId) {
  const input = document.getElementById(`input-${listId}`);
  if (!input || !input.value.trim()) return;
  const text = input.value.trim();
  input.value = "";

  const activeMem = appState.activeMemberFilter !== "all" ? getMember(appState.activeMemberFilter).name : "Kitchen Hub";

  await fetch(`/api/lists/${listId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, addedBy: activeMem }),
  });
  await loadState();
}

async function deleteListItem(e, listId, itemId) {
  e.stopPropagation();
  await fetch(`/api/lists/${listId}/items/${itemId}`, { method: "DELETE" });
  await loadState();
}

// ---------------------------------------------------------------------------
// 4. Meal Planner
// ---------------------------------------------------------------------------
function renderMeals() {
  const grid = document.getElementById("meals-grid-container");
  if (!grid) return;
  grid.innerHTML = "";

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  for (const day of days) {
    const meal = appState.meals[day] || { breakfast: "Eggs & toast", lunch: "Salad wrap", dinner: "Family Dinner" };
    const card = document.createElement("div");
    card.className = "meal-day-card";
    card.innerHTML = `
      <div class="meal-day-header">${day}</div>
      <div class="meal-slots">
        <div class="meal-slot" onclick="editMealPrompt('${day}', 'breakfast', '${meal.breakfast}')">
          <div class="meal-slot-label">🍳 Breakfast</div>
          <div class="meal-slot-content">${meal.breakfast}</div>
        </div>
        <div class="meal-slot" onclick="editMealPrompt('${day}', 'lunch', '${meal.lunch}')">
          <div class="meal-slot-label">🥪 Lunch</div>
          <div class="meal-slot-content">${meal.lunch}</div>
        </div>
        <div class="meal-slot" onclick="editMealPrompt('${day}', 'dinner', '${meal.dinner}')">
          <div class="meal-slot-label">🍲 Dinner</div>
          <div class="meal-slot-content">${meal.dinner}</div>
        </div>
      </div>
    `;
    grid.appendChild(card);
  }
}

async function editMealPrompt(day, mealType, currentVal) {
  const newVal = prompt(`Update ${day} ${mealType}:`, currentVal);
  if (newVal === null) return;
  const dayMeals = appState.meals[day] || { breakfast: "", lunch: "", dinner: "" };
  dayMeals[mealType] = newVal;
  
  await fetch("/api/meals", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ day, ...dayMeals }),
  });
  await loadState();
}

// ---------------------------------------------------------------------------
// 5. Digital Photo Frame Mode & Slideshow
// ---------------------------------------------------------------------------
function getActivePhotos() {
  if (appState.photos && appState.photos.length > 0) {
    return appState.photos.map((p) => ({
      url: p.url || `/api/photos/file/${p.filename}`,
      caption: p.caption || "Family Memory",
      source: p.source || "upload",
    }));
  }
  return FALLBACK_PHOTOS;
}

function updateSlideshowImage(imgId, captionId) {
  const photos = getActivePhotos();
  if (photos.length === 0) return;
  appState.slideshowIndex = (appState.slideshowIndex + 1) % photos.length;
  const current = photos[appState.slideshowIndex];

  const imgEl = document.getElementById(imgId);
  const capEl = document.getElementById(captionId);
  const bgId = imgId === "split-slideshow-img" ? "split-slideshow-bg" : (imgId === "full-slideshow-img" ? "full-slideshow-bg" : null);
  const bgEl = bgId ? document.getElementById(bgId) : null;

  if (imgEl) {
    imgEl.referrerPolicy = "no-referrer";
    imgEl.style.opacity = "0.2";
    if (bgEl) {
      bgEl.referrerPolicy = "no-referrer";
      bgEl.style.opacity = "0.2";
    }
    setTimeout(() => {
      imgEl.src = current.url;
      imgEl.style.opacity = "1";
      if (bgEl) {
        bgEl.src = current.url;
        bgEl.style.opacity = "0.85";
      }
    }, 400);
  }
  if (capEl) capEl.textContent = current.caption;

  const splitMetaEl = document.getElementById("split-slideshow-meta");
  if (splitMetaEl) {
    const isGPhotos = appState.settings && appState.settings.googlePhotosAlbumUrl;
    if (appState.slideshowPaused) {
      splitMetaEl.textContent = "⏸ Slideshow Paused • Tap photo to resume";
    } else if (isGPhotos) {
      splitMetaEl.textContent = `📸 Google Photos Album • ${photos.length} photos • Tap to pause`;
    } else {
      splitMetaEl.textContent = `📸 Rotating Photo Frame • ${photos.length} photos • Tap to pause`;
    }
  }

  const metaEl = document.getElementById("full-slideshow-meta");
  if (metaEl && appState.settings && appState.settings.googlePhotosAlbumUrl) {
    metaEl.textContent = `📸 Google Photos Album • ${appState.photos.length} photos rotating • Tap to pause`;
  }
}

function startPhotoSlideshow() {
  if (slideshowTimer) clearInterval(slideshowTimer);
  slideshowTimer = setInterval(() => {
    if (appState.slideshowPaused) return;
    if (appState.activeNav === "photo-frame") {
      updateSlideshowImage("full-slideshow-img", "full-slideshow-caption");
    } else if (appState.splitScreen && (appState.splitMode || "photos") === "photos") {
      updateSlideshowImage("split-slideshow-img", "split-slideshow-caption");
    }
  }, (appState.settings.slideshowIntervalSec || 8) * 1000);
}

function renderPhotoFrame() {
  updateSlideshowImage("full-slideshow-img", "full-slideshow-caption");
}

function triggerPhotoUpload() {
  const f = document.getElementById("photo-file-input");
  if (f) f.click();
}

async function handlePhotoUpload(input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  const cap = prompt("Enter photo caption (optional):", file.name.split(".")[0]);

  const form = new FormData();
  form.append("file", file);
  form.append("caption", cap || "");

  try {
    await fetch("/api/photos/upload", { method: "POST", body: form });
    await loadState();
    alert("Photo uploaded successfully! Added to your slideshow.");
  } catch (err) {
    alert("Photo upload error: " + err.message);
  }
}

// ---------------------------------------------------------------------------
// Google Photos Album Controller
// ---------------------------------------------------------------------------
function openGooglePhotosModal() {
  renderGooglePhotosModalStatus();
  openModal("modal-google-photos");
}

function renderGooglePhotosStatus() {
  const container = document.getElementById("settings-gphotos-status-card");
  const btnSyncTop = document.getElementById("btn-sync-gphotos-top");
  if (!container) return;

  const s = appState.settings || {};
  const albumUrl = s.googlePhotosAlbumUrl;
  const count = s.googlePhotosCount || 0;
  const lastSynced = s.googlePhotosLastSynced;

  if (albumUrl) {
    if (btnSyncTop) btnSyncTop.style.display = "inline-block";
    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(16, 185, 129, 0.08); border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.25);">
        <div>
          <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
            <span>📸</span> Connected Google Photos Album
          </div>
          <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 2px;">
            ${count} photos synced • Last updated: ${lastSynced || "Recently"}
          </div>
        </div>
        <div style="display: flex; gap: 6px;">
          <button type="button" class="btn-hub ghost" onclick="syncGooglePhotosAlbum()" style="font-size: 0.78rem; padding: 4px 10px;">🔄 Sync Now</button>
          <button type="button" class="btn-hub danger" onclick="disconnectGooglePhotosAlbum()" style="font-size: 0.78rem; padding: 4px 10px; background: #ef4444; color: white;">Disconnect</button>
        </div>
      </div>
    `;
  } else {
    if (btnSyncTop) btnSyncTop.style.display = "none";
    container.innerHTML = `
      <div style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">
        No Google Photos album connected yet. Paste your shared album link below to display your photos!
      </div>
    `;
  }
}

function renderGooglePhotosModalStatus() {
  const container = document.getElementById("modal-gphotos-active-card");
  if (!container) return;

  const s = appState.settings || {};
  const albumUrl = s.googlePhotosAlbumUrl;
  const count = s.googlePhotosCount || 0;
  const lastSynced = s.googlePhotosLastSynced;

  if (albumUrl) {
    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: rgba(16, 185, 129, 0.08); border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.25);">
        <div>
          <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">✅ Album Connected & Active</div>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">${count} photos rotating in slideshow • Synced: ${lastSynced || "Recently"}</div>
        </div>
        <div style="display: flex; gap: 6px;">
          <button type="button" class="btn-hub ghost" onclick="syncGooglePhotosAlbum()" style="padding: 5px 12px; font-size: 0.82rem;">🔄 Sync Now</button>
          <button type="button" class="btn-hub danger" onclick="disconnectGooglePhotosAlbum()" style="padding: 5px 12px; font-size: 0.82rem; background: #ef4444; color: white;">Disconnect</button>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = "";
  }
}

async function connectGooglePhotosAlbum() {
  const input = document.getElementById("set-gphotos-url");
  const statusEl = document.getElementById("set-gphotos-status");
  const btn = document.getElementById("btn-connect-gphotos");
  if (!input || !statusEl) return;

  const url = input.value.trim();
  if (!url) {
    statusEl.className = "live-status-card error";
    statusEl.style.display = "flex";
    statusEl.innerHTML = `<span>⚠️</span> <span>Please paste your Google Photos shared album link.</span>`;
    input.focus();
    return;
  }

  statusEl.className = "live-status-card loading";
  statusEl.style.display = "flex";
  statusEl.innerHTML = `<span>⏳</span> <span>Connecting to Google Photos and extracting album photos...</span>`;
  if (btn) btn.disabled = true;

  try {
    const res = await fetch("/api/photos/google-album/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (data.status === "ok") {
      statusEl.className = "live-status-card success";
      statusEl.innerHTML = `<span>✅</span> <span>${data.message}</span>`;
      input.value = "";
      await loadState();
      renderGooglePhotosStatus();
      if (appState.activeNav === "photo-frame") renderPhotoFrame();
    } else {
      statusEl.className = "live-status-card error";
      statusEl.innerHTML = `<span>❌</span> <span>${data.message || "Failed to sync album."}</span>`;
    }
  } catch (err) {
    statusEl.className = "live-status-card error";
    statusEl.innerHTML = `<span>❌</span> <span>Connection error: ${err.message}</span>`;
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function connectGooglePhotosFromModal() {
  const input = document.getElementById("modal-gphotos-url");
  const statusEl = document.getElementById("modal-gphotos-status");
  const btn = document.getElementById("btn-modal-gphotos-connect");
  if (!input || !statusEl) return;

  const url = input.value.trim();
  if (!url) {
    statusEl.className = "live-status-card error";
    statusEl.style.display = "flex";
    statusEl.innerHTML = `<span>⚠️</span> <span>Please paste your Google Photos shared album link.</span>`;
    input.focus();
    return;
  }

  statusEl.className = "live-status-card loading";
  statusEl.style.display = "flex";
  statusEl.innerHTML = `<span>⏳</span> <span>Connecting to Google Photos and extracting album photos...</span>`;
  if (btn) btn.disabled = true;

  try {
    const res = await fetch("/api/photos/google-album/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (data.status === "ok") {
      statusEl.className = "live-status-card success";
      statusEl.innerHTML = `<span>✅</span> <span>${data.message}</span>`;
      input.value = "";
      await loadState();
      renderGooglePhotosModalStatus();
      if (appState.activeNav === "photo-frame") renderPhotoFrame();
    } else {
      statusEl.className = "live-status-card error";
      statusEl.innerHTML = `<span>❌</span> <span>${data.message || "Failed to sync album."}</span>`;
    }
  } catch (err) {
    statusEl.className = "live-status-card error";
    statusEl.innerHTML = `<span>❌</span> <span>Connection error: ${err.message}</span>`;
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function syncGooglePhotosAlbum() {
  const s = appState.settings || {};
  if (!s.googlePhotosAlbumUrl) {
    alert("No Google Photos album connected yet.");
    return;
  }
  try {
    const res = await fetch("/api/photos/google-album/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: s.googlePhotosAlbumUrl }),
    });
    const data = await res.json();
    if (data.status === "ok") {
      await loadState();
      renderGooglePhotosStatus();
      renderGooglePhotosModalStatus();
      if (appState.activeNav === "photo-frame") renderPhotoFrame();
      alert(`✅ Synced! ${data.photoCount} photos imported from Google Photos.`);
    } else {
      alert("Error syncing album: " + (data.message || "Unknown error"));
    }
  } catch (err) {
    alert("Error syncing Google Photos album: " + err.message);
  }
}

async function disconnectGooglePhotosAlbum() {
  const confirmed = await showAppConfirm("Are you sure you want to disconnect this Google Photos album from the display?", {
    title: "Disconnect Album?",
    icon: "📸",
    confirmText: "Disconnect",
    isDanger: true,
  });
  if (!confirmed) return;
  try {
    const res = await fetch("/api/photos/google-album", { method: "DELETE" });
    if (res.ok) {
      await loadState();
      renderGooglePhotosStatus();
      renderGooglePhotosModalStatus();
      if (appState.activeNav === "photo-frame") renderPhotoFrame();
    }
  } catch (err) {
    console.error("Error disconnecting album:", err);
  }
}


// ---------------------------------------------------------------------------
// 6. Magic Import (AI Scheduling)
// ---------------------------------------------------------------------------
function openMagicImport() {
  openModal("modal-magic");
}

let pendingMagicFile = null;

function handleMagicFileUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  pendingMagicFile = file;
  const statusBox = document.getElementById("magic-status-box");
  statusBox.style.display = "block";
  statusBox.textContent = `Selected file: ${file.name} (${(file.size / 1024).toFixed(1)} KB). Tap "Extract & Populate" to parse.`;
  if (file.name.endsWith(".txt") || file.name.endsWith(".csv")) {
    const reader = new FileReader();
    reader.onload = (evt) => {
      document.getElementById("magic-text").value = evt.target.result;
    };
    reader.readAsText(file);
  }
}

async function submitMagicImport(e) {
  e.preventDefault();
  const text = document.getElementById("magic-text").value.trim();
  const memberId = document.getElementById("magic-member").value;
  const statusBox = document.getElementById("magic-status-box");
  const btn = document.getElementById("btn-magic-submit");

  if (!text && !pendingMagicFile) {
    alert("Please paste schedule text or choose a schedule file to import.");
    return;
  }

  statusBox.style.display = "block";
  statusBox.textContent = "Extracting schedule events with AI on local server...";
  btn.disabled = true;

  try {
    let res;
    if (pendingMagicFile && !text) {
      const fd = new FormData();
      fd.append("file", pendingMagicFile);
      fd.append("memberId", memberId);
      res = await fetch("/api/magic-import/file", {
        method: "POST",
        body: fd
      });
    } else {
      res = await fetch("/api/magic-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, memberId }),
      });
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Import failed");

    statusBox.style.display = "none";
    btn.disabled = false;
    pendingMagicFile = null;
    document.getElementById("magic-file-input").value = "";
    closeModal("modal-magic");
    document.getElementById("magic-text").value = "";

    await loadState();
    alert(`✨ Magic Import Complete! Extracted and scheduled ${data.count} events to your calendar.`);
  } catch (err) {
    statusBox.textContent = "Error: " + err.message;
    btn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// 7. Universal Calendar Sync Modal
// ---------------------------------------------------------------------------
function openSyncModal() {
  populateSelectDropdowns();
  renderFeedsList();
  openModal("modal-sync");
}

function renderFeedsList() {
  const list = document.getElementById("feeds-list");
  if (!list) return;
  list.innerHTML = "";

  if (!appState.feeds || appState.feeds.length === 0) {
    list.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">No external calendars connected yet. Add one below!</div>`;
    return;
  }

  for (const f of appState.feeds) {
    let optionsHtml = `<option value="all" ${(!f.memberId || f.memberId === "all") ? "selected" : ""}>🏡 Entire Family (Shared)</option>`;
    for (const m of (appState.members || [])) {
      const isSel = f.memberId === m.id ? "selected" : "";
      optionsHtml += `<option value="${m.id}" ${isSel}>${m.avatar || "👤"} ${m.name}</option>`;
    }

    const row = document.createElement("div");
    row.style.cssText = `background: var(--bg-card); padding: 12px; border-radius: var(--radius-md); border-left: 4px solid ${f.color || "#38bdf8"}; display: flex; justify-content: space-between; align-items: center; gap: 10px; border: 1px solid var(--border-color);`;
    row.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 4px; flex: 1;">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span style="font-weight: 700; font-size: 0.95rem;">${f.name}</span>
          <span style="font-size: 0.75rem; color: var(--text-dim);">(${f.provider || "iCal"})</span>
          <span style="font-size: 0.75rem; color: #0284c7; background: rgba(2, 132, 199, 0.1); padding: 2px 7px; border-radius: 4px; font-weight: 700;">${f.eventCount || 0} events</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
          <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">Assigned To:</span>
          <select onchange="changeFeedMember('${f.id}', this.value)" style="padding: 3px 8px; font-size: 0.82rem; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-primary); font-weight: 600; cursor: pointer;">
            ${optionsHtml}
          </select>
        </div>
        ${f.lastSynced ? `<div style="font-size: 0.72rem; color: var(--accent-emerald);">Last synced: ${f.lastSynced}</div>` : ""}
      </div>
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <button type="button" class="btn-touch" onclick="triggerFeedSync('${f.id}')">🔄 Sync Now</button>
        <button type="button" class="btn-touch" style="color: var(--accent-rose);" onclick="deleteFeed('${f.id}')">✕</button>
      </div>
    `;
    list.appendChild(row);
  }
}

async function addCalendarFeed(e) {
  e.preventDefault();
  const name = (document.getElementById("feed-name") && document.getElementById("feed-name").value.trim()) || "Google Calendar";
  const provider = (document.getElementById("feed-provider") && document.getElementById("feed-provider").value) || "Google";
  const url = (document.getElementById("feed-url") && document.getElementById("feed-url").value.trim()) || "";
  const memberId = (document.getElementById("feed-member") && document.getElementById("feed-member").value) || "all";
  let color = (document.getElementById("feed-color") && document.getElementById("feed-color").value) || "#0284c7";

  if (!url) return;

  if (memberId !== "all") {
    const mem = (appState.members || []).find((m) => m.id === memberId);
    if (mem && mem.color) color = mem.color;
  }

  try {
    const testRes = await fetch("/api/feeds/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, name, memberId }),
    });
    const testData = await testRes.json();
    if (testData.status === "ok") {
      await fetch("/api/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, provider, url, memberId, color }),
      });
      await loadState();
      renderFeedsList();
      renderSettingsFeeds();
      renderCalendar();
      const form = document.getElementById("form-feed");
      if (form) form.reset();
      alert(`✅ Successfully connected "${name}" with ${testData.eventCount} events!`);
    } else {
      alert(`❌ Connection error: ${testData.message || "Could not connect to calendar feed."}`);
    }
  } catch (err) {
    alert("Error adding calendar feed: " + err.message);
  }
}

const addFeed = addCalendarFeed;

async function triggerFeedSync(feedId) {
  try {
    const res = await fetch(`/api/feeds/${feedId}/sync`, { method: "POST" });
    const data = await res.json();
    await loadState();
    renderFeedsList();
    renderSettingsFeeds();
    renderCalendar();
    alert(`✓ Sync complete: ${data.eventsCount} events imported.`);
  } catch (err) {
    alert("Sync error: " + err.message);
  }
}

async function deleteFeed(feedId) {
  const confirmed = await showAppConfirm("Are you sure you want to delete this calendar feed and remove all its synced events?", {
    title: "Remove Calendar Feed?",
    icon: "📅",
    confirmText: "Remove Feed",
    isDanger: true,
  });
  if (!confirmed) return;
  await fetch(`/api/feeds/${feedId}`, { method: "DELETE" });
  await loadState();
  renderFeedsList();
  renderSettingsFeeds();
  renderCalendar();
}

// ---------------------------------------------------------------------------
// 8. Sleep & Daytime Google Photos Screensaver Engine
// ---------------------------------------------------------------------------
let screensaverIdleTimer = null;
let screensaverCycleTimer = null;
let screensaverClockTimer = null;
let screensaverIndex = 0;
let isScreensaverActive = false;

function getScreensaverPhotos() {
  const s = appState.settings || {};
  if (appState.photos && appState.photos.length > 0) {
    // If Google Photos album is connected, prioritize and filter exclusively for Google Photos
    const gPhotos = appState.photos.filter((p) => p.source === "google_photos");
    if (gPhotos.length > 0) {
      return gPhotos.map((p) => ({
        url: p.url || `/api/photos/file/${p.filename}`,
        caption: p.caption || "Google Photos Memory",
        isGooglePhoto: true,
      }));
    }
    // Otherwise fallback to uploaded or local photos
    return appState.photos.map((p) => ({
      url: p.url || `/api/photos/file/${p.filename}`,
      caption: p.caption || "Family Memory",
      isGooglePhoto: p.source === "google_photos",
    }));
  }
  return FALLBACK_PHOTOS.map((p) => ({ ...p, isGooglePhoto: false }));
}

function isCurrentlySleepingTime() {
  const set = appState.settings || {};
  if (!set.sleepEnabled) return false;

  const now = new Date();
  const curTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const sleepTime = set.sleepTime || "22:00";
  const wakeTime = set.wakeTime || "06:30";

  if (sleepTime > wakeTime) {
    return curTime >= sleepTime || curTime < wakeTime;
  } else {
    return curTime >= sleepTime && curTime < wakeTime;
  }
}

function initScreensaverActivityListeners() {
  const events = ["touchstart", "touchend", "pointerdown", "mousedown", "keydown", "scroll"];
  events.forEach((evt) => {
    window.addEventListener(evt, () => {
      onUserScreensaverActivity();
    }, { passive: true });
  });
}

function onUserScreensaverActivity() {
  if (isScreensaverActive) {
    dismissScreensaver();
  }
  resetScreensaverIdleTimer();
}

function resetScreensaverIdleTimer() {
  if (screensaverIdleTimer) {
    clearTimeout(screensaverIdleTimer);
    screensaverIdleTimer = null;
  }

  const set = appState.settings || {};
  // If daytime screensaver disabled, don't set timer
  if (set.daytimeScreensaverEnabled === false) return;

  // Don't trigger screensaver if sleeping time (sleep overlay handles it)
  if (isCurrentlySleepingTime()) return;

  const timeoutMins = parseFloat(set.daytimeScreensaverTimeoutMins) || 5;
  const timeoutMs = Math.max(0.5, timeoutMins) * 60 * 1000;

  screensaverIdleTimer = setTimeout(() => {
    checkAndTriggerDaytimeScreensaver();
  }, timeoutMs);
}

function checkAndTriggerDaytimeScreensaver() {
  // If it's night time sleep hours, nighttime blackout overlay handles it
  if (isCurrentlySleepingTime()) return;

  const sleepOverlay = document.getElementById("sleep-overlay");
  if (sleepOverlay && !sleepOverlay.classList.contains("hidden")) {
    return; // Already in sleep mode
  }

  activateScreensaver();
}

function updateScreensaverDisplay() {
  const overlay = document.getElementById("screensaver-overlay");
  if (!overlay || overlay.classList.contains("hidden")) return;

  // 1. Update Clock & Date
  const now = new Date();
  let hours = now.getHours();
  const mins = String(now.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;

  const clkEl = document.getElementById("screensaver-clock");
  if (clkEl) clkEl.textContent = `${displayHours}:${mins} ${ampm}`;

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dateStr = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
  const dateEl = document.getElementById("screensaver-date");
  if (dateEl) dateEl.textContent = dateStr;

  // 2. Update Weather Badge
  if (appState.weather) {
    const w = appState.weather;
    const tempEl = document.getElementById("screensaver-weather-temp");
    const iconEl = document.getElementById("screensaver-weather-icon");
    const locEl = document.getElementById("screensaver-weather-loc");
    if (tempEl) tempEl.textContent = `${w.temp || "--"}°`;
    if (iconEl) iconEl.textContent = w.icon || "☀️";
    if (locEl) locEl.textContent = (appState.settings && appState.settings.weatherLocation) || "Home";
  }

  // 3. Update Photo & Background
  const photos = getScreensaverPhotos();
  if (photos.length === 0) return;

  screensaverIndex = (screensaverIndex + 1) % photos.length;
  const current = photos[screensaverIndex];

  const imgEl = document.getElementById("screensaver-img");
  const bgEl = document.getElementById("screensaver-bg");
  const capEl = document.getElementById("screensaver-caption");
  const sourceEl = document.getElementById("screensaver-source-pill");

  if (imgEl) {
    imgEl.referrerPolicy = "no-referrer";
    imgEl.style.opacity = "0.2";
    if (bgEl) {
      bgEl.referrerPolicy = "no-referrer";
      bgEl.style.opacity = "0.2";
    }
    setTimeout(() => {
      imgEl.src = current.url;
      imgEl.style.opacity = "1";
      if (bgEl) {
        bgEl.src = current.url;
        bgEl.style.opacity = "0.85";
      }
    }, 350);
  }

  if (capEl) capEl.textContent = current.caption || "Family Memory";
  if (sourceEl) {
    sourceEl.textContent = current.isGooglePhoto ? "📸 Google Photos Album" : "🖼️ Family Album";
  }
}

function activateScreensaver() {
  const overlay = document.getElementById("screensaver-overlay");
  if (!overlay) return;

  isScreensaverActive = true;
  overlay.classList.remove("hidden");

  // Show first photo immediately
  updateScreensaverDisplay();

  // Start photo cycling interval
  if (screensaverCycleTimer) clearInterval(screensaverCycleTimer);
  const intervalSec = (appState.settings && appState.settings.slideshowIntervalSec) || 8;
  screensaverCycleTimer = setInterval(() => {
    updateScreensaverDisplay();
  }, intervalSec * 1000);

  // Update clock every 10 seconds while active
  if (screensaverClockTimer) clearInterval(screensaverClockTimer);
  screensaverClockTimer = setInterval(() => {
    const now = new Date();
    let hours = now.getHours();
    const mins = String(now.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    const clkEl = document.getElementById("screensaver-clock");
    if (clkEl) clkEl.textContent = `${displayHours}:${mins} ${ampm}`;
  }, 10000);
}

function dismissScreensaver() {
  const overlay = document.getElementById("screensaver-overlay");
  if (overlay) overlay.classList.add("hidden");

  isScreensaverActive = false;
  if (screensaverCycleTimer) {
    clearInterval(screensaverCycleTimer);
    screensaverCycleTimer = null;
  }
  if (screensaverClockTimer) {
    clearInterval(screensaverClockTimer);
    screensaverClockTimer = null;
  }
  resetScreensaverIdleTimer();
}

function triggerScreensaverNow() {
  closeModal("modal-settings");
  activateScreensaver();
}

function renderScreensaverStatusInSettings() {
  const infoEl = document.getElementById("set-screensaver-gphotos-info");
  if (!infoEl) return;
  const s = appState.settings || {};
  const hasGPhotos = !!s.googlePhotosAlbumUrl;
  const count = s.googlePhotosCount || 0;
  if (hasGPhotos) {
    infoEl.style.display = "block";
    infoEl.style.color = "#059669";
    infoEl.style.background = "rgba(16, 185, 129, 0.08)";
    infoEl.innerHTML = `✅ <strong>Connected Album:</strong> ${count} Google Photos rotating in your daytime screensaver.`;
  } else {
    infoEl.style.display = "block";
    infoEl.style.color = "#0284c7";
    infoEl.style.background = "rgba(2, 132, 199, 0.08)";
    infoEl.innerHTML = `ℹ️ <strong>Google Photos:</strong> Tap "Album Sync" to connect your Google Photos shared album URL for family memories.`;
  }
}

function startSleepScheduler() {
  function checkSchedule() {
    const set = appState.settings;
    if (!set || !set.sleepEnabled) return;

    const overlay = document.getElementById("sleep-overlay");
    if (!overlay) return;

    const isSleepingTime = isCurrentlySleepingTime();

    if (isSleepingTime) {
      if (isScreensaverActive) {
        dismissScreensaver();
      }
      if (overlay.classList.contains("hidden")) {
        overlay.classList.remove("hidden");
      }
    } else {
      if (!overlay.classList.contains("hidden")) {
        overlay.classList.add("hidden");
        resetScreensaverIdleTimer();
      }
    }
  }

  setInterval(checkSchedule, 15000);
}

function wakeScreen() {
  const overlay = document.getElementById("sleep-overlay");
  if (overlay) overlay.classList.add("hidden");
  resetScreensaverIdleTimer();
}

function triggerImmediateSleep() {
  closeModal("modal-settings");
  if (isScreensaverActive) {
    dismissScreensaver();
  }
  const overlay = document.getElementById("sleep-overlay");
  if (overlay) overlay.classList.remove("hidden");
}

// ---------------------------------------------------------------------------
// Modals & Forms
// ---------------------------------------------------------------------------
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("hidden");
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("hidden");
}

function showAppConfirm(message, options = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById("modal-confirm");
    const iconEl = document.getElementById("confirm-icon");
    const titleEl = document.getElementById("confirm-title");
    const msgEl = document.getElementById("confirm-message");
    const okBtn = document.getElementById("confirm-btn-ok");
    const cancelBtn = document.getElementById("confirm-btn-cancel");

    if (!modal) {
      resolve(confirm(message));
      return;
    }

    if (iconEl) iconEl.textContent = options.icon || (options.isDanger !== false ? "🗑️" : "❓");
    if (titleEl) titleEl.textContent = options.title || "Confirmation";
    if (msgEl) msgEl.textContent = message;

    if (okBtn) {
      okBtn.textContent = options.confirmText || (options.isDanger !== false ? "Delete" : "Confirm");
      if (options.isDanger !== false) {
        okBtn.className = "btn-hub danger";
        okBtn.style.background = "#ef4444";
        okBtn.style.color = "#ffffff";
      } else {
        okBtn.className = "btn-hub primary";
        okBtn.style.background = "";
        okBtn.style.color = "";
      }
    }

    if (cancelBtn) {
      cancelBtn.textContent = options.cancelText || "Cancel";
    }

    let settled = false;
    const cleanup = (val) => {
      if (settled) return;
      settled = true;
      closeModal("modal-confirm");
      resolve(val);
    };

    okBtn.onclick = (e) => {
      e.stopPropagation();
      cleanup(true);
    };

    cancelBtn.onclick = (e) => {
      e.stopPropagation();
      cleanup(false);
    };

    modal.onclick = (e) => {
      if (e.target === modal) {
        cleanup(false);
      }
    };

    openModal("modal-confirm");
  });
}

function openNewEventModal() {
  const form = document.getElementById("form-event");
  if (form) form.reset();

  const idInput = document.getElementById("ev-id");
  if (idInput) idInput.value = "";

  const titleEl = document.getElementById("modal-event-title");
  if (titleEl) titleEl.textContent = "📅 Add Calendar Event";

  const banner = document.getElementById("ev-synced-banner");
  if (banner) banner.style.display = "none";

  const btnDel = document.getElementById("ev-btn-delete");
  if (btnDel) btnDel.style.display = "none";

  const btnSub = document.getElementById("ev-btn-submit");
  if (btnSub) btnSub.textContent = "Save Event";

  const dt = document.getElementById("ev-date");
  if (dt) dt.value = new Date().toISOString().split("T")[0];

  const tm = document.getElementById("ev-time");
  if (tm) tm.value = "09:00";
  const endTm = document.getElementById("ev-end-time");
  if (endTm) endTm.value = "10:00";

  const rep = document.getElementById("ev-repeat");
  if (rep) rep.value = "none";
  const repUntil = document.getElementById("ev-repeat-until");
  if (repUntil) repUntil.value = "";
  toggleRepeatUntilVisibility();

  populateSelectDropdowns();
  openModal("modal-event");
}

async function saveEvent(e) {
  e.preventDefault();
  const eventId = (document.getElementById("ev-id") && document.getElementById("ev-id").value) || "";
  const title = document.getElementById("ev-title").value.trim();
  const date = document.getElementById("ev-date").value;
  const time = document.getElementById("ev-time").value;
  const endTime = document.getElementById("ev-end-time").value;
  const memberId = document.getElementById("ev-member").value;
  const location = document.getElementById("ev-loc").value.trim();
  const notes = document.getElementById("ev-notes").value.trim();
  const repeat = (document.getElementById("ev-repeat") && document.getElementById("ev-repeat").value) || "none";
  const repeatUntil = (document.getElementById("ev-repeat-until") && document.getElementById("ev-repeat-until").value) || null;

  const payload = { title, date, time, endTime, memberId, location, notes, repeat, repeatUntil };

  if (eventId) {
    // Edit / Update existing event
    await fetch(`/api/events/${eventId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } else {
    // Create new event
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  await loadState();
  closeModal("modal-event");
  const form = document.getElementById("form-event");
  if (form) form.reset();
}

async function deleteCurrentEvent() {
  const idInput = document.getElementById("ev-id");
  const eventId = idInput ? idInput.value : "";
  if (!eventId) return;

  const title = (document.getElementById("ev-title") && document.getElementById("ev-title").value) || "this event";
  const confirmed = await showAppConfirm(`Are you sure you want to delete "${title}" from the family calendar?`, {
    title: "Delete Event?",
    icon: "📅",
    confirmText: "Delete Event",
    isDanger: true,
  });
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
    if (res.ok) {
      closeModal("modal-event");
      await loadState();
    }
  } catch (err) {
    alert("Error deleting event: " + err.message);
  }
}

// ---------------------------------------------------------------------------
// Age-Appropriate Routine & Chore Presets
// ---------------------------------------------------------------------------
const AGE_ROUTINE_PRESETS = {
  toddler: {
    key: "toddler",
    title: "🧸 Toddlers & Preschoolers",
    ageRange: "Ages 2–4",
    description: "Focuses on 3 to 5 simple habits with heavy visual cues",
    items: [
      { title: "Go potty", icon: "🚽", timeOfDay: "morning", points: 10 },
      { title: "Get dressed", icon: "👕", timeOfDay: "morning", points: 10 },
      { title: "Eat breakfast", icon: "🥣", timeOfDay: "morning", points: 10 },
      { title: "Brush teeth", icon: "🪥", timeOfDay: "morning", points: 10 },
      { title: "Brush hair", icon: "🪮", timeOfDay: "morning", points: 10 },
      { title: "Put away toys or shoes", icon: "🧸", timeOfDay: "evening", points: 10 }
    ]
  },
  elementary: {
    key: "elementary",
    title: "🎒 Early Elementary",
    ageRange: "Ages 5–8",
    description: "Adds independence and school-prep steps",
    items: [
      { title: "Make bed", icon: "🛏️", timeOfDay: "morning", points: 10 },
      { title: "Get dressed", icon: "👕", timeOfDay: "morning", points: 10 },
      { title: "Brush teeth & do hair", icon: "🪥", timeOfDay: "morning", points: 10 },
      { title: "Eat breakfast & clear plate", icon: "🥣", timeOfDay: "morning", points: 10 },
      { title: "Pack backpack & water bottle", icon: "🎒", timeOfDay: "morning", points: 10 },
      { title: "Feed pets", icon: "🐶", timeOfDay: "evening", points: 10 }
    ]
  },
  teen: {
    key: "teen",
    title: "🎧 Tweens & Teens",
    ageRange: "Ages 9+",
    description: "Shifts toward self-management and household help",
    items: [
      { title: "Tidy room & make bed", icon: "🛏️", timeOfDay: "morning", points: 10 },
      { title: "Hygiene routine (shower, deodorant, brush teeth)", icon: "🪥", timeOfDay: "morning", points: 10 },
      { title: "Pack lunch & snacks", icon: "🥪", timeOfDay: "morning", points: 10 },
      { title: "Unload dishwasher or wipe counters", icon: "🍽️", timeOfDay: "evening", points: 15 },
      { title: "Check school bag & sports gear", icon: "🎒", timeOfDay: "afternoon", points: 10 }
    ]
  }
};

let currentChoreQuickPresetTab = "toddler";

function switchChoreQuickPresetTab(tabKey) {
  currentChoreQuickPresetTab = tabKey;
  ["toddler", "elementary", "teen"].forEach((k) => {
    const btn = document.getElementById(`chip-age-tab-${k}`);
    if (btn) btn.classList.toggle("active", k === tabKey);
  });
  renderChoreQuickPresetChips();
}

function renderChoreQuickPresetChips() {
  const container = document.getElementById("quick-preset-chips-box");
  if (!container) return;
  container.innerHTML = "";

  const preset = AGE_ROUTINE_PRESETS[currentChoreQuickPresetTab] || AGE_ROUTINE_PRESETS.toddler;
  for (const item of preset.items) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "quick-preset-chip";
    chip.innerHTML = `<span>${item.icon}</span> <span>${item.title}</span>`;
    chip.title = `Click to fill: "${item.title}" (${item.timeOfDay}, ${item.points}⭐)`;
    chip.onclick = () => applyChoreQuickPreset(item);
    container.appendChild(chip);
  }
}

function applyChoreQuickPreset(item) {
  const tEl = document.getElementById("ch-title");
  if (tEl) tEl.value = item.title;

  const iconEl = document.getElementById("ch-icon");
  if (iconEl) iconEl.value = item.icon;

  const ptsEl = document.getElementById("ch-points");
  if (ptsEl) ptsEl.value = item.points || 10;

  setChoreType("routine");
  selectRoutineTimeOfDay(item.timeOfDay || "morning");
  showToast(`Applied preset: ${item.icon} ${item.title}`);
}

// ---------------------------------------------------------------------------
// Batch Pre-set Age Routines Modal Controller
// ---------------------------------------------------------------------------
let selectedPresetCategory = "toddler";
let activePresetSelections = new Set();

function openPresetRoutinesModal(preferredMemberId) {
  let selMember = "all";
  if (preferredMemberId) {
    selMember = preferredMemberId;
  } else if (appState.activeMemberFilter && appState.activeMemberFilter !== "all") {
    selMember = appState.activeMemberFilter;
  }
  renderMultiMemberPicker("preset-members-picker", [selMember]);
  selectPresetAgeCategory("toddler");
  openModal("modal-preset-routines");
}

function populatePresetMemberDropdown(preferredMemberId) {
  let selMember = "all";
  if (preferredMemberId) {
    selMember = preferredMemberId;
  } else if (appState.activeMemberFilter && appState.activeMemberFilter !== "all") {
    selMember = appState.activeMemberFilter;
  }
  renderMultiMemberPicker("preset-members-picker", [selMember]);
}

function selectPresetAgeCategory(catKey) {
  selectedPresetCategory = catKey;
  ["toddler", "elementary", "teen"].forEach((k) => {
    const btn = document.getElementById(`btn-age-${k}`);
    if (btn) btn.classList.toggle("active", k === catKey);
  });

  const cat = AGE_ROUTINE_PRESETS[catKey];
  const descEl = document.getElementById("preset-category-desc");
  if (descEl) descEl.textContent = cat.description;

  activePresetSelections = new Set(cat.items.map((_, idx) => idx));
  renderPresetHabitsChecklist();
  updatePresetSelectionSummary();
}

function renderPresetHabitsChecklist() {
  const container = document.getElementById("preset-habits-checklist");
  if (!container) return;
  container.innerHTML = "";

  const cat = AGE_ROUTINE_PRESETS[selectedPresetCategory];
  const starOverride = document.getElementById("preset-stars-select") ? document.getElementById("preset-stars-select").value : "10";

  cat.items.forEach((item, idx) => {
    const isChecked = activePresetSelections.has(idx);
    const pts = (starOverride && starOverride !== "keep") ? parseInt(starOverride, 10) : item.points;

    const row = document.createElement("div");
    row.className = `preset-habit-row ${isChecked ? "selected" : ""}`;
    row.onclick = (e) => {
      if (e.target.tagName !== "INPUT") {
        const cb = row.querySelector("input[type=checkbox]");
        if (cb) {
          cb.checked = !cb.checked;
          togglePresetHabit(idx, cb.checked);
        }
      }
    };

    const periodEmoji = item.timeOfDay === "evening" ? "🌙 Evening" : item.timeOfDay === "afternoon" ? "☀️ Afternoon" : "🌅 Morning";

    row.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <input type="checkbox" id="preset-cb-${idx}" ${isChecked ? "checked" : ""} style="width: 20px; height: 20px; accent-color: var(--primary); cursor: pointer;" onchange="togglePresetHabit(${idx}, this.checked)" />
        <span style="font-size: 1.5rem; line-height: 1;">${item.icon}</span>
        <div>
          <div style="font-weight: 700; font-size: 0.92rem; color: var(--text-primary);">${item.title}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted); display: flex; align-items: center; gap: 6px; margin-top: 2px;">
            <span class="routine-time-badge">${periodEmoji}</span>
            <span>•</span>
            <span style="color: var(--accent-gold); font-weight: 700;">${pts} ⭐</span>
          </div>
        </div>
      </div>
      <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">
        ${isChecked ? "Included" : "Skip"}
      </div>
    `;

    container.appendChild(row);
  });
}

function togglePresetHabit(idx, checked) {
  if (checked) {
    activePresetSelections.add(idx);
  } else {
    activePresetSelections.delete(idx);
  }
  renderPresetHabitsChecklist();
  updatePresetSelectionSummary();
}

function toggleSelectAllPresets() {
  const cat = AGE_ROUTINE_PRESETS[selectedPresetCategory];
  if (activePresetSelections.size === cat.items.length) {
    activePresetSelections.clear();
  } else {
    activePresetSelections = new Set(cat.items.map((_, idx) => idx));
  }
  renderPresetHabitsChecklist();
  updatePresetSelectionSummary();
}

function updatePresetHabitStars(val) {
  renderPresetHabitsChecklist();
}

function updatePresetSelectionSummary() {
  const count = activePresetSelections.size;
  const summaryEl = document.getElementById("preset-count-summary");
  if (summaryEl) summaryEl.textContent = `${count} routine${count === 1 ? "" : "s"} selected`;

  const addBtn = document.getElementById("btn-add-presets");
  if (addBtn) {
    addBtn.disabled = count === 0;
    addBtn.textContent = count === 0 ? "Select Routines" : `✨ Add ${count} Routine${count === 1 ? "" : "s"}`;
  }

  const cat = AGE_ROUTINE_PRESETS[selectedPresetCategory];
  const toggleBtn = document.getElementById("btn-toggle-all-presets");
  if (toggleBtn) {
    toggleBtn.textContent = (count === cat.items.length) ? "Deselect All" : "Select All";
  }
}

async function saveBatchPresetRoutines() {
  if (activePresetSelections.size === 0) {
    showToast("Please select at least 1 routine");
    return;
  }

  const selectedMembers = getSelectedPickerMembers("preset-members-picker");
  const frequency = document.getElementById("preset-frequency-select").value || "Daily";
  const starOverride = document.getElementById("preset-stars-select").value;
  const cat = AGE_ROUTINE_PRESETS[selectedPresetCategory];

  const daysOfWeek = frequency === "Weekly"
    ? ["Mon", "Tue", "Wed", "Thu", "Fri"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const payloadList = [];
  selectedMembers.forEach((memberId) => {
    activePresetSelections.forEach((idx) => {
      const item = cat.items[idx];
      if (!item) return;
      const pts = (starOverride && starOverride !== "keep") ? parseInt(starOverride, 10) : item.points;

      payloadList.push({
        title: item.title,
        icon: item.icon,
        memberId: memberId,
        points: pts,
        frequency: frequency,
        isRoutine: true,
        timeOfDay: item.timeOfDay || "morning",
        daysOfWeek: daysOfWeek
      });
    });
  });

  try {
    const res = await fetch("/api/chores/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadList),
    });

    if (!res.ok) throw new Error("Failed to save routines");
    closeModal("modal-preset-routines");
    await loadState();
    if (appState.splitScreen) renderSplitSidePane();

    if (typeof confetti === "function") {
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
    }

    const memberNames = selectedMembers.map((mId) => {
      const m = (appState.members || []).find((x) => x.id === mId);
      return m ? m.name : "Family";
    }).join(", ");
    showToast(`🎉 Added ${payloadList.length} routines for ${memberNames}!`);
  } catch (err) {
    console.error("Batch preset error:", err);
    showToast("Error creating pre-set routines");
  }
}

function openNewChoreModal(preferredMemberId) {
  const form = document.getElementById("form-chore");
  if (form) form.reset();
  const idEl = document.getElementById("ch-id");
  if (idEl) idEl.value = "";
  const titEl = document.getElementById("modal-chore-title");
  if (titEl) titEl.textContent = "+ Add Family Task / Routine";
  const subBtn = document.getElementById("ch-btn-submit");
  if (subBtn) subBtn.textContent = "Save Routine";
  const delBtn = document.getElementById("ch-btn-delete");
  if (delBtn) delBtn.style.display = "none";
  const ptsEl = document.getElementById("ch-points");
  if (ptsEl) ptsEl.value = "10";
  const iconEl = document.getElementById("ch-icon");
  if (iconEl) iconEl.value = "🪥";

  setChoreType("routine");
  const curPeriod = getCurrentRoutinePeriod();
  selectRoutineTimeOfDay(curPeriod);
  setSelectedRoutineDays(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);

  switchChoreQuickPresetTab("toddler");
  renderChoreQuickPresetChips();

  populateSelectDropdowns();

  let selMember = "all";
  if (preferredMemberId) {
    selMember = preferredMemberId;
  } else if (appState.activeMemberFilter && appState.activeMemberFilter !== "all") {
    selMember = appState.activeMemberFilter;
  }
  renderMultiMemberPicker("ch-members-picker", [selMember]);

  openModal("modal-chore");
}

function openEditChoreModal(choreId) {
  const chore = (appState.chores || []).find((c) => c.id === choreId);
  if (!chore) return;

  const idEl = document.getElementById("ch-id");
  if (idEl) idEl.value = chore.id;
  const titEl = document.getElementById("modal-chore-title");
  if (titEl) titEl.textContent = chore.isRoutine !== false ? "✏️ Edit Routine" : "✏️ Edit Family Chore";

  const tEl = document.getElementById("ch-title");
  if (tEl) tEl.value = chore.title || "";

  const iconEl = document.getElementById("ch-icon");
  if (iconEl) iconEl.value = chore.icon || "🪥";

  populateSelectDropdowns();
  renderMultiMemberPicker("ch-members-picker", [chore.memberId || "all"]);

  const ptsEl = document.getElementById("ch-points");
  if (ptsEl) ptsEl.value = chore.points !== undefined ? chore.points : 10;

  const freqEl = document.getElementById("ch-freq");
  if (freqEl && chore.frequency) freqEl.value = chore.frequency;

  setChoreType(chore.isRoutine !== false ? "routine" : "chore");
  selectRoutineTimeOfDay(chore.timeOfDay || "morning");
  setSelectedRoutineDays(chore.daysOfWeek || ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);

  switchChoreQuickPresetTab("toddler");
  renderChoreQuickPresetChips();

  const subBtn = document.getElementById("ch-btn-submit");
  if (subBtn) subBtn.textContent = "Save Changes";

  const delBtn = document.getElementById("ch-btn-delete");
  if (delBtn) delBtn.style.display = "inline-block";

  openModal("modal-chore");
}

async function deleteCurrentChore() {
  const choreId = document.getElementById("ch-id").value;
  if (!choreId) return;

  const title = (document.getElementById("ch-title") && document.getElementById("ch-title").value) || "this task";
  const confirmed = await showAppConfirm(`Are you sure you want to permanently delete "${title}"? This cannot be undone.`, {
    title: "Delete Task?",
    icon: "🗑️",
    confirmText: "Delete Task",
    isDanger: true,
  });
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/chores/${choreId}`, { method: "DELETE" });
    if (res.ok) {
      closeModal("modal-chore");
      await loadState();
      if (appState.splitScreen) renderSplitSidePane();
    }
  } catch (err) {
    alert("Error deleting task: " + err.message);
  }
}

async function saveChore(e) {
  e.preventDefault();
  const choreId = document.getElementById("ch-id").value;
  const title = document.getElementById("ch-title").value.trim();
  const selectedMembers = getSelectedPickerMembers("ch-members-picker");
  const points = parseInt(document.getElementById("ch-points").value, 10) || 10;
  const frequency = document.getElementById("ch-freq").value;
  const isRoutine = document.getElementById("ch-is-routine").value === "true";
  const timeOfDay = document.getElementById("ch-time-of-day").value || "morning";
  const daysOfWeek = getSelectedRoutineDays();
  const icon = document.getElementById("ch-icon").value.trim() || "";

  if (!title) {
    showToast("Please enter a title");
    return;
  }

  try {
    if (choreId) {
      const memberId = selectedMembers[0] || "all";
      const payload = {
        title,
        memberId,
        points,
        frequency,
        isRoutine,
        timeOfDay,
        daysOfWeek,
        icon,
        id: choreId
      };
      await fetch(`/api/chores/${choreId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      showToast(isRoutine ? "Routine updated!" : "Task updated!");
    } else if (selectedMembers.length > 1) {
      const payloadList = selectedMembers.map((mId) => ({
        title,
        memberId: mId,
        points,
        frequency,
        isRoutine,
        timeOfDay,
        daysOfWeek,
        icon
      }));
      const res = await fetch("/api/chores/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadList),
      });
      const data = await res.json();
      showToast(`Created ${data.count || payloadList.length} routines!`);
    } else {
      const memberId = selectedMembers[0] || "all";
      const payload = {
        title,
        memberId,
        points,
        frequency,
        isRoutine,
        timeOfDay,
        daysOfWeek,
        icon
      };
      await fetch("/api/chores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      showToast(isRoutine ? "Routine saved!" : "Task saved!");
    }
    await loadState();
    if (appState.splitScreen) renderSplitSidePane();
    closeModal("modal-chore");
  } catch (err) {
    console.error("Error saving chore:", err);
    alert("Error saving chore: " + err.message);
  }
}

async function openNewListModal() {
  const title = prompt("Enter List Name (e.g. 🛠️ Hardware Store or 🎒 Packing):");
  if (!title) return;
  try {
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      await loadState();
      renderLists();
    }
  } catch (err) {
    console.error("Failed to create list:", err);
  }
}

function openSettingsModal() {
  const s = appState.settings || {};
  if (s.deviceName) document.getElementById("set-device-name").value = s.deviceName;
  if (s.wakeTime) document.getElementById("set-wake-time").value = s.wakeTime;
  if (s.sleepTime) document.getElementById("set-sleep-time").value = s.sleepTime;
  if (s.weatherLocation) document.getElementById("set-weather-loc").value = s.weatherLocation;
  if (s.skylightEmail) document.getElementById("set-skylight-email").value = s.skylightEmail;
  if (s.splitDefault) {
    const splitDefEl = document.getElementById("set-split-default");
    if (splitDefEl) splitDefEl.value = s.splitDefault;
  }
  if (s.slideshowIntervalSec) {
    const speedEl = document.getElementById("set-slideshow-interval");
    if (speedEl) speedEl.value = String(s.slideshowIntervalSec);
  }
  const ssEnabledEl = document.getElementById("set-screensaver-enabled");
  if (ssEnabledEl) ssEnabledEl.checked = s.daytimeScreensaverEnabled !== false;
  const ssTimeoutEl = document.getElementById("set-screensaver-timeout");
  if (ssTimeoutEl && s.daytimeScreensaverTimeoutMins) ssTimeoutEl.value = String(s.daytimeScreensaverTimeoutMins);
  renderScreensaverStatusInSettings();
  renderSettingsMembers();
  updateSettingsRewardsExclusionSummary();
  renderSettingsFeeds();
  updateSettingsMemberDropdown();
  renderSettingsLists();
  renderGooglePhotosStatus();
  const statusEl = document.getElementById("set-gcal-status");
  if (statusEl) statusEl.style.display = "none";
  const gpStatus = document.getElementById("set-gphotos-status");
  if (gpStatus) gpStatus.style.display = "none";
  openModal("modal-settings");
}

function renderSettingsMembers() {
  const container = document.getElementById("settings-members-list");
  if (!container) return;
  if (!appState.members || appState.members.length === 0) {
    container.innerHTML = `<div style="font-size:0.8rem; color:var(--text-muted); font-style:italic;">No family profiles yet. Add one below!</div>`;
    return;
  }
  container.innerHTML = appState.members.map(m => `
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: var(--bg-hover); border-radius: 8px; border: 1px solid var(--border-color); gap: 8px;">
      <div style="display: flex; align-items: center; gap: 10px; cursor: pointer; flex: 1; min-width: 0;" onclick="openEditMemberModal('${m.id}')" title="Click to edit ${m.name}'s name, avatar, or color">
        <span style="font-size: 1.4rem;">${m.avatar || "👤"}</span>
        <span style="width: 14px; height: 14px; border-radius: 50%; background: ${m.color || "#0284c7"}; display: inline-block; flex-shrink: 0; box-shadow: 0 0 3px rgba(0,0,0,0.2);"></span>
        <span style="font-weight: 700; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${m.name}</span>
        <span style="font-size: 0.72rem; color: var(--primary); font-weight: 600; opacity: 0.85;">✏️ Edit</span>
      </div>
      <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
        <button type="button" class="btn-hub ghost mini-btn" onclick="openEditMemberModal('${m.id}')" title="Edit ${m.name}'s profile" style="padding: 4px 8px; font-size: 0.78rem;">
          ✏️ Edit Profile
        </button>
        ${m.id !== "m5" ? `
          <button type="button" onclick="openEditPointsModal('${m.id}')" title="Edit ${m.name}'s points" style="background: rgba(251, 191, 36, 0.15); border: 1px solid rgba(251, 191, 36, 0.35); color: var(--accent-gold); font-weight: 700; font-size: 0.8rem; padding: 4px 8px; border-radius: var(--radius-pill); cursor: pointer; display: flex; align-items: center; gap: 3px;">
            <span>${m.points || 0} ⭐</span>
          </button>
          <button type="button" onclick="deleteMemberFromSettings('${m.id}')" title="Delete Profile" style="background: none; border: none; cursor: pointer; color: #ef4444; font-size: 1rem; padding: 2px 6px;">🗑️</button>
        ` : ""}
      </div>
    </div>
  `).join("");
}

// ---------------------------------------------------------------------------
// Family Member Profile Editing (Name, Avatar, Color)
// ---------------------------------------------------------------------------
function openEditMemberModal(memberId) {
  const m = getMember(memberId);
  if (!m) return;

  const idEl = document.getElementById("edit-mem-id");
  if (idEl) idEl.value = m.id;

  const nameEl = document.getElementById("edit-mem-name");
  if (nameEl) nameEl.value = m.name || "";

  const avEl = document.getElementById("edit-mem-avatar");
  if (avEl) avEl.value = m.avatar || "👤";

  const colorEl = document.getElementById("edit-mem-color");
  if (colorEl) colorEl.value = m.color || "#0284c7";

  const hexEl = document.getElementById("edit-mem-color-hex");
  if (hexEl) hexEl.textContent = m.color || "#0284c7";

  const titEl = document.getElementById("modal-edit-member-title");
  if (titEl) titEl.textContent = `✏️ Edit ${m.name}'s Profile`;

  updateMemberPreview();
  openModal("modal-edit-member");
}

function updateMemberPreview() {
  const name = (document.getElementById("edit-mem-name")?.value || "").trim() || "Member Name";
  const avatar = (document.getElementById("edit-mem-avatar")?.value || "").trim() || "👤";
  const color = document.getElementById("edit-mem-color")?.value || "#0284c7";

  const pName = document.getElementById("edit-mem-preview-name");
  if (pName) pName.textContent = name;

  const pAv = document.getElementById("edit-mem-preview-avatar");
  if (pAv) pAv.textContent = avatar;

  const pCol = document.getElementById("edit-mem-preview-color");
  if (pCol) pCol.style.background = color;

  const hexEl = document.getElementById("edit-mem-color-hex");
  if (hexEl) hexEl.textContent = color;
}

function selectMemberAvatar(emoji) {
  const avEl = document.getElementById("edit-mem-avatar");
  if (avEl) {
    avEl.value = emoji;
    updateMemberPreview();
  }
}

function selectMemberColor(hex) {
  const colorEl = document.getElementById("edit-mem-color");
  if (colorEl) {
    colorEl.value = hex;
    updateMemberPreview();
  }
}

async function saveMemberProfile(e) {
  e.preventDefault();
  const memberId = document.getElementById("edit-mem-id")?.value;
  if (!memberId) return;

  const name = document.getElementById("edit-mem-name")?.value.trim();
  const avatar = document.getElementById("edit-mem-avatar")?.value.trim() || "👤";
  const color = document.getElementById("edit-mem-color")?.value || "#0284c7";

  if (!name) {
    showToast("Please enter a member name");
    return;
  }

  try {
    const res = await fetch(`/api/members/${memberId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, avatar, color }),
    });

    if (!res.ok) throw new Error("Failed to update profile");
    const data = await res.json();
    const updatedMember = data.member;

    // Update in-memory state
    const idx = (appState.members || []).findIndex(x => x.id === memberId);
    if (idx !== -1) {
      appState.members[idx] = { ...appState.members[idx], ...updatedMember };
    }

    closeModal("modal-edit-member");
    renderSettingsMembers();
    populateSelectDropdowns();
    renderMemberFilters();
    renderCalendar();
    if (appState.activeNav === "chores") renderChores();
    if (appState.activeNav === "rewards") renderRewards();
    if (appState.splitScreen) renderSplitSidePane();

    showToast(`Saved profile for ${updatedMember.name}!`);
  } catch (err) {
    console.error("Failed to update member:", err);
    showToast("Error updating family profile");
  }
}

function openEditPointsModal(memberId) {
  const m = getMember(memberId);
  if (!m) return;

  const idEl = document.getElementById("pts-member-id");
  if (idEl) idEl.value = m.id;

  const avEl = document.getElementById("pts-member-avatar");
  if (avEl) avEl.textContent = m.avatar || "👤";

  const nmEl = document.getElementById("pts-member-name");
  if (nmEl) nmEl.textContent = `${m.name}'s Reward Points`;

  const inputEl = document.getElementById("pts-input");
  if (inputEl) inputEl.value = m.points !== undefined ? m.points : 0;

  openModal("modal-points");
}

function adjustPointsInput(delta) {
  const inputEl = document.getElementById("pts-input");
  if (!inputEl) return;
  const cur = parseInt(inputEl.value || "0", 10);
  inputEl.value = Math.max(0, cur + delta);
}

function setPointsInput(val) {
  const inputEl = document.getElementById("pts-input");
  if (inputEl) inputEl.value = val;
}

async function saveMemberPoints(e) {
  e.preventDefault();
  const memberId = document.getElementById("pts-member-id")?.value;
  const points = parseInt(document.getElementById("pts-input")?.value || "0", 10);
  if (!memberId) return;

  try {
    const res = await fetch(`/api/members/${memberId}/points`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points: Math.max(0, points) }),
    });
    if (res.ok) {
      await loadState();
      renderSettingsMembers();
      closeModal("modal-points");
    }
  } catch (err) {
    alert("Error updating points: " + err.message);
  }
}

async function addMemberFromSettings() {
  const nameInput = document.getElementById("new-mem-name");
  const avatarInput = document.getElementById("new-mem-avatar");
  const colorInput = document.getElementById("new-mem-color");
  const name = nameInput.value.trim();
  if (!name) return;
  const avatar = avatarInput.value.trim() || "👤";
  const color = colorInput.value || "#0284c7";

  try {
    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, avatar, color }),
    });
    if (res.ok) {
      nameInput.value = "";
      await loadState();
      renderSettingsMembers();
      updateSettingsMemberDropdown();
    }
  } catch (err) {
    console.error("Failed to add member:", err);
  }
}

async function deleteMemberFromSettings(memberId) {
  const m = getMember(memberId);
  const name = m ? m.name : "this family member";
  const confirmed = await showAppConfirm(`Are you sure you want to remove ${name} and their assigned tasks?`, {
    title: "Remove Family Member?",
    icon: "👤",
    confirmText: "Remove Member",
    isDanger: true,
  });
  if (!confirmed) return;
  try {
    const res = await fetch(`/api/members/${memberId}`, { method: "DELETE" });
    if (res.ok) {
      await loadState();
      renderSettingsMembers();
      updateSettingsMemberDropdown();
    }
  } catch (err) {
    console.error("Failed to delete member:", err);
  }
}

function updateSettingsMemberDropdown() {
  const sel = document.getElementById("set-gcal-member");
  if (!sel) return;
  let opts = `<option value="all">🏡 Entire Family (Shared)</option>`;
  if (appState.members && appState.members.length > 0) {
    for (const m of appState.members) {
      opts += `<option value="${m.id}">${m.avatar || "👤"} ${m.name}</option>`;
    }
  }
  sel.innerHTML = opts;
}

function renderSettingsFeeds() {
  const container = document.getElementById("settings-feeds-list");
  if (!container) return;
  const feeds = appState.feeds || [];
  if (feeds.length === 0) {
    container.innerHTML = `<div style="font-size:0.8rem; color:var(--text-muted); font-style:italic;">No connected external calendars yet. Connect your Google Calendar below!</div>`;
    return;
  }
  container.innerHTML = feeds.map(f => {
    let optionsHtml = `<option value="all" ${(!f.memberId || f.memberId === "all") ? "selected" : ""}>🏡 Entire Family (Shared)</option>`;
    for (const m of (appState.members || [])) {
      const isSel = f.memberId === m.id ? "selected" : "";
      optionsHtml += `<option value="${m.id}" ${isSel}>${m.avatar || "👤"} ${m.name}</option>`;
    }
    return `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; background: var(--bg-hover); border-radius: 8px; border: 1px solid var(--border-color); gap: 10px;">
        <div style="display: flex; flex-direction: column; gap: 4px; flex: 1;">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="font-size: 1.15rem;">📅</span>
            <strong style="font-size: 0.92rem;">${f.name}</strong>
            <span style="font-size: 0.75rem; color: #0284c7; background: rgba(2, 132, 199, 0.1); padding: 2px 7px; border-radius: 4px; font-weight: 700;">${f.eventCount || 0} events</span>
            ${f.lastSynced ? `<span style="font-size: 0.72rem; color: var(--text-muted);">Synced: ${f.lastSynced}</span>` : ""}
          </div>
          <div style="display: flex; align-items: center; gap: 8px; margin-top: 3px;">
            <span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600;">Assigned To:</span>
            <select onchange="changeFeedMember('${f.id}', this.value)" style="padding: 3px 8px; font-size: 0.82rem; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-weight: 600; cursor: pointer;">
              ${optionsHtml}
            </select>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <button type="button" class="btn-hub ghost" onclick="syncFeedFromSettings('${f.id}')" title="Sync this calendar now" style="padding: 5px 9px; font-size: 0.82rem;">🔄 Sync</button>
          <button type="button" onclick="deleteFeedFromSettings('${f.id}')" title="Delete Feed" style="background: none; border: none; cursor: pointer; color: #ef4444; font-size: 1.1rem; padding: 4px 6px;">🗑️</button>
        </div>
      </div>
    `;
  }).join("");
}

async function changeFeedMember(feedId, memberId) {
  let feedColor = "#4285F4";
  if (memberId !== "all") {
    const mem = (appState.members || []).find((m) => m.id === memberId);
    if (mem && mem.color) feedColor = mem.color;
  }
  try {
    const res = await fetch(`/api/feeds/${feedId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, color: feedColor }),
    });
    if (res.ok) {
      await loadState();
      renderSettingsFeeds();
      renderFeedsList();
      renderCalendar();
    }
  } catch (err) {
    console.error("Error updating calendar assignment:", err);
  }
}

async function syncFeedFromSettings(feedId) {
  try {
    await fetch(`/api/feeds/${feedId}/sync`, { method: "POST" });
    await loadState();
    renderSettingsFeeds();
    renderFeedsList();
    renderCalendar();
  } catch (err) {
    alert("Sync error: " + err.message);
  }
}

async function addGoogleCalFromSettings() {
  const urlInput = document.getElementById("set-gcal-url");
  const nameInput = document.getElementById("set-gcal-name");
  const memberSel = document.getElementById("set-gcal-member");
  const statusEl = document.getElementById("set-gcal-status");
  const btnConnect = document.getElementById("btn-add-gcal-settings");

  if (!urlInput || !statusEl) return;
  const url = urlInput.value.trim();
  const name = (nameInput && nameInput.value.trim()) || "Google Calendar";
  const memberId = (memberSel && memberSel.value) || "all";

  if (!url) {
    statusEl.className = "live-status-card error";
    statusEl.style.display = "flex";
    statusEl.innerHTML = `<span>⚠️</span> <span>Please paste your Google Calendar Secret iCal URL.</span>`;
    urlInput.focus();
    return;
  }

  statusEl.className = "live-status-card loading";
  statusEl.style.display = "flex";
  statusEl.innerHTML = `<span>⏳</span> <span>Connecting to Google Calendar & testing iCal stream...</span>`;
  if (btnConnect) btnConnect.disabled = true;

  try {
    const testRes = await fetch("/api/feeds/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, name, memberId }),
    });
    const testData = await testRes.json();

    if (testData.status === "ok") {
      let feedColor = "#4285F4";
      if (memberId !== "all") {
        const mem = (appState.members || []).find((m) => m.id === memberId);
        if (mem && mem.color) feedColor = mem.color;
      }

      await fetch("/api/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          provider: "google",
          url,
          color: feedColor,
          memberId,
        }),
      });

      await loadState();
      renderSettingsFeeds();
      renderFeedsList();
      renderCalendar();

      const previewText = testData.preview && testData.preview.length > 0 ? ` (Found: "${testData.preview.slice(0, 3).join('", "')}")` : "";
      statusEl.className = "live-status-card success";
      statusEl.innerHTML = `<span>✅</span> <span><strong>Connected!</strong> Synced ${testData.eventCount} events${previewText}.</span>`;
      urlInput.value = "";
    } else {
      statusEl.className = "live-status-card error";
      statusEl.innerHTML = `<span>❌</span> <span>${testData.message || "Could not connect to calendar."}</span>`;
    }
  } catch (err) {
    statusEl.className = "live-status-card error";
    statusEl.innerHTML = `<span>❌</span> <span>Connection error: ${err.message}</span>`;
  } finally {
    if (btnConnect) btnConnect.disabled = false;
  }
}

async function deleteFeedFromSettings(feedId) {
  const confirmed = await showAppConfirm("Are you sure you want to remove this calendar feed and its synced events?", {
    title: "Remove Calendar Feed?",
    icon: "📅",
    confirmText: "Remove Feed",
    isDanger: true,
  });
  if (!confirmed) return;
  try {
    const res = await fetch(`/api/feeds/${feedId}`, { method: "DELETE" });
    if (res.ok) {
      await loadState();
      renderSettingsFeeds();
      renderCalendar();
    }
  } catch (err) {
    console.error("Error deleting feed:", err);
  }
}

async function syncAllFeedsFromSettings() {
  const statusEl = document.getElementById("set-gcal-status");
  if (statusEl) {
    statusEl.className = "live-status-card loading";
    statusEl.style.display = "flex";
    statusEl.innerHTML = `<span>🔄</span> <span>Syncing all connected calendars...</span>`;
  }
  try {
    const res = await fetch("/api/feeds/sync-all", { method: "POST" });
    const data = await res.json();
    await loadState();
    renderSettingsFeeds();
    renderCalendar();
    if (statusEl) {
      statusEl.className = "live-status-card success";
      statusEl.innerHTML = `<span>✅</span> <span>All calendars synced! Total events: ${data.totalEvents || 0}</span>`;
    }
  } catch (err) {
    if (statusEl) {
      statusEl.className = "live-status-card error";
      statusEl.innerHTML = `<span>❌</span> <span>Error syncing calendars: ${err.message}</span>`;
    }
  }
}

function renderSettingsLists() {
  const container = document.getElementById("settings-lists-list");
  if (!container) return;
  const lists = appState.lists || [];
  if (lists.length === 0) {
    container.innerHTML = `<div style="font-size:0.8rem; color:var(--text-muted); font-style:italic;">No shared lists yet. Create one below!</div>`;
    return;
  }
  container.innerHTML = lists.map(lst => `
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: var(--bg-hover); border-radius: 6px; border: 1px solid var(--border-color);">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-weight: 600; font-size: 0.9rem;">${lst.title}</span>
        <span style="font-size: 0.75rem; color: var(--text-muted); background: var(--bg-card); padding: 2px 6px; border-radius: 4px;">${(lst.items || []).length} items</span>
      </div>
      <button type="button" onclick="deleteListFromSettings('${lst.id}')" title="Delete List" style="background: none; border: none; cursor: pointer; color: #ef4444; font-size: 1rem; padding: 2px 6px;">🗑️</button>
    </div>
  `).join("");
}

async function addListFromSettings() {
  const input = document.getElementById("new-list-title");
  if (!input) return;
  const title = input.value.trim();
  if (!title) {
    input.focus();
    return;
  }
  try {
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      input.value = "";
      await loadState();
      renderSettingsLists();
      renderLists();
    }
  } catch (err) {
    console.error("Failed to create list:", err);
  }
}

async function deleteListFromSettings(listId) {
  const confirmed = await showAppConfirm("Are you sure you want to delete this list and all its items?", {
    title: "Delete List?",
    icon: "🛒",
    confirmText: "Delete List",
    isDanger: true,
  });
  if (!confirmed) return;
  try {
    const res = await fetch(`/api/lists/${listId}`, { method: "DELETE" });
    if (res.ok) {
      await loadState();
      renderSettingsLists();
      renderLists();
    }
  } catch (err) {
    console.error("Failed to delete list:", err);
  }
}

async function resetCleanData() {
  const confirmed = await showAppConfirm("⚠️ This will permanently remove all sample/demo events, chores, meals, and lists, resetting to a clean slate. Proceed?", {
    title: "Reset to Clean Slate?",
    icon: "⚠️",
    confirmText: "Reset All",
    isDanger: true,
  });
  if (!confirmed) return;
  try {
    const res = await fetch("/api/reset-clean", { method: "POST" });
    if (res.ok) {
      await loadState();
      closeModal("modal-settings");
      alert("✅ All demo data removed successfully!");
    }
  } catch (err) {
    alert("Error resetting data: " + err);
  }
}

async function saveSettings(e) {
  e.preventDefault();
  const deviceName = document.getElementById("set-device-name").value;
  const wakeTime = document.getElementById("set-wake-time").value;
  const sleepTime = document.getElementById("set-sleep-time").value;
  const weatherLocation = document.getElementById("set-weather-loc").value;
  const skylightEmail = document.getElementById("set-skylight-email").value;
  const splitDefault = document.getElementById("set-split-default") ? document.getElementById("set-split-default").value : "photos";
  const slideshowIntervalSec = document.getElementById("set-slideshow-interval") ? parseInt(document.getElementById("set-slideshow-interval").value, 10) : 8;
  const daytimeScreensaverEnabled = document.getElementById("set-screensaver-enabled") ? document.getElementById("set-screensaver-enabled").checked : true;
  const daytimeScreensaverTimeoutMins = document.getElementById("set-screensaver-timeout") ? parseInt(document.getElementById("set-screensaver-timeout").value, 10) : 5;

  try {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceName, wakeTime, sleepTime, weatherLocation, skylightEmail, splitDefault, slideshowIntervalSec, daytimeScreensaverEnabled, daytimeScreensaverTimeoutMins }),
    });
    const data = await res.json();
    if (data.weather) {
      appState.weather = data.weather;
      renderWeather();
    }
  } catch (err) {
    console.error("Error saving settings:", err);
  }
  await loadState();
  startPhotoSlideshow();
  resetScreensaverIdleTimer();
  closeModal("modal-settings");
}

// ---------------------------------------------------------------------------
// 7. First-Time Setup Wizard Controller
// ---------------------------------------------------------------------------
let currentWizardStep = 1;
let wizardLocationData = null;

function openSetupWizard() {
  // Prevent re-opening setup once completed
  if (appState.settings && appState.settings.setupCompleted) {
    return;
  }
  currentWizardStep = 1;
  wizardLocationData = null;

  const s = appState.settings || {};
  const devInput = document.getElementById("wiz-device-name");
  const locInput = document.getElementById("wiz-weather-loc");
  const wakeInput = document.getElementById("wiz-wake-time");
  const sleepInput = document.getElementById("wiz-sleep-time");
  const emailInput = document.getElementById("wiz-skylight-email");

  if (devInput) devInput.value = s.deviceName || "Kitchen Family Hub 15\"";
  if (locInput) locInput.value = s.weatherLocation || "Seattle, WA";
  if (wakeInput) wakeInput.value = s.wakeTime || "06:30";
  if (sleepInput) sleepInput.value = s.sleepTime || "22:00";
  if (emailInput) emailInput.value = s.skylightEmail || "family-hub@local";

  renderWizardMembers();
  updateWizardMemberDropdown();
  renderWizardFeeds();

  const statusEl = document.getElementById("wiz-weather-status");
  if (statusEl) statusEl.style.display = "none";
  const gcalStatus = document.getElementById("wiz-gcal-status");
  if (gcalStatus) gcalStatus.style.display = "none";

  goToWizardStep(1);
  openModal("modal-wizard");
}

function goToWizardStep(step) {
  currentWizardStep = step;

  // Toggle step panes
  for (let i = 1; i <= 5; i++) {
    const pane = document.getElementById(`wiz-pane-${i}`);
    if (pane) pane.classList.toggle("active", i === step);

    const node = document.getElementById(`wiz-node-${i}`);
    if (node) {
      node.classList.toggle("active", i === step);
      node.classList.toggle("completed", i < step);
    }
  }

  // Update Footer buttons
  const btnBack = document.getElementById("wiz-btn-back");
  const btnNext = document.getElementById("wiz-btn-next");
  const btnSkip = document.getElementById("wiz-btn-skip");

  if (btnBack) btnBack.style.display = step > 1 && step < 5 ? "inline-block" : "none";
  if (btnSkip) btnSkip.style.display = step === 3 ? "inline-block" : "none";

  if (btnNext) {
    if (step === 5) {
      btnNext.style.display = "none";
    } else {
      btnNext.style.display = "inline-block";
      btnNext.textContent = step === 4 ? "Review & Finish ›" : "Next Step ›";
    }
  }

  if (step === 2) {
    renderWizardMembers();
  } else if (step === 3) {
    updateWizardMemberDropdown();
    renderWizardFeeds();
  } else if (step === 5) {
    renderWizardSummary();
  }
}

function wizardNext() {
  if (currentWizardStep < 5) {
    goToWizardStep(currentWizardStep + 1);
  }
}

function wizardBack() {
  if (currentWizardStep > 1) {
    goToWizardStep(currentWizardStep - 1);
  }
}

function wizardSkip() {
  goToWizardStep(4);
}

async function checkWizardWeather() {
  const locInput = document.getElementById("wiz-weather-loc");
  const statusEl = document.getElementById("wiz-weather-status");
  if (!locInput || !statusEl) return;

  const loc = locInput.value.trim();
  if (!loc) return;

  statusEl.className = "live-status-card loading";
  statusEl.style.display = "flex";
  statusEl.innerHTML = `<span>⏳</span> <span>Looking up weather coordinates for "${loc}"...</span>`;

  try {
    const res = await fetch(`/api/weather/geocode?q=${encodeURIComponent(loc)}`);
    const data = await res.json();
    if (data.status === "ok") {
      wizardLocationData = data;
      locInput.value = data.location;
      statusEl.className = "live-status-card success";
      statusEl.innerHTML = `<span>✅</span> <span>Verified: <strong>${data.location}</strong> (${data.timezone || "Local Timezone"})</span>`;
    } else {
      statusEl.className = "live-status-card error";
      statusEl.innerHTML = `<span>⚠️</span> <span>Could not find location. You can still proceed with this name.</span>`;
    }
  } catch (err) {
    statusEl.className = "live-status-card error";
    statusEl.innerHTML = `<span>⚠️</span> <span>Weather check failed: ${err.message}</span>`;
  }
}

function selectWizardAvatar(emoji) {
  const hidden = document.getElementById("wiz-selected-avatar");
  if (hidden) hidden.value = emoji;
  document.querySelectorAll("#wiz-avatar-picker .emoji-btn").forEach((btn) => {
    btn.classList.toggle("selected", btn.textContent.trim() === emoji);
  });
}

function selectWizardColor(color) {
  const hidden = document.getElementById("wiz-selected-color");
  if (hidden) hidden.value = color;
  document.querySelectorAll("#wiz-color-picker .color-swatch-btn").forEach((btn) => {
    btn.classList.toggle("selected", btn.style.background === color || btn.style.backgroundColor === color);
  });
}

function renderWizardMembers() {
  const list = document.getElementById("wiz-members-list");
  if (!list) return;

  if (!appState.members || appState.members.length === 0) {
    list.innerHTML = `<div style="font-size:0.83rem; color:var(--text-muted); font-style:italic;">No profiles added yet. Add your family below!</div>`;
    return;
  }

  list.innerHTML = appState.members
    .map(
      (m) => `
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 7px 12px; background: var(--bg-card); border-radius: 8px; border: 1px solid var(--border-subtle);">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 1.35rem;">${m.avatar || "👤"}</span>
        <span style="width: 14px; height: 14px; border-radius: 50%; background: ${m.color || "#0284c7"}; display: inline-block;"></span>
        <span style="font-weight: 700; font-size: 0.95rem;">${m.name}</span>
      </div>
      <button type="button" onclick="deleteMemberFromWizard('${m.id}')" title="Remove Profile" style="background: none; border: none; cursor: pointer; color: #ef4444; font-size: 1rem; padding: 2px 6px;">🗑️</button>
    </div>
  `
    )
    .join("");

  updateWizardMemberDropdown();
}

function updateWizardMemberDropdown() {
  const sel = document.getElementById("wiz-gcal-member");
  if (!sel) return;

  let opts = `<option value="all">🏡 Entire Family (Shared)</option>`;
  if (appState.members && appState.members.length > 0) {
    for (const m of appState.members) {
      opts += `<option value="${m.id}">${m.avatar || "👤"} ${m.name}</option>`;
    }
  }
  sel.innerHTML = opts;
}

async function addMemberFromWizard() {
  const nameInput = document.getElementById("wiz-new-mem-name");
  const avatarInput = document.getElementById("wiz-selected-avatar");
  const colorInput = document.getElementById("wiz-selected-color");
  if (!nameInput) return;

  const name = nameInput.value.trim();
  if (!name) {
    nameInput.focus();
    return;
  }
  const avatar = avatarInput ? avatarInput.value : "👤";
  const color = colorInput ? colorInput.value : "#0284c7";

  try {
    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, avatar, color }),
    });
    if (res.ok) {
      nameInput.value = "";
      await loadState();
      renderWizardMembers();
    }
  } catch (err) {
    console.error("Error adding member in wizard:", err);
  }
}

async function deleteMemberFromWizard(memberId) {
  try {
    const res = await fetch(`/api/members/${memberId}`, { method: "DELETE" });
    if (res.ok) {
      await loadState();
      renderWizardMembers();
    }
  } catch (err) {
    console.error("Error deleting member in wizard:", err);
  }
}

async function testAndConnectGoogleCal() {
  const urlInput = document.getElementById("wiz-gcal-url");
  const nameInput = document.getElementById("wiz-gcal-name");
  const memberSel = document.getElementById("wiz-gcal-member");
  const statusEl = document.getElementById("wiz-gcal-status");
  const btnConnect = document.getElementById("wiz-btn-connect-gcal");

  if (!urlInput || !statusEl) return;
  const url = urlInput.value.trim();
  const name = (nameInput && nameInput.value.trim()) || "Google Calendar";
  const memberId = (memberSel && memberSel.value) || "all";

  if (!url) {
    statusEl.className = "live-status-card error";
    statusEl.style.display = "flex";
    statusEl.innerHTML = `<span>⚠️</span> <span>Please paste your Google Calendar Secret iCal URL first.</span>`;
    urlInput.focus();
    return;
  }

  // Show loading
  statusEl.className = "live-status-card loading";
  statusEl.style.display = "flex";
  statusEl.innerHTML = `<span>⏳</span> <span>Connecting to Google Calendar & testing iCal stream...</span>`;
  if (btnConnect) btnConnect.disabled = true;

  try {
    // Test the feed
    const testRes = await fetch("/api/feeds/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, name, memberId }),
    });
    const testData = await testRes.json();

    if (testData.status === "ok") {
      // Feed tested successfully! Save it permanently to feeds
      await fetch("/api/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          provider: "google",
          url,
          color: "#4285F4",
          memberId,
        }),
      });

      await loadState();
      renderWizardFeeds();

      const previewText = testData.preview && testData.preview.length > 0 ? ` (Found: "${testData.preview.slice(0, 3).join('", "')}")` : "";
      statusEl.className = "live-status-card success";
      statusEl.innerHTML = `<span>✅</span> <span><strong>Connected!</strong> Successfully synced ${testData.eventCount} events${previewText}.</span>`;
      urlInput.value = "";
    } else {
      statusEl.className = "live-status-card error";
      statusEl.innerHTML = `<span>❌</span> <span>${testData.message || "Could not connect to calendar."}</span>`;
    }
  } catch (err) {
    statusEl.className = "live-status-card error";
    statusEl.innerHTML = `<span>❌</span> <span>Connection error: ${err.message}</span>`;
  } finally {
    if (btnConnect) btnConnect.disabled = false;
  }
}

function renderWizardFeeds() {
  const container = document.getElementById("wiz-connected-feeds");
  const section = document.getElementById("wiz-feeds-section");
  if (!container || !section) return;

  const feeds = appState.feeds || [];
  if (feeds.length === 0) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";
  container.innerHTML = feeds
    .map(
      (f) => `
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 7px 12px; background: var(--bg-surface); border-radius: 8px; border: 1px solid var(--border-card);">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 1.1rem;">📅</span>
        <strong style="font-size: 0.88rem;">${f.name}</strong>
        <span style="font-size: 0.75rem; color: var(--text-muted); background: var(--bg-hover); padding: 2px 6px; border-radius: 4px;">${f.eventCount || 0} events</span>
      </div>
      <button type="button" onclick="deleteFeedFromWizard('${f.id}')" title="Remove Feed" style="background: none; border: none; cursor: pointer; color: #ef4444; font-size: 0.95rem;">✕</button>
    </div>
  `
    )
    .join("");
}

async function deleteFeedFromWizard(feedId) {
  try {
    await fetch(`/api/feeds/${feedId}`, { method: "DELETE" });
    await loadState();
    renderWizardFeeds();
  } catch (err) {
    console.error("Error deleting feed:", err);
  }
}

function renderWizardSummary() {
  const card = document.getElementById("wiz-summary-card");
  if (!card) return;

  const devName = (document.getElementById("wiz-device-name") && document.getElementById("wiz-device-name").value) || "Kitchen Family Hub";
  const weatherLoc = (document.getElementById("wiz-weather-loc") && document.getElementById("wiz-weather-loc").value) || "Seattle, WA";
  const wakeTime = (document.getElementById("wiz-wake-time") && document.getElementById("wiz-wake-time").value) || "06:30";
  const sleepTime = (document.getElementById("wiz-sleep-time") && document.getElementById("wiz-sleep-time").value) || "22:00";

  const memberBadges = (appState.members || [])
    .map(
      (m) => `
    <span style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 999px; background: ${m.color}20; color: ${m.color}; font-weight: 700; font-size: 0.8rem; border: 1px solid ${m.color}40;">
      <span>${m.avatar || "👤"}</span> ${m.name}
    </span>
  `
    )
    .join(" ");

  const feedList = (appState.feeds || [])
    .map((f) => `<span style="font-size: 0.8rem; font-weight: 600; color: #4285F4;">📅 ${f.name} (${f.eventCount || 0} events)</span>`)
    .join(", ");

  card.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.85rem;">
      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 6px;">
        <span style="color: var(--text-muted);">🏡 Device:</span>
        <strong>${devName}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 6px;">
        <span style="color: var(--text-muted);">📍 Location & Weather:</span>
        <strong>${weatherLoc}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 6px;">
        <span style="color: var(--text-muted);">💤 Display Schedule:</span>
        <span>Wake: <strong>${wakeTime}</strong> / Sleep: <strong>${sleepTime}</strong></span>
      </div>
      <div style="border-bottom: 1px solid var(--border-subtle); padding-bottom: 6px;">
        <div style="color: var(--text-muted); margin-bottom: 4px;">👨‍👩‍👧‍👦 Family Profiles:</div>
        <div>${memberBadges || "<em>No profiles</em>"}</div>
      </div>
      <div>
        <div style="color: var(--text-muted); margin-bottom: 4px;">📅 Connected Calendars:</div>
        <div>${feedList || '<span style="color:var(--text-muted); font-style:italic;">None (can connect later in Settings)</span>'}</div>
      </div>
    </div>
  `;
}

async function finishSetupWizard() {
  const deviceName = (document.getElementById("wiz-device-name") && document.getElementById("wiz-device-name").value) || "Kitchen Family Hub 15\"";
  const weatherLocation = (document.getElementById("wiz-weather-loc") && document.getElementById("wiz-weather-loc").value) || "Seattle, WA";
  const wakeTime = (document.getElementById("wiz-wake-time") && document.getElementById("wiz-wake-time").value) || "06:30";
  const sleepTime = (document.getElementById("wiz-sleep-time") && document.getElementById("wiz-sleep-time").value) || "22:00";
  const skylightEmail = (document.getElementById("wiz-skylight-email") && document.getElementById("wiz-skylight-email").value) || "family-hub@local";

  const starterLists = [];
  if (document.getElementById("wiz-list-grocery") && document.getElementById("wiz-list-grocery").checked) starterLists.push("grocery");
  if (document.getElementById("wiz-list-todo") && document.getElementById("wiz-list-todo").checked) starterLists.push("todo");
  if (document.getElementById("wiz-list-school") && document.getElementById("wiz-list-school").checked) starterLists.push("school");
  if (document.getElementById("wiz-list-packing") && document.getElementById("wiz-list-packing").checked) starterLists.push("packing");

  const payload = {
    deviceName,
    weatherLocation,
    wakeTime,
    sleepTime,
    skylightEmail,
    starterLists,
  };

  if (wizardLocationData) {
    payload.weatherLat = wizardLocationData.lat;
    payload.weatherLon = wizardLocationData.lon;
    payload.timezone = wizardLocationData.timezone;
  }

  try {
    const res = await fetch("/api/setup/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      if (window.confetti) {
        window.confetti({
          particleCount: 160,
          spread: 100,
          origin: { y: 0.5 },
          colors: ["#0284c7", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6"],
        });
      }
      closeModal("modal-wizard");
      await loadState();
      renderActiveNav();
      if (appState.splitScreen) renderSplitSidePane();
    }
  } catch (err) {
    alert("Error completing setup: " + err.message);
  }
}

window.onload = init;
