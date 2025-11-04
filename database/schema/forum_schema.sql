-- Forum Database Schema Template
-- 각 포럼 카테고리별 컨텐츠를 저장하는 데이터베이스 스키마
-- 이 템플릿은 새로운 포럼 카테고리 생성 시 자동으로 적용됩니다

-- 게시글 테이블
CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    view_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_comment_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 댓글 테이블
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- 첨부파일 테이블
CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    file_data BLOB NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- FTS5 전문 검색 인덱스
CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
    title, content, content='posts', content_rowid='id'
);

-- 게시글 인덱스 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_posts_category_id ON posts(category_id);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_last_comment_at ON posts(last_comment_at DESC);

-- 댓글 인덱스 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);

-- 첨부파일 인덱스 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_attachments_post_id ON attachments(post_id);
CREATE INDEX IF NOT EXISTS idx_attachments_filename ON attachments(filename);

-- FTS5 동기화 트리거들
-- 게시글 삽입 시 검색 인덱스 업데이트
CREATE TRIGGER IF NOT EXISTS posts_ai AFTER INSERT ON posts
BEGIN
    INSERT INTO posts_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
END;

-- 게시글 삭제 시 검색 인덱스 업데이트
CREATE TRIGGER IF NOT EXISTS posts_ad AFTER DELETE ON posts
BEGIN
    INSERT INTO posts_fts(posts_fts, rowid, title, content) VALUES('delete', old.id, old.title, old.content);
END;

-- 게시글 수정 시 검색 인덱스 업데이트
CREATE TRIGGER IF NOT EXISTS posts_au AFTER UPDATE ON posts
BEGIN
    INSERT INTO posts_fts(posts_fts, rowid, title, content) VALUES('delete', old.id, old.title, old.content);
    INSERT INTO posts_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
END;

-- 댓글 추가 시 게시글의 last_comment_at 업데이트
CREATE TRIGGER IF NOT EXISTS comments_ai AFTER INSERT ON comments
BEGIN
    UPDATE posts SET last_comment_at = CURRENT_TIMESTAMP WHERE id = new.post_id;
END;

-- 댓글 수정 시 게시글의 last_comment_at 업데이트
CREATE TRIGGER IF NOT EXISTS comments_au AFTER UPDATE ON comments
BEGIN
    UPDATE posts SET last_comment_at = CURRENT_TIMESTAMP WHERE id = new.post_id;
END;