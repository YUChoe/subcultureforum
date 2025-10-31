const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// 관리자 권한 확인 미들웨어
const requireAdmin = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'super_admin') {
        return res.status(403).render('pages/error', {
            title: '접근 권한 없음',
            error: {
                status: 403,
                message: '관리자 권한이 필요합니다.'
            }
        });
    }
    next();
};

// 관리자 대시보드
router.get('/', requireAdmin, async (req, res) => {
    try {
        // TODO: AdminService에서 사이트 통계 가져오기
        const statistics = {
            totalUsers: 0,
            totalPosts: 0,
            totalCategories: 0,
            activeUsers: 0
        };

        res.render('pages/admin/dashboard', {
            title: '관리자 대시보드',
            statistics: statistics
        });
    } catch (error) {
        console.error('관리자 대시보드 오류:', error);
        res.status(500).render('pages/error', {
            title: '서버 오류',
            error: {
                status: 500,
                message: '대시보드를 로드하는 중 오류가 발생했습니다.'
            }
        });
    }
});

// 카테고리 관리 페이지
router.get('/categories', requireAdmin, async (req, res) => {
    try {
        // TODO: AdminService에서 카테고리 목록 가져오기
        const categories = [];

        res.render('pages/admin/categories', {
            title: '카테고리 관리',
            categories: categories
        });
    } catch (error) {
        console.error('카테고리 관리 페이지 오류:', error);
        res.status(500).render('pages/error', {
            title: '서버 오류',
            error: {
                status: 500,
                message: '카테고리 관리 페이지를 로드하는 중 오류가 발생했습니다.'
            }
        });
    }
});

// 새 카테고리 생성 페이지
router.get('/categories/new', requireAdmin, (req, res) => {
    res.render('pages/admin/new-category', {
        title: '새 카테고리 생성',
        error: null
    });
});

// 새 카테고리 생성 처리
router.post('/categories/new', requireAdmin, [
    body('name')
        .isLength({ min: 1, max: 100 })
        .withMessage('카테고리 이름은 1-100자 사이여야 합니다'),
    body('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('설명은 500자를 초과할 수 없습니다')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('pages/admin/new-category', {
                title: '새 카테고리 생성',
                error: errors.array()[0].msg
            });
        }

        const { name, description, displayOrder } = req.body;

        // TODO: AdminService에서 카테고리 생성
        // await adminService.createCategory(name, description, displayOrder);

        res.redirect('/admin/categories');
    } catch (error) {
        console.error('카테고리 생성 오류:', error);
        res.render('pages/admin/new-category', {
            title: '새 카테고리 생성',
            error: '카테고리 생성 중 오류가 발생했습니다.'
        });
    }
});

// 사용자 관리 페이지
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const search = req.query.search || '';

        // TODO: AdminService에서 사용자 목록 가져오기
        const users = [];

        res.render('pages/admin/users', {
            title: '사용자 관리',
            users: users,
            currentPage: page,
            search: search
        });
    } catch (error) {
        console.error('사용자 관리 페이지 오류:', error);
        res.status(500).render('pages/error', {
            title: '서버 오류',
            error: {
                status: 500,
                message: '사용자 관리 페이지를 로드하는 중 오류가 발생했습니다.'
            }
        });
    }
});

// 사용자 권한 변경
router.post('/users/:id/role', requireAdmin, [
    body('role')
        .isIn(['user', 'moderator', 'super_admin'])
        .withMessage('올바른 권한을 선택해주세요')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const userId = parseInt(req.params.id);
        const { role } = req.body;

        // TODO: AdminService에서 사용자 권한 변경
        // await adminService.updateUserRole(userId, role);

        res.json({ success: true, message: '사용자 권한이 변경되었습니다.' });
    } catch (error) {
        console.error('사용자 권한 변경 오류:', error);
        res.status(500).json({ error: '권한 변경 중 오류가 발생했습니다.' });
    }
});

module.exports = router;