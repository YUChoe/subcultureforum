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

// 서브포럼별 모더레이터 권한 필요 미들웨어
const requireModerator = (categoryId = null) => {
    return async (req, res, next) => {
        if (!req.user) {
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.status(401).json({ error: '로그인이 필요합니다.' });
            }
            return res.redirect('/auth/login');
        }

        try {
            // categoryId 우선순위: 매개변수 > URL 파라미터 > 요청 본문
            let targetCategoryId = categoryId || req.params.categoryId || req.body.categoryId;

            // URL에서 카테고리 ID 추출 (예: /category/123/post/456)
            if (!targetCategoryId && req.path) {
                const categoryMatch = req.path.match(/^\/category\/(\d+)/);
                if (categoryMatch) {
                    targetCategoryId = parseInt(categoryMatch[1]);
                }
            }

            if (!targetCategoryId) {
                if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                    return res.status(400).json({ error: '서브포럼 ID가 필요합니다.' });
                }
                return res.status(400).render('pages/error', {
                    title: '잘못된 요청',
                    error: {
                        status: 400,
                        message: '서브포럼 ID가 필요합니다.'
                    }
                });
            }

            const hasPermission = await authService.checkPermission(
                req.user.id,
                'moderate_category',
                targetCategoryId
            );

            if (!hasPermission) {
                if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                    return res.status(403).json({
                        error: `서브포럼 ${targetCategoryId}의 모더레이터 권한이 필요합니다.`
                    });
                }
                return res.status(403).render('pages/error', {
                    title: '접근 권한 없음',
                    error: {
                        status: 403,
                        message: `서브포럼 ${targetCategoryId}의 모더레이터 권한이 필요합니다.`
                    }
                });
            }

            // 권한 확인 성공 시 카테고리 ID를 req 객체에 저장
            req.moderatedCategoryId = targetCategoryId;
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

// 역할 기반 권한 확인 미들웨어
const requireRole = (requiredRole) => {
    return async (req, res, next) => {
        if (!req.user) {
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.status(401).json({ error: '로그인이 필요합니다.' });
            }
            return res.redirect('/auth/login');
        }

        try {
            // 역할 계층 구조: super_admin > moderator > user
            const roleHierarchy = {
                'user': 1,
                'moderator': 2,
                'super_admin': 3
            };

            const userRoleLevel = roleHierarchy[req.user.role] || 0;
            const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

            if (userRoleLevel < requiredRoleLevel) {
                if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                    return res.status(403).json({
                        error: `${requiredRole} 권한이 필요합니다.`
                    });
                }
                return res.status(403).render('pages/error', {
                    title: '접근 권한 없음',
                    error: {
                        status: 403,
                        message: `${requiredRole} 권한이 필요합니다.`
                    }
                });
            }
            next();
        } catch (error) {
            console.error('역할 확인 오류:', error);
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

// 슈퍼 관리자 권한 확인 미들웨어
const requireSuperAdmin = requireRole('super_admin');

// 모더레이터 이상 권한 확인 미들웨어
const requireModeratorOrAbove = requireRole('moderator');

// 라우터별 접근 제어 설정
const routePermissions = {
    // 관리자 전용 라우트
    '/admin': 'super_admin',
    '/admin/*': 'super_admin',

    // 모더레이터 이상 접근 가능 라우트 (카테고리별)
    '/moderate': 'moderator',
    '/moderate/*': 'moderator',
    '/category/*/moderate': 'moderator',
    '/category/*/moderate/*': 'moderator',

    // 로그인 사용자 전용 라우트 (서브포럼 구조)
    '/category/*/post/new': 'user',
    '/category/*/post/*/edit': 'user',
    '/category/*/comment/new': 'user',
    '/category/*/comment/*/edit': 'user',
    '/profile': 'user',
    '/profile/*': 'user'
};

// 라우트 기반 권한 확인 미들웨어
const checkRoutePermission = (req, res, next) => {
    const path = req.path;


    // 공개 라우트 (권한 확인 불필요)
    const publicRoutes = [
        '/',
        '/auth/login',
        '/auth/register',
        '/auth/logout',
        '/category',
        '/search'
    ];

    // 서브포럼 및 게시글 조회는 공개
    const publicViewPatterns = [
        /^\/category\/\d+$/, // 카테고리 목록 조회
        /^\/category\/\d+\/post\/\d+$/, // 게시글 조회 (서브포럼/게시글)
        /^\/category\/\d+\/posts$/, // 카테고리 내 게시글 목록
        /^\/category\/\d+\/posts\/page\/\d+$/ // 페이지네이션
    ];

    // 공개 조회 패턴 확인
    const isPublicView = publicViewPatterns.some(pattern => pattern.test(path));
    if (isPublicView) {
        return next();
    }

    // 공개 라우트인지 확인
    const isPublicRoute = publicRoutes.some(route => {
        if (route.endsWith('*')) {
            return path.startsWith(route.slice(0, -1));
        }
        return path === route || path.startsWith(route + '/');
    });

    if (isPublicRoute) {
        return next();
    }

    // 권한이 필요한 라우트 확인
    let requiredRole = null;
    let needsCategoryModerator = false;

    // 서브포럼별 모더레이터 권한이 필요한 패턴들
    const moderatorPatterns = [
        /^\/category\/\d+\/moderate/,
        /^\/category\/\d+\/post\/\d+\/delete$/,
        /^\/category\/\d+\/post\/\d+\/pin$/,
        /^\/category\/\d+\/post\/\d+\/lock$/,
        /^\/category\/\d+\/comment\/\d+\/delete$/
    ];

    // 모더레이터 권한 패턴 확인
    const needsModeratorCheck = moderatorPatterns.some(pattern => pattern.test(path));
    if (needsModeratorCheck) {
        return requireCategoryModerator(req, res, next);
    }

    // 일반 역할 기반 권한 확인
    for (const [routePattern, role] of Object.entries(routePermissions)) {
        if (routePattern.endsWith('*')) {
            if (path.startsWith(routePattern.slice(0, -1))) {
                requiredRole = role;
                break;
            }
        } else if (path === routePattern) {
            requiredRole = role;
            break;
        }
    }

    if (requiredRole) {
        return requireRole(requiredRole)(req, res, next);
    }

    // 기본적으로 로그인 필요
    return requireLogin(req, res, next);
};

// 사용자 차단 상태 확인 미들웨어
const checkUserBan = async (req, res, next) => {
    if (!req.user) {
        return next();
    }

    try {
        const isBanned = await authService.isUserBanned(req.user.id);

        if (isBanned) {
            // 세션 삭제
            req.session.destroy();

            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.status(403).json({
                    error: '계정이 차단되었습니다. 관리자에게 문의하세요.'
                });
            }

            return res.status(403).render('pages/error', {
                title: '계정 차단',
                error: {
                    status: 403,
                    message: '계정이 차단되었습니다. 관리자에게 문의하세요.'
                }
            });
        }

        next();
    } catch (error) {
        console.error('사용자 차단 상태 확인 오류:', error);
        next();
    }
};

// 카테고리별 모더레이터 권한 확인 (동적)
const requireCategoryModerator = async (req, res, next) => {
    if (!req.user) {
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(401).json({ error: '로그인이 필요합니다.' });
        }
        return res.redirect('/auth/login');
    }

    try {
        const categoryId = req.params.categoryId || req.body.categoryId;

        if (!categoryId) {
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.status(400).json({ error: '카테고리 ID가 필요합니다.' });
            }
            return res.status(400).render('pages/error', {
                title: '잘못된 요청',
                error: {
                    status: 400,
                    message: '카테고리 ID가 필요합니다.'
                }
            });
        }

        // 슈퍼 관리자는 모든 카테고리에 접근 가능
        const isAdmin = await authService.checkPermission(req.user.id, 'admin_site');
        if (isAdmin) {
            return next();
        }

        // 해당 카테고리의 모더레이터 권한 확인
        const isModerator = await authService.checkPermission(
            req.user.id,
            'moderate_category',
            categoryId
        );

        if (!isModerator) {
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.status(403).json({
                    error: '해당 카테고리의 모더레이터 권한이 필요합니다.'
                });
            }
            return res.status(403).render('pages/error', {
                title: '접근 권한 없음',
                error: {
                    status: 403,
                    message: '해당 카테고리의 모더레이터 권한이 필요합니다.'
                }
            });
        }

        next();
    } catch (error) {
        console.error('카테고리 모더레이터 권한 확인 오류:', error);
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

module.exports = {
    loadUser,
    requireLogin,
    requireAdmin,
    requireModerator,
    requireOwnerOrModerator,
    requirePermission,
    requireRole,
    requireSuperAdmin,
    requireModeratorOrAbove,
    checkRoutePermission,
    checkUserBan,
    requireCategoryModerator,
    authService
};