const DatabaseManager = require('./services/DatabaseManager');

async function checkSchema() {
    const dbManager = DatabaseManager.getInstance();

    try {
        await dbManager.initialize();
        console.log('데이터베이스 초기화 완료');

        // 포럼 1 데이터베이스의 스키마 확인
        const forumDB = await dbManager.getForumDB(1);

        // 테이블 목록 조회
        const tables = await dbManager.allQuery(
            forumDB,
            "SELECT name FROM sqlite_master WHERE type='table'"
        );

        console.log('\n포럼 1 데이터베이스의 테이블 목록:');
        tables.forEach(table => {
            console.log(`- ${table.name}`);
        });

        // attachments 테이블 스키마 확인
        try {
            const attachmentsSchema = await dbManager.allQuery(
                forumDB,
                "SELECT sql FROM sqlite_master WHERE type='table' AND name='attachments'"
            );

            if (attachmentsSchema.length > 0) {
                console.log('\nattachments 테이블 스키마:');
                console.log(attachmentsSchema[0].sql);
            } else {
                console.log('\nattachments 테이블이 존재하지 않습니다.');
            }
        } catch (error) {
            console.error('attachments 테이블 스키마 조회 실패:', error);
        }

        // posts 테이블에서 최근 게시글 확인
        const recentPosts = await dbManager.allQuery(
            forumDB,
            "SELECT id, title FROM posts ORDER BY id DESC LIMIT 3"
        );

        console.log('\n최근 게시글:');
        recentPosts.forEach(post => {
            console.log(`- ID ${post.id}: ${post.title}`);
        });

    } catch (error) {
        console.error('스키마 확인 실패:', error);
    }
}

checkSchema().then(() => {
    console.log('\n스키마 확인 완료');
    process.exit(0);
});