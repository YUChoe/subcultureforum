const express = require('express');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');

// 라우터 임포트
const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');
const forumRouter = require('./routes/forum');
const adminRouter = require('./routes/admin');

// 서비스 임포트
const DatabaseManager = require('./services/DatabaseManager');

const app = express();
const PORT = process.env.PORT || 8888;

// 데이터베이스 매니저 인스턴스 가져오기
const dbManager = DatabaseManager.getInstance();

const isProduction = process.env.NODE_ENV === 'production';

// 세션 시크릿: 하드코딩된 기본값을 쓰지 않는다.
// 프로덕션에서는 SESSION_SECRET 이 없으면 시작하지 않고, 개발 환경에서는 실행할 때마다 임의 값을 생성한다.
function resolveSessionSecret() {
    const secret = process.env.SESSION_SECRET;
    const isPlaceholder = !secret || secret === 'your-secret-key-here';

    if (!isPlaceholder) {
        return secret;
    }

    if (isProduction) {
        console.error('❌ 프로덕션에서는 SESSION_SECRET 환경 변수가 필요합니다. (.env.example 참고)');
        process.exit(1);
    }

    console.warn('⚠️  SESSION_SECRET 이 설정되지 않아 임시 랜덤 값을 사용합니다. 서버를 재시작하면 모든 세션이 로그아웃됩니다.');
    return crypto.randomBytes(32).toString('hex');
}

async function initializeApp() {
    try {
        // 데이터베이스 초기화
        await dbManager.initialize();
        console.log('데이터베이스 초기화 완료');

        // 뷰 엔진 설정
        app.set('view engine', 'ejs');
        app.set('views', path.join(__dirname, 'views'));

        // 기본 보안 헤더: 서버 정보 노출 제거, 업로드 파일 등의 MIME 스니핑 방지
        app.disable('x-powered-by');
        app.use((req, res, next) => {
            res.set('X-Content-Type-Options', 'nosniff');
            next();
        });

        // 뷰에서 사용자 입력을 안전하게 출력하기 위한 헬퍼 (escapeHtml, jsAttr, jsString)
        Object.assign(app.locals, require('./utils/template-helpers'));

        // 미들웨어 설정
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        app.use(express.static(path.join(__dirname, 'public')));

        // 세션 설정
        app.use(session({
            secret: resolveSessionSecret(),
            resave: false,
            saveUninitialized: false,
            cookie: {
                secure: false, // HTTPS에서는 true로 설정
                httpOnly: true,
                sameSite: 'lax', // 다른 사이트에서의 POST 요청에 쿠키가 전송되지 않도록 (CSRF 완화)
                maxAge: 24 * 60 * 60 * 1000 // 24시간
            }
        }));

        // 사용자 인증 미들웨어
        const { loadUser, checkUserBan, checkRoutePermission } = require('./middleware/auth');
        app.use(loadUser);

        // 사용자 차단 상태 확인 미들웨어
        app.use(checkUserBan);

        // 전역 변수 설정 (템플릿에서 사용)
        app.use((req, res, next) => {
            res.locals.isLoggedIn = !!req.user;
            res.locals.user = req.user;
            next();
        });

        // 라우트별 권한 검사 미들웨어 (라우터 설정 전에 적용)
        app.use(checkRoutePermission);

        // 라우터 설정
        app.use('/', indexRouter);
        app.use('/auth', authRouter);
        app.use('/forum', forumRouter);
        app.use('/admin', adminRouter);

        // 404 에러 처리
        app.use((req, res, next) => {
            res.status(404).render('pages/error', {
                title: '페이지를 찾을 수 없습니다',
                error: {
                    status: 404,
                    message: '요청하신 페이지를 찾을 수 없습니다.'
                }
            });
        });

        // 에러 처리 미들웨어
        app.use((err, req, res, next) => {
            console.error('서버 오류:', err);
            res.status(err.status || 500).render('pages/error', {
                title: '서버 오류',
                error: {
                    status: err.status || 500,
                    message: err.message || '서버에서 오류가 발생했습니다.'
                }
            });
        });

        // 서버 시작
        const server = app.listen(PORT, () => {
            console.log(`포럼 서버가 포트 ${PORT}에서 실행 중입니다.`);
        });

        // 포트 충돌 및 기타 서버 에러 처리
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`❌ 포트 ${PORT}이 이미 사용 중입니다. 다른 프로세스가 실행 중인지 확인하세요.`);
                console.error('해결 방법:');
                console.error('1. 다른 포트를 사용하려면: PORT=3001 node app.js');
                console.error('2. 실행 중인 프로세스를 종료하세요');
                process.exit(1);
            } else if (err.code === 'EACCES') {
                console.error(`❌ 포트 ${PORT}에 접근 권한이 없습니다. 관리자 권한으로 실행하거나 다른 포트를 사용하세요.`);
                process.exit(1);
            } else {
                console.error('❌ 서버 시작 중 오류 발생:', err);
                process.exit(1);
            }
        });

        // 프로세스 종료 시 정리
        process.on('SIGINT', () => {
            console.log('\n서버를 종료합니다...');
            server.close(() => {
                console.log('서버가 정상적으로 종료되었습니다.');
                process.exit(0);
            });
        });

        process.on('SIGTERM', () => {
            console.log('서버 종료 신호를 받았습니다...');
            server.close(() => {
                console.log('서버가 정상적으로 종료되었습니다.');
                process.exit(0);
            });
        });

    } catch (error) {
        console.error('애플리케이션 초기화 실패:', error);
        process.exit(1);
    }
}

// 애플리케이션 시작
initializeApp();

module.exports = app;