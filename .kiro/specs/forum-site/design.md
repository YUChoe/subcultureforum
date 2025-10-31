# 포럼 사이트 설계 문서

## 개요

Node.js와 SQLite를 사용하여 루리웹과 같은 커뮤니티 포럼 사이트를 구축합니다. 시스템은 컨텐츠 데이터베이스와 설정 데이터베이스를 분리하여 관리하며, 비로그인 사용자도 포럼을 열람할 수 있고, 다양한 정렬 방식을 지원합니다.

## 아키텍처

### 전체 시스템 아키텍처

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (EJS/CSS/JS)  │◄──►│   (Node.js)     │◄──►│   (SQLite)      │
│                 │    │                 │    │                 │
│ - 포럼 목록      │    │ - Express.js    │    │ - config.db     │
│ - 게시글 뷰      │    │ - 인증/세션     │    │ - forum_1.db    │
│ - 관리자 패널    │    │ - API 라우터    │    │ - forum_2.db    │
│                 │    │ - DB 라우팅     │    │ - forum_N.db    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 기술 스택

- **Backend**: Node.js, Express.js
- **Database**: SQLite (config.db, forum_[category_id].db)
- **Template Engine**: EJS
- **Authentication**: express-session, bcrypt
- **Frontend**: HTML5, PicoCSS, JavaScript
- **ORM**: sqlite3 (직접 SQL 쿼리)

## 컴포넌트 및 인터페이스

### 1. 데이터베이스 설계

#### Config Database (config.db)
사이트 설정, 사용자 관리, 포럼 카테고리 정보를 저장합니다.

```sql
-- 사용자 테이블
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('user', 'moderator', 'super_admin') DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 포럼 카테고리 테이블
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 모더레이터 권한 테이블
CREATE TABLE moderator_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES categories(id),
    UNIQUE(user_id, category_id)
);

-- 사이트 설정 테이블
CREATE TABLE site_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 사용자 차단 테이블
CREATE TABLE user_bans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    banned_by INTEGER NOT NULL,
    reason TEXT NOT NULL,
    banned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (banned_by) REFERENCES users(id)
);

-- 사용자 활동 로그 테이블
CREATE TABLE user_activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action VARCHAR(50) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### Forum Content Databases (forum_[category_id].db)
각 포럼 카테고리별로 별도의 데이터베이스에 사용자 생성 컨텐츠를 저장합니다.

```sql
-- 게시글 테이블
CREATE TABLE posts (
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
CREATE TABLE comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- 검색 인덱스 (FTS5)
CREATE VIRTUAL TABLE posts_fts USING fts5(
    title, content, content='posts', content_rowid='id'
);

-- 트리거: 게시글 검색 인덱스 동기화
CREATE TRIGGER posts_ai AFTER INSERT ON posts BEGIN
    INSERT INTO posts_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
END;

CREATE TRIGGER posts_ad AFTER DELETE ON posts BEGIN
    INSERT INTO posts_fts(posts_fts, rowid, title, content) VALUES('delete', old.id, old.title, old.content);
END;

CREATE TRIGGER posts_au AFTER UPDATE ON posts BEGIN
    INSERT INTO posts_fts(posts_fts, rowid, title, content) VALUES('delete', old.id, old.title, old.content);
    INSERT INTO posts_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
END;
```

### 2. 백엔드 컴포넌트

#### 데이터베이스 매니저
```javascript
class DatabaseManager {
    constructor() {
        this.configDB = null;
        this.forumDBs = new Map(); // categoryId -> database connection
    }

    async initialize() {
        // config.db 연결 초기화
        // 기존 포럼 DB들 연결 초기화
    }

    getConfigDB() { return this.configDB; }

    async getForumDB(categoryId) {
        if (!this.forumDBs.has(categoryId)) {
            // forum_[categoryId].db 연결 생성
            const db = await this.createForumDB(categoryId);
            this.forumDBs.set(categoryId, db);
        }
        return this.forumDBs.get(categoryId);
    }

    async createForumDB(categoryId) {
        // 새 포럼 DB 생성 및 테이블 초기화
    }
}
```

#### 인증 서비스
```javascript
class AuthService {
    async register(username, email, password) {
        // 사용자 등록 로직
    }

    async login(username, password) {
        // 로그인 검증 및 세션 생성
    }

    async checkPermission(userId, action, resourceId) {
        // 권한 검사 (일반/모더레이터/슈퍼관리자)
    }
}
```

#### 포럼 서비스
```javascript
class ForumService {
    async getCategories() {
        // 카테고리 목록 조회
    }

    async getPosts(categoryId, sortBy = 'created_at', page = 1) {
        // 해당 카테고리의 포럼 DB에서 게시글 목록 조회
        // 정렬 옵션: created_at, last_comment_at
    }

    async getPost(postId) {
        // 게시글 상세 조회 및 조회수 증가
    }

    async createPost(userId, categoryId, title, content) {
        // 게시글 작성
    }

    async searchPosts(query, categoryId = null) {
        // 특정 카테고리 또는 모든 포럼 DB에서 FTS5를 사용한 전문 검색
    }
}
```

#### 관리자 서비스
```javascript
class AdminService {
    async createCategory(name, description, displayOrder) {
        // 새 포럼 카테고리 생성 및 DB 초기화
    }

    async updateCategory(categoryId, updates) {
        // 카테고리 정보 수정
    }

    async deleteCategory(categoryId) {
        // 카테고리 삭제 및 관련 DB 정리
    }

    async getUserList(page = 1, filters = {}) {
        // 사용자 목록 조회 (페이지네이션, 필터링)
    }

    async updateUserRole(userId, newRole) {
        // 사용자 권한 변경 (user/moderator/super_admin)
    }

    async assignModerator(userId, categoryId) {
        // 특정 카테고리에 모더레이터 권한 부여
    }

    async removeModerator(userId, categoryId) {
        // 모더레이터 권한 제거
    }

    async getSiteStatistics() {
        // 전체 사이트 통계 (사용자 수, 게시글 수, 활성도 등)
    }

    async getForumStatistics(categoryId) {
        // 특정 포럼 통계
    }

    async banUser(userId, reason, duration) {
        // 사용자 차단
    }

    async unbanUser(userId) {
        // 사용자 차단 해제
    }
}
```

### 3. 라우터 구조

```
/                           - 메인 페이지 (카테고리 목록)
/category/:id               - 카테고리별 게시글 목록
/category/:id?sort=latest   - 최신글 순 정렬
/category/:id?sort=thread   - 최신 댓글 순 정렬
/post/:id                   - 게시글 상세 보기
/post/new                   - 게시글 작성 (로그인 필요)
/post/:id/edit              - 게시글 수정 (작성자/모더레이터만)
/search                     - 검색 결과
/auth/login                 - 로그인
/auth/register              - 회원가입
/auth/logout                - 로그아웃
/admin                      - 관리자 대시보드 (슈퍼관리자만)
/admin/categories           - 포럼 카테고리 관리 (생성/수정/삭제)
/admin/categories/new       - 새 포럼 카테고리 생성
/admin/categories/:id/edit  - 카테고리 수정
/admin/users                - 사용자 관리 (목록/검색/필터링)
/admin/users/:id            - 사용자 상세 정보 및 권한 관리
/admin/users/:id/ban        - 사용자 차단
/admin/moderators           - 모더레이터 권한 관리
/admin/statistics           - 사이트 전체 통계
/admin/statistics/:categoryId - 특정 포럼 통계
/moderate/:categoryId       - 모더레이션 패널 (해당 카테고리 모더레이터)
```

## 데이터 모델

### 사용자 권한 모델
```javascript
const UserRoles = {
    USER: 'user',           // 일반 사용자
    MODERATOR: 'moderator', // 포럼 모더레이터
    SUPER_ADMIN: 'super_admin' // 슈퍼 관리자
};

const Permissions = {
    READ_POSTS: 'read_posts',         // 게시글 읽기 (모든 사용자)
    WRITE_POSTS: 'write_posts',       // 게시글 작성 (로그인 사용자)
    EDIT_OWN_POSTS: 'edit_own_posts', // 자신의 게시글 수정
    MODERATE_CATEGORY: 'moderate_category', // 카테고리 모더레이션
    ADMIN_SITE: 'admin_site'          // 사이트 관리
};
```

### 정렬 옵션 모델
```javascript
const SortOptions = {
    LATEST_POST: 'created_at',        // 최신 게시글 순
    LATEST_COMMENT: 'last_comment_at' // 최신 댓글 순 (쓰레드 방식)
};
```

## 오류 처리

### 1. 데이터베이스 오류
- SQLite 연결 실패 시 재시도 로직
- 트랜잭션 롤백 처리
- 데이터베이스 락 타임아웃 처리

### 2. 인증/권한 오류
- 401 Unauthorized: 로그인 필요
- 403 Forbidden: 권한 부족
- 세션 만료 처리

### 3. 입력 검증 오류
- XSS 방지를 위한 HTML 이스케이프
- SQL 인젝션 방지를 위한 파라미터화된 쿼리
- 파일 업로드 크기 제한

### 4. 오류 로깅
```javascript
class ErrorLogger {
    static logError(error, context) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            error: error.message,
            stack: error.stack,
            context: context
        };
        // 파일 또는 데이터베이스에 로그 저장
    }
}
```

## 테스트 전략

### 1. 단위 테스트
- 데이터베이스 서비스 함수 테스트
- 인증 로직 테스트
- 권한 검사 로직 테스트

### 2. 통합 테스트
- API 엔드포인트 테스트
- 데이터베이스 트랜잭션 테스트
- 세션 관리 테스트

### 3. E2E 테스트
- 사용자 회원가입/로그인 플로우
- 게시글 작성/수정/삭제 플로우
- 관리자 기능 테스트

## 보안 고려사항

### 1. 인증 보안
- bcrypt를 사용한 비밀번호 해싱 (salt rounds: 12)
- 세션 쿠키 보안 설정 (httpOnly, secure, sameSite)
- CSRF 토큰 사용

### 2. 입력 검증
- express-validator를 사용한 입력 검증
- HTML 태그 필터링 (허용된 태그만)
- 파일 업로드 검증 (확장자, MIME 타입)

### 3. SQL 인젝션 방지
- 모든 쿼리에 파라미터화된 쿼리 사용
- 동적 쿼리 생성 시 화이트리스트 검증

## 성능 최적화

### 1. 데이터베이스 최적화
- 각 포럼 DB별 적절한 인덱스 생성
- 페이지네이션 구현
- 쿼리 최적화 (N+1 문제 방지)
- 포럼 DB 연결 풀링 및 캐싱

### 2. 캐싱 전략
- 메모리 캐싱 (카테고리 목록, 사이트 설정)
- 정적 파일 캐싱
- ETag 헤더 사용

### 3. 프론트엔드 최적화
- PicoCSS를 사용한 미니멀 스타일링
- JS 파일 압축
- 이미지 최적화
- 지연 로딩 구현

## 프론트엔드 기술 스택

### EJS + Alpine.js 조합
- **EJS**: 서버사이드 템플릿 렌더링 (초기 페이지 로드)
- **Alpine.js**: 클라이언트사이드 인터랙션 (동적 UI 상태 관리)
- **PicoCSS**: 미니멀한 CSS 프레임워크

### 사용 예시
```html
<!-- EJS로 초기 데이터 렌더링 -->
<div x-data="{ showComments: false }">
    <h3><%= post.title %></h3>
    <button @click="showComments = !showComments">
        댓글 (<%= post.comment_count %>)
    </button>
    <div x-show="showComments" x-transition>
        <!-- Alpine.js로 동적 토글 -->
    </div>
</div>
```