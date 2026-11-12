# Family Hub — Smart Touchscreen Calendar & Family Dashboard

An open-source, touch-optimized family organization hub designed for kitchen displays, Raspberry Pi touchscreens, wall-mounted tablets (iPads/Android), smart TVs, and mobile management from smartphones. A complete, private, self-hosted alternative to proprietary smart family calendars like Skylight.

![Family Hub](https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=1200&auto=format&fit=crop)

---

## ✨ Features & Functionality

### 🏠 The Home Screen Overview
- **Unified Family Command Center**: Combines your interactive Calendar and Today's Tasks side rail into a clean dashboard.
- **Time-of-Day Auto-Displaying Tasks**: Automatically surfaces routines matching the current time of day (**Morning**, **Afternoon**, or **Evening**) with a 1-tap period switcher.
- **Stacked Row Layout**: Tasks are stacked in full-width vertical rows per child for natural reading and easy touch tapping on wall displays and tablets.
- **Customizable Panes**: Choose which panes to show alongside your calendar using the **⚙️ Customize** menu (toggle Tasks on/off, choose default Calendar view and task filter).
- **Universal Add Button (`+ Add ▾`)**: One-tap quick menu to instantly create a **New Event**, **New Task/Routine**, **New List Item**, or **Start a Timer**.
- **Responsive Layout**: Side-by-side split on kitchen wall displays and iPad landscape; vertically responsive stack on smartphones.

### 📅 Interactive Touch Calendar
- **6 Segmented Calendar Views**:
  - **Schedule View**: Chronological agenda list of upcoming family events.
  - **Day View**: Hourly timeline view for today.
  - **3-Day View**: Multi-day outlook with hourly columns.
  - **Week View**: Full 7-day Monday–Sunday matrix with colored event pills.
  - **Month View**: Complete monthly grid with color-coded day indicators.
  - **Split Screen**: Side-by-side view pairing your Calendar with Photos, Chores, Lists, or Meals.
- **Color-Coded Profiles**: Events are color-coded by household member with live dot indicators.
- **2-Way Google Calendar Sync**: Connect multiple Google Calendars via Secret iCal URLs with 15-minute background auto-sync and timezone preservation.

### ⏱️ Family Timers
- **1-Tap Quick Presets**:
  - 🪥 **2 min**: Brush Teeth
  - 🧸 **5 min**: Quick Clean-Up
  - 📱 **10 min**: Screen Time
  - 📚 **15 min**: Reading & Homework
  - 🍳 **20 min**: Kitchen & Chores
  - 💤 **30 min**: Quiet Time / Nap
- **Custom Timer Dial**: Set any minute/second duration with custom labels.
- **Live Pulsing Countdown Pill**: Displays real-time countdown in the top bar (`⏱️ 04:32 (Clean Up)`).
- **Celebration Finish**: Melodic musical chime (Web Audio API synthesis), confetti burst, and notification when time is up.

### 📋 Chores & Daily Routines Tracker
- **Multi-Member Assignment**: Assign tasks or habits to multiple children simultaneously with independent tracking per child.
- **⚡ Up for Grabs Tasks**: Create open tasks (e.g. *Feeding pets*, *Emptying trash*) claimable by whichever child finishes first to earn stars.
- **Pre-Set Age Routines**: Built-in curated habit sets:
  - **Toddlers & Preschoolers (2–4)**: Go potty, get dressed, brush teeth & hair, put away toys.
  - **Early Elementary (5–8)**: Make bed, get dressed, brush teeth, clear plate, pack backpack & water bottle, feed pets.
  - **Tweens & Teens (9+)**: Tidy room, hygiene routine, pack lunch, unload dishwasher, check school & sports gear.
- **Daypart Routines**: Filter by Morning, Afternoon, Evening, or Daily habits with automatic time-of-day switching.
- **Touch Check-Off**: Tap checkboxes to mark tasks complete, earning stars with instant audio chimes and confetti animations.

### ⭐ Star Goals & Rewards System
- **Gamified Motivation**: Kids earn star points for completing chores and redeem them for customizable reward goals (e.g. *50 ⭐ Ice Cream Trip*, *100 ⭐ Movie Night*).
- **🤝 Shared Collective Goals**: Goals assigned to multiple children pool their earned stars together into a collective total (e.g. Child A: 10 ⭐ + Child B: 5 ⭐ = 15 ⭐ toward the goal).
- **Fair Proportional Redemption**: When redeeming shared goals, stars are deducted proportionally so no child ever goes negative.
- **Visual Progress Bars**: Real-time progress indicators per child showing stars accumulated vs. required.
- **Participation Settings**: Exclude parents/adults from the rewards leaderboard so participating kids' cards expand to fill the screen.
- **Auto-Renewing Goals & Redemption History**: Rewards can renew automatically or track historical redemptions with timestamps.

### 🛒 Shared Family Lists
- **Categorized Checklists**: Groceries, Target, Hardware Store, Camping, and Custom Lists.
- **Inline Fast Add**: Type an item and press Enter or tap Add to instantly append items from the Home Screen or Lists tab.
- **Touch Check-Off**: Scratch off items as you shop in real time.

### 🍽️ Weekly Meal Planner
- **Full Week Planning**: Plan Breakfast, Lunch, and Dinner across Monday–Sunday.
- **Recipe & Note Details**: Store quick recipe links or prep notes for each meal.

### 🖼️ Photo Frame & Ambient Screensaver
- **Rotating Photo Frame**: Fullscreen or split-screen digital slideshow featuring family photo albums with Ken Burns animations.
- **Ambient Screensaver**: Displays a clock, date, and weather overlay; taps wake the screen instantly.
- **Daytime Screen Wake Lock**: Prevents wall tablets and iPads from sleeping during daytime active hours.

### 🪄 Magic Import (AI Schedule Extractor)
- **Multi-Provider AI Engine**: Powered by your choice of **Google Gemini** (default / recommended), **OpenAI** (`gpt-4o-mini`), **Anthropic Claude**, **Local Ollama**, or any **Custom OpenAI-compatible endpoint** (Groq, OpenRouter, DeepSeek).
- **Automated Event Parsing**: Paste messy flyers, school newsletters, sports emails, camp schedules, or upload PDF rosters: AI automatically extracts event titles, dates, start/end times, and locations directly onto your family calendar.
- **In-App API Key Management**: Configure and test your authentication keys directly in **Settings ⚙️** with a real-time **⚡ Test Connection** latency check and masked inputs for touchscreen security.
- **Rule-Based Fallback**: Works even without an active AI key using an offline regex heuristic parser.

---

## 🚀 Quick Start Guide

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/) installed on your host (Linux, Raspberry Pi, macOS, or Windows).

### 1. Clone the Repository
```bash
git clone https://github.com/diseric/family-hub.git
cd family-hub
```

### 2. Configure Environment (Optional)
The default `docker-compose.yml` runs out of the box with persistent storage in `./data`:

```yaml
services:
  familyhub:
    build: .
    image: familyhub:latest
    container_name: familyhub
    restart: unless-stopped
    ports:
      - "3003:3003"
    environment:
      - PORT=3003
      - DATA_DIR=/app/data
      - TZ=America/Los_Angeles
      # Optional: Pre-configure AI keys (can also be entered anytime in Settings UI)
      - GEMINI_API_KEY=your_gemini_api_key_here
      # - OPENAI_API_KEY=your_openai_api_key_here
      # - ANTHROPIC_API_KEY=your_anthropic_api_key_here
      # - OLLAMA_HOST=http://host.docker.internal:11434
    volumes:
      - ./data:/app/data
```

### 3. Start the Application
```bash
docker compose up -d --build
```

### 4. Access the Dashboard
Open your browser on any tablet, computer, or phone:
- **`http://localhost:3003`** (or `http://<your-server-ip>:3003`)

The first time you load the app, the **Guided Setup Wizard** will launch to configure:
1. Household / Device Name
2. City / Location (Auto-geocoded for real-time weather via Open-Meteo)
3. Family Member Profiles (Name, Emoji Avatar, and Custom Theme Color)
4. Google Calendar iCal sync links
5. Starter Lists & Chores

### 5. Configure AI Schedule Extractor (Optional)
Family Hub includes **🪄 Magic Import** powered by your preferred AI service:
1. Tap **⚙️ Settings** on the left navigation bar.
2. Scroll down to **🤖 AI Assistant & Schedule Extractor**.
3. Choose your provider:
   - **Google Gemini** (Recommended): Fast, highly accurate, and free tier available via [Google AI Studio](https://aistudio.google.com/apikey).
   - **OpenAI**: Use `gpt-4o-mini` or `gpt-4o` with your OpenAI platform key.
   - **Anthropic Claude**: Use `claude-3-5-haiku-20241022` or Sonnet with your Anthropic key.
   - **Local Ollama**: Self-hosted, private, and 100% offline (point to `http://localhost:11434`).
   - **Custom OpenAI-Compatible**: Point to Groq, OpenRouter, DeepSeek, LocalAI, or vLLM.
4. Paste your API key, tap **⚡ Test Connection** to verify response latency, and tap **Save AI Keys**.

---

## ☁️ Option: Free Cloud Hosting on Google Cloud Platform ($0/mo Always Free)

If you don't have a 24/7 home server or Raspberry Pi, you can host Family Hub in the cloud completely free using the **Google Cloud Platform (GCP) Always Free Tier**.

### GCP Always Free Tier Inclusions:
- **1 `e2-micro` VM instance** per month (2 vCPUs, 1 GB RAM)
- **30 GB Standard Persistent Disk**
- **Eligible Regions**: `us-central1` (Iowa), `us-east1` (South Carolina), or `us-west1` (Oregon)
- **100% Free**: Pair with **Cloudflare Tunnel** (no static IP reservation costs and no open firewall ports required).

### Step 1: Create the Free Tier VM

Using the [Google Cloud Console](https://console.cloud.google.com/) or the `gcloud` CLI:

```bash
gcloud compute instances create skylight-hub \
  --project=YOUR_PROJECT_ID \
  --zone=us-central1-a \
  --machine-type=e2-micro \
  --image-family=debian-12 \
  --image-project=debian-cloud \
  --boot-disk-size=30GB \
  --boot-disk-type=pd-standard
```

### Step 2: Connect to Your VM & Configure Swap

Connect to your instance via SSH:
```bash
gcloud compute ssh skylight-hub --zone=us-central1-a
```

*(Recommended)* Add a 1 GB swap file to give your `e2-micro` instance comfortable memory headroom:
```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Step 3: Install Docker

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker
```

### Step 4: Clone & Launch Family Hub

```bash
git clone https://github.com/diseric/family-hub.git
cd family-hub
docker compose up -d --build
```

### Step 5: Connect Securely via Cloudflare Tunnel
Follow the [Remote Access with Cloudflare Tunnel](#-remote-access-with-cloudflare-tunnel--zero-trust-authentication) instructions below. Because Cloudflare Tunnel connects outbound from the VM to Cloudflare, you **do not** need to open any ports in GCP VPC firewall, and you **do not** need a paid external static IP.

---

## 🔒 Remote Access with Cloudflare Tunnel & Zero Trust Authentication

To access Family Hub securely from your smartphone or outside your home network **without opening ports on your router**, use Cloudflare Tunnel and Cloudflare Zero Trust (free tier).

```
[Smartphone / iPad]
         │
         ▼  (HTTPS / SSL)
[Cloudflare Edge Network]
         │  (Cloudflare Access: Email OTP / Google Login)
         ▼
[cloudflared daemon] ──(Secure Outbound Tunnel)──> [Family Hub :3003]
```

### Step 1: Install `cloudflared`

#### Option A: Native Linux Service (Recommended for Raspberry Pi / VMs)
```bash
# Debian / Ubuntu / Raspberry Pi OS
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

# For ARM64 (Raspberry Pi 4 / 5):
# https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
```

#### Option B: Docker Container
Add `cloudflared` directly to your `docker-compose.yml`:
```yaml
  tunnel:
    image: cloudflare/cloudflared:latest
    container_name: cloudflared-tunnel
    restart: unless-stopped
    command: tunnel run
    environment:
      - TUNNEL_TOKEN=your_cloudflare_tunnel_token_here
```

---

### Step 2: Create a Cloudflare Tunnel

#### Method A: Via Cloudflare Zero Trust Dashboard (Fastest & Easiest)
1. Go to the [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/).
2. Navigate to **Networks** → **Tunnels** → **Create a Tunnel**.
3. Select **Cloudflared** as the connector.
4. Name your tunnel (e.g., `family-hub`).
5. Copy the installation command or `TUNNEL_TOKEN`.
6. Run the install command on your server (or add the token to your Docker compose).
7. Under the **Public Hostname** tab:
   - **Subdomain**: `hub` (or `calendar`)
   - **Domain**: `yourdomain.com`
   - **Type**: `HTTP`
   - **URL**: `localhost:3003` (or `familyhub:3003` if using Docker network)
8. Click **Save Tunnel**.

#### Method B: Via CLI
```bash
# Login to Cloudflare
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create family-hub

# Create config file: ~/.cloudflared/config.yml
tunnel: <TUNNEL_UUID>
credentials-file: /home/user/.cloudflared/<TUNNEL_UUID>.json

ingress:
  - hostname: hub.yourdomain.com
    service: http://localhost:3003
  - service: http_status:404

# Route DNS
cloudflared tunnel route dns family-hub hub.yourdomain.com

# Run tunnel as a system service
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

---

### Step 3: Configure Cloudflare Access (Authentication & Security)

To ensure only your family can access the dashboard remotely:

1. In the **Cloudflare Zero Trust Dashboard**, go to **Access** → **Applications** → **Add an Application**.
2. Select **Self-hosted**.
3. **Application Configuration**:
   - **Application name**: `Family Hub`
   - **Application domain**: `hub.yourdomain.com`
   - **Session Duration**: `1 month` (or `Refresh on every login` depending on device preference)
4. **Define Access Policies**:
   - **Policy Name**: `Family Members Only`
   - **Action**: `Allow`
   - **Include Rule**:
     - *Selector*: **Emails** (enter family email addresses: `mom@gmail.com`, `dad@gmail.com`)
     - OR *Selector*: **Emails ending in** (`@yourfamily.com`)
5. **Identity Providers**:
   - Enable **One-Time PIN (OTP)** (Cloudflare emails a 6-digit verification code), or connect **Google OAuth** / **GitHub**.
6. Save the application.

Now, whenever anyone navigates to `https://hub.yourdomain.com`, they will be prompted to verify via email PIN or Google login before reaching your Family Hub!

---

### Step 4: Add to Smartphone Home Screen (PWA / Mobile Management)

Family Hub is fully responsive with standalone PWA support:
- **iPhone / iPad**: Open `https://hub.yourdomain.com` in Safari → Tap the **Share** button → Tap **"Add to Home Screen"**.
- **Android**: Open in Chrome → Tap the three dots menu → Tap **"Install App"** or **"Add to Home screen"**.

Once installed, it opens full-screen like a native app with zero browser toolbars, keeping your session authenticated.

---

## 🛠️ Architecture & Tech Stack

| Component | Technology | Description |
|---|---|---|
| **Backend** | Python 3.11 / FastAPI | High-performance asynchronous API, background iCal sync engine, and settings manager. |
| **Frontend** | Vanilla HTML5, CSS3, JS | Pure modern web stack with 0 bloated frontend build steps, instant reloads, and 60fps touch interactions. |
| **Styling & Fonts** | Libre Franklin & Inter | High-contrast UI optimized for viewing across kitchen islands and wall mounts. |
| **Audio Engine** | Web Audio API | Client-side harmonic chime synthesis (no external audio files required). |
| **Celebrations** | Canvas Confetti | Smooth particle confetti animations on chore completion and reward redemption. |
| **Weather** | Open-Meteo API | Free, keyless 5-day weather forecasts and geocoding. |
| **AI Assistant** | Google Gemini / OpenAI / Claude / Ollama | Smart schedule extraction from text and PDF documents with structured JSON output. |
| **Remote Access** | Cloudflare Tunnel & Zero Trust | Free outbound-only encrypted tunnel with multi-factor authentication. |
| **Data Storage** | Atomic JSON (`data/skylight_db.json`) | Easy backup, human-readable, zero complex SQL setup required. |

---

## 💾 Backup & Data Migration

All family profiles, chores, reward points, calendar cache, and meal plans are stored in a single JSON file:

```bash
# Backup database
cp ./data/skylight_db.json ./backup_skylight_db_$(date +%F).json

# Restore database
cp ./backup_skylight_db.json ./data/skylight_db.json
docker restart familyhub
```

---

## 📄 License

This project is open-source under the [MIT License](LICENSE).
