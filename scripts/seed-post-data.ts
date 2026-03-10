/**
 * Seed script: Insert sample categories (10), tags (50), authors (10), posts (10)
 * Usage: npx tsx scripts/seed-post-data.ts
 */

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

async function seed() {
  await ds.initialize();
  console.log("DB connected");

  const qr = ds.createQueryRunner();

  // ── Categories (10) ──────────────────────────────────────────────────
  const categories = [
    { name: "Công nghệ", slug: "cong-nghe", description: "Tin tức công nghệ mới nhất" },
    { name: "Lập trình", slug: "lap-trinh", description: "Hướng dẫn lập trình & coding" },
    { name: "AI & Machine Learning", slug: "ai-machine-learning", description: "Trí tuệ nhân tạo và học máy" },
    { name: "DevOps", slug: "devops", description: "CI/CD, Docker, Kubernetes" },
    { name: "Mobile", slug: "mobile", description: "Phát triển ứng dụng di động" },
    { name: "Web Development", slug: "web-development", description: "Frontend & Backend web" },
    { name: "Database", slug: "database", description: "Cơ sở dữ liệu & tối ưu" },
    { name: "Security", slug: "security", description: "An ninh mạng & bảo mật" },
    { name: "Cloud Computing", slug: "cloud-computing", description: "AWS, GCP, Azure" },
    { name: "Startup & Business", slug: "startup-business", description: "Khởi nghiệp & kinh doanh tech" },
  ];

  for (const cat of categories) {
    await qr.query(
      `INSERT INTO post_categories (name, slug, description, is_active, sort_order)
       VALUES ($1, $2, $3, true, 0)
       ON CONFLICT (slug) DO NOTHING`,
      [cat.name, cat.slug, cat.description],
    );
  }
  console.log("✓ 10 categories seeded");

  // ── Tags (50) ────────────────────────────────────────────────────────
  const tags = [
    "JavaScript", "TypeScript", "Python", "Rust", "Go",
    "React", "Vue.js", "Angular", "Next.js", "Svelte",
    "Node.js", "Deno", "Bun", "Express", "NestJS",
    "PostgreSQL", "MongoDB", "Redis", "MySQL", "SQLite",
    "Docker", "Kubernetes", "Terraform", "AWS", "GCP",
    "Git", "CI/CD", "GitHub Actions", "Linux", "Nginx",
    "REST API", "GraphQL", "WebSocket", "gRPC", "Microservices",
    "ChatGPT", "Claude", "LLM", "Prompt Engineering", "RAG",
    "React Native", "Flutter", "Swift", "Kotlin", "Electron",
    "Testing", "TDD", "Performance", "SEO", "Accessibility",
  ];

  const tagColors = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c", "#e67e22"];

  for (let i = 0; i < tags.length; i++) {
    const slug = tags[i]
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    await qr.query(
      `INSERT INTO post_tags (name, slug, color, is_active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (slug) DO NOTHING`,
      [tags[i], slug, tagColors[i % tagColors.length]],
    );
  }
  console.log("✓ 50 tags seeded");

  // ── Authors (10) ─────────────────────────────────────────────────────
  const authors = [
    { name: "Nguyễn Văn An", slug: "nguyen-van-an", email: "an@example.com", job_title: "Senior Developer", company: "FPT Software", short_bio: "10 năm kinh nghiệm phát triển web" },
    { name: "Trần Thị Bình", slug: "tran-thi-binh", email: "binh@example.com", job_title: "AI Engineer", company: "VNG", short_bio: "Chuyên gia AI & ML" },
    { name: "Lê Hoàng Cường", slug: "le-hoang-cuong", email: "cuong@example.com", job_title: "DevOps Lead", company: "Tiki", short_bio: "Infrastructure & cloud specialist" },
    { name: "Phạm Minh Đức", slug: "pham-minh-duc", email: "duc@example.com", job_title: "Mobile Developer", company: "Momo", short_bio: "React Native & Flutter expert" },
    { name: "Hoàng Thị Em", slug: "hoang-thi-em", email: "em@example.com", job_title: "Frontend Lead", company: "Shopee", short_bio: "React & Next.js enthusiast" },
    { name: "Vũ Quang Phú", slug: "vu-quang-phu", email: "phu@example.com", job_title: "Backend Engineer", company: "Grab", short_bio: "Node.js & Go developer" },
    { name: "Đặng Hải Giang", slug: "dang-hai-giang", email: "giang@example.com", job_title: "Security Researcher", company: "VNPT", short_bio: "Pentester & security consultant" },
    { name: "Bùi Thanh Hà", slug: "bui-thanh-ha", email: "ha@example.com", job_title: "Data Engineer", company: "Zalo", short_bio: "Big data & analytics" },
    { name: "Ngô Văn Khang", slug: "ngo-van-khang", email: "khang@example.com", job_title: "Tech Lead", company: "Techcombank", short_bio: "Fintech & microservices architect" },
    { name: "Mai Thị Lan", slug: "mai-thi-lan", email: "lan@example.com", job_title: "Product Manager", company: "VinAI", short_bio: "AI product strategy & management" },
  ];

  for (const a of authors) {
    await qr.query(
      `INSERT INTO post_authors (name, slug, email, job_title, company, short_bio, is_active, is_featured, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, true, false, 0)
       ON CONFLICT (slug) DO NOTHING`,
      [a.name, a.slug, a.email, a.job_title, a.company, a.short_bio],
    );
  }
  console.log("✓ 10 authors seeded");

  // ── Posts (10) ────────────────────────────────────────────────────────
  // Get category & author IDs
  const catRows = await qr.query(`SELECT id, slug FROM post_categories ORDER BY created_at`);
  const authorRows = await qr.query(`SELECT id, slug FROM post_authors ORDER BY created_at`);

  if (catRows.length === 0 || authorRows.length === 0) {
    console.error("No categories or authors found — cannot seed posts");
    await ds.destroy();
    return;
  }

  const posts = [
    {
      title: "Hướng dẫn TypeScript từ A-Z cho người mới bắt đầu",
      slug: "huong-dan-typescript-tu-a-z",
      excerpt: "Tổng hợp kiến thức TypeScript cơ bản đến nâng cao, phù hợp cho developer muốn chuyển từ JavaScript sang.",
      content: `## TypeScript là gì?\n\nTypeScript là ngôn ngữ lập trình mã nguồn mở được phát triển bởi Microsoft. Nó là superset của JavaScript, bổ sung hệ thống kiểu tĩnh.\n\n## Tại sao nên dùng TypeScript?\n\n- **Type safety**: Phát hiện lỗi sớm tại compile time\n- **IDE support**: Autocomplete, refactoring tốt hơn\n- **Maintainability**: Code dễ đọc, dễ bảo trì\n\n## Cài đặt\n\n\`\`\`bash\nnpm install -g typescript\ntsc --init\n\`\`\`\n\n## Các kiểu dữ liệu cơ bản\n\n\`\`\`typescript\nlet name: string = "An";\nlet age: number = 25;\nlet isActive: boolean = true;\nlet tags: string[] = ["dev", "ts"];\n\`\`\``,
      catSlug: "lap-trinh",
      authorSlug: "nguyen-van-an",
      tags: ["TypeScript", "JavaScript", "Node.js"],
    },
    {
      title: "Xây dựng REST API với NestJS và PostgreSQL",
      slug: "xay-dung-rest-api-nestjs-postgresql",
      excerpt: "Hướng dẫn tạo REST API hoàn chỉnh với NestJS framework, TypeORM và PostgreSQL.",
      content: `## Giới thiệu NestJS\n\nNestJS là framework Node.js progressive, xây dựng trên TypeScript. Nó sử dụng kiến trúc modular, lấy cảm hứng từ Angular.\n\n## Khởi tạo project\n\n\`\`\`bash\nnpm i -g @nestjs/cli\nnest new my-api\n\`\`\`\n\n## Kết nối PostgreSQL\n\n\`\`\`typescript\nTypeOrmModule.forRoot({\n  type: 'postgresql',\n  host: 'localhost',\n  port: 5432,\n  database: 'mydb',\n})\n\`\`\``,
      catSlug: "web-development",
      authorSlug: "vu-quang-phu",
      tags: ["NestJS", "Node.js", "PostgreSQL", "REST API"],
    },
    {
      title: "ChatGPT vs Claude: So sánh chi tiết 2024",
      slug: "chatgpt-vs-claude-so-sanh-2024",
      excerpt: "Phân tích ưu nhược điểm của ChatGPT và Claude trong các tác vụ thực tế.",
      content: `## Tổng quan\n\nCả ChatGPT (OpenAI) và Claude (Anthropic) đều là các LLM hàng đầu hiện nay.\n\n## So sánh\n\n| Tiêu chí | ChatGPT | Claude |\n|----------|---------|--------|\n| Coding | Tốt | Rất tốt |\n| Văn bản dài | Trung bình | Xuất sắc |\n| Context window | 128K | 200K |\n\n## Kết luận\n\nMỗi model có thế mạnh riêng. Claude nổi bật ở coding và xử lý văn bản dài.`,
      catSlug: "ai-machine-learning",
      authorSlug: "tran-thi-binh",
      tags: ["ChatGPT", "Claude", "LLM", "Prompt Engineering"],
    },
    {
      title: "Docker cho người mới: Từ zero đến hero",
      slug: "docker-cho-nguoi-moi-zero-den-hero",
      excerpt: "Hướng dẫn Docker từ cơ bản đến triển khai production.",
      content: `## Docker là gì?\n\nDocker là nền tảng containerization cho phép đóng gói ứng dụng cùng dependencies.\n\n## Cài đặt Docker\n\n\`\`\`bash\n# macOS\nbrew install docker\n\n# Ubuntu\nsudo apt install docker.io\n\`\`\`\n\n## Dockerfile cơ bản\n\n\`\`\`dockerfile\nFROM node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nEXPOSE 3000\nCMD ["node", "dist/server.js"]\n\`\`\``,
      catSlug: "devops",
      authorSlug: "le-hoang-cuong",
      tags: ["Docker", "Kubernetes", "CI/CD", "Linux"],
    },
    {
      title: "React Native vs Flutter: Chọn framework nào cho mobile 2024?",
      slug: "react-native-vs-flutter-2024",
      excerpt: "So sánh chi tiết hai framework mobile phổ biến nhất hiện nay.",
      content: `## Tổng quan\n\nReact Native (Meta) và Flutter (Google) là hai lựa chọn hàng đầu cho cross-platform mobile.\n\n## Hiệu năng\n\nFlutter compile trực tiếp sang native code qua Dart AOT compiler. React Native dùng bridge (cũ) hoặc JSI (mới).\n\n## Ecosystem\n\nReact Native có lợi thế npm ecosystem khổng lồ. Flutter có pub.dev đang phát triển nhanh.`,
      catSlug: "mobile",
      authorSlug: "pham-minh-duc",
      tags: ["React Native", "Flutter", "Kotlin", "Swift"],
    },
    {
      title: "Tối ưu PostgreSQL: 10 tips tăng tốc query",
      slug: "toi-uu-postgresql-10-tips-tang-toc-query",
      excerpt: "Các kỹ thuật tối ưu PostgreSQL query performance cho production.",
      content: `## 1. Sử dụng EXPLAIN ANALYZE\n\n\`\`\`sql\nEXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';\n\`\`\`\n\n## 2. Index đúng cột\n\n\`\`\`sql\nCREATE INDEX idx_users_email ON users(email);\nCREATE INDEX idx_posts_status_created ON posts(status, created_at DESC);\n\`\`\`\n\n## 3. Tránh SELECT *\n\nChỉ select những cột cần thiết để giảm I/O.`,
      catSlug: "database",
      authorSlug: "bui-thanh-ha",
      tags: ["PostgreSQL", "Performance", "SQLite"],
    },
    {
      title: "OWASP Top 10: Bảo mật ứng dụng web 2024",
      slug: "owasp-top-10-bao-mat-ung-dung-web",
      excerpt: "Tổng hợp 10 lỗ hổng bảo mật phổ biến nhất và cách phòng chống.",
      content: `## 1. Injection\n\nSQL Injection, NoSQL Injection, Command Injection.\n\n**Phòng chống:**\n- Parameterized queries\n- ORM\n- Input validation\n\n## 2. Broken Authentication\n\n- Brute force\n- Session hijacking\n\n**Phòng chống:**\n- Rate limiting\n- MFA\n- Secure session management`,
      catSlug: "security",
      authorSlug: "dang-hai-giang",
      tags: ["Security", "REST API", "Testing"],
    },
    {
      title: "Next.js 15: Những thay đổi quan trọng",
      slug: "nextjs-15-nhung-thay-doi-quan-trong",
      excerpt: "Tổng hợp các tính năng mới và breaking changes trong Next.js 15.",
      content: `## Server Components mặc định\n\nTất cả component trong App Router đều là Server Components by default.\n\n## Partial Prerendering\n\nKết hợp static và dynamic rendering trong cùng một page.\n\n\`\`\`typescript\nexport default async function Page() {\n  return (\n    <>\n      <StaticHeader />\n      <Suspense fallback={<Loading />}>\n        <DynamicContent />\n      </Suspense>\n    </>\n  );\n}\n\`\`\``,
      catSlug: "web-development",
      authorSlug: "hoang-thi-em",
      tags: ["Next.js", "React", "TypeScript", "SEO"],
    },
    {
      title: "Kubernetes trên AWS EKS: Hướng dẫn triển khai",
      slug: "kubernetes-aws-eks-huong-dan-trien-khai",
      excerpt: "Step-by-step triển khai ứng dụng lên AWS EKS với Terraform.",
      content: `## Tạo EKS Cluster\n\n\`\`\`hcl\nresource "aws_eks_cluster" "main" {\n  name     = "my-cluster"\n  role_arn = aws_iam_role.eks.arn\n  version  = "1.28"\n}\n\`\`\`\n\n## Deploy ứng dụng\n\n\`\`\`yaml\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: my-app\nspec:\n  replicas: 3\n  template:\n    spec:\n      containers:\n        - name: app\n          image: my-app:latest\n\`\`\``,
      catSlug: "cloud-computing",
      authorSlug: "le-hoang-cuong",
      tags: ["Kubernetes", "AWS", "Terraform", "Docker"],
    },
    {
      title: "Microservices với Go: Kiến trúc & thực hành",
      slug: "microservices-voi-go-kien-truc-thuc-hanh",
      excerpt: "Xây dựng hệ thống microservices hiệu năng cao với Go và gRPC.",
      content: `## Tại sao Go?\n\n- Compile nhanh, binary nhỏ\n- Goroutines cho concurrency\n- Standard library mạnh\n\n## gRPC Service\n\n\`\`\`protobuf\nservice UserService {\n  rpc GetUser(GetUserRequest) returns (User);\n  rpc ListUsers(ListUsersRequest) returns (ListUsersResponse);\n}\n\`\`\`\n\n## Project structure\n\n\`\`\`\n/cmd\n  /user-service\n  /order-service\n/internal\n  /user\n  /order\n/proto\n\`\`\``,
      catSlug: "lap-trinh",
      authorSlug: "ngo-van-khang",
      tags: ["Go", "Microservices", "gRPC", "Docker"],
    },
  ];

  for (const p of posts) {
    const cat = catRows.find((c: any) => c.slug === p.catSlug);
    const author = authorRows.find((a: any) => a.slug === p.authorSlug);
    if (!cat || !author) continue;

    // Get tag IDs
    let tagsRelation: string[] = [];
    if (p.tags.length > 0) {
      const placeholders = p.tags.map((_, i) => `$${i + 1}`).join(", ");
      const tagSlugs = p.tags.map((t) =>
        t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      );
      const tagRows = await qr.query(
        `SELECT id FROM post_tags WHERE slug IN (${placeholders})`,
        tagSlugs,
      );
      tagsRelation = tagRows.map((r: any) => r.id);
    }

    await qr.query(
      `INSERT INTO posts (title, slug, excerpt, content, category_id, author_id, status, published_at, tags_relation, is_featured, allow_comments)
       VALUES ($1, $2, $3, $4, $5, $6, 'published', NOW(), $7, false, true)
       ON CONFLICT (slug) DO NOTHING`,
      [p.title, p.slug, p.excerpt, p.content, cat.id, author.id, JSON.stringify(tagsRelation)],
    );
  }
  console.log("✓ 10 posts seeded");

  await ds.destroy();
  console.log("Done!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
