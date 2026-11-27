const crypto = require('crypto');

// CSRF 방어: 세션에 저장한 토큰(synchronizer token)을 상태 변경 요청(POST/PUT/PATCH/DELETE)마다 검증한다.
// 토큰은 다음 중 하나로 전달한다.
//  - HTML 폼: hidden input `_csrf`
//  - multipart 폼(multer 가 body 를 파싱하기 전에 검증해야 함): 폼 action 의 쿼리스트링 `?_csrf=`
//  - fetch/XHR: `X-CSRF-Token` 헤더 (레이아웃의 fetch 래퍼가 자동으로 추가)

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

function getToken(req) {
    if (!req.session) {
        return '';
    }
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    return req.session.csrfToken;
}

function tokensMatch(expected, provided) {
    if (typeof expected !== 'string' || typeof provided !== 'string' || !expected || expected.length !== provided.length) {
        return false;
    }
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

function csrfProtection(req, res, next) {
    // 템플릿에서 `${csrfToken()}` 로 호출한다. 호출될 때만 세션에 토큰이 생성되므로
    // 폼이 없는 페이지를 보는 비로그인 방문자에게는 세션이 만들어지지 않는다.
    res.locals.csrfToken = () => getToken(req);

    if (SAFE_METHODS.includes(req.method)) {
        return next();
    }

    const provided = req.get('x-csrf-token')
        || (req.body && req.body._csrf)
        || (req.query && req.query._csrf);
    const expected = req.session && req.session.csrfToken;

    if (tokensMatch(expected, provided)) {
        return next();
    }

    const message = '요청을 확인할 수 없습니다. 페이지를 새로고침한 뒤 다시 시도해주세요.';
    const wantsJson = req.xhr
        || (req.headers.accept && req.headers.accept.indexOf('json') > -1)
        || (req.is && req.is('application/json'));

    if (wantsJson) {
        return res.status(403).json({ error: message });
    }

    return res.status(403).render('pages/error', {
        title: '잘못된 요청',
        error: { status: 403, message }
    });
}

module.exports = { csrfProtection, getToken };
