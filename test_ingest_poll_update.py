import copy
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).parent / "automation" / "ingest_poll_update.py"
SPEC = importlib.util.spec_from_file_location("ingest_poll_update", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(MODULE)


class IngestPollUpdateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        base = Path(__file__).parent / "data"
        cls.raw = json.loads((base / "raw-polls.json").read_text())
        cls.legacy = json.loads((base / "polls.json").read_text())

    def new_payload(self):
        common = {
            "pollster": "Test Institute",
            "start": "2026-09-20",
            "end": "2026-09-21",
            "published": "2026-09-22",
            "sample": 2000,
            "moe": 2.0,
            "confidence": 95,
            "registration": "BR-99999/2026",
            "method": "In person",
            "source": "https://example.test/report",
            "verification": "primary-result",
            "basis": "total respondents",
        }
        round1 = {
            **common,
            "values": {"lula": 40, "flavio": 35},
            "responses": {"blank_null": 15, "undecided": 10},
            "coverage": "complete",
            "scenario": "Main stimulated first-round scenario",
            "waveId": "Test Institute|BR-99999/2026|R1",
        }
        round2 = {
            **common,
            "lula": 49,
            "flavio": 46,
            "values": {"lula": 49, "flavio": 46},
            "responses": {"blank_null": 3, "undecided": 2},
            "coverage": "complete",
            "scenario": "Lula × Flávio Bolsonaro",
            "waveId": "Test Institute|BR-99999/2026|R2",
        }
        return {"updateDate": "2026-09-23", "waves": [{"round1": round1, "round2": round2}]}

    def test_valid_pair_updates_both_feeds(self):
        raw, legacy, waves, ignored = MODULE.build_update(
            copy.deepcopy(self.raw), copy.deepcopy(self.legacy), self.new_payload()
        )
        self.assertEqual((waves, ignored), (1, 0))
        self.assertEqual(len(raw["records"]), len(self.raw["records"]) + 2)
        self.assertEqual(len(legacy["polls"]), len(self.legacy["polls"]) + 1)
        MODULE.validate_feeds(raw, legacy)

    def test_rejects_mismatched_pair(self):
        payload = self.new_payload()
        payload["waves"][0]["round2"]["sample"] = 1999
        with self.assertRaises(MODULE.ValidationError):
            MODULE.build_update(copy.deepcopy(self.raw), copy.deepcopy(self.legacy), payload)

    def test_rejects_legacy_only_divergence(self):
        legacy = copy.deepcopy(self.legacy)
        legacy["polls"][-1]["lula"] += 1
        with self.assertRaises(MODULE.ValidationError):
            MODULE.validate_feeds(copy.deepcopy(self.raw), legacy)

    def test_payload_repairs_a_matching_legacy_only_wave(self):
        payload = self.new_payload()
        legacy = copy.deepcopy(self.legacy)
        legacy["polls"].append(MODULE.legacy_from_round2(payload["waves"][0]["round2"]))

        raw, repaired_legacy, waves, ignored = MODULE.build_update(
            copy.deepcopy(self.raw), legacy, payload
        )

        self.assertEqual((waves, ignored), (1, 0))
        self.assertEqual(len(raw["records"]), len(self.raw["records"]) + 2)
        self.assertEqual(len(repaired_legacy["polls"]), len(legacy["polls"]))
        MODULE.validate_feeds(raw, repaired_legacy)

    def test_writes_both_documents(self):
        raw, legacy, _, _ = MODULE.build_update(
            copy.deepcopy(self.raw), copy.deepcopy(self.legacy), self.new_payload()
        )
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            raw_path = directory / "raw.json"
            legacy_path = directory / "legacy.json"
            MODULE.atomic_write_many([(raw_path, raw, 2), (legacy_path, legacy, 1)])
            MODULE.validate_feeds(json.loads(raw_path.read_text()), json.loads(legacy_path.read_text()))


if __name__ == "__main__":
    unittest.main()
