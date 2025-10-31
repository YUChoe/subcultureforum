const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// 로그인 페이지
router.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }

    res.render('pages/auth/login', {
        title: '로그인',
        error: null
    });
});

// 로그인 처리
router.post('/login', [
    body('username').notEmpty().withMessage('사용자명을 입력해주세요'),
    body('password').notEmpty().withMessage('비밀번호를 입력해주세요')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('pages/auth/login', {
                title: '로그인',
                error: errors.array()[0].msg
            });
        }

        const { username, password } = req.body;

        // TODO: AuthService에서 로그인 검증
        // const user = await authService.login(username, password);

        // 임시 로그인 성공 처리
        req.session.user = {
            id: 1,
            username: username,
            role: 'user'
        };

        res.redirect('/');
    } catch (error) {
        console.error('로그인 오류:', error);
        res.render('pages/auth/login', {
            title: '로그인',
            error: '로그인 중 오류가 발생했습니다.'
        });
    }
});

// 회원가입 페이지
router.get('/register', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }

    res.render('pages/auth/register', {
        title: '회원가입',
        error: null
    });
});

// 회원가입 처리
router.post('/register', [
    body('username')
        .isLength({ min: 3, max: 20 })
        .withMessage('사용자명은 3-20자 사이여야 합니다')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('사용자명은 영문, 숫자, 언더스코어만 사용 가능합니다'),
    body('email')
        .isEmail()
        .withMessage('올바른 이메일 주소를 입력해주세요'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('비밀번호는 최소 6자 이상이어야 합니다'),
    body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('비밀번호가 일치하지 않습니다');
            }
            return true;
        })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('pages/auth/register', {
                title: '회원가입',
                error: errors.array()[0].msg
            });
        }

        const { username, email, password } = req.body;

        // TODO: AuthService에서 회원가입 처리
        // const user = await authService.register(username, email, password);

        // 임시 회원가입 성공 처리
        req.session.user = {
            id: 1,
            username: username,
            role: 'user'
        };

        res.redirect('/');
    } catch (error) {
        console.error('회원가입 오류:', error);
        res.render('pages/auth/register', {
            title: '회원가입',
            error: '회원가입 중 오류가 발생했습니다.'
        });
    }
});

// 로그아웃
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('로그아웃 오류:', err);
        }
        res.redirect('/');
    });
});

module.exports = router;