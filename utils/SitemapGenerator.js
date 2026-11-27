const MAX_URLS_PER_SITEMAP = 50000;
const DAY_MS = 24 * 60 * 60 * 1000;

function escapeXml(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
    }[c]));
}

/**
 * 기존 categories/posts 데이터로 sitemap XML 을 만든다.
 * - /sitemap.xml                       sitemap index
 * - /sitemaps/main.xml                 홈 + 카테고리 목록 페이지
 * - /sitemaps/category-:id-:n.xml      카테고리별 게시글 (파일당 최대 50,000 URL)
 * 결과는 프로세스 메모리에 TTL 동안만 캐시한다 (DB 에 저장하지 않음).
 */
class SitemapGenerator {
    /**
     * @param {Object} options
     * @param {Object} options.dbManager - DatabaseManager 인스턴스
     * @param {string} options.siteUrl
     * @param {number} [options.ttlSeconds=3600]
     * @param {Function} [options.now] - 테스트용 시간 함수
     */
    constructor({ dbManager, siteUrl, ttlSeconds = 3600, now = Date.now }) {
        this.dbManager = dbManager;
        this.siteUrl = siteUrl.replace(/\/+$/, '');
        this.ttlMs = ttlSeconds * 1000;
        this.now = now;
        this.cache = new Map(); // key -> { expires, value(Promise<string|null>) }
    }

    /** 캐시 조회, 없거나 만료면 build 실행. 동시 요청은 같은 Promise 를 공유한다. */
    cached(key, build) {
        const hit = this.cache.get(key);
        if (hit && hit.expires > this.now()) {
            return hit.value;
        }
        const value = build().catch((error) => {
            // 실패는 캐시하지 않고 로그만 남긴다
            this.cache.delete(key);
            console.error(`sitemap 생성 실패 (${key}):`, error);
            throw error;
        });
        this.cache.set(key, { expires: this.now() + this.ttlMs, value });
        return value;
    }

    // ---- 데이터 조회 (읽기 전용) ----

    loadCategories() {
        return this.cached('categories', async () => {
            const configDB = this.dbManager.getConfigDB();
            return this.dbManager.allQuery(
                configDB,
                'SELECT id FROM categories WHERE is_active = 1 ORDER BY display_order ASC, created_at ASC'
            );
        });
    }

    async categoryStats(categoryId) {
        const forumDB = await this.dbManager.getForumDB(categoryId);
        const row = await this.dbManager.getQuery(
            forumDB,
            `SELECT COUNT(*) AS count, MAX(MAX(updated_at), MAX(last_comment_at)) AS last_modified
             FROM posts WHERE category_id = ?`,
            [categoryId]
        );
        return { count: row ? row.count : 0, lastModified: row ? row.last_modified : null };
    }

    // ---- XML 조각 ----

    toW3cDate(value) {
        if (!value) return null;
        const text = String(value);
        const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text) ? text.replace(' ', 'T') + 'Z' : text;
        const date = new Date(normalized);
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    changefreq(lastmod) {
        const time = lastmod ? new Date(lastmod).getTime() : NaN;
        return !Number.isNaN(time) && this.now() - time < 30 * DAY_MS ? 'daily' : 'monthly';
    }

    urlEntry(path, lastmod, changefreq, priority) {
        const parts = [`    <loc>${escapeXml(this.siteUrl + path)}</loc>`];
        if (lastmod) parts.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
        parts.push(`    <changefreq>${changefreq}</changefreq>`, `    <priority>${priority.toFixed(1)}</priority>`);
        return `  <url>\n${parts.join('\n')}\n  </url>`;
    }

    wrapUrlset(entries) {
        return '<?xml version="1.0" encoding="UTF-8"?>\n'
            + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            + entries.join('\n') + '\n</urlset>\n';
    }

    // ---- 공개 API (모두 캐시됨, 존재하지 않는 항목은 null) ----

    /** /sitemap.xml */
    getIndex() {
        return this.cached('index', async () => {
            const categories = await this.loadCategories();
            const entries = [`  <sitemap>\n    <loc>${escapeXml(this.siteUrl + '/sitemaps/main.xml')}</loc>\n  </sitemap>`];
            for (const category of categories) {
                let stats;
                try {
                    stats = await this.categoryStats(category.id);
                } catch (error) {
                    console.error(`sitemap: 카테고리 ${category.id} 조회 실패, 건너뜀:`, error);
                    continue;
                }
                const chunks = Math.ceil(stats.count / MAX_URLS_PER_SITEMAP);
                for (let n = 1; n <= chunks; n++) {
                    const lastmod = this.toW3cDate(stats.lastModified);
                    entries.push(
                        `  <sitemap>\n    <loc>${escapeXml(`${this.siteUrl}/sitemaps/category-${category.id}-${n}.xml`)}</loc>`
                        + (lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : '')
                        + '\n  </sitemap>'
                    );
                }
            }
            return '<?xml version="1.0" encoding="UTF-8"?>\n'
                + '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                + entries.join('\n') + '\n</sitemapindex>\n';
        });
    }

    /** /sitemaps/main.xml: 홈(priority 1.0) + 카테고리 페이지(0.8) */
    getMain() {
        return this.cached('main', async () => {
            const categories = await this.loadCategories();
            const entries = [this.urlEntry('/', null, 'daily', 1.0)];
            for (const category of categories) {
                let lastmod = null;
                try {
                    lastmod = this.toW3cDate((await this.categoryStats(category.id)).lastModified);
                } catch (error) {
                    console.error(`sitemap: 카테고리 ${category.id} 조회 실패:`, error);
                }
                entries.push(this.urlEntry(`/forum/subforum/${category.id}`, lastmod, 'daily', 0.8));
            }
            return this.wrapUrlset(entries);
        });
    }

    /** /sitemaps/category-:id-:n.xml: 게시글(priority 0.6). 없는 카테고리/구간이면 null */
    async getCategoryChunk(categoryId, chunk) {
        const categories = await this.loadCategories();
        if (!categories.some(c => c.id === categoryId) || !Number.isInteger(chunk) || chunk < 1) {
            return null;
        }
        // 범위를 벗어난 구간은 캐시 키를 만들기 전에 거른다 (임의 URL 로 캐시가 커지는 것 방지)
        const { count } = await this.categoryStats(categoryId);
        if (chunk > Math.max(1, Math.ceil(count / MAX_URLS_PER_SITEMAP))) {
            return null;
        }
        return this.cached(`category:${categoryId}:${chunk}`, async () => {
            const forumDB = await this.dbManager.getForumDB(categoryId);
            const posts = await this.dbManager.allQuery(
                forumDB,
                `SELECT id, created_at, updated_at FROM posts
                 WHERE category_id = ? ORDER BY id ASC LIMIT ? OFFSET ?`,
                [categoryId, MAX_URLS_PER_SITEMAP, (chunk - 1) * MAX_URLS_PER_SITEMAP]
            );
            const entries = posts.map((post) => {
                const lastmod = this.toW3cDate(post.updated_at || post.created_at);
                return this.urlEntry(`/forum/subforum/${categoryId}/post/${post.id}`, lastmod, this.changefreq(lastmod), 0.6);
            });
            return this.wrapUrlset(entries);
        });
    }
}

SitemapGenerator.MAX_URLS_PER_SITEMAP = MAX_URLS_PER_SITEMAP;
SitemapGenerator.escapeXml = escapeXml;

module.exports = SitemapGenerator;
