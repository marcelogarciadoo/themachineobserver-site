#!/usr/bin/env python3

import re
import sys
from pathlib import Path


def main() -> None:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "model-source")
    test_file = root / "research/current-model/test_current_model.py"
    source = test_file.read_text(encoding="utf-8")
    dynamic_assertion = 'self.assertEqual(len(by_poll), self.summary["polls"])'

    if dynamic_assertion not in source:
        updated, replacements = re.subn(
            r"self\.assertEqual\(len\(by_poll\),\s*\d+\)",
            dynamic_assertion,
            source,
            count=1,
        )
        if replacements != 1:
            raise SystemExit("Unable to locate the stale fixed poll-count assertion.")
        test_file.write_text(updated, encoding="utf-8")

    gate_file = root / "operations/extend_current_gate.py"
    gate = gate_file.read_text(encoding="utf-8")
    cutoff_updates = (
        'spec["cutoff"]["latest_publication_date"] = spec["inputs"]["latest_publication_date"]\n'
        'spec["cutoff"]["latest_fieldwork_end"] = spec["inputs"]["latest_fieldwork_end"]\n'
    )
    if cutoff_updates not in gate:
        anchor = 'spec["inputs"]["latest_fieldwork_end"] = max(row["end"] for row in runoff)\n'
        if gate.count(anchor) != 1:
            raise SystemExit("Unable to locate the release-cutoff update anchor.")
        gate_file.write_text(gate.replace(anchor, anchor + cutoff_updates), encoding="utf-8")

    print("Patched model bundle for dynamic poll counts and current release cutoffs.")


if __name__ == "__main__":
    main()
