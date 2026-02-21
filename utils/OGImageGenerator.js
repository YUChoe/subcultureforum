/**
 * OGImageGenerator
 * 게시글별 대표 이미지를 자동 생성하는 유틸리티 클래스
 */

const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs').promises;

class OGImageGenerator {
    constructor(dbManager, siteConfig = {}) {
        this.dbManager = dbManager;
        this.siteName = siteConfig.name || 'NOIZZE';
        this.width = 1200;
        this.height = 630;
        this.defaultImagePath = path.join(__dirname, '../public/images/og-default.png');
    }

    /**
     * 대표 이미지 생성
     * @param {Object} post - 게시글 객체
     * @param {Object} subforum - 서브포럼(카테고리) 객체
     * @param {Object} author - 작성자 객체
     * @returns {Promise<Buffer>} PNG 이미지 버퍼
     */
    async generateImage(post, subforum, author) {
        try {
            const canvas = createCanvas(this.width, this.height);
            const ctx = canvas.getContext('2d');

            // 배경 그리기
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, this.width, this.height);

            // 그라데이션 배경
            const gradient = ctx.createLinearGradient(0, 0, this.width, this.height);
            gradient.addColorStop(0, '#1a1a2e');
            gradient.addColorStop(1, '#16213e');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, this.width, this.height);

            // 사이트 로고/이름 (상단)
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 36px sans-serif';
            ctx.fillText(this.siteName, 60, 80);

            // 카테고리 (상단 우측)
            ctx.fillStyle = '#0f3460';
            ctx.fillRect(this.width - 300, 40, 240, 50);
            ctx.fillStyle = '#e94560';
            ctx.font = 'bold 24px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(subforum.name, this.width - 180, 75);

            // 게시글 제목 (중앙)
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 48px sans-serif';
            ctx.textAlign = 'left';
            const wrappedTitle = this.wrapText(ctx, post.title, this.width - 120, 48);
            let titleY = 250;
            for (const line of wrappedTitle) {
                ctx.fillText(line, 60, titleY);
                titleY += 60;
            }

            // 작성자 정보 (하단)
            ctx.fillStyle = '#a8a8a8';
            ctx.font = '28px sans-serif';
            ctx.fillText(`작성자: ${author.username || '익명'}`, 60, this.height - 80);

            // 작성일 (하단 우측)
            const createdDate = new Date(post.created_at).toLocaleDateString('ko-KR');
            ctx.textAlign = 'right';
            ctx.fillText(createdDate, this.width - 60, this.height - 80);

            // PNG 버퍼로 변환
            return canvas.toBuffer('image/png');
        } catch (error) {
            console.error('대표 이미지 생성 실패:', error);
            throw error;
        }
    }

    /**
     * 이미지를 데이터베이스에 저장
     * @param {number} postId - 게시글 ID
     * @param {number} categoryId - 카테고리 ID
     * @param {Buffer} imageBuffer - 이미지 버퍼
     * @returns {Promise<void>}
     */
    async saveImage(postId, categoryId, imageBuffer) {
        try {
            const configDB = this.dbManager.getConfigDB();

            await this.dbManager.runQuery(
                configDB,
                `INSERT OR REPLACE INTO og_images 
                 (post_id, category_id, image_data, mime_type, width, height, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
                [postId, categoryId, imageBuffer, 'image/png', this.width, this.height]
            );
        } catch (error) {
            console.error('대표 이미지 저장 실패:', error);
            throw error;
        }
    }

    /**
     * 이미지 조회
     * @param {number} postId - 게시글 ID
     * @param {number} categoryId - 카테고리 ID
     * @returns {Promise<Buffer|null>} 이미지 버퍼 또는 null
     */
    async getImage(postId, categoryId) {
        try {
            const configDB = this.dbManager.getConfigDB();

            const row = await this.dbManager.getQuery(
                configDB,
                `SELECT image_data FROM og_images 
                 WHERE post_id = ? AND category_id = ?`,
                [postId, categoryId]
            );

            return row ? row.image_data : null;
        } catch (error) {
            console.error('대표 이미지 조회 실패:', error);
            return null;
        }
    }

    /**
     * 이미지 재생성
     * @param {number} postId - 게시글 ID
     * @param {number} categoryId - 카테고리 ID
     * @returns {Promise<Buffer>} 새로 생성된 이미지 버퍼
     */
    async regenerateImage(postId, categoryId) {
        try {
            // 게시글 정보 조회
            const forumDB = await this.dbManager.getForumDB(categoryId);
            const post = await this.dbManager.getQuery(
                forumDB,
                'SELECT * FROM posts WHERE id = ?',
                [postId]
            );

            if (!post) {
                throw new Error(`게시글을 찾을 수 없습니다: ${postId}`);
            }

            // 카테고리 정보 조회
            const configDB = this.dbManager.getConfigDB();
            const subforum = await this.dbManager.getQuery(
                configDB,
                'SELECT * FROM categories WHERE id = ?',
                [categoryId]
            );

            // 작성자 정보 조회
            const author = await this.dbManager.getQuery(
                configDB,
                'SELECT username FROM users WHERE id = ?',
                [post.user_id]
            );

            // 이미지 생성
            const imageBuffer = await this.generateImage(post, subforum, author || {});

            // 저장
            await this.saveImage(postId, categoryId, imageBuffer);

            return imageBuffer;
        } catch (error) {
            console.error('대표 이미지 재생성 실패:', error);
            throw error;
        }
    }

    /**
     * 기본 이미지 반환
     * @returns {Promise<Buffer>} 기본 이미지 버퍼
     */
    async getDefaultImage() {
        try {
            const imageBuffer = await fs.readFile(this.defaultImagePath);
            return imageBuffer;
        } catch (error) {
            console.error('기본 이미지 로드 실패:', error);
            // 기본 이미지가 없으면 간단한 이미지 생성
            return this._createFallbackImage();
        }
    }

    /**
     * 폴백 이미지 생성 (기본 이미지가 없을 때)
     * @returns {Buffer} 폴백 이미지 버퍼
     * @private
     */
    _createFallbackImage() {
        const canvas = createCanvas(this.width, this.height);
        const ctx = canvas.getContext('2d');

        // 단순한 배경
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, this.width, this.height);

        // 사이트 이름
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 72px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(this.siteName, this.width / 2, this.height / 2);

        return canvas.toBuffer('image/png');
    }

    /**
     * 텍스트 줄바꿈 처리
     * @param {CanvasRenderingContext2D} ctx - Canvas 컨텍스트
     * @param {string} text - 줄바꿈할 텍스트
     * @param {number} maxWidth - 최대 너비
     * @returns {Array<string>} 줄바꿈된 텍스트 배열
     */
    wrapText(ctx, text, maxWidth, maxLines = 3) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        for (const word of words) {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;

                if (lines.length >= maxLines - 1) {
                    break;
                }
            } else {
                currentLine = testLine;
            }
        }

        if (currentLine) {
            // 마지막 줄이 maxLines를 초과하면 말줄임표 추가
            if (lines.length >= maxLines - 1) {
                const truncated = currentLine.substring(0, 30) + '...';
                lines.push(truncated);
            } else {
                lines.push(currentLine);
            }
        }

        return lines;
    }
}

module.exports = OGImageGenerator;
