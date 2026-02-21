const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'cache.db');
const schemaPath = path.join(__dirname, 'schema', 'cache_schema.sql');

console.log('Cache 데이터베이스 초기화 시작...');

// 데이터베이스 연결
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('데이터베이스 연결 실패:', err.message);
        process.exit(1);
    }
    console.log('cache.db 연결 성공');
});

// 스키마 파일 읽기
const schema = fs.readFileSync(schemaPath, 'utf8');

// 스키마 실행
db.exec(schema, (err) => {
    if (err) {
        console.error('스키마 적용 실패:', err.message);
        db.close();
        process.exit(1);
    }
    
    console.log('cache 테이블 생성 완료');
    console.log('인덱스 생성 완료');
    console.log('트리거 생성 완료');
    
    // 테이블 확인
    db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
        if (err) {
            console.error('테이블 조회 실패:', err.message);
        } else {
            console.log('\n생성된 테이블:');
            tables.forEach(table => {
                console.log(`  - ${table.name}`);
            });
        }
        
        // 인덱스 확인
        db.all("SELECT name FROM sqlite_master WHERE type='index'", [], (err, indexes) => {
            if (err) {
                console.error('인덱스 조회 실패:', err.message);
            } else {
                console.log('\n생성된 인덱스:');
                indexes.forEach(index => {
                    console.log(`  - ${index.name}`);
                });
            }
            
            // 트리거 확인
            db.all("SELECT name FROM sqlite_master WHERE type='trigger'", [], (err, triggers) => {
                if (err) {
                    console.error('트리거 조회 실패:', err.message);
                } else {
                    console.log('\n생성된 트리거:');
                    triggers.forEach(trigger => {
                        console.log(`  - ${trigger.name}`);
                    });
                }
                
                console.log('\nCache 데이터베이스 초기화 완료!');
                db.close();
            });
        });
    });
});
