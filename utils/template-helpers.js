const { escapeHtml: escapeText } = require('./markdown');

/**
 * EJS 템플릿 문자열 안에서 사용자 입력을 안전하게 출력하기 위한 헬퍼
 * (app.locals 로 등록되어 모든 뷰에서 사용 가능)
 */

// HTML 텍스트/속성값용 이스케이프. null/undefined/숫자도 문자열로 변환해 처리한다.
function escapeHtml(value) {
    if (value === null || value === undefined) {
        return '';
    }
    return escapeText(String(value));
}

// onclick="fn(${jsAttr(value)})" 처럼 HTML 속성 안의 JS 인자로 쓸 값
// JSON 문자열로 만든 뒤 HTML 이스케이프한다 (따옴표가 &quot; 가 되어 속성을 벗어날 수 없음)
function jsAttr(value) {
    return escapeHtml(JSON.stringify(value === undefined ? null : value));
}

// <script> 블록 안의 JS 리터럴로 쓸 값. </script>, <!-- 등으로 블록을 닫지 못하도록 이스케이프한다.
function jsString(value) {
    return JSON.stringify(value === undefined ? null : value)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}

module.exports = { escapeHtml, jsAttr, jsString };