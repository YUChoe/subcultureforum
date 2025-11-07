const DatabaseManager = require('./services/DatabaseManager');

async function deleteUser() {
    try {
        const dbManager = DatabaseManager.getInstance();
        await dbManager.initialize();

        const configDB = dbManager.getConfigDB();

        await dbManager.runQuery(
            configDB,
            'DELETE FROM users WHERE username = ?',
            ['superadmin']
        );

        console.log('사용자 삭제 완료: superadmin');

        await dbManager.close();
        process.exit(0);

    } catch (error) {
        console.error('사용자 삭제 실패:', error);
        process.exit(1);
    }
}

deleteUser();
