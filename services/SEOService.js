const config = require('../config/default');
const MetaTagGenerator = require('../utils/MetaTagGenerator');
const StructuredDataGenerator = require('../utils/StructuredDataGenerator');

const SITE = config.site;

// 게시글 본문 HTML(DOMPurify 통과)에서 첫 번째 <img src="..."> 추출
const IMG_SRC = /<img\b[^>]*?\bsrc="([^"]*)"/i;

/**
 * 페이지별 SEO 정보를 만든다. 모든 값은 기존 데이터에서 요청 시점에 계산하며 DB 에 저장하지 않는다.
 * 반환값은 뷰의 seoHead() 가 받는 head 객체(MetaTagGenerator.generate 결과)이다.
 * 문자열 이스케이프는 출력하는 뷰(partials/seo-meta.ejs)에서 한다.
 */
class SEOService {
    constructor(siteConfig = SITE) {
        this.site = siteConfig;
        this.meta = new MetaTagGenerator(siteConfig);
        this.schema = new StructuredDataGenerator(siteConfig);
    }

    // ---- URL ----

    url(path = '/') {
        return this.site.url + path;
    }

    categoryPath(subforumId, page = 1) {
        const base = `/forum/subforum/${subforumId}`;
        return page > 1 ? `${base}?page=${page}` : base;
    }

    postPath(subforumId, postId) {
        return `/forum/subforum/${subforumId}/post/${postId}`;
    }

    // ---- 헬퍼 ----

    /** SQLite CURRENT_TIMESTAMP('YYYY-MM-DD HH:MM:SS', UTC) 를 ISO 8601 로 변환. 해석 불가면 undefined */
    toIso(value) {
        if (!value) return undefined;
        const text = String(value);
        const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text) ? text.replace(' ', 'T') + 'Z' : text;
        const date = new Date(normalized);
        return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
    }

    /**
     * og:image 결정. 생성 이미지를 나중에 추가할 때는 이 메서드 안에 단계를 더하면 된다.
     * 순서: 첨부 이미지 > 본문 이미지 > 사이트 기본 이미지
     * @returns {{url: string, width?: number, height?: number, alt?: string}}
     */
    resolveOgImage({ post, subforumId }) {
        const attachment = (post.attachments || []).find(a => /^image\//i.test(a.mime_type || ''));
        if (attachment) {
            return {
                url: this.url(`/forum/subforum/${subforumId}/attachment/${attachment.id}`),
                alt: attachment.original_filename || post.title
            };
        }

        const match = IMG_SRC.exec(post.content_html || '');
        if (match) {
            // HTML 속성값의 엔티티를 되돌린 뒤 절대 URL 로 변환 (http/https 만 허용)
            const raw = match[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'");
            const url = this.meta.absoluteUrl(raw);
            if (url) {
                return { url, alt: post.title };
            }
        }

        return this.meta.defaultImage;
    }

    // ---- 페이지별 head ----

    home() {
        return this.meta.generate({
            title: `${this.site.name} - 커뮤니티 포럼`,
            description: this.site.description,
            canonical: this.url('/'),
            jsonLd: [this.schema.generateWebSiteSchema(this.url('/forum/search'))]
        });
    }

    /**
     * @param {Object} subforum - { id, name, description }
     * @param {Object} options
     * @param {number} options.page - 현재 페이지
     * @param {number} options.totalPages
     */
    category(subforum, { page = 1, totalPages = 1 } = {}) {
        const name = subforum.name;
        const pageSuffix = page > 1 ? ` (${page}페이지)` : '';
        const baseDescription = this.meta.truncate(subforum.description, 150) || `${name} 게시판`;
        const canonical = this.url(this.categoryPath(subforum.id, page));
        const crumbs = [
            { name: '홈', url: this.url('/') },
            { name, url: this.url(this.categoryPath(subforum.id)) }
        ];

        return this.meta.generate({
            title: `${name}${pageSuffix} - ${this.site.name}`,
            description: this.meta.truncate(`${baseDescription}${pageSuffix}`, 160),
            canonical,
            // 마지막 페이지를 넘어선 요청은 색인하지 않는다
            robots: page > Math.max(totalPages, 1) ? 'noindex, follow' : 'index, follow',
            prev: page > 1 ? this.url(this.categoryPath(subforum.id, Math.min(page - 1, Math.max(totalPages, 1)))) : null,
            next: page < totalPages ? this.url(this.categoryPath(subforum.id, page + 1)) : null,
            jsonLd: [
                this.schema.generateCollectionPageSchema({
                    name,
                    description: baseDescription,
                    url: canonical
                }),
                this.schema.generateBreadcrumbSchema(crumbs)
            ]
        });
    }

    /**
     * @param {Object} data
     * @param {Object} data.post - ForumService.getPost 결과 (content, content_html, attachments 포함)
     * @param {Object} data.subforum
     */
    post({ post, subforum }) {
        const description = this.meta.extractDescription(post.content, 160)
            || this.meta.truncate(`${subforum.name} 게시판의 글 - ${post.username}`, 160);
        const canonical = this.url(this.postPath(subforum.id, post.id));
        const image = this.resolveOgImage({ post, subforumId: subforum.id });
        const published = this.toIso(post.created_at);
        const modified = this.toIso(post.updated_at) || published;

        return this.meta.generate({
            title: `${post.title} - ${subforum.name} - ${this.site.name}`,
            description,
            canonical,
            type: 'article',
            image,
            article: { publishedTime: published, modifiedTime: modified, section: subforum.name },
            jsonLd: [
                this.schema.generatePostSchema({
                    headline: this.meta.truncate(post.title, 110),
                    url: canonical,
                    text: this.meta.extractDescription(post.content, 5000),
                    authorName: post.username,
                    datePublished: published,
                    dateModified: modified,
                    image: image === this.meta.defaultImage ? undefined : image.url,
                    commentCount: post.comment_count
                }),
                this.schema.generateBreadcrumbSchema([
                    { name: '홈', url: this.url('/') },
                    { name: subforum.name, url: this.url(this.categoryPath(subforum.id)) },
                    { name: post.title, url: canonical }
                ])
            ]
        });
    }

    /** 검색 결과: noindex, canonical 은 검색 페이지 기본 URL */
    search(query) {
        const q = this.meta.truncate(query, 60);
        return this.meta.generate({
            title: q ? `"${q}" 검색 결과 - ${this.site.name}` : `포럼 검색 - ${this.site.name}`,
            description: q ? `${this.site.name} 포럼에서 "${q}" 검색 결과` : `${this.site.name} 포럼 게시글 검색`,
            canonical: this.url('/forum/search'),
            robots: 'noindex, follow'
        });
    }

    /** 색인 대상이 아닌 페이지(로그인, 관리자, 작성/수정 폼, 오류 등) */
    noindex(title) {
        return {
            title: !title ? this.site.name
                : (title.includes(this.site.name) ? title : `${title} - ${this.site.name}`),
            description: this.site.description,
            canonical: null,
            robots: 'noindex, nofollow',
            prev: null,
            next: null,
            og: [],
            twitter: [],
            jsonLd: []
        };
    }

    /**
     * 뷰에서 호출하는 진입점. route 가 res.locals.seo 를 채우지 않은 페이지는 noindex 처리한다.
     * @param {Object|null} seo - route 가 설정한 head 객체
     * @param {string} fallbackTitle - 페이지의 title 값
     */
    head(seo, fallbackTitle) {
        return seo || this.noindex(fallbackTitle);
    }
}

module.exports = SEOService;
