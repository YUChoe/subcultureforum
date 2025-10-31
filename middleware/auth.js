// 로그인 필요 미들웨어
const requireLogin = (req, res, next) => {
    if (!req.session.user) {
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(401).json({ error: '로그인이 필요합니다.' });
        }
        return res.redirect('/auth/login');
    }
    next();
};

// 관리자 권한 필요 미들웨어
const requireAdmin = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'super_admin') {
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
};

// 모더레이터 권한 필요 미들웨어
const requireModerator = (categoryId = null) => {
    return (req, res, next) => {
        if (!req.session.user) {
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.status(401).json({ error: '로그인이 필요합니다.' });
            }
            return res.redirect('/auth/login');
        }

        const user = req.session.user;

        // 슈퍼 관리자는 모든 권한 보유
        if (user.role === 'super_admin') {
            return next();
        }

        // 모더레이터 권한 확인 (실제 구현에서는 DB에서 확인)
        if (user.role === 'moderator') {
            // TODO: 특정 카테고리에 대한 모더레이터 권한 확인
            return next();
        }

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
    };
};

// 게시글 작성자 또는 모더레이터 권한 확인
const requireOwnerOrModerator = (getResourceOwner) => {
    return async (req, res, next) => {
        if (!req.session.user) {
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.status(401).json({ error: '로그인이 필요합니다.' });
            }
            return res.redirect('/auth/login');
        }

        const user = req.session.user;

        // 슈퍼 관리자는 모든 권한 보유
        if (user.role === 'super_admin') {
            return next();
        }

        try {
            // 리소스 소유자 확인
            const ownerId = await getResourceOwner(req);

            if (user.id === ownerId) {
                return next();
            }

            // 모더레이터 권한 확인
            if (user.role === 'moderator') {
                // TODO: 해당 카테고리의 모더레이터인지 확인
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

module.exports = {
    requireLogin,
    requireAdmin,
    requireModerator,
    requireOwnerOrModerator
};