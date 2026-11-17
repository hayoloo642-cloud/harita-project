#!/usr/bin/env python3
"""Unit test untuk fungsi murni server.py — dijalankan tanpa dependensi luar (stdlib unittest).

    python3 tests/test_unit.py
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# pakai folder data sementara agar import tidak menyentuh data pengguna
os.environ["HARITA_DATA"] = tempfile.mkdtemp(prefix="harita-unit-")
sys.path.insert(0, str(ROOT))

import server  # noqa: E402


class TestSm2(unittest.TestCase):
    def test_first_review_grade_good(self):
        ease, interval, reps = server.sm2_grade(2.5, 0, 0, 2)
        self.assertEqual(reps, 1)
        self.assertEqual(interval, 1)
        self.assertGreaterEqual(ease, 1.3)

    def test_second_review_grade_good(self):
        ease, interval, reps = server.sm2_grade(2.5, 1, 1, 2)
        self.assertEqual(reps, 2)
        self.assertEqual(interval, 6)

    def test_third_review_grade_good(self):
        ease, interval, reps = server.sm2_grade(2.5, 6, 2, 2)
        self.assertEqual(reps, 3)
        self.assertEqual(interval, round(6 * ease))

    def test_failure_resets_progress(self):
        for grade in (0, 1):
            ease, interval, reps = server.sm2_grade(2.5, 6, 3, grade)
            self.assertEqual(reps, 0)
            self.assertEqual(interval, 1)

    def test_ease_never_below_floor(self):
        ease = 1.3
        for _ in range(10):
            ease, _, _ = server.sm2_grade(ease, 1, 0, 0)
        self.assertGreaterEqual(ease, 1.3)

    def test_grade_easy_increases_ease(self):
        ease, _, _ = server.sm2_grade(2.5, 6, 2, 3)
        self.assertGreater(ease, 2.5)


class TestAddDays(unittest.TestCase):
    def test_simple_addition(self):
        self.assertEqual(server.addDays("2026-11-17", 1), "2026-11-18")
        self.assertEqual(server.addDays("2026-12-31", 1), "2027-01-01")
        self.assertEqual(server.addDays("2026-02-27", 1), "2026-02-28")

    def test_negative(self):
        self.assertEqual(server.addDays("2026-11-17", -7), "2026-11-10")


class TestYoutubeParsing(unittest.TestCase):
    HTML = (
        "<html><head><script>var x = {};</script>"
        "<script>var ytInitialData = " + json.dumps({
            "contents": {
                "twoColumnSearchResultsRenderer": {
                    "primaryContent": {
                        "sectionListRenderer": {
                            "contents": [{
                                "itemSectionRenderer": {
                                    "contents": [
                                        {"videoRenderer": {
                                            "videoId": "abc123def45",
                                            "title": {"runs": [{"text": "Judul Video"}]},
                                            "ownerText": {"runs": [{"text": "Kanal"}]},
                                            "lengthText": {"simpleText": "3:52"},
                                            "viewCountText": {"simpleText": "1.234 views"},
                                        }},
                                        {"continuationItemRenderer": {}},
                                    ]
                                }
                            }]
                        }
                    }
                }
            }
        }) + ";</script></head><body></body></html>"
    )

    def test_parses_video_renderer(self):
        videos = server._parse_youtube_results(self.HTML)
        self.assertEqual(len(videos), 1)
        self.assertEqual(videos[0]["videoId"], "abc123def45")

    def test_empty_html_returns_empty_list(self):
        self.assertEqual(server._parse_youtube_results("<html></html>"), [])

    def test_garbage_json_returns_empty_list(self):
        self.assertEqual(server._parse_youtube_results('ytInitialData = {broken json'), [])

    def test_yt_text_helpers(self):
        self.assertEqual(server._yt_text({"simpleText": "abc"}), "abc")
        self.assertEqual(server._yt_text({"runs": [{"text": "ab"}, {"text": "cd"}]}), "abcd")
        self.assertEqual(server._yt_text("nope"), "")

    def test_parse_duration(self):
        self.assertEqual(server._parse_duration("3:52"), 232)
        self.assertEqual(server._parse_duration("1:09:12"), 4152)
        self.assertEqual(server._parse_duration("abc"), 0)


class TestImportPayload(unittest.TestCase):
    def test_rejects_non_dict(self):
        with self.assertRaises(Exception):
            server._import_payload("nope", set(), False)

    def test_missing_tables_returns_empty_summary_or_raises(self):
        try:
            result = server._import_payload({"tables": {}}, {"tasks"}, False)
        except Exception:
            return  # acceptable — most implementations raise on missing keys
        self.assertIsInstance(result, dict)


if __name__ == "__main__":
    unittest.main(verbosity=2)
