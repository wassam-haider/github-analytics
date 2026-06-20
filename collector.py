"""
collector.py
Collects repository, contributor, commit, PR, and issue data from GitHub
and stores it in a PostgreSQL (Neon) database.

Environment variables required:
  GITHUB_TOKEN   - GitHub fine-grained personal access token
  DATABASE_URL   - Neon Postgres connection string
"""

import os
import sys
import time
import requests
import psycopg2
from datetime import datetime

GITHUB_TOKEN = os.environ["GITHUB_TOKEN"]
DATABASE_URL = os.environ["DATABASE_URL"]

# How many repos to process in a single run. Keep this modest per-run so
# frequent schedules (e.g. every 30 min) don't burn the 5,000 req/hour limit.
# Each repo costs ~1 (info) + up to ~12 (contributors/commits/pulls/issues pages)
# so ~13 requests/repo. REPOS_PER_RUN=20 -> ~260 requests/run, safe at 30-min cadence.
REPOS_PER_RUN = int(os.environ.get("REPOS_PER_RUN", "10"))

# Search queries used to discover repos dynamically (Phase 2 of the plan).
# Add/remove queries to widen or narrow the categories you track.
SEARCH_QUERIES = [
    "stars:>5000 language:Python",
    "stars:>5000 language:JavaScript",
    "stars:>5000 language:TypeScript",
    "stars:>5000 language:Go",
    "stars:>5000 language:Rust",
    "stars:>5000 language:Java",
    "stars:>5000 language:C++",
]

HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
}


def gh_get(url, params=None):
    """GET request with basic rate-limit handling."""
    resp = requests.get(url, headers=HEADERS, params=params)
    if resp.status_code == 403 and "rate limit" in resp.text.lower():
        reset = int(resp.headers.get("X-RateLimit-Reset", time.time() + 60))
        wait = max(reset - time.time(), 1)
        print(f"Rate limited. Sleeping {wait:.0f}s...")
        time.sleep(wait)
        return gh_get(url, params)
    resp.raise_for_status()
    return resp


def parse_dt(value):
    if not value:
        return None
    return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ")


def discover_repos(cur, limit):
    """
    Pull candidate repos from the Search API across SEARCH_QUERIES,
    skipping ones already collected in the last 6 hours (so a 30-min
    schedule doesn't just hammer the same repos every run).
    """
    cur.execute(
        """
        SELECT full_name FROM repositories
        WHERE collected_at > NOW() - INTERVAL '6 hours'
        """
    )
    recently_collected = {row[0] for row in cur.fetchall()}

    candidates = []
    seen = set()
    for query in SEARCH_QUERIES:
        if len(candidates) >= limit:
            break
        url = "https://api.github.com/search/repositories"
        data = gh_get(url, params={"q": query, "sort": "stars", "order": "desc", "per_page": 30}).json()
        for item in data.get("items", []):
            full_name = item["full_name"]
            if full_name in seen or full_name in recently_collected:
                continue
            seen.add(full_name)
            candidates.append(full_name)
            if len(candidates) >= limit:
                break
    return candidates


def collect_repo(cur, owner_repo):
    url = f"https://api.github.com/repos/{owner_repo}"
    data = gh_get(url).json()

    cur.execute(
        """
        INSERT INTO repositories (id, name, full_name, stars, forks, watchers,
                                   open_issues, language, created_at, collected_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
        ON CONFLICT (id) DO UPDATE SET
            stars = EXCLUDED.stars,
            forks = EXCLUDED.forks,
            watchers = EXCLUDED.watchers,
            open_issues = EXCLUDED.open_issues,
            collected_at = NOW()
        """,
        (
            data["id"], data["name"], data["full_name"], data["stargazers_count"],
            data["forks_count"], data["watchers_count"], data["open_issues_count"],
            data["language"], parse_dt(data["created_at"]),
        ),
    )
    return data["id"]


def collect_contributors(cur, owner_repo, repo_id):
    url = f"https://api.github.com/repos/{owner_repo}/contributors"
    page = 1
    while True:
        data = gh_get(url, params={"per_page": 100, "page": page}).json()
        if not data:
            break
        for c in data:
            cur.execute(
                """
                INSERT INTO contributors (repo_id, username, contributions, collected_at)
                VALUES (%s, %s, %s, NOW())
                ON CONFLICT (repo_id, username) DO UPDATE SET
                    contributions = EXCLUDED.contributions,
                    collected_at = NOW()
                """,
                (repo_id, c["login"], c["contributions"]),
            )
        page += 1
        if page > 5:  # safety cap; raise as needed
            break


def collect_commits(cur, owner_repo, repo_id, max_pages=3):
    url = f"https://api.github.com/repos/{owner_repo}/commits"
    page = 1
    while page <= max_pages:
        data = gh_get(url, params={"per_page": 100, "page": page}).json()
        if not data:
            break
        for c in data:
            sha = c["sha"]
            author = (c.get("commit", {}).get("author", {}) or {}).get("name")
            date = parse_dt(c.get("commit", {}).get("author", {}).get("date"))
            message = c.get("commit", {}).get("message", "")[:500]
            cur.execute(
                """
                INSERT INTO commits (repo_id, sha, author, commit_date, message, collected_at)
                VALUES (%s, %s, %s, %s, %s, NOW())
                ON CONFLICT (sha) DO NOTHING
                """,
                (repo_id, sha, author, date, message),
            )
        page += 1


def collect_pulls(cur, owner_repo, repo_id, max_pages=3):
    url = f"https://api.github.com/repos/{owner_repo}/pulls"
    page = 1
    while page <= max_pages:
        data = gh_get(url, params={"state": "all", "per_page": 100, "page": page}).json()
        if not data:
            break
        for p in data:
            cur.execute(
                """
                INSERT INTO pull_requests (id, repo_id, status, created_at, closed_at, merged_at, collected_at)
                VALUES (%s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT (id) DO UPDATE SET
                    status = EXCLUDED.status,
                    closed_at = EXCLUDED.closed_at,
                    merged_at = EXCLUDED.merged_at,
                    collected_at = NOW()
                """,
                (
                    p["id"], repo_id, p["state"], parse_dt(p["created_at"]),
                    parse_dt(p["closed_at"]), parse_dt(p["merged_at"]),
                ),
            )
        page += 1


def collect_issues(cur, owner_repo, repo_id, max_pages=3):
    url = f"https://api.github.com/repos/{owner_repo}/issues"
    page = 1
    while page <= max_pages:
        data = gh_get(url, params={"state": "all", "per_page": 100, "page": page}).json()
        if not data:
            break
        for i in data:
            if "pull_request" in i:  # issues endpoint also returns PRs, skip those
                continue
            cur.execute(
                """
                INSERT INTO issues (id, repo_id, status, created_at, closed_at, collected_at)
                VALUES (%s, %s, %s, %s, %s, NOW())
                ON CONFLICT (id) DO UPDATE SET
                    status = EXCLUDED.status,
                    closed_at = EXCLUDED.closed_at,
                    collected_at = NOW()
                """,
                (i["id"], repo_id, i["state"], parse_dt(i["created_at"]), parse_dt(i["closed_at"])),
            )
        page += 1


def main():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor()

    print(f"Discovering up to {REPOS_PER_RUN} repos to collect...")
    repos = discover_repos(cur, REPOS_PER_RUN)
    print(f"Found {len(repos)} repos this run: {repos}")

    for owner_repo in repos:
        print(f"Collecting: {owner_repo}")
        try:
            repo_id = collect_repo(cur, owner_repo)
            collect_contributors(cur, owner_repo, repo_id)
            collect_commits(cur, owner_repo, repo_id)
            collect_pulls(cur, owner_repo, repo_id)
            collect_issues(cur, owner_repo, repo_id)
            conn.commit()
            print(f"  Done: {owner_repo}")
        except Exception as e:
            conn.rollback()
            print(f"  FAILED: {owner_repo} -> {e}", file=sys.stderr)

    cur.close()
    conn.close()
    print("Collection complete.")


if __name__ == "__main__":
    main()
