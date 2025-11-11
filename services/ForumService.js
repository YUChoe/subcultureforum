const DatabaseManagerSingleton = require('./DatabaseManager');
const { renderMarkdown, extractPlainText } = require('../utils/markdown');

class ForumService {
    constructor() {
        this.dbManager = DatabaseManagerSingleton.getInstance();
    }

    /**
     * 모든 활성 서브포럼 목록 조회
     * @returns {Promise<Array>} 서브포럼 목록
     */
    async getSubforums() {
        try {
            const configDB = this.dbManager.getConfigDB();

            const subforums = await this.dbManager.allQuery(
                configDB,
                `SELECT id, name, description, display_order, created_at
                 FROM categories
                 WHERE is_active = 1
                 ORDER BY display_order ASC, created_at ASC`
            );

            // 각 서브포럼의 통계 정보 추가
            const subforumsWithStats = await Promise.all(
                subforums.map(async (subforum) => {
                    const stats = await this.getSubforumStats(subforum.id);
                    return {
                        ...subforum,
                        ...stats
                    };
                })
            );

            return subforumsWithStats;
        } catch (error) {
            console.error('서브포럼 목록 조회 실패:', error);
            throw error;
        }
    }

    /**
     * 특정 서브포럼 정보 조회
     * @param {number} subforumId - 서브포럼 ID
     * @returns {Promise<Object|null>} 서브포럼 정보
     */
    async getSubforumById(subforumId) {
        if (!subforumId) {
            return null;
        }

        try {
            const configDB = this.dbManager.getConfigDB();

            const subforum = await this.dbManager.getQuery(
                configDB,
                `SELECT id, name, description, display_order, is_active, created_at
                 FROM categories
                 WHERE id = ? AND is_active = 1`,
                [subforumId]
            );

            if (!subforum) {
                return null;
            }

            // 서브포럼 통계 정보 추가
            const stats = await this.getSubforumStats(subforumId);

            return {
                ...subforum,
                ...stats
            };
        } catch (error) {
            console.error('서브포럼 조회 실패:', error);
            return null;
        }
    }

    /**
     * 서브포럼 통계 정보 조회
     * @param {number} subforumId - 서브포럼 ID
     * @returns {Promise<Object>} 통계 정보
     */
    async getSubforumStats(subforumId) {
        try {
            const forumDB = await this.dbManager.getForumDB(subforumId);

            // 게시글 수 조회
            const postCountResult = await this.dbManager.getQuery(
                forumDB,
                'SELECT COUNT(*) as count FROM posts WHERE category_id = ?',
                [subforumId]
            );

            // 댓글 수 조회
            const commentCountResult = await this.dbManager.getQuery(
                forumDB,
                `SELECT COUNT(*) as count FROM comments c
                 JOIN posts p ON c.post_id = p.id
                 WHERE p.category_id = ?`,
                [subforumId]
            );

            // 최근 게시글 정보 조회
            const latestPostData = await this.dbManager.getQuery(
                forumDB,
                `SELECT p.id, p.title, p.created_at, p.user_id
                 FROM posts p
                 WHERE p.category_id = ?
                 ORDER BY p.created_at DESC
                 LIMIT 1`,
                [subforumId]
            );

            let latestPost = null;
            if (latestPostData) {
                const configDB = this.dbManager.getConfigDB();
                const user = await this.dbManager.getQuery(
                    configDB,
                    'SELECT username FROM users WHERE id = ?',
                    [latestPostData.user_id]
                );
                latestPost = {
                    ...latestPostData,
                    username: user?.username || '알 수 없음'
                };
            }

            // 최근 댓글 정보 조회
            const latestCommentData = await this.dbManager.getQuery(
                forumDB,
                `SELECT c.created_at, c.user_id, p.id as post_id, p.title as post_title
                 FROM comments c
                 JOIN posts p ON c.post_id = p.id
                 WHERE p.category_id = ?
                 ORDER BY c.created_at DESC
                 LIMIT 1`,
                [subforumId]
            );

            let latestComment = null;
            if (latestCommentData) {
                const configDB = this.dbManager.getConfigDB();
                const user = await this.dbManager.getQuery(
                    configDB,
                    'SELECT username FROM users WHERE id = ?',
                    [latestCommentData.user_id]
                );
                latestComment = {
                    ...latestCommentData,
                    username: user?.username || '알 수 없음'
                };
            }

            return {
                post_count: postCountResult?.count || 0,
                comment_count: commentCountResult?.count || 0,
                latest_post: latestPost || null,
                latest_comment: latestComment || null,
                last_activity_at: this.getLastActivityTime(latestPost, latestComment)
            };
        } catch (error) {
            console.error(`서브포럼 ${subforumId} 통계 조회 실패:`, error);
            return {
                post_count: 0,
                comment_count: 0,
                latest_post: null,
                latest_comment: null,
                last_activity_at: null
            };
        }
    }

    /**
     * 최근 활동 시간 계산
     * @param {Object} latestPost - 최근 게시글
     * @param {Object} latestComment - 최근 댓글
     * @returns {string|null} 최근 활동 시간
     */
    getLastActivityTime(latestPost, latestComment) {
        const postTime = latestPost?.created_at;
        const commentTime = latestComment?.created_at;

        if (!postTime && !commentTime) {
            return null;
        }

        if (!postTime) return commentTime;
        if (!commentTime) return postTime;

        return new Date(postTime) > new Date(commentTime) ? postTime : commentTime;
    }

    /**
     * 특정 서브포럼의 게시글 목록 조회
     * @param {number} subforumId - 서브포럼 ID
     * @param {Object} options - 조회 옵션
     * @param {string} options.sortBy - 정렬 방식 ('created_at' 또는 'last_comment_at')
     * @param {number} options.page - 페이지 번호 (기본값: 1)
     * @param {number} options.limit - 페이지당 게시글 수 (기본값: 20)
     * @returns {Promise<Object>} 게시글 목록과 페이지네이션 정보
     */
    async getPosts(subforumId, options = {}) {
        const {
            sortBy = 'created_at',
            page = 1,
            limit = 20
        } = options;

        if (!subforumId) {
            throw new Error('서브포럼 ID가 필요합니다.');
        }

        // 정렬 방식 검증
        const validSortOptions = ['created_at', 'last_comment_at'];
        if (!validSortOptions.includes(sortBy)) {
            throw new Error('올바르지 않은 정렬 방식입니다.');
        }

        try {
            const forumDB = await this.dbManager.getForumDB(subforumId);
            const configDB = this.dbManager.getConfigDB();

            // 오프셋 계산
            const offset = (page - 1) * limit;

            // 정렬 컬럼 결정
            const orderColumn = sortBy === 'last_comment_at' ? 'p.last_comment_at' : 'p.created_at';

            // 게시글 목록 조회 (사용자 정보는 별도로 조회)
            const posts = await this.dbManager.allQuery(
                forumDB,
                `SELECT
                    p.id,
                    p.title,
                    p.content,
                    p.view_count,
                    p.created_at,
                    p.updated_at,
                    p.last_comment_at,
                    p.user_id,
                    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count
                 FROM posts p
                 WHERE p.category_id = ?
                 ORDER BY ${orderColumn} DESC
                 LIMIT ? OFFSET ?`,
                [subforumId, limit, offset]
            );

            // 사용자 정보를 config DB에서 별도로 조회하여 추가
            const postsWithUserInfo = await Promise.all(
                posts.map(async (post) => {
                    if (post.user_id) {
                        const user = await this.dbManager.getQuery(
                            configDB,
                            'SELECT username, role FROM users WHERE id = ?',
                            [post.user_id]
                        );
                        return {
                            ...post,
                            username: user?.username || '알 수 없음',
                            role: user?.role || 'user'
                        };
                    }
                    return {
                        ...post,
                        username: '알 수 없음',
                        role: 'user'
                    };
                })
            );

            // 전체 게시글 수 조회
            const totalCountResult = await this.dbManager.getQuery(
                forumDB,
                'SELECT COUNT(*) as count FROM posts WHERE category_id = ?',
                [subforumId]
            );

            const totalCount = totalCountResult?.count || 0;
            const totalPages = Math.ceil(totalCount / limit);

            // 게시글 내용 미리보기 생성
            const postsWithPreview = postsWithUserInfo.map(post => ({
                ...post,
                content_preview: extractPlainText(post.content, 150),
                is_recent: this.isRecentPost(post.created_at),
                has_recent_comments: this.hasRecentComments(post.last_comment_at)
            }));

            return {
                posts: postsWithPreview,
                pagination: {
                    current_page: page,
                    total_pages: totalPages,
                    total_count: totalCount,
                    limit: limit,
                    has_next: page < totalPages,
                    has_prev: page > 1
                },
                sort_info: {
                    sort_by: sortBy,
                    sort_label: sortBy === 'last_comment_at' ? '최신 댓글 순' : '최신 게시글 순'
                }
            };
        } catch (error) {
            console.error('게시글 목록 조회 실패:', error);
            throw error;
        }
    }

    /**
     * 게시글 내용 미리보기 생성
     * @param {string} content - 게시글 내용
     * @param {number} maxLength - 최대 길이
     * @returns {string} 미리보기 텍스트
     */
    generateContentPreview(content, maxLength = 150) {
        if (!content) {
            return '';
        }

        // HTML 태그 제거
        const textContent = content.replace(/<[^>]*>/g, '');

        // 줄바꿈을 공백으로 변환
        const cleanContent = textContent.replace(/\s+/g, ' ').trim();

        if (cleanContent.length <= maxLength) {
            return cleanContent;
        }

        return cleanContent.substring(0, maxLength) + '...';
    }

    /**
     * 최근 게시글인지 확인 (24시간 이내)
     * @param {string} createdAt - 생성 시간
     * @returns {boolean} 최근 게시글 여부
     */
    isRecentPost(createdAt) {
        if (!createdAt) {
            return false;
        }

        const postTime = new Date(createdAt);
        const now = new Date();
        const hoursDiff = (now - postTime) / (1000 * 60 * 60);

        return hoursDiff <= 24;
    }

    /**
     * 최근 댓글이 있는지 확인 (6시간 이내)
     * @param {string} lastCommentAt - 마지막 댓글 시간
     * @returns {boolean} 최근 댓글 여부
     */
    hasRecentComments(lastCommentAt) {
        if (!lastCommentAt) {
            return false;
        }

        const commentTime = new Date(lastCommentAt);
        const now = new Date();
        const hoursDiff = (now - commentTime) / (1000 * 60 * 60);

        return hoursDiff <= 6;
    }

    /**
     * 인기 게시글 조회 (조회수 기준)
     * @param {number} subforumId - 서브포럼 ID (선택사항)
     * @param {number} limit - 조회할 게시글 수 (기본값: 10)
     * @param {number} days - 기간 (일 단위, 기본값: 7일)
     * @returns {Promise<Array>} 인기 게시글 목록
     */
    async getPopularPosts(subforumId = null, limit = 10, days = 7) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            const cutoffDateStr = cutoffDate.toISOString();

            if (subforumId) {
                // 특정 서브포럼의 인기 게시글
                const forumDB = await this.dbManager.getForumDB(subforumId);

                const posts = await this.dbManager.allQuery(
                    forumDB,
                    `SELECT
                        p.id,
                        p.title,
                        p.view_count,
                        p.created_at,
                        p.category_id,
                        p.user_id,
                        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count
                     FROM posts p
                     WHERE p.category_id = ? AND p.created_at >= ?
                     ORDER BY p.view_count DESC, p.created_at DESC
                     LIMIT ?`,
                    [subforumId, cutoffDateStr, limit]
                );

                // 사용자 정보를 config DB에서 별도로 조회
                const configDB = this.dbManager.getConfigDB();
                const postsWithUserInfo = await Promise.all(
                    posts.map(async (post) => {
                        if (post.user_id) {
                            const user = await this.dbManager.getQuery(
                                configDB,
                                'SELECT username FROM users WHERE id = ?',
                                [post.user_id]
                            );
                            return {
                                ...post,
                                username: user?.username || '알 수 없음'
                            };
                        }
                        return {
                            ...post,
                            username: '알 수 없음'
                        };
                    })
                );

                return postsWithUserInfo;
            } else {
                // 전체 서브포럼의 인기 게시글
                const subforums = await this.getSubforums();
                const allPosts = [];

                for (const subforum of subforums) {
                    try {
                        const forumDB = await this.dbManager.getForumDB(subforum.id);

                        const posts = await this.dbManager.allQuery(
                            forumDB,
                            `SELECT
                                p.id,
                                p.title,
                                p.view_count,
                                p.created_at,
                                p.category_id,
                                p.user_id,
                                (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count
                             FROM posts p
                             WHERE p.category_id = ? AND p.created_at >= ?
                             ORDER BY p.view_count DESC
                             LIMIT ?`,
                            [subforum.id, cutoffDateStr, limit]
                        );

                        // 사용자 정보를 config DB에서 별도로 조회
                        const configDB = this.dbManager.getConfigDB();
                        const postsWithUserInfo = await Promise.all(
                            posts.map(async (post) => {
                                if (post.user_id) {
                                    const user = await this.dbManager.getQuery(
                                        configDB,
                                        'SELECT username FROM users WHERE id = ?',
                                        [post.user_id]
                                    );
                                    return {
                                        ...post,
                                        username: user?.username || '알 수 없음'
                                    };
                                }
                                return {
                                    ...post,
                                    username: '알 수 없음'
                                };
                            })
                        );

                        // 서브포럼 정보 추가
                        const postsWithSubforum = postsWithUserInfo.map(post => ({
                            ...post,
                            subforum_name: subforum.name
                        }));

                        allPosts.push(...postsWithSubforum);
                    } catch (error) {
                        console.warn(`서브포럼 ${subforum.id} 인기 게시글 조회 실패:`, error);
                    }
                }

                // 조회수 기준으로 정렬하고 제한
                return allPosts
                    .sort((a, b) => b.view_count - a.view_count)
                    .slice(0, limit);
            }
        } catch (error) {
            console.error('인기 게시글 조회 실패:', error);
            throw error;
        }
    }

    /**
     * 최근 활동 게시글 조회 (댓글이 달린 게시글)
     * @param {number} subforumId - 서브포럼 ID (선택사항)
     * @param {number} limit - 조회할 게시글 수 (기본값: 10)
     * @returns {Promise<Array>} 최근 활동 게시글 목록
     */
    async getRecentActivityPosts(subforumId = null, limit = 10) {
        try {
            if (subforumId) {
                // 특정 서브포럼의 최근 활동 게시글
                const forumDB = await this.dbManager.getForumDB(subforumId);

                const posts = await this.dbManager.allQuery(
                    forumDB,
                    `SELECT
                        p.id,
                        p.title,
                        p.created_at,
                        p.last_comment_at,
                        p.category_id,
                        p.user_id,
                        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count,
                        (SELECT c2.user_id FROM comments c2
                         WHERE c2.post_id = p.id
                         ORDER BY c2.created_at DESC LIMIT 1) as last_commenter_id
                     FROM posts p
                     WHERE p.category_id = ? AND p.last_comment_at IS NOT NULL
                     ORDER BY p.last_comment_at DESC
                     LIMIT ?`,
                    [subforumId, limit]
                );

                // 사용자 정보를 config DB에서 별도로 조회
                const configDB = this.dbManager.getConfigDB();
                const postsWithUserInfo = await Promise.all(
                    posts.map(async (post) => {
                        let username = '알 수 없음';
                        let lastCommenter = '알 수 없음';

                        if (post.user_id) {
                            const user = await this.dbManager.getQuery(
                                configDB,
                                'SELECT username FROM users WHERE id = ?',
                                [post.user_id]
                            );
                            username = user?.username || '알 수 없음';
                        }

                        if (post.last_commenter_id) {
                            const commenterUser = await this.dbManager.getQuery(
                                configDB,
                                'SELECT username FROM users WHERE id = ?',
                                [post.last_commenter_id]
                            );
                            lastCommenter = commenterUser?.username || '알 수 없음';
                        }

                        return {
                            ...post,
                            username: username,
                            last_commenter: lastCommenter
                        };
                    })
                );

                return postsWithUserInfo;
            } else {
                // 전체 서브포럼의 최근 활동 게시글
                const subforums = await this.getSubforums();
                const allPosts = [];

                for (const subforum of subforums) {
                    try {
                        const forumDB = await this.dbManager.getForumDB(subforum.id);

                        const posts = await this.dbManager.allQuery(
                            forumDB,
                            `SELECT
                                p.id,
                                p.title,
                                p.created_at,
                                p.last_comment_at,
                                p.category_id,
                                p.user_id,
                                (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count,
                                (SELECT c2.user_id FROM comments c2
                                 WHERE c2.post_id = p.id
                                 ORDER BY c2.created_at DESC LIMIT 1) as last_commenter_id
                             FROM posts p
                             WHERE p.category_id = ? AND p.last_comment_at IS NOT NULL
                             ORDER BY p.last_comment_at DESC
                             LIMIT ?`,
                            [subforum.id, Math.ceil(limit / subforums.length)]
                        );

                        // 사용자 정보를 config DB에서 별도로 조회
                        const configDB = this.dbManager.getConfigDB();
                        const postsWithUserInfo = await Promise.all(
                            posts.map(async (post) => {
                                let username = '알 수 없음';
                                let lastCommenter = '알 수 없음';

                                if (post.user_id) {
                                    const user = await this.dbManager.getQuery(
                                        configDB,
                                        'SELECT username FROM users WHERE id = ?',
                                        [post.user_id]
                                    );
                                    username = user?.username || '알 수 없음';
                                }

                                if (post.last_commenter_id) {
                                    const commenterUser = await this.dbManager.getQuery(
                                        configDB,
                                        'SELECT username FROM users WHERE id = ?',
                                        [post.last_commenter_id]
                                    );
                                    lastCommenter = commenterUser?.username || '알 수 없음';
                                }

                                return {
                                    ...post,
                                    username: username,
                                    last_commenter: lastCommenter
                                };
                            })
                        );

                        // 서브포럼 정보 추가
                        const postsWithSubforum = postsWithUserInfo.map(post => ({
                            ...post,
                            subforum_name: subforum.name
                        }));

                        allPosts.push(...postsWithSubforum);
                    } catch (error) {
                        console.warn(`서브포럼 ${subforum.id} 최근 활동 게시글 조회 실패:`, error);
                    }
                }

                // 최근 댓글 시간 기준으로 정렬하고 제한
                return allPosts
                    .sort((a, b) => new Date(b.last_comment_at) - new Date(a.last_comment_at))
                    .slice(0, limit);
            }
        } catch (error) {
            console.error('최근 활동 게시글 조회 실패:', error);
            throw error;
        }
    }

    /**
     * 게시글 상세 조회 및 조회수 증가
     * @param {number} postId - 게시글 ID
     * @param {number} subforumId - 서브포럼 ID
     * @param {boolean} incrementView - 조회수 증가 여부 (기본값: true)
     * @returns {Promise<Object|null>} 게시글 정보
     */
    async getPost(postId, subforumId, incrementView = true) {
        if (!postId || !subforumId) {
            return null;
        }

        try {
            const forumDB = await this.dbManager.getForumDB(subforumId);
            const configDB = this.dbManager.getConfigDB();

            // 게시글 조회
            const post = await this.dbManager.getQuery(
                forumDB,
                `SELECT
                    p.id,
                    p.category_id,
                    p.user_id,
                    p.title,
                    p.content,
                    p.view_count,
                    p.created_at,
                    p.updated_at,
                    p.last_comment_at
                 FROM posts p
                 WHERE p.id = ? AND p.category_id = ?`,
                [postId, subforumId]
            );

            if (!post) {
                return null;
            }

            // 작성자 정보 조회
            const user = await this.dbManager.getQuery(
                configDB,
                'SELECT username, role FROM users WHERE id = ?',
                [post.user_id]
            );

            // 조회수 증가
            if (incrementView) {
                await this.dbManager.runQuery(
                    forumDB,
                    'UPDATE posts SET view_count = view_count + 1 WHERE id = ?',
                    [postId]
                );
                post.view_count += 1;
            }

            // 댓글 수 조회
            const commentCountResult = await this.dbManager.getQuery(
                forumDB,
                'SELECT COUNT(*) as count FROM comments WHERE post_id = ?',
                [postId]
            );

            // 첨부파일 목록 조회
            const attachments = await this.getAttachments(postId, subforumId);

            return {
                ...post,
                username: user?.username || '알 수 없음',
                role: user?.role || 'user',
                comment_count: commentCountResult?.count || 0,
                content_html: renderMarkdown(post.content),
                attachments: attachments
            };
        } catch (error) {
            console.error('게시글 조회 실패:', error);
            return null;
        }
    }

    /**
     * 게시글 작성
     * @param {number} userId - 작성자 ID
     * @param {number} subforumId - 서브포럼 ID
     * @param {string} title - 게시글 제목
     * @param {string} content - 게시글 내용
     * @returns {Promise<number>} 생성된 게시글 ID
     */
    async createPost(userId, subforumId, title, content) {
        if (!userId || !subforumId || !title || !content) {
            throw new Error('필수 정보가 누락되었습니다.');
        }

        try {
            const forumDB = await this.dbManager.getForumDB(subforumId);
            console.log(`게시글 생성 시도: 서브포럼 ${subforumId}, 사용자 ${userId}, 제목: ${title}`);

            const result = await this.dbManager.runQuery(
                forumDB,
                `INSERT INTO posts (category_id, user_id, title, content, created_at, updated_at, last_comment_at)
                 VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`,
                [subforumId, userId, title, content]
            );

            console.log('DB 삽입 결과:', result);

            if (!result.id) {
                throw new Error('게시글 생성에 실패했습니다.');
            }

            console.log(`게시글 생성 완료: ID ${result.id}, 서브포럼 ${subforumId}`);
            return result.id;
        } catch (error) {
            console.error('게시글 작성 실패:', error);
            throw error;
        }
    }

    /**
     * 게시글 수정
     * @param {number} postId - 게시글 ID
     * @param {number} subforumId - 서브포럼 ID
     * @param {number} userId - 수정자 ID
     * @param {string} title - 수정할 제목
     * @param {string} content - 수정할 내용
     * @returns {Promise<boolean>} 수정 성공 여부
     */
    async updatePost(postId, subforumId, userId, title, content) {
        if (!postId || !subforumId || !userId || !title || !content) {
            throw new Error('필수 정보가 누락되었습니다.');
        }

        try {
            const forumDB = await this.dbManager.getForumDB(subforumId);

            // 게시글 존재 및 권한 확인
            const existingPost = await this.dbManager.getQuery(
                forumDB,
                'SELECT user_id FROM posts WHERE id = ? AND category_id = ?',
                [postId, subforumId]
            );

            if (!existingPost) {
                throw new Error('게시글을 찾을 수 없습니다.');
            }

            if (existingPost.user_id !== userId) {
                throw new Error('게시글 수정 권한이 없습니다.');
            }

            // 게시글 수정
            const result = await this.dbManager.runQuery(
                forumDB,
                `UPDATE posts
                 SET title = ?, content = ?, updated_at = datetime('now')
                 WHERE id = ? AND category_id = ?`,
                [title, content, postId, subforumId]
            );

            if (result.changes === 0) {
                throw new Error('게시글 수정에 실패했습니다.');
            }

            console.log(`게시글 수정 완료: ID ${postId}, 서브포럼 ${subforumId}`);
            return true;
        } catch (error) {
            console.error('게시글 수정 실패:', error);
            throw error;
        }
    }

    /**
     * 게시글 삭제
     * @param {number} postId - 게시글 ID
     * @param {number} subforumId - 서브포럼 ID
     * @param {number} userId - 삭제 요청자 ID
     * @param {boolean} isModerator - 모더레이터 여부
     * @returns {Promise<boolean>} 삭제 성공 여부
     */
    async deletePost(postId, subforumId, userId, isModerator = false) {
        if (!postId || !subforumId || !userId) {
            throw new Error('필수 정보가 누락되었습니다.');
        }

        try {
            const forumDB = await this.dbManager.getForumDB(subforumId);

            // 게시글 존재 및 권한 확인
            const existingPost = await this.dbManager.getQuery(
                forumDB,
                'SELECT user_id FROM posts WHERE id = ? AND category_id = ?',
                [postId, subforumId]
            );

            if (!existingPost) {
                throw new Error('게시글을 찾을 수 없습니다.');
            }

            // 작성자이거나 모더레이터인 경우에만 삭제 가능
            if (existingPost.user_id !== userId && !isModerator) {
                throw new Error('게시글 삭제 권한이 없습니다.');
            }

            // 게시글 삭제 (댓글은 CASCADE로 자동 삭제됨)
            const result = await this.dbManager.runQuery(
                forumDB,
                'DELETE FROM posts WHERE id = ? AND category_id = ?',
                [postId, subforumId]
            );

            if (result.changes === 0) {
                throw new Error('게시글 삭제에 실패했습니다.');
            }

            console.log(`게시글 삭제 완료: ID ${postId}, 서브포럼 ${subforumId}`);
            return true;
        } catch (error) {
            console.error('게시글 삭제 실패:', error);
            throw error;
        }
    }

    /**
     * 게시글의 last_comment_at 업데이트
     * @param {number} postId - 게시글 ID
     * @param {number} subforumId - 서브포럼 ID
     * @returns {Promise<boolean>} 업데이트 성공 여부
     */
    async updatePostLastCommentTime(postId, subforumId) {
        if (!postId || !subforumId) {
            return false;
        }

        try {
            const forumDB = await this.dbManager.getForumDB(subforumId);

            const result = await this.dbManager.runQuery(
                forumDB,
                `UPDATE posts
                 SET last_comment_at = datetime('now')
                 WHERE id = ? AND category_id = ?`,
                [postId, subforumId]
            );

            return result.changes > 0;
        } catch (error) {
            console.error('게시글 last_comment_at 업데이트 실패:', error);
            return false;
        }
    }

    /**
     * 사용자별 게시글 목록 조회
     * @param {number} userId - 사용자 ID
     * @param {Object} options - 조회 옵션
     * @returns {Promise<Array>} 사용자 게시글 목록
     */
    async getUserPosts(userId, options = {}) {
        const { page = 1, limit = 20 } = options;

        if (!userId) {
            throw new Error('사용자 ID가 필요합니다.');
        }

        try {
            const subforums = await this.getSubforums();
            const allPosts = [];
            const offset = (page - 1) * limit;

            for (const subforum of subforums) {
                try {
                    const forumDB = await this.dbManager.getForumDB(subforum.id);

                    const posts = await this.dbManager.allQuery(
                        forumDB,
                        `SELECT
                            p.id,
                            p.title,
                            p.created_at,
                            p.updated_at,
                            p.view_count,
                            p.category_id,
                            (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count
                         FROM posts p
                         WHERE p.user_id = ?
                         ORDER BY p.created_at DESC`,
                        [userId]
                    );

                    // 서브포럼 정보 추가
                    const postsWithSubforum = posts.map(post => ({
                        ...post,
                        subforum_name: subforum.name
                    }));

                    allPosts.push(...postsWithSubforum);
                } catch (error) {
                    console.warn(`서브포럼 ${subforum.id} 사용자 게시글 조회 실패:`, error);
                }
            }

            // 생성 시간 기준으로 정렬
            const sortedPosts = allPosts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            // 페이지네이션 적용
            const paginatedPosts = sortedPosts.slice(offset, offset + limit);
            const totalCount = sortedPosts.length;
            const totalPages = Math.ceil(totalCount / limit);

            return {
                posts: paginatedPosts,
                pagination: {
                    current_page: page,
                    total_pages: totalPages,
                    total_count: totalCount,
                    limit: limit,
                    has_next: page < totalPages,
                    has_prev: page > 1
                }
            };
        } catch (error) {
            console.error('사용자 게시글 목록 조회 실패:', error);
            throw error;
        }
    }
    /**
     * 댓글 작성
     * @param {number} userId - 작성자 ID
     * @param {number} postId - 게시글 ID
     * @param {number} subforumId - 서브포럼 ID
     * @param {string} content - 댓글 내용
     * @returns {Promise<number>} 생성된 댓글 ID
     */
    async createComment(userId, postId, subforumId, content) {
        if (!userId || !postId || !subforumId || !content) {
            throw new Error('필수 정보가 누락되었습니다.');
        }

        try {
            const forumDB = await this.dbManager.getForumDB(subforumId);

            // 게시글 존재 확인
            const post = await this.dbManager.getQuery(
                forumDB,
                'SELECT id FROM posts WHERE id = ? AND category_id = ?',
                [postId, subforumId]
            );

            if (!post) {
                throw new Error('게시글을 찾을 수 없습니다.');
            }

            // 댓글 생성
            const result = await this.dbManager.runQuery(
                forumDB,
                `INSERT INTO comments (post_id, user_id, content, created_at, updated_at)
                 VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
                [postId, userId, content]
            );

            if (!result.id) {
                throw new Error('댓글 작성에 실패했습니다.');
            }

            console.log(`댓글 생성 완료: ID ${result.id}, 게시글 ${postId}`);
            return result.id;
        } catch (error) {
            console.error('댓글 작성 실패:', error);
            throw error;
        }
    }

    /**
     * 게시글의 댓글 목록 조회
     * @param {number} postId - 게시글 ID
     * @param {number} subforumId - 서브포럼 ID
     * @param {Object} options - 조회 옵션
     * @returns {Promise<Array>} 댓글 목록
     */
    async getComments(postId, subforumId, options = {}) {
        const { page = 1, limit = 50 } = options;

        if (!postId || !subforumId) {
            return [];
        }

        try {
            const forumDB = await this.dbManager.getForumDB(subforumId);
            const configDB = this.dbManager.getConfigDB();

            // 오프셋 계산
            const offset = (page - 1) * limit;

            // 댓글 목록 조회
            const comments = await this.dbManager.allQuery(
                forumDB,
                `SELECT
                    c.id,
                    c.post_id,
                    c.user_id,
                    c.content,
                    c.created_at,
                    c.updated_at
                 FROM comments c
                 WHERE c.post_id = ?
                 ORDER BY c.created_at ASC
                 LIMIT ? OFFSET ?`,
                [postId, limit, offset]
            );

            // 사용자 정보를 config DB에서 별도로 조회하여 추가
            const commentsWithUserInfo = await Promise.all(
                comments.map(async (comment) => {
                    if (comment.user_id) {
                        const user = await this.dbManager.getQuery(
                            configDB,
                            'SELECT username, role FROM users WHERE id = ?',
                            [comment.user_id]
                        );
                        return {
                            ...comment,
                            username: user?.username || '알 수 없음',
                            role: user?.role || 'user'
                        };
                    }
                    return {
                        ...comment,
                        username: '알 수 없음',
                        role: 'user'
                    };
                })
            );

            return commentsWithUserInfo;
        } catch (error) {
            console.error('댓글 목록 조회 실패:', error);
            return [];
        }
    }

    /**
     * 댓글 수정
     * @param {number} commentId - 댓글 ID
     * @param {number} subforumId - 서브포럼 ID
     * @param {number} userId - 수정자 ID
     * @param {string} content - 수정할 내용
     * @returns {Promise<boolean>} 수정 성공 여부
     */
    async updateComment(commentId, subforumId, userId, content) {
        if (!commentId || !subforumId || !userId || !content) {
            throw new Error('필수 정보가 누락되었습니다.');
        }

        try {
            const forumDB = await this.dbManager.getForumDB(subforumId);

            // 댓글 존재 및 권한 확인
            const existingComment = await this.dbManager.getQuery(
                forumDB,
                'SELECT user_id FROM comments WHERE id = ?',
                [commentId]
            );

            if (!existingComment) {
                throw new Error('댓글을 찾을 수 없습니다.');
            }

            if (existingComment.user_id !== userId) {
                throw new Error('댓글 수정 권한이 없습니다.');
            }

            // 댓글 수정
            const result = await this.dbManager.runQuery(
                forumDB,
                `UPDATE comments
                 SET content = ?, updated_at = datetime('now')
                 WHERE id = ?`,
                [content, commentId]
            );

            if (result.changes === 0) {
                throw new Error('댓글 수정에 실패했습니다.');
            }

            console.log(`댓글 수정 완료: ID ${commentId}`);
            return true;
        } catch (error) {
            console.error('댓글 수정 실패:', error);
            throw error;
        }
    }

    /**
     * 댓글 삭제
     * @param {number} commentId - 댓글 ID
     * @param {number} subforumId - 서브포럼 ID
     * @param {number} userId - 삭제 요청자 ID
     * @param {boolean} isModerator - 모더레이터 여부
     * @returns {Promise<boolean>} 삭제 성공 여부
     */
    async deleteComment(commentId, subforumId, userId, isModerator = false) {
        if (!commentId || !subforumId || !userId) {
            throw new Error('필수 정보가 누락되었습니다.');
        }

        try {
            const forumDB = await this.dbManager.getForumDB(subforumId);

            // 댓글 존재 및 권한 확인
            const existingComment = await this.dbManager.getQuery(
                forumDB,
                'SELECT user_id FROM comments WHERE id = ?',
                [commentId]
            );

            if (!existingComment) {
                throw new Error('댓글을 찾을 수 없습니다.');
            }

            // 작성자이거나 모더레이터인 경우에만 삭제 가능
            if (existingComment.user_id !== userId && !isModerator) {
                throw new Error('댓글 삭제 권한이 없습니다.');
            }

            // 댓글 삭제
            const result = await this.dbManager.runQuery(
                forumDB,
                'DELETE FROM comments WHERE id = ?',
                [commentId]
            );

            if (result.changes === 0) {
                throw new Error('댓글 삭제에 실패했습니다.');
            }

            console.log(`댓글 삭제 완료: ID ${commentId}`);
            return true;
        } catch (error) {
            console.error('댓글 삭제 실패:', error);
            throw error;
        }
    }

    /**
     * 첨부파일 저장
     * @param {number} postId - 게시글 ID
     * @param {number} subforumId - 서브포럼 ID
     * @param {Object} file - 업로드된 파일 객체
     * @returns {Promise<number>} 첨부파일 ID
     */
    async saveAttachment(postId, subforumId, file) {
        if (!postId || !subforumId || !file) {
            throw new Error('필수 정보가 누락되었습니다.');
        }

        try {
            const forumDB = await this.dbManager.getForumDB(subforumId);

            // 고유한 파일명 생성 (타임스탬프 + 원본 파일명)
            const timestamp = Date.now();
            const uniqueFilename = `${timestamp}_${file.originalname}`;

            const result = await this.dbManager.runQuery(
                forumDB,
                `INSERT INTO attachments (post_id, filename, original_filename, mime_type, file_size, file_data, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
                [
                    postId,
                    uniqueFilename,
                    file.originalname,
                    file.mimetype,
                    file.size,
                    file.buffer
                ]
            );

            if (!result.id) {
                throw new Error('첨부파일 저장에 실패했습니다.');
            }

            console.log(`첨부파일 저장 완료: ID ${result.id}, 게시글 ${postId}`);
            return result.id;
        } catch (error) {
            console.error('첨부파일 저장 실패:', error);
            throw error;
        }
    }

    /**
     * 게시글의 첨부파일 목록 조회
     * @param {number} postId - 게시글 ID
     * @param {number} subforumId - 서브포럼 ID
     * @returns {Promise<Array>} 첨부파일 목록
     */
    async getAttachments(postId, subforumId) {
        if (!postId || !subforumId) {
            return [];
        }

        try {
            const forumDB = await this.dbManager.getForumDB(subforumId);

            const attachments = await this.dbManager.allQuery(
                forumDB,
                `SELECT id, filename, original_filename, mime_type, file_size, created_at
                 FROM attachments
                 WHERE post_id = ?
                 ORDER BY created_at ASC`,
                [postId]
            );

            return attachments;
        } catch (error) {
            console.error('첨부파일 목록 조회 실패:', error);
            return [];
        }
    }

    /**
     * 첨부파일 데이터 조회
     * @param {number} attachmentId - 첨부파일 ID
     * @param {number} subforumId - 서브포럼 ID
     * @returns {Promise<Object|null>} 첨부파일 데이터
     */
    async getAttachmentData(attachmentId, subforumId) {
        if (!attachmentId || !subforumId) {
            return null;
        }

        try {
            const forumDB = await this.dbManager.getForumDB(subforumId);

            const attachment = await this.dbManager.getQuery(
                forumDB,
                `SELECT id, filename, original_filename, mime_type, file_size, file_data, created_at
                 FROM attachments
                 WHERE id = ?`,
                [attachmentId]
            );

            return attachment;
        } catch (error) {
            console.error('첨부파일 데이터 조회 실패:', error);
            return null;
        }
    }

    /**
     * 첨부파일 삭제
     * @param {number} attachmentId - 첨부파일 ID
     * @param {number} subforumId - 서브포럼 ID
     * @returns {Promise<boolean>} 삭제 성공 여부
     */
    async deleteAttachment(attachmentId, subforumId) {
        if (!attachmentId || !subforumId) {
            return false;
        }

        try {
            const forumDB = await this.dbManager.getForumDB(subforumId);

            const result = await this.dbManager.runQuery(
                forumDB,
                'DELETE FROM attachments WHERE id = ?',
                [attachmentId]
            );

            return result.changes > 0;
        } catch (error) {
            console.error('첨부파일 삭제 실패:', error);
            return false;
        }
    }

    /**
     * FTS5를 사용한 게시글 전문 검색
     * @param {string} query - 검색어
     * @param {Object} options - 검색 옵션
     * @param {number|null} options.subforumId - 특정 서브포럼 ID (null이면 전체 검색)
     * @param {number} options.page - 페이지 번호 (기본값: 1)
     * @param {number} options.limit - 페이지당 결과 수 (기본값: 20)
     * @param {string} options.sortBy - 정렬 방식 ('relevance', 'created_at', 'view_count')
     * @returns {Promise<Object>} 검색 결과와 페이지네이션 정보
     */
    async searchPosts(query, options = {}) {
        const {
            subforumId = null,
            page = 1,
            limit = 20,
            sortBy = 'relevance'
        } = options;

        if (!query || query.trim().length === 0) {
            return {
                posts: [],
                pagination: {
                    current_page: page,
                    total_pages: 0,
                    total_count: 0,
                    limit: limit,
                    has_next: false,
                    has_prev: false
                },
                search_info: {
                    query: query,
                    subforum_id: subforumId,
                    sort_by: sortBy
                }
            };
        }

        try {
            const searchQuery = query.trim();
            const offset = (page - 1) * limit;

            // 정렬 방식 결정
            let orderClause;
            switch (sortBy) {
                case 'created_at':
                    orderClause = 'ORDER BY p.created_at DESC';
                    break;
                case 'view_count':
                    orderClause = 'ORDER BY p.view_count DESC, p.created_at DESC';
                    break;
                case 'relevance':
                default:
                    orderClause = 'ORDER BY posts_fts.rank, p.created_at DESC';
                    break;
            }

            if (subforumId) {
                // 특정 서브포럼에서 검색
                return await this.searchInSubforum(searchQuery, subforumId, {
                    page,
                    limit,
                    offset,
                    orderClause
                });
            } else {
                // 전체 서브포럼에서 검색
                return await this.searchInAllSubforums(searchQuery, {
                    page,
                    limit,
                    offset,
                    orderClause,
                    sortBy
                });
            }
        } catch (error) {
            console.error('게시글 검색 실패:', error);
            throw error;
        }
    }

    /**
     * 특정 서브포럼에서 검색
     * @param {string} searchQuery - 검색어
     * @param {number} subforumId - 서브포럼 ID
     * @param {Object} options - 검색 옵션
     * @returns {Promise<Object>} 검색 결과
     */
    async searchInSubforum(searchQuery, subforumId, options) {
        const { page, limit, offset, orderClause } = options;

        try {
            const forumDB = await this.dbManager.getForumDB(subforumId);
            const configDB = this.dbManager.getConfigDB();

            // 서브포럼 정보 조회
            const subforum = await this.getSubforumById(subforumId);
            if (!subforum) {
                throw new Error('서브포럼을 찾을 수 없습니다.');
            }

            // FTS5 검색 쿼리 실행
            const searchResults = await this.dbManager.allQuery(
                forumDB,
                `SELECT
                    p.id,
                    p.title,
                    p.content,
                    p.view_count,
                    p.created_at,
                    p.updated_at,
                    p.last_comment_at,
                    p.user_id,
                    p.category_id,
                    posts_fts.rank,
                    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count
                 FROM posts_fts
                 JOIN posts p ON posts_fts.rowid = p.id
                 WHERE posts_fts MATCH ? AND p.category_id = ?
                 ${orderClause}
                 LIMIT ? OFFSET ?`,
                [searchQuery, subforumId, limit, offset]
            );

            // 전체 검색 결과 수 조회
            const totalCountResult = await this.dbManager.getQuery(
                forumDB,
                `SELECT COUNT(*) as count
                 FROM posts_fts
                 JOIN posts p ON posts_fts.rowid = p.id
                 WHERE posts_fts MATCH ? AND p.category_id = ?`,
                [searchQuery, subforumId]
            );

            // 사용자 정보 추가
            const postsWithUserInfo = await Promise.all(
                searchResults.map(async (post) => {
                    if (post.user_id) {
                        const user = await this.dbManager.getQuery(
                            configDB,
                            'SELECT username, role FROM users WHERE id = ?',
                            [post.user_id]
                        );
                        return {
                            ...post,
                            username: user?.username || '알 수 없음',
                            role: user?.role || 'user'
                        };
                    }
                    return {
                        ...post,
                        username: '알 수 없음',
                        role: 'user'
                    };
                })
            );

            // 검색 결과에 미리보기 및 하이라이트 추가
            const postsWithPreview = postsWithUserInfo.map(post => ({
                ...post,
                content_preview: this.generateSearchPreview(post.content, searchQuery, 200),
                title_highlight: this.highlightSearchTerms(post.title, searchQuery),
                subforum_name: subforum.name
            }));

            const totalCount = totalCountResult?.count || 0;
            const totalPages = Math.ceil(totalCount / limit);

            return {
                posts: postsWithPreview,
                pagination: {
                    current_page: page,
                    total_pages: totalPages,
                    total_count: totalCount,
                    limit: limit,
                    has_next: page < totalPages,
                    has_prev: page > 1
                },
                search_info: {
                    query: searchQuery,
                    subforum_id: subforumId,
                    subforum_name: subforum.name,
                    sort_by: options.sortBy || 'relevance'
                }
            };
        } catch (error) {
            console.error(`서브포럼 ${subforumId} 검색 실패:`, error);
            throw error;
        }
    }

    /**
     * 전체 서브포럼에서 검색
     * @param {string} searchQuery - 검색어
     * @param {Object} options - 검색 옵션
     * @returns {Promise<Object>} 검색 결과
     */
    async searchInAllSubforums(searchQuery, options) {
        const { page, limit, offset, orderClause, sortBy } = options;

        try {
            const subforums = await this.getSubforums();
            const allResults = [];

            // 각 서브포럼에서 검색 실행
            for (const subforum of subforums) {
                try {
                    const forumDB = await this.dbManager.getForumDB(subforum.id);
                    const configDB = this.dbManager.getConfigDB();

                    // FTS5 검색 쿼리 실행 (페이지네이션 없이 모든 결과 조회)
                    const searchResults = await this.dbManager.allQuery(
                        forumDB,
                        `SELECT
                            p.id,
                            p.title,
                            p.content,
                            p.view_count,
                            p.created_at,
                            p.updated_at,
                            p.last_comment_at,
                            p.user_id,
                            p.category_id,
                            posts_fts.rank,
                            (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count
                         FROM posts_fts
                         JOIN posts p ON posts_fts.rowid = p.id
                         WHERE posts_fts MATCH ? AND p.category_id = ?
                         ${orderClause}`,
                        [searchQuery, subforum.id]
                    );

                    // 사용자 정보 추가
                    const postsWithUserInfo = await Promise.all(
                        searchResults.map(async (post) => {
                            if (post.user_id) {
                                const user = await this.dbManager.getQuery(
                                    configDB,
                                    'SELECT username, role FROM users WHERE id = ?',
                                    [post.user_id]
                                );
                                return {
                                    ...post,
                                    username: user?.username || '알 수 없음',
                                    role: user?.role || 'user'
                                };
                            }
                            return {
                                ...post,
                                username: '알 수 없음',
                                role: 'user'
                            };
                        })
                    );

                    // 서브포럼 정보 추가
                    const postsWithSubforum = postsWithUserInfo.map(post => ({
                        ...post,
                        subforum_name: subforum.name,
                        subforum_id: subforum.id
                    }));

                    allResults.push(...postsWithSubforum);
                } catch (error) {
                    console.warn(`서브포럼 ${subforum.id} 검색 실패:`, error);
                }
            }

            // 전체 결과를 정렬 방식에 따라 정렬
            let sortedResults;
            switch (sortBy) {
                case 'created_at':
                    sortedResults = allResults.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                    break;
                case 'view_count':
                    sortedResults = allResults.sort((a, b) => {
                        if (b.view_count !== a.view_count) {
                            return b.view_count - a.view_count;
                        }
                        return new Date(b.created_at) - new Date(a.created_at);
                    });
                    break;
                case 'relevance':
                default:
                    sortedResults = allResults.sort((a, b) => {
                        if (a.rank !== b.rank) {
                            return a.rank - b.rank; // FTS5 rank는 낮을수록 관련도가 높음
                        }
                        return new Date(b.created_at) - new Date(a.created_at);
                    });
                    break;
            }

            // 페이지네이션 적용
            const paginatedResults = sortedResults.slice(offset, offset + limit);

            // 검색 결과에 미리보기 및 하이라이트 추가
            const postsWithPreview = paginatedResults.map(post => ({
                ...post,
                content_preview: this.generateSearchPreview(post.content, searchQuery, 200),
                title_highlight: this.highlightSearchTerms(post.title, searchQuery)
            }));

            const totalCount = sortedResults.length;
            const totalPages = Math.ceil(totalCount / limit);

            return {
                posts: postsWithPreview,
                pagination: {
                    current_page: page,
                    total_pages: totalPages,
                    total_count: totalCount,
                    limit: limit,
                    has_next: page < totalPages,
                    has_prev: page > 1
                },
                search_info: {
                    query: searchQuery,
                    subforum_id: null,
                    subforum_name: '전체 포럼',
                    sort_by: sortBy,
                    searched_subforums: subforums.length
                }
            };
        } catch (error) {
            console.error('전체 서브포럼 검색 실패:', error);
            throw error;
        }
    }

    /**
     * 검색어가 포함된 내용 미리보기 생성
     * @param {string} content - 원본 내용
     * @param {string} searchQuery - 검색어
     * @param {number} maxLength - 최대 길이
     * @returns {string} 미리보기 텍스트
     */
    generateSearchPreview(content, searchQuery, maxLength = 200) {
        if (!content) {
            return '';
        }

        // 마크다운 및 HTML 태그 제거
        const plainText = extractPlainText(content);

        // 검색어 위치 찾기
        const searchTerms = searchQuery.toLowerCase().split(/\s+/).filter(term => term.length > 0);
        let bestMatch = -1;
        let bestMatchTerm = '';

        for (const term of searchTerms) {
            const index = plainText.toLowerCase().indexOf(term);
            if (index !== -1 && (bestMatch === -1 || index < bestMatch)) {
                bestMatch = index;
                bestMatchTerm = term;
            }
        }

        if (bestMatch === -1) {
            // 검색어가 없으면 처음부터 자르기
            return plainText.length <= maxLength ? plainText : plainText.substring(0, maxLength) + '...';
        }

        // 검색어 주변 텍스트 추출
        const start = Math.max(0, bestMatch - Math.floor(maxLength / 3));
        const end = Math.min(plainText.length, start + maxLength);

        let preview = plainText.substring(start, end);

        if (start > 0) {
            preview = '...' + preview;
        }
        if (end < plainText.length) {
            preview = preview + '...';
        }

        return preview;
    }

    /**
     * 검색어 하이라이트 처리
     * @param {string} text - 원본 텍스트
     * @param {string} searchQuery - 검색어
     * @returns {string} 하이라이트된 텍스트
     */
    highlightSearchTerms(text, searchQuery) {
        if (!text || !searchQuery) {
            return text;
        }

        const searchTerms = searchQuery.toLowerCase().split(/\s+/).filter(term => term.length > 0);
        let highlightedText = text;

        for (const term of searchTerms) {
            const regex = new RegExp(`(${term})`, 'gi');
            highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
        }

        return highlightedText;
    }

    /**
     * 검색 제안어 생성 (자주 검색되는 키워드 기반)
     * @param {string} partialQuery - 부분 검색어
     * @param {number} limit - 제안 개수 제한
     * @returns {Promise<Array>} 검색 제안어 목록
     */
    async getSearchSuggestions(partialQuery, limit = 5) {
        if (!partialQuery || partialQuery.trim().length < 2) {
            return [];
        }

        try {
            const suggestions = [];
            const subforums = await this.getSubforums();

            // 각 서브포럼에서 제목 기반 제안어 검색
            for (const subforum of subforums) {
                try {
                    const forumDB = await this.dbManager.getForumDB(subforum.id);

                    const titleSuggestions = await this.dbManager.allQuery(
                        forumDB,
                        `SELECT DISTINCT title
                         FROM posts
                         WHERE title LIKE ? AND category_id = ?
                         ORDER BY created_at DESC
                         LIMIT ?`,
                        [`%${partialQuery}%`, subforum.id, Math.ceil(limit / subforums.length)]
                    );

                    suggestions.push(...titleSuggestions.map(row => row.title));
                } catch (error) {
                    console.warn(`서브포럼 ${subforum.id} 검색 제안어 조회 실패:`, error);
                }
            }

            // 중복 제거 및 길이 제한
            const uniqueSuggestions = [...new Set(suggestions)];
            return uniqueSuggestions.slice(0, limit);
        } catch (error) {
            console.error('검색 제안어 생성 실패:', error);
            return [];
        }
    }

    /**
     * 공개 통계 정보 조회 (메인 페이지용)
     * @returns {Promise<Object>} 통계 정보
     */
    async getPublicStatistics() {
        try {
            const configDB = this.dbManager.getConfigDB();

            // 일반 사용자 수 조회 (super_admin, moderator 제외)
            const userCountResult = await this.dbManager.getQuery(
                configDB,
                'SELECT COUNT(*) as count FROM users WHERE role = ?',
                ['user']
            );

            // 활성 서브포럼 수
            const subforumCountResult = await this.dbManager.getQuery(
                configDB,
                'SELECT COUNT(*) as count FROM categories WHERE is_active = 1'
            );

            // 전체 게시글 수 (모든 서브포럼)
            const subforums = await this.dbManager.allQuery(
                configDB,
                'SELECT id FROM categories WHERE is_active = 1'
            );

            let totalPosts = 0;
            for (const subforum of subforums) {
                try {
                    const stats = await this.getSubforumStats(subforum.id);
                    totalPosts += stats.post_count || 0;
                } catch (error) {
                    console.warn(`서브포럼 ${subforum.id} 통계 조회 실패:`, error.message);
                }
            }

            return {
                totalUsers: userCountResult ? userCountResult.count : 0,
                totalSubforums: subforumCountResult ? subforumCountResult.count : 0,
                totalPosts: totalPosts
            };
        } catch (error) {
            console.error('공개 통계 조회 실패:', error);
            return {
                totalUsers: 0,
                totalSubforums: 0,
                totalPosts: 0
            };
        }
    }
}

module.exports = ForumService;