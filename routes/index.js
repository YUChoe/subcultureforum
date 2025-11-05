const express = require('express');
const ForumService = require('../services/ForumService');
const router = express.Router();

// ForumService 인스턴스 생성
const forumService = new ForumService();

// 메인 페이지 - 포럼 카테고리 목록
router.get('/', async (req, res) => {
    try {
        // 카테고리 목록 조회 (subforums를 categories로 변경)
        const categories = await forumService.getSubforums();

        // 인기 게시글 조회 (전체 카테고리에서 최근 7일간)
        const popularPosts = await forumService.getPopularPosts(null, 5, 7);

        // 최근 활동 게시글 조회
        const recentActivityPosts = await forumService.getRecentActivityPosts(null, 5);

        // 통계 정보 계산
        const totalCategories = categories.length;
        const totalPosts = categories.reduce((sum, cat) => sum + (cat.post_count || 0), 0);
        const totalUsers = 0; // TODO: 사용자 수 조회 구현

        res.render('pages/index', {
            title: '포럼 메인',
            categories: categories,
            popularPosts: popularPosts,
            recentActivityPosts: recentActivityPosts,
            totalCategories: totalCategories,
            totalPosts: totalPosts,
            totalUsers: totalUsers
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