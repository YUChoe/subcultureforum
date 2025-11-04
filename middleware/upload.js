const multer = require('multer');
const path = require('path');

// 메모리 스토리지 설정 (파일을 메모리에 저장)
const storage = multer.memoryStorage();

// 파일 필터 설정 (이미지 파일만 허용)
const fileFilter = (req, file, cb) => {
    // 허용되는 MIME 타입
    const allowedMimeTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('이미지 파일만 업로드 가능합니다. (JPEG, PNG, GIF, WebP)'), false);
    }
};

// multer 설정
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB 제한
        files: 5 // 최대 5개 파일
    }
});

// 단일 파일 업로드 미들웨어
const uploadSingle = upload.single('attachment');

// 다중 파일 업로드 미들웨어
const uploadMultiple = upload.array('attachments', 5);

// 에러 처리 미들웨어
const handleUploadError = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: '파일 크기가 너무 큽니다. 최대 5MB까지 업로드 가능합니다.'
            });
        } else if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                error: '파일 개수가 너무 많습니다. 최대 5개까지 업로드 가능합니다.'
            });
        } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                error: '예상하지 못한 파일 필드입니다.'
            });
        }
    } else if (error.message.includes('이미지 파일만')) {
        return res.status(400).json({
            error: error.message
        });
    }

    next(error);
};

module.exports = {
    uploadSingle,
    uploadMultiple,
    handleUploadError
};