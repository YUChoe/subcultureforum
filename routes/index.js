const express = require('express');
const ForumService = require('../services/ForumService');
const router = express.Router();

// ForumService 인스턴스 생성
const forumService = new ForumService();

// 메인 페이지 - 포럼 서브포럼 목록
router.get('/', async (req, res) => {
    try {
        // 서브포럼 목록 조회
        const subforums = await forumService.getSubforums();

        // 인기 게시글 조회 (전체 서브포럼에서 최근 7일간)
        const popularPosts = await forumService.getPopularPosts(null, 5, 7);

        // 최근 활동 게시글 조회
        const recentActivityPosts = await forumService.getRecentActivityPosts(null, 5);

        res.render('pages/index', {
            title: '포럼 메인',
            subforums: subforums,
            popularPosts: popularPosts,
            recentActivityPosts: recentActivityPosts
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