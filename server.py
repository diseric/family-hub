import asyncio
import base64
import io
import json
import logging
import os
import re
import shutil
import time
import urllib.parse
import urllib.request
from datetime import datetime, date, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

import icalendar
from fastapi import FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("familyhub")

DATA_DIR = Path(os.environ.get("DATA_DIR", "./data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
PHOTOS_DIR = DATA_DIR / "photos"
PHOTOS_DIR.mkdir(parents=True, exist_ok=True)

STATE_FILE = DATA_DIR / "familyhub_db.json"
LEGACY_STATE_FILE = DATA_DIR / "skylight_db.json"
if not STATE_FILE.exists() and LEGACY_STATE_FILE.exists():
    STATE_FILE = LEGACY_STATE_FILE

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434")

DEFAULT_MEMBERS = [
    {"id": "m1", "name": "Eric", "color": "#0284c7", "avatar": "👨", "points": 0},
]

today_str = date.today().isoformat()

DEFAULT_EVENTS = []

DEFAULT_CHORES = []

DEFAULT_LISTS = [
    {
        "id": "l_grocery",
        "title": "🛒 Grocery List",
        "items": [],
    },
    {
        "id": "l_todo",
        "title": "✅ To-Do List",
        "items": [],
    },
]

DEFAULT_MEALS = {
    day: {"breakfast": "", "lunch": "", "dinner": ""}
    for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
}

DEFAULT_FEEDS = []

DEFAULT_REWARDS = [
    {
        "id": "rew_1",
        "title": "Ice Cream Parlor Trip",
        "icon": "🍦",
        "starCost": 50,
        "memberId": "all",
        "autoRenew": True,
        "description": "Choose your favorite scoop with sprinkles at the ice cream shop!"
    },
    {
        "id": "rew_2",
        "title": "30 Min Extra Screen Time",
        "icon": "🎮",
        "starCost": 30,
        "memberId": "all",
        "autoRenew": True,
        "description": "Bonus gaming or iPad playtime before dinner."
    },
    {
        "id": "rew_3",
        "title": "Family Movie Night Pick",
        "icon": "🎬",
        "starCost": 40,
        "memberId": "all",
        "autoRenew": True,
        "description": "Pick Friday movie night film and snack for the whole family!"
    },
    {
        "id": "rew_4",
        "title": "New Toy or Book Prize",
        "icon": "🎁",
        "starCost": 100,
        "memberId": "all",
        "autoRenew": False,
        "description": "Pick a special treat or toy during our weekend store trip."
    }
]

DEFAULT_SETTINGS = {
    "deviceName": "Kitchen Family Hub 15\"",
    "displayMode": "calendar",  # calendar, split, photo_frame
    "calendarView": "week",     # day, 3day, week, month, schedule
    "sleepEnabled": True,
    "wakeTime": "06:30",
    "sleepTime": "22:00",
    "slideshowIntervalSec": 8,
    "splitDefault": "photos",
    "weatherLocation": "Seattle, WA",
    "weatherLat": 47.6062,
    "weatherLon": -122.3321,
    "weatherUnits": "fahrenheit",
    "timezone": "America/Los_Angeles",
    "skylightEmail": "family-hub@local",
    "magicImportEnabled": True,
    "setupCompleted": False,
    "daytimeScreensaverEnabled": True,
    "daytimeScreensaverTimeoutMins": 5,
    "excludedRewardMemberIds": [],
    "googlePhotosAlbumUrl": "",
    "googlePhotosLastSynced": None,
    "googlePhotosCount": 0,
}

def load_db() -> Dict[str, Any]:
    if STATE_FILE.exists():
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "rewards" not in data or not data["rewards"]:
                    data["rewards"] = [r.copy() for r in DEFAULT_REWARDS]
                    save_db(data)
                if "reward_redemptions" not in data:
                    data["reward_redemptions"] = []
                if "settings" in data and "excludedRewardMemberIds" not in data["settings"]:
                    data["settings"]["excludedRewardMemberIds"] = []
                    save_db(data)
                return data
        except Exception as e:
            logger.error(f"Error loading state file: {e}")
    
    # Initialize fresh DB
    data = {
        "members": DEFAULT_MEMBERS,
        "events": DEFAULT_EVENTS,
        "chores": DEFAULT_CHORES,
        "rewards": [r.copy() for r in DEFAULT_REWARDS],
        "reward_redemptions": [],
        "lists": DEFAULT_LISTS,
        "meals": DEFAULT_MEALS,
        "feeds": DEFAULT_FEEDS,
        "settings": DEFAULT_SETTINGS,
        "photos": [],
    }
    save_db(data)
    return data

def save_db(data: Dict[str, Any]):
    try:
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Error saving state file: {e}")

db = load_db()

def init_sample_photos():
    pass

init_sample_photos()

app = FastAPI(title="Family Hub & Smart Touchscreen Calendar")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_no_cache_header(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

app.mount("/static", StaticFiles(directory="static"), name="static")

# ---------------------------------------------------------------------------
# Weather fetcher via open-meteo (free, instant, no API key needed)
# ---------------------------------------------------------------------------
WEATHER_CACHE = {"timestamp": 0, "data": None}

def geocode_location_internal(query_str: str) -> Optional[Dict[str, Any]]:
    try:
        q = (query_str or "").strip()
        if not q:
            return None
        query = urllib.parse.quote(q)
        url = f"https://geocoding-api.open-meteo.com/v1/search?name={query}&count=1&language=en&format=json"
        req = urllib.request.Request(url, headers={"User-Agent": "FamilyHub/1.0"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        results = data.get("results", [])
        if not results and "," in q:
            city_part = urllib.parse.quote(q.split(",")[0].strip())
            url = f"https://geocoding-api.open-meteo.com/v1/search?name={city_part}&count=1&language=en&format=json"
            req = urllib.request.Request(url, headers={"User-Agent": "FamilyHub/1.0"})
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            results = data.get("results", [])
        if results:
            top = results[0]
            admin1 = top.get("admin1", "")
            country = top.get("country", "")
            name = top.get("name", "")
            formatted = f"{name}, {admin1}" if admin1 else f"{name}, {country}"
            return {
                "location": formatted,
                "lat": top.get("latitude"),
                "lon": top.get("longitude"),
                "timezone": top.get("timezone", "America/Los_Angeles")
            }
    except Exception as e:
        logger.warning(f"Geocoding error for {query_str}: {e}")
    return None

async def fetch_weather(force: bool = False):
    now = time.time()
    if not force and WEATHER_CACHE["data"] and (now - WEATHER_CACHE["timestamp"]) < 600:
        return WEATHER_CACHE["data"]
    
    settings = db.get("settings", DEFAULT_SETTINGS)
    lat = settings.get("weatherLat", 47.6062)
    lon = settings.get("weatherLon", -122.3321)
    
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "FamilyHub/1.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
            
            cur = raw.get("current", {})
            daily = raw.get("daily", {})
            
            def map_weather(code):
                codes = {
                    0: ("Clear Skies", "☀️"),
                    1: ("Mainly Clear", "🌤️"),
                    2: ("Partly Cloudy", "⛅"),
                    3: ("Overcast", "☁️"),
                    45: ("Foggy", "🌫️"),
                    48: ("Rime Fog", "🌫️"),
                    51: ("Light Drizzle", "🌦️"),
                    61: ("Light Rain", "🌧️"),
                    63: ("Moderate Rain", "🌧️"),
                    65: ("Heavy Rain", "🌧️"),
                    71: ("Light Snow", "🌨️"),
                    80: ("Rain Showers", "🌦️"),
                    95: ("Thunderstorm", "⛈️"),
                }
                return codes.get(code, ("Partly Cloudy", "⛅"))
            
            desc, icon = map_weather(cur.get("weather_code", 2))
            
            forecast = []
            dates = daily.get("time", [])[:5]
            maxs = daily.get("temperature_2m_max", [])[:5]
            mins = daily.get("temperature_2m_min", [])[:5]
            wcodes = daily.get("weather_code", [])[:5]
            for i in range(len(dates)):
                d_desc, d_icon = map_weather(wcodes[i] if i < len(wcodes) else 2)
                d_obj = datetime.strptime(dates[i], "%Y-%m-%d")
                forecast.append({
                    "date": dates[i],
                    "dayName": d_obj.strftime("%a"),
                    "high": round(maxs[i]) if i < len(maxs) else 65,
                    "low": round(mins[i]) if i < len(mins) else 48,
                    "desc": d_desc,
                    "icon": d_icon
                })
            
            data = {
                "location": settings.get("weatherLocation", "Home"),
                "temp": round(cur.get("temperature_2m", 68)),
                "apparentTemp": round(cur.get("apparent_temperature", 67)),
                "humidity": cur.get("relative_humidity_2m", 50),
                "desc": desc,
                "icon": icon,
                "wind": f"{round(cur.get('wind_speed_10m', 6))} mph",
                "forecast": forecast
            }
            WEATHER_CACHE["timestamp"] = now
            WEATHER_CACHE["data"] = data
            return data
    except Exception as e:
        logger.warning(f"Failed to fetch live weather: {e}")
        return {
            "location": settings.get("weatherLocation", "Home"),
            "temp": 68,
            "apparentTemp": 67,
            "humidity": 45,
            "desc": "Partly Sunny",
            "icon": "⛅",
            "wind": "7 mph",
            "forecast": [
                {"dayName": "Today", "high": 70, "low": 52, "desc": "Partly Sunny", "icon": "⛅"},
                {"dayName": "Thu", "high": 72, "low": 54, "desc": "Sunny", "icon": "☀️"},
                {"dayName": "Fri", "high": 68, "low": 50, "desc": "Light Rain", "icon": "🌦️"},
                {"dayName": "Sat", "high": 66, "low": 48, "desc": "Cloudy", "icon": "☁️"},
                {"dayName": "Sun", "high": 71, "low": 53, "desc": "Mostly Sunny", "icon": "🌤️"},
            ]
        }

# ---------------------------------------------------------------------------
# iCalendar / Universal Sync Engine (Google, Apple, Outlook, Yahoo, Cozi)
# ---------------------------------------------------------------------------
def parse_ical_feed(feed_id: str, ics_content: str, member_id: str, feed_name: str = "Google Calendar") -> List[Dict[str, Any]]:
    events = []
    local_tz_str = db.get("settings", {}).get("timezone", "America/Los_Angeles")
    try:
        target_tz = ZoneInfo(local_tz_str)
    except Exception:
        target_tz = None

    try:
        cal = icalendar.Calendar.from_ical(ics_content)
        for component in cal.walk():
            if component.name == "VEVENT":
                summary = str(component.get("summary", "Synced Event"))
                dtstart = component.get("dtstart")
                dtend = component.get("dtend")
                description = str(component.get("description", ""))
                location = str(component.get("location", ""))
                
                if not dtstart:
                    continue
                
                dt = dtstart.dt
                is_all_day = False
                if isinstance(dt, datetime):
                    if dt.tzinfo is not None and target_tz:
                        try:
                            dt = dt.astimezone(target_tz)
                        except Exception:
                            pass
                    ev_date = dt.strftime("%Y-%m-%d")
                    ev_time = dt.strftime("%H:%M")
                else: # date only (All-Day event)
                    is_all_day = True
                    ev_date = dt.strftime("%Y-%m-%d")
                    ev_time = "All Day"
                
                end_time = "All Day" if is_all_day else "10:00"
                if dtend:
                    edt = dtend.dt
                    if isinstance(edt, datetime):
                        if edt.tzinfo is not None and target_tz:
                            try:
                                edt = edt.astimezone(target_tz)
                            except Exception:
                                pass
                        end_time = edt.strftime("%H:%M")
                    else:
                        end_time = "All Day" if is_all_day else "10:00"
                
                hash_seed = f"{summary}_{ev_date}_{ev_time}"
                events.append({
                    "id": f"synced_{feed_id}_{len(events)}_{abs(hash(hash_seed))%100000}",
                    "title": summary,
                    "date": ev_date,
                    "time": ev_time,
                    "endTime": end_time,
                    "memberId": member_id,
                    "category": feed_name,
                    "location": location,
                    "notes": description[:250] if description else "",
                    "isSynced": True,
                    "feedId": feed_id
                })
    except Exception as e:
        logger.error(f"Error parsing ical stream for feed {feed_id}: {e}")
    return events

# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health():
    return {"status": "ok", "time": time.time()}

@app.get("/api/state")
async def get_state():
    weather = await fetch_weather()
    return {
        "members": db.get("members", []),
        "events": db.get("events", []),
        "chores": db.get("chores", []),
        "rewards": db.get("rewards", []),
        "rewardRedemptions": db.get("reward_redemptions", []),
        "lists": db.get("lists", []),
        "meals": db.get("meals", {}),
        "feeds": db.get("feeds", []),
        "settings": db.get("settings", {}),
        "photos": db.get("photos", []),
        "weather": weather,
    }

# --- Calendar Events ---
class EventModel(BaseModel):
    id: Optional[str] = None
    title: str
    date: str
    time: str = "09:00"
    endTime: str = "10:00"
    memberId: str = "m5"
    category: str = "General"
    location: str = ""
    notes: str = ""
    repeat: Optional[str] = "none"
    repeatUntil: Optional[str] = None

@app.post("/api/events")
def create_event(ev: EventModel):
    new_id = ev.id or f"ev_{int(time.time()*1000)}"
    item = ev.dict()
    item["id"] = new_id
    db["events"].append(item)
    save_db(db)
    return item

@app.put("/api/events/{event_id}")
def update_event(event_id: str, ev: EventModel):
    for i, e in enumerate(db["events"]):
        if e.get("id") == event_id:
            updated = ev.dict()
            updated["id"] = event_id
            db["events"][i] = updated
            save_db(db)
            return updated
    raise HTTPException(status_code=404, detail="Event not found")

@app.delete("/api/events/{event_id}")
def delete_event(event_id: str):
    db["events"] = [e for e in db["events"] if e.get("id") != event_id]
    save_db(db)
    return {"ok": True}

# --- Chores Tracker ---
class ChoreModel(BaseModel):
    id: Optional[str] = None
    title: str
    memberId: str
    points: int = 10
    frequency: str = "Daily"
    completed: bool = False
    isRoutine: bool = False
    timeOfDay: Optional[str] = "morning"  # morning, afternoon, evening
    daysOfWeek: Optional[List[str]] = None  # ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    icon: Optional[str] = ""

@app.post("/api/chores")
def create_chore(ch: ChoreModel):
    new_id = ch.id or f"ch_{int(time.time()*1000)}"
    item = ch.dict()
    item["id"] = new_id
    item["completedDate"] = today_str if item["completed"] else None
    db["chores"].append(item)
    save_db(db)
    return item

@app.post("/api/chores/batch")
def create_chores_batch(chores: List[ChoreModel]):
    added = []
    base_time = int(time.time() * 1000)
    for idx, ch in enumerate(chores):
        new_id = ch.id or f"ch_{base_time}_{idx}"
        item = ch.dict()
        item["id"] = new_id
        item["completedDate"] = today_str if item["completed"] else None
        db["chores"].append(item)
        added.append(item)
    save_db(db)
    return added

@app.post("/api/chores/{chore_id}/toggle")
def toggle_chore(chore_id: str):
    reward = None
    for c in db["chores"]:
        if c.get("id") == chore_id:
            c["completed"] = not c.get("completed", False)
            if c["completed"]:
                c["completedDate"] = date.today().isoformat()
                pts = c.get("points", 10)
                # award points to member
                m_id = c.get("memberId")
                for m in db["members"]:
                    if m.get("id") == m_id:
                        m["points"] = m.get("points", 0) + pts
                        reward = {"member": m["name"], "avatar": m.get("avatar", "⭐"), "points": pts, "total": m["points"]}
                        break
            else:
                c["completedDate"] = None
            save_db(db)
            return {"chore": c, "reward": reward}
    raise HTTPException(status_code=404, detail="Chore not found")

@app.put("/api/chores/{chore_id}")
def update_chore(chore_id: str, ch: ChoreModel):
    for i, c in enumerate(db["chores"]):
        if c.get("id") == chore_id:
            updated = ch.dict()
            updated["id"] = chore_id
            updated["completed"] = c.get("completed", False)
            updated["completedDate"] = c.get("completedDate")
            db["chores"][i] = updated
            save_db(db)
            return updated
    raise HTTPException(status_code=404, detail="Chore not found")

@app.delete("/api/chores/{chore_id}")
def delete_chore(chore_id: str):
    db["chores"] = [c for c in db["chores"] if c.get("id") != chore_id]
    save_db(db)
    return {"ok": True}

# --- Family Rewards & Star Goals ---
class RewardModel(BaseModel):
    id: Optional[str] = None
    title: str
    icon: Optional[str] = "🎁"
    starCost: int = 50
    memberId: Optional[str] = "all"
    autoRenew: bool = True
    description: Optional[str] = ""

class RewardRedeemModel(BaseModel):
    memberId: Optional[str] = None

@app.get("/api/rewards")
def get_rewards():
    if "rewards" not in db or not db["rewards"]:
        db["rewards"] = [r.copy() for r in DEFAULT_REWARDS]
        save_db(db)
    return db.get("rewards", [])

@app.post("/api/rewards")
def create_reward(rew: RewardModel):
    new_id = rew.id or f"rew_{int(time.time()*1000)}"
    item = rew.dict()
    item["id"] = new_id
    item["createdAt"] = datetime.now().isoformat()
    db.setdefault("rewards", []).append(item)
    save_db(db)
    return item

@app.put("/api/rewards/{reward_id}")
def update_reward(reward_id: str, rew: RewardModel):
    for i, r in enumerate(db.get("rewards", [])):
        if r.get("id") == reward_id:
            updated = rew.dict()
            updated["id"] = reward_id
            updated["createdAt"] = r.get("createdAt", datetime.now().isoformat())
            db["rewards"][i] = updated
            save_db(db)
            return updated
    raise HTTPException(status_code=404, detail="Reward not found")

@app.delete("/api/rewards/{reward_id}")
def delete_reward(reward_id: str):
    db["rewards"] = [r for r in db.get("rewards", []) if r.get("id") != reward_id]
    save_db(db)
    return {"ok": True}

@app.post("/api/rewards/{reward_id}/redeem")
def redeem_reward(reward_id: str, payload: RewardRedeemModel = None):
    reward = None
    for r in db.get("rewards", []):
        if r.get("id") == reward_id:
            reward = r
            break
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    target_member_id = None
    if payload and payload.memberId:
        target_member_id = payload.memberId
    elif reward.get("memberId") and reward["memberId"] != "all":
        target_member_id = reward["memberId"]
    else:
        raise HTTPException(status_code=400, detail="Member ID is required to redeem reward")
    
    target_member = None
    for m in db.get("members", []):
        if m.get("id") == target_member_id:
            target_member = m
            break
    if not target_member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    cost = int(reward.get("starCost", 50))
    current_pts = int(target_member.get("points", 0))
    if current_pts < cost:
        raise HTTPException(status_code=400, detail=f"Insufficient stars: needs {cost} ⭐, has {current_pts} ⭐")
    
    # Deduct stars
    target_member["points"] = current_pts - cost
    
    redemption = {
        "id": f"red_{int(time.time()*1000)}",
        "rewardId": reward["id"],
        "rewardTitle": reward.get("title", "Reward"),
        "rewardIcon": reward.get("icon", "🎁"),
        "starCost": cost,
        "memberId": target_member["id"],
        "memberName": target_member.get("name", "Member"),
        "memberAvatar": target_member.get("avatar", "⭐"),
        "redeemedAt": datetime.now().isoformat()
    }
    db.setdefault("reward_redemptions", []).insert(0, redemption)
    db["reward_redemptions"] = db["reward_redemptions"][:100]
    
    if not reward.get("autoRenew", True):
        reward["completed"] = True
        reward["completedAt"] = datetime.now().isoformat()
        
    save_db(db)
    return {
        "status": "ok",
        "redemption": redemption,
        "member": target_member,
        "reward": reward
    }

@app.get("/api/reward-redemptions")
def get_reward_redemptions():
    return db.get("reward_redemptions", [])

# --- To-Do & Grocery Lists ---
class ListItemModel(BaseModel):
    text: str
    addedBy: str = "Kitchen Hub"

@app.post("/api/lists/{list_id}/items")
def add_list_item(list_id: str, item: ListItemModel):
    new_item = {
        "id": f"li_{int(time.time()*1000)}",
        "text": item.text,
        "checked": False,
        "addedBy": item.addedBy,
    }
    for lst in db["lists"]:
        if lst.get("id") == list_id:
            lst.setdefault("items", []).append(new_item)
            save_db(db)
            return new_item
    raise HTTPException(status_code=404, detail="List not found")

@app.post("/api/lists/{list_id}/items/{item_id}/toggle")
def toggle_list_item(list_id: str, item_id: str):
    for lst in db["lists"]:
        if lst.get("id") == list_id:
            for it in lst.get("items", []):
                if it.get("id") == item_id:
                    it["checked"] = not it.get("checked", False)
                    save_db(db)
                    return it
    raise HTTPException(status_code=404, detail="Item not found")

@app.delete("/api/lists/{list_id}/items/{item_id}")
def delete_list_item(list_id: str, item_id: str):
    for lst in db["lists"]:
        if lst.get("id") == list_id:
            lst["items"] = [it for it in lst.get("items", []) if it.get("id") != item_id]
            save_db(db)
            return {"ok": True}
    raise HTTPException(status_code=404, detail="List not found")

class CreateListModel(BaseModel):
    title: str

@app.post("/api/lists")
def create_list(lst: CreateListModel):
    new_list = {
        "id": f"l_{int(time.time()*1000)}",
        "title": lst.title,
        "items": []
    }
    db.setdefault("lists", []).append(new_list)
    save_db(db)
    return new_list

@app.delete("/api/lists/{list_id}")
def delete_list(list_id: str):
    db["lists"] = [l for l in db.get("lists", []) if l.get("id") != list_id]
    save_db(db)
    return {"ok": True}

# --- Meal Planning ---
class MealUpdateModel(BaseModel):
    day: str
    breakfast: str
    lunch: str
    dinner: str

@app.put("/api/meals")
def update_meals(meal: MealUpdateModel):
    db.setdefault("meals", {})[meal.day] = {
        "breakfast": meal.breakfast,
        "lunch": meal.lunch,
        "dinner": meal.dinner,
    }
    save_db(db)
    return db["meals"]

# --- Universal Calendar Feeds (Google, Apple, Outlook, Yahoo, Cozi) ---
class FeedModel(BaseModel):
    name: str
    provider: str
    url: str
    color: str = "#3b82f6"
    memberId: str = "all"

class TestFeedModel(BaseModel):
    url: str
    memberId: Optional[str] = "all"
    name: Optional[str] = "Google Calendar"

@app.post("/api/feeds/test")
async def test_feed(body: TestFeedModel):
    url = body.url.strip()
    if url.startswith("webcal://"):
        url = "https://" + url[9:]
    
    if "calendar.google.com" in url and "basic.ics" not in url:
        return {
            "status": "error",
            "message": "It looks like you pasted the Google Calendar browser URL. Please copy the 'Secret address in iCal format' (ending in .ics) from Settings and sharing > Integrate calendar."
        }
    
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 FamilyHubSync/1.0"})
        with urllib.request.urlopen(req, timeout=12) as resp:
            ics_text = resp.read().decode("utf-8", errors="replace")
        
        events = parse_ical_feed("test_preview", ics_text, body.memberId or "m1", body.name or "Google Calendar")
        sample_titles = [e.get("title") for e in events[:4] if e.get("title")]
        return {
            "status": "ok",
            "eventCount": len(events),
            "preview": sample_titles,
            "message": f"Successfully connected! Found {len(events)} events."
        }
    except Exception as e:
        logger.error(f"Test feed error for {url}: {e}")
        return {
            "status": "error",
            "message": f"Could not reach or parse calendar: {str(e)}. Please check that the URL is public or is the Google Calendar Secret iCal address."
        }

@app.post("/api/feeds")
async def add_feed(feed: FeedModel):
    f_id = f"feed_{int(time.time()*1000)}"
    item = feed.dict()
    item["id"] = f_id
    item["lastSynced"] = None
    item["eventCount"] = 0
    item["enabled"] = True
    db.setdefault("feeds", []).append(item)
    save_db(db)
    try:
        await sync_feed(f_id)
    except Exception as e:
        logger.warning(f"Initial sync warning for feed {f_id}: {e}")
    return item

@app.post("/api/feeds/{feed_id}/sync")
async def sync_feed(feed_id: str):
    feed = None
    for f in db.get("feeds", []):
        if f.get("id") == feed_id:
            feed = f
            break
    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")
    
    url = feed.get("url", "")
    # Normalize webcal:// to https://
    if url.startswith("webcal://"):
        url = "https://" + url[9:]
    
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 FamilyHubSync/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            ics_text = resp.read().decode("utf-8", errors="replace")
            
        synced_events = parse_ical_feed(feed_id, ics_text, feed.get("memberId", "all"), feed.get("name", "Google Calendar"))
        
        # Remove old events from this feed
        db["events"] = [e for e in db.get("events", []) if e.get("feedId") != feed_id]
        db["events"].extend(synced_events)
        
        feed["lastSynced"] = datetime.now().strftime("%Y-%m-%d %H:%M")
        feed["eventCount"] = len(synced_events)
        save_db(db)
        return {"status": "ok", "eventsCount": len(synced_events)}
    except Exception as e:
        logger.error(f"Sync error for {url}: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to fetch or parse iCal feed: {e}")

@app.post("/api/feeds/sync-all")
async def sync_all_feeds():
    synced = 0
    errors = []
    for f in db.get("feeds", []):
        if f.get("enabled", True):
            try:
                await sync_feed(f["id"])
                synced += 1
            except Exception as e:
                errors.append(f"{f.get('name')}: {e}")
    return {"status": "ok", "syncedCount": synced, "errors": errors}

@app.get("/api/weather/geocode")
def geocode_location(q: str = Query(...)):
    geo = geocode_location_internal(q)
    if geo:
        return {"status": "ok", **geo}
    return {"status": "not_found", "message": "Location not found"}

class SetupCompleteModel(BaseModel):
    deviceName: Optional[str] = "Kitchen Family Hub 15\""
    weatherLocation: Optional[str] = "Seattle, WA"
    weatherLat: Optional[float] = None
    weatherLon: Optional[float] = None
    timezone: Optional[str] = "America/Los_Angeles"
    sleepTime: Optional[str] = "22:00"
    wakeTime: Optional[str] = "06:30"
    skylightEmail: Optional[str] = "family-hub@local"
    members: Optional[List[Dict[str, Any]]] = None
    starterLists: Optional[List[str]] = None

@app.post("/api/setup/complete")
async def complete_setup(data: SetupCompleteModel):
    global WEATHER_CACHE
    settings = db.setdefault("settings", {})
    loc = (data.weatherLocation or settings.get("weatherLocation", "Seattle, WA")).strip()

    lat = data.weatherLat
    lon = data.weatherLon
    tz = data.timezone

    if loc and (lat is None or lon is None or loc != settings.get("weatherLocation")):
        geo = geocode_location_internal(loc)
        if geo:
            lat = geo["lat"]
            lon = geo["lon"]
            tz = geo["timezone"]
            loc = geo["location"]

    settings["deviceName"] = data.deviceName or settings.get("deviceName", "Kitchen Family Hub 15\"")
    settings["weatherLocation"] = loc
    settings["weatherLat"] = lat if lat is not None else settings.get("weatherLat", 47.6062)
    settings["weatherLon"] = lon if lon is not None else settings.get("weatherLon", -122.3321)
    settings["timezone"] = tz or settings.get("timezone", "America/Los_Angeles")
    settings["sleepTime"] = data.sleepTime or settings.get("sleepTime", "22:00")
    settings["wakeTime"] = data.wakeTime or settings.get("wakeTime", "06:30")
    settings["skylightEmail"] = data.skylightEmail or settings.get("skylightEmail", "family-hub@local")
    settings["setupCompleted"] = True
    
    if data.members:
        db["members"] = data.members
    
    if data.starterLists is not None:
        new_lists = []
        if "grocery" in data.starterLists:
            new_lists.append({"id": "l_grocery", "title": "🛒 Grocery List", "items": []})
        if "todo" in data.starterLists:
            new_lists.append({"id": "l_todo", "title": "✅ To-Do List", "items": []})
        if "school" in data.starterLists:
            new_lists.append({"id": "l_school", "title": "🎒 School & Activities", "items": []})
        if "packing" in data.starterLists:
            new_lists.append({"id": "l_packing", "title": "🧳 Family Packing Checklist", "items": []})
        if new_lists:
            db["lists"] = new_lists

    WEATHER_CACHE = {"timestamp": 0, "data": None}
    save_db(db)
    
    # Trigger background sync for feeds
    await sync_all_feeds()
    weather = await fetch_weather(force=True)
    return {"status": "ok", "state": db, "weather": weather}

class UpdateFeedModel(BaseModel):
    name: Optional[str] = None
    memberId: Optional[str] = None
    color: Optional[str] = None
    enabled: Optional[bool] = None

@app.put("/api/feeds/{feed_id}")
def update_feed(feed_id: str, updates: UpdateFeedModel):
    target = None
    for f in db.get("feeds", []):
        if f.get("id") == feed_id:
            target = f
            break
    if not target:
        raise HTTPException(status_code=404, detail="Feed not found")
    
    if updates.name is not None:
        target["name"] = updates.name
    if updates.color is not None:
        target["color"] = updates.color
    if updates.enabled is not None:
        target["enabled"] = updates.enabled
    if updates.memberId is not None:
        target["memberId"] = updates.memberId
        # Update all events currently in db for this feed to the new member
        for ev in db.get("events", []):
            if ev.get("feedId") == feed_id:
                ev["memberId"] = updates.memberId
    save_db(db)
    return {"status": "ok", "feed": target}

@app.delete("/api/feeds/{feed_id}")
def delete_feed(feed_id: str):
    db["feeds"] = [f for f in db.get("feeds", []) if f.get("id") != feed_id]
    db["events"] = [e for e in db.get("events", []) if e.get("feedId") != feed_id]
    save_db(db)
    return {"ok": True}

# --- Settings & Display Control ---
@app.put("/api/settings")
async def update_settings(settings: Dict[str, Any]):
    global WEATHER_CACHE
    current_settings = db.get("settings", {})
    old_loc = current_settings.get("weatherLocation", "")
    new_loc = settings.get("weatherLocation", "").strip()

    if new_loc:
        if new_loc != old_loc or "weatherLat" not in settings:
            geo = geocode_location_internal(new_loc)
            if geo:
                settings["weatherLat"] = geo["lat"]
                settings["weatherLon"] = geo["lon"]
                settings["timezone"] = geo["timezone"]
                settings["weatherLocation"] = geo["location"]
            else:
                settings["weatherLocation"] = new_loc

    WEATHER_CACHE = {"timestamp": 0, "data": None}
    db.setdefault("settings", {}).update(settings)
    save_db(db)
    weather = await fetch_weather(force=True)
    return {"status": "ok", "settings": db["settings"], "weather": weather}

# --- Family Members Management ---
class MemberModel(BaseModel):
    id: Optional[str] = None
    name: str
    color: str
    avatar: str = "👤"

class MemberUpdateModel(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    avatar: Optional[str] = None
    points: Optional[int] = None

@app.post("/api/members")
def create_member(m: MemberModel):
    new_id = m.id or f"m_{int(time.time()*1000)}"
    item = m.dict()
    item["id"] = new_id
    item["points"] = 0
    db.setdefault("members", []).append(item)
    save_db(db)
    return item

@app.put("/api/members/{member_id}")
def update_member(member_id: str, m: MemberUpdateModel):
    for mem in db.get("members", []):
        if mem["id"] == member_id:
            if m.name is not None:
                mem["name"] = m.name
            if m.color is not None:
                mem["color"] = m.color
            if m.avatar is not None:
                mem["avatar"] = m.avatar
            if m.points is not None:
                mem["points"] = max(0, m.points)
            save_db(db)
            return {"status": "ok", "member": mem}
    raise HTTPException(status_code=404, detail="Member not found")

@app.post("/api/members/{member_id}/points")
def set_member_points(member_id: str, data: Dict[str, Any]):
    for mem in db.get("members", []):
        if mem["id"] == member_id:
            if "points" in data:
                mem["points"] = max(0, int(data["points"]))
            elif "delta" in data:
                mem["points"] = max(0, mem.get("points", 0) + int(data["delta"]))
            save_db(db)
            return {"status": "ok", "member": mem}
    raise HTTPException(status_code=404, detail="Member not found")

@app.delete("/api/members/{member_id}")
def delete_member(member_id: str):
    members = db.get("members", [])
    db["members"] = [m for m in members if m["id"] != member_id]
    save_db(db)
    return {"status": "ok"}

@app.post("/api/reset-clean")
def reset_clean():
    global db
    db = {
        "members": [{"id": "m1", "name": "Eric", "color": "#0284c7", "avatar": "👨", "points": 0}],
        "events": [],
        "chores": [],
        "lists": [
            {"id": "l_grocery", "title": "🛒 Grocery List", "items": []},
            {"id": "l_todo", "title": "✅ To-Do List", "items": []},
        ],
        "meals": {
            day: {"breakfast": "", "lunch": "", "dinner": ""}
            for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        },
        "feeds": [],
        "settings": DEFAULT_SETTINGS,
        "photos": [],
    }
    save_db(db)
    # Clear physical photos
    for p in PHOTOS_DIR.glob("*"):
        try:
            if p.is_file():
                p.unlink()
        except Exception:
            pass
    return {"status": "ok", "state": db}


# --- Digital Photo Frame Mode ---
@app.post("/api/photos/upload")
async def upload_photo(file: UploadFile = File(...), caption: str = Form("")):
    ext = Path(file.filename).suffix.lower() or ".jpg"
    photo_id = f"p_{int(time.time()*1000)}"
    save_name = f"{photo_id}{ext}"
    dest_path = PHOTOS_DIR / save_name
    
    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    entry = {
        "id": photo_id,
        "filename": save_name,
        "caption": caption or file.filename,
        "uploadedAt": date.today().isoformat(),
        "isLocal": True,
    }
    db.setdefault("photos", []).append(entry)
    save_db(db)
    return entry

FALLBACK_PHOTO_URLS = {
    "sample_family_vacation.jpg": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80",
    "sample_mountain_hike.jpg": "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1600&q=80",
    "sample_soccer_finals.jpg": "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1600&q=80",
    "sample_autumn_park.jpg": "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&fit=crop&w=1600&q=80",
}

@app.get("/api/photos/file/{filename}")
def get_photo_file(filename: str):
    p = PHOTOS_DIR / filename
    if p.exists():
        return FileResponse(p)
    if filename in FALLBACK_PHOTO_URLS:
        return RedirectResponse(FALLBACK_PHOTO_URLS[filename])
    raise HTTPException(status_code=404, detail="Photo not found")

@app.delete("/api/photos/{photo_id}")
def delete_photo(photo_id: str):
    for p in db.get("photos", []):
        if p.get("id") == photo_id:
            fn = p.get("filename")
            if fn:
                local_file = PHOTOS_DIR / fn
                if local_file.exists():
                    local_file.unlink()
    db["photos"] = [p for p in db.get("photos", []) if p.get("id") != photo_id]
    save_db(db)
    return {"ok": True}

# --- Google Photos Album Sync Engine ---
def extract_google_photos_urls(album_url: str) -> List[str]:
    album_url = album_url.strip()
    if not album_url.startswith("http"):
        album_url = "https://" + album_url

    req = urllib.request.Request(
        album_url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
    )

    with urllib.request.urlopen(req, timeout=15) as resp:
        html = resp.read().decode("utf-8", errors="replace")

    matches = re.findall(r'"(https://lh3\.googleusercontent\.com/[a-zA-Z0-9\-_/=\.]+)"', html)
    if not matches:
        matches = re.findall(r'https://lh3\.googleusercontent\.com/[a-zA-Z0-9\-_]+', html)

    photos = []
    seen = set()
    for u in matches:
        base = u.split("=")[0]
        token = base.split("/")[-1]
        # Ignore user profile icons and small avatars (tokens < 40 chars)
        if len(token) > 40:
            if base not in seen:
                seen.add(base)
                photos.append(f"{base}=w1920-h1080")

    return photos

class GoogleAlbumModel(BaseModel):
    url: str

@app.post("/api/photos/google-album/sync")
async def sync_google_photos_album(body: GoogleAlbumModel):
    url = body.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="Album URL is required")
    
    if "photos.app.goo.gl" not in url and "photos.google.com" not in url:
        raise HTTPException(status_code=400, detail="Please provide a valid Google Photos shared album URL (e.g. https://photos.app.goo.gl/... or https://photos.google.com/share/...)")
    
    try:
        photo_urls = extract_google_photos_urls(url)
        if not photo_urls:
            return {
                "status": "error",
                "message": "No photos found in this album. Please ensure the Google Photos album sharing link is set to 'Anyone with the link can view'."
            }
        
        # Keep manually uploaded photos, replace synced Google Photos
        existing_uploads = [p for p in db.get("photos", []) if p.get("source") != "google_photos"]
        
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        new_entries = []
        for i, p_url in enumerate(photo_urls):
            h_id = abs(hash(p_url)) % 1000000
            new_entries.append({
                "id": f"gp_{h_id}_{i}",
                "url": p_url,
                "thumbnailUrl": p_url.replace("=w1920-h1080", "=w300-h200-c"),
                "caption": f"Google Photos Memory #{i+1}",
                "source": "google_photos",
                "syncedAt": now_str,
            })
        
        db["photos"] = existing_uploads + new_entries
        db.setdefault("settings", {})["googlePhotosAlbumUrl"] = url
        db["settings"]["googlePhotosLastSynced"] = now_str
        db["settings"]["googlePhotosCount"] = len(new_entries)
        save_db(db)
        
        return {
            "status": "ok",
            "photoCount": len(new_entries),
            "preview": photo_urls[:4],
            "lastSynced": now_str,
            "message": f"Successfully imported {len(new_entries)} photos from Google Photos album!"
        }
    except Exception as e:
        logger.error(f"Error syncing Google Photos album: {e}")
        return {
            "status": "error",
            "message": f"Could not sync album: {str(e)}"
        }

@app.delete("/api/photos/google-album")
def disconnect_google_photos_album():
    db["photos"] = [p for p in db.get("photos", []) if p.get("source") != "google_photos"]
    if "settings" in db:
        db["settings"]["googlePhotosAlbumUrl"] = ""
        db["settings"]["googlePhotosLastSynced"] = None
        db["settings"]["googlePhotosCount"] = 0
    save_db(db)
    return {"status": "ok", "remainingPhotos": len(db.get("photos", []))}

# --- Magic Import (AI Scheduling via Local Ollama) ---
class MagicImportRequest(BaseModel):
    text: str
    memberId: str = "m5"

@app.post("/api/magic-import")
async def magic_import_schedule(req: MagicImportRequest):
    input_text = req.text.strip()
    if not input_text:
        raise HTTPException(status_code=400, detail="Schedule text cannot be empty")
    
    prompt = f"""You are a precise calendar schedule extraction assistant. Extract all dates, event titles, start times, end times, and locations from the schedule text below.
Today's date is: {date.today().isoformat()}.

Return ONLY a JSON array of event objects matching this exact structure:
[
  {{
    "title": "Soccer Game vs Tigers",
    "date": "YYYY-MM-DD",
    "time": "HH:MM",
    "endTime": "HH:MM",
    "location": "Memorial Park",
    "notes": "Bring uniform"
  }}
]
Rules:
1. Always use 24-hour time HH:MM (e.g. 16:30 for 4:30 PM).
2. If no year is specified, assume 2026.
3. If no endTime is given, estimate 1 hour after start time.
4. Output valid raw JSON only. Do not add markdown backticks, explanations or conversational text.

Schedule Text:
{input_text}
"""
    extracted_events = []
    try:
        # Call local Ollama on llmserver (e.g. qwen2.5-coder:14b or deepseek-r1:14b)
        ollama_payload = {
            "model": "qwen2.5-coder:14b",
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.1, "num_ctx": 4096}
        }
        ollama_req = urllib.request.Request(
            f"{OLLAMA_HOST}/api/generate",
            data=json.dumps(ollama_payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(ollama_req, timeout=40) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            raw_answer = res_data.get("response", "")
            
            # Extract JSON array
            match = re.search(r'\[\s*\{.*\}\s*\]', raw_answer, re.DOTALL)
            if match:
                extracted_events = json.loads(match.group(0))
            else:
                extracted_events = json.loads(raw_answer)
    except Exception as e:
        logger.warning(f"Ollama AI extraction fallback: {e}")
        # Rule-based fallback parser for dense schedules
        lines = [line.strip() for line in input_text.splitlines() if line.strip()]
        for line in lines:
            t_match = re.search(r'(\d{1,2}:\d{2}\s*(?:am|pm)?)', line, re.IGNORECASE)
            time_val = "10:00"
            if t_match:
                raw_time = t_match.group(1).lower()
                try:
                    if "pm" in raw_time and not raw_time.startswith("12"):
                        h, m = re.sub(r'[^\d:]', '', raw_time).split(":")
                        time_val = f"{int(h)+12:02d}:{int(m):02d}"
                    else:
                        h, m = re.sub(r'[^\d:]', '', raw_time).split(":")
                        time_val = f"{int(h):02d}:{int(m):02d}"
                except Exception:
                    time_val = "10:00"
            
            d_match = re.search(r'(\d{4}-\d{2}-\d{2})', line)
            d_val = d_match.group(1) if d_match else today_str
            
            extracted_events.append({
                "title": re.sub(r'(\d{1,2}:\d{2}\s*(?:am|pm)?|\d{4}-\d{2}-\d{2})', '', line).strip() or "Imported Event",
                "date": d_val,
                "time": time_val,
                "endTime": "11:00",
                "location": "Imported from document",
                "notes": "Magic Import via Family Hub AI",
            })
    
    # Save newly imported events into DB
    added = []
    for item in extracted_events:
        new_ev = {
            "id": f"magic_{int(time.time()*1000)}_{len(added)}",
            "title": item.get("title", "Imported Schedule Event"),
            "date": item.get("date", today_str),
            "time": item.get("time", "09:00"),
            "endTime": item.get("endTime", "10:00"),
            "memberId": req.memberId or "m5",
            "category": "Magic Import",
            "location": item.get("location", ""),
            "notes": item.get("notes", "Auto-extracted by Family Hub AI"),
        }
        db.setdefault("events", []).append(new_ev)
        added.append(new_ev)
    
    save_db(db)
    return {"status": "ok", "count": len(added), "events": added}

@app.post("/api/magic-import/file")
async def magic_import_file(
    file: UploadFile = File(...),
    memberId: str = Form("m5")
):
    content = await file.read()
    filename = file.filename.lower() if file.filename else "schedule.txt"
    extracted_text = ""
    if filename.endswith(".pdf"):
        try:
            import io, pypdf
            reader = pypdf.PdfReader(io.BytesIO(content))
            for page in reader.pages:
                extracted_text += (page.extract_text() or "") + "\n"
        except Exception as e:
            logger.error(f"Failed to parse PDF: {e}")
            raise HTTPException(status_code=400, detail=f"PDF reading error: {e}")
    else:
        try:
            extracted_text = content.decode("utf-8")
        except UnicodeDecodeError:
            extracted_text = content.decode("latin-1", errors="ignore")
            
    if not extracted_text.strip():
        raise HTTPException(status_code=400, detail="No readable text could be extracted from uploaded file")
        
    req = MagicImportRequest(text=extracted_text[:12000], memberId=memberId)
    return await magic_import_schedule(req)

async def background_sync_worker():
    await asyncio.sleep(5)
    while True:
        try:
            await sync_all_feeds()
        except Exception as e:
            logger.error(f"Background feed sync worker error: {e}")
        await asyncio.sleep(900)  # Sync every 15 minutes

@app.on_event("startup")
async def on_startup():
    asyncio.create_task(background_sync_worker())

@app.get("/", response_class=HTMLResponse)
def serve_index():
    index_file = Path("static/index.html")
    if index_file.exists():
        return HTMLResponse(content=index_file.read_text(encoding="utf-8"))
    return HTMLResponse("<h1>Family Hub Starting Up...</h1>")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 3003))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)
