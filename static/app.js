// Family Hub Touchscreen & Calendar Frontend

let appState = {
  members: [],
  events: [],
  chores: [],
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
  const selects = ["ev-member", "magic-member", "ch-member", "feed-member"];
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
    for (const m of appState.members) {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = `${m.avatar || "👤"} ${m.name}`;
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
  const overlay = document.getElementById("sleep-overlay");
  if (overlay) overlay.classList.remove("hidden");
}

// ---------------------------------------------------------------------------
// Navigation & Views
// ---------------------------------------------------------------------------
function switchNav(navKey) {
  appState.activeNav = navKey;
  document.querySelectorAll(".nav-item, .nav-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === navKey);
  });

  const panels = ["calendar", "chores", "lists", "meals", "photo-frame"];
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
  else if (appState.activeNav === "lists") renderLists();
  else if (appState.activeNav === "meals") renderMeals();
  else if (appState.activeNav === "photo-frame") renderPhotoFrame();
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
      const item = document.createElement("div");
      item.className = `split-chore-item ${chore.completed ? "done" : ""}`;
      item.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        background: var(--bg-surface);
        border-radius: var(--radius-md);
        border: 1px solid var(--border-subtle);
        transition: all 0.15s ease;
        ${chore.completed ? "opacity: 0.55; text-decoration: line-through;" : ""}
      `;
      item.innerHTML = `
        <div class="split-chore-check" title="Tap to mark complete" style="
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px solid ${chore.completed ? "var(--accent-green)" : "var(--border-color)"};
          background: ${chore.completed ? "var(--accent-green)" : "transparent"};
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
          <div style="font-size: 0.72rem; color: var(--text-muted); display: flex; gap: 6px; align-items: center; margin-top: 1px;">
            <span>${m.avatar} ${m.name}</span>
            <span>•</span>
            <span style="color: var(--accent-gold); font-weight: 700;">+${chore.points} ⭐</span>
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
  } else if (view === "day") {
    renderDayView(mount, titleLabel, filteredEvents, 1);
  } else if (view === "3day") {
    renderDayView(mount, titleLabel, filteredEvents, 3);
  } else if (view === "month") {
    renderMonthView(mount, titleLabel, filteredEvents);
  } else if (view === "schedule") {
    renderScheduleListView(mount, titleLabel, filteredEvents);
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
      .filter((e) => e.date === dateIso)
      .sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"));

    for (const ev of dayEvents) {
      const card = createEventCard(ev);
      eventsContainer.appendChild(card);
    }

    mount.appendChild(col);
  }
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
      .filter((e) => e.date === dateIso)
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

    const dayEvents = events.filter((e) => e.date === dateIso);
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
  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <span class="event-card-time">${ev.time || "All Day"}${ev.endTime ? " - " + ev.endTime : ""}</span>
      <span style="font-size: 0.85rem;" title="${m.name}">${m.avatar || "👤"}</span>
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

function getChoreFrequencyCategory(freq) {
  if (!freq) return "Daily";
  const f = freq.toLowerCase();
  if (f.includes("week")) return "Weekly";
  if (f.includes("need") || f.includes("one") || f.includes("time")) return "As Needed";
  return "Daily";
}

function openNewChoreForMember(memberId) {
  openNewChoreModal();
  const mSel = document.getElementById("ch-member");
  if (mSel && memberId) mSel.value = memberId;
}

// ---------------------------------------------------------------------------
// 2. Interactive Chore Tracker with Confetti Rewards
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

  // 2. Identify assigned persons / groups to display
  let membersToDisplay = appState.activeMemberFilter === "all"
    ? [...appState.members]
    : appState.members.filter((m) => m.id === appState.activeMemberFilter);

  // If "all" filter is active, check if there are chores assigned to "all" (Entire Family)
  const sharedChores = (appState.chores || []).filter((c) => c.memberId === "all");
  if (sharedChores.length > 0 && appState.activeMemberFilter === "all") {
    membersToDisplay.unshift({
      id: "all",
      name: "Entire Family (Shared)",
      avatar: "🏡",
      color: "#0284c7",
      points: sharedChores.reduce((sum, c) => sum + (c.points || 0), 0),
    });
  }

  if (membersToDisplay.length === 0) {
    grid.innerHTML = `<div style="text-align: center; padding: 3rem; color: var(--text-muted); width: 100%;">No family members found. Add profiles in Settings!</div>`;
    return;
  }

  const subcats = [
    { key: "Daily", label: "Daily Routines", icon: "🌅" },
    { key: "Weekly", label: "Weekly Tasks", icon: "📅" },
    { key: "As Needed", label: "As Needed / One-Time", icon: "⚡" },
  ];

  for (const member of membersToDisplay) {
    const memberChores = (appState.chores || []).filter((c) => {
      if (member.id === "all") return c.memberId === "all";
      if (appState.activeMemberFilter !== "all") {
        return c.memberId === member.id || c.memberId === "all";
      }
      return c.memberId === member.id;
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
        <button type="button" class="btn-hub ghost mini-btn" onclick="openNewChoreForMember('${member.id}')" title="Add task for ${member.name}">+ Task</button>
      </div>
      <div class="member-subcategories-container"></div>
    `;

    const subcatsContainer = col.querySelector(".member-subcategories-container");

    for (const sub of subcats) {
      const choresInSub = memberChores.filter(
        (c) => getChoreFrequencyCategory(c.frequency) === sub.key
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
            <span>No ${sub.label.toLowerCase()}</span>
          </div>
        `;
      } else {
        for (const chore of choresInSub) {
          const isShared = chore.memberId === "all" && member.id !== "all";
          const card = document.createElement("div");
          card.className = `chore-card ${chore.completed ? "done" : ""}`;
          card.innerHTML = `
            <div class="chore-left">
              <div class="chore-checkbox" title="Tap to mark complete">${chore.completed ? "✓" : ""}</div>
              <div class="chore-info" title="Tap to edit task">
                <h3>${chore.title}</h3>
                ${isShared ? `<div class="chore-meta"><span style="color: #0284c7; font-weight: 600;">🏡 Shared Task</span></div>` : ""}
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <div class="chore-points">+${chore.points} ⭐</div>
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
// 8. Sleep Mode Scheduler (Automatic Wake/Sleep)
// ---------------------------------------------------------------------------
function startSleepScheduler() {
  function checkSchedule() {
    const set = appState.settings;
    if (!set.sleepEnabled) return;

    const now = new Date();
    const curTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const sleepTime = set.sleepTime || "22:00";
    const wakeTime = set.wakeTime || "06:30";

    const overlay = document.getElementById("sleep-overlay");
    if (!overlay) return;

    // Check if time is between sleepTime and wakeTime
    let isSleepingTime = false;
    if (sleepTime > wakeTime) {
      isSleepingTime = curTime >= sleepTime || curTime < wakeTime;
    } else {
      isSleepingTime = curTime >= sleepTime && curTime < wakeTime;
    }

    if (isSleepingTime && overlay.classList.contains("hidden")) {
      overlay.classList.remove("hidden");
    }
  }

  setInterval(checkSchedule, 15000);
}

function wakeScreen() {
  const overlay = document.getElementById("sleep-overlay");
  if (overlay) overlay.classList.add("hidden");
}

function triggerImmediateSleep() {
  closeModal("modal-settings");
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

  const payload = { title, date, time, endTime, memberId, location, notes };

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

function openNewChoreModal() {
  const form = document.getElementById("form-chore");
  if (form) form.reset();
  const idEl = document.getElementById("ch-id");
  if (idEl) idEl.value = "";
  const titEl = document.getElementById("modal-chore-title");
  if (titEl) titEl.textContent = "+ Add Family Task / Chore";
  const subBtn = document.getElementById("ch-btn-submit");
  if (subBtn) subBtn.textContent = "Add Chore";
  const delBtn = document.getElementById("ch-btn-delete");
  if (delBtn) delBtn.style.display = "none";
  const ptsEl = document.getElementById("ch-points");
  if (ptsEl) ptsEl.value = "10";
  populateSelectDropdowns();

  const mSel = document.getElementById("ch-member");
  if (mSel) {
    if (appState.activeMemberFilter && appState.activeMemberFilter !== "all") {
      mSel.value = appState.activeMemberFilter;
    } else if (appState.members && appState.members.length > 0) {
      mSel.value = appState.members[0].id;
    }
  }

  openModal("modal-chore");
}

function openEditChoreModal(choreId) {
  const chore = (appState.chores || []).find((c) => c.id === choreId);
  if (!chore) return;

  const idEl = document.getElementById("ch-id");
  if (idEl) idEl.value = chore.id;
  const titEl = document.getElementById("modal-chore-title");
  if (titEl) titEl.textContent = "✏️ Edit Family Task / Chore";

  const tEl = document.getElementById("ch-title");
  if (tEl) tEl.value = chore.title || "";

  populateSelectDropdowns();
  const mEl = document.getElementById("ch-member");
  if (mEl && chore.memberId) mEl.value = chore.memberId;

  const ptsEl = document.getElementById("ch-points");
  if (ptsEl) ptsEl.value = chore.points !== undefined ? chore.points : 10;

  const freqEl = document.getElementById("ch-freq");
  if (freqEl && chore.frequency) freqEl.value = chore.frequency;

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
  const memberId = document.getElementById("ch-member").value;
  const points = parseInt(document.getElementById("ch-points").value, 10) || 10;
  const frequency = document.getElementById("ch-freq").value;

  try {
    if (choreId) {
      await fetch(`/api/chores/${choreId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: choreId, title, memberId, points, frequency }),
      });
    } else {
      await fetch("/api/chores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, memberId, points, frequency }),
      });
    }
    await loadState();
    if (appState.splitScreen) renderSplitSidePane();
    closeModal("modal-chore");
    const form = document.getElementById("form-chore");
    if (form) form.reset();
  } catch (err) {
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
  renderSettingsMembers();
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
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--bg-hover); border-radius: 8px; border: 1px solid var(--border-color);">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 1.3rem;">${m.avatar || "👤"}</span>
        <span style="width: 14px; height: 14px; border-radius: 50%; background: ${m.color || "#0284c7"}; display: inline-block;"></span>
        <span style="font-weight: 600; font-size: 0.92rem;">${m.name}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <button type="button" onclick="openEditPointsModal('${m.id}')" title="Edit ${m.name}'s points" style="background: rgba(251, 191, 36, 0.15); border: 1px solid rgba(251, 191, 36, 0.35); color: var(--accent-gold); font-weight: 700; font-size: 0.82rem; padding: 4px 10px; border-radius: var(--radius-pill); cursor: pointer; display: flex; align-items: center; gap: 4px;">
          <span>${m.points || 0} ⭐</span>
          <span style="font-size: 0.7rem;">✏️</span>
        </button>
        <button type="button" onclick="deleteMemberFromSettings('${m.id}')" title="Delete Profile" style="background: none; border: none; cursor: pointer; color: #ef4444; font-size: 1rem; padding: 2px 6px;">🗑️</button>
      </div>
    </div>
  `).join("");
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

  try {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceName, wakeTime, sleepTime, weatherLocation, skylightEmail, splitDefault, slideshowIntervalSec }),
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
