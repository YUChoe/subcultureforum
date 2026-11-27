const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

// 요청 제한 (메모리 저장소: 서버 재시작 시 초기화되며 프로세스 1개 기준으로 동작한다)
// 제한에 걸리면 429 와 함께 친절한 메시지를 보여준다. onLimit(req, res, message) 로 각 화면에 맞게 응답한다.

function wantsJson(req) {
    return req.xhr
        || (req.headers.accept && req.headers.accept.indexOf('json') > -1)
        || (req.is && req.is('application/json'));
}

function createLimiter({ windowMs, limit, message, onLimit, successStatus }) {
    return rateLimit({
        windowMs,
        limit,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        // 로그인한 사용자는 계정 단위, 그 외에는 IP 단위로 제한
        keyGenerator: (req) => (req.user ? `user:${req.user.id}` : ipKeyGenerator(req.ip)),
        // successStatus 가 지정되면 해당 상태 코드(성공)의 요청은 횟수에서 제외한다 (예: 로그인 성공)
        skipSuccessfulRequests: !!successStatus,
        requestWasSuccessful: (req, res) => res.statusCode === successStatus,
        handler: (req, res) => {
            const retryAfter = res.getHeader('Retry-After');
            const minutes = retryAfter ? Math.max(1, Math.ceil(Number(retryAfter) / 60)) : Math.ceil(windowMs / 60000);
            const text = `${message} 약 ${minutes}분 후에 다시 시도해주세요.`;

            if (wantsJson(req)) {
                return res.status(429).json({ error: text });
            }
            if (onLimit) {
                return onLimit(req, res, text);
            }
            return res.status(429).render('pages/error', {
                title: '요청이 너무 많습니다',
                error: { status: 429, message: text }
            });
        }
    });
}

module.exports = { createLimiter };
