/**
 * One-time script: Drop & recreate post system tables from TypeORM entities
 */
import "reflect-metadata";
import "dotenv/config";
import { DataSource } from "typeorm";
import { PostCategoryEntity } from "../src/db/entities/post-category.entity";
import { PostTagEntity } from "../src/db/entities/post-tag.entity";
import { PostAuthorEntity } from "../src/db/entities/post-author.entity";
import { PostEntity } from "../src/db/entities/post.entity";
import { MediaEntity } from "../src/db/entities/media.entity";
import { KeywordEntity } from "../src/db/entities/keyword.entity";
import { SeoScoreEntity } from "../src/db/entities/seo-score.entity";
import { SeoLogEntity } from "../src/db/entities/seo-log.entity";
import { RedirectEntity } from "../src/db/entities/redirect.entity";
import { PageContentEntity } from "../src/db/entities/page-content.entity";
import { DictionaryEntity } from "../src/db/entities/dictionary.entity";
import { PostAnalyticsEntity, PostDailyStatsEntity } from "../src/db/entities/post-analytics.entity";
import { ActivityLogEntity } from "../src/db/entities/activity-log.entity";
import { IndexStatusEntity } from "../src/db/entities/index-status.entity";

const entities = [
  PostCategoryEntity, PostTagEntity, PostAuthorEntity, PostEntity,
  MediaEntity, KeywordEntity, SeoScoreEntity, SeoLogEntity,
  RedirectEntity, PageContentEntity, DictionaryEntity,
  PostAnalyticsEntity, PostDailyStatsEntity,
  ActivityLogEntity, IndexStatusEntity,
];

const ds = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: String(process.env.DB_PASSWORD),
  ssl: false,
  synchronize: false,
  entities,
});

async function main() {
  await ds.initialize();
  console.log("Connected to DB");

  // Drop post tables in correct FK order
  const tables = [
    "post_daily_stats", "post_analytics", "index_statuses", "activity_logs",
    "seo_scores", "seo_logs", "keywords", "dictionaries", "redirects", "page_contents",
    "media", "posts_tags_relation", "post_tags_relation", "posts", "post_authors", "post_tags", "post_categories",
  ];
  for (const t of tables) {
    await ds.query(`DROP TABLE IF EXISTS "${t}" CASCADE`);
    console.log("Dropped:", t);
  }

  // Sync creates tables from entities
  await ds.synchronize();
  console.log("DONE: All post tables recreated from entities!");
  await ds.destroy();
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
