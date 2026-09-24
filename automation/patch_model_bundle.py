#!/usr/bin/env python3

import re
import sys
from pathlib import Path


def main() -> None:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "model-source")
    test_file = root / "research/current-model/test_current_model.py"
    source = test_file.read_text(encoding="utf-8")
    dynamic_assertion = 'self.assertEqual(len(by_poll), self.summary["polls"])'

    if dynamic_assertion in source:
        print("Model bundle already uses the dynamic poll-count assertion.")
        return

    updated, replacements = re.subn(
        r"self\.assertEqual\(len\(by_poll\),\s*\d+\)",
        dynamic_assertion,
        source,
        count=1,
    )
    if replacements != 1:
        raise SystemExit("Unable to locate the stale fixed poll-count assertion.")

    test_file.write_text(updated, encoding="utf-8")
    print("Patched model bundle to validate the current poll count dynamically.")


if __name__ == "__main__":
    main()
