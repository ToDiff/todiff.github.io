#!/usr/bin/env python3
"""Build the gallery's static commit index from public GitHub PR metadata."""

import argparse
import concurrent.futures
import csv
import hashlib
import json
from pathlib import Path
import re
import tempfile
import threading
import time
import urllib.error
import urllib.request


ROOT = Path(__file__).resolve().parent.parent
PULL_REQUEST = re.compile(r"https://github\.com/[^/]+/[^/]+/pull/\d+$")
COMMIT_SHA = re.compile(r"[0-9a-f]{40}$")
REQUEST_LOCK = threading.Lock()
next_request = 0.0


def request_commits(url):
    global next_request
    for attempt in range(4):
        with REQUEST_LOCK:
            delay = max(0, next_request - time.monotonic())
            next_request = max(next_request, time.monotonic()) + 0.35
        time.sleep(delay)
        request = urllib.request.Request(
            url + "/commits",
            headers={"Accept": "application/json", "User-Agent": "RPIB-study-commit-index"},
        )
        try:
            with urllib.request.urlopen(request, timeout=25) as response:
                payload = json.load(response)
            route = payload["payload"]["pullRequestsCommitsRoute"]
            commits = [commit["oid"] for group in route["commitGroups"] for commit in group["commits"]]
            if not commits or any(not COMMIT_SHA.fullmatch(sha) for sha in commits):
                raise ValueError("No valid commit list in PR metadata")
            return commits
        except (urllib.error.URLError, TimeoutError, KeyError, ValueError) as error:
            if attempt == 3:
                raise RuntimeError(str(error)) from error
            retry_after = error.headers.get("Retry-After", "") if isinstance(error, urllib.error.HTTPError) else ""
            time.sleep(max(2 ** (attempt + 1), int(retry_after) if retry_after.isdigit() else 0))


def required_commits(csv_path):
    with csv_path.open(encoding="utf-8-sig", newline="") as stream:
        rows = csv.reader(stream)
        headers = [re.sub(r"\s+", " ", header).strip() for header in next(rows)]
        link_column = headers.index("link")
        commit_column = next(index for index, header in enumerate(headers) if header.lower().startswith("commit"))
        needed = {}
        for row in rows:
            if not any(value.strip() for value in row):
                continue
            url = row[link_column].strip()
            value = row[commit_column].strip() or "1"
            if value and PULL_REQUEST.fullmatch(url):
                maximum = max(int(ordinal.strip()) for ordinal in value.split("+"))
                needed[url] = max(needed.get(url, 0), maximum)
        return needed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", type=Path, default=ROOT / "static/bug/rpib-study.csv")
    parser.add_argument("--output", type=Path, default=ROOT / "static/bug/rpib-commit-links.json")
    parser.add_argument("--cache", type=Path, default=Path(tempfile.gettempdir()) / "rpib-commit-index-cache")
    args = parser.parse_args()
    needed = required_commits(args.csv)
    args.cache.mkdir(parents=True, exist_ok=True)
    existing = json.loads(args.output.read_text()) if args.output.exists() else {}

    def resolve(item):
        url, maximum = item
        cached = args.cache / (hashlib.sha256(url.encode()).hexdigest() + ".json")
        commits = json.loads(cached.read_text()) if cached.exists() else existing.get(url, [])
        if not commits or (not cached.exists() and len(commits) < maximum) or any(not COMMIT_SHA.fullmatch(sha) for sha in commits):
            commits = request_commits(url)
            cached.write_text(json.dumps(commits) + "\n")
        return url, commits

    results = {}
    failures = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        pending = {executor.submit(resolve, item): item[0] for item in needed.items()}
        for number, future in enumerate(concurrent.futures.as_completed(pending), 1):
            url = pending[future]
            try:
                url, commits = future.result()
                results[url] = commits
            except Exception as error:
                failures.append({"url": url, "error": str(error)})
                print(json.dumps({"failed": failures[-1]}), flush=True)
            if number % 50 == 0 or number == len(pending):
                print(json.dumps({"processed": number, "total": len(pending), "resolved": len(results)}), flush=True)
    if failures:
        raise SystemExit(f"{len(failures)} PRs could not be resolved; successful requests are cached for a retry.")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(dict(sorted(results.items())), indent=2) + "\n")
    temporary.replace(args.output)
    unavailable = [url for url, maximum in needed.items() if len(results[url]) < maximum]
    print(json.dumps({"output": str(args.output), "pull_requests": len(results), "prs_with_unavailable_ordinals": len(unavailable)}))


if __name__ == "__main__":
    main()
