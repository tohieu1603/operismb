-- Cart items: stores user cart with product_slug + quantity
CREATE TABLE IF NOT EXISTS cart_items (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_slug VARCHAR(255) NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  updated_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, product_slug)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);
