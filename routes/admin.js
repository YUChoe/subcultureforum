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
        const role = req.query.role || null;

        const result = await adminService.getUserList(req.user.id, {
            page: page,
            limit: 20,
            search: search,
            role: role
        });

        res.render('pages/admin/users', {
            title: '사용자 관리',
            users: result.users,
            pagination: result.pagination,
            filters: result.filters
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

// 모더레이터 권한 관리 페이지
router.get('/moderators', requireAdmin, async (req, res) => {
    try {
        const permissions = await adminService.getAllModeratorPermissions(req.user.id);
        const subforums = await adminService.getAllCategories(req.user.id, false);
        const usersResult = await adminService.getUserList(req.user.id, { limit: 1000 });

        // 서브포럼별로 모더레이터 그룹화
        const subforumModerators = {};
        subforums.forEach(subforum => {
            subforumModerators[subforum.id] = {
                subforum: subforum,
                moderators: permissions.filter(p => p.category_id === subforum.id)
            };
        });

        res.render('pages/admin/moderators', {
            title: '모더레이터 권한 관리',
            subforumModerators: subforumModerators,
            subforums: subforums,
            users: usersResult.users,
            permissions: permissions
        });
    } catch (error) {
        console.error('모더레이터 권한 관리 페이지 오류:', error);
        res.status(500).render('pages/error', {
            title: '서버 오류',
            error: {
                status: 500,
                message: '모더레이터 권한 관리 페이지를 로드하는 중 오류가 발생했습니다.'
            }
        });
    }
});

// 모더레이터 권한 부여
router.post('/moderators/assign', requireAdmin, [
    body('userId')
        .isInt({ min: 1 })
        .withMessage('올바른 사용자 ID를 입력해주세요'),
    body('categoryId')
        .isInt({ min: 1 })
        .withMessage('올바른 서브포럼 ID를 입력해주세요')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const { userId, categoryId } = req.body;

        await adminService.assignModerator(req.user.id, parseInt(userId), parseInt(categoryId));

        res.json({
            success: true,
            message: '모더레이터 권한이 성공적으로 부여되었습니다.'
        });
    } catch (error) {
        console.error('모더레이터 권한 부여 오류:', error);
        res.status(500).json({
            error: error.message || '모더레이터 권한 부여 중 오류가 발생했습니다.'
        });
    }
});

// 모더레이터 권한 제거
router.post('/moderators/remove', requireAdmin, [
    body('userId')
        .isInt({ min: 1 })
        .withMessage('올바른 사용자 ID를 입력해주세요'),
    body('categoryId')
        .isInt({ min: 1 })
        .withMessage('올바른 서브포럼 ID를 입력해주세요')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const { userId, categoryId } = req.body;

        await adminService.removeModerator(req.user.id, parseInt(userId), parseInt(categoryId));

        res.json({
            success: true,
            message: '모더레이터 권한이 성공적으로 제거되었습니다.'
        });
    } catch (error) {
        console.error('모더레이터 권한 제거 오류:', error);
        res.status(500).json({
            error: error.message || '모더레이터 권한 제거 중 오류가 발생했습니다.'
        });
    }
});

// 사용자별 모더레이터 권한 조회
router.get('/moderators/user/:userId', requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const permissions = await adminService.getUserModeratorPermissions(req.user.id, userId);

        res.json({
            success: true,
            permissions: permissions
        });
    } catch (error) {
        console.error('사용자 모더레이터 권한 조회 오류:', error);
        res.status(500).json({
            error: error.message || '권한 조회 중 오류가 발생했습니다.'
        });
    }
});

// 서브포럼별 모더레이터 조회
router.get('/moderators/subforum/:categoryId', requireAdmin, async (req, res) => {
    try {
        const categoryId = parseInt(req.params.categoryId);
        const moderators = await adminService.getCategoryModerators(req.user.id, categoryId);

        res.json({
            success: true,
            moderators: moderators
        });
    } catch (error) {
        console.error('서브포럼 모더레이터 조회 오류:', error);
        res.status(500).json({
            error: error.message || '모더레이터 조회 중 오류가 발생했습니다.'
        });
    }
});

// 사용자 차단
router.post('/users/:userId/ban', requireAdmin, [
    body('reason')
        .isLength({ min: 1, max: 500 })
        .withMessage('차단 사유는 1-500자 사이여야 합니다')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const userId = parseInt(req.params.userId);
        const { reason, duration, customDate } = req.body;

        // 차단 만료일 계산
        let expiresAt = null;
        if (duration !== 'permanent') {
            const now = new Date();
            switch (duration) {
                case '1day':
                    expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                    break;
                case '7days':
                    expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                    break;
                case '30days':
                    expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                    break;
                case '90days':
                    expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
                    break;
                case 'custom':
                    if (!customDate) {
                        return res.status(400).json({ error: '사용자 지정 날짜를 입력해주세요.' });
                    }
                    expiresAt = new Date(customDate);
                    if (expiresAt <= now) {
                        return res.status(400).json({ error: '만료일은 현재 시간 이후여야 합니다.' });
                    }
                    break;
            }
        }

        const ban = await adminService.banUser(req.user.id, userId, reason, expiresAt);

        res.json({
            success: true,
            message: '사용자가 성공적으로 차단되었습니다.',
            ban: ban
        });
    } catch (error) {
        console.error('사용자 차단 오류:', error);
        res.status(500).json({
            error: error.message || '사용자 차단 중 오류가 발생했습니다.'
        });
    }
});

// 사용자 차단 해제
router.post('/users/:userId/unban', requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);

        await adminService.unbanUser(req.user.id, userId);

        res.json({
            success: true,
            message: '사용자 차단이 성공적으로 해제되었습니다.'
        });
    } catch (error) {
        console.error('사용자 차단 해제 오류:', error);
        res.status(500).json({
            error: error.message || '사용자 차단 해제 중 오류가 발생했습니다.'
        });
    }
});

// 사용자 차단 정보 조회
router.get('/users/:userId/ban', requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const ban = await adminService.getUserBanInfo(req.user.id, userId);

        res.json({
            success: true,
            ban: ban
        });
    } catch (error) {
        console.error('차단 정보 조회 오류:', error);
        res.status(500).json({
            error: error.message || '차단 정보 조회 중 오류가 발생했습니다.'
        });
    }
});

// 차단 목록 조회
router.get('/bans', requireAdmin, async (req, res) => {
    try {
        const includeInactive = req.query.includeInactive === 'true';
        const bans = await adminService.getAllBans(req.user.id, includeInactive);

        res.render('pages/admin/bans', {
            title: '차단 관리',
            bans: bans,
            includeInactive: includeInactive
        });
    } catch (error) {
        console.error('차단 목록 조회 오류:', error);
        res.status(500).render('pages/error', {
            title: '서버 오류',
            error: {
                status: 500,
                message: '차단 목록을 로드하는 중 오류가 발생했습니다.'
            }
        });
    }
});

module.exports = router;