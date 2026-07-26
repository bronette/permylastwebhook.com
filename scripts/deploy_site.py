#!/usr/bin/env python3
"""Deploy site-dist/ to cPanel public_html over SFTP.

Reads credentials from the gitignored .env (parsed from the hosting welcome
email). No secrets live in this file. Usage:

    python scripts/deploy_site.py --dry-run   # connect + list, write nothing
    python scripts/deploy_site.py             # upload site-dist/ -> public_html/
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko  # type: ignore

REPO = Path(__file__).resolve().parents[1]
LOCAL = REPO / "site-dist"


def load_env() -> dict:
    env = {}
    for line in (REPO / ".env").read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip()
    return env


def scan_placeholders(root: Path) -> list[tuple[str, int]]:
    """Return (file, line_no) for lines containing REPLACE-ME in text files."""
    hits: list[tuple[str, int]] = []
    for p in sorted(root.rglob("*")):
        if not p.is_file():
            continue
        if p.suffix.lower() not in {".html", ".css", ".js", ".json", ".txt", ".xml"}:
            continue
        try:
            text = p.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for i, line in enumerate(text.splitlines(), 1):
            if "REPLACE-ME" in line:
                hits.append((p.relative_to(root).as_posix(), i))
    return hits


def main() -> int:
    dry = "--dry-run" in sys.argv
    if not LOCAL.is_dir():
        print("site-dist/ missing — run `npm run site:build` first.")
        return 1

    placeholder_hits = scan_placeholders(LOCAL)
    if placeholder_hits and not dry:
        print("Refusing to deploy: unresolved REPLACE-ME placeholders in site-dist/:")
        for rel, line in placeholder_hits[:20]:
            print(f"  {rel}:{line}")
        if len(placeholder_hits) > 20:
            print(f"  … and {len(placeholder_hits) - 20} more")
        print("\nFill INSTALL_URL and API_BASE_URL in site/config.json, then npm run site:build.")
        return 1
    if placeholder_hits and dry:
        print(f"Warning: {len(placeholder_hits)} REPLACE-ME placeholder line(s) in site-dist/ (deploy would fail).")

    env = load_env()
    host = env["CPANEL_HOST"]
    port = int(env.get("CPANEL_SFTP_PORT", "21098"))
    user = env["CPANEL_USER"]
    pw = env["CPANEL_PASSWORD"]
    remote_root = env.get("CPANEL_REMOTE_DIR", "public_html").rstrip("/")

    files = sorted(p for p in LOCAL.rglob("*") if p.is_file())
    print(f"Local: {len(files)} files under site-dist/")
    print(f"Target: {user}@{host}:{port}  ->  {remote_root}/")
    if dry:
        for p in files:
            print(f"  would upload  {p.relative_to(LOCAL)}  ->  {remote_root}/{p.relative_to(LOCAL)}")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, port=port, username=user, password=pw, timeout=30,
                allow_agent=False, look_for_keys=False)
    sftp = ssh.open_sftp()
    print("Connected OK.")

    def ensure_dir(remote: str) -> None:
        # Build HOME-RELATIVE paths (no leading slash) — public_html is under
        # the SFTP user's home, not the filesystem root.
        cur = ""
        for part in remote.strip("/").split("/"):
            cur = part if not cur else f"{cur}/{part}"
            try:
                sftp.stat(cur)
            except FileNotFoundError:
                if not dry:
                    sftp.mkdir(cur)

    # Resolve remote_root to absolute (cPanel home-relative paths work as-is).
    sent = 0
    for p in files:
        rel = p.relative_to(LOCAL).as_posix()
        dest = f"{remote_root}/{rel}"
        if "/" in rel:
            ensure_dir(f"{remote_root}/{rel.rsplit('/', 1)[0]}")
        if dry:
            continue
        sftp.put(str(p), dest)
        sent += 1
        print(f"  uploaded  {rel}")
    sftp.close()
    ssh.close()
    print(f"{'DRY RUN — nothing written.' if dry else f'Done: {sent} files uploaded to {remote_root}/.'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
