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

// 폼 업로드용 파일 필터: 허용되지 않는 파일은 건너뛰고 오류를 기록한다.
// (multer 가 요청을 중단하지 않으므로 제목/본문 등 다른 필드가 보존되어 폼에 다시 채워진다)
const formFileFilter = (req, file, cb) => {
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'].includes(file.mimetype)) {
        req.uploadError = req.uploadError || `'${file.originalname}': 이미지 파일만 업로드 가능합니다. (JPEG, PNG, GIF, WebP)`;
        return cb(null, false);
    }
    cb(null, true);
};

// 클라이언트가 보낸 MIME 타입은 신뢰할 수 없으므로 파일 내용(매직 바이트)으로 실제 형식을 확인한다.
function detectImageType(buffer) {
    if (!buffer || buffer.length < 12) {
        return null;
    }
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        return 'image/jpeg';
    }
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
        return 'image/png';
    }
    const head6 = buffer.subarray(0, 6).toString('latin1');
    if (head6 === 'GIF87a' || head6 === 'GIF89a') {
        return 'image/gif';
    }
    if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') {
        return 'image/webp';
    }
    return null;
}

// multer 설정
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB 제한
        files: 5 // 최대 5개 파일
    }
});

const formUpload = multer({
    storage: storage,
    fileFilter: formFileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 5
    }
}).array('attachments', 5);

// HTML 폼(새 글/글 수정)용 업로드 미들웨어.
// 업로드 오류는 JSON 400 으로 응답하지 않고 req.uploadError 에 담아 라우트가 폼 오류로 다시 보여주게 한다.
const uploadFormFiles = (req, res, next) => {
    formUpload(req, res, (error) => {
        if (error) {
            if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
                req.uploadError = '파일 크기가 너무 큽니다. 최대 5MB까지 업로드 가능합니다.';
            } else if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_COUNT') {
                req.uploadError = '파일 개수가 너무 많습니다. 최대 5개까지 업로드 가능합니다.';
            } else if (error instanceof multer.MulterError) {
                req.uploadError = '파일 업로드 중 오류가 발생했습니다.';
            } else {
                return next(error);
            }
            req.files = [];
            req.body = req.body || {};
            return next();
        }

        const files = req.files || [];
        for (const file of files) {
            const detected = detectImageType(file.buffer);
            if (!detected) {
                req.uploadError = `'${file.originalname}': 올바른 이미지 파일이 아닙니다. (JPEG, PNG, GIF, WebP)`;
                req.files = [];
                break;
            }
            // 저장/응답에 사용하는 MIME 타입은 감지한 실제 형식으로 맞춘다
            file.mimetype = detected;
        }
        next();
    });
};

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
    uploadFormFiles,
    detectImageType,
    handleUploadError
};