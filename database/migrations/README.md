# 데이터베이스 마이그레이션

이 디렉토리는 데이터베이스 스키마 변경을 관리하는 마이그레이션 스크립트를 포함합니다.

## 마이그레이션 목록

### 001_add_seo_tables.js

SEO 최적화를 위한 테이블 및 설정 추가

- `og_images` 테이블 생성 (config.db)
- SEO 관련 site_settings 추가

## 사용법

### 전체 SEO 마이그레이션 실행

```bash
node database/run_seo_migration.js
```

이 스크립트는 다음 작업을 수행합니다:
1. cache.db 초기화 확인 (없으면 생성)
2. config.db에 og_images 테이블 추가
3. site_settings에 SEO 설정 추가

### 개별 마이그레이션 실행

```bash
node database/migrations/001_add_seo_tables.js
```

### 마이그레이션 롤백 (개발용)

```bash
node database/migrations/001_add_seo_tables.js --rollback
```

주의: 롤백은 개발 환경에서만 사용하세요. 프로덕션 데이터가 삭제될 수 있습니다.

## 생성되는 항목

### og_images 테이블 (config.db)

게시글별 자동 생성된 대표 이미지를 저장합니다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER | 기본 키 |
| post_id | INTEGER | 게시글 ID |
| category_id | INTEGER | 카테고리 ID |
| image_data | BLOB | 이미지 데이터 (PNG) |
| mime_type | VARCHAR(50) | MIME 타입 (기본: image/png) |
| width | INTEGER | 이미지 너비 (기본: 1200) |
| height | INTEGER | 이미지 높이 (기본: 630) |
| created_at | DATETIME | 생성 시간 |
| updated_at | DATETIME | 수정 시간 |

인덱스:
- `idx_og_images_post_category` (post_id, category_id)

### SEO 설정 (site_settings)

| 키 | 기본값 | 설명 |
|----|--------|------|
| site_name | 커뮤니티 포럼 | 사이트 이름 |
| site_description | 다양한 주제로 소통하는... | 사이트 설명 |
| site_url | https://example.com | 사이트 URL |
| site_keywords | 포럼, 커뮤니티, 게시판 | 사이트 키워드 |
| og_default_image | /images/og-default.png | 기본 OG 이미지 경로 |
| twitter_site | @example | 트위터 계정 |
| sitemap_cache_duration | 3600 | Sitemap 캐시 유지 시간 (초) |

## 마이그레이션 작성 가이드

새로운 마이그레이션을 작성할 때는 다음 규칙을 따르세요:

1. 파일명: `{번호}_설명.js` (예: `002_add_user_profiles.js`)
2. 클래스 기반 구조 사용
3. `migrate()` 메서드 구현 (마이그레이션 실행)
4. `rollback()` 메서드 구현 (롤백, 선택사항)
5. 멱등성 보장 (여러 번 실행해도 안전)
6. 에러 처리 포함

### 예제 템플릿

```javascript
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class MyMigration {
    constructor() {
        this.dbPath = path.join(__dirname, '..', 'config.db');
    }

    async migrate() {
        // 마이그레이션 로직
    }

    async rollback() {
        // 롤백 로직 (선택사항)
    }
}

module.exports = MyMigration;

if (require.main === module) {
    const migration = new MyMigration();
    migration.migrate()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
```

## 트러블슈팅

### "config.db가 존재하지 않습니다" 오류

먼저 config.db를 초기화하세요:

```bash
node database/init_config_db.js
```

### "테이블이 이미 존재합니다" 경고

정상입니다. 마이그레이션은 멱등성을 보장하므로 여러 번 실행해도 안전합니다.

### 롤백 후 재실행

```bash
node database/migrations/001_add_seo_tables.js --rollback
node database/migrations/001_add_seo_tables.js
```
