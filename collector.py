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

HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
}

# Repos to track — expand this list over time or pull dynamically via Search API
REPOS = [
    "microsoft/vscode",
    "facebook/react",
    "tensorflow/tensorflow",
    "pytorch/pytorch",
    "vuejs/vue",
]


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

    for owner_repo in REPOS:
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