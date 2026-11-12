# Skylight Family Calendar & Smart Touchscreen Hub

An open-source, touch-optimized family organization hub replicating the authentic Skylight Calendar experience. Designed for kitchen displays, Raspberry Pi touchscreen setups, wall-mounted tablets, and always-on smart home dashboards.

![Skylight Hub](https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=1200&auto=format&fit=crop)

---

## ✨ Features

- **📅 Interactive Touch Calendar**: Segmented views for **Schedule**, **Day**, **3-Day**, **Week**, **Month**, and **Split Screen** (Calendar + Photo Frame). Click any event to edit or delete.
- **👨‍👩‍👧‍👦 Family Color-Coding**: Assign distinct colors and emoji avatars to each household member. Events, chores, and lists are color-coded at a glance.
- **🔗 Google Calendar 2-Way Sync**: Connect multiple Google Calendars via Secret iCal addresses. Background worker continuously syncs feeds every 15 minutes with automatic local timezone conversion.
- **🪄 Setup Wizard**: 5-step guided onboarding wizard to configure device name, weather geocoding, family profiles, starter lists, and Google Calendar sync.
- **📋 Chores & Star Rewards**: Gamified chore charts with star points, family leaderboard, and confetti animations upon task completion.
- **🍽️ Meal Planner**: Weekly breakfast, lunch, and dinner meal planning matrix.
- **🛒 Shared Lists**: Touch-friendly checklists for Groceries, Household To-Do, and Packing.
- **🖼️ Rotating Photo Frame**: Fullscreen or split-screen digital photo slideshow with custom captions.
- **⛅ Live Weather Widget**: Real-time temperature, condition icons, and 5-day local forecasts powered by Open-Meteo (zero API keys required).
- **🌙 Day / Night Modes & Sleep Scheduler**: Auto-sleeps the screen at night (e.g. 10:00 PM) and wakes in the morning (e.g. 6:30 AM).

---

## 🚀 Quick Start with Docker

```bash
# Clone the repository
git clone https://github.com/diseric/skylight-dashboard.git
cd skylight-dashboard

# Start the application
docker compose up -d --build
```

The application will be live at:
- **`http://localhost:3003`** (or your local IP)

---

## 🛠️ Configuration & Architecture

- **Backend**: FastAPI (Python 3.11), icalendar sync engine, Open-Meteo geocoding.
- **Frontend**: Vanilla JavaScript + High-Contrast Responsive CSS (Libre Franklin typography, 60fps animations).
- **Storage**: Persistent JSON database stored in `./data/skylight_db.json`.
- **Ports**: Runs on port `3003` (mapped in `docker-compose.yml`).

---

## 📄 License
MIT License.
