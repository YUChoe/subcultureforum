/**
 * MetaTagGenerator
 * 페이지별 동적 메타 태그를 생성하는 유틸리티 클래스
 */

class MetaTagGenerator {
    constructor(siteConfig = {}) {
        this.siteName = siteConfig.name || 'NOIZZE';
        this.siteDescription = siteConfig.description || 'forum.noizze.net - 커뮤니티 포럼';
        this.siteUrl = siteConfig.url || 'http://localhost:8888';
        this.siteKeywords = siteConfig.keywords || '포럼,커뮤니티,게시판';
        this.twitterSite = siteConfig.twitterSite || '@noizze';
    }

    /**
     * 기본 메타 태그 생성
     * @param {string} title - 페이지 제목
     * @param {string} description - 페이지 설명
     * @param {string} keywords - 키워드 (쉼표로 구분)
     * @returns {Object} 메타 태그 객체
     */
    generateBasicMeta(title, description, keywords) {
        return {
            title: title || this.siteName,
            description: description || this.siteDescription,
            keywords: keywords || this.siteKeywords
        };
    }

    /**
     * Open Graph 메타 태그 생성
     * @param {Object} data - OG 데이터
     * @param {string} data.title - OG 제목
     * @param {string} data.description - OG 설명
     * @param {string} data.type - OG 타입 (website, article 등)
     * @param {string} data.url - 페이지 URL
     * @param {string} data.image - 이미지 URL
     * @returns {Object} Open Graph 메타 태그 객체
     */
    generateOpenGraphMeta(data) {
        return {
            'og:title': data.title || this.siteName,
            'og:description': data.description || this.siteDescription,
            'og:type': data.type || 'website',
            'og:url': data.url || this.siteUrl,
            'og:image': data.image || `${this.siteUrl}/images/og-default.png`,
            'og:site_name': this.siteName
        };
    }

    /**
     * Twitter Card 메타 태그 생성
     * @param {Object} data - Twitter Card 데이터
     * @param {string} data.title - 카드 제목
     * @param {string} data.description - 카드 설명
     * @param {string} data.image - 이미지 URL
     * @returns {Object} Twitter Card 메타 태그 객체
     */
    generateTwitterCardMeta(data) {
        return {
            'twitter:card': 'summary_large_image',
            'twitter:site': this.twitterSite,
            'twitter:title': data.title || this.siteName,
            'twitter:description': data.description || this.siteDescription,
            'twitter:image': data.image || `${this.siteUrl}/images/og-default.png`
        };
    }

    /**
     * 게시글 페이지 메타 태그 생성
     * @param {Object} post - 게시글 객체
     * @param {Object} subforum - 서브포럼(카테고리) 객체
     * @param {string} siteUrl - 사이트 URL
     * @returns {Object} 게시글 메타 태그 전체
     */
    generatePostMeta(post, subforum, siteUrl = this.siteUrl) {
        const description = this.extractDescription(post.content);
        const postUrl = `${siteUrl}/forum/${subforum.id}/post/${post.id}`;
        const ogImageUrl = `${siteUrl}/api/og-image/${post.id}`;
        
        const title = `${post.title} - ${subforum.name} - ${this.siteName}`;
        const keywords = `${post.title},${subforum.name},${this.siteKeywords}`;

        return {
            basic: this.generateBasicMeta(title, description, keywords),
            openGraph: this.generateOpenGraphMeta({
                title: post.title,
                description: description,
                type: 'article',
                url: postUrl,
                image: ogImageUrl
            }),
            twitter: this.generateTwitterCardMeta({
                title: post.title,
                description: description,
                image: ogImageUrl
            }),
            article: {
                'article:published_time': post.created_at,
                'article:modified_time': post.updated_at || post.created_at,
                'article:author': post.author_name || '익명',
                'article:section': subforum.name
            }
        };
    }

    /**
     * 카테고리 페이지 메타 태그 생성
     * @param {Object} subforum - 서브포럼(카테고리) 객체
     * @param {string} siteUrl - 사이트 URL
     * @returns {Object} 카테고리 메타 태그 전체
     */
    generateCategoryMeta(subforum, siteUrl = this.siteUrl) {
        const categoryUrl = `${siteUrl}/forum/${subforum.id}`;
        const title = `${subforum.name} - ${this.siteName}`;
        const description = subforum.description || `${subforum.name} 카테고리의 게시글을 확인하세요.`;
        const keywords = `${subforum.name},${this.siteKeywords}`;

        return {
            basic: this.generateBasicMeta(title, description, keywords),
            openGraph: this.generateOpenGraphMeta({
                title: subforum.name,
                description: description,
                type: 'website',
                url: categoryUrl,
                image: `${siteUrl}/images/og-default.png`
            }),
            twitter: this.generateTwitterCardMeta({
                title: subforum.name,
                description: description,
                image: `${siteUrl}/images/og-default.png`
            })
        };
    }

    /**
     * 메인 페이지 메타 태그 생성
     * @param {string} siteUrl - 사이트 URL
     * @returns {Object} 메인 페이지 메타 태그 전체
     */
    generateHomeMeta(siteUrl = this.siteUrl) {
        return {
            basic: this.generateBasicMeta(
                this.siteName,
                this.siteDescription,
                this.siteKeywords
            ),
            openGraph: this.generateOpenGraphMeta({
                title: this.siteName,
                description: this.siteDescription,
                type: 'website',
                url: siteUrl,
                image: `${siteUrl}/images/og-default.png`
            }),
            twitter: this.generateTwitterCardMeta({
                title: this.siteName,
                description: this.siteDescription,
                image: `${siteUrl}/images/og-default.png`
            })
        };
    }

    /**
     * 게시글 내용에서 설명 텍스트 추출 (160자 제한)
     * @param {string} content - 게시글 내용
     * @param {number} maxLength - 최대 길이 (기본값: 160)
     * @returns {string} 추출된 설명
     */
    extractDescription(content, maxLength = 160) {
        if (!content) {
            return this.siteDescription;
        }

        // HTML 태그 제거
        let text = content.replace(/<[^>]*>/g, '');
        
        // 마크다운 문법 제거
        text = text.replace(/[#*_~`\[\]]/g, '');
        
        // 연속된 공백 제거
        text = text.replace(/\s+/g, ' ').trim();
        
        // 최대 길이로 자르기
        if (text.length > maxLength) {
            text = text.substring(0, maxLength - 3) + '...';
        }
        
        return text || this.siteDescription;
    }
}

module.exports = MetaTagGenerator;
