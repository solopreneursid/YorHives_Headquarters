#!/usr/bin/env python3
"""Install vetted release binaries into a local, ignored directory.

Never installs system-wide, executes an installer downloaded from the internet,
or grants repository/API write access.
Requires network access to api.github.com and the release asset host.
"""
from __future__ import annotations

import hashlib
import io
import json
import os
from pathlib import Path
import platform
import re
import shutil
import stat
import sys
import tarfile
import tempfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / ".review-tools" / "bin"
TOOLS = {
    "reviewdog": ("reviewdog/reviewdog", "v0.21.3"),
    "betterleaks": ("betterleaks/betterleaks", "v1.10.1"),
    "trivy": ("aquasecurity/trivy", "v0.76.2"),
}

def get(url: str, limit: int) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "YorpHives-readonly-review-installer/1.0", "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req, timeout=80) as response:
        # The download may follow GitHub's signed release-asset redirect.
        final = response.geturl()
        if not final.lower().startswith("https://"):
            raise RuntimeError("Refusing non-HTTPS download")
        total = 0
        chunks = []
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > limit:
                raise RuntimeError("Download exceeded size limit")
            chunks.append(chunk)
    return b"".join(chunks)

def choose_asset(assets: list[dict]) -> dict:
    candidates = []
    for asset in assets:
        name = asset.get("name", "").lower()
        if (
            (name.endswith(".tar.gz") or name.endswith(".zip"))
            and "linux" in name
            and re.search(r"(?:x86_64|amd64|64bit|x64)", name)
            and not re.search(r"arm|aarch64|32bit|386|ppc|s390", name)
        ):
            candidates.append(asset)
    if len(candidates) != 1:
        raise RuntimeError("Expected exactly one Linux x86-64 release archive, got " + ", ".join(a.get("name", "") for a in candidates))
    return candidates[0]

def extract_executable(archive: bytes, name: str, filename: str) -> bytes:
    # Read only the exact binary; do not extract untrusted archive paths.
    if filename.endswith(".zip"):
        with zipfile.ZipFile(io.BytesIO(archive)) as zf:
            entries = [(e.filename, e) for e in zf.infolist() if e.filename.rsplit("/", 1)[-1] == name and not e.is_dir()]
            if len(entries) != 1:
                raise RuntimeError("Expected one executable inside zip: " + name)
            with zf.open(entries[0][1]) as handle:
                return handle.read(140_000_001)
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as tf:
        entries = [e for e in tf.getmembers() if e.name.rsplit("/", 1)[-1] == name and e.isfile()]
        if len(entries) != 1:
            raise RuntimeError("Expected one executable inside tar archive: " + name)
        with tf.extractfile(entries[0]) as handle:
            return handle.read(140_000_001)

def install(name: str, repo: str, tag: str) -> None:
    metadata = json.loads(get("https://api.github.com/repos/" + repo + "/releases/tags/" + tag, 3_000_000))
    if metadata.get("tag_name") != tag:
        raise RuntimeError("Release tag mismatch")
    asset = choose_asset(metadata["assets"])
    url = asset.get("browser_download_url", "")
    if not url.startswith("https://github.com/" + repo + "/releases/download/" + tag + "/"):
        raise RuntimeError("Unexpected release download URL")
    expected = asset.get("digest", "")
    if not re.fullmatch(r"sha256:[0-9a-f]{64}", expected):
        raise RuntimeError("No SHA-256 digest for " + asset["name"] + "; refusing unverified artifact")
    print(f"Downloading {repo} {tag} ({asset['name']})", flush=True)
    archive = get(url, 90_000_000)
    actual = hashlib.sha256(archive).hexdigest()
    if actual != expected.removeprefix("sha256:"):
        raise RuntimeError("Checksum mismatch; refusing " + name)
    binary = extract_executable(archive, name, asset["name"])
    if not binary or len(binary) > 140_000_000:
        raise RuntimeError("Missing or oversized executable")
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=OUT, prefix="." + name + "-", delete=False) as handle:
        temp = Path(handle.name)
        handle.write(binary)
    try:
        temp.chmod(stat.S_IRUSR | stat.S_IWUSR | stat.S_IXUSR)
        os.replace(temp, OUT / name)
    finally:
        temp.unlink(missing_ok=True)
    print("Verified SHA-256 " + actual + "; installed " + str(OUT / name), flush=True)

def main() -> int:
    if platform.system() != "Linux" or platform.machine().lower() not in ("x86_64", "amd64"):
        print("Installer currently supports Linux x86-64 only. No changes made.", file=sys.stderr)
        return 2
    names = sys.argv[1:] or list(TOOLS)
    for name in names:
        if name not in TOOLS:
            print("Unknown tool: " + name, file=sys.stderr)
            return 2
    for name in names:
        try:
            install(name, *TOOLS[name])
        except Exception as exc:
            print(name + " installation failed: " + str(exc), file=sys.stderr)
            return 1
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
