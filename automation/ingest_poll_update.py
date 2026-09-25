#!/usr/bin/env python3
"""Atomically add verified poll waves to both Observer raw feeds.

The research worker supplies a JSON payload. This command validates the full
result before replacing either file; Git then publishes both files in one
commit. It never calculates or publishes adjusted/model output.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import tempfile
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any


REGISTRATION_RE = re.compile(r"^BR-\d{5}/\d{4}$")
NUMERIC_ID_RE = re.compile(r"^RAW-R([12])-(\d+)$")
EXISTING_ID_RE = re.compile(r"^RAW-R([12])-(?:\d+|W\d+)$")
REQUIRED_COMMON = {
    "pollster",
    "start",
    "end",
    "published",
    "sample",
    "moe",
    "registration",
    "source",
}


class ValidationError(ValueError):
    pass


def load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValidationError(f"{path}: expected a JSON object")
    return value


def iso_date(value: Any, field: str) -> date:
    if not isinstance(value, str):
        raise ValidationError(f"{field}: expected YYYY-MM-DD")
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValidationError(f"{field}: invalid date {value!r}") from exc


def validate_percent(value: Any, field: str, *, allow_null: bool = True) -> None:
    if value is None and allow_null:
        return
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValidationError(f"{field}: expected a number or null")
    if not 0 <= value <= 100:
        raise ValidationError(f"{field}: percentage outside 0–100")


def validate_record(record: dict[str, Any], expected_round: int | None = None) -> None:
    missing = REQUIRED_COMMON - record.keys()
    if missing:
        raise ValidationError(f"record missing fields: {sorted(missing)}")
    round_number = record.get("round")
    if round_number not in (1, 2):
        raise ValidationError("record.round must be 1 or 2")
    if expected_round is not None and round_number != expected_round:
        raise ValidationError(f"expected round {expected_round}, received {round_number}")
    registration = record["registration"]
    if not isinstance(registration, str) or not REGISTRATION_RE.fullmatch(registration):
        raise ValidationError(f"invalid normalized registration: {registration!r}")
    start = iso_date(record["start"], "start")
    end = iso_date(record["end"], "end")
    published = iso_date(record["published"], "published")
    if not start <= end <= published:
        raise ValidationError("dates must satisfy start <= end <= published")
    sample = record["sample"]
    if isinstance(sample, bool) or not isinstance(sample, int) or sample <= 0:
        raise ValidationError("sample must be a positive integer")
    validate_percent(record["moe"], "moe", allow_null=False)
    validate_percent(record.get("confidence"), "confidence")
    for group in ("values", "responses"):
        values = record.get(group, {})
        if not isinstance(values, dict):
            raise ValidationError(f"{group} must be an object")
        for key, value in values.items():
            validate_percent(value, f"{group}.{key}")
    if round_number == 2:
        for candidate in ("lula", "flavio"):
            validate_percent(record.get(candidate), candidate, allow_null=False)
            if record.get("values", {}).get(candidate) != record[candidate]:
                raise ValidationError(f"round-2 values.{candidate} must equal {candidate}")
    wave_id = record.get("waveId")
    if not isinstance(wave_id, str) or not wave_id.endswith(f"|R{round_number}"):
        raise ValidationError(f"waveId must end in |R{round_number}")
    record_id = record.get("id")
    if record_id is not None:
        match = EXISTING_ID_RE.fullmatch(str(record_id))
        if not match or int(match.group(1)) != round_number:
            raise ValidationError(f"invalid record id for round {round_number}: {record_id!r}")


def next_id(records: list[dict[str, Any]], round_number: int) -> str:
    numbers = []
    for record in records:
        match = NUMERIC_ID_RE.fullmatch(str(record.get("id", "")))
        if match and int(match.group(1)) == round_number:
            numbers.append(int(match.group(2)))
    return f"RAW-R{round_number}-{max(numbers, default=0) + 1:03d}"


def insert_raw_record(records: list[dict[str, Any]], record: dict[str, Any]) -> None:
    if record["round"] == 2:
        records.append(record)
        return
    # New, fully audited first-round waves live before inherited RAW-R1-W… rows.
    index = next(
        (i for i, current in enumerate(records) if str(current.get("id", "")).startswith("RAW-R1-W")),
        next((i for i, current in enumerate(records) if current.get("round") == 2), len(records)),
    )
    records.insert(index, record)


def legacy_from_round2(record: dict[str, Any]) -> dict[str, Any]:
    return {
        key: record[key]
        for key in (
            "pollster",
            "start",
            "end",
            "published",
            "lula",
            "flavio",
            "sample",
            "moe",
            "registration",
            "source",
        )
    }


def validate_feeds(raw: dict[str, Any], legacy: dict[str, Any]) -> None:
    records = raw.get("records")
    polls = legacy.get("polls")
    ignored = legacy.get("ignored", [])
    if raw.get("schemaVersion") != 1 or not isinstance(records, list):
        raise ValidationError("raw feed schema is invalid")
    if legacy.get("version") != 1 or not isinstance(polls, list) or not isinstance(ignored, list):
        raise ValidationError("legacy feed schema is invalid")

    ids: set[str] = set()
    round2_by_key: dict[tuple[str, str, str], dict[str, Any]] = {}
    rounds_by_registration: dict[str, set[int]] = {}
    for record in records:
        if not isinstance(record, dict):
            raise ValidationError("raw record must be an object")
        validate_record(record)
        record_id = str(record.get("id", ""))
        if not record_id or record_id in ids:
            raise ValidationError(f"missing or duplicate raw id: {record_id!r}")
        ids.add(record_id)
        registration = record["registration"]
        rounds_by_registration.setdefault(registration, set()).add(record["round"])
        if record["round"] == 2:
            key = (registration, record["published"], record["pollster"])
            round2_by_key[key] = record

    for poll in polls:
        if not isinstance(poll, dict):
            raise ValidationError("legacy poll must be an object")
        missing = REQUIRED_COMMON - poll.keys()
        if missing:
            raise ValidationError(f"legacy poll missing fields: {sorted(missing)}")
        start = iso_date(poll["start"], "legacy.start")
        end = iso_date(poll["end"], "legacy.end")
        published = iso_date(poll["published"], "legacy.published")
        if not start <= end <= published:
            raise ValidationError("legacy dates must satisfy start <= end <= published")
        for field in ("lula", "flavio", "moe"):
            validate_percent(poll[field], f"legacy.{field}", allow_null=False)
        key = (poll["registration"], poll["published"], poll["pollster"])
        raw_poll = round2_by_key.get(key)
        if raw_poll is None:
            raise ValidationError(f"legacy runoff has no matching raw round-2 record: {key}")
        for field in ("lula", "flavio", "sample", "moe"):
            if poll[field] != raw_poll[field]:
                raise ValidationError(f"legacy/raw mismatch for {key}: {field}")

    legacy_keys = {(p["registration"], p["published"], p["pollster"]) for p in polls}
    missing_legacy = set(round2_by_key) - legacy_keys
    if missing_legacy:
        raise ValidationError(f"raw round-2 records missing from legacy feed: {sorted(missing_legacy)}")


def build_update(
    raw: dict[str, Any], legacy: dict[str, Any], payload: dict[str, Any]
) -> tuple[dict[str, Any], dict[str, Any], int, int]:
    waves = payload.get("waves", [])
    ignored = payload.get("ignored", [])
    if not isinstance(waves, list) or not isinstance(ignored, list) or not waves and not ignored:
        raise ValidationError("payload must contain non-empty waves and/or ignored arrays")
    records = raw["records"]
    existing_ids = {record.get("id") for record in records}
    existing_round_registration = {
        (record.get("round"), record.get("registration")) for record in records
    }
    added_waves = 0

    for wave in waves:
        if not isinstance(wave, dict):
            raise ValidationError("each wave must be an object")
        round1 = wave.get("round1")
        round2 = wave.get("round2")
        if not isinstance(round1, dict) or not isinstance(round2, dict):
            raise ValidationError("each wave requires round1 and round2 objects")
        round1 = dict(round1)
        round2 = dict(round2)
        for number, record in ((1, round1), (2, round2)):
            record["round"] = number
            expected_id = next_id(records, number)
            if not record.get("id"):
                record["id"] = expected_id
            validate_record(record, number)
            if not NUMERIC_ID_RE.fullmatch(str(record["id"])):
                raise ValidationError(f"new record id must be numeric: {record['id']!r}")
            if record["id"] != expected_id:
                raise ValidationError(
                    f"new round-{number} id must monotonically extend to {expected_id}"
                )
            if record["id"] in existing_ids:
                raise ValidationError(f"duplicate raw id: {record['id']}")
            if (number, record["registration"]) in existing_round_registration:
                raise ValidationError(
                    f"registration already present for round {number}: {record['registration']}"
                )
        shared = ("registration", "pollster", "start", "end", "published", "sample", "moe", "source")
        for field in shared:
            if round1[field] != round2[field]:
                raise ValidationError(f"round pair differs on {field}")
        for record in (round1, round2):
            insert_raw_record(records, record)
            existing_ids.add(record["id"])
            existing_round_registration.add((record["round"], record["registration"]))
        legacy_poll = legacy_from_round2(round2)
        legacy_key = (
            legacy_poll["registration"],
            legacy_poll["published"],
            legacy_poll["pollster"],
        )
        existing_legacy = next(
            (
                poll
                for poll in legacy["polls"]
                if (
                    poll.get("registration"),
                    poll.get("published"),
                    poll.get("pollster"),
                )
                == legacy_key
            ),
            None,
        )
        if existing_legacy is None:
            legacy["polls"].append(legacy_poll)
        else:
            for field in ("lula", "flavio", "sample", "moe"):
                if existing_legacy.get(field) != legacy_poll[field]:
                    raise ValidationError(
                        f"existing legacy runoff conflicts with payload for {legacy_key}: {field}"
                    )
        added_waves += 1

    ignored_count = 0
    ignored_regs = {
        item.get("registration") for item in legacy.get("ignored", []) if isinstance(item, dict)
    }
    for item in ignored:
        if not isinstance(item, dict):
            raise ValidationError("each ignored entry must be an object")
        registration = item.get("registration")
        reason = item.get("reason")
        if not isinstance(registration, str) or not REGISTRATION_RE.fullmatch(registration):
            raise ValidationError(f"invalid ignored registration: {registration!r}")
        if not isinstance(reason, str) or not reason.strip():
            raise ValidationError("ignored entry requires a reason")
        if registration not in ignored_regs:
            legacy["ignored"].append({"registration": registration, "reason": reason.strip()})
            ignored_regs.add(registration)
            ignored_count += 1

    update_date = payload.get("updateDate") or datetime.now(timezone.utc).date().isoformat()
    iso_date(update_date, "updateDate")
    raw["generatedAt"] = payload.get("generatedAt") or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    legacy["updated"] = update_date
    legacy["polls"].sort(key=lambda p: (p["published"], p.get("pollster", ""), p["registration"]))
    validate_feeds(raw, legacy)
    return raw, legacy, added_waves, ignored_count


def atomic_write_many(documents: list[tuple[Path, dict[str, Any], int]]) -> None:
    temporary: list[tuple[Path, Path]] = []
    try:
        for target, value, indent in documents:
            target.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(
                "w", encoding="utf-8", dir=target.parent, delete=False
            ) as handle:
                json.dump(value, handle, ensure_ascii=False, indent=indent)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
                temporary.append((Path(handle.name), target))
        for source, target in temporary:
            os.replace(source, target)
    finally:
        for source, _ in temporary:
            source.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw", type=Path, default=Path("data/raw-polls.json"))
    parser.add_argument("--legacy", type=Path, default=Path("data/polls.json"))
    parser.add_argument("--payload", type=Path)
    parser.add_argument("--check-only", action="store_true")
    args = parser.parse_args()

    raw = load_json(args.raw)
    legacy = load_json(args.legacy)
    if args.check_only:
        validate_feeds(raw, legacy)
        print(f"OK: {len(raw['records'])} raw records; {len(legacy['polls'])} legacy runoffs")
        return 0
    if args.payload is None:
        parser.error("--payload is required unless --check-only is used")
    payload = load_json(args.payload)
    raw, legacy, waves, ignored = build_update(raw, legacy, payload)
    atomic_write_many([(args.raw, raw, 2), (args.legacy, legacy, 1)])
    print(f"OK: added {waves} poll wave(s), {ignored} ignored registration(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
