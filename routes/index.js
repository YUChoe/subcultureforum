const express = require('express');
const ForumService = require('../services/ForumService');
const DatabaseManager = require('../services/DatabaseManager');
const router = express.Router();

// ForumService 인스턴스 생성
const forumService = new ForumService();
const dbManager = DatabaseManager.getInstance();

// 메인 페이지 - 포럼 카테고리 목록
router.get('/', async (req, res) => {
    try {
        // 카테고리 목록 조회
        const categories = await forumService.getSubforums();

        // 각 카테고리별 최근 게시글 5개 조회
        const categoriesWithPosts = await Promise.all(
            categories.map(async (category) => {
                try {
                    const forumDB = await dbManager.getForumDB(category.id);
                    const configDB = dbManager.getConfigDB();

                    // 최근 게시글 5개 조회 (댓글 여부 무관)
                    const posts = await dbManager.allQuery(
                        forumDB,
                        `SELECT
                            p.id,
                            p.title,
                            p.created_at,
                            p.user_id,
                            p.category_id
                         FROM posts p
                         WHERE p.category_id = ?
                         ORDER BY p.created_at DESC
                         LIMIT 5`,
                        [category.id]
                    );

                    // 사용자 정보 추가
                    const postsWithUserInfo = await Promise.all(
                        posts.map(async (post) => {
                            if (post.user_id) {
                                const user = await dbManager.getQuery(
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

                    return {
                        ...category,
                        recent_posts: postsWithUserInfo
                    };
                } catch (error) {
                    console.error(`카테고리 ${category.id} 최근 게시글 조회 실패:`, error);
                    return {
                        ...category,
                        recent_posts: []
                    };
                }
            })
        );

        // 인기 게시글 조회 (전체 카테고리에서 최근 7일간)
        const popularPosts = await forumService.getPopularPosts(null, 5, 7);

        // 최근 활동 게시글 조회
        const recentActivityPosts = await forumService.getRecentActivityPosts(null, 5);

        // 공개 통계 정보 조회
        const statistics = await forumService.getPublicStatistics();

        res.render('pages/index', {
            title: '포럼 메인',
            categories: categoriesWithPosts,
            popularPosts: popularPosts,
            recentActivityPosts: recentActivityPosts,
            totalCategories: statistics.totalSubforums,
            totalPosts: statistics.totalPosts,
            totalUsers: statistics.totalUsers
        });
    } catch (error) {
        console.error('메인 페이지 로드 오류:', error);
        res.status(500).render('pages/error', {
            title: '서버 오류',
            error: {
                status: 500,
                message: '페이지를 로드하는 중 오류가 발생했습니다.'
            }
        });
    }
});

// 카테고리 페이지 (포럼 라우터로 리다이렉트)
router.get('/category/:id', (req, res) => {
    res.redirect(`/forum/subforum/${req.params.id}`);
});

// 검색 페이지
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q || '';
        const subforumId = req.query.subforum || null;

        // TODO: ForumService에서 검색 결과 가져오기
        const searchResults = []; // 임시 빈 배열

        res.render('pages/search', {
            title: '검색 결과',
            query: query,
            subforumId: subforumId,
            results: searchResults
        });
    } catch (error) {
        console.error('검색 페이지 오류:', error);
        res.status(500).render('pages/error', {
            title: '검색 오류',
            error: {
                status: 500,
                message: '검색 중 오류가 발생했습니다.'
            }
        });
    }
});

module.exports = router;