#!/usr/bin/env python3
"""
Harita — dashboard harian lokal.
Server HTTP murni Python (tanpa dependency), SQLite untuk penyimpanan,
dan proxy Open-Meteo untuk cuaca realtime.
"""
from __future__ import annotations

import json
import math
import os
import re
import sqlite3
import hashlib
import hmac
import sys
import threading
import time
import urllib.parse
import urllib.request
import subprocess
import webbrowser
from datetime import datetime, date, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from zoneinfo import ZoneInfo

__version__ = "1.6.0"

try:
    import psutil
except Exception:  # pragma: no cover
    psutil = None

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_FROZEN = bool(getattr(sys, "frozen", False))
RESOURCE_DIR = getattr(sys, "_MEIPASS", BASE_DIR)  # PyInstaller extraction dir
STATIC_DIR = os.path.join(RESOURCE_DIR, "static")


def _env(new_key: str, legacy_key: str, default: str = "") -> str:
    """Read HARITA_* first; HARITA_* stays supported for existing installs."""
    value = os.environ.get(new_key)
    if value not in (None, ""):
        return value
    value = os.environ.get(legacy_key)
    return value if value not in (None, "") else default


def _default_data_dir() -> str:
    """Persistent, per-user data dir for frozen builds; repo-local otherwise."""
    if not _FROZEN:
        return os.path.join(BASE_DIR, "data")
    home = os.path.expanduser("~")
    if sys.platform.startswith("win"):
        root = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA") or os.path.join(home, "AppData", "Local")
        return os.path.join(root, "Harita")
    if sys.platform == "darwin":
        return os.path.join(home, "Library", "Application Support", "Harita")
    root = os.environ.get("XDG_DATA_HOME") or os.path.join(home, ".local", "share")
    return os.path.join(root, "harita")


def _legacy_data_dir() -> str:
    if not _FROZEN:
        return os.path.join(BASE_DIR, "data")
    home = os.path.expanduser("~")
    if sys.platform.startswith("win"):
        root = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA") or os.path.join(home, "AppData", "Local")
        return os.path.join(root, "Harita")
    if sys.platform == "darwin":
        return os.path.join(home, "Library", "Application Support", "Harita")
    root = os.environ.get("XDG_DATA_HOME") or os.path.join(home, ".local", "share")
    return os.path.join(root, "harita")


DATA_DIR = _env("HARITA_DATA", "MYACT_DATA") or _default_data_dir()

# One-time migration of the default frozen data directory. Existing HARITA_DATA
# overrides and source-tree data/ folders stay untouched.
if not _env("HARITA_DATA", "MYACT_DATA"):
    _new_dir, _old_dir = DATA_DIR, _legacy_data_dir()
    if _new_dir != _old_dir and not os.path.exists(_new_dir) and os.path.isdir(_old_dir):
        try:
            os.rename(_old_dir, _new_dir)
        except OSError:
            pass

os.makedirs(DATA_DIR, exist_ok=True)
_legacy_db = os.path.join(DATA_DIR, "harita.db")  # legacy from pre-rename releases
_default_db = os.path.join(DATA_DIR, "harita.db")
if not _env("HARITA_DB", "MYACT_DB") and os.path.exists(_legacy_db) and not os.path.exists(_default_db):
    try:
        os.rename(_legacy_db, _default_db)
    except OSError:
        _default_db = _legacy_db

DB_PATH = _env("HARITA_DB", "MYACT_DB") or _default_db
WEATHER_CACHE_PATH = os.path.join(DATA_DIR, "weather_cache.json")
MUSIC_DIR = _env("HARITA_MUSIC", "MYACT_MUSIC") or (os.path.join(DATA_DIR, "music") if _FROZEN else os.path.join(BASE_DIR, "music"))


def _read_port() -> int:
    raw = _env("HARITA_PORT", "MYACT_PORT", "8777").strip()
    try:
        port = int(raw)
    except ValueError:
        raise SystemExit(f"HARITA_PORT harus berupa angka, bukan {raw!r}")
    if not (1 <= port <= 65535):
        raise SystemExit(f"HARITA_PORT harus di antara 1 dan 65535, bukan {port}")
    return port


PORT = _read_port()
def _local_tz():
    forced = _env("HARITA_TZ", "MYACT_TZ")
    if forced:
        try:
            return ZoneInfo(forced)
        except Exception:
            pass
    # default: system local timezone
    try:
        return datetime.now().astimezone().tzinfo
    except Exception:
        return ZoneInfo("Asia/Jakarta")

TZ = _local_tz()

os.makedirs(MUSIC_DIR, exist_ok=True)

# ----------------------------------------------------------------------------
# Database
# ----------------------------------------------------------------------------

SCHEMA = """
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    title TEXT NOT NULL,
    notes TEXT DEFAULT '',
    priority INTEGER NOT NULL DEFAULT 2,
    done INTEGER NOT NULL DEFAULT 0,
    start_time TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    template_id INTEGER,
    position INTEGER NOT NULL DEFAULT 0,
    subtasks TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date);
CREATE TABLE IF NOT EXISTS task_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 2,
    start_time TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT,
    end_time TEXT,
    category TEXT NOT NULL DEFAULT 'pribadi',
    notes TEXT DEFAULT '',
    repeat TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE TABLE IF NOT EXISTS competitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'Lomba',
    deadline TEXT NOT NULL,
    location TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'persiapan',
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS competition_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    competition_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT DEFAULT '',
    pinned INTEGER NOT NULL DEFAULT 0,
    color TEXT NOT NULL DEFAULT 'teal',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    amount INTEGER NOT NULL,
    category TEXT NOT NULL DEFAULT 'lainnya',
    method TEXT NOT NULL DEFAULT 'tunai',
    note TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE TABLE IF NOT EXISTS daily_reviews (
    date TEXT PRIMARY KEY,
    wins TEXT NOT NULL DEFAULT '',
    carried TEXT NOT NULL DEFAULT '',
    tomorrow TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS weekly_goals (
    week_start TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    weekday INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT,
    subject TEXT NOT NULL,
    room TEXT DEFAULT '',
    note TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_schedule_weekday ON schedule(weekday);
CREATE TABLE IF NOT EXISTS focus_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    minutes INTEGER NOT NULL,
    label TEXT DEFAULT '',
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS music_tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    artist TEXT DEFAULT '',
    album TEXT DEFAULT '',
    duration INTEGER NOT NULL DEFAULT 0,
    added_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS music_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS streak (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    completed INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reminder (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_type TEXT NOT NULL,
    target_id INTEGER NOT NULL,
    minutes_before INTEGER NOT NULL DEFAULT 10,
    sent INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'flame',
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS habit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    UNIQUE(habit_id, date)
);
CREATE TABLE IF NOT EXISTS grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL,
    label TEXT NOT NULL,
    score REAL NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_habit_log_date ON habit_log(date);
CREATE INDEX IF NOT EXISTS idx_grades_subject ON grades(subject);
CREATE TABLE IF NOT EXISTS flashcards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    ease REAL NOT NULL DEFAULT 2.5,
    interval_days INTEGER NOT NULL DEFAULT 0,
    repetitions INTEGER NOT NULL DEFAULT 0,
    due TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_flashcards_due ON flashcards(due);
"""

DEFAULT_SETTINGS = {
    "name": "Kamu",
    "location": "jakarta",
    "carry_over": "1",
    "sound": "1",
    "notifications": "0",
    "theme": "dark",
    "music_volume": "70",
    "now_playing": "",
    "music_paused": "1",
    "onboarded": "0",
    "lock_enabled": "0",
    "lock_pin_hash": "",
    "accent": "terracotta",
    "font_size": "normal",
    "contrast": "normal",
    "sidebar": "expanded",
    "reminder_lead": "10",
    "default_view": "beranda",
    "pinned_views": "",
    "hidden_views": "",
    "language": "id",
    "expense_budget": "0",
    "onboarding_goal": "mixed",
    "dashboard_mode": "minimal",
}


def clip(value, limit: int = 5000) -> str:
    return str(value or "")[:limit].strip()


def clean_subtasks(value) -> str:
    """Normalise a subtask list to a compact JSON string."""
    items = []
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (ValueError, TypeError):
            value = []
    if isinstance(value, list):
        for i, item in enumerate(value[:40]):
            if isinstance(item, str):
                title = clip(item, 140)
                done = 0
            elif isinstance(item, dict):
                title = clip(item.get("title"), 140)
                done = 1 if item.get("done") in (1, "1", True) else 0
            else:
                continue
            if not title:
                continue
            items.append({"id": i + 1, "title": title, "done": done})
    return json.dumps(items, ensure_ascii=False)

def log(msg: str) -> None:
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        line = f"[{now_local()}] {msg}"
        log_path = os.path.join(DATA_DIR, "server.log")
        if os.path.exists(log_path) and os.path.getsize(log_path) > 1_000_000:
            os.replace(log_path, log_path + ".1")
        with open(log_path, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")
        print(line, flush=True)
    except Exception:
        try:
            print(msg, flush=True)
        except Exception:
            pass


def db_connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    # integrity check first; if corrupt, rename DB and start fresh
    if os.path.exists(DB_PATH):
        try:
            chk = sqlite3.connect(DB_PATH, timeout=10)
            ok = chk.execute("PRAGMA integrity_check").fetchone()
            chk.close()
            if ok and ok[0] != "ok":
                stamp = datetime.now(TZ).strftime("%Y%m%d-%H%M%S")
                corrupt = DB_PATH + f".corrupt-{stamp}.bak"
                os.replace(DB_PATH, corrupt)
                try:
                    os.makedirs(DATA_DIR, exist_ok=True)
                    with open(os.path.join(DATA_DIR, ".corrupt-detected"), "w", encoding="utf-8") as fh:
                        fh.write(os.path.basename(corrupt))
                except OSError:
                    pass
                print(f"PERINGATAN: database korup — dipindahkan ke {corrupt}. Memulai DB baru.")
        except Exception as exc:
            print(f"PERINGATAN: gagal cek integritas DB ({exc}) — mencoba pulih.")
    conn = db_connect()
    try:
        conn.executescript(SCHEMA)
        for key, value in DEFAULT_SETTINGS.items():
            conn.execute(
                "INSERT OR IGNORE INTO settings(key, value) VALUES(?, ?)", (key, value)
            )

        # ---- migrations: focus_sessions.subject & streak -> habits ----
        cols = [r[1] for r in conn.execute("PRAGMA table_info(focus_sessions)").fetchall()]
        if "subject" not in cols:
            conn.execute("ALTER TABLE focus_sessions ADD COLUMN subject TEXT DEFAULT ''")
        conn.execute("INSERT OR IGNORE INTO settings(key, value) VALUES('kkm', '75')")
        # ---- migrations: recurring task templates + soft delete habits/grades ----
        for col, ddl in [("frequency", "ALTER TABLE task_templates ADD COLUMN frequency TEXT NOT NULL DEFAULT 'daily'"),
                         ("weekday", "ALTER TABLE task_templates ADD COLUMN weekday INTEGER"),
                         ("day_of_month", "ALTER TABLE task_templates ADD COLUMN day_of_month INTEGER")]:
            cols = [r[1] for r in conn.execute("PRAGMA table_info(task_templates)").fetchall()]
            if col not in cols:
                conn.execute(ddl)
        for _t in ("habits", "grades"):
            cols = [r[1] for r in conn.execute(f"PRAGMA table_info({_t})").fetchall()]
            if "deleted_at" not in cols:
                conn.execute(f"ALTER TABLE {_t} ADD COLUMN deleted_at TEXT")
        # ---- migrations: task ordering + subtasks + recurring events ----
        for _t, _cols in (
            ("tasks", [("position", "INTEGER NOT NULL DEFAULT 0"), ("subtasks", "TEXT NOT NULL DEFAULT '[]'")]),
            ("events", [("repeat", "TEXT NOT NULL DEFAULT ''")]),
        ):
            existing = [r[1] for r in conn.execute(f"PRAGMA table_info({_t})").fetchall()]
            for _col, _ddl in _cols:
                if _col not in existing:
                    conn.execute(f"ALTER TABLE {_t} ADD COLUMN {_col} {_ddl}")
        # ---- migrations: soft delete ----
        for _t in ("tasks", "events", "competitions", "notes", "expenses"):
            cols = [r[1] for r in conn.execute(f"PRAGMA table_info({_t})").fetchall()]
            if "deleted_at" not in cols:
                conn.execute(f"ALTER TABLE {_t} ADD COLUMN deleted_at TEXT")
        hab_count = conn.execute("SELECT COUNT(*) AS c FROM habits").fetchone()["c"]
        streak_count = conn.execute("SELECT COUNT(*) AS c FROM streak").fetchone()["c"]
        if hab_count == 0 and streak_count > 0:
            conn.execute(
                "INSERT INTO habits(name, icon, created_at) VALUES('Konsistensi harian', 'flame', ?)",
                (now_local(),),
            )
            hid = conn.execute("SELECT id FROM habits ORDER BY id DESC LIMIT 1").fetchone()["id"]
            conn.execute(
                "INSERT OR IGNORE INTO habit_log(habit_id, date, completed, updated_at) "
                "SELECT ?, date, completed, updated_at FROM streak",
                (hid,),
            )
        # fresh install: tidak ada seed data — mulai kosong
        conn.commit()
    finally:
        conn.close()


def get_settings(conn: sqlite3.Connection) -> dict:
    rows = conn.execute("SELECT key, value FROM settings").fetchall()
    data = {r["key"]: r["value"] for r in rows}
    for key, value in DEFAULT_SETTINGS.items():
        data.setdefault(key, value)
    return data


def set_setting(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute(
        "INSERT INTO settings(key, value) VALUES(?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value),
    )


def today_local() -> str:
    return datetime.now(TZ).date().isoformat()


def now_local() -> str:
    return datetime.now(TZ).isoformat(timespec="seconds")


def addDays(date_str: str, days: int) -> str:
    return (datetime.fromisoformat(date_str).date() + __import__("datetime").timedelta(days=days)).isoformat()


def ensure_day(conn: sqlite3.Connection, day: str) -> dict:
    """Materialise rutinitas harian dan bawa tugas yang belum selesai (sekali/hari)."""
    created = 0
    templates = conn.execute(
        "SELECT * FROM task_templates WHERE active = 1 ORDER BY priority, id"
    ).fetchall()
    day_dow = datetime.fromisoformat(day).isoweekday() % 7  # 0=Sun .. 6=Sat (JS getDay)
    day_dom = datetime.fromisoformat(day).day
    for tpl in templates:
        freq = (tpl["frequency"] if "frequency" in tpl.keys() else "daily") or "daily"
        if freq == "weekday" and day_dow not in (1, 2, 3, 4, 5):
            continue
        if freq == "weekly" and (tpl["weekday"] is None or int(tpl["weekday"]) != day_dow):
            continue
        if freq == "monthly" and (tpl["day_of_month"] is None or int(tpl["day_of_month"]) != day_dom):
            continue
        exists = conn.execute(
            "SELECT 1 FROM tasks WHERE deleted_at IS NULL AND date = ? AND template_id = ? LIMIT 1",
            (day, tpl["id"]),
        ).fetchone()
        if not exists:
            conn.execute(
                "INSERT INTO tasks(date, title, priority, start_time, source, template_id, created_at, updated_at) "
                "VALUES(?,?,?,?,?,?,?,?)",
                (
                    day,
                    tpl["title"],
                    tpl["priority"],
                    tpl["start_time"],
                    "rutin",
                    tpl["id"],
                    now_local(),
                    now_local(),
                ),
            )
            created += 1

    carried = 0
    if day == today_local():
        settings = get_settings(conn)
        last_open = settings.get("last_open_date", "")
        if last_open != day:
            if settings.get("carry_over", "1") == "1":
                prev = conn.execute(
                    "SELECT date FROM tasks WHERE deleted_at IS NULL AND date < ? ORDER BY date DESC LIMIT 1",
                    (day,),
                ).fetchone()
                if prev:
                    rows = conn.execute(
                        "SELECT title, notes, priority, start_time FROM tasks "
                        "WHERE deleted_at IS NULL AND date = ? AND done = 0",
                        (prev["date"],),
                    ).fetchall()
                    for row in rows:
                        conn.execute(
                            "INSERT INTO tasks(date, title, notes, priority, start_time, source, created_at, updated_at) "
                            "VALUES(?,?,?,?,?,?,?,?)",
                            (
                                day,
                                row["title"],
                                row["notes"],
                                row["priority"],
                                row["start_time"],
                                "lanjutan",
                                now_local(),
                                now_local(),
                            ),
                        )
                        carried += 1
            set_setting(conn, "last_open_date", day)
    conn.commit()
    return {"created": created, "carried": carried}


def row_to_dict(row: sqlite3.Row) -> dict:
    return {k: row[k] for k in row.keys()}


def parse_json_body(handler: BaseHTTPRequestHandler, max_bytes: int = 2_000_000) -> dict:
    length = int(handler.headers.get("Content-Length") or 0)
    if length <= 0:
        return {}
    if length > max_bytes:
        raise ValueError(f"Payload terlalu besar (maks {max_bytes // 1_000_000} MB)")
    raw = handler.rfile.read(length)
    data = json.loads(raw.decode("utf-8"))
    if not isinstance(data, dict):
        raise ValueError("Payload harus berupa objek JSON")
    return data


# ----------------------------------------------------------------------------
# Weather (Open-Meteo, tanpa API key)
# ----------------------------------------------------------------------------

LOCATIONS = {
    "jakarta":    {"name": "Jakarta",    "lat": -6.2088, "lon": 106.8456},
    "surabaya":   {"name": "Surabaya",   "lat": -7.2575, "lon": 112.7521},
    "bandung":    {"name": "Bandung",    "lat": -6.9175, "lon": 107.6191},
    "medan":      {"name": "Medan",      "lat":  3.5952, "lon":  98.6722},
    "semarang":   {"name": "Semarang",   "lat": -6.9667, "lon": 110.4167},
    "yogyakarta": {"name": "Yogyakarta", "lat": -7.7956, "lon": 110.3695},
    "solo":       {"name": "Solo",       "lat": -7.5666, "lon": 110.8167},
    "malang":     {"name": "Malang",     "lat": -7.9666, "lon": 112.6326},
    "makassar":   {"name": "Makassar",   "lat": -5.1477, "lon": 119.4327},
    "palembang":  {"name": "Palembang",  "lat": -2.9909, "lon": 104.7562},
    "manado":     {"name": "Manado",     "lat":  1.4931, "lon": 124.8413},
    "kupang":     {"name": "Kupang",     "lat": -10.1772, "lon": 123.6070},
    "bandaaceh":  {"name": "Banda Aceh", "lat":  5.5483, "lon":  95.3238},
    "denpasar":   {"name": "Denpasar",   "lat": -8.65,   "lon": 115.2167},
    "ubud":       {"name": "Ubud",       "lat": -8.507,  "lon": 115.2650},
    "ambon":      {"name": "Ambon",      "lat": -3.6954, "lon": 128.1814},
}

weather_lock = threading.Lock()
weather_memory: dict[str, dict] = {}


def load_weather_disk() -> None:
    global weather_memory
    try:
        with open(WEATHER_CACHE_PATH, "r", encoding="utf-8") as f:
            weather_memory = json.load(f)
    except Exception:
        weather_memory = {}


def save_weather_disk() -> None:
    try:
        tmp = WEATHER_CACHE_PATH + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(weather_memory, f, ensure_ascii=False)
        os.replace(tmp, WEATHER_CACHE_PATH)
    except Exception:
        pass


def fetch_weather(key: str) -> dict:
    loc = LOCATIONS[key]
    params = {
        "latitude": loc["lat"],
        "longitude": loc["lon"],
        "timezone": "Asia/Makassar",
        "forecast_days": "7",
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,"
        "precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,"
        "wind_direction_10m,wind_gusts_10m",
        "hourly": "temperature_2m,precipitation_probability,weather_code,precipitation,is_day",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,"
        "precipitation_probability_max,sunrise,sunset,uv_index_max,wind_speed_10m_max",
        "timeformat": "iso8601",
        "wind_speed_unit": "kmh",
    }
    url = "https://api.open-meteo.com/v1/forecast?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "Harita/1.0 (local)"})
    with urllib.request.urlopen(req, timeout=8) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    payload["location_key"] = key
    payload["location_name"] = loc["name"]
    payload["fetched_at"] = now_local()
    return payload


def get_weather(key: str, force: bool = False) -> dict:
    if key not in LOCATIONS:
        key = "jakarta"
    with weather_lock:
        cached = weather_memory.get(key)
        age = (
            time.time() - datetime.fromisoformat(cached["fetched_at"]).timestamp()
            if cached
            else 10**9
        )
        if cached and not force and age < 600:
            return {"ok": True, "stale": False, "data": cached}
        try:
            data = fetch_weather(key)
            weather_memory[key] = data
            save_weather_disk()
            return {"ok": True, "stale": False, "data": data}
        except Exception as exc:
            if cached:
                return {
                    "ok": True,
                    "stale": True,
                    "error": str(exc),
                    "data": cached,
                }
            return {"ok": False, "error": str(exc)}


# ----------------------------------------------------------------------------
# API
# ----------------------------------------------------------------------------


def api_tasks(handler: BaseHTTPRequestHandler, query: dict) -> None:
    day = query.get("date") or today_local()
    conn = db_connect()
    try:
        meta = ensure_day(conn, day)
        rows = conn.execute(
            "SELECT * FROM tasks WHERE deleted_at IS NULL AND date = ? "
            "ORDER BY done ASC, CASE WHEN position = 0 THEN 1 ELSE 0 END, position ASC, "
            "CASE WHEN start_time IS NULL OR start_time = '' THEN 1 ELSE 0 END, "
            "start_time ASC, priority ASC, id ASC",
            (day,),
        ).fetchall()
        templates = conn.execute(
            "SELECT * FROM task_templates WHERE active = 1 ORDER BY priority, id"
        ).fetchall()
        send_json(
            handler,
            200,
            {
                "date": day,
                "tasks": [row_to_dict(r) for r in rows],
                "templates": [row_to_dict(r) for r in templates],
                **meta,
            },
        )
    finally:
        conn.close()


def api_task_create(handler: BaseHTTPRequestHandler) -> None:
    body = parse_json_body(handler)
    day = (body.get("date") or today_local()).strip()
    title = clip(body.get("title"), 300)
    if not title:
        raise ValueError("Judul tugas wajib diisi")
    priority = int(body.get("priority") or 2)
    start_time = (body.get("start_time") or "").strip() or None
    notes = clip(body.get("notes"), 5000)
    subtasks = clean_subtasks(body.get("subtasks"))
    repeat = bool(body.get("repeat"))
    conn = db_connect()
    try:
        now = now_local()
        next_pos = conn.execute(
            "SELECT COALESCE(MAX(position), 0) + 1 FROM tasks WHERE date = ? AND deleted_at IS NULL",
            (day,),
        ).fetchone()[0]
        template_id = None
        if repeat:
            cur = conn.execute(
                "INSERT INTO task_templates(title, priority, start_time, created_at) VALUES(?,?,?,?)",
                (title, priority, start_time, now),
            )
            template_id = cur.lastrowid
        cur = conn.execute(
            "INSERT INTO tasks(date, title, notes, priority, start_time, source, template_id, position, subtasks, created_at, updated_at) "
            "VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            (
                day,
                title,
                notes,
                priority,
                start_time,
                "rutin" if repeat else "manual",
                template_id,
                next_pos,
                subtasks,
                now,
                now,
            ),
        )
        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (cur.lastrowid,)).fetchone()
        conn.commit()
        send_json(handler, 201, {"task": row_to_dict(row)})
    finally:
        conn.close()


def api_task_update(handler: BaseHTTPRequestHandler, task_id: int) -> None:
    body = parse_json_body(handler)
    fields, values = [], []
    allowed = {
        "title": str,
        "notes": str,
        "priority": int,
        "done": int,
        "start_time": str,
        "date": str,
        "position": int,
    }
    for key, caster in allowed.items():
        if key in body:
            fields.append(f"{key} = ?")
            values.append(caster(body[key]))
    if "subtasks" in body:
        fields.append("subtasks = ?")
        values.append(clean_subtasks(body.get("subtasks")))
    if not fields:
        send_json(handler, 400, {"error": "Tidak ada perubahan"})
        return
    fields.append("updated_at = ?")
    values.append(now_local())
    values.append(task_id)
    conn = db_connect()
    try:
        conn.execute(f"UPDATE tasks SET {', '.join(fields)} WHERE id = ?", values)
        conn.commit()
        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        if not row:
            send_json(handler, 404, {"error": "Tugas tidak ditemukan"})
            return
        send_json(handler, 200, {"task": row_to_dict(row)})
    finally:
        conn.close()


def api_task_delete(handler: BaseHTTPRequestHandler, task_id: int) -> None:
    conn = db_connect()
    try:
        soft_delete(conn, "tasks", task_id)
        conn.commit()
        send_json(handler, 200, {"ok": True})
    finally:
        conn.close()


def api_task_carry(handler: BaseHTTPRequestHandler) -> None:
    body = parse_json_body(handler)
    to_day = body.get("to") or today_local()
    from_day = body.get("from")
    conn = db_connect()
    try:
        if not from_day:
            row = conn.execute(
                "SELECT date FROM tasks WHERE deleted_at IS NULL AND date < ? ORDER BY date DESC LIMIT 1",
                (to_day,),
            ).fetchone()
            from_day = row["date"] if row else to_day
        rows = conn.execute(
            "SELECT title, notes, priority, start_time FROM tasks WHERE deleted_at IS NULL AND date = ? AND done = 0",
            (from_day,),
        ).fetchall()
        for row in rows:
            conn.execute(
                "INSERT INTO tasks(date, title, notes, priority, start_time, source, created_at, updated_at) "
                "VALUES(?,?,?,?,?,?,?,?)",
                (
                    to_day,
                    row["title"],
                    row["notes"],
                    row["priority"],
                    row["start_time"],
                    "lanjutan",
                    now_local(),
                    now_local(),
                ),
            )
        conn.commit()
        send_json(handler, 200, {"copied": len(rows), "from": from_day})
    finally:
        conn.close()


def api_demo(handler: BaseHTTPRequestHandler) -> None:
    """Seed a small, friendly sample dataset so new users can explore."""
    body = parse_json_body(handler)
    force = bool(body.get("force"))
    conn = db_connect()
    try:
        existing = conn.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
        if existing and not force:
            send_json(handler, 200, {"ok": True, "seeded": False, "reason": "data sudah ada"})
            return
        now = now_local()
        today = today_local()
        def add_days(n: int) -> str:
            from datetime import date, timedelta
            return (date.fromisoformat(today) + timedelta(days=n)).isoformat()

        tasks = [
            ("Matematika: latihan 10 soal limit", 1, "16:00", 0),
            ("Baca 20 halaman buku sejarah", 2, "20:00", 0),
            ("Review catatan biologi", 2, None, 1),
            ("Olahraga 20 menit", 3, "06:30", 1),
        ]
        for title, prio, start, done in tasks:
            conn.execute(
                "INSERT INTO tasks (date, title, priority, done, start_time, source, created_at, updated_at) VALUES (?,?,?,?,?,'manual',?,?)",
                (today, title, prio, done, start, now, now),
            )
        conn.execute(
            "INSERT INTO task_templates (title, priority, start_time, active, created_at) VALUES (?,?,?,1,?)",
            ("Minum air 8 gelas", 3, None, now),
        )
        events = [
            ("Belajar kelompok di rumah Rani", today, "15:00", "17:00", "sekolah", "Bawa buku catatan"),
            ("Latihan presentasi", add_days(2), "09:00", "10:00", "pribadi", ""),
        ]
        for title, date, time, end, cat, notes in events:
            conn.execute(
                "INSERT INTO events (title, date, time, end_time, category, notes, created_at) VALUES (?,?,?,?,?,?,?)",
                (title, date, time, end, cat, notes, now),
            )
        notes = [
            ("Rangkuman limit fungsi", "Limit = nilai yang didekati. Cek dari kiri dan kanan.\nKalau beda → limit tidak ada.", 1, "teal"),
            ("Ide proyek kelas", "Aplikasi absensi pakai QR — bagi tugas: UI, backend, dokumentasi.", 0, "amber"),
        ]
        for title, body_text, pinned, color in notes:
            conn.execute(
                "INSERT INTO notes (title, body, pinned, color, created_at, updated_at) VALUES (?,?,?,?,?,?)",
                (title, body_text, pinned, color, now, now),
            )
        for cat, amount, method, note, day_off in [
            ("makan", 15000, "tunai", "Nasi goreng kantin", 0),
            ("transport", 12000, "qris", "Ojek ke sekolah", 0),
            ("belajar", 45000, "transfer", "Buku latihan soal", -1),
            ("hiburan", 20000, "tunai", "Nonton film bersama", -3),
        ]:
            conn.execute(
                "INSERT INTO expenses(date, amount, category, method, note, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
                (add_days(day_off), amount, cat, method, note, now, now),
            )
        for weekday in range(5):
            rows = [("07:00", "07:45", "Matematika", "R.12"), ("08:00", "08:45", "Bahasa Indonesia", "R.07")]
            for start, end, subject, room in rows:
                conn.execute(
                    "INSERT INTO schedule (weekday, start_time, end_time, subject, room, note) VALUES (?,?,?,?,?,'')",
                    (weekday, start, end, subject, room),
                )
        cur = conn.execute(
            "INSERT INTO competitions (title, category, deadline, location, notes, status, created_at) VALUES (?,?,?,?,?,?,?)",
            ("Lomba Karya Tulis Ilmiah", "Lomba", add_days(21) + "T23:59", "Online", "Tema: teknologi hijau", "persiapan", now),
        )
        comp_id = cur.lastrowid
        for i, (title, done) in enumerate([("Tentukan judul", 1), ("Kumpulkan referensi", 1), ("Tulis draf", 0), ("Revisi akhir", 0)]):
            conn.execute(
                "INSERT INTO competition_tasks (competition_id, title, done, position, created_at) VALUES (?,?,?,?,?)",
                (comp_id, title, done, i, now),
            )
        for subject, label, score in [("Matematika", "Ulangan 1", 88), ("Matematika", "Tugas", 92), ("Biologi", "Ulangan 1", 76), ("Sejarah", "Tugas", 84)]:
            conn.execute("INSERT INTO grades (subject, label, score, created_at) VALUES (?,?,?,?)", (subject, label, score, now))
        for subject, front, back in [
            ("Biologi", "Apa fungsi mitokondria?", "Menghasilkan energi (ATP) untuk sel."),
            ("Matematika", "Rumus limit (x→0) sin x / x", "1"),
        ]:
            conn.execute(
                "INSERT INTO flashcards (subject, front, back, ease, interval_days, repetitions, due, created_at) VALUES (?,?,?,2.5,0,0,?,?)",
                (subject, front, back, today, now),
            )
        cur = conn.execute("INSERT INTO habits (name, icon, created_at) VALUES (?,?,?)", ("Belajar 30 menit", "book", now))
        habit_id = cur.lastrowid
        for offset, done in [(-5, 1), (-4, 1), (-3, 0), (-2, 1), (-1, 1), (0, 0)]:
            conn.execute(
                "INSERT OR REPLACE INTO habit_log (habit_id, date, completed, updated_at) VALUES (?,?,?,?)",
                (habit_id, add_days(offset), done, now),
            )
        for offset, minutes, label in [(-2, 25, "Matematika"), (-1, 50, "Biologi"), (-1, 25, "Matematika")]:
            conn.execute(
                "INSERT INTO focus_sessions (date, minutes, label, created_at) VALUES (?,?,?,?)",
                (add_days(offset), minutes, label, now),
            )
        conn.execute("INSERT INTO settings (key, value) VALUES ('onboarded','1') ON CONFLICT(key) DO UPDATE SET value='1'")
        conn.commit()
        send_json(handler, 200, {"ok": True, "seeded": True})
    finally:
        conn.close()


def api_task_reorder(handler: BaseHTTPRequestHandler) -> None:
    body = parse_json_body(handler)
    ids = body.get("ids") or []
    if not isinstance(ids, list):
        raise ValueError("ids harus berupa daftar")
    conn = db_connect()
    try:
        now = now_local()
        for index, task_id in enumerate(ids[:500], start=1):
            try:
                tid = int(task_id)
            except (TypeError, ValueError):
                continue
            conn.execute("UPDATE tasks SET position = ?, updated_at = ? WHERE id = ?", (index, now, tid))
        conn.commit()
        send_json(handler, 200, {"ok": True, "count": len(ids)})
    finally:
        conn.close()


def api_task_complete_all(handler: BaseHTTPRequestHandler) -> None:
    body = parse_json_body(handler)
    day = body.get("date") or today_local()
    conn = db_connect()
    try:
        ids = [r["id"] for r in conn.execute(
            "SELECT id FROM tasks WHERE date = ? AND deleted_at IS NULL AND done = 0", (day,)
        ).fetchall()]
        if ids:
            conn.execute(
                "UPDATE tasks SET done = 1, updated_at = ? WHERE date = ? AND deleted_at IS NULL AND done = 0",
                (now_local(), day),
            )
        conn.commit()
        send_json(handler, 200, {"ok": True, "date": day, "count": len(ids), "ids": ids})
    finally:
        conn.close()


def api_task_reset(handler: BaseHTTPRequestHandler) -> None:
    body = parse_json_body(handler)
    day = body.get("date") or today_local()
    conn = db_connect()
    try:
        conn.execute("UPDATE tasks SET deleted_at = ? WHERE date = ? AND deleted_at IS NULL", (now_local(), day))
        conn.commit()
        send_json(handler, 200, {"ok": True, "date": day})
    finally:
        conn.close()



def api_template_create(handler: BaseHTTPRequestHandler) -> None:
    body = parse_json_body(handler)
    title = clip(body.get("title"), 160)
    if not title:
        raise ValueError("Nama rutinitas wajib diisi")
    priority = int(body.get("priority") or 2)
    start_time = clip(body.get("start_time"), 5) or None
    freq = clip(body.get("frequency"), 20) or "daily"
    weekday = body.get("weekday")
    weekday = int(weekday) if weekday not in (None, "") else None
    dom = body.get("day_of_month")
    dom = int(dom) if dom not in (None, "") else None
    if freq not in ("daily", "weekday", "weekly", "monthly"):
        freq = "daily"
    conn = db_connect()
    try:
        conn.execute(
            "INSERT INTO task_templates(title, priority, start_time, active, created_at, frequency, weekday, day_of_month) "
            "VALUES(?,?,?,1,?,?,?,?)",
            (title, priority, start_time, now_local(), freq, weekday, dom),
        )
        conn.commit()
        send_json(handler, 201, {"ok": True})
    finally:
        conn.close()


def api_template_update(handler: BaseHTTPRequestHandler, tpl_id: int) -> None:
    body = parse_json_body(handler)
    conn = db_connect()
    try:
        if body.get("title"):
            conn.execute("UPDATE task_templates SET title = ? WHERE id = ?", (clip(body["title"], 160), tpl_id))
        for field in ("priority",):
            if body.get(field) is not None:
                conn.execute("UPDATE task_templates SET priority = ? WHERE id = ?", (int(body[field]), tpl_id))
        if body.get("start_time") is not None:
            conn.execute("UPDATE task_templates SET start_time = ? WHERE id = ?", (clip(body["start_time"], 5) or None, tpl_id))
        if body.get("frequency") is not None:
            freq = clip(body["frequency"], 20)
            if freq in ("daily", "weekday", "weekly", "monthly"):
                conn.execute("UPDATE task_templates SET frequency = ? WHERE id = ?", (freq, tpl_id))
        if "weekday" in body:
            conn.execute("UPDATE task_templates SET weekday = ? WHERE id = ?", (int(body["weekday"]) if body["weekday"] not in (None, "") else None, tpl_id))
        if "day_of_month" in body:
            conn.execute("UPDATE task_templates SET day_of_month = ? WHERE id = ?", (int(body["day_of_month"]) if body["day_of_month"] not in (None, "") else None, tpl_id))
        conn.commit()
        send_json(handler, 200, {"ok": True})
    finally:
        conn.close()


def api_template_delete(handler: BaseHTTPRequestHandler, tpl_id: int) -> None:
    conn = db_connect()
    try:
        conn.execute("DELETE FROM task_templates WHERE id = ?", (tpl_id,))
        conn.execute("UPDATE tasks SET deleted_at = ? WHERE template_id = ? AND done = 0 AND deleted_at IS NULL", (now_local(), tpl_id))
        conn.commit()
        send_json(handler, 200, {"ok": True})
    finally:
        conn.close()


def api_events(handler: BaseHTTPRequestHandler, query: dict) -> None:
    start = query.get("from")
    end = query.get("to")
    conn = db_connect()
    try:
        sql = "SELECT * FROM events WHERE deleted_at IS NULL"
        params: list = []
        if start and end:
            sql += " WHERE date BETWEEN ? AND ?"
            params = [start, end]
        elif start:
            sql += " WHERE date >= ?"
            params = [start]
        sql += " ORDER BY date ASC, COALESCE(time, '99:99') ASC, id ASC"
        rows = conn.execute(sql, params).fetchall()
        send_json(handler, 200, {"events": [row_to_dict(r) for r in rows]})
    finally:
        conn.close()


def api_event_create(handler: BaseHTTPRequestHandler) -> None:
    body = parse_json_body(handler)
    title = clip(body.get("title"), 300)
    day = (body.get("date") or "").strip()
    if not title or not day:
        raise ValueError("Judul dan tanggal agenda wajib diisi")
    repeat = clip(body.get("repeat"), 20)
    if repeat not in ("", "weekly", "monthly"):
        repeat = ""
    conn = db_connect()
    try:
        cur = conn.execute(
            "INSERT INTO events(title, date, time, end_time, category, notes, repeat, created_at) "
            "VALUES(?,?,?,?,?,?,?,?)",
            (
                title,
                day,
                (body.get("time") or "").strip() or None,
                (body.get("end_time") or "").strip() or None,
                (body.get("category") or "pribadi").strip(),
                clip(body.get("notes"), 5000),
                repeat,
                now_local(),
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM events WHERE id = ?", (cur.lastrowid,)).fetchone()
        send_json(handler, 201, {"event": row_to_dict(row)})
    finally:
        conn.close()


def api_event_update(handler: BaseHTTPRequestHandler, event_id: int) -> None:
    body = parse_json_body(handler)
    fields, values = [], []
    if "repeat" in body:
        body["repeat"] = body.get("repeat") if body.get("repeat") in ("", "weekly", "monthly") else ""
    for key in ("title", "date", "time", "end_time", "category", "notes", "repeat"):
        if key in body:
            fields.append(f"{key} = ?")
            val = body[key]
            values.append(val if val not in ("", None) else None if key in ("time", "end_time") else val)
    if not fields:
        send_json(handler, 400, {"error": "Tidak ada perubahan"})
        return
    values.append(event_id)
    conn = db_connect()
    try:
        conn.execute(f"UPDATE events SET {', '.join(fields)} WHERE id = ?", values)
        conn.commit()
        row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        send_json(handler, 200, {"event": row_to_dict(row) if row else None})
    finally:
        conn.close()


def api_event_delete(handler: BaseHTTPRequestHandler, event_id: int) -> None:
    conn = db_connect()
    try:
        soft_delete(conn, "events", event_id)
        conn.commit()
        send_json(handler, 200, {"ok": True})
    finally:
        conn.close()


def api_competitions(handler: BaseHTTPRequestHandler) -> None:
    conn = db_connect()
    try:
        comps = [row_to_dict(r) for r in conn.execute(
            "SELECT * FROM competitions WHERE deleted_at IS NULL ORDER BY deadline ASC, id DESC"
        ).fetchall()]
        subtasks = conn.execute(
            "SELECT * FROM competition_tasks ORDER BY competition_id, position, id"
        ).fetchall()
        grouped: dict[int, list] = {}
        for row in subtasks:
            grouped.setdefault(row["competition_id"], []).append(row_to_dict(row))
        for comp in comps:
            comp["tasks"] = grouped.get(comp["id"], [])
        send_json(handler, 200, {"competitions": comps})
    finally:
        conn.close()


def api_competition_create(handler: BaseHTTPRequestHandler) -> None:
    body = parse_json_body(handler)
    title = clip(body.get("title"), 300)
    deadline = (body.get("deadline") or "").strip()
    if not title or not deadline:
        raise ValueError("Nama lomba dan deadline wajib diisi")
    conn = db_connect()
    try:
        cur = conn.execute(
            "INSERT INTO competitions(title, category, deadline, location, notes, status, created_at) "
            "VALUES(?,?,?,?,?,?,?)",
            (
                title,
                (body.get("category") or "Lomba").strip(),
                deadline,
                clip(body.get("location"), 200),
                clip(body.get("notes"), 5000),
                (body.get("status") or "persiapan").strip(),
                now_local(),
            ),
        )
        comp_id = cur.lastrowid
        for idx, item in enumerate(body.get("tasks") or []):
            item_title = (item.get("title") if isinstance(item, dict) else str(item)).strip()
            if item_title:
                conn.execute(
                    "INSERT INTO competition_tasks(competition_id, title, done, position, created_at) "
                    "VALUES(?,?,?,?,?)",
                    (comp_id, item_title, 0, idx, now_local()),
                )
        conn.commit()
        send_json(handler, 201, {"id": comp_id})
    finally:
        conn.close()


def api_competition_update(handler: BaseHTTPRequestHandler, comp_id: int) -> None:
    body = parse_json_body(handler)
    fields, values = [], []
    for key in ("title", "category", "deadline", "location", "notes", "status"):
        if key in body:
            fields.append(f"{key} = ?")
            values.append(body[key])
    conn = db_connect()
    try:
        if fields:
            values.append(comp_id)
            conn.execute(f"UPDATE competitions SET {', '.join(fields)} WHERE id = ?", values)
        conn.commit()
        send_json(handler, 200, {"ok": True})
    finally:
        conn.close()


def api_competition_delete(handler: BaseHTTPRequestHandler, comp_id: int) -> None:
    conn = db_connect()
    try:
        soft_delete(conn, "competitions", comp_id)
        conn.execute("DELETE FROM competition_tasks WHERE competition_id = ?", (comp_id,))
        conn.commit()
        send_json(handler, 200, {"ok": True})
    finally:
        conn.close()


def api_competition_task_create(handler: BaseHTTPRequestHandler, comp_id: int) -> None:
    body = parse_json_body(handler)
    title = clip(body.get("title"), 300)
    if not title:
        raise ValueError("Nama checklist wajib diisi")
    conn = db_connect()
    try:
        pos = conn.execute(
            "SELECT COALESCE(MAX(position), -1) + 1 AS p FROM competition_tasks WHERE competition_id = ?",
            (comp_id,),
        ).fetchone()["p"]
        cur = conn.execute(
            "INSERT INTO competition_tasks(competition_id, title, done, position, created_at) "
            "VALUES(?,?,0,?,?)",
            (comp_id, title, pos, now_local()),
        )
        conn.commit()
        send_json(handler, 201, {"id": cur.lastrowid})
    finally:
        conn.close()


def api_competition_task_update(handler: BaseHTTPRequestHandler, task_id: int) -> None:
    body = parse_json_body(handler)
    conn = db_connect()
    try:
        if "done" in body:
            conn.execute(
                "UPDATE competition_tasks SET done = ? WHERE id = ?",
                (1 if body["done"] else 0, task_id),
            )
        if "title" in body:
            conn.execute(
                "UPDATE competition_tasks SET title = ? WHERE id = ?",
                ((body["title"] or "").strip(), task_id),
            )
        conn.commit()
        send_json(handler, 200, {"ok": True})
    finally:
        conn.close()


def api_competition_task_delete(handler: BaseHTTPRequestHandler, task_id: int) -> None:
    conn = db_connect()
    try:
        conn.execute("DELETE FROM competition_tasks WHERE id = ?", (task_id,))
        conn.commit()
        send_json(handler, 200, {"ok": True})
    finally:
        conn.close()


def api_notes(handler: BaseHTTPRequestHandler) -> None:
    conn = db_connect()
    try:
        rows = conn.execute(
            "SELECT * FROM notes WHERE deleted_at IS NULL ORDER BY pinned DESC, updated_at DESC"
        ).fetchall()
        send_json(handler, 200, {"notes": [row_to_dict(r) for r in rows]})
    finally:
        conn.close()


def api_note_create(handler: BaseHTTPRequestHandler) -> None:
    body = parse_json_body(handler)
    title = clip(body.get("title"), 300)
    if not title:
        title = "Tanpa judul"
    now = now_local()
    conn = db_connect()
    try:
        cur = conn.execute(
            "INSERT INTO notes(title, body, pinned, color, created_at, updated_at) VALUES(?,?,?,?,?,?)",
            (
                title,
                body.get("body") or "",
                1 if body.get("pinned") else 0,
                body.get("color") or "teal",
                now,
                now,
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM notes WHERE id = ?", (cur.lastrowid,)).fetchone()
        send_json(handler, 201, {"note": row_to_dict(row)})
    finally:
        conn.close()


def api_note_update(handler: BaseHTTPRequestHandler, note_id: int) -> None:
    body = parse_json_body(handler)
    fields, values = [], []
    for key in ("title", "body", "pinned", "color"):
        if key in body:
            fields.append(f"{key} = ?")
            values.append(body[key])
    if not fields:
        send_json(handler, 400, {"error": "Tidak ada perubahan"})
        return
    fields.append("updated_at = ?")
    values.extend([now_local(), note_id])
    conn = db_connect()
    try:
        conn.execute(f"UPDATE notes SET {', '.join(fields)} WHERE id = ?", values)
        conn.commit()
        row = conn.execute("SELECT * FROM notes WHERE id = ?", (note_id,)).fetchone()
        send_json(handler, 200, {"note": row_to_dict(row) if row else None})
    finally:
        conn.close()


def api_note_delete(handler: BaseHTTPRequestHandler, note_id: int) -> None:
    conn = db_connect()
    try:
        soft_delete(conn, "notes", note_id)
        conn.commit()
        send_json(handler, 200, {"ok": True})
    finally:
        conn.close()


def api_search(handler: BaseHTTPRequestHandler, query: dict) -> None:
    q = clip(query.get("q") or "", 80).strip()
    if len(q) < 2:
        send_json(handler, 200, {"results": [], "query": q})
        return
    like = f"%{q}%"
    conn = db_connect()
    results: list[dict] = []
    try:
        task_rows = conn.execute(
            "SELECT title, date FROM tasks WHERE deleted_at IS NULL AND title LIKE ? ORDER BY date DESC LIMIT 5",
            (like,),
        ).fetchall()
        results += [{"type": "task", "label": r["title"], "hint": f"tugas · {r['date']}", "view": "tugas"} for r in task_rows]
        event_rows = conn.execute(
            "SELECT title, date FROM events WHERE deleted_at IS NULL AND title LIKE ? ORDER BY date DESC LIMIT 5",
            (like,),
        ).fetchall()
        results += [{"type": "event", "label": r["title"], "hint": f"agenda · {r['date']}", "view": "kalender"} for r in event_rows]
        note_rows = conn.execute(
            "SELECT title FROM notes WHERE deleted_at IS NULL AND (title LIKE ? OR body LIKE ?) ORDER BY updated_at DESC LIMIT 5",
            (like, like),
        ).fetchall()
        results += [{"type": "note", "label": r["title"] or "Tanpa judul", "hint": "catatan", "view": "catatan"} for r in note_rows]
        expense_rows = conn.execute(
            "SELECT note, category, amount, date FROM expenses WHERE deleted_at IS NULL AND (note LIKE ? OR category LIKE ?) ORDER BY date DESC LIMIT 5",
            (like, like),
        ).fetchall()
        results += [{"type": "expense", "label": r["note"] or r["category"], "hint": f"pengeluaran · {format_rupiah_plain(r['amount'])}", "view": "pengeluaran"} for r in expense_rows]
        card_rows = conn.execute(
            "SELECT subject, front FROM flashcards WHERE subject LIKE ? OR front LIKE ? OR back LIKE ? ORDER BY id DESC LIMIT 5",
            (like, like, like),
        ).fetchall()
        results += [{"type": "flashcard", "label": r["front"], "hint": f"flashcard · {r['subject']}", "view": "flashcard"} for r in card_rows]
        comp_rows = conn.execute(
            "SELECT title FROM competitions WHERE deleted_at IS NULL AND title LIKE ? ORDER BY deadline ASC LIMIT 5",
            (like,),
        ).fetchall()
        results += [{"type": "competition", "label": r["title"], "hint": "lomba", "view": "lomba"} for r in comp_rows]
        habit_rows = conn.execute(
            "SELECT name FROM habits WHERE deleted_at IS NULL AND name LIKE ? ORDER BY name LIMIT 5",
            (like,),
        ).fetchall()
        results += [{"type": "habit", "label": r["name"], "hint": "kebiasaan", "view": "streak"} for r in habit_rows]
        send_json(handler, 200, {"results": results[:24], "query": q})
    finally:
        conn.close()


def format_rupiah_plain(value) -> str:
    try:
        amount = int(value or 0)
    except (TypeError, ValueError):
        amount = 0
    return f"Rp{amount:,.0f}".replace(",", ".")


def _week_start_local(day: str | None = None) -> str:
    try:
        ref = date.fromisoformat((day or today_local())[:10])
    except ValueError:
        ref = date.fromisoformat(today_local())
    return (ref - timedelta(days=ref.weekday())).isoformat()


def api_daily_review(handler: BaseHTTPRequestHandler, query: dict) -> None:
    day = (query.get("date") or today_local()).strip()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
        raise ValueError("Tanggal review tidak valid")
    conn = db_connect()
    try:
        row = conn.execute("SELECT * FROM daily_reviews WHERE date = ?", (day,)).fetchone()
        send_json(handler, 200, {"review": row_to_dict(row) if row else None, "date": day})
    finally:
        conn.close()


def api_daily_review_save(handler: BaseHTTPRequestHandler) -> None:
    body = parse_json_body(handler)
    day = (body.get("date") or today_local()).strip()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
        raise ValueError("Tanggal review tidak valid")
    wins = clip(body.get("wins"), 1000)
    carried = clip(body.get("carried"), 1000)
    tomorrow = clip(body.get("tomorrow"), 1000)
    now = now_local()
    conn = db_connect()
    try:
        conn.execute(
            "INSERT INTO daily_reviews(date, wins, carried, tomorrow, created_at, updated_at) VALUES(?,?,?,?,?,?) "
            "ON CONFLICT(date) DO UPDATE SET wins = excluded.wins, carried = excluded.carried, tomorrow = excluded.tomorrow, updated_at = excluded.updated_at",
            (day, wins, carried, tomorrow, now, now),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM daily_reviews WHERE date = ?", (day,)).fetchone()
        send_json(handler, 200, {"review": row_to_dict(row)})
    finally:
        conn.close()


def api_weekly_goal(handler: BaseHTTPRequestHandler, query: dict) -> None:
    week = _week_start_local(query.get("week") or None)
    conn = db_connect()
    try:
        row = conn.execute("SELECT * FROM weekly_goals WHERE week_start = ?", (week,)).fetchone()
        send_json(handler, 200, {"week_start": week, "goal": row_to_dict(row) if row else None})
    finally:
        conn.close()


def api_weekly_goal_save(handler: BaseHTTPRequestHandler) -> None:
    body = parse_json_body(handler)
    week = _week_start_local(body.get("week") or None)
    title = clip(body.get("title"), 240)
    if not title:
        raise ValueError("Isi target mingguan dulu")
    done = 1 if body.get("done") else 0
    now = now_local()
    conn = db_connect()
    try:
        conn.execute(
            "INSERT INTO weekly_goals(week_start, title, done, created_at, updated_at) VALUES(?,?,?,?,?) "
            "ON CONFLICT(week_start) DO UPDATE SET title = excluded.title, done = excluded.done, updated_at = excluded.updated_at",
            (week, title, done, now, now),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM weekly_goals WHERE week_start = ?", (week,)).fetchone()
        send_json(handler, 200, {"goal": row_to_dict(row), "week_start": week})
    finally:
        conn.close()


EXPENSE_CATEGORIES = ("makan", "transport", "belajar", "hiburan", "kesehatan", "belanja", "tagihan", "lainnya")
EXPENSE_METHODS = ("tunai", "qris", "transfer", "kartu", "lainnya")


def _expense_category(value) -> str:
    text = clip(value, 40).lower() or "lainnya"
    return text if text in EXPENSE_CATEGORIES else "lainnya"


def _expense_method(value) -> str:
    text = clip(value, 20).lower() or "tunai"
    return text if text in EXPENSE_METHODS else "lainnya"


def _expense_amount(value) -> int:
    try:
        amount = int(float(value))
    except (TypeError, ValueError):
        raise ValueError("Nominal pengeluaran tidak valid")
    if amount <= 0:
        raise ValueError("Nominal harus lebih dari 0")
    if amount > 1_000_000_000_000:
        raise ValueError("Nominal terlalu besar")
    return amount


def api_expenses(handler: BaseHTTPRequestHandler, query: dict) -> None:
    month = (query.get("month") or "").strip()
    start = (query.get("from") or "").strip()
    end = (query.get("to") or "").strip()
    if month and not re.fullmatch(r"\d{4}-\d{2}", month):
        raise ValueError("Format bulan harus YYYY-MM")
    where = ["deleted_at IS NULL"]
    args: list = []
    if month:
        where.append("date LIKE ?")
        args.append(f"{month}-%")
    else:
        if start:
            where.append("date >= ?")
            args.append(start)
        if end:
            where.append("date <= ?")
            args.append(end)
    conn = db_connect()
    try:
        rows = conn.execute(
            f"SELECT * FROM expenses WHERE {' AND '.join(where)} ORDER BY date DESC, id DESC LIMIT 2000",
            args,
        ).fetchall()
        items = [row_to_dict(r) for r in rows]
        total = sum(int(r["amount"] or 0) for r in rows)
        send_json(handler, 200, {"expenses": items, "total": total, "count": len(items), "month": month})
    finally:
        conn.close()


def api_expense_create(handler: BaseHTTPRequestHandler) -> None:
    body = parse_json_body(handler)
    day = (body.get("date") or today_local()).strip()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
        raise ValueError("Tanggal pengeluaran tidak valid")
    amount = _expense_amount(body.get("amount"))
    now = now_local()
    conn = db_connect()
    try:
        cur = conn.execute(
            "INSERT INTO expenses(date, amount, category, method, note, created_at, updated_at) "
            "VALUES(?,?,?,?,?,?,?)",
            (
                day,
                amount,
                _expense_category(body.get("category")),
                _expense_method(body.get("method")),
                clip(body.get("note"), 500),
                now,
                now,
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM expenses WHERE id = ?", (cur.lastrowid,)).fetchone()
        send_json(handler, 201, {"expense": row_to_dict(row)})
    finally:
        conn.close()


def api_expense_update(handler: BaseHTTPRequestHandler, expense_id: int) -> None:
    body = parse_json_body(handler)
    fields, values = [], []
    if "date" in body:
        day = str(body.get("date") or "").strip()
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
            raise ValueError("Tanggal pengeluaran tidak valid")
        fields.append("date = ?")
        values.append(day)
    if "amount" in body:
        fields.append("amount = ?")
        values.append(_expense_amount(body.get("amount")))
    if "category" in body:
        fields.append("category = ?")
        values.append(_expense_category(body.get("category")))
    if "method" in body:
        fields.append("method = ?")
        values.append(_expense_method(body.get("method")))
    if "note" in body:
        fields.append("note = ?")
        values.append(clip(body.get("note"), 500))
    if not fields:
        send_json(handler, 400, {"error": "Tidak ada perubahan"})
        return
    fields.append("updated_at = ?")
    values.extend([now_local(), expense_id])
    conn = db_connect()
    try:
        conn.execute(f"UPDATE expenses SET {', '.join(fields)} WHERE id = ?", values)
        conn.commit()
        row = conn.execute("SELECT * FROM expenses WHERE id = ?", (expense_id,)).fetchone()
        if not row:
            send_json(handler, 404, {"error": "Pengeluaran tidak ditemukan"})
            return
        send_json(handler, 200, {"expense": row_to_dict(row)})
    finally:
        conn.close()


def api_expense_delete(handler: BaseHTTPRequestHandler, expense_id: int) -> None:
    conn = db_connect()
    try:
        soft_delete(conn, "expenses", expense_id)
        conn.commit()
        send_json(handler, 200, {"ok": True})
    finally:
        conn.close()


def api_schedule(handler: BaseHTTPRequestHandler, query: dict) -> None:
    conn = db_connect()
    try:
        rows = conn.execute(
            "SELECT * FROM schedule ORDER BY weekday, start_time"
        ).fetchall()
        send_json(handler, 200, {"schedule": [row_to_dict(r) for r in rows]})
    finally:
        conn.close()


def api_schedule_create(handler: BaseHTTPRequestHandler) -> None:
    body = parse_json_body(handler)
    subject = clip(body.get("subject"), 120)
    weekday = body.get("weekday")
    start = (body.get("start_time") or "").strip()
    if not subject or weekday is None or not start:
        raise ValueError("Mapel, hari, dan jam mulai wajib diisi")
    conn = db_connect()
    try:
        cur = conn.execute(
            "INSERT INTO schedule(weekday, start_time, end_time, subject, room, note) VALUES(?,?,?,?,?,?)",
            (
                int(weekday),
                start,
                (body.get("end_time") or "").strip() or None,
                subject,
                clip(body.get("room"), 80),
                (body.get("note") or "").strip(),
            ),
        )
        conn.commit()
        send_json(handler, 201, {"id": cur.lastrowid})
    finally:
        conn.close()


def api_schedule_update(handler: BaseHTTPRequestHandler, item_id: int) -> None:
    body = parse_json_body(handler)
    fields, values = [], []
    for key in ("weekday", "start_time", "end_time", "subject", "room", "note"):
        if key in body:
            fields.append(f"{key} = ?")
            values.append(body[key])
    if not fields:
        send_json(handler, 400, {"error": "Tidak ada perubahan"})
        return
    values.append(item_id)
    conn = db_connect()
    try:
        conn.execute(f"UPDATE schedule SET {', '.join(fields)} WHERE id = ?", values)
        conn.commit()
        send_json(handler, 200, {"ok": True})
    finally:
        conn.close()


def api_schedule_delete(handler: BaseHTTPRequestHandler, item_id: int) -> None:
    conn = db_connect()
    try:
        conn.execute("DELETE FROM schedule WHERE id = ?", (item_id,))
        conn.commit()
        send_json(handler, 200, {"ok": True})
    finally:
        conn.close()


def api_focus(handler: BaseHTTPRequestHandler, query: dict) -> None:
    day = query.get("date") or today_local()
    conn = db_connect()
    try:
        rows = conn.execute(
            "SELECT * FROM focus_sessions WHERE date = ? ORDER BY id DESC", (day,)
        ).fetchall()
        sessions = [row_to_dict(r) for r in rows]
        total = sum(r["minutes"] for r in sessions)
        send_json(handler, 200, {"date": day, "sessions": sessions, "total_minutes": total})
    finally:
        conn.close()


def api_focus_create(handler: BaseHTTPRequestHandler) -> None:
    body = parse_json_body(handler)
    minutes = int(body.get("minutes") or 0)
    if minutes <= 0:
        raise ValueError("Durasi tidak valid")
    conn = db_connect()
    try:
        conn.execute(
            "INSERT INTO focus_sessions(date, minutes, label, subject, created_at) VALUES(?,?,?,?,?)",
            (
                today_local(),
                minutes,
                clip(body.get("label"), 120),
                clip(body.get("subject"), 120),
                now_local(),
            ),
        )
        conn.commit()
        send_json(handler, 201, {"ok": True})
    finally:
        conn.close()




# ----------------------------------------------------------------------------
# Soft delete & restore (B5/F1)
# ----------------------------------------------------------------------------
SOFT_DELETE_TABLES = {"task": "tasks", "event": "events", "competition": "competitions", "note": "notes", "habit": "habits", "grade": "grades", "expense": "expenses"}


def soft_delete(conn: sqlite3.Connection, table: str, row_id: int) -> bool:
    cur = conn.execute(f"UPDATE {table} SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL", (now_local(), row_id))
    return cur.rowcount > 0


def api_restore(handler: BaseHTTPRequestHandler) -> None:
    body = parse_json_body(handler)
    kind = (body.get("kind") or "").strip()
    try:
        row_id = int(body.get("id") or 0)
    except (TypeError, ValueError):
        raise ValueError("id tidak valid")
    table = SOFT_DELETE_TABLES.get(kind)
    if not table or row_id <= 0:
        raise ValueError("kind harus task|event|competition|note|habit|grade|expense")
    conn = db_connect()
    try:
        conn.execute(f"UPDATE {table} SET deleted_at = NULL WHERE id = ?", (row_id,))
        conn.commit()
        send_json(handler, 200, {"ok": True})
    finally:
        conn.close()

# ----------------------------------------------------------------------------
# Streak / habit tracker
# ----------------------------------------------------------------------------
def api_streak(handler: BaseHTTPRequestHandler, query: dict) -> None:
    day = query.get("date") or today_local()
    conn = db_connect()
    try:
        rows = conn.execute(
            "SELECT * FROM streak WHERE date = ? ORDER BY id DESC", (day,)
        ).fetchall()
        streak_list = [row_to_dict(r) for r in rows]
        # 7-day streak summary
        seven = []
        for i in range(6, -1, -1):
            d = addDays(day, -i)
            r = conn.execute("SELECT * FROM streak WHERE date = ?", (d,)).fetchone()
            seven.append({"date": d, "completed": r["completed"] if r else 0})
        # Actual consecutive streak count
        current = streak_current()
        send_json(handler, 200, {"date": day, "current": current, "streak": streak_list, "seven_day": seven})
    finally:
        conn.close()


def api_streak_create(handler: BaseHTTPRequestHandler) -> None:
    body = parse_json_body(handler)
    day = (body.get("date") or today_local()).strip()
    completed = 1 if body.get("completed") else 0
    conn = db_connect()
    try:
        conn.execute(
            "INSERT INTO streak(date, completed, updated_at) VALUES(?,?,?) "
            "ON CONFLICT(date) DO UPDATE SET completed=excluded.completed, updated_at=excluded.updated_at",
            (day, completed, now_local()),
        )
        conn.commit()
        send_json(handler, 200, {"ok": True, "date": day, "completed": completed})
    finally:
        conn.close()


def streak_current() -> int:
    """Return current consecutive-day streak count."""
    conn = db_connect()
    try:
        return streak_from(conn, "streak", None, None, today_local())
    finally:
        conn.close()


# ----------------------------------------------------------------------------
# Reminders (deadline notifications)
# ----------------------------------------------------------------------------
def api_reminders(handler: BaseHTTPRequestHandler) -> None:
    conn = db_connect()
    try:
        rows = conn.execute("SELECT * FROM reminder ORDER BY created_at DESC").fetchall()
        send_json(handler, 200, {"reminders": [row_to_dict(r) for r in rows]})
    finally:
        conn.close()


def api_reminder_create(handler: BaseHTTPRequestHandler) -> None:
    body = parse_json_body(handler)
    target_type = (body.get("target_type") or "").strip()
    target_id = int(body.get("target_id") or 0)
    minutes = int(body.get("minutes_before") or 10)
    if not target_type or target_id <= 0:
        raise ValueError("target_type dan target_id wajib diisi")
    conn = db_connect()
    try:
        conn.execute(
            "INSERT INTO reminder(target_type, target_id, minutes_before, sent, created_at) "
            "VALUES(?,?,?,0,?)",
            (target_type, target_id, minutes, now_local()),
        )
        conn.commit()
        send_json(handler, 201, {"ok": True})
    finally:
        conn.close()


def api_reminder_delete(handler: BaseHTTPRequestHandler, reminder_id: int) -> None:
    conn = db_connect()
    try:
        conn.execute("DELETE FROM reminder WHERE id = ?", (reminder_id,))
        conn.commit()
        send_json(handler, 200, {"ok": True})
    finally:
        conn.close()


def check_deadline_reminders() -> None:
    """Check competitions/events whose deadline is near and send browser-friendly reminder hints."""
    try:
        conn = db_connect()
        settings = get_settings(conn)
        comps = conn.execute("SELECT * FROM competitions WHERE deleted_at IS NULL AND status != 'selesai'").fetchall()
        events = conn.execute("SELECT * FROM events WHERE deleted_at IS NULL").fetchall()
        conn.close()
    except Exception:
        return
    if settings.get("notifications", "0") != "1":
        return
    try:
        notified = load_reminder_sent()
    except Exception:
        notified = {}
    now = time.time()
    changed = False
    for c in comps:
        dl = parseLocalDT(c["deadline"])
        if dl is None or not _finite(dl) or dl <= now:
            continue
        diff_min = (dl - now) / 60000.0
        rkey = f"comp-{c['id']}"
        minutes = 60
        if 0 < diff_min <= minutes and not notified.get(rkey):
            # reminder hint: store so frontend can show toast
            notified[rkey] = now
            changed = True
            try:
                save_reminder_sent(notified)
            except Exception:
                pass
            break
    for e in events:
        if not e.get("time"):
            continue
        t = parseLocalDT(f"{e['date']}T{str(e['time']).strip()}:00")
        if t is None or not _finite(t) or t <= now:
            continue
        diff_min = (t - now) / 60000.0
        rkey = f"ev-{e['id']}"
        if 0 < diff_min <= 10 and not notified.get(rkey):
            notified[rkey] = now
            changed = True
            try:
                save_reminder_sent(notified)
            except Exception:
                pass
            break
    if changed:
        try:
            items = list(notified.items())[-200:]
            save_reminder_sent(dict(items))
        except Exception:
            pass


def _finite(v) -> bool:
    try:
        return math.isfinite(float(v))
    except Exception:
        return False


REMINDER_SENT_PATH = os.path.join(DATA_DIR, "reminder_sent.json")


def load_reminder_sent() -> dict:
    try:
        with open(REMINDER_SENT_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_reminder_sent(data: dict) -> None:
    try:
        tmp = REMINDER_SENT_PATH + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        os.replace(tmp, REMINDER_SENT_PATH)
    except Exception:
        pass


# ----------------------------------------------------------------------------
# Device performance monitoring
# ----------------------------------------------------------------------------
_last_cpu = {"t": 0.0, "busy": 0.0, "total": 0.0}


def device_stats() -> dict:
    boot = psutil.boot_time() if psutil else time.time()
    uptime_sec = max(0, time.time() - boot)

    cpu_percent = 0.0
    if psutil:
        try:
            now = time.time()
            raw = psutil.cpu_times_percent(interval=None, percpu=False)
            total = sum(getattr(raw, f) for f in (
                "user", "nice", "system", "idle", "iowait", "irq", "softirq", "steal", "guest", "guest_nice"
            ))
            idle = getattr(raw, "idle", 0.0) + getattr(raw, "iowait", 0.0)
            busy = total - idle
            if _last_cpu["t"] > 0:
                dt = max(now - _last_cpu["t"], 0.001)
                d_total = max(total - _last_cpu["total"], 0.001)
                d_busy = max(busy - _last_cpu["busy"], 0.0)
                cpu_percent = min(100.0, max(0.0, (d_busy / d_total) * 100.0))
            _last_cpu.update(t=now, busy=busy, total=total)
            if cpu_percent == 0.0 and _last_cpu["t"] == now:
                cpu_percent = float(getattr(raw, "user", 0) + getattr(raw, "system", 0))
        except Exception:
            cpu_percent = 0.0

    mem = psutil.virtual_memory() if psutil else None
    swap = psutil.swap_memory() if psutil else None
    disk = psutil.disk_usage("/") if psutil else None

    battery = None
    if psutil:
        try:
            b = psutil.sensors_battery()
            if b:
                battery = {
                    "percent": round(b.percent, 1),
                    "plugged": bool(b.power_plugged),
                    "secs_left": b.secsleft if b.secsleft not in (None, psutil.POWER_TIME_UNKNOWN, psutil.POWER_TIME_UNLIMITED) else None,
                }
        except Exception:
            battery = None

    net = psutil.net_io_counters() if psutil else None
    temps = None
    if psutil:
        try:
            t = psutil.sensors_temperatures()
            if t:
                temps = {k: [round(x.current, 1) for x in v if x.current is not None] for k, v in t.items()}
        except Exception:
            temps = None

    return {
        "uptime_seconds": int(uptime_sec),
        "uptime": _fmt_uptime(uptime_sec),
        "cpu_percent": round(cpu_percent, 1),
        "cpu_count": psutil.cpu_count(logical=True) if psutil else 1,
        "memory": {
            "total": mem.total if mem else 0,
            "available": mem.available if mem else 0,
            "used": mem.used if mem else 0,
            "percent": round(mem.percent, 1) if mem else 0,
        } if mem else {},
        "swap": {
            "total": swap.total if swap else 0,
            "used": swap.used if swap else 0,
            "percent": round(swap.percent, 1) if swap else 0,
        } if swap else {},
        "disk": {
            "total": disk.total if disk else 0,
            "used": disk.used if disk else 0,
            "free": disk.free if disk else 0,
            "percent": round(disk.percent, 1) if disk else 0,
        } if disk else {},
        "battery": battery,
        "network": {
            "bytes_sent": net.bytes_sent if net else 0,
            "bytes_recv": net.bytes_recv if net else 0,
            "packets_sent": net.packets_sent if net else 0,
            "packets_recv": net.packets_recv if net else 0,
        } if net else {},
        "temperatures": temps or {},
        "platform": sys.platform,
        "python": sys.version.split()[0],
    }


def _fmt_uptime(seconds: int) -> str:
    seconds = int(seconds)
    days = seconds // 86400
    hours = (seconds % 86400) // 3600
    mins = (seconds % 3600) // 60
    secs = seconds % 60
    parts = []
    if days: parts.append(f"{days} hari")
    if hours: parts.append(f"{hours} jam")
    if mins: parts.append(f"{mins} menit")
    parts.append(f"{secs} detik")
    return " ".join(parts)


# ----------------------------------------------------------------------------
# Music library (local, no external API)
# ----------------------------------------------------------------------------
AUDIO_EXT = {".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a"}


def _scan_music(conn) -> None:
    tracks = []
    for root, _dirs, files in os.walk(MUSIC_DIR):
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext not in AUDIO_EXT:
                continue
            full = os.path.join(root, f)
            rel = os.path.relpath(full, MUSIC_DIR)
            try:
                dur = 0
                import subprocess
                out = subprocess.run(
                    ["ffprobe", "-v", "error", "-show_entries", "format=duration",
                     "-of", "default=noprint_wrappers=1:nokey=1", full],
                    capture_output=True, text=True, timeout=8,
                )
                if out.stdout.strip():
                    dur = int(float(out.stdout.strip()))
            except Exception:
                dur = 0
            title = os.path.splitext(f)[0]
            artist = ""
            album = ""
            tracks.append((rel, title, artist, album, dur, now_local()))
    conn.executemany(
        "INSERT OR REPLACE INTO music_tracks(path, title, artist, album, duration, added_at) VALUES(?,?,?,?,?,?)",
        tracks,
    )
    conn.commit()


def music_library(conn) -> list:
    _scan_music(conn)
    rows = conn.execute("SELECT * FROM music_tracks ORDER BY title COLLATE NOCASE").fetchall()
    return [row_to_dict(r) for r in rows]


def music_state_get(conn, key: str) -> str:
    row = conn.execute("SELECT value FROM music_state WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else ""


def music_state_set(conn, key: str, value: str) -> None:
    conn.execute(
        "INSERT INTO music_state(key, value) VALUES(?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value),
    )


_device_cache = {"t": 0.0, "stats": None}
def api_device(handler: BaseHTTPRequestHandler) -> None:
    try:
        now = time.time()
        if _device_cache["stats"] is None or now - _device_cache["t"] > 3:
            _device_cache["stats"] = device_stats()
            _device_cache["t"] = now
        send_json(handler, 200, {"ok": True, "device": _device_cache["stats"]})
    except Exception as exc:
        send_json(handler, 500, {"error": str(exc)})


def api_music_library(handler: BaseHTTPRequestHandler) -> None:
    conn = db_connect()
    try:
        tracks = music_library(conn)
        send_json(handler, 200, {"ok": True, "tracks": tracks})
    finally:
        conn.close()


def api_music_search(handler: BaseHTTPRequestHandler, query: dict) -> None:
    q = (query.get("q") or "").strip().lower()
    conn = db_connect()
    try:
        _scan_music(conn)
        rows = conn.execute("SELECT * FROM music_tracks").fetchall()
        results = []
        for r in rows:
            blob = f"{r['title']} {r['artist']} {r['album']}".lower()
            if not q or q in blob:
                results.append(row_to_dict(r))
        send_json(handler, 200, {"ok": True, "tracks": results[:50]})
    finally:
        conn.close()


def api_music_state(handler: BaseHTTPRequestHandler, body: dict | None = None) -> None:
    conn = db_connect()
    try:
        if body is not None:
            for key in ("now_playing", "music_paused", "music_volume"):
                if key in body:
                    music_state_set(conn, key, str(body[key]))
            conn.commit()
        out = {
            "now_playing": music_state_get(conn, "now_playing"),
            "paused": music_state_get(conn, "music_paused") == "1",
            "volume": int(music_state_get(conn, "music_volume") or 70),
        }
        track_id = out["now_playing"]
        if track_id:
            row = conn.execute("SELECT * FROM music_tracks WHERE id = ?", (int(track_id),)).fetchone()
            if row:
                out["track"] = row_to_dict(row)
        send_json(handler, 200, {"ok": True, **out})
    finally:
        conn.close()


# whitelist: only these keys may be written, with per-key validators
def _validate_setting(key: str, value) -> str:
    s = str(value).strip()
    if key == "name":
        return s[:60] or "Kamu"
    if key == "location":
        return s if s in LOCATIONS else "jakarta"
    if key in ("carry_over", "sound", "notifications", "music_paused"):
        return "1" if s in ("1", "true", "True", "yes") else "0"
    if key == "theme":
        return s if s in ("dark", "light", "system") else "dark"
    if key == "accent":
        allowed = {"terracotta", "teal", "emerald", "amber", "rose", "violet", "sky", "slate"}
        return s if s in allowed else "terracotta"
    if key == "font_size":
        return s if s in ("small", "normal", "large") else "normal"
    if key == "contrast":
        return s if s in ("normal", "high") else "normal"
    if key == "reminder_lead":
        try:
            return str(max(1, min(120, int(float(s)))))
        except ValueError:
            return "10"
    if key == "sidebar":
        return s if s in ("expanded", "collapsed") else "expanded"
    if key == "language":
        return s if s in ("id", "en") else "id"
    if key == "onboarding_goal":
        allowed = {"study", "contest", "habit", "money", "mixed"}
        return s if s in allowed else "mixed"
    if key == "dashboard_mode":
        return s if s in ("minimal", "full") else "minimal"
    if key == "expense_budget":
        try:
            return str(max(0, min(1_000_000_000_000, int(float(s)))))
        except ValueError:
            return "0"
    if key == "default_view":
        allowed = {"beranda", "tugas", "kalender", "fokus", "catatan", "jadwal", "nilai", "flashcard", "lomba", "streak", "cuaca", "music", "pengeluaran"}
        return s if s in allowed else "beranda"
    if key in ("pinned_views", "hidden_views"):
        allowed = ["beranda", "tugas", "kalender", "fokus", "catatan", "jadwal", "nilai", "flashcard", "lomba", "streak", "cuaca", "music", "pengeluaran"]
        picked = [v.strip() for v in s.split(",") if v.strip() in allowed]
        return ",".join(dict.fromkeys(picked))[:200]
    if key == "music_volume":
        try:
            return str(max(0, min(100, int(float(s)))))
        except ValueError:
            return "70"
    if key == "now_playing":
        return s[:500]
    if key == "kkm":
        try:
            return str(max(0, min(100, float(s))))
        except ValueError:
            return "75"
    if key == "last_open_date":
        return s if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s) else ""
    if key == "onboarded":
        return "1" if s in ("1", "true", "True", "yes") else "0"
    if key == "lock_enabled":
        return "1" if s in ("1", "true", "True", "yes") else "0"
    return ""


def api_settings(handler: BaseHTTPRequestHandler, body: dict | None = None) -> None:
    conn = db_connect()
    try:
        if body is not None:
            for key, value in body.items():
                if key in DEFAULT_SETTINGS or key in ("onboarded", "lock_enabled"):
                    set_setting(conn, key, _validate_setting(key, value))
            conn.commit()
        settings = get_settings(conn)
        if settings.get("lock_enabled") == "1":
            settings = {k: v for k, v in settings.items() if k not in ("lock_pin_hash",)}
        send_json(handler, 200, {"settings": settings})
    finally:
        conn.close()


def api_bootstrap(handler: BaseHTTPRequestHandler) -> None:
    day = today_local()
    start_of_month = date.fromisoformat(day).replace(day=1).isoformat()
    conn = db_connect()
    try:
        ensure_day(conn, day)
        tasks = conn.execute("SELECT * FROM tasks WHERE deleted_at IS NULL AND date = ?", (day,)).fetchall()
        done = sum(1 for t in tasks if t["done"])
        events_today = conn.execute(
            "SELECT COUNT(*) AS c FROM events WHERE deleted_at IS NULL AND date = ?", (day,)
        ).fetchone()["c"]
        active_comps = conn.execute(
            "SELECT COUNT(*) AS c FROM competitions WHERE deleted_at IS NULL AND status != 'selesai'"
        ).fetchone()["c"]
        focus_total = conn.execute(
            "SELECT COALESCE(SUM(minutes), 0) AS t FROM focus_sessions WHERE date = ?", (day,)
        ).fetchone()["t"]
        send_json(
            handler,
            200,
            {
                "today": day,
                "now": now_local(),
                "settings": get_settings(conn),
                "locations": {k: v["name"] for k, v in LOCATIONS.items()},
                "stats": {
                    "tasks_total": len(tasks),
                    "tasks_done": done,
                    "events_today": events_today,
                    "competitions_active": active_comps,
                    "focus_minutes": focus_total,
                    "month_start": start_of_month,
                },
            },
        )
    finally:
        conn.close()


EXPORT_TABLES = (
    "settings",
    "tasks",
    "task_templates",
    "events",
    "competitions",
    "competition_tasks",
    "notes",
    "expenses",
    "daily_reviews",
    "weekly_goals",
    "schedule",
    "focus_sessions",
    "music_tracks",
    "music_state",
    "streak",
    "habits",
    "habit_log",
    "grades",
    "flashcards",
    "reminder",
)


def export_all_tables() -> dict:
    conn = db_connect()
    try:
        data = {"exported_at": now_local(), "app": "Harita", "tables": {}}
        for table in EXPORT_TABLES:
            try:
                rows = conn.execute(f"SELECT * FROM {table}").fetchall()
                data["tables"][table] = [row_to_dict(r) for r in rows]
            except Exception:
                pass
        return data
    finally:
        conn.close()


def backup_now() -> str | None:
    backup_dir = os.path.join(DATA_DIR, "backups")
    try:
        os.makedirs(backup_dir, exist_ok=True)
        target = os.path.join(backup_dir, f"export-{today_local()}.json")
        if not os.path.exists(target):
            with open(target, "w", encoding="utf-8") as fh:
                json.dump(export_all_tables(), fh, ensure_ascii=False, indent=1)
        # rotate: keep last 30
        backups = sorted(f for f in os.listdir(backup_dir) if f.startswith("export-") and f.endswith(".json"))
        for old in backups[:-30]:
            try:
                os.remove(os.path.join(backup_dir, old))
            except OSError:
                pass
        # F9: also copy into ~/harita-backups (survives repo deletion)
        try:
            import shutil
            second = os.path.join(os.path.expanduser("~"), "harita-backups")
            os.makedirs(second, exist_ok=True)
            second_target = os.path.join(second, f"export-{today_local()}.json")
            if not os.path.exists(second_target):
                shutil.copy2(target, second_target)
        except Exception:
            pass
        return target
    except Exception:
        return None


def api_reset(handler: BaseHTTPRequestHandler) -> None:
    """Delete every user record while keeping preferences intact."""
    parse_json_body(handler)
    conn = db_connect()
    try:
        for table in (
            "tasks", "task_templates", "events", "competitions", "competition_tasks",
            "notes", "expenses", "daily_reviews", "weekly_goals", "schedule", "focus_sessions", "music_tracks", "music_state",
            "streak", "habits", "habit_log", "grades", "flashcards", "reminder",
        ):
            conn.execute(f"DELETE FROM {table}")
        conn.commit()
        send_json(handler, 200, {"ok": True})
    finally:
        conn.close()


def _backup_dir() -> str:
    return os.path.join(DATA_DIR, "backups")


def _list_json_backups() -> list[dict]:
    folder = _backup_dir()
    out = []
    try:
        for name in sorted(os.listdir(folder), reverse=True):
            if not (name.startswith("export-") and name.endswith(".json")):
                continue
            path = os.path.join(folder, name)
            try:
                stat = os.stat(path)
            except OSError:
                continue
            out.append({"name": name, "size": stat.st_size, "modified": datetime.fromtimestamp(stat.st_mtime, TZ).isoformat()})
    except OSError:
        pass
    return out


def _list_corrupt_files() -> list[str]:
    import glob as _glob
    try:
        paths = _glob.glob(os.path.join(DATA_DIR, "*.corrupt-*.bak"))
    except OSError:
        return []
    return sorted(os.path.basename(p) for p in paths)


def api_db_status(handler: BaseHTTPRequestHandler) -> None:
    marker = os.path.join(DATA_DIR, ".corrupt-detected")
    detected = ""
    if os.path.exists(marker):
        try:
            with open(marker, encoding="utf-8") as fh:
                detected = fh.read().strip()
        except OSError:
            detected = "unknown"
    send_json(handler, 200, {
        "ok": True,
        "corrupt_detected": detected,
        "corrupt_files": _list_corrupt_files(),
        "backups": _list_json_backups(),
        "db_path": DB_PATH,
    })


IMPORT_MAX_BYTES = 25_000_000
IMPORT_SKIP_SETTINGS = {"lock_pin_hash", "lock_enabled"}


def _snapshot_backup(reason: str = "snapshot") -> str | None:
    """Write a timestamped JSON snapshot before a destructive restore/import."""
    folder = _backup_dir()
    try:
        os.makedirs(folder, exist_ok=True)
        stamp = datetime.now(TZ).strftime("%Y%m%d-%H%M%S")
        target = os.path.join(folder, f"export-{stamp}-{reason}.json")
        suffix = 1
        while os.path.exists(target):
            suffix += 1
            target = os.path.join(folder, f"export-{stamp}-{reason}-{suffix}.json")
        with open(target, "w", encoding="utf-8") as fh:
            json.dump(export_all_tables(), fh, ensure_ascii=False, indent=1)
        backups = sorted(f for f in os.listdir(folder) if f.startswith("export-") and f.endswith(".json"))
        for old in backups[:-30]:
            try:
                os.remove(os.path.join(folder, old))
            except OSError:
                pass
        return os.path.basename(target)
    except Exception as exc:
        print(f"PERINGATAN: gagal membuat snapshot sebelum impor ({exc})")
        return None


def _load_import_payload(body: dict) -> tuple[dict, str]:
    name = clip(body.get("name"), 200)
    if name:
        if os.path.basename(name) != name or not name.endswith(".json"):
            raise ValueError("Nama backup tidak valid")
        path = os.path.join(_backup_dir(), name)
        if not os.path.exists(path):
            raise ValueError("File backup tidak ditemukan")
        with open(path, encoding="utf-8") as fh:
            payload = json.load(fh)
        return payload, name
    data = body.get("data")
    if isinstance(data, dict):
        return data, "upload"
    raise ValueError("Kirim 'data' (objek backup) atau 'name' (file backup internal)")


def _validate_import_payload(payload: dict) -> tuple[list[dict], list[str]]:
    if not isinstance(payload, dict):
        raise ValueError("Format backup tidak dikenali")
    tables = payload.get("tables")
    if not isinstance(tables, dict):
        raise ValueError("Backup tidak punya objek 'tables'")
    summary: list[dict] = []
    unknown: list[str] = []
    for table, rows in tables.items():
        if table not in EXPORT_TABLES:
            unknown.append(str(table))
            continue
        if not isinstance(rows, list):
            raise ValueError(f"Tabel '{table}' harus berupa daftar baris")
        summary.append({"table": table, "rows": len(rows)})
    summary.sort(key=lambda item: EXPORT_TABLES.index(item["table"]))
    if not summary:
        raise ValueError("Backup tidak berisi tabel yang dikenali")
    return summary, unknown


def _current_row_counts() -> dict:
    conn = db_connect()
    try:
        counts = {}
        for table in EXPORT_TABLES:
            try:
                counts[table] = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            except Exception:
                counts[table] = 0
        return counts
    finally:
        conn.close()


def api_db_preview(handler: BaseHTTPRequestHandler) -> None:
    body = parse_json_body(handler, IMPORT_MAX_BYTES)
    payload, source = _load_import_payload(body)
    summary, unknown = _validate_import_payload(payload)
    send_json(handler, 200, {
        "ok": True,
        "source": source,
        "app": payload.get("app") or "",
        "exported_at": payload.get("exported_at") or "",
        "tables": summary,
        "unknown_tables": unknown,
        "current": _current_row_counts(),
    })


def _import_payload(payload: dict, selected: set[str], include_settings: bool) -> dict:
    tables = payload.get("tables") or {}
    snapshot = _snapshot_backup("before-import")
    conn = db_connect()
    try:
        imported: dict[str, int] = {}
        for table in EXPORT_TABLES:
            if table not in selected:
                continue
            if table == "settings" and not include_settings:
                continue
            rows = tables.get(table)
            if rows is None:
                continue
            cols = [r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()]
            if not cols:
                continue
            conn.execute(f"DELETE FROM {table}")
            count = 0
            for row in rows:
                if not isinstance(row, dict):
                    continue
                keys = [k for k in row.keys() if k in cols]
                if table == "settings":
                    keys = [k for k in keys if k not in IMPORT_SKIP_SETTINGS]
                if not keys:
                    continue
                placeholders = ",".join("?" for _ in keys)
                conn.execute(
                    f"INSERT INTO {table} ({','.join(keys)}) VALUES ({placeholders})",
                    [row[k] for k in keys],
                )
                count += 1
            imported[table] = count
        conn.commit()
        return {"imported": imported, "rows": sum(imported.values()), "snapshot": snapshot}
    finally:
        conn.close()


def api_db_import(handler: BaseHTTPRequestHandler) -> None:
    body = parse_json_body(handler, IMPORT_MAX_BYTES)
    payload, source = _load_import_payload(body)
    summary, _unknown = _validate_import_payload(payload)
    requested = body.get("tables")
    available = {item["table"] for item in summary}
    if isinstance(requested, list) and requested:
        selected = {str(t) for t in requested if str(t) in available}
    else:
        selected = set(available)
    if not selected:
        raise ValueError("Tidak ada tabel yang dipilih untuk diimpor")
    include_settings = bool(body.get("include_settings"))
    result = _import_payload(payload, selected, include_settings)
    try:
        os.remove(os.path.join(DATA_DIR, ".corrupt-detected"))
    except OSError:
        pass
    send_json(handler, 200, {"ok": True, "source": source, **result})


def api_db_restore(handler: BaseHTTPRequestHandler) -> None:
    body = parse_json_body(handler)
    name = clip(body.get("name"), 200)
    if not name:
        backups = _list_json_backups()
        if not backups:
            raise ValueError("Belum ada file backup JSON")
        name = backups[0]["name"]
    body = {"name": name}
    payload, source = _load_import_payload(body)
    summary, _unknown = _validate_import_payload(payload)
    selected = {item["table"] for item in summary if item["table"] != "settings"}
    if not selected:
        raise ValueError("Backup tidak berisi data yang bisa dipulihkan")
    result = _import_payload(payload, selected, include_settings=False)
    try:
        os.remove(os.path.join(DATA_DIR, ".corrupt-detected"))
    except OSError:
        pass
    send_json(handler, 200, {"ok": True, "backup": source, **result})


def api_db_corrupt_download(handler: BaseHTTPRequestHandler, query: dict) -> None:
    name = (query.get("name") or [""])[0] if isinstance(query.get("name"), list) else query.get("name", "")
    name = os.path.basename(str(name))
    if not name or not name.endswith(".bak"):
        raise ValueError("Nama file tidak valid")
    path = os.path.join(DATA_DIR, name)
    if not os.path.exists(path):
        raise ValueError("File tidak ditemukan")
    with open(path, "rb") as fh:
        data = fh.read()
    handler.send_response(200)
    handler.send_header("Content-Type", "application/octet-stream")
    handler.send_header("Content-Length", str(len(data)))
    handler.send_header("Content-Disposition", f'attachment; filename="{name}"')
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(data)


def api_db_dismiss(handler: BaseHTTPRequestHandler) -> None:
    parse_json_body(handler)
    try:
        os.remove(os.path.join(DATA_DIR, ".corrupt-detected"))
    except OSError:
        pass
    send_json(handler, 200, {"ok": True})


def api_export(handler: BaseHTTPRequestHandler) -> None:
    data = export_all_tables()
    send_json(
        handler,
        200,
        data,
        extra_headers={
            "Content-Disposition": f'attachment; filename="harita-backup-{today_local()}.json"'
        },
    )


# ----------------------------------------------------------------------------
# App lock (PIN) — B2/B4: optional password for local data
# ----------------------------------------------------------------------------
LOCK_SESSIONS: dict[str, float] = {}  # token -> expiry timestamp
PIN_SALT = "harita-v1"  # keep legacy PIN hashes valid


def _pin_hash(pin: str) -> str:
    return hashlib.sha256((PIN_SALT + pin).encode("utf-8")).hexdigest()


def _locked_enabled(conn) -> bool:
    return get_settings(conn).get("lock_enabled", "0") == "1"


def _token_valid(token: str) -> bool:
    expiry = LOCK_SESSIONS.get(token)
    return bool(expiry and expiry > time.time())


def api_lock_status(handler: BaseHTTPRequestHandler) -> None:
    conn = db_connect()
    try:
        enabled = _locked_enabled(conn)
        token = handler.headers.get("X-Pin-Token") or ""
        send_json(handler, 200, {"enabled": enabled, "unlocked": (not enabled) or _token_valid(token)})
    finally:
        conn.close()


def api_unlock(handler: BaseHTTPRequestHandler) -> None:
    body = parse_json_body(handler)
    pin = str(body.get("pin") or "").strip()
    conn = db_connect()
    try:
        settings = get_settings(conn)
        if settings.get("lock_enabled") != "1":
            send_json(handler, 200, {"ok": True, "token": ""})
            return
        stored = settings.get("lock_pin_hash", "")
        if not stored or not hmac.compare_digest(stored, _pin_hash(pin)):
            time.sleep(0.4)  # slow brute-force
            send_json(handler, 401, {"error": "PIN salah", "code": "locked"})
            return
        import secrets
        token = secrets.token_urlsafe(32)
        LOCK_SESSIONS[token] = time.time() + 12 * 3600
        send_json(handler, 200, {"ok": True, "token": token})
    finally:
        conn.close()


def api_lock(handler: BaseHTTPRequestHandler) -> None:
    """Manage PIN: action=set/enable/disable (disable & set require being unlocked if enabled)."""
    body = parse_json_body(handler)
    action = (body.get("action") or "").strip()
    pin = str(body.get("pin") or "").strip()
    conn = db_connect()
    try:
        settings = get_settings(conn)
        token = handler.headers.get("X-Pin-Token") or ""
        if settings.get("lock_enabled") == "1" and not _token_valid(token):
            send_json(handler, 401, {"error": "Buka kunci dulu", "code": "locked"})
            return
        if action == "set":
            if len(pin) < 4:
                raise ValueError("PIN minimal 4 digit")
            set_setting(conn, "lock_pin_hash", _pin_hash(pin))
            set_setting(conn, "lock_enabled", "1")
            conn.commit()
            send_json(handler, 200, {"ok": True})
            return
        if action == "disable":
            set_setting(conn, "lock_enabled", "0")
            set_setting(conn, "lock_pin_hash", "")
            conn.commit()
            LOCK_SESSIONS.clear()
            send_json(handler, 200, {"ok": True})
            return
        raise ValueError("action harus set|disable")
    finally:
        conn.close()


def _auth_ok(handler: BaseHTTPRequestHandler) -> bool:
    conn = None
    try:
        conn = db_connect()
        enabled = _locked_enabled(conn)
    except Exception:
        return True  # fail-open so a DB hiccup never locks the user out of recovery
    finally:
        if conn:
            conn.close()
    if not enabled:
        return True
    token = handler.headers.get("X-Pin-Token") or ""
    return _token_valid(token)

LOCK_EXEMPT_PREFIXES = ("/api/health", "/api/unlock", "/api/lock-status")

# ----------------------------------------------------------------------------
# Activity heatmap (F13) — contributions-style grid
# ----------------------------------------------------------------------------
def api_activity(handler: BaseHTTPRequestHandler) -> None:
    days = 112
    end = today_local()
    start = addDays(end, -(days - 1))
    conn = db_connect()
    try:
        task_map = {r["date"]: r["c"] for r in conn.execute(
            "SELECT date, COUNT(*) AS c FROM tasks WHERE deleted_at IS NULL AND done = 1 AND date BETWEEN ? AND ? GROUP BY date", (start, end))}
        focus_map = {r["date"]: r["m"] for r in conn.execute(
            "SELECT date, COALESCE(SUM(minutes),0) AS m FROM focus_sessions WHERE date BETWEEN ? AND ? GROUP BY date", (start, end))}
        habit_map = {r["date"]: r["c"] for r in conn.execute(
            "SELECT date, SUM(completed) AS c FROM habit_log WHERE date BETWEEN ? AND ? GROUP BY date", (start, end))}
        out = [{"date": addDays(start, i), "tasks": task_map.get(addDays(start, i), 0),
                "focus_min": focus_map.get(addDays(start, i), 0), "habits": habit_map.get(addDays(start, i), 0)}
               for i in range(days)]
        send_json(handler, 200, {"days": out})
    finally:
        conn.close()


# ----------------------------------------------------------------------------
# Flashcards (SM-2 spaced repetition) — F3
# ----------------------------------------------------------------------------
def api_flashcards(handler: BaseHTTPRequestHandler, query: dict) -> None:
    mode = (query.get("mode") or "").strip()
    conn = db_connect()
    try:
        if mode == "due":
            rows = conn.execute(
                "SELECT * FROM flashcards WHERE due <= ? ORDER BY due, subject, id",
                (today_local(),),
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM flashcards ORDER BY subject, id").fetchall()
        send_json(handler, 200, {"cards": [row_to_dict(r) for r in rows]})
    finally:
        conn.close()


def api_flashcard_create(handler: BaseHTTPRequestHandler) -> None:
    body = parse_json_body(handler)
    subject = clip(body.get("subject"), 80)
    front = clip(body.get("front"), 1000)
    back = clip(body.get("back"), 2000)
    if not subject or not front or not back:
        raise ValueError("Mapel, pertanyaan, dan jawaban wajib diisi")
    conn = db_connect()
    try:
        conn.execute(
            "INSERT INTO flashcards(subject, front, back, ease, interval_days, repetitions, due, created_at) VALUES(?,?,?,?,?,?,?,?)",
            (subject, front, back, 2.5, 0, 0, today_local(), now_local()),
        )
        conn.commit()
        send_json(handler, 201, {"ok": True})
    finally:
        conn.close()


def sm2_grade(ease: float, interval: int, repetitions: int, grade: int) -> tuple[float, int, int]:
    """SM-2: grade 0=blackout, 1=hard, 2=good, 3=easy"""
    if grade < 2:
        repetitions = 0
        interval = 1
    else:
        repetitions += 1
        if repetitions == 1:
            interval = 1
        elif repetitions == 2:
            interval = 6
        else:
            interval = int(round(interval * ease))
    ease = max(1.3, ease + (0.1 - (3 - grade) * (0.08 + (3 - grade) * 0.02)))
    return ease, interval, repetitions


def api_flashcard_grade(handler: BaseHTTPRequestHandler, card_id: int) -> None:
    body = parse_json_body(handler)
    try:
        grade = int(body.get("grade"))
    except (TypeError, ValueError):
        raise ValueError("grade harus 0-3")
    if grade not in (0, 1, 2, 3):
        raise ValueError("grade harus 0-3")
    conn = db_connect()
    try:
        row = conn.execute("SELECT * FROM flashcards WHERE id = ?", (card_id,)).fetchone()
        if not row:
            send_json(handler, 404, {"error": "Kartu tidak ditemukan"})
            return
        ease, interval, repetitions = sm2_grade(row["ease"], row["interval_days"], row["repetitions"], grade)
        conn.execute(
            "UPDATE flashcards SET ease = ?, interval_days = ?, repetitions = ?, due = ? WHERE id = ?",
            (ease, interval, repetitions, addDays(today_local(), interval), card_id),
        )
        conn.commit()
        send_json(handler, 200, {"ok": True, "next_due": addDays(today_local(), interval)})
    finally:
        conn.close()


def api_flashcard_delete(handler: BaseHTTPRequestHandler, card_id: int) -> None:
    conn = db_connect()
    try:
        conn.execute("DELETE FROM flashcards WHERE id = ?", (card_id,))
        conn.commit()
        send_json(handler, 200, {"ok": True})
    finally:
        conn.close()


# ----------------------------------------------------------------------------
# Focus history (per day, last N days)
# ----------------------------------------------------------------------------
def api_focus_history(handler: BaseHTTPRequestHandler, query: dict) -> None:
    try:
        days = max(7, min(90, int(query.get("days") or 14)))
    except ValueError:
        days = 14
    end = today_local()
    start = addDays(end, -(days - 1))
    conn = db_connect()
    try:
        rows = conn.execute(
            "SELECT date, COALESCE(SUM(minutes),0) AS t FROM focus_sessions WHERE date BETWEEN ? AND ? GROUP BY date",
            (start, end),
        ).fetchall()
        by_date = {r["date"]: r["t"] for r in rows}
        out = [{"date": addDays(start, i), "minutes": by_date.get(addDays(start, i), 0)} for i in range(days)]
        send_json(handler, 200, {"days": out, "start": start, "end": end})
    finally:
        conn.close()



# ----------------------------------------------------------------------------
# ICS export
# ----------------------------------------------------------------------------
def api_calendar_ics(handler: BaseHTTPRequestHandler) -> None:
    conn = db_connect()
    try:
        events = conn.execute("SELECT * FROM events WHERE deleted_at IS NULL ORDER BY date").fetchall()
        lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Harita//ID", "CALSCALE:GREGORIAN"]
        for ev in events:
            day = str(ev["date"]).replace("-", "")
            time_part = (ev["time"] or "08:00")[:5].replace(":", "") + "00"
            if ev["end_time"]:
                end_part = str(ev["end_time"])[:5].replace(":", "") + "00"
                dtstart = f"{day}T{time_part}"
                dtend = f"{day}T{end_part}"
            else:
                dtstart = day
                dtend = addDays(ev["date"], 1).replace("-", "")
            dtstamp = datetime.now(TZ).strftime("%Y%m%dT%H%M%SZ")
            uid = f"harita-{ev['id']}@harita.local"
            summary = str(ev["title"]).replace("\\", "\\\\").replace(",", "\\,").replace(";", "\\;").replace("\n", "\\n")
            desc = str(ev["note"] or "").replace("\\", "\\\\").replace(",", "\\,").replace(";", "\\;").replace("\n", "\\n")
            lines += ["BEGIN:VEVENT", f"UID:{uid}", f"DTSTAMP:{dtstamp}", f"DTSTART:{dtstart}", f"DTEND:{dtend}", f"SUMMARY:{summary}"]
            if desc:
                lines.append(f"DESCRIPTION:{desc}")
            lines.append("END:VEVENT")
        lines.append("END:VCALENDAR")
        body = "\r\n".join(lines) + "\r\n"
        handler.send_response(200)
        handler.send_header("Content-Type", "text/calendar; charset=utf-8")
        handler.send_header("Content-Disposition", f'attachment; filename="harita-{today_local()}.ics"')
        handler.send_header("Content-Length", str(len(body.encode("utf-8"))))
        handler.send_header("Cache-Control", "no-store")
        handler.end_headers()
        handler.wfile.write(body.encode("utf-8"))
    finally:
        conn.close()


# ----------------------------------------------------------------------------
# Focus stats per subject
# ----------------------------------------------------------------------------
def api_focus_stats(handler: BaseHTTPRequestHandler) -> None:
    conn = db_connect()
    try:
        since7 = addDays(today_local(), -6)
        rows7 = conn.execute(
            "SELECT COALESCE(NULLIF(subject,''), 'Tanpa mapel') AS s, "
            "COALESCE(SUM(minutes),0) AS t, COUNT(*) AS c "
            "FROM focus_sessions WHERE date >= ? GROUP BY s ORDER BY t DESC",
            (since7,),
        ).fetchall()
        rows_today = conn.execute(
            "SELECT COALESCE(NULLIF(subject,''), 'Tanpa mapel') AS s, "
            "COALESCE(SUM(minutes),0) AS t "
            "FROM focus_sessions WHERE date = ? GROUP BY s",
            (today_local(),),
        ).fetchall()
        send_json(handler, 200, {
            "since": since7,
            "subjects": [{"subject": r["s"], "minutes_7d": r["t"], "count": r["c"]} for r in rows7],
            "today": [{"subject": r["s"], "minutes": r["t"]} for r in rows_today],
        })
    finally:
        conn.close()


# ----------------------------------------------------------------------------
# Weekly review
# ----------------------------------------------------------------------------
def api_weekly_review(handler: BaseHTTPRequestHandler) -> None:
    conn = db_connect()
    try:
        today = today_local()
        day_i = datetime.fromisoformat(today).weekday()  # Monday = 0
        monday = addDays(today, -day_i)
        sunday = addDays(monday, 6)
        done = conn.execute(
            "SELECT COUNT(*) AS c FROM tasks WHERE deleted_at IS NULL AND done = 1 AND date BETWEEN ? AND ?",
            (monday, sunday),
        ).fetchone()["c"]
        total = conn.execute(
            "SELECT COUNT(*) AS c FROM tasks WHERE deleted_at IS NULL AND date BETWEEN ? AND ?",
            (monday, sunday),
        ).fetchone()["c"]
        focus_rows = conn.execute(
            "SELECT date, COALESCE(SUM(minutes),0) AS t FROM focus_sessions "
            "WHERE date BETWEEN ? AND ? GROUP BY date",
            (monday, sunday),
        ).fetchall()
        by_date = {r["date"]: r["t"] for r in focus_rows}
        focus_days = [{"date": addDays(monday, i), "minutes": by_date.get(addDays(monday, i), 0)} for i in range(7)]
        focus_total = sum(d["minutes"] for d in focus_days)
        comps = conn.execute(
            "SELECT id, title, deadline FROM competitions WHERE deleted_at IS NULL AND status != 'selesai' ORDER BY deadline"
        ).fetchall()
        habits = conn.execute("SELECT * FROM habits").fetchall()
        habits_done = 0
        for h in habits:
            r = conn.execute(
                "SELECT completed FROM habit_log WHERE habit_id = ? AND date = ?",
                (h["id"], today),
            ).fetchone()
            if r and r["completed"]:
                habits_done += 1
        send_json(handler, 200, {
            "week_start": monday,
            "week_end": sunday,
            "tasks_done": done,
            "tasks_total": total,
            "focus_total": focus_total,
            "focus_days": focus_days,
            "streak": streak_current(),
            "habits_done_today": habits_done,
            "habits_total": len(habits),
            "upcoming": [row_to_dict(r) for r in comps[:3]],
        })
    finally:
        conn.close()


# ----------------------------------------------------------------------------
# Grades / nilai
# ----------------------------------------------------------------------------
def api_grades(handler: BaseHTTPRequestHandler) -> None:
    conn = db_connect()
    try:
        rows = conn.execute("SELECT * FROM grades WHERE deleted_at IS NULL ORDER BY subject, created_at DESC").fetchall()
        settings = get_settings(conn)
        kkm = float(settings.get("kkm", "75") or 75)
        send_json(handler, 200, {"grades": [row_to_dict(r) for r in rows], "kkm": kkm})
    finally:
        conn.close()


def api_grade_create(handler: BaseHTTPRequestHandler) -> None:
    body = parse_json_body(handler)
    subject = clip(body.get("subject"), 120)
    label = clip(body.get("label"), 120) or "UH"
    try:
        score = float(body.get("score"))
    except (TypeError, ValueError):
        raise ValueError("Nilai harus berupa angka")
    if not subject:
        raise ValueError("Mata pelajaran wajib diisi")
    if score < 0 or score > 100:
        raise ValueError("Nilai harus antara 0 sampai 100")
    conn = db_connect()
    try:
        conn.execute(
            "INSERT INTO grades(subject, label, score, created_at) VALUES(?,?,?,?)",
            (subject, label, score, now_local()),
        )
        conn.commit()
        send_json(handler, 201, {"ok": True})
    finally:
        conn.close()


def api_grade_delete(handler: BaseHTTPRequestHandler, grade_id: int) -> None:
    conn = db_connect()
    try:
        soft_delete(conn, "grades", grade_id)
        conn.commit()
        send_json(handler, 200, {"ok": True})
    finally:
        conn.close()


# ----------------------------------------------------------------------------
# Habits (multi-habit streak)
# ----------------------------------------------------------------------------
def streak_from(conn: sqlite3.Connection, table: str, key_col: str | None, key, day: str) -> int:
    """Count consecutive completed days ending today; pending today falls back to yesterday."""
    today_row = None
    if key_col:
        today_row = conn.execute(
            f"SELECT completed FROM {table} WHERE {key_col} = ? AND date = ?",
            (key, day),
        ).fetchone()
    else:
        today_row = conn.execute(
            f"SELECT completed FROM {table} WHERE date = ?",
            (day,),
        ).fetchone()
    offset = 0 if today_row and today_row["completed"] else 1
    count = 0
    for i in range(offset, 365):
        d = addDays(day, -i)
        if key_col:
            row = conn.execute(
                f"SELECT completed FROM {table} WHERE {key_col} = ? AND date = ?",
                (key, d),
            ).fetchone()
        else:
            row = conn.execute(f"SELECT completed FROM {table} WHERE date = ?", (d,)).fetchone()
        if row and row["completed"]:
            count += 1
        else:
            break
    return count


def habit_current(conn: sqlite3.Connection, habit_id: int) -> int:
    return streak_from(conn, "habit_log", "habit_id", habit_id, today_local())


def habit_week(conn: sqlite3.Connection, habit_id: int) -> list[dict]:
    out = []
    for i in range(6, -1, -1):
        d = addDays(today_local(), -i)
        r = conn.execute(
            "SELECT completed FROM habit_log WHERE habit_id = ? AND date = ?",
            (habit_id, d),
        ).fetchone()
        out.append({"date": d, "completed": r["completed"] if r else 0})
    return out


def api_habits(handler: BaseHTTPRequestHandler) -> None:
    conn = db_connect()
    try:
        rows = conn.execute("SELECT * FROM habits WHERE deleted_at IS NULL ORDER BY id").fetchall()
        habits = [
            {**row_to_dict(r), "current": habit_current(conn, r["id"]), "week": habit_week(conn, r["id"])}
            for r in rows
        ]
        send_json(handler, 200, {"habits": habits})
    finally:
        conn.close()


def api_habit_create(handler: BaseHTTPRequestHandler) -> None:
    body = parse_json_body(handler)
    name = clip(body.get("name"), 80)
    icon = (body.get("icon") or "flame").strip()
    if not name:
        raise ValueError("Nama kebiasaan wajib diisi")
    conn = db_connect()
    try:
        conn.execute("INSERT INTO habits(name, icon, created_at) VALUES(?,?,?)", (name, icon, now_local()))
        conn.commit()
        send_json(handler, 201, {"ok": True})
    finally:
        conn.close()


def api_habit_update(handler: BaseHTTPRequestHandler, habit_id: int) -> None:
    body = parse_json_body(handler)
    conn = db_connect()
    try:
        if body.get("name"):
            conn.execute("UPDATE habits SET name = ? WHERE id = ?", ((body["name"] or "").strip(), habit_id))
        if body.get("icon"):
            conn.execute("UPDATE habits SET icon = ? WHERE id = ?", ((body["icon"] or "").strip(), habit_id))
        conn.commit()
        send_json(handler, 200, {"ok": True})
    finally:
        conn.close()


def api_habit_delete(handler: BaseHTTPRequestHandler, habit_id: int) -> None:
    conn = db_connect()
    try:
        soft_delete(conn, "habits", habit_id)
        conn.commit()
        send_json(handler, 200, {"ok": True})
    finally:
        conn.close()


def api_habit_toggle(handler: BaseHTTPRequestHandler, habit_id: int) -> None:
    body = parse_json_body(handler)
    day = (body.get("date") or today_local()).strip()
    completed = 1 if body.get("completed") else 0
    conn = db_connect()
    try:
        conn.execute(
            "INSERT INTO habit_log(habit_id, date, completed, updated_at) VALUES(?,?,?,?) "
            "ON CONFLICT(habit_id, date) DO UPDATE SET completed = excluded.completed, "
            "updated_at = excluded.updated_at",
            (habit_id, day, completed, now_local()),
        )
        conn.commit()
        send_json(handler, 200, {"ok": True, "date": day, "completed": completed})
    finally:
        conn.close()


# ----------------------------------------------------------------------------
# HTTP handler
# ----------------------------------------------------------------------------

MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".webmanifest": "application/manifest+json",
}


def send_json(handler, status: int, payload: dict, extra_headers: dict | None = None) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    for key, value in (extra_headers or {}).items():
        handler.send_header(key, value)
    _send_common_headers(handler)
    handler.end_headers()
    handler.wfile.write(body)


SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": (
        "default-src 'self'; script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
        "font-src 'self'; connect-src 'self'; object-src 'none'; "
        "base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
    ),
}


def _safe_join(root: str, rel: str) -> str | None:
    """Join path safely and reject anything escaping root (incl. prefix-sibling)."""
    try:
        safe = os.path.normpath(rel).lstrip("/")
        if safe.startswith(".."):
            return None
        root_real = os.path.realpath(root)
        full = os.path.realpath(os.path.join(root_real, safe))
        if full != root_real and not full.startswith(root_real + os.sep):
            return None
        return full
    except (OSError, ValueError):
        return None


def _send_common_headers(handler: BaseHTTPRequestHandler) -> None:
    for key, value in SECURITY_HEADERS.items():
        handler.send_header(key, value)


class Handler(BaseHTTPRequestHandler):
    server_version = f"Harita/{__version__}"
    _inflight = threading.Semaphore(32)  # bound concurrent request threads

    def handle(self):
        Handler._inflight.acquire()
        try:
            super().handle()
        finally:
            Handler._inflight.release()

    def log_message(self, fmt: str, *args) -> None:  # quieter logs
        if _env("HARITA_DEBUG", "MYACT_DEBUG"):
            super().log_message(fmt, *args)

    def _serve_static(self, path: str) -> None:
        if path in ("/", ""):
            path = "/index.html"
        full = _safe_join(STATIC_DIR, path)
        if not full or not os.path.isfile(full):
            self.send_error(404, "Not found")
            return
        ext = os.path.splitext(full)[1].lower()
        mtime = int(os.path.getmtime(full))
        ims = self.headers.get("If-Modified-Since")
        if ims:
            try:
                import email.utils
                ims_ts = int(email.utils.parsedate_to_datetime(ims).timestamp())
                if ims_ts >= mtime:
                    self.send_response(304)
                    self.send_header("Cache-Control", "no-cache")
                    self.send_header("Last-Modified", email.utils.formatdate(mtime, usegmt=True))
                    self.end_headers()
                    return
            except Exception:
                pass
        with open(full, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", MIME.get(ext, "application/octet-stream"))
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Last-Modified", __import__("email.utils", fromlist=["formatdate"]).formatdate(mtime, usegmt=True))
        _send_common_headers(self)
        self.end_headers()
        self.wfile.write(body)

    def _serve_music(self, rel: str) -> None:
        full = _safe_join(MUSIC_DIR, rel)
        if not full or not os.path.isfile(full):
            self.send_error(404, "Not found")
            return
        ext = os.path.splitext(full)[1].lower()
        mime = MIME.get(ext, "audio/mpeg")
        with open(full, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "public, max-age=86400")
        _send_common_headers(self)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = {k: v[0] for k, v in urllib.parse.parse_qs(parsed.query).items()}
        try:
            if not path.startswith("/api/health") and not path.startswith("/api/unlock") and not path.startswith("/api/lock-status") and not _auth_ok(self):
                send_json(self, 401, {"error": "Terkunci", "code": "locked"})
                return
            if path == "/api/health":
                send_json(self, 200, {"ok": True, "now": now_local()})
            elif path == "/api/bootstrap":
                api_bootstrap(self)
            elif path == "/api/weather":
                loc = query.get("loc", "jakarta")
                force = query.get("refresh") == "1"
                send_json(self, 200, get_weather(loc, force))
            elif path == "/api/tasks":
                api_tasks(self, query)
            elif path == "/api/templates":
                conn = db_connect()
                try:
                    rows = conn.execute(
                        "SELECT * FROM task_templates ORDER BY priority, id"
                    ).fetchall()
                    send_json(self, 200, {"templates": [row_to_dict(r) for r in rows]})
                finally:
                    conn.close()
            elif path == "/api/events":
                api_events(self, query)
            elif path == "/api/competitions":
                api_competitions(self)
            elif path == "/api/notes":
                api_notes(self)
            elif path == "/api/expenses":
                api_expenses(self, query)
            elif path == "/api/daily-review":
                api_daily_review(self, query)
            elif path == "/api/weekly-goal":
                api_weekly_goal(self, query)
            elif path == "/api/search":
                api_search(self, query)
            elif path == "/api/schedule":
                api_schedule(self, query)
            elif path == "/api/focus":
                api_focus(self, query)
            elif path == "/api/focus/stats":
                api_focus_stats(self)
            elif path == "/api/weekly-review":
                api_weekly_review(self)
            elif path == "/api/focus/history":
                api_focus_history(self, query)
            elif path == "/api/db/status":
                api_db_status(self)
            elif path == "/api/db/corrupt":
                api_db_corrupt_download(self, query)
            elif path == "/api/calendar.ics":
                api_calendar_ics(self)
            elif path == "/api/activity":
                api_activity(self)
            elif path == "/api/lock-status":
                api_lock_status(self)
            elif path == "/api/flashcards":
                api_flashcards(self, query)
            elif path == "/api/grades":
                api_grades(self)
            elif path == "/api/habits":
                api_habits(self)
            elif path == "/api/settings":
                api_settings(self)
            elif path == "/api/export":
                api_export(self)
            elif path == "/api/device":
                api_device(self)
            elif path == "/api/music/library":
                api_music_library(self)
            elif path == "/api/music/search":
                api_music_search(self, query)
            elif path == "/api/music/state":
                api_music_state(self)
            elif path.startswith("/api/music/file/"):
                rel = path[len("/api/music/file/"):]
                self._serve_music(rel)
            elif path == "/api/streak":
                api_streak(self, query)
            elif path == "/api/reminders":
                api_reminders(self)
            elif path.startswith("/api/reminders/"):
                send_json(self, 404, {"error": "Gunakan DELETE untuk hapus pengingat"})
            elif path.startswith("/api/"):
                send_json(self, 404, {"error": "Endpoint tidak ditemukan"})
            else:
                self._serve_static(path)
        except Exception as exc:  # pragma: no cover
            send_json(self, 500, {"error": str(exc)})

    def _origin_ok(self) -> bool:
        """Reject cross-origin POST/PATCH/DELETE (blocks browser CSRF from evil sites)."""
        origin = self.headers.get("Origin") or self.headers.get("Referer") or ""
        if not origin:
            return True  # same-origin fetch without Origin header (curl, same-page) is fine
        try:
            parsed = urllib.parse.urlparse(origin)
            port = parsed.port or (80 if parsed.scheme == "http" else 0)
        except ValueError:
            return False
        if parsed.scheme != "http":
            return False
        host = (parsed.hostname or "").lower()
        return host in ("127.0.0.1", "localhost", "::1") and port == PORT

    def do_POST(self) -> None:
        if not self._origin_ok():
            send_json(self, 403, {"error": "Permintaan lintas asal (cross-origin) ditolak"})
            return
        path = urllib.parse.urlparse(self.path).path
        if not (path.startswith("/api/health") or path.startswith("/api/unlock") or path.startswith("/api/lock-status")) and not _auth_ok(self):
            send_json(self, 401, {"error": "Terkunci", "code": "locked"})
            return
        try:
            if path == "/api/tasks":
                api_task_create(self)
            elif path == "/api/templates":
                api_template_create(self)
            elif path == "/api/tasks/carry":
                api_task_carry(self)
            elif path == "/api/tasks/reset":
                api_task_reset(self)
            elif path == "/api/tasks/complete-all":
                api_task_complete_all(self)
            elif path == "/api/tasks/reorder":
                api_task_reorder(self)
            elif path == "/api/demo":
                api_demo(self)
            elif path == "/api/reset":
                api_reset(self)
            elif path == "/api/db/restore":
                api_db_restore(self)
            elif path == "/api/db/preview":
                api_db_preview(self)
            elif path == "/api/db/import":
                api_db_import(self)
            elif path == "/api/db/dismiss":
                api_db_dismiss(self)
            elif path == "/api/events":
                api_event_create(self)
            elif path == "/api/competitions":
                api_competition_create(self)
            elif re.fullmatch(r"/api/competitions/\d+/tasks", path):
                api_competition_task_create(self, int(path.split("/")[3]))
            elif path == "/api/notes":
                api_note_create(self)
            elif path == "/api/expenses":
                api_expense_create(self)
            elif path == "/api/daily-review":
                api_daily_review_save(self)
            elif path == "/api/weekly-goal":
                api_weekly_goal_save(self)
            elif path == "/api/schedule":
                api_schedule_create(self)
            elif path == "/api/focus":
                api_focus_create(self)
            elif path == "/api/grades":
                api_grade_create(self)
            elif path == "/api/habits":
                api_habit_create(self)
            elif path == "/api/restore":
                api_restore(self)
            elif path == "/api/unlock":
                api_unlock(self)
            elif path == "/api/lock":
                api_lock(self)
            elif path == "/api/flashcards":
                api_flashcard_create(self)
            elif re.fullmatch(r"/api/flashcards/\d+/grade", path):
                api_flashcard_grade(self, int(path.split("/")[3]))
            elif re.fullmatch(r"/api/habits/\d+/toggle", path):
                api_habit_toggle(self, int(path.split("/")[3]))
            elif path == "/api/settings":
                api_settings(self, parse_json_body(self))
            elif path == "/api/music/state":
                api_music_state(self, parse_json_body(self))
            elif path == "/api/weather/refresh":
                body = parse_json_body(self)
                send_json(self, 200, get_weather(body.get("loc", "jakarta"), True))
            elif path == "/api/streak":
                api_streak_create(self)
            elif path == "/api/reminders":
                api_reminder_create(self)
            else:
                send_json(self, 404, {"error": "Endpoint tidak ditemukan"})
        except ValueError as exc:
            send_json(self, 400, {"error": str(exc)})
        except Exception as exc:
            send_json(self, 500, {"error": str(exc)})

    def do_PATCH(self) -> None:
        if not self._origin_ok():
            send_json(self, 403, {"error": "Permintaan lintas asal (cross-origin) ditolak"})
            return
        path = urllib.parse.urlparse(self.path).path
        if not (path.startswith("/api/health") or path.startswith("/api/unlock") or path.startswith("/api/lock-status")) and not _auth_ok(self):
            send_json(self, 401, {"error": "Terkunci", "code": "locked"})
            return
        try:
            m = re.fullmatch(r"/api/tasks/(\d+)", path)
            if m:
                api_task_update(self, int(m.group(1)))
                return
            m = re.fullmatch(r"/api/events/(\d+)", path)
            if m:
                api_event_update(self, int(m.group(1)))
                return
            m = re.fullmatch(r"/api/competitions/(\d+)", path)
            if m:
                api_competition_update(self, int(m.group(1)))
                return
            m = re.fullmatch(r"/api/competition-tasks/(\d+)", path)
            if m:
                api_competition_task_update(self, int(m.group(1)))
                return
            m = re.fullmatch(r"/api/notes/(\d+)", path)
            if m:
                api_note_update(self, int(m.group(1)))
            elif (m := re.fullmatch(r"/api/expenses/(\d+)", path)):
                api_expense_update(self, int(m.group(1)))
                return
            m = re.fullmatch(r"/api/schedule/(\d+)", path)
            if m:
                api_schedule_update(self, int(m.group(1)))
                return
            m = re.fullmatch(r"/api/templates/(\d+)", path)
            if m:
                api_template_update(self, int(m.group(1)))
                return
            m = re.fullmatch(r"/api/habits/(\d+)", path)
            if m:
                api_habit_update(self, int(m.group(1)))
                return
            send_json(self, 404, {"error": "Endpoint tidak ditemukan"})
        except ValueError as exc:
            send_json(self, 400, {"error": str(exc)})
        except Exception as exc:
            send_json(self, 500, {"error": str(exc)})

    def do_DELETE(self) -> None:
        if not self._origin_ok():
            send_json(self, 403, {"error": "Permintaan lintas asal (cross-origin) ditolak"})
            return
        path = urllib.parse.urlparse(self.path).path
        if not (path.startswith("/api/health") or path.startswith("/api/unlock") or path.startswith("/api/lock-status")) and not _auth_ok(self):
            send_json(self, 401, {"error": "Terkunci", "code": "locked"})
            return
        try:
            m = re.fullmatch(r"/api/tasks/(\d+)", path)
            if m:
                api_task_delete(self, int(m.group(1)))
                return
            m = re.fullmatch(r"/api/templates/(\d+)", path)
            if m:
                api_template_delete(self, int(m.group(1)))
                return
            m = re.fullmatch(r"/api/events/(\d+)", path)
            if m:
                api_event_delete(self, int(m.group(1)))
                return
            m = re.fullmatch(r"/api/competitions/(\d+)", path)
            if m:
                api_competition_delete(self, int(m.group(1)))
                return
            m = re.fullmatch(r"/api/competition-tasks/(\d+)", path)
            if m:
                api_competition_task_delete(self, int(m.group(1)))
                return
            m = re.fullmatch(r"/api/notes/(\d+)", path)
            if m:
                api_note_delete(self, int(m.group(1)))
            elif (m := re.fullmatch(r"/api/expenses/(\d+)", path)):
                api_expense_delete(self, int(m.group(1)))
                return
            m = re.fullmatch(r"/api/schedule/(\d+)", path)
            if m:
                api_schedule_delete(self, int(m.group(1)))
                return
            m = re.fullmatch(r"/api/reminders/(\d+)", path)
            if m:
                api_reminder_delete(self, int(m.group(1)))
                return
            m = re.fullmatch(r"/api/habits/(\d+)", path)
            if m:
                api_habit_delete(self, int(m.group(1)))
                return
            m = re.fullmatch(r"/api/grades/(\d+)", path)
            if m:
                api_grade_delete(self, int(m.group(1)))
                return
            m = re.fullmatch(r"/api/flashcards/(\d+)", path)
            if m:
                api_flashcard_delete(self, int(m.group(1)))
                return
            send_json(self, 404, {"error": "Endpoint tidak ditemukan"})
        except Exception as exc:
            send_json(self, 500, {"error": str(exc)})


def main() -> None:
    init_db()
    backup_now()
    load_weather_disk()
    try:
        threading.Thread(target=lambda: get_weather("jakarta"), daemon=True).start()
    except Exception:
        pass
    try:
        server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError as exc:
        print(f"\nERROR: Port {PORT} sedang dipakai proses lain.")
        print('Matikan dulu dengan: pkill -f "harita/server.py"')
        print(f"Atau pakai port lain: HARITA_PORT=8877 ./run.sh\n")
        raise SystemExit(1)
    log(f"Harita berjalan di http://127.0.0.1:{PORT}")
    if _FROZEN and _env("HARITA_NO_OPEN", "MYACT_NO_OPEN") != "1":
        url = f"http://127.0.0.1:{PORT}/"
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        backup_now()
        log("Server dimatikan — backup tersimpan.")


if __name__ == "__main__":
    main()
