const AuthService = require('../services/AuthService');

// AuthService 인스턴스
const authService = new AuthService();

// 세션 검증 및 사용자 정보 로드 미들웨어
const loadUser = async (req, res, next) => {
    try {
        if (req.session && req.session.userId) {
            const user = await authService.validateSession(req.session);
            if (user) {
                req.user = user;
                res.locals.user = user;
            } else {
                // 세션이 유효하지 않으면 삭제
                req.session.destroy();
            }
        }
        next();
    } catch (error) {
        console.error('사용자 로드 실패:', error);
        next();
    }
};

// 로그인 필요 미들웨어
const requireLogin = (req, res, next) => {
    if (!req.user) {
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(401).json({ error: '로그인이 필요합니다.' });
        }
        return res.redirect('/auth/login');
    }
    next();
};

// 관리자 권한 필요 미들웨어
const requireAdmin = async (req, res, next) => {
    if (!req.user) {
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(401).json({ error: '로그인이 필요합니다.' });
        }
        return res.redirect('/auth/login');
    }

    try {
        const hasPermission = await authService.checkPermission(req.user.id, 'admin_site');
        if (!hasPermission) {
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
            }
            return res.status(403).render('pages/error', {
                title: '접근 권한 없음',
                error: {
                    status: 403,
                    message: '관리자 권한이 필요합니다.'
                }
            });
        }
        next();
    } catch (error) {
        console.error('권한 확인 오류:', error);
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(500).json({ error: '권한 확인 중 오류가 발생했습니다.' });
        }
        return res.status(500).render('pages/error', {
            title: '서버 오류',
            error: {
                status: 500,
                message: '권한 확인 중 오류가 발생했습니다.'
            }
        });
    }
};

// 모더레이터 권한 필요 미들웨어
const requireModerator = (categoryId = null) => {
    return async (req, res, next) => {
        if (!req.user) {
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.status(401).json({ error: '로그인이 필요합니다.' });
            }
            return res.redirect('/auth/login');
        }

        try {
            // categoryId가 파라미터에서 오는 경우 처리
            const targetCategoryId = categoryId || req.params.categoryId || req.body.categoryId;

            const hasPermission = await authService.checkPermission(
                req.user.id,
                'moderate_category',
                targetCategoryId
            );

            if (!hasPermission) {
                if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                    return res.status(403).json({ error: '모더레이터 권한이 필요합니다.' });
                }
                return res.status(403).render('pages/error', {
                    title: '접근 권한 없음',
                    error: {
                        status: 403,
                        message: '모더레이터 권한이 필요합니다.'
                    }
                });
            }
            next();
        } catch (error) {
            console.error('모더레이터 권한 확인 오류:', error);
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.status(500).json({ error: '권한 확인 중 오류가 발생했습니다.' });
            }
            return res.status(500).render('pages/error', {
                title: '서버 오류',
                error: {
                    status: 500,
                    message: '권한 확인 중 오류가 발생했습니다.'
                }
            });
        }
    };
};

// 게시글 작성자 또는 모더레이터 권한 확인
const requireOwnerOrModerator = (getResourceOwner, categoryId = null) => {
    return async (req, res, next) => {
        if (!req.user) {
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.status(401).json({ error: '로그인이 필요합니다.' });
            }
            return res.redirect('/auth/login');
        }

        try {
            // 슈퍼 관리자는 모든 권한 보유
            const isAdmin = await authService.checkPermission(req.user.id, 'admin_site');
            if (isAdmin) {
                return next();
            }

            // 리소스 소유자 확인
            const ownerId = await getResourceOwner(req);

            if (req.user.id === ownerId) {
                return next();
            }

            // 모더레이터 권한 확인
            const targetCategoryId = categoryId || req.params.categoryId || req.body.categoryId;
            const isModerator = await authService.checkPermission(
                req.user.id,
                'moderate_category',
                targetCategoryId
            );

            if (isModerator) {
                return next();
            }

            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.status(403).json({ error: '권한이 없습니다.' });
            }

            return res.status(403).render('pages/error', {
                title: '접근 권한 없음',
                error: {
                    status: 403,
                    message: '해당 작업을 수행할 권한이 없습니다.'
                }
            });
        } catch (error) {
            console.error('권한 확인 오류:', error);
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.status(500).json({ error: '권한 확인 중 오류가 발생했습니다.' });
            }

            return res.status(500).render('pages/error', {
                title: '서버 오류',
                error: {
                    status: 500,
                    message: '권한 확인 중 오류가 발생했습니다.'
                }
            });
        }
    };
};

// 특정 권한 확인 미들웨어 (범용)
const requirePermission = (action, resourceId = null) => {
    return async (req, res, next) => {
        if (!req.user) {
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.status(401).json({ error: '로그인이 필요합니다.' });
            }
            return res.redirect('/auth/login');
        }

        try {
            const targetResourceId = resourceId || req.params.categoryId || req.body.categoryId;
            const hasPermission = await authService.checkPermission(
                req.user.id,
                action,
                targetResourceId
            );

            if (!hasPermission) {
                if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                    return res.status(403).json({ error: '권한이 없습니다.' });
                }
                return res.status(403).render('pages/error', {
                    title: '접근 권한 없음',
                    error: {
                        status: 403,
                        message: '해당 작업을 수행할 권한이 없습니다.'
                    }
                });
            }
            next();
        } catch (error) {
            console.error('권한 확인 오류:', error);
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.status(500).json({ error: '권한 확인 중 오류가 발생했습니다.' });
            }
            return res.status(500).render('pages/error', {
                title: '서버 오류',
                error: {
                    status: 500,
                    message: '권한 확인 중 오류가 발생했습니다.'
                }
            });
        }
    };
};

module.exports = {
    loadUser,
    requireLogin,
    requireAdmin,
    requireModerator,
    requireOwnerOrModerator,
    requirePermission,
    authService
};