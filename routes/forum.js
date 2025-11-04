const express = require('express');
const { body, validationResult } = require('express-validator');
const ForumService = require('../services/ForumService');
const { uploadMultiple, handleUploadError } = require('../middleware/upload');
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

// 게시글 작성 페이지 (로그인 필요) - 구체적인 라우트를 먼저 등록
router.get('/subforum/:subforumId/post/new', async (req, res) => {
    if (!req.user) {
        return res.redirect('/auth/login');
    }

    try {
        const subforumId = parseInt(req.params.subforumId);

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

        res.render('pages/forum/new-post', {
            title: `새 게시글 작성 - ${subforum.name}`,
            subforum: subforum,
            error: null,
            formData: {}
        });
    } catch (error) {
        console.error('게시글 작성 페이지 오류:', error);
        res.status(500).render('pages/error', {
            title: '서버 오류',
            error: {
                status: 500,
                message: '페이지를 로드하는 중 오류가 발생했습니다.'
            }
        });
    }
});

// 게시글 작성 처리
router.post('/subforum/:subforumId/post/new',
    uploadMultiple,
    [
        body('title')
            .isLength({ min: 1, max: 200 })
            .withMessage('제목은 1-200자 사이여야 합니다'),
        body('content')
            .isLength({ min: 1 })
            .withMessage('내용을 입력해주세요')
    ],
    async (req, res) => {
    if (!req.user) {
        return res.redirect('/auth/login');
    }

    try {
        const errors = validationResult(req);
        const subforumId = parseInt(req.params.subforumId);
        const { title, content } = req.body;

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

        if (!errors.isEmpty()) {
            return res.render('pages/forum/new-post', {
                title: `새 게시글 작성 - ${subforum.name}`,
                subforum: subforum,
                error: errors.array()[0].msg,
                formData: { title, content }
            });
        }

        const userId = req.user.id;

        // 게시글 생성
        const postId = await forumService.createPost(userId, subforumId, title, content);

        // 첨부파일 처리
        if (req.files && req.files.length > 0) {
            console.log(`${req.files.length}개의 첨부파일 처리 중...`);

            for (const file of req.files) {
                try {
                    await forumService.saveAttachment(postId, subforumId, file);
                    console.log(`첨부파일 저장 완료: ${file.originalname}`);
                } catch (attachError) {
                    console.error('첨부파일 저장 실패:', attachError);
                    // 첨부파일 저장 실패는 게시글 생성을 막지 않음
                }
            }
        }

        // 생성된 게시글로 리다이렉트
        res.redirect(`/forum/subforum/${subforumId}/post/${postId}`);
    } catch (error) {
        console.error('게시글 작성 오류:', error);
        const subforumId = parseInt(req.params.subforumId);
        const { title, content } = req.body;

        try {
            const subforum = await forumService.getSubforumById(subforumId);
            res.render('pages/forum/new-post', {
                title: `새 게시글 작성 - ${subforum?.name || ''}`,
                subforum: subforum,
                error: '게시글 작성 중 오류가 발생했습니다.',
                formData: { title, content }
            });
        } catch (renderError) {
            res.status(500).render('pages/error', {
                title: '서버 오류',
                error: {
                    status: 500,
                    message: '게시글 작성 중 오류가 발생했습니다.'
                }
            });
        }
    }
});

// 게시글 상세 보기
router.get('/subforum/:subforumId/post/:postId', async (req, res) => {
    try {
        const postId = parseInt(req.params.postId);
        const subforumId = parseInt(req.params.subforumId);

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

        // 게시글 조회
        const post = await forumService.getPost(postId, subforumId);
        if (!post) {
            return res.status(404).render('pages/error', {
                title: '게시글을 찾을 수 없습니다',
                error: {
                    status: 404,
                    message: '요청하신 게시글을 찾을 수 없습니다.'
                }
            });
        }

        // TODO: 댓글 목록 조회 (댓글 시스템 구현 후)
        const comments = [];

        res.render('pages/forum/post', {
            title: post.title,
            subforum: subforum,
            post: post,
            comments: comments,
            user: req.user || null
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

// 게시글 수정 페이지 (작성자만)
router.get('/subforum/:subforumId/post/:postId/edit', async (req, res) => {
    if (!req.user) {
        return res.redirect('/auth/login');
    }

    try {
        const postId = parseInt(req.params.postId);
        const subforumId = parseInt(req.params.subforumId);

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

        // 게시글 조회 (조회수 증가 안함)
        const post = await forumService.getPost(postId, subforumId, false);
        if (!post) {
            return res.status(404).render('pages/error', {
                title: '게시글을 찾을 수 없습니다',
                error: {
                    status: 404,
                    message: '요청하신 게시글을 찾을 수 없습니다.'
                }
            });
        }

        // 작성자 권한 확인
        if (post.user_id !== req.user.id) {
            return res.status(403).render('pages/error', {
                title: '권한이 없습니다',
                error: {
                    status: 403,
                    message: '게시글 수정 권한이 없습니다.'
                }
            });
        }

        res.render('pages/forum/edit-post', {
            title: `게시글 수정 - ${post.title}`,
            subforum: subforum,
            post: post,
            error: null
        });
    } catch (error) {
        console.error('게시글 수정 페이지 오류:', error);
        res.status(500).render('pages/error', {
            title: '서버 오류',
            error: {
                status: 500,
                message: '페이지를 로드하는 중 오류가 발생했습니다.'
            }
        });
    }
});

// 게시글 수정 처리
router.post('/subforum/:subforumId/post/:postId/edit',
    uploadMultiple,
    [
        body('title')
            .isLength({ min: 1, max: 200 })
            .withMessage('제목은 1-200자 사이여야 합니다'),
        body('content')
            .isLength({ min: 1 })
            .withMessage('내용을 입력해주세요')
    ],
    async (req, res) => {
    if (!req.user) {
        return res.redirect('/auth/login');
    }

    try {
        const errors = validationResult(req);
        const postId = parseInt(req.params.postId);
        const subforumId = parseInt(req.params.subforumId);
        const { title, content } = req.body;

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

        // 게시글 조회 (조회수 증가 안함)
        const post = await forumService.getPost(postId, subforumId, false);
        if (!post) {
            return res.status(404).render('pages/error', {
                title: '게시글을 찾을 수 없습니다',
                error: {
                    status: 404,
                    message: '요청하신 게시글을 찾을 수 없습니다.'
                }
            });
        }

        if (!errors.isEmpty()) {
            return res.render('pages/forum/edit-post', {
                title: `게시글 수정 - ${post.title}`,
                subforum: subforum,
                post: { ...post, title, content },
                error: errors.array()[0].msg
            });
        }

        const userId = req.user.id;

        // 게시글 수정
        await forumService.updatePost(postId, subforumId, userId, title, content);

        // 새로운 첨부파일 처리
        if (req.files && req.files.length > 0) {
            console.log(`${req.files.length}개의 새 첨부파일 처리 중...`);

            for (const file of req.files) {
                try {
                    await forumService.saveAttachment(postId, subforumId, file);
                    console.log(`첨부파일 저장 완료: ${file.originalname}`);
                } catch (attachError) {
                    console.error('첨부파일 저장 실패:', attachError);
                    // 첨부파일 저장 실패는 게시글 수정을 막지 않음
                }
            }
        }

        // 수정된 게시글로 리다이렉트
        res.redirect(`/forum/subforum/${subforumId}/post/${postId}`);
    } catch (error) {
        console.error('게시글 수정 오류:', error);

        try {
            const postId = parseInt(req.params.postId);
            const subforumId = parseInt(req.params.subforumId);
            const { title, content } = req.body;

            const subforum = await forumService.getSubforumById(subforumId);
            const post = await forumService.getPost(postId, subforumId, false);

            res.render('pages/forum/edit-post', {
                title: `게시글 수정 - ${post?.title || ''}`,
                subforum: subforum,
                post: { ...post, title, content },
                error: error.message || '게시글 수정 중 오류가 발생했습니다.'
            });
        } catch (renderError) {
            res.status(500).render('pages/error', {
                title: '서버 오류',
                error: {
                    status: 500,
                    message: '게시글 수정 중 오류가 발생했습니다.'
                }
            });
        }
    }
});

// 게시글 삭제 처리
router.post('/subforum/:subforumId/post/:postId/delete', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    try {
        const postId = parseInt(req.params.postId);
        const subforumId = parseInt(req.params.subforumId);
        const userId = req.user.id;

        // 모더레이터 권한 확인 (AuthService에서 확인)
        const isModerator = req.user.role === 'moderator' || req.user.role === 'super_admin';

        // 게시글 삭제
        await forumService.deletePost(postId, subforumId, userId, isModerator);

        res.json({ success: true, message: '게시글이 삭제되었습니다.' });
    } catch (error) {
        console.error('게시글 삭제 오류:', error);
        res.status(500).json({ error: error.message || '게시글 삭제 중 오류가 발생했습니다.' });
    }
});

// 댓글 작성 처리 (댓글 시스템 구현 후 활성화)
router.post('/subforum/:subforumId/post/:postId/comment', [
    body('content')
        .isLength({ min: 1 })
        .withMessage('댓글 내용을 입력해주세요')
], async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const postId = parseInt(req.params.postId);
        const subforumId = parseInt(req.params.subforumId);
        const { content } = req.body;
        const userId = req.user.id;

        // TODO: ForumService에서 댓글 생성 (댓글 시스템 구현 후)
        // const comment = await forumService.createComment(userId, postId, subforumId, content);
        // await forumService.updatePostLastCommentTime(postId, subforumId);

        res.json({ success: true, message: '댓글이 작성되었습니다.' });
    } catch (error) {
        console.error('댓글 작성 오류:', error);
        res.status(500).json({ error: '댓글 작성 중 오류가 발생했습니다.' });
    }
});

// 첨부파일 다운로드
router.get('/subforum/:subforumId/attachment/:attachmentId', async (req, res) => {
    try {
        const attachmentId = parseInt(req.params.attachmentId);
        const subforumId = parseInt(req.params.subforumId);

        const attachment = await forumService.getAttachmentData(attachmentId, subforumId);

        if (!attachment) {
            return res.status(404).json({ error: '첨부파일을 찾을 수 없습니다.' });
        }

        // 파일 헤더 설정
        res.set({
            'Content-Type': attachment.mime_type,
            'Content-Length': attachment.file_size,
            'Content-Disposition': `inline; filename="${encodeURIComponent(attachment.original_filename)}"`
        });

        // 파일 데이터 전송
        res.send(attachment.file_data);
    } catch (error) {
        console.error('첨부파일 다운로드 오류:', error);
        res.status(500).json({ error: '첨부파일 다운로드 중 오류가 발생했습니다.' });
    }
});

// 첨부파일 삭제
router.delete('/subforum/:subforumId/attachment/:attachmentId', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    try {
        const attachmentId = parseInt(req.params.attachmentId);
        const subforumId = parseInt(req.params.subforumId);

        // 첨부파일 정보 조회 (권한 확인용)
        const attachment = await forumService.getAttachmentData(attachmentId, subforumId);
        if (!attachment) {
            return res.status(404).json({ error: '첨부파일을 찾을 수 없습니다.' });
        }

        // 게시글 작성자 확인
        const forumDB = await forumService.dbManager.getForumDB(subforumId);
        const post = await forumService.dbManager.getQuery(
            forumDB,
            'SELECT user_id FROM posts WHERE id = (SELECT post_id FROM attachments WHERE id = ?)',
            [attachmentId]
        );

        if (!post || (post.user_id !== req.user.id && req.user.role !== 'moderator' && req.user.role !== 'super_admin')) {
            return res.status(403).json({ error: '첨부파일 삭제 권한이 없습니다.' });
        }

        // 첨부파일 삭제
        const success = await forumService.deleteAttachment(attachmentId, subforumId);

        if (success) {
            res.json({ success: true, message: '첨부파일이 삭제되었습니다.' });
        } else {
            res.status(500).json({ error: '첨부파일 삭제에 실패했습니다.' });
        }
    } catch (error) {
        console.error('첨부파일 삭제 오류:', error);
        res.status(500).json({ error: '첨부파일 삭제 중 오류가 발생했습니다.' });
    }
});

// 파일 업로드 에러 처리 미들웨어
router.use(handleUploadError);

module.exports = router;