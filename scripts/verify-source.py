#!/usr/bin/env python3
"""Verify the preserved source snapshot without running a build or the application."""
from pathlib import Path
import hashlib
import json
import sys

root = Path(__file__).resolve().parents[1]
snapshot = json.loads((root / "docs/source-snapshot.json").read_text())
entries = snapshot.get("preserved_files", snapshot["assets"] + snapshot["android_sources"])
errors = []
for item in entries:
    path = root / item["path"]
    if not path.is_file():
        errors.append("Missing: " + item["path"])
    elif hashlib.sha256(path.read_bytes()).hexdigest() != item["sha256"]:
        errors.append("Changed from original snapshot: " + item["path"])
for required in ["output/jarvis-android/AndroidManifest.xml", "output/jarvis-android/build-apk.sh", "scripts/build-local.sh", "README.md", "config/signing.example.env"]:
    if not (root / required).is_file():
        errors.append("Missing: " + required)
if errors:
    print("\n".join(errors))
    sys.exit(1)
print(f"OK: {len(entries)} preserved source/resource files; {len(snapshot['assets'])} exact APK assets.")
print("Static verification only. No APK built; no application or backend executed.")
