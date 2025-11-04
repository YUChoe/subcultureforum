const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAdmin } = require('../middleware/auth');
const AdminService = require('../services/AdminService');
const router = express.Router();

// AdminService 인스턴스 생성
const adminService = new AdminService();

// 관리자 대시보드
router.get('/', requireAdmin, async (req, res) => {
    try {
        const statistics = await adminService.getSiteStatistics(req.user.id);

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

// 기존 categories 라우트를 forums로 리다이렉트 (하위 호환성)
router.get('/categories', requireAdmin, (req, res) => {
    res.redirect('/admin/forums');
});

// 서브포럼 관리 페이지
router.get('/forums', requireAdmin, async (req, res) => {
    try {
        const subforums = await adminService.getAllCategories(req.user.id, true);

        res.render('pages/admin/forums', {
            title: '서브포럼 관리',
            subforums: subforums
        });
    } catch (error) {
        console.error('서브포럼 관리 페이지 오류:', error);
        res.status(500).render('pages/error', {
            title: '서버 오류',
            error: {
                status: 500,
                message: '서브포럼 관리 페이지를 로드하는 중 오류가 발생했습니다.'
            }
        });
    }
});

// 기존 categories/new 라우트를 forums/new로 리다이렉트 (하위 호환성)
router.get('/categories/new', requireAdmin, (req, res) => {
    res.redirect('/admin/forums/new');
});

// 새 서브포럼 생성 페이지
router.get('/forums/new', requireAdmin, (req, res) => {
    res.render('pages/admin/new-forum', {
        title: '새 서브포럼 생성',
        error: null
    });
});

// 새 서브포럼 생성 처리
router.post('/forums/new', requireAdmin, [
    body('name')
        .isLength({ min: 1, max: 100 })
        .withMessage('서브포럼 이름은 1-100자 사이여야 합니다'),
    body('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('설명은 500자를 초과할 수 없습니다'),
    body('displayOrder')
        .optional()
        .isInt({ min: 0 })
        .withMessage('표시 순서는 0 이상의 숫자여야 합니다')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('pages/admin/new-forum', {
                title: '새 서브포럼 생성',
                error: errors.array()[0].msg,
                formData: req.body
            });
        }

        const { name, description, displayOrder } = req.body;

        await adminService.createCategory(req.user.id, {
            name: name,
            description: description,
            displayOrder: parseInt(displayOrder) || 0
        });

        res.redirect('/admin/forums?success=서브포럼이 성공적으로 생성되었습니다.');
    } catch (error) {
        console.error('서브포럼 생성 오류:', error);
        res.render('pages/admin/new-forum', {
            title: '새 서브포럼 생성',
            error: error.message || '서브포럼 생성 중 오류가 발생했습니다.',
            formData: req.body
        });
    }
});

// 기존 categories/:id/edit 라우트를 forums/:id/edit로 리다이렉트 (하위 호환성)
router.get('/categories/:id/edit', requireAdmin, (req, res) => {
    res.redirect(`/admin/forums/${req.params.id}/edit`);
});

// 서브포럼 수정 페이지
router.get('/forums/:id/edit', requireAdmin, async (req, res) => {
    try {
        const subforumId = parseInt(req.params.id);
        const subforums = await adminService.getAllCategories(req.user.id, true);
        const subforum = subforums.find(s => s.id === subforumId);

        if (!subforum) {
            return res.status(404).render('pages/error', {
                title: '서브포럼을 찾을 수 없습니다',
                error: {
                    status: 404,
                    message: '요청하신 서브포럼을 찾을 수 없습니다.'
                }
            });
        }

        res.render('pages/admin/edit-forum', {
            title: '서브포럼 수정',
            subforum: subforum,
            error: null
        });
    } catch (error) {
        console.error('서브포럼 수정 페이지 오류:', error);
        res.status(500).render('pages/error', {
            title: '서버 오류',
            error: {
                status: 500,
                message: '서브포럼 수정 페이지를 로드하는 중 오류가 발생했습니다.'
            }
        });
    }
});

// 서브포럼 수정 처리
router.post('/forums/:id/edit', requireAdmin, [
    body('name')
        .isLength({ min: 1, max: 100 })
        .withMessage('서브포럼 이름은 1-100자 사이여야 합니다'),
    body('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('설명은 500자를 초과할 수 없습니다'),
    body('displayOrder')
        .optional()
        .isInt({ min: 0 })
        .withMessage('표시 순서는 0 이상의 숫자여야 합니다')
], async (req, res) => {
    try {
        const subforumId = parseInt(req.params.id);
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            const subforums = await adminService.getAllCategories(req.user.id, true);
            const subforum = subforums.find(s => s.id === subforumId);

            return res.render('pages/admin/edit-forum', {
                title: '서브포럼 수정',
                subforum: { ...subforum, ...req.body },
                error: errors.array()[0].msg
            });
        }

        const { name, description, displayOrder } = req.body;

        await adminService.updateCategory(req.user.id, subforumId, {
            name: name,
            description: description,
            displayOrder: parseInt(displayOrder) || 0
        });

        res.redirect('/admin/forums?success=서브포럼이 성공적으로 수정되었습니다.');
    } catch (error) {
        console.error('서브포럼 수정 오류:', error);

        try {
            const subforums = await adminService.getAllCategories(req.user.id, true);
            const subforum = subforums.find(s => s.id === parseInt(req.params.id));

            res.render('pages/admin/edit-forum', {
                title: '서브포럼 수정',
                subforum: { ...subforum, ...req.body },
                error: error.message || '서브포럼 수정 중 오류가 발생했습니다.'
            });
        } catch (fetchError) {
            res.status(500).render('pages/error', {
                title: '서버 오류',
                error: {
                    status: 500,
                    message: '서브포럼 수정 중 오류가 발생했습니다.'
                }
            });
        }
    }
});

// 서브포럼 삭제 처리
router.post('/forums/:id/delete', requireAdmin, async (req, res) => {
    try {
        const subforumId = parseInt(req.params.id);

        await adminService.deleteCategory(req.user.id, subforumId);

        res.json({
            success: true,
            message: '서브포럼이 성공적으로 삭제되었습니다.'
        });
    } catch (error) {
        console.error('서브포럼 삭제 오류:', error);
        res.status(500).json({
            error: error.message || '서브포럼 삭제 중 오류가 발생했습니다.'
        });
    }
});

// 서브포럼 순서 변경 처리
router.post('/forums/reorder', requireAdmin, [
    body('subforums')
        .isArray()
        .withMessage('서브포럼 순서 데이터가 필요합니다')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const { subforums } = req.body;

        await adminService.updateCategoryOrder(req.user.id, subforums);

        res.json({
            success: true,
            message: '서브포럼 순서가 성공적으로 변경되었습니다.'
        });
    } catch (error) {
        console.error('서브포럼 순서 변경 오류:', error);
        res.status(500).json({
            error: error.message || '서브포럼 순서 변경 중 오류가 발생했습니다.'
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