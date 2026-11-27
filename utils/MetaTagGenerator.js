const { extractPlainText } = require('./markdown');

/**
 * 페이지 정보 객체를 <head> 에 출력할 메타 태그 데이터로 변환한다.
 * 문자열은 이스케이프하지 않고 그대로 담는다. 출력 시 뷰(partials/seo-meta.ejs)에서 escapeHtml 로 이스케이프한다.
 */
class MetaTagGenerator {
    /**
     * @param {Object} siteConfig - { name, description, url, defaultImage }
     */
    constructor(siteConfig = {}) {
        this.siteName = siteConfig.name || 'NOIZZE';
        this.siteDescription = siteConfig.description || 'NOIZZE 커뮤니티 포럼';
        this.siteUrl = (siteConfig.url || 'http://localhost:8000').replace(/\/+$/, '');
        this.defaultImage = siteConfig.defaultImage || {
            url: `${this.siteUrl}/images/og-default.png`,
            width: 1200,
            height: 630,
            alt: this.siteName
        };
    }

    /**
     * 사이트 기준 절대 URL 로 변환한다. 허용하지 않는 스킴(javascript:, data: 등)이면 null.
     * @param {string} value - 경로(/path) 또는 http(s) URL
     * @returns {string|null}
     */
    absoluteUrl(value) {
        if (typeof value !== 'string' || !value.trim()) {
            return null;
        }
        try {
            const url = new URL(value.trim(), this.siteUrl + '/');
            if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                return null;
            }
            return url.href;
        } catch (error) {
            return null;
        }
    }

    /**
     * 텍스트를 최대 길이로 줄인다 (코드 포인트 기준, 넘으면 말줄임표).
     */
    truncate(text, maxLength = 160) {
        const chars = Array.from(String(text || '').replace(/\s+/g, ' ').trim());
        if (chars.length <= maxLength) {
            return chars.join('');
        }
        return chars.slice(0, maxLength - 1).join('').trimEnd() + '…';
    }

    /**
     * 마크다운/HTML 본문에서 description 용 플레인 텍스트를 만든다.
     * @param {string} markdown - 게시글 원문
     * @param {number} maxLength - 최대 길이 (기본 160)
     */
    extractDescription(markdown, maxLength = 160) {
        // extractPlainText 는 marked 로 HTML 변환 후 태그를 제거하고 엔티티를 되돌린다.
        // 자체 말줄임(...)을 피하려고 충분히 큰 값을 넘기고 여기서 자른다.
        const plain = extractPlainText(markdown, Number.MAX_SAFE_INTEGER);
        return this.truncate(plain, maxLength);
    }

    /**
     * 페이지 정보를 메타 태그 데이터로 정규화한다.
     * @param {Object} page
     * @param {string} page.title - <title> 전체 문자열
     * @param {string} [page.description]
     * @param {string} [page.canonical] - 절대 URL
     * @param {string} [page.robots] - 기본 'index, follow'
     * @param {string} [page.type] - og:type (website | article)
     * @param {Object} [page.image] - { url, width, height, alt }
     * @param {string} [page.prev] - 이전 페이지 절대 URL
     * @param {string} [page.next] - 다음 페이지 절대 URL
     * @param {Object} [page.article] - { publishedTime, modifiedTime, section }
     * @param {Array<Object>} [page.jsonLd] - JSON-LD 객체 목록
     */
    generate(page) {
        const title = page.title || this.siteName;
        const description = page.description || this.siteDescription;
        const image = page.image || this.defaultImage;
        const og = [
            ['og:site_name', this.siteName],
            ['og:locale', 'ko_KR'],
            ['og:type', page.type || 'website'],
            ['og:title', title],
            ['og:description', description]
        ];
        if (page.canonical) {
            og.push(['og:url', page.canonical]);
        }
        og.push(['og:image', image.url]);
        if (image.width && image.height) {
            og.push(['og:image:width', String(image.width)], ['og:image:height', String(image.height)]);
        }
        if (image.alt) {
            og.push(['og:image:alt', image.alt]);
        }
        if (page.article) {
            const { publishedTime, modifiedTime, section } = page.article;
            if (publishedTime) og.push(['article:published_time', publishedTime]);
            if (modifiedTime) og.push(['article:modified_time', modifiedTime]);
            if (section) og.push(['article:section', section]);
        }

        const twitter = [
            ['twitter:card', 'summary_large_image'],
            ['twitter:title', title],
            ['twitter:description', description],
            ['twitter:image', image.url]
        ];

        return {
            title,
            description,
            canonical: page.canonical || null,
            robots: page.robots || 'index, follow',
            prev: page.prev || null,
            next: page.next || null,
            og,
            twitter,
            jsonLd: page.jsonLd || []
        };
    }
}

module.exports = MetaTagGenerator;
