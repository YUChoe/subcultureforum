const express = require('express');
const router = express.Router();

// 메인 페이지 - 포럼 카테고리 목록
router.get('/', async (req, res) => {
    try {
        // TODO: ForumService에서 카테고리 목록 가져오기
        const categories = []; // 임시 빈 배열

        res.render('pages/index', {
            title: '포럼 메인',
            categories: categories
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
        const categoryId = req.query.category || null;

        // TODO: ForumService에서 검색 결과 가져오기
        const searchResults = []; // 임시 빈 배열

        res.render('pages/search', {
            title: '검색 결과',
            query: query,
            categoryId: categoryId,
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