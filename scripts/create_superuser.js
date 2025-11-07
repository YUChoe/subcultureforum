const bcrypt = require('bcrypt');
const DatabaseManager = require('../services/DatabaseManager');

async function createSuperUser() {
    try {
        const dbManager = DatabaseManager.getInstance();
        await dbManager.initialize();

        const configDB = dbManager.getConfigDB();

        // 비밀번호 해싱 (password: admin123)
        const passwordHash = await bcrypt.hash('admin123', 12);

        // 수퍼유저 생성
        const result = await dbManager.runQuery(
            configDB,
            `INSERT INTO users (username, email, password_hash, role, created_at, updated_at)
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            ['superadmin', 'superadmin@example.com', passwordHash, 'super_admin']
        );

        console.log('수퍼유저 생성 완료:');
        console.log('- 사용자명: superadmin');
        console.log('- 이메일: superadmin@example.com');
        console.log('- 비밀번호: admin123');
        console.log('- 역할: super_admin');
        console.log('- ID:', result.id);

        await dbManager.close();
        process.exit(0);

    } catch (error) {
        console.error('수퍼유저 생성 실패:', error);
        process.exit(1);
    }
}

createSuperUser();