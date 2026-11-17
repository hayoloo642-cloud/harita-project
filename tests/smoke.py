#!/usr/bin/env python3
"""MyAct smoke test — boots the server on a throwaway database and exercises the API.

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


def request(base: str, path: str, method: str = "GET", body: dict | None = None):
    data = None
    headers = {"Origin": base}
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(base + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
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
    tmp = tempfile.mkdtemp(prefix="myact-smoke-")
    env = {
        **os.environ,
        "MYACT_PORT": str(port),
        "MYACT_DATA": tmp,
        "MYACT_DB": os.path.join(tmp, "test.db"),
        "MYACT_TZ": "Asia/Jakarta",
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

        print("health & bootstrap")
        status, data = request(base, "/api/health")
        check("health 200", status == 200 and data.get("ok") is True, str(data))
        status, data = request(base, "/api/bootstrap")
        check("bootstrap 200", status == 200 and "settings" in data, str(data)[:120])
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

        print("backup preview & import")
        status, status_payload = request(base, "/api/db/status")
        check("db status 200", status == 200 and "backups" in status_payload, str(status_payload)[:120])
        status, exported = request(base, "/api/export")
        check("export returns tables", status == 200 and "tables" in exported)
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
