const DatabaseManagerSingleton = require('./DatabaseManager');

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
                content_preview: this.generateContentPreview(post.content, 150),
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
                        u.username,
                        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count
                     FROM posts p
                     LEFT JOIN users u ON p.user_id = u.id
                     WHERE p.category_id = ? AND p.created_at >= ?
                     ORDER BY p.view_count DESC, p.created_at DESC
                     LIMIT ?`,
                    [subforumId, cutoffDateStr, limit]
                );

                return posts;
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
                                u.username,
                                (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count
                             FROM posts p
                             LEFT JOIN users u ON p.user_id = u.id
                             WHERE p.category_id = ? AND p.created_at >= ?
                             ORDER BY p.view_count DESC
                             LIMIT ?`,
                            [subforum.id, cutoffDateStr, limit]
                        );

                        // 서브포럼 정보 추가
                        const postsWithSubforum = posts.map(post => ({
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
                        u.username,
                        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count,
                        (SELECT u2.username FROM comments c2
                         JOIN users u2 ON c2.user_id = u2.id
                         WHERE c2.post_id = p.id
                         ORDER BY c2.created_at DESC LIMIT 1) as last_commenter
                     FROM posts p
                     LEFT JOIN users u ON p.user_id = u.id
                     WHERE p.category_id = ? AND p.last_comment_at IS NOT NULL
                     ORDER BY p.last_comment_at DESC
                     LIMIT ?`,
                    [subforumId, limit]
                );

                return posts;
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
                                u.username,
                                (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count,
                                (SELECT u2.username FROM comments c2
                                 JOIN users u2 ON c2.user_id = u2.id
                                 WHERE c2.post_id = p.id
                                 ORDER BY c2.created_at DESC LIMIT 1) as last_commenter
                             FROM posts p
                             LEFT JOIN users u ON p.user_id = u.id
                             WHERE p.category_id = ? AND p.last_comment_at IS NOT NULL
                             ORDER BY p.last_comment_at DESC
                             LIMIT ?`,
                            [subforum.id, Math.ceil(limit / subforums.length)]
                        );

                        // 서브포럼 정보 추가
                        const postsWithSubforum = posts.map(post => ({
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

            return {
                ...post,
                username: user?.username || '알 수 없음',
                role: user?.role || 'user',
                comment_count: commentCountResult?.count || 0
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
}

module.exports = ForumService;