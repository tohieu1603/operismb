-- Post System Tables Migration
-- Ported from post_be (MongoDB) to PostgreSQL

-- Post Categories
CREATE TABLE IF NOT EXISTS post_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES post_categories(id) ON DELETE SET NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  post_count INT DEFAULT 0,
  meta_title VARCHAR(255),
  meta_description VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Post Tags
CREATE TABLE IF NOT EXISTS post_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  post_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Post Authors
CREATE TABLE IF NOT EXISTS post_authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,
  email VARCHAR(255),
  bio TEXT,
  avatar VARCHAR(1000),
  website VARCHAR(1000),
  social_links JSONB,
  user_id UUID,
  expertise TEXT[] DEFAULT '{}',
  credentials TEXT,
  years_of_experience INT,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  post_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Posts
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  subtitle VARCHAR(500),
  slug VARCHAR(500) NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL,
  cover_image VARCHAR(1000),
  category_id UUID REFERENCES post_categories(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  view_count INT DEFAULT 0,
  author VARCHAR(255),
  author_id UUID REFERENCES post_authors(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  -- SEO Basic
  meta_title VARCHAR(255),
  meta_description VARCHAR(500),
  meta_keywords VARCHAR(500),
  canonical_url VARCHAR(1000),
  -- SEO Open Graph
  og_title VARCHAR(255),
  og_description VARCHAR(500),
  og_image VARCHAR(1000),
  -- SEO Twitter
  twitter_title VARCHAR(255),
  twitter_description VARCHAR(500),
  twitter_image VARCHAR(1000),
  -- SEO Advanced
  robots VARCHAR(100) DEFAULT 'index,follow',
  news_keywords VARCHAR(500),
  is_evergreen BOOLEAN DEFAULT false,
  -- Options
  is_featured BOOLEAN DEFAULT false,
  allow_comments BOOLEAN DEFAULT true,
  reading_time INT,
  template VARCHAR(100),
  custom_fields JSONB,
  -- Trending & Social
  is_trending BOOLEAN DEFAULT false,
  trending_rank INT CHECK (trending_rank IS NULL OR (trending_rank >= 1 AND trending_rank <= 10)),
  trending_at TIMESTAMPTZ,
  share_count INT DEFAULT 0,
  like_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,
  -- Content Structure
  content_structure JSONB,
  content_blocks JSONB,
  faq JSONB,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Post-Tag junction table
CREATE TABLE IF NOT EXISTS post_tags_relation (
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES post_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

-- Media
CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename VARCHAR(500) NOT NULL,
  original_name VARCHAR(500),
  mime_type VARCHAR(100),
  size INT,
  url VARCHAR(1000) NOT NULL,
  thumbnail_url VARCHAR(1000),
  alt_text VARCHAR(500),
  caption TEXT,
  folder VARCHAR(200),
  uploaded_by UUID,
  width INT,
  height INT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Keywords
CREATE TABLE IF NOT EXISTS keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword VARCHAR(300) NOT NULL,
  slug VARCHAR(300) NOT NULL UNIQUE,
  volume INT DEFAULT 0,
  difficulty INT DEFAULT 0,
  cpc DECIMAL(10,2) DEFAULT 0,
  category_id UUID REFERENCES post_categories(id) ON DELETE SET NULL,
  intent VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active',
  priority INT DEFAULT 0,
  notes TEXT,
  serp_features TEXT[] DEFAULT '{}',
  current_rank INT,
  target_rank INT,
  assigned_post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SEO Scores
CREATE TABLE IF NOT EXISTS seo_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  overall_score INT DEFAULT 0,
  title_score INT DEFAULT 0,
  meta_description_score INT DEFAULT 0,
  content_score INT DEFAULT 0,
  keyword_score INT DEFAULT 0,
  readability_score INT DEFAULT 0,
  technical_score INT DEFAULT 0,
  details JSONB,
  suggestions JSONB,
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SEO Logs
CREATE TABLE IF NOT EXISTS seo_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,
  entity_id TEXT NOT NULL,
  action VARCHAR(100) NOT NULL,
  field VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  performed_by UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Redirects
CREATE TABLE IF NOT EXISTS redirects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_path VARCHAR(1000) NOT NULL UNIQUE,
  target_path VARCHAR(1000) NOT NULL,
  status_code INT DEFAULT 301 CHECK (status_code IN (301, 302, 307, 308)),
  is_active BOOLEAN DEFAULT true,
  hit_count INT DEFAULT 0,
  last_hit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Page Content (static pages)
CREATE TABLE IF NOT EXISTS page_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(500),
  content TEXT,
  meta_title VARCHAR(255),
  meta_description VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dictionary
CREATE TABLE IF NOT EXISTS dictionaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term VARCHAR(300) NOT NULL,
  slug VARCHAR(300) NOT NULL UNIQUE,
  definition TEXT NOT NULL,
  category_id UUID REFERENCES post_categories(id) ON DELETE SET NULL,
  related_terms TEXT[] DEFAULT '{}',
  examples TEXT[] DEFAULT '{}',
  sources TEXT[] DEFAULT '{}',
  is_published BOOLEAN DEFAULT true,
  meta_title VARCHAR(255),
  meta_description VARCHAR(500),
  view_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Post Analytics
CREATE TABLE IF NOT EXISTS post_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  total_views INT DEFAULT 0,
  unique_views INT DEFAULT 0,
  avg_time_on_page DECIMAL(10,2) DEFAULT 0,
  bounce_rate DECIMAL(5,2) DEFAULT 0,
  scroll_depth DECIMAL(5,2) DEFAULT 0,
  shares JSONB DEFAULT '{}',
  referrers JSONB DEFAULT '{}',
  devices JSONB DEFAULT '{}',
  countries JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id)
);

-- Post Daily Stats
CREATE TABLE IF NOT EXISTS post_daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  views INT DEFAULT 0,
  unique_views INT DEFAULT 0,
  avg_time DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, date)
);

-- Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id TEXT,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index Status (Google indexing)
CREATE TABLE IF NOT EXISTS index_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url VARCHAR(1000) NOT NULL UNIQUE,
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'unknown',
  last_crawled_at TIMESTAMPTZ,
  last_indexed_at TIMESTAMPTZ,
  coverage_state VARCHAR(100),
  indexing_state VARCHAR(100),
  robots_txt_state VARCHAR(100),
  page_fetch_state VARCHAR(100),
  referring_urls JSONB,
  sitemap_urls JSONB,
  mobile_usability JSONB,
  rich_results JSONB,
  last_checked_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category_id);
CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_featured ON posts(is_featured);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_trending ON posts(is_trending, trending_rank);
CREATE INDEX IF NOT EXISTS idx_posts_views ON posts(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_keywords_status ON keywords(status);
CREATE INDEX IF NOT EXISTS idx_keywords_category ON keywords(category_id);
CREATE INDEX IF NOT EXISTS idx_seo_scores_post ON seo_scores(post_id);
CREATE INDEX IF NOT EXISTS idx_seo_logs_entity ON seo_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_post_daily_stats_date ON post_daily_stats(post_id, date);
CREATE INDEX IF NOT EXISTS idx_media_folder ON media(folder);
CREATE INDEX IF NOT EXISTS idx_redirects_source ON redirects(source_path);

