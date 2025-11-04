const { marked } = require('marked');
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

// DOMPurify 설정을 위한 JSDOM 윈도우 생성
const window = new JSDOM('').window;
const purify = DOMPurify(window);

// marked 옵션 설정
marked.setOptions({
    breaks: true, // 줄바꿈을 <br>로 변환
    gfm: true, // GitHub Flavored Markdown 지원
    sanitize: false, // DOMPurify로 별도 처리
    smartLists: true,
    smartypants: false
});

/**
 * 마크다운을 안전한 HTML로 변환
 * @param {string} markdown - 마크다운 텍스트
 * @returns {string} 안전한 HTML
 */
function renderMarkdown(markdown) {
    if (!markdown || typeof markdown !== 'string') {
        return '';
    }

    try {
        // 마크다운을 HTML로 변환
        const rawHtml = marked(markdown);

        // XSS 공격 방지를 위한 HTML 정화
        const cleanHtml = purify.sanitize(rawHtml, {
            ALLOWED_TAGS: [
                'p', 'br', 'strong', 'em', 'u', 's', 'del', 'ins',
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                'ul', 'ol', 'li',
                'blockquote', 'pre', 'code',
                'a', 'img',
                'table', 'thead', 'tbody', 'tr', 'th', 'td',
                'hr'
            ],
            ALLOWED_ATTR: [
                'href', 'title', 'alt', 'src',
                'class', 'id'
            ],
            ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
        });

        return cleanHtml;
    } catch (error) {
        console.error('마크다운 렌더링 실패:', error);
        // 오류 발생 시 원본 텍스트를 HTML 이스케이프하여 반환
        return escapeHtml(markdown);
    }
}

/**
 * HTML 특수문자 이스케이프
 * @param {string} text - 이스케이프할 텍스트
 * @returns {string} 이스케이프된 텍스트
 */
function escapeHtml(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }

    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };

    return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * 마크다운 텍스트에서 플레인 텍스트 추출 (미리보기용)
 * @param {string} markdown - 마크다운 텍스트
 * @param {number} maxLength - 최대 길이
 * @returns {string} 플레인 텍스트
 */
function extractPlainText(markdown, maxLength = 150) {
    if (!markdown || typeof markdown !== 'string') {
        return '';
    }

    try {
        // 마크다운을 HTML로 변환
        const html = marked(markdown);

        // HTML 태그 제거
        const plainText = html.replace(/<[^>]*>/g, '');

        // 연속된 공백을 하나로 변환
        const cleanText = plainText.replace(/\s+/g, ' ').trim();

        if (cleanText.length <= maxLength) {
            return cleanText;
        }

        return cleanText.substring(0, maxLength) + '...';
    } catch (error) {
        console.error('플레인 텍스트 추출 실패:', error);
        return markdown.substring(0, maxLength) + '...';
    }
}

module.exports = {
    renderMarkdown,
    escapeHtml,
    extractPlainText
};