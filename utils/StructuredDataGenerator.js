/**
 * StructuredDataGenerator
 * JSON-LD 형식의 구조화된 데이터(Schema.org)를 생성하는 유틸리티 클래스
 */

class StructuredDataGenerator {
    constructor(siteConfig = {}) {
        this.siteName = siteConfig.name || 'NOIZZE';
        this.siteUrl = siteConfig.url || 'http://localhost:8888';
    }

    /**
     * WebSite 스키마 생성 (메인 페이지용)
     * @param {string} siteUrl - 사이트 URL
     * @param {string} siteName - 사이트 이름
     * @returns {Object} WebSite 스키마 객체
     */
    generateWebSiteSchema(siteUrl = this.siteUrl, siteName = this.siteName) {
        return {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            'name': siteName,
            'url': siteUrl,
            'potentialAction': {
                '@type': 'SearchAction',
                'target': {
                    '@type': 'EntryPoint',
                    'urlTemplate': `${siteUrl}/search?q={search_term_string}`
                },
                'query-input': 'required name=search_term_string'
            }
        };
    }

    /**
     * Article 스키마 생성 (게시글 페이지용)
     * @param {Object} post - 게시글 객체
     * @param {Object} author - 작성자 객체
     * @param {string} siteUrl - 사이트 URL
     * @returns {Object} Article 스키마 객체
     */
    generateArticleSchema(post, author, siteUrl = this.siteUrl) {
        const postUrl = `${siteUrl}/forum/${post.category_id}/post/${post.id}`;
        
        return {
            '@context': 'https://schema.org',
            '@type': 'Article',
            'headline': post.title,
            'author': {
                '@type': 'Person',
                'name': author.username || author.name || '익명'
            },
            'datePublished': post.created_at,
            'dateModified': post.updated_at || post.created_at,
            'articleBody': this._stripHtml(post.content),
            'url': postUrl,
            'publisher': {
                '@type': 'Organization',
                'name': this.siteName,
                'url': siteUrl
            }
        };
    }

    /**
     * BreadcrumbList 스키마 생성 (하위 페이지용)
     * @param {Array} breadcrumbs - 빵부스러기 배열 [{name, url}, ...]
     * @param {string} siteUrl - 사이트 URL
     * @returns {Object} BreadcrumbList 스키마 객체
     */
    generateBreadcrumbSchema(breadcrumbs, siteUrl = this.siteUrl) {
        const itemListElement = breadcrumbs.map((crumb, index) => ({
            '@type': 'ListItem',
            'position': index + 1,
            'name': crumb.name,
            'item': crumb.url.startsWith('http') ? crumb.url : `${siteUrl}${crumb.url}`
        }));

        return {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            'itemListElement': itemListElement
        };
    }

    /**
     * CollectionPage 스키마 생성 (카테고리 페이지용)
     * @param {Object} subforum - 서브포럼(카테고리) 객체
     * @param {string} siteUrl - 사이트 URL
     * @returns {Object} CollectionPage 스키마 객체
     */
    generateCollectionPageSchema(subforum, siteUrl = this.siteUrl) {
        const categoryUrl = `${siteUrl}/forum/${subforum.id}`;
        
        return {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            'name': subforum.name,
            'description': subforum.description || `${subforum.name} 카테고리`,
            'url': categoryUrl,
            'isPartOf': {
                '@type': 'WebSite',
                'name': this.siteName,
                'url': siteUrl
            }
        };
    }

    /**
     * SearchResultsPage 스키마 생성 (검색 결과 페이지용)
     * @param {string} query - 검색어
     * @param {Array} results - 검색 결과 배열
     * @param {string} siteUrl - 사이트 URL
     * @returns {Object} SearchResultsPage 스키마 객체
     */
    generateSearchResultsSchema(query, results, siteUrl = this.siteUrl) {
        const searchUrl = `${siteUrl}/search?q=${encodeURIComponent(query)}`;
        
        const schema = {
            '@context': 'https://schema.org',
            '@type': 'SearchResultsPage',
            'name': `"${query}" 검색 결과`,
            'url': searchUrl,
            'mainEntity': {
                '@type': 'ItemList',
                'numberOfItems': results.length
            }
        };

        // 검색 결과가 있으면 itemListElement 추가
        if (results && results.length > 0) {
            schema.mainEntity.itemListElement = results.slice(0, 10).map((result, index) => ({
                '@type': 'ListItem',
                'position': index + 1,
                'url': `${siteUrl}/forum/${result.category_id}/post/${result.id}`,
                'name': result.title
            }));
        }

        return schema;
    }

    /**
     * HTML 태그 제거 헬퍼 함수
     * @param {string} html - HTML 문자열
     * @returns {string} 태그가 제거된 텍스트
     * @private
     */
    _stripHtml(html) {
        if (!html) return '';
        return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }

    /**
     * JSON-LD 스크립트 태그 생성
     * @param {Object} schema - 스키마 객체
     * @returns {string} JSON-LD 스크립트 태그
     */
    toScriptTag(schema) {
        return `<script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script>`;
    }

    /**
     * 여러 스키마를 배열로 결합
     * @param {Array} schemas - 스키마 객체 배열
     * @returns {string} 결합된 JSON-LD 스크립트 태그들
     */
    combineSchemas(schemas) {
        return schemas.map(schema => this.toScriptTag(schema)).join('\n');
    }
}

module.exports = StructuredDataGenerator;
