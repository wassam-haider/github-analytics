import os
import urllib.parse
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, sum, count, avg, current_timestamp, round, expr, max, min

# We need the PostgreSQL JDBC driver for PySpark
os.environ['PYSPARK_SUBMIT_ARGS'] = '--packages org.postgresql:postgresql:42.6.0 pyspark-shell'

def get_jdbc_url_and_properties():
    # Fallback to the provided connection string if not in env
    database_url = os.environ.get("DATABASE_URL", "postgresql://neondb_owner:npg_vDo51mBiPWMu@ep-soft-fire-at2q1e9e-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require")
    
    parsed = urllib.parse.urlparse(database_url)
    
    # Construct JDBC URL
    jdbc_url = f"jdbc:postgresql://{parsed.hostname}:{parsed.port or 5432}{parsed.path}?sslmode=require"
    
    properties = {
        "user": parsed.username,
        "password": parsed.password,
        "driver": "org.postgresql.Driver"
    }
    
    return jdbc_url, properties

def main():
    print("Initializing Spark Session...")
    spark = SparkSession.builder \
        .appName("GitHubAnalyticsETL") \
        .config("spark.jars.packages", "org.postgresql:postgresql:42.6.0") \
        .getOrCreate()
        
    spark.sparkContext.setLogLevel("ERROR")

    jdbc_url, properties = get_jdbc_url_and_properties()
    print("Connected to PostgreSQL via JDBC.")

    # 1. Load Data
    print("Loading data from database...")
    def load_table(table_name):
        return spark.read.jdbc(url=jdbc_url, table=table_name, properties=properties)

    try:
        repos_df = load_table("repositories")
        contributors_df = load_table("contributors")
        commits_df = load_table("commits")
        prs_df = load_table("pull_requests")
        issues_df = load_table("issues")
    except Exception as e:
        print(f"Error loading tables (they might be empty or missing): {e}")
        return

    # Cache tables to improve performance
    repos_df.cache()
    contributors_df.cache()
    commits_df.cache()
    prs_df.cache()
    issues_df.cache()

    # 2. Analytics 1: Language Stats
    print("Computing Language Stats...")
    language_stats = repos_df.filter(col("language").isNotNull()) \
        .groupBy("language") \
        .agg(count("*").alias("repo_count")) \
        .withColumn("computed_at", current_timestamp())

    # 3. Analytics 2: Top Contributors
    print("Computing Contributor Rankings...")
    contributor_rankings = contributors_df.groupBy("username") \
        .agg(sum("contributions").alias("total_contributions")) \
        .withColumn("computed_at", current_timestamp())

    # 4. Analytics 3: Most Active Repositories
    print("Computing Repository Activity...")
    repo_activity = commits_df.groupBy("repo_id") \
        .agg(count("*").alias("commit_count")) \
        .withColumn("computed_at", current_timestamp())

    # 5. Analytics 4: Issue Resolution Time
    print("Computing Issue Resolution Stats...")
    # Calculate duration in days (closed_at - created_at)
    resolved_issues = issues_df.filter(col("closed_at").isNotNull()) \
        .withColumn("resolution_days", 
                    (col("closed_at").cast("long") - col("created_at").cast("long")) / (24 * 3600))

    issue_resolution_stats = resolved_issues.groupBy("repo_id") \
        .agg(
            round(avg("resolution_days"), 2).alias("avg_resolution_days"),
            round(min("resolution_days"), 2).alias("fastest_resolution_days"),
            round(max("resolution_days"), 2).alias("slowest_resolution_days")
        ) \
        .withColumn("computed_at", current_timestamp())

    # 6. Analytics 5: Pull Request Success Rate
    print("Computing PR Success Rates...")
    pr_stats = prs_df.groupBy("repo_id").agg(
        count("*").alias("total_prs"),
        sum(expr("case when merged_at is not null then 1 else 0 end")).alias("merged_prs")
    )
    pr_success_rates = pr_stats.withColumn(
        "success_rate", round(col("merged_prs") / col("total_prs") * 100, 2)
    ).withColumn("computed_at", current_timestamp())

    # 7. Advanced Analytics: Productivity Score (per contributor)
    # Score = (Commits * 0.5) + (PRs * 0.3) + (Issues Closed * 0.2)
    print("Computing Contributor Scores...")
    # Since commits table only has 'author' (which might be username or name) and contributors table has 'username'
    # We will estimate PRs and Issues per user if possible, but the schema doesn't link users directly to PRs/Issues.
    # We will use the 'contributors' table 'contributions' field as a proxy for total commits/PRs 
    # to synthesize a score if direct tables lack username links. 
    # Wait, the schema for PRs/Issues has no 'username'. Commits has 'author'.
    # We'll use 'contributions' from contributors table directly for score to keep it simple:
    # Let's say Score = total_contributions * 1.0 (since we lack PR/Issue author data in the schema)
    # Alternatively, aggregate commits by author:
    author_commits = commits_df.groupBy("author").agg(count("*").alias("commit_count"))
    
    # We will compute a basic score = total_contributions * 1.5 + (commits * 0.5) if they match
    contributor_scores = contributor_rankings.join(
        author_commits, contributor_rankings.username == author_commits.author, "left"
    ).withColumn(
        "score", 
        round(col("total_contributions") * 0.5 + expr("coalesce(commit_count, 0)") * 0.5, 2)
    ).select(
        col("username"), col("total_contributions"), expr("coalesce(commit_count, 0)").alias("commit_count"), col("score")
    ).withColumn("computed_at", current_timestamp())


    # 8. Advanced Analytics: Repository Health Score
    print("Computing Repository Health Scores...")
    # Health Score = Stars Growth + PR Success Rate + Issue Resolution Speed
    # We don't have historical stars, so we use log(stars) as proxy for growth.
    # Speed is inverted (faster = higher score).
    
    repo_health_base = repos_df.select("id", "name", "stars") \
        .join(pr_success_rates, repos_df.id == pr_success_rates.repo_id, "left") \
        .join(issue_resolution_stats, repos_df.id == issue_resolution_stats.repo_id, "left")
        
    repo_health_scores = repo_health_base.withColumn(
        "health_score",
        round(
            # normalized stars proxy
            (expr("coalesce(stars, 0)") * 0.01) + 
            # PR success rate (0-100) * 0.5
            (expr("coalesce(success_rate, 50)") * 0.5) +
            # Faster resolution = better score. 30 days is base, less is better.
            (expr("case when avg_resolution_days is null then 10 when avg_resolution_days < 30 then (30 - avg_resolution_days) else 0 end"))
        , 2)
    ).select(
        repos_df.id.alias("repo_id"), "name", "health_score"
    ).withColumn("computed_at", current_timestamp())

    # 9. Write tables to Postgres
    print("Writing computed tables back to Postgres...")
    def write_table(df, table_name):
        print(f"Writing {table_name}...")
        df.write.jdbc(
            url=jdbc_url,
            table=table_name,
            mode="overwrite",
            properties=properties
        )

    write_table(language_stats, "language_stats")
    write_table(contributor_rankings, "contributor_rankings")
    write_table(repo_activity, "repo_activity")
    write_table(issue_resolution_stats, "issue_resolution_stats")
    write_table(pr_success_rates, "pr_success_rates")
    write_table(contributor_scores, "contributor_scores")
    write_table(repo_health_scores, "repo_health_scores")

    print("Spark ETL process completed successfully!")

if __name__ == "__main__":
    main()
