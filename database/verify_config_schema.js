const sqlite3 = require('sqlite3').verbose();
const path = require('path');

/**
 * Config 데이터베이스 스키마 검증 스크립트
 */
class ConfigSchemaVerifier {
    constructor() {
        this.dbPath = path.join(__dirname, 'config.db');
    }

    /**
     * 스키마 검증 실행
     */
    async verify() {
        const db = new sqlite3.Database(this.dbPath);

        try {
            console.log('=== Config 데이터베이스 스키마 검증 ===\n');

            // 테이블 목록 확인
            await this.checkTables(db);

            // 각 테이블 구조 확인
            await this.checkTableStructures(db);

            // 기본 데이터 확인
            await this.checkDefaultData(db);

            console.log('\n✅ 모든 검증이 완료되었습니다!');

        } catch (error) {
            console.error('검증 중 오류 발생:', error);
        } finally {
            db.close();
        }
    }

    /**
     * 테이블 목록 확인
     */
    checkTables(db) {
        return new Promise((resolve, reject) => {
            const query = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name";

            db.all(query, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                console.log('📋 생성된 테이블 목록:');
                rows.forEach(row => {
                    console.log(`  - ${row.name}`);
                });
                console.log();

                resolve();
            });
        });
    }

    /**
     * 테이블 구조 확인
     */
    async checkTableStructures(db) {
        const tables = ['users', 'categories', 'moderator_permissions', 'site_settings', 'user_bans', 'user_activity_logs'];

        for (const table of tables) {
            await this.checkTableStructure(db, table);
        }
    }

    /**
     * 개별 테이블 구조 확인
     */
    checkTableStructure(db, tableName) {
        return new Promise((resolve, reject) => {
            const query = `PRAGMA table_info(${tableName})`;

            db.all(query, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                console.log(`🔍 ${tableName} 테이블 구조:`);
                rows.forEach(row => {
                    const nullable = row.notnull ? 'NOT NULL' : 'NULL';
                    const defaultVal = row.dflt_value ? ` DEFAULT ${row.dflt_value}` : '';
                    const pk = row.pk ? ' (PK)' : '';
                    console.log(`  - ${row.name}: ${row.type} ${nullable}${defaultVal}${pk}`);
                });
                console.log();

                resolve();
            });
        });
    }

    /**
     * 기본 데이터 확인
     */
    async checkDefaultData(db) {
        console.log('📊 기본 데이터 확인:');

        // 사이트 설정 확인
        await this.checkSiteSettings(db);

        // 기본 카테고리 확인
        await this.checkCategories(db);
    }

    /**
     * 사이트 설정 데이터 확인
     */
    checkSiteSettings(db) {
        return new Promise((resolve, reject) => {
            const query = "SELECT key, value FROM site_settings ORDER BY key";

            db.all(query, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                console.log('  사이트 설정:');
                rows.forEach(row => {
                    console.log(`    ${row.key}: ${row.value}`);
                });
                console.log();

                resolve();
            });
        });
    }

    /**
     * 카테고리 데이터 확인
     */
    checkCategories(db) {
        return new Promise((resolve, reject) => {
            const query = "SELECT name, description, display_order FROM categories ORDER BY display_order";

            db.all(query, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                console.log('  기본 카테고리:');
                rows.forEach(row => {
                    console.log(`    ${row.display_order}. ${row.name}: ${row.description}`);
                });
                console.log();

                resolve();
            });
        });
    }
}

// 직접 실행 시 검증 수행
if (require.main === module) {
    const verifier = new ConfigSchemaVerifier();
    verifier.verify();
}

module.exports = ConfigSchemaVerifier;