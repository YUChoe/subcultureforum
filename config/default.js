module.exports = {
    // 서버 설정
    server: {
        port: process.env.PORT || 8000,
        host: process.env.HOST || 'localhost'
    },

    // 세션 설정
    session: {
        secret: process.env.SESSION_SECRET || 'forum-secret-key-change-in-production',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production', // HTTPS에서만 true
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000 // 24시간
        }
    },

    // 데이터베이스 설정
    database: {
        path: process.env.DB_PATH || './database',
        configDB: 'config.db',
        forumDBPrefix: 'forum_'
    },

    // 보안 설정
    security: {
        bcryptRounds: 12,
        maxLoginAttempts: 5,
        lockoutTime: 15 * 60 * 1000 // 15분
    },

    // 페이지네이션 설정
    pagination: {
        postsPerPage: 20,
        usersPerPage: 50,
        searchResultsPerPage: 10
    },

    // 파일 업로드 설정
    upload: {
        maxFileSize: 5 * 1024 * 1024, // 5MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif'],
        uploadPath: './public/uploads'
    },

    // 사이트 설정
    site: {
        name: 'NOIZZE',
        // 절대 URL 생성 기준 (canonical, sitemap, og:url). 예: https://noizze.net (끝의 / 는 제거됨)
        url: (process.env.SITE_URL || ('http://localhost:' + (process.env.PORT || 8888))).replace(/\/+$/, ''),
        // sitemap 메모리 캐시 TTL (초)
        seoCacheTtlSeconds: parseInt(process.env.SEO_CACHE_TTL_SECONDS, 10) || 3600,
        description: 'NOIZZE 커뮤니티 포럼',
        defaultLanguage: 'ko',
        timezone: 'Asia/Seoul'
    }
};