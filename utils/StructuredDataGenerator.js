/**
 * schema.org JSON-LD 객체를 만든다 (직렬화는 뷰에서 jsString 헬퍼로 한다).
 * URL 은 모두 절대 URL 로 받는다.
 */
class StructuredDataGenerator {
    constructor(siteConfig = {}) {
        this.siteName = siteConfig.name || 'NOIZZE';
        this.siteUrl = (siteConfig.url || 'http://localhost:8000').replace(/\/+$/, '');
    }

    /**
     * 메인 페이지용 WebSite (사이트 내 검색 SearchAction 포함)
     * @param {string} searchUrlBase - 검색 페이지 절대 URL
     */
    generateWebSiteSchema(searchUrlBase) {
        return {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: this.siteName,
            url: this.siteUrl + '/',
            inLanguage: 'ko',
            potentialAction: {
                '@type': 'SearchAction',
                target: {
                    '@type': 'EntryPoint',
                    urlTemplate: `${searchUrlBase}?q={search_term_string}`
                },
                'query-input': 'required name=search_term_string'
            }
        };
    }

    /**
     * 게시글 페이지용 DiscussionForumPosting
     * @param {Object} data
     * @param {string} data.headline
     * @param {string} data.url - 게시글 절대 URL
     * @param {string} data.text - 본문 플레인 텍스트
     * @param {string} data.authorName
     * @param {string} [data.datePublished] - ISO 8601
     * @param {string} [data.dateModified] - ISO 8601
     * @param {string} [data.image] - 절대 URL
     * @param {number} [data.commentCount]
     */
    generatePostSchema(data) {
        const schema = {
            '@context': 'https://schema.org',
            '@type': 'DiscussionForumPosting',
            '@id': data.url,
            mainEntityOfPage: data.url,
            url: data.url,
            headline: data.headline,
            author: { '@type': 'Person', name: data.authorName },
            inLanguage: 'ko',
            isPartOf: { '@type': 'WebSite', name: this.siteName, url: this.siteUrl + '/' }
        };
        if (data.text) schema.text = data.text;
        if (data.datePublished) schema.datePublished = data.datePublished;
        if (data.dateModified) schema.dateModified = data.dateModified;
        if (data.image) schema.image = data.image;
        if (Number.isInteger(data.commentCount)) schema.commentCount = data.commentCount;
        return schema;
    }

    /**
     * 카테고리(서브포럼) 페이지용 CollectionPage
     */
    generateCollectionPageSchema({ name, description, url }) {
        return {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name,
            description,
            url,
            inLanguage: 'ko',
            isPartOf: { '@type': 'WebSite', name: this.siteName, url: this.siteUrl + '/' }
        };
    }

    /**
     * BreadcrumbList
     * @param {Array<{name: string, url: string}>} crumbs - 절대 URL
     */
    generateBreadcrumbSchema(crumbs) {
        return {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: crumbs.map((crumb, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: crumb.name,
                item: crumb.url
            }))
        };
    }
}

module.exports = StructuredDataGenerator;
