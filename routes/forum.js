const express = require('express');
const { body, validationResult } = require('express-validator');
const ForumService = require('../services/ForumService');
const router = express.Router();

// ForumService 인스턴스 생성
const forumService = new ForumService();

// 기존 category 라우트를 subforum으로 리다이렉트 (하위 호환성)
router.get('/category/:id', (req, res) => {
    res.redirect(`/forum/subforum/${req.params.id}`);
});

// 서브포럼별 게시글 목록
router.get('/subforum/:id', async (req, res) => {
    try {
        const subforumId = parseInt(req.params.id);
        const sortBy = req.query.sort || 'created_at'; // 기본값: 최신글 순
        const page = parseInt(req.query.page) || 1;

        // 서브포럼 정보 조회
        const subforum = await forumService.getSubforumById(subforumId);
        if (!subforum) {
            return res.status(404).render('pages/error', {
                title: '서브포럼을 찾을 수 없습니다',
                error: {
                    status: 404,
                    message: '요청하신 서브포럼을 찾을 수 없습니다.'
                }
            });
        }

        // 게시글 목록 조회
        const postsData = await forumService.getPosts(subforumId, {
            sortBy: sortBy,
            page: page,
            limit: 20
        });

        res.render('pages/forum/subforum', {
            title: `${subforum.name} - 포럼`,
            subforum: subforum,
            posts: postsData.posts,
            pagination: postsData.pagination,
            sortInfo: postsData.sort_info,
            sortBy: sortBy,
            currentPage: page
        });
    } catch (error) {
        console.error('서브포럼 페이지 오류:', error);
        res.status(500).render('pages/error', {
            title: '서버 오류',
            error: {
                status: 500,
                message: '서브포럼을 로드하는 중 오류가 발생했습니다.'
            }
        });
    }
});

// 게시글 상세 보기
router.get('/post/:id', async (req, res) => {
    try {
        const postId = parseInt(req.params.id);

        // TODO: ForumService에서 게시글과 댓글 가져오기
        const post = { id: postId, title: '임시 게시글', content: '임시 내용' };
        const comments = []; // 임시 빈 배열

        res.render('pages/forum/post', {
            title: post.title,
            post: post,
            comments: comments
        });
    } catch (error) {
        console.error('게시글 페이지 오류:', error);
        res.status(500).render('pages/error', {
            title: '서버 오류',
            error: {
                status: 500,
                message: '게시글을 로드하는 중 오류가 발생했습니다.'
            }
        });
    }
});

// 게시글 작성 페이지 (로그인 필요)
router.get('/post/new/:subforumId', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }

    const subforumId = parseInt(req.params.subforumId);

    res.render('pages/forum/new-post', {
        title: '새 게시글 작성',
        subforumId: subforumId,
        error: null
    });
});

// 게시글 작성 처리
router.post('/post/new/:subforumId', [
    body('title')
        .isLength({ min: 1, max: 200 })
        .withMessage('제목은 1-200자 사이여야 합니다'),
    body('content')
        .isLength({ min: 1 })
        .withMessage('내용을 입력해주세요')
], async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }

    try {
        const errors = validationResult(req);
        const subforumId = parseInt(req.params.subforumId);

        if (!errors.isEmpty()) {
            return res.render('pages/forum/new-post', {
                title: '새 게시글 작성',
                subforumId: subforumId,
                error: errors.array()[0].msg
            });
        }

        const { title, content } = req.body;
        const userId = req.session.user.id;

        // TODO: ForumService에서 게시글 생성
        // const postId = await forumService.createPost(userId, subforumId, title, content);

        // 임시로 서브포럼 페이지로 리다이렉트
        res.redirect(`/forum/subforum/${subforumId}`);
    } catch (error) {
        console.error('게시글 작성 오류:', error);
        const subforumId = parseInt(req.params.subforumId);
        res.render('pages/forum/new-post', {
            title: '새 게시글 작성',
            subforumId: subforumId,
            error: '게시글 작성 중 오류가 발생했습니다.'
        });
    }
});

// 댓글 작성 처리
router.post('/comment/:postId', [
    body('content')
        .isLength({ min: 1 })
        .withMessage('댓글 내용을 입력해주세요')
], async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const postId = parseInt(req.params.postId);
        const { content } = req.body;
        const userId = req.session.user.id;

        // TODO: ForumService에서 댓글 생성
        // const comment = await forumService.createComment(userId, postId, content);

        res.json({ success: true, message: '댓글이 작성되었습니다.' });
    } catch (error) {
        console.error('댓글 작성 오류:', error);
        res.status(500).json({ error: '댓글 작성 중 오류가 발생했습니다.' });
    }
});

module.exports = router;