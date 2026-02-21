-- Cache 테이블 스키마
-- Sitemap 및 기타 캐시 데이터를 저장하는 테이블

CREATE TABLE IF NOT EXISTS cache (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 만료 시간 인덱스 (빠른 만료 캐시 조회)
CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache(expires_at);

-- 만료된 캐시 자동 삭제 트리거
CREATE TRIGGER IF NOT EXISTS cleanup_expired_cache
AFTER INSERT ON cache
BEGIN
    DELETE FROM cache WHERE expires_at < datetime('now');
END;
