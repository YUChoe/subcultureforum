const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function getSchema(dbPath) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

        db.all("PRAGMA table_info(posts)", [], (err, columns) => {
            if (err) {
                db.close();
                reject(err);
                return;
            }

            db.all("SELECT * FROM posts LIMIT 1", [], (err, sample) => {
                db.close();
                if (err) {
                    reject(err);
                    return;
                }
                resolve({ columns, sample: sample[0] || {} });
            });
        });
    });
}

async function main() {
    const databases = [
        path.join(__dirname, '../database/database_board_free.sqlite'),
        path.join(__dirname, '../database/database_board_news.sqlite')
    ];

    for (const dbPath of databases) {
        console.log(`\n=== ${path.basename(dbPath)} ===`);
        try {
            const { columns, sample } = await getSchema(dbPath);
            
            console.log('\n컬럼 정보:');
            columns.forEach(col => {
                console.log(`  ${col.name} (${col.type})`);
            });
            
            console.log('\n샘플 데이터:');
            console.log(JSON.stringify(sample, null, 2));
        } catch (error) {
            console.error('오류:', error.message);
        }
    }
}

main().catch(console.error);
