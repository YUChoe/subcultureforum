const bcrypt = require('bcrypt');
const DatabaseManager = require('../services/DatabaseManager');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function changePassword() {
    try {
        const dbManager = DatabaseManager.getInstance();
        await dbManager.initialize();

        const configDB = dbManager.getConfigDB();

        // 사용자명 입력
        const username = await question('사용자명을 입력하세요: ');
        
        // 사용자 존재 확인
        const user = await dbManager.getQuery(
            configDB,
            'SELECT id, username, role FROM users WHERE username = ?',
            [username]
        );

        if (!user) {
            console.log('❌ 사용자를 찾을 수 없습니다.');
            rl.close();
            await dbManager.close();
            process.exit(1);
        }

        console.log(`\n✅ 사용자 발견: ${user.username} (역할: ${user.role})`);

        // 새 비밀번호 입력
        const newPassword = await question('\n새 비밀번호를 입력하세요: ');
        
        if (newPassword.length < 6) {
            console.log('❌ 비밀번호는 최소 6자 이상이어야 합니다.');
            rl.close();
            await dbManager.close();
            process.exit(1);
        }

        const confirmPassword = await question('비밀번호를 다시 입력하세요: ');

        if (newPassword !== confirmPassword) {
            console.log('❌ 비밀번호가 일치하지 않습니다.');
            rl.close();
            await dbManager.close();
            process.exit(1);
        }

        // 비밀번호 해싱
        const passwordHash = await bcrypt.hash(newPassword, 12);

        // 비밀번호 업데이트
        await dbManager.runQuery(
            configDB,
            'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [passwordHash, user.id]
        );

        console.log('\n✅ 비밀번호가 성공적으로 변경되었습니다.');
        console.log(`- 사용자명: ${user.username}`);
        console.log(`- 역할: ${user.role}`);

        rl.close();
        await dbManager.close();
        process.exit(0);

    } catch (error) {
        console.error('❌ 비밀번호 변경 실패:', error);
        rl.close();
        process.exit(1);
    }
}

changePassword();
