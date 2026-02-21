/**
 * SEOService
 * SEO 기능의 중앙 관리 서비스
 * 메타 태그, 구조화된 데이터, Canonical URL 생성을 통합 관리
 */

const MetaTagGenerator = require('../utils/MetaTagGenerator');
const StructuredDataGenerator = require('../utils/StructuredDataGenerator');

class SEOService {
    constructor(dbManager, siteConfig = {}) {
        this.dbManager = dbManager;
        this.siteConfig = {
            name: siteConfig.name || process.env.SITE_NAME || 'NOIZZE',
            description: siteConfig.description || process.env.SITE_DESCRIPTION || 'forum.noizze.net - 커뮤니티 포럼',
            url: siteConfig.url || process.env.SITE_URL || 'http://localhost:8888',
            keywords: siteConfig.keywords || process.env.SITE_KEYWORDS || '포럼,커뮤니티,게시판',
            twitterSite: siteConfig.twitterSite || process.env.TWITTER_SITE || '@noizze'
        };

        this.metaGenerator = new MetaTagGenerator(this.siteConfig);
        this.structuredDataGenerator = new StructuredDataGenerator(this.siteConfig);
    }

    /**
     * 페이지별 SEO 데이터 생성 (통합 메서드)
     * @param {string} pageType - 페이지 타입 ('home', 'category', 'post', 'search')
     * @param {Object} data - 페이지 데이터
     * @param {Object} req - Express request 객체 (canonical URL 생성용)
     * @returns {Object} 완전한 SEO 데이터 객체
     */
    async generatePageSEO(pageType, data = {}, req = null) {
        try {
            const metaTags = await this.generateMetaTags(pageType, data);
            const structuredData = await this.generateStructuredData(pageType, data);
            const canonicalURL = this.generateCanonicalURL(req, data);

            return {
                metaTags,
                structuredData,
                canonicalURL,
                lang: 'ko',
                pageType
            };
        } catch (error) {
            console.error('SEO 데이터 생성 실패:', error);
            // 기본 SEO 데이터 반환
            return this._getDefaultSEO(req);
        }
    }

    /**
     * 메타 태그 생성
     * @param {string} pageType - 페이지 타입
     * @param {Object} data - 페이지 데이터
     * @returns {Object} 메타 태그 객체
     */
    async generateMetaTags(pageType, data = {}) {
        try {
            switch (pageType) {
                case 'home':
                    return this.metaGenerator.generateHomeMeta(this.siteConfig.url);

                case 'category':
                    if (!data.subforum) {
                        throw new Error('카테고리 데이터가 필요합니다.');
                    }
                    return this.metaGenerator.generateCategoryMeta(data.subforum, this.siteConfig.url);

                case 'post':
                    if (!data.post || !data.subforum) {
                        throw new Error('게시글 및 카테고리 데이터가 필요합니다.');
                    }
                    return this.metaGenerator.generatePostMeta(data.post, data.subforum, this.siteConfig.url);

                case 'search':
                    return this._generateSearchMeta(data.query, data.results);

                default:
                    return this.metaGenerator.generateHomeMeta(this.siteConfig.url);
            }
        } catch (error) {
            console.error('메타 태그 생성 실패:', error);
            return this.metaGenerator.generateHomeMeta(this.siteConfig.url);
        }
    }

    /**
     * 구조화된 데이터 생성
     * @param {string} pageType - 페이지 타입
     * @param {Object} data - 페이지 데이터
     * @returns {Array} 구조화된 데이터 배열
     */
    async generateStructuredData(pageType, data = {}) {
        try {
            const schemas = [];

            switch (pageType) {
                case 'home':
                    schemas.push(
                        this.structuredDataGenerator.generateWebSiteSchema(
                            this.siteConfig.url,
                            this.siteConfig.name
                        )
                    );
                    break;

                case 'category':
                    if (data.subforum) {
                        schemas.push(
                            this.structuredDataGenerator.generateCollectionPageSchema(
                                data.subforum,
                                this.siteConfig.url
                            )
                        );

                        // Breadcrumb 추가
                        if (data.breadcrumbs) {
                            schemas.push(
                                this.structuredDataGenerator.generateBreadcrumbSchema(
                                    data.breadcrumbs,
                                    this.siteConfig.url
                                )
                            );
                        }
                    }
                    break;

                case 'post':
                    if (data.post && data.author) {
                        schemas.push(
                            this.structuredDataGenerator.generateArticleSchema(
                                data.post,
                                data.author,
                                this.siteConfig.url
                            )
                        );

                        // Breadcrumb 추가
                        if (data.breadcrumbs) {
                            schemas.push(
                                this.structuredDataGenerator.generateBreadcrumbSchema(
                                    data.breadcrumbs,
                                    this.siteConfig.url
                                )
                            );
                        }
                    }
                    break;

                case 'search':
                    if (data.query) {
                        schemas.push(
                            this.structuredDataGenerator.generateSearchResultsSchema(
                                data.query,
                                data.results || [],
                                this.siteConfig.url
                            )
                        );
                    }
                    break;

                default:
                    schemas.push(
                        this.structuredDataGenerator.generateWebSiteSchema(
                            this.siteConfig.url,
                            this.siteConfig.name
                        )
                    );
            }

            return schemas;
        } catch (error) {
            console.error('구조화된 데이터 생성 실패:', error);
            // 기본 WebSite 스키마 반환
            return [
                this.structuredDataGenerator.generateWebSiteSchema(
                    this.siteConfig.url,
                    this.siteConfig.name
                )
            ];
        }
    }

    /**
     * Canonical URL 생성
     * @param {Object} req - Express request 객체
     * @param {Object} data - 페이지 데이터
     * @returns {string} Canonical URL
     */
    generateCanonicalURL(req, data = {}) {
        try {
            if (!req) {
                return this.siteConfig.url;
            }

            // 프로토콜 결정 (HTTPS 우선)
            const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' 
                ? 'https' 
                : 'http';

            // 호스트 결정
            const host = req.get('host') || req.hostname;

            // 기본 경로 (쿼리 파라미터 제거)
            let pathname = req.path;

            // 특정 페이지 타입에 따른 canonical URL 처리
            if (data.pageType === 'search') {
                // 검색 결과 페이지는 기본 검색 URL로 설정
                pathname = '/search';
            } else if (data.pageType === 'post' && data.post && data.subforum) {
                // 게시글 페이지는 주 카테고리 URL 사용
                pathname = `/forum/${data.subforum.id}/post/${data.post.id}`;
            } else if (data.pageType === 'category' && data.subforum) {
                // 카테고리 페이지
                pathname = `/forum/${data.subforum.id}`;
            }

            // 절대 URL 생성
            const canonicalURL = `${protocol}://${host}${pathname}`;

            return canonicalURL;
        } catch (error) {
            console.error('Canonical URL 생성 실패:', error);
            return this.siteConfig.url;
        }
    }

    /**
     * 검색 페이지 메타 태그 생성 (내부 헬퍼)
     * @param {string} query - 검색어
     * @param {Array} results - 검색 결과
     * @returns {Object} 검색 페이지 메타 태그
     * @private
     */
    _generateSearchMeta(query, results = []) {
        const title = query 
            ? `"${query}" 검색 결과 - ${this.siteConfig.name}`
            : `검색 - ${this.siteConfig.name}`;
        
        const description = query
            ? `"${query}"에 대한 검색 결과 ${results.length}개`
            : '포럼 내 게시글을 검색하세요.';

        return {
            basic: this.metaGenerator.generateBasicMeta(
                title,
                description,
                this.siteConfig.keywords
            ),
            openGraph: this.metaGenerator.generateOpenGraphMeta({
                title: title,
                description: description,
                type: 'website',
                url: `${this.siteConfig.url}/search`,
                image: `${this.siteConfig.url}/images/og-default.png`
            }),
            twitter: this.metaGenerator.generateTwitterCardMeta({
                title: title,
                description: description,
                image: `${this.siteConfig.url}/images/og-default.png`
            }),
            robots: 'noindex, follow' // 검색 결과 페이지는 인덱싱하지 않음
        };
    }

    /**
     * 기본 SEO 데이터 반환 (오류 시)
     * @param {Object} req - Express request 객체
     * @returns {Object} 기본 SEO 데이터
     * @private
     */
    _getDefaultSEO(req) {
        return {
            metaTags: this.metaGenerator.generateHomeMeta(this.siteConfig.url),
            structuredData: [
                this.structuredDataGenerator.generateWebSiteSchema(
                    this.siteConfig.url,
                    this.siteConfig.name
                )
            ],
            canonicalURL: req ? this.generateCanonicalURL(req, {}) : this.siteConfig.url,
            lang: 'ko',
            pageType: 'default'
        };
    }

    /**
     * 사이트 설정 업데이트
     * @param {Object} newConfig - 새 설정 객체
     */
    updateSiteConfig(newConfig) {
        this.siteConfig = { ...this.siteConfig, ...newConfig };
        this.metaGenerator = new MetaTagGenerator(this.siteConfig);
        this.structuredDataGenerator = new StructuredDataGenerator(this.siteConfig);
    }

    /**
     * 현재 사이트 설정 조회
     * @returns {Object} 사이트 설정
     */
    getSiteConfig() {
        return { ...this.siteConfig };
    }
}

module.exports = SEOService;
