const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const readline = require('readline');

/**
 * Config 데이터베이스 초기화 스크립트
 * 사용자, 카테고리, 권한 등 사이트 설정 정보를 관리하는 데이터베이스를 생성합니다.
 */
class ConfigDBInitializer {
    constructor() {
        this.dbPath = path.join(__dirname, 'config.db');
        this.schemaPath = path.join(__dirname, 'schema', 'config_schema.sql');
    }

    /**
     * Config 데이터베이스 초기화
     */
    async initialize() {
        try {
            console.log('Config 데이터베이스 초기화 시작...');

            // 기존 데이터베이스 존재 여부 확인
            if (this.exists()) {
                console.log('기존 데이터베이스가 발견되었습니다.');

                // 스키마 비교
                const schemaChanged = await this.compareSchema();

                if (schemaChanged) {
                    console.log('\n⚠️  스키마가 변경되었습니다!');
                    console.log('기존 데이터베이스를 삭제하고 새로 생성해야 합니다.');

                    const shouldProceed = await this.askUserConfirmation(
                        '기존 데이터베이스를 삭제하고 새로 생성하시겠습니까? (y/N): '
                    );

                    if (!shouldProceed) {
                        console.log('초기화가 취소되었습니다.');
                        return;
                    }

                    this.reset();
                } else {
                    console.log('✅ 스키마가 동일합니다. 초기화를 건너뜁니다.');
                    return;
                }
            }

            // 스키마 파일 읽기
            const schema = fs.readFileSync(this.schemaPath, 'utf8');

            // 데이터베이스 연결
            const db = new sqlite3.Database(this.dbPath);

            // 스키마 실행
            await this.executeSchema(db, schema);

            // 기본 데이터 삽입
            await this.insertDefaultData(db);

            db.close();
            console.log('Config 데이터베이스 초기화 완료!');

        } catch (error) {
            console.error('Config 데이터베이스 초기화 실패:', error);
            throw error;
        }
    }

    /**
     * 사용자 확인 요청
     */
    askUserConfirmation(question) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            rl.question(question, (answer) => {
                rl.close();
                resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
            });
        });
    }

    /**
     * 기존 스키마와 새 스키마 비교
     */
    async compareSchema() {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.dbPath);

            // 기존 테이블 구조 조회
            db.all(`
                SELECT name, sql
                FROM sqlite_master
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
                ORDER BY name
            `, (err, tables) => {
                if (err) {
                    db.close();
                    reject(err);
                    return;
                }

                db.close();

                try {
                    // 새 스키마 파일에서 예상되는 테이블들 추출
                    const newSchema = fs.readFileSync(this.schemaPath, 'utf8');
                    const expectedTables = this.extractTablesFromSchema(newSchema);
                    const existingTableNames = tables.map(t => t.name);

                    console.log('스키마 비교 중...');
                    console.log('기존 테이블:', existingTableNames);
                    console.log('예상 테이블:', expectedTables.map(t => t.name));

                    // 테이블 개수나 이름이 다른 경우
                    if (existingTableNames.length !== expectedTables.length) {
                        console.log(`테이블 개수가 다릅니다: 기존 ${existingTableNames.length}개, 예상 ${expectedTables.length}개`);
                        resolve(true);
                        return;
                    }

                    // 새로운 테이블이 있는지 확인
                    const newTables = expectedTables.filter(t => !existingTableNames.includes(t.name));
                    if (newTables.length > 0) {
                        console.log('새로운 테이블이 추가되었습니다:');
                        newTables.forEach(t => console.log(`- ${t.name}`));
                        resolve(true);
                        return;
                    }

                    // 삭제된 테이블이 있는지 확인
                    const expectedTableNames = expectedTables.map(t => t.name);
                    const removedTables = existingTableNames.filter(name => !expectedTableNames.includes(name));
                    if (removedTables.length > 0) {
                        console.log('삭제된 테이블이 있습니다:');
                        removedTables.forEach(name => console.log(`- ${name}`));
                        resolve(true);
                        return;
                    }

                    // 테이블 구조 변경 확인 (간단한 컬럼 수 비교)
                    for (const table of tables) {
                        const expectedTable = expectedTables.find(t => t.name === table.name);
                        if (expectedTable) {
                            const existingColumns = this.extractColumnsFromSQL(table.sql);
                            const expectedColumns = this.extractColumnsFromSQL(expectedTable.sql);

                            if (existingColumns.length !== expectedColumns.length) {
                                console.log(`테이블 ${table.name}의 컬럼 구조가 변경되었습니다:`);
                                console.log(`기존: ${existingColumns.length}개 컬럼, 예상: ${expectedColumns.length}개 컬럼`);
                                resolve(true);
                                return;
                            }
                        }
                    }

                    resolve(false);
                } catch (schemaError) {
                    reject(schemaError);
                }
            });
        });
    }

    /**
     * 스키마 파일에서 테이블 정보 추출
     */
    extractTablesFromSchema(schema) {
        const tables = [];
        const tableRegex = /CREATE TABLE (\w+)\s*\(([\s\S]*?)\);/gi;
        let match;

        while ((match = tableRegex.exec(schema)) !== null) {
            tables.push({
                name: match[1],
                sql: match[0]
            });
        }

        return tables;
    }

    /**
     * SQL에서 컬럼 정보 추출 (간단한 파싱)
     */
    extractColumnsFromSQL(sql) {
        const columns = [];
        const lines = sql.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed &&
                !trimmed.startsWith('CREATE TABLE') &&
                !trimmed.startsWith('FOREIGN KEY') &&
                !trimmed.startsWith('UNIQUE') &&
                !trimmed.startsWith('CHECK') &&
                !trimmed.includes(');')) {

                const columnMatch = trimmed.match(/^(\w+)\s+/);
                if (columnMatch) {
                    columns.push(columnMatch[1]);
                }
            }
        }

        return columns;
    }

    /**
     * 스키마 실행
     */
    executeSchema(db, schema) {
        return new Promise((resolve, reject) => {
            db.exec(schema, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('스키마 생성 완료');
                    resolve();
                }
            });
        });
    }

    /**
     * 기본 데이터 삽입
     */
    async insertDefaultData(db) {
        return new Promise((resolve, reject) => {
            const defaultData = `
                -- 기본 사이트 설정
                INSERT INTO site_settings (key, value) VALUES
                ('site_name', '포럼 사이트'),
                ('site_description', 'Node.js 기반 커뮤니티 포럼'),
                ('registration_enabled', 'true'),
                ('max_post_length', '10000'),
                ('max_comment_length', '2000');

                -- 기본 카테고리 생성
                INSERT INTO categories (name, description, display_order, is_active) VALUES
                ('자유게시판', '자유롭게 이야기를 나누는 공간입니다', 1, 1),
                ('질문과 답변', '궁금한 것들을 질문하고 답변하는 공간입니다', 2, 1),
                ('공지사항', '사이트 공지사항을 확인하는 공간입니다', 0, 1);
            `;

            db.exec(defaultData, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('기본 데이터 삽입 완료');
                    resolve();
                }
            });
        });
    }

    /**
     * 데이터베이스 존재 여부 확인
     */
    exists() {
        return fs.existsSync(this.dbPath);
    }

    /**
     * 데이터베이스 삭제 (재초기화용)
     */
    reset() {
        if (this.exists()) {
            fs.unlinkSync(this.dbPath);
            console.log('기존 Config 데이터베이스 삭제됨');
        }
    }
}

module.exports = ConfigDBInitializer;

// 직접 실행 시 초기화 수행
if (require.main === module) {
    const initializer = new ConfigDBInitializer();

    // 명령행 인수 확인
    const args = process.argv.slice(2);
    const shouldReset = args.includes('--reset');

    if (shouldReset) {
        initializer.reset();
    }

    initializer.initialize()
        .then(() => {
            console.log('초기화 성공!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('초기화 실패:', error);
            process.exit(1);
        });
}