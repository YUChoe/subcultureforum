const DatabaseManager = require('../services/DatabaseManager');

async function addAttachmentsTable() {
    const dbManager = DatabaseManager.getInstance();

    try {
        await dbManager.initialize();
        console.log('데이터베이스 초기화 완료');

        // 모든 포럼 데이터베이스에 첨부파일 테이블 추가
        const configDB = dbManager.getConfigDB();

        // 활성 카테고리 목록 조회
        const categories = await dbManager.allQuery(
            configDB,
            'SELECT id FROM categories WHERE is_active = 1'
        );

        console.log(`${categories.length}개의 활성 카테고리 발견`);

        for (const category of categories) {
            try {
                const forumDB = await dbManager.getForumDB(category.id);

                // 첨부파일 테이블 생성
                await dbManager.runQuery(forumDB, `
                    CREATE TABLE IF NOT EXISTS attachments (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        post_id INTEGER NOT NULL,
                        filename VARCHAR(255) NOT NULL,
                        original_filename VARCHAR(255) NOT NULL,
                        mime_type VARCHAR(100) NOT NULL,
                        file_size INTEGER NOT NULL,
                        file_data BLOB NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
                    )
                `);

                // 인덱스 생성
                await dbManager.runQuery(forumDB, `
                    CREATE INDEX IF NOT EXISTS idx_attachments_post_id ON attachments(post_id)
                `);

                await dbManager.runQuery(forumDB, `
                    CREATE INDEX IF NOT EXISTS idx_attachments_filename ON attachments(filename)
                `);

                console.log(`카테고리 ${category.id}: 첨부파일 테이블 추가 완료`);
            } catch (error) {
                console.error(`카테고리 ${category.id} 마이그레이션 실패:`, error);
            }
        }

        console.log('모든 포럼 데이터베이스에 첨부파일 테이블 추가 완료');
    } catch (error) {
        console.error('마이그레이션 실패:', error);
        process.exit(1);
    }
}

// 스크립트 실행
if (require.main === module) {
    addAttachmentsTable().then(() => {
        console.log('마이그레이션 완료');
        process.exit(0);
    });
}

module.exports = addAttachmentsTable;