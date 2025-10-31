# 서브컬처 포럼

Node.js와 SQLite를 사용하여 구축된 커뮤니티 포럼 사이트입니다.

## 주요 기능

- 사용자 회원가입 및 로그인
- 포럼 카테고리별 게시글 관리
- 댓글 시스템
- 검색 기능 (FTS5 전문 검색)
- 관리자 및 모더레이터 권한 시스템
- 비로그인 사용자 열람 지원
- 반응형 웹 디자인

## 기술 스택

- **Backend**: Node.js, Express.js
- **Database**: SQLite (config.db + 카테고리별 forum_N.db)
- **Template Engine**: EJS
- **Frontend**: PicoCSS, Alpine.js
- **Authentication**: express-session, bcrypt

## 설치 및 실행

### 1. 저장소 클론
```bash
git clone <repository-url>
cd subcultureforum
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경 변수 설정
```bash
cp .env.example .env
# .env 파일을 편집하여 필요한 설정값들을 입력하세요
```

### 4. 개발 서버 실행
```bash
npm run dev
```

### 5. 프로덕션 실행
```bash
npm start
```

## 프로젝트 구조

```
├── app.js                 # 메인 애플리케이션 파일
├── package.json           # 프로젝트 설정 및 의존성
├── config/                # 설정 파일들
│   └── default.js         # 기본 설정
├── database/              # SQLite 데이터베이스 파일들
│   ├── config.db          # 사이트 설정 및 사용자 정보
│   └── forum_*.db         # 카테고리별 포럼 데이터
├── middleware/            # Express 미들웨어
│   └── auth.js            # 인증 관련 미들웨어
├── models/                # 데이터 모델 (추후 구현)
├── routes/                # 라우터 파일들
│   ├── index.js           # 메인 페이지 라우터
│   ├── auth.js            # 인증 라우터
│   ├── forum.js           # 포럼 라우터
│   └── admin.js           # 관리자 라우터
├── services/              # 비즈니스 로직 서비스
│   └── DatabaseManager.js # 데이터베이스 관리자
├── views/                 # EJS 템플릿 파일들
│   ├── layouts/           # 레이아웃 템플릿
│   ├── pages/             # 페이지 템플릿
│   └── partials/          # 부분 템플릿
└── public/                # 정적 파일들
    ├── css/               # 스타일시트
    ├── js/                # JavaScript 파일
    ├── images/            # 이미지 파일
    └── uploads/           # 업로드된 파일들
```

## 데이터베이스 구조

### Config Database (config.db)
- `users`: 사용자 정보
- `categories`: 포럼 카테고리
- `moderator_permissions`: 모더레이터 권한
- `site_settings`: 사이트 설정
- `user_bans`: 사용자 차단 정보
- `user_activity_logs`: 사용자 활동 로그

### Forum Databases (forum_N.db)
각 카테고리별로 별도 데이터베이스:
- `posts`: 게시글
- `comments`: 댓글
- `posts_fts`: FTS5 검색 인덱스

## 데이터베이스 관리

### 스키마 검증
전체 데이터베이스 스키마를 검증합니다:
```bash
npm run db:verify
```

### 스키마 복구
손상된 스키마를 자동으로 복구합니다:
```bash
npm run db:repair
```

### 새 포럼 카테고리 생성
새로운 포럼 카테고리와 데이터베이스를 생성합니다:
```bash
npm run db:create-category "카테고리명" "설명"
```

### 수동 포럼 DB 초기화
특정 카테고리 ID에 대해 포럼 DB를 초기화합니다:
```bash
node database/init_forum_schema.js init <category_id>
```

### 스키마 파일 위치
- Config DB 스키마: `database/schema/config_schema.sql`
- Forum DB 스키마 템플릿: `database/schema/forum_schema.sql`

## 개발 가이드

### 새로운 라우터 추가
1. `routes/` 폴더에 새 파일 생성
2. `app.js`에서 라우터 등록
3. 필요한 미들웨어 적용

### 새로운 서비스 추가
1. `services/` 폴더에 새 클래스 생성
2. `DatabaseManager`를 통한 DB 접근
3. 라우터에서 서비스 사용

### 템플릿 작성
1. `views/pages/`에 EJS 템플릿 생성
2. `layouts/main.ejs` 레이아웃 사용
3. Alpine.js를 통한 동적 기능 추가

## 라이선스

ISC

## 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request