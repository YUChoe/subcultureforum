-- SEO 최적화를 위한 og_images 테이블 스키마
-- config.db에 추가될 테이블

-- 게시글별 자동 생성된 대표 이미지를 저장하는 테이블
CREATE TABLE IF NOT EXISTS og_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    image_data BLOB NOT NULL,
    mime_type VARCHAR(50) DEFAULT 'image/png',
    width INTEGER DEFAULT 1200,
    height INTEGER DEFAULT 630,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, category_id)
);

-- 게시글 ID와 카테고리 ID 조합으로 빠른 조회를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_og_images_post_category 
ON og_images(post_id, category_id);
