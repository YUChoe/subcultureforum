const { marked } = require('marked');
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

// DOMPurify 설정을 위한 JSDOM 윈도우 생성
const window = new JSDOM('').window;
const purify = DOMPurify(window);

// 사용자 마크다운에서 허용하는 코드 블록 언어 클래스 (marked 가 ```js 에 붙이는 language-js 등)
const SAFE_CODE_CLASS = /^language-[a-z0-9_+#-]+$/i;
const DATA_URL = /^[\s\u0000-\u001f]*data:/i;

purify.addHook('uponSanitizeAttribute', (node, data) => {
    // data: URL 은 링크/이미지 등 모든 URL 속성에서 차단
    if (['href', 'src', 'xlink:href', 'action', 'formaction'].includes(data.attrName) && DATA_URL.test(data.attrValue)) {
        data.keepAttr = false;
        return;
    }
    // class 는 <code class="language-xxx"> 만 허용 (사이트 CSS 클래스 재사용으로 UI 를 위장하는 것 방지)
    if (data.attrName === 'class') {
        const ok = node.nodeName === 'CODE' && SAFE_CODE_CLASS.test(data.attrValue);
        data.keepAttr = ok;
    }
});

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
                'class' // uponSanitizeAttribute 훅에서 code 의 language-* 만 남긴다 (id 는 DOM clobbering 방지를 위해 불허)
            ],
            ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
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
        // 태그 제거 후 marked 가 만든 HTML 엔티티를 원문으로 되돌린다 (출력 시 뷰에서 이스케이프)
        const plainText = html.replace(/<[^>]*>/g, '')
            .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
            .replace(/&amp;/g, '&');

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