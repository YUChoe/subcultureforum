const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'config.db');
const db = new sqlite3.Database(dbPath);

console.log('Config 데이터베이스 테이블 목록:');

db.all(`
    SELECT name, sql
    FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
`, (err, tables) => {
    if (err) {
        console.error('오류:', err);
    } else {
        tables.forEach(table => {
            console.log(`\n테이블: ${table.name}`);
            console.log(`SQL: ${table.sql}`);
        });
    }
    db.close();
});