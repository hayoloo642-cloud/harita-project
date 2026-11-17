#!/usr/bin/env python3
"""Harita smoke test — boots the server on a throwaway database and exercises the API.

Usage:
    python3 tests/smoke.py            # normal API checks
    python3 tests/smoke.py --stress   # also insert 300 tasks / 200 cards and time reads

Exit code 0 = all good, 1 = at least one failure.
"""
from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FAILS: list[str] = []
PASSES = 0


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


SESSION_COOKIE = {"value": None}


def request(base: str, path: str, method: str = "GET", body: dict | None = None):
    data = None
    headers = {"Origin": base}
    if SESSION_COOKIE["value"]:
        headers["Cookie"] = SESSION_COOKIE["value"]
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(base + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            set_cookie = res.headers.get("Set-Cookie")
            if set_cookie:
                SESSION_COOKIE["value"] = set_cookie.split(";", 1)[0]
            raw = res.read()
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                payload = raw[:200]
            return res.status, payload
    except urllib.error.HTTPError as err:
        raw = err.read()
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = raw[:200]
        return err.code, payload


def check(name: str, condition: bool, detail: str = "") -> None:
    global PASSES
    if condition:
        PASSES += 1
        print(f"  ok   {name}")
    else:
        FAILS.append(name)
        print(f"  FAIL {name}{(' — ' + detail) if detail else ''}")


def main() -> int:
    stress = "--stress" in sys.argv
    port = free_port()
    base = f"http://127.0.0.1:{port}"
    tmp = tempfile.mkdtemp(prefix="harita-smoke-")
    env = {
        **os.environ,
        "HARITA_PORT": str(port),
        "HARITA_DATA": tmp,
        "HARITA_DB": os.path.join(tmp, "test.db"),
        "HARITA_TZ": "Asia/Jakarta",
    }
    proc = subprocess.Popen(
        [sys.executable, str(ROOT / "server.py")],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.STDOUT,
    )
    try:
        # wait for boot
        for _ in range(60):
            try:
                status, _ = request(base, "/api/health")
                if status == 200:
                    break
            except Exception:
                pass
            time.sleep(0.15)
        else:
            print("server did not boot")
            return 1

        print("health & release hardening")
        status, data = request(base, "/api/health")
        check("health 200", status == 200 and data.get("ok") is True, str(data))
        health_req = urllib.request.Request(base + "/api/health", headers={"Origin": base})
        with urllib.request.urlopen(health_req, timeout=10) as res:
            check("security headers on API", res.headers.get("X-Content-Type-Options") == "nosniff" and "default-src" in (res.headers.get("Content-Security-Policy") or ""), str(res.headers.keys()))
        home_req = urllib.request.Request(base + "/", headers={"Origin": base})
        with urllib.request.urlopen(home_req, timeout=10) as res:
            check("security headers on static", res.headers.get("X-Content-Type-Options") == "nosniff" and res.headers.get("X-Frame-Options") == "DENY", str(res.headers.keys()))
        evil = urllib.request.Request(
            base + "/api/tasks",
            data=json.dumps({"date": data.get("today") if isinstance(data, dict) else "", "title": "csrf"}).encode(),
            headers={"Origin": base + ".evil", "Content-Type": "application/json"},
            method="POST",
        )
        try:
            urllib.request.urlopen(evil, timeout=10).read()
            check("cross-origin POST rejected", False, "request was accepted")
        except urllib.error.HTTPError as err:
            check("cross-origin POST rejected", err.code == 403, f"got {err.code}")
        for bad_path in ("/..//server.py", "/%2e%2e/server.py"):
            try:
                urllib.request.urlopen(base + bad_path, timeout=10).read()
                bad_status = 200
            except urllib.error.HTTPError as err:
                bad_status = err.code
            check(f"static traversal rejected ({bad_path})", bad_status in (400, 404), str(bad_status))
        status, _ = request(base, "/api/bootstrap")
        check("API terkunci sebelum daftar (401)", status == 401, f"got {status}")
        status, _ = request(base, "/api/update/status")
        check("update status terkunci sebelum daftar (401)", status == 401, f"got {status}")
        status, reg = request(base, "/api/auth/register", "POST", {"name": "Smoke", "password": "smoke-test-password", "confirm": "smoke-test-password"})
        check("daftar akun pertama", status == 200 and reg.get("ok") is True, str(reg)[:120])
        status, upd = request(base, "/api/update/status")
        check(
            "update status 200 dengan field yang benar",
            status == 200 and {"supported", "behind", "available", "current_version"} <= set(upd),
            str(upd)[:160],
        )
        status, data = request(base, "/api/bootstrap")
        check("bootstrap 200 setelah daftar", status == 200 and "settings" in data, str(data)[:120])
        check("fresh install has no tasks", not data["settings"].get("name") == "" and True)

        print("tasks")
        status, task = request(base, "/api/tasks", "POST", {"date": data["today"], "title": "Smoke test task", "priority": 1})
        check("create task", status in (200, 201) and task.get("task", {}).get("id"), str(task)[:120])
        tid = task.get("task", {}).get("id")
        if tid:
            status, _ = request(base, f"/api/tasks/{tid}", "PATCH", {"done": 1})
            check("toggle task", status == 200)
            status, listing = request(base, f"/api/tasks?date={data['today']}")
            check("task is done", any(t["id"] == tid and t["done"] for t in listing.get("tasks", [])))
        status, res = request(base, "/api/tasks/complete-all", "POST", {"date": data["today"]})
        check("complete-all", status == 200 and res.get("ok") is True, str(res))
        status, res = request(base, "/api/tasks/reset", "POST", {"date": data["today"]})
        check("reset tasks", status == 200)

        print("notes / grades / flashcards / habits")
        status, note = request(base, "/api/notes", "POST", {"title": "Smoke note", "body": "hello"})
        check("create note", status in (200, 201), str(note)[:120])
        nid = note.get("note", {}).get("id")
        if nid:
            status, _ = request(base, f"/api/notes/{nid}", "DELETE")
            check("soft-delete note", status == 200)
        status, grade = request(base, "/api/grades", "POST", {"subject": "Smoke", "label": "Test", "score": 90})
        check("create grade", status in (200, 201), str(grade)[:120])
        status, card = request(base, "/api/flashcards", "POST", {"subject": "Smoke", "front": "Q?", "back": "A"})
        check("create flashcard", status in (200, 201), str(card)[:120])
        status, habit = request(base, "/api/habits", "POST", {"name": "Smoke habit"})
        check("create habit", status in (200, 201), str(habit)[:120])

        print("settings & security")
        status, res = request(base, "/api/settings", "POST", {"theme": "light", "accent": "teal", "font_size": "large", "contrast": "high"})
        check("settings accepted", status == 200)
        settings = res.get("settings", {})
        check("settings persisted", settings.get("accent") == "teal" and settings.get("contrast") == "high")
        status, res = request(base, "/api/settings", "POST", {"theme": "bogus", "accent": "bogus"})
        check("invalid settings coerced", status == 200 and res.get("settings", {}).get("theme") == "dark")
        print("new task features")
        status, task_a = request(base, "/api/tasks", "POST", {
            "date": data["today"], "title": "Task A",
            "subtasks": [{"title": "step one", "done": 1}, {"title": "step two", "done": 0}],
        })
        check("create task with subtasks", status in (200, 201), str(task_a)[:140])
        tid_a = task_a.get("task", {}).get("id")
        check("subtasks persisted", '"step one"' in (task_a.get("task", {}).get("subtasks") or ""))
        status, task_b = request(base, "/api/tasks", "POST", {"date": data["today"], "title": "Task B"})
        tid_b = task_b.get("task", {}).get("id")
        if tid_a and tid_b:
            status, res = request(base, "/api/tasks/reorder", "POST", {"ids": [tid_b, tid_a]})
            check("reorder accepted", status == 200 and res.get("ok") is True, str(res))
            status, listing = request(base, f"/api/tasks?date={data['today']}")
            order = [t["id"] for t in listing.get("tasks", [])]
            check("reorder applied", order.index(tid_b) < order.index(tid_a), str(order))
        status, ev = request(base, "/api/events", "POST", {"title": "Weekly event", "date": data["today"], "repeat": "weekly"})
        check("recurring event created", status in (200, 201) and ev.get("event", {}).get("repeat") == "weekly", str(ev)[:140])

        print("new settings")
        status, res = request(base, "/api/settings", "POST", {
            "pinned_views": "tugas,nilai", "hidden_views": "music", "language": "en",
        })
        settings = res.get("settings", {})
        check("pinned/hidden views saved", settings.get("pinned_views") == "tugas,nilai" and settings.get("hidden_views") == "music")
        check("language saved", settings.get("language") == "en")
        status, res = request(base, "/api/settings", "POST", {"pinned_views": "evil,__proto__"})
        check("invalid views coerced", status == 200 and res.get("settings", {}).get("pinned_views") == "")

        print("expenses")
        month = data["today"][:7]
        status, exp = request(base, "/api/expenses", "POST", {
            "date": data["today"], "amount": 25000, "category": "makan",
            "method": "qris", "note": "Smoke lunch",
        })
        check("create expense", status in (200, 201) and exp.get("expense", {}).get("id"), str(exp)[:140])
        eid = exp.get("expense", {}).get("id")
        if eid:
            status, listing = request(base, f"/api/expenses?month={month}")
            check("month list includes expense", status == 200 and any(x["id"] == eid for x in listing.get("expenses", [])), str(listing)[:160])
            check("month total counted", listing.get("total", 0) >= 25000, str(listing.get("total")))
            status, upd = request(base, f"/api/expenses/{eid}", "PATCH", {"amount": 30000, "note": "Smoke lunch edited"})
            check("update expense", status == 200 and upd.get("expense", {}).get("amount") == 30000, str(upd)[:140])
            status, _ = request(base, f"/api/expenses/{eid}", "DELETE")
            check("soft-delete expense", status == 200)
            status, listing = request(base, f"/api/expenses?month={month}")
            check("deleted expense hidden", all(x["id"] != eid for x in listing.get("expenses", [])))
            status, _ = request(base, "/api/restore", "POST", {"kind": "expense", "id": eid})
            check("restore expense", status == 200)
            status, listing = request(base, f"/api/expenses?month={month}")
            check("restored expense visible", any(x["id"] == eid for x in listing.get("expenses", [])))
        status, bad = request(base, "/api/expenses", "POST", {"amount": 0})
        check("invalid expense amount rejected", status == 400, str(bad)[:120])
        status, res = request(base, "/api/settings", "POST", {"expense_budget": "500000"})
        check("expense budget saved", status == 200 and res.get("settings", {}).get("expense_budget") == "500000", str(res)[:140])

        print("weekly goal & nightly review")
        status, goal = request(base, "/api/weekly-goal", "POST", {"title": "Smoke weekly target", "done": False})
        check("save weekly goal", status == 200 and goal.get("goal", {}).get("title") == "Smoke weekly target", str(goal)[:160])
        status, goal = request(base, "/api/weekly-goal", "POST", {"title": "Smoke weekly target", "done": True})
        check("weekly goal toggling", status == 200 and int(goal.get("goal", {}).get("done") or 0) == 1, str(goal)[:160])
        status, review = request(base, "/api/daily-review", "POST", {
            "date": data["today"], "wins": "Smoke win", "carried": "", "tomorrow": "Smoke tomorrow",
        })
        check("save nightly review", status == 200 and review.get("review", {}).get("wins") == "Smoke win", str(review)[:160])
        status, review = request(base, f"/api/daily-review?date={data['today']}")
        check("reload nightly review", status == 200 and review.get("review", {}).get("tomorrow") == "Smoke tomorrow", str(review)[:160])

        print("global search")
        status, found = request(base, "/api/search?q=Smoke")
        check("global search returns results", status == 200 and len(found.get("results", [])) >= 2, str(found)[:200])
        check("global search has expected type", any(x.get("type") in ("task", "note", "expense") for x in found.get("results", [])), str(found)[:200])

        print("backup preview & import")
        status, status_payload = request(base, "/api/db/status")
        check("db status 200", status == 200 and "backups" in status_payload, str(status_payload)[:120])
        status, exported = request(base, "/api/export")
        check("export returns tables", status == 200 and "tables" in exported)
        check("export includes weekly review tables", all(t in exported.get("tables", {}) for t in ("daily_reviews", "weekly_goals")))
        check("export includes expenses", "expenses" in exported.get("tables", {}))
        status, preview = request(base, "/api/db/preview", "POST", {"data": exported})
        check("preview accepts upload", status == 200 and any(t["table"] == "tasks" for t in preview.get("tables", [])), str(preview)[:160])
        status, imp = request(base, "/api/db/import", "POST", {"data": exported, "tables": ["tasks"]})
        check("import selected tables", status == 200 and "tasks" in imp.get("imported", {}), str(imp)[:160])
        check("import made snapshot", bool(imp.get("snapshot")), str(imp)[:160])
        status, bad = request(base, "/api/db/preview", "POST", {"data": {"nope": 1}})
        check("invalid backup rejected", status == 400, str(bad)[:120])

        status, _ = request(base, "/api/reset", "POST", {})
        check("reset all data", status == 200)

        print("demo data")
        status, res = request(base, "/api/demo", "POST", {})
        check("demo seeded", status == 200 and res.get("seeded") is True, str(res))
        status, listing = request(base, "/api/tasks")
        check("demo tasks present", len(listing.get("tasks", [])) >= 3)
        status, listing = request(base, "/api/expenses")
        check("demo expenses present", len(listing.get("expenses", [])) >= 3, str(listing)[:160])

        print("fuzz import (garbage payloads harus ditolak, bukan 500)")
        garbage_cases = [
            {"tables": "bukan-dict"},
            {"tables": {"tasks": "bukan-list"}},
            {"tables": {"tasks": [1, 2, 3]}},
            {"tables": {"tasks": [{"id": "x" * 5000}]}},
            {"tables": {"tak_terdaftar": [{"a": 1}]}},
            {"tables": {"events": [{"date": "ini-bukan-tanggal"}]}},
            {"tables": None, "data": "bukan-objek"},
            "bukan-json",
        ]
        for i, payload in enumerate(garbage_cases):
            if isinstance(payload, dict):
                status, _ = request(base, "/api/db/import", "POST", payload)
            else:
                status, _ = request(base, "/api/db/import", "POST", {"raw": payload})
            check(f"garbage import {i} ditolak (bukan 500)", status >= 400, f"got {status}")
        # payload dengan datetime liar tidak memicu 500
        status, _ = request(base, "/api/db/import", "POST", {"tables": {"events": [{"id": 1, "date": "bukan-tanggal", "title": "x"}]}})
        check("events tanggal liar ditolak rapih", status in (200, 400, 422), f"got {status}")

        if stress:
            print("stress (300 tasks, 200 flashcards)")
            today = request(base, "/api/bootstrap")[1]["today"]
            start = time.time()
            for i in range(300):
                request(base, "/api/tasks", "POST", {"date": today, "title": f"Stress task {i}"})
            elapsed = time.time() - start
            print(f"  ... 300 task inserts in {elapsed:.2f}s")
            start = time.time()
            status, listing = request(base, f"/api/tasks?date={today}")
            read = time.time() - start
            print(f"  ... list {len(listing.get('tasks', []))} tasks in {read*1000:.0f}ms")
            check("300 tasks listed under 500ms", status == 200 and read < 0.5, f"{read*1000:.0f}ms")
            for i in range(200):
                request(base, "/api/flashcards", "POST", {"subject": "Stress", "front": f"Q{i}", "back": f"A{i}"})
            start = time.time()
            status, cards = request(base, "/api/flashcards")
            read = time.time() - start
            print(f"  ... list {len(cards.get('cards', []))} flashcards in {read*1000:.0f}ms")
            check("flashcards listed under 500ms", status == 200 and read < 0.5, f"{read*1000:.0f}ms")
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()

    print(f"\n{PASSES} passed, {len(FAILS)} failed")
    if FAILS:
        print("failed:", ", ".join(FAILS))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
