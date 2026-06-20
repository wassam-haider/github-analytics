-- Run this once in the Neon SQL editor (or via psql) to create your tables

CREATE TABLE IF NOT EXISTS repositories (
    id BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    full_name TEXT UNIQUE NOT NULL,
    stars INT,
    forks INT,
    watchers INT,
    open_issues INT,
    language TEXT,
    created_at TIMESTAMP,
    collected_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contributors (
    id SERIAL PRIMARY KEY,
    repo_id BIGINT REFERENCES repositories(id),
    username TEXT NOT NULL,
    contributions INT,
    collected_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (repo_id, username)
);

CREATE TABLE IF NOT EXISTS commits (
    id SERIAL PRIMARY KEY,
    repo_id BIGINT REFERENCES repositories(id),
    sha TEXT UNIQUE,
    author TEXT,
    commit_date TIMESTAMP,
    message TEXT,
    collected_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pull_requests (
    id BIGINT PRIMARY KEY,
    repo_id BIGINT REFERENCES repositories(id),
    status TEXT,
    created_at TIMESTAMP,
    closed_at TIMESTAMP,
    merged_at TIMESTAMP,
    collected_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS issues (
    id BIGINT PRIMARY KEY,
    repo_id BIGINT REFERENCES repositories(id),
    status TEXT,
    created_at TIMESTAMP,
    closed_at TIMESTAMP,
    collected_at TIMESTAMP DEFAULT NOW()
);

-- Helpful indexes for joins/aggregations later
CREATE INDEX IF NOT EXISTS idx_contributors_repo ON contributors(repo_id);
CREATE INDEX IF NOT EXISTS idx_commits_repo ON commits(repo_id);
CREATE INDEX IF NOT EXISTS idx_pulls_repo ON pull_requests(repo_id);
CREATE INDEX IF NOT EXISTS idx_issues_repo ON issues(repo_id);