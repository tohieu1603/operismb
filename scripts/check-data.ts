import "reflect-metadata";
import "dotenv/config";
import { DataSource } from "typeorm";

const ds = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: String(process.env.DB_PASSWORD),
  ssl: false,
  synchronize: false,
  entities: [],
});

async function main() {
  await ds.initialize();
  const cats = await ds.query("SELECT count(*) FROM post_categories");
  const tags = await ds.query("SELECT count(*) FROM post_tags");
  const authors = await ds.query("SELECT count(*) FROM post_authors");
  const posts = await ds.query("SELECT count(*) FROM posts");
  console.log("Categories:", cats[0].count);
  console.log("Tags:", tags[0].count);
  console.log("Authors:", authors[0].count);
  console.log("Posts:", posts[0].count);
  const sample = await ds.query("SELECT title, slug, status FROM posts LIMIT 3");
  console.log("Sample posts:", JSON.stringify(sample, null, 2));
  await ds.destroy();
}
main();
