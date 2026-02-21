const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'cache.db');

console.log('Cache 데이터베이스 스키마 검증 시작...\n');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('데이터베이스 연결 실패:', err.message);
        process.exit(1);
    }
});

// 테이블 스키마 확인
db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='cache'", [], (err, row) => {
    if (err) {
        console.error('테이블 스키마 조회 실패:', err.message);
        db.close();
        process.exit(1);
    }
    
    if (!row) {
        console.error('cache 테이블이 존재하지 않습니다.');
        db.close();
        process.exit(1);
    }
    
    console.log('=== cache 테이블 스키마 ===');
    console.log(row.sql);
    console.log();
    
    // 인덱스 확인
    db.all("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='cache'", [], (err, indexes) => {
        if (err) {
            console.error('인덱스 조회 실패:', err.message);
        } else {
            console.log('=== 인덱스 목록 ===');
            indexes.forEach(index => {
                console.log(`${index.name}:`);
                if (index.sql) {
                    console.log(`  ${index.sql}`);
                } else {
                    console.log('  (자동 생성된 PRIMARY KEY 인덱스)');
                }
            });
            console.log();
        }
        
        // 트리거 확인
        db.all("SELECT name, sql FROM sqlite_master WHERE type='trigger' AND tbl_name='cache'", [], (err, triggers) => {
            if (err) {
                console.error('트리거 조회 실패:', err.message);
            } else {
                console.log('=== 트리거 목록 ===');
                triggers.forEach(trigger => {
                    console.log(`${trigger.name}:`);
                    console.log(trigger.sql);
                    console.log();
                });
            }
            
            // 테이블 정보 확인
            db.all("PRAGMA table_info(cache)", [], (err, columns) => {
                if (err) {
                    console.error('컬럼 정보 조회 실패:', err.message);
                } else {
                    console.log('=== 컬럼 정보 ===');
                    console.log('cid | name       | type         | notnull | dflt_value           | pk');
                    console.log('----+------------+--------------+---------+----------------------+----');
                    columns.forEach(col => {
                        console.log(
                            `${col.cid.toString().padEnd(3)} | ` +
                            `${col.name.padEnd(10)} | ` +
                            `${col.type.padEnd(12)} | ` +
                            `${col.notnull.toString().padEnd(7)} | ` +
                            `${(col.dflt_value || '').toString().padEnd(20)} | ` +
                            `${col.pk}`
                        );
                    });
                }
                
                console.log('\n✓ Cache 데이터베이스 스키마 검증 완료!');
                db.close();
            });
        });
    });
});
