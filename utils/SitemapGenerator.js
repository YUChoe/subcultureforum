/**
 * SitemapGenerator
 * 동적 sitemap.xml을 생성하고 캐싱하는 유틸리티 클래스
 */

class SitemapGenerator {
    constructor(dbManager, siteConfig = {}) {
        this.dbManager = dbManager;
        this.siteUrl = siteConfig.url || 'http://localhost:8888';
        this.cacheDuration = parseInt(siteConfig.sitemapCacheDuration || '3600', 10); // 초 단위
        this.maxUrls = 50000; // Sitemap 프로토콜 제한
    }

    /**
     * Sitemap 생성 (캐시 확인 후 생성)
     * @returns {Promise<string>} XML 형식의 sitemap
     */
    async generateSitemap() {
        try {
            // 캐시 확인
            const cached = await this.getCachedSitemap();
            if (cached) {
                return cached;
            }

            // 새로 생성
            const urls = [];

            // 메인 페이지 추가
            urls.push(this.createURLEntry(this.siteUrl, new Date(), 'daily', 1.0));

            // 카테고리 URL 추가
            const categoryUrls = await this.getCategoryURLs();
            urls.push(...categoryUrls);

            // 게시글 URL 추가
            const postUrls = await this.getPostURLs();
            urls.push(...postUrls);

            // URL 개수 제한 확인
            const limitedUrls = urls.slice(0, this.maxUrls);

            // XML 생성
            const xml = this._buildSitemapXML(limitedUrls);

            // 캐시 저장
            await this.saveCachedSitemap(xml);

            return xml;
        } catch (error) {
            console.error('Sitemap 생성 실패:', error);
            throw error;
        }
    }

    /**
     * 캐시된 sitemap 조회
     * @returns {Promise<string|null>} 캐시된 sitemap 또는 null
     */
    async getCachedSitemap() {
        try {
            const cacheDB = this.dbManager.getCacheDB();
            const row = await this.dbManager.getQuery(
                cacheDB,
                `SELECT value, expires_at FROM cache WHERE key = ?`,
                ['sitemap_xml']
            );

            if (!row) {
                return null;
            }

            const expiresAt = new Date(row.expires_at);
            if (expiresAt < new Date()) {
                // 만료된 캐시 삭제
                await this.dbManager.runQuery(
                    cacheDB,
                    `DELETE FROM cache WHERE key = ?`,
                    ['sitemap_xml']
                );
                return null;
            }

            return row.value;
        } catch (error) {
            console.error('Sitemap 캐시 조회 실패:', error);
            return null;
        }
    }

    /**
     * sitemap을 캐시에 저장
     * @param {string} xmlContent - XML 내용
     * @returns {Promise<void>}
     */
    async saveCachedSitemap(xmlContent) {
        try {
            const cacheDB = this.dbManager.getCacheDB();
            const expiresAt = new Date(Date.now() + this.cacheDuration * 1000);

            await this.dbManager.runQuery(
                cacheDB,
                `INSERT OR REPLACE INTO cache (key, value, expires_at, updated_at) 
                 VALUES (?, ?, ?, datetime('now'))`,
                ['sitemap_xml', xmlContent, expiresAt.toISOString()]
            );
        } catch (error) {
            console.error('Sitemap 캐시 저장 실패:', error);
        }
    }

    /**
     * 캐시 유효성 확인
     * @returns {Promise<boolean>} 캐시가 유효하면 true
     */
    async isCacheValid() {
        const cached = await this.getCachedSitemap();
        return cached !== null;
    }

    /**
     * URL 엔트리 생성
     * @param {string} loc - URL
     * @param {Date|string} lastmod - 마지막 수정일
     * @param {string} changefreq - 변경 빈도
     * @param {number} priority - 우선순위 (0.0 ~ 1.0)
     * @returns {Object} URL 엔트리 객체
     */
    createURLEntry(loc, lastmod, changefreq, priority) {
        return {
            loc,
            lastmod: lastmod instanceof Date ? lastmod.toISOString() : lastmod,
            changefreq,
            priority: priority.toFixed(1)
        };
    }

    /**
     * 게시글 URL 목록 조회
     * @returns {Promise<Array>} URL 엔트리 배열
     */
    async getPostURLs() {
        const urls = [];
        const configDB = this.dbManager.getConfigDB();

        try {
            // 모든 활성 카테고리 조회
            const categories = await this.dbManager.allQuery(
                configDB,
                'SELECT id FROM categories WHERE is_active = 1'
            );

            for (const category of categories) {
                try {
                    const forumDB = await this.dbManager.getForumDB(category.id);

                    // 공개 게시글 조회
                    const posts = await this.dbManager.allQuery(
                        forumDB,
                        `SELECT id, updated_at, created_at 
                         FROM posts 
                         ORDER BY created_at DESC`
                    );

                    for (const post of posts) {
                        const postUrl = `${this.siteUrl}/forum/${category.id}/post/${post.id}`;
                        const lastmod = post.updated_at || post.created_at;
                        const changefreq = this._calculateChangefreq(lastmod);

                        urls.push(this.createURLEntry(postUrl, lastmod, changefreq, 0.6));
                    }
                } catch (error) {
                    console.error(`카테고리 ${category.id} 게시글 조회 실패:`, error);
                }
            }

            return urls;
        } catch (error) {
            console.error('게시글 URL 조회 실패:', error);
            return [];
        }
    }

    /**
     * 카테고리 URL 목록 조회
     * @returns {Promise<Array>} URL 엔트리 배열
     */
    async getCategoryURLs() {
        const urls = [];
        const configDB = this.dbManager.getConfigDB();

        try {
            const categories = await this.dbManager.allQuery(
                configDB,
                'SELECT id, created_at FROM categories WHERE is_active = 1'
            );

            for (const category of categories) {
                const categoryUrl = `${this.siteUrl}/forum/${category.id}`;
                urls.push(this.createURLEntry(categoryUrl, category.created_at, 'daily', 0.8));
            }

            return urls;
        } catch (error) {
            console.error('카테고리 URL 조회 실패:', error);
            return [];
        }
    }

    /**
     * 마지막 수정일 기준으로 changefreq 계산
     * @param {string} lastmod - 마지막 수정일
     * @returns {string} changefreq 값
     * @private
     */
    _calculateChangefreq(lastmod) {
        const lastModDate = new Date(lastmod);
        const now = new Date();
        const daysDiff = (now - lastModDate) / (1000 * 60 * 60 * 24);

        if (daysDiff <= 7) {
            return 'daily';
        } else {
            return 'monthly';
        }
    }

    /**
     * Sitemap XML 생성
     * @param {Array} urls - URL 엔트리 배열
     * @returns {string} XML 문자열
     * @private
     */
    _buildSitemapXML(urls) {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

        for (const url of urls) {
            xml += '  <url>\n';
            xml += `    <loc>${this._escapeXml(url.loc)}</loc>\n`;
            xml += `    <lastmod>${url.lastmod}</lastmod>\n`;
            xml += `    <changefreq>${url.changefreq}</changefreq>\n`;
            xml += `    <priority>${url.priority}</priority>\n`;
            xml += '  </url>\n';
        }

        xml += '</urlset>';
        return xml;
    }

    /**
     * XML 특수 문자 이스케이프
     * @param {string} str - 이스케이프할 문자열
     * @returns {string} 이스케이프된 문자열
     * @private
     */
    _escapeXml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Sitemap 캐시 강제 갱신
     * @returns {Promise<string>} 새로 생성된 sitemap
     */
    async refreshCache() {
        try {
            const cacheDB = this.dbManager.getCacheDB();
            await this.dbManager.runQuery(
                cacheDB,
                `DELETE FROM cache WHERE key = ?`,
                ['sitemap_xml']
            );

            return await this.generateSitemap();
        } catch (error) {
            console.error('Sitemap 캐시 갱신 실패:', error);
            throw error;
        }
    }
}

module.exports = SitemapGenerator;
