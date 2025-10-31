const express = require('express');
const session = require('express-session');
const path = require('path');

// 라우터 임포트
const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');
const forumRouter = require('./routes/forum');
const adminRouter = require('./routes/admin');

// 서비스 임포트
const DatabaseManager = require('./services/DatabaseManager');

const app = express();
const PORT = process.env.PORT || 3000;

// 데이터베이스 초기화
const dbManager = new DatabaseManager();

async function initializeApp() {
    try {
        // 데이터베이스 초기화
        await dbManager.initialize();
        console.log('데이터베이스 초기화 완료');

        // 뷰 엔진 설정
        app.set('view engine', 'ejs');
        app.set('views', path.join(__dirname, 'views'));

        // 미들웨어 설정
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        app.use(express.static(path.join(__dirname, 'public')));

        // 세션 설정
        app.use(session({
            secret: process.env.SESSION_SECRET || 'forum-secret-key-change-in-production',
            resave: false,
            saveUninitialized: false,
            cookie: {
                secure: false, // HTTPS에서는 true로 설정
                httpOnly: true,
                maxAge: 24 * 60 * 60 * 1000 // 24시간
            }
        }));

        // 전역 변수 설정 (템플릿에서 사용)
        app.use((req, res, next) => {
            res.locals.user = req.session.user || null;
            res.locals.isLoggedIn = !!req.session.user;
            next();
        });

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
        app.listen(PORT, () => {
            console.log(`포럼 서버가 포트 ${PORT}에서 실행 중입니다.`);
        });

    } catch (error) {
        console.error('애플리케이션 초기화 실패:', error);
        process.exit(1);
    }
}

// 애플리케이션 시작
initializeApp();

module.exports = app;