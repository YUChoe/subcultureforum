const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

class DatabaseManager {
    constructor() {
        this.configDB = null;
        this.forumDBs = new Map(); // categoryId -> database connection
        this.dbPath = path.join(__dirname, '../database');
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) {
            return;
        }

        try {
            // 데이터베이스 디렉토리 생성
            await this.ensureDirectoryExists(this.dbPath);

            // Config 데이터베이스 초기화
            await this.initializeConfigDB();

            this.isInitialized = true;
            console.log('DatabaseManager 초기화 완료');
        } catch (error) {
            console.error('DatabaseManager 초기화 실패:', error);
            throw error;
        }
    }

    async ensureDirectoryExists(dirPath) {
        try {
            await fs.access(dirPath);
        } catch (error) {
            if (error.code === 'ENOENT') {
                await fs.mkdir(dirPath, { recursive: true });
            } else {
                throw error;
            }
        }
    }

    async initializeConfigDB() {
        return new Promise((resolve, reject) => {
            const configDBPath = path.join(this.dbPath, 'config.db');

            this.configDB = new sqlite3.Database(configDBPath, (err) => {
                if (err) {
                    console.error('Config DB 연결 실패:', err);
                    reject(err);
                    return;
                }

                console.log('Config 데이터베이스 연결 성공');
                this.createConfigTables()
                    .then(() => resolve())
                    .catch(reject);
            });
        });
    }

    async createConfigTables() {
        const tables = [
            // 사용자 테이블
            `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role TEXT CHECK(role IN ('user', 'moderator', 'super_admin')) DEFAULT 'user',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // 포럼 카테고리 테이블
            `CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                display_order INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // 모더레이터 권한 테이블
            `CREATE TABLE IF NOT EXISTS moderator_permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                category_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (category_id) REFERENCES categories(id),
                UNIQUE(user_id, category_id)
            )`,

            // 사이트 설정 테이블
            `CREATE TABLE IF NOT EXISTS site_settings (
                key VARCHAR(100) PRIMARY KEY,
                value TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // 사용자 차단 테이블
            `CREATE TABLE IF NOT EXISTS user_bans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                banned_by INTEGER NOT NULL,
                reason TEXT NOT NULL,
                banned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME,
                is_active BOOLEAN DEFAULT 1,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (banned_by) REFERENCES users(id)
            )`,

            // 사용자 활동 로그 테이블
            `CREATE TABLE IF NOT EXISTS user_activity_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                action VARCHAR(50) NOT NULL,
                details TEXT,
                ip_address VARCHAR(45),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`
        ];

        for (const tableSQL of tables) {
            await this.runQuery(this.configDB, tableSQL);
        }

        console.log('Config 데이터베이스 테이블 생성 완료');
    }

    async getForumDB(categoryId) {
        if (!this.isInitialized) {
            throw new Error('DatabaseManager가 초기화되지 않았습니다. initialize()를 먼저 호출하세요.');
        }

        if (!categoryId) {
            throw new Error('categoryId가 필요합니다.');
        }

        if (!this.forumDBs.has(categoryId)) {
            const db = await this.createForumDB(categoryId);
            this.forumDBs.set(categoryId, db);
        }
        return this.forumDBs.get(categoryId);
    }

    async createForumDB(categoryId) {
        return new Promise((resolve, reject) => {
            const forumDBPath = path.join(this.dbPath, `forum_${categoryId}.db`);

            const db = new sqlite3.Database(forumDBPath, async (err) => {
                if (err) {
                    console.error(`Forum DB ${categoryId} 연결 실패:`, err);
                    reject(err);
                    return;
                }

                try {
                    await this.createForumTables(db);
                    console.log(`Forum 데이터베이스 ${categoryId} 초기화 완료`);
                    resolve(db);
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    async createForumTables(db) {
        try {
            // 스키마 템플릿 파일에서 SQL 읽기
            const schemaPath = path.join(__dirname, '../database/schema/forum_schema.sql');
            const schemaSQL = await fs.readFile(schemaPath, 'utf8');

            // SQL 문을 더 정확하게 분리하여 실행
            const statements = this.parseSQLStatements(schemaSQL);

            for (const statement of statements) {
                if (statement.trim().length > 0) {
                    await this.runQuery(db, statement);
                }
            }

            console.log('Forum 데이터베이스 스키마 템플릿 적용 완료');
        } catch (error) {
            console.error('Forum 스키마 템플릿 적용 실패:', error);
            throw error;
        }
    }

    // SQL 문을 정확하게 파싱하는 헬퍼 메서드
    parseSQLStatements(sql) {
        const statements = [];
        let currentStatement = '';
        let inTrigger = false;
        let triggerDepth = 0;

        const lines = sql.split('\n');

        for (const line of lines) {
            const trimmedLine = line.trim();

            // 주석 라인 건너뛰기
            if (trimmedLine.startsWith('--') || trimmedLine.length === 0) {
                continue;
            }

            // 현재 문장에 라인 추가
            if (currentStatement.length > 0) {
                currentStatement += '\n';
            }
            currentStatement += line;

            // 트리거 시작 감지
            if (trimmedLine.toUpperCase().includes('CREATE TRIGGER')) {
                inTrigger = true;
                triggerDepth = 0;
            }

            // BEGIN/END 블록 추적 (트리거용)
            if (inTrigger) {
                if (trimmedLine.toUpperCase().includes('BEGIN')) {
                    triggerDepth++;
                }
                if (trimmedLine.toUpperCase().includes('END')) {
                    triggerDepth--;
                }
            }

            // 문장 종료 조건 확인
            if (trimmedLine.endsWith(';')) {
                if (inTrigger && triggerDepth > 0) {
                    // 트리거 내부에서는 세미콜론이 있어도 계속
                    continue;
                } else {
                    // 일반 문장이거나 트리거가 완료된 경우
                    statements.push(currentStatement.trim());
                    currentStatement = '';
                    inTrigger = false;
                    triggerDepth = 0;
                }
            }
        }

        // 마지막 문장이 세미콜론으로 끝나지 않은 경우
        if (currentStatement.trim().length > 0) {
            statements.push(currentStatement.trim());
        }

        return statements.filter(stmt => stmt.length > 0);
    }

    getConfigDB() {
        if (!this.isInitialized) {
            throw new Error('DatabaseManager가 초기화되지 않았습니다. initialize()를 먼저 호출하세요.');
        }
        return this.configDB;
    }

    runQuery(db, sql, params = []) {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    getQuery(db, sql, params = []) {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    allQuery(db, sql, params = []) {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // 트랜잭션 실행
    async runTransaction(db, queries) {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                const results = [];
                let hasError = false;

                const executeQuery = (index) => {
                    if (index >= queries.length) {
                        if (hasError) {
                            db.run('ROLLBACK', (err) => {
                                if (err) console.error('ROLLBACK 실패:', err);
                                reject(new Error('트랜잭션 실행 중 오류 발생'));
                            });
                        } else {
                            db.run('COMMIT', (err) => {
                                if (err) {
                                    console.error('COMMIT 실패:', err);
                                    reject(err);
                                } else {
                                    resolve(results);
                                }
                            });
                        }
                        return;
                    }

                    const { sql, params = [] } = queries[index];
                    db.run(sql, params, function(err) {
                        if (err) {
                            console.error(`쿼리 실행 실패 (${index}):`, err);
                            hasError = true;
                        } else {
                            results.push({ id: this.lastID, changes: this.changes });
                        }
                        executeQuery(index + 1);
                    });
                };

                executeQuery(0);
            });
        });
    }

    async close() {
        try {
            // Config DB 닫기
            if (this.configDB) {
                await new Promise((resolve, reject) => {
                    this.configDB.close((err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                this.configDB = null;
            }

            // Forum DB들 닫기
            for (const [categoryId, db] of this.forumDBs) {
                await new Promise((resolve, reject) => {
                    db.close((err) => {
                        if (err) {
                            console.error(`Forum DB ${categoryId} 닫기 실패:`, err);
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
            }

            this.forumDBs.clear();
            this.isInitialized = false;
            console.log('모든 데이터베이스 연결 종료');
        } catch (error) {
            console.error('데이터베이스 연결 종료 중 오류:', error);
            throw error;
        }
    }

    // 연결 상태 확인
    isConnected() {
        return this.isInitialized && this.configDB !== null;
    }

    // 특정 포럼 DB 연결 상태 확인
    isForumDBConnected(categoryId) {
        return this.forumDBs.has(categoryId);
    }

    // 연결된 포럼 DB 목록 반환
    getConnectedForumDBs() {
        return Array.from(this.forumDBs.keys());
    }

    // 새 포럼 카테고리 생성 및 DB 초기화
    async createNewForumCategory(categoryData) {
        if (!this.isInitialized) {
            throw new Error('DatabaseManager가 초기화되지 않았습니다. initialize()를 먼저 호출하세요.');
        }

        const { name, description, displayOrder = 0 } = categoryData;

        if (!name || name.trim().length === 0) {
            throw new Error('카테고리 이름이 필요합니다.');
        }

        try {
            // 트랜잭션으로 카테고리 생성과 DB 초기화를 원자적으로 처리
            const result = await this.runQuery(
                this.configDB,
                `INSERT INTO categories (name, description, display_order, is_active)
                 VALUES (?, ?, ?, 1)`,
                [name.trim(), description || '', displayOrder]
            );

            const categoryId = result.id;

            // 새 포럼 DB 생성 및 초기화
            const forumDB = await this.createForumDB(categoryId);

            console.log(`새 포럼 카테고리 생성 완료: ID=${categoryId}, Name=${name}`);

            return {
                id: categoryId,
                name: name.trim(),
                description: description || '',
                display_order: displayOrder,
                is_active: true,
                created_at: new Date().toISOString()
            };
        } catch (error) {
            console.error('포럼 카테고리 생성 실패:', error);
            throw error;
        }
    }

    // 포럼 카테고리 삭제 및 관련 DB 정리
    async deleteForumCategory(categoryId) {
        if (!this.isInitialized) {
            throw new Error('DatabaseManager가 초기화되지 않았습니다. initialize()를 먼저 호출하세요.');
        }

        if (!categoryId) {
            throw new Error('categoryId가 필요합니다.');
        }

        try {
            // 카테고리 존재 확인
            const category = await this.getQuery(
                this.configDB,
                'SELECT * FROM categories WHERE id = ?',
                [categoryId]
            );

            if (!category) {
                throw new Error(`카테고리 ID ${categoryId}를 찾을 수 없습니다.`);
            }

            // 트랜잭션으로 처리
            const queries = [
                // 모더레이터 권한 삭제
                { sql: 'DELETE FROM moderator_permissions WHERE category_id = ?', params: [categoryId] },
                // 카테고리 삭제
                { sql: 'DELETE FROM categories WHERE id = ?', params: [categoryId] }
            ];

            await this.runTransaction(this.configDB, queries);

            // 포럼 DB 연결 종료 및 파일 삭제
            if (this.forumDBs.has(categoryId)) {
                const forumDB = this.forumDBs.get(categoryId);
                await new Promise((resolve, reject) => {
                    forumDB.close((err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                this.forumDBs.delete(categoryId);
            }

            // DB 파일 삭제
            const forumDBPath = path.join(this.dbPath, `forum_${categoryId}.db`);
            try {
                await fs.unlink(forumDBPath);
                console.log(`포럼 DB 파일 삭제 완료: ${forumDBPath}`);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.warn(`포럼 DB 파일 삭제 실패: ${error.message}`);
                }
            }

            console.log(`포럼 카테고리 삭제 완료: ID=${categoryId}, Name=${category.name}`);

            return true;
        } catch (error) {
            console.error('포럼 카테고리 삭제 실패:', error);
            throw error;
        }
    }

    // 모든 포럼 카테고리 목록 조회
    async getAllCategories() {
        if (!this.isInitialized) {
            throw new Error('DatabaseManager가 초기화되지 않았습니다. initialize()를 먼저 호출하세요.');
        }

        try {
            const categories = await this.allQuery(
                this.configDB,
                'SELECT * FROM categories WHERE is_active = 1 ORDER BY display_order, created_at'
            );

            return categories;
        } catch (error) {
            console.error('카테고리 목록 조회 실패:', error);
            throw error;
        }
    }

    // 포럼 DB 스키마 검증
    async validateForumSchema(categoryId) {
        if (!this.isInitialized) {
            throw new Error('DatabaseManager가 초기화되지 않았습니다. initialize()를 먼저 호출하세요.');
        }

        try {
            const forumDB = await this.getForumDB(categoryId);

            // 필수 테이블 존재 확인
            const requiredTables = ['posts', 'comments', 'posts_fts'];
            const existingTables = await this.allQuery(
                forumDB,
                "SELECT name FROM sqlite_master WHERE type='table'"
            );

            const tableNames = existingTables.map(t => t.name);
            const missingTables = requiredTables.filter(table => !tableNames.includes(table));

            if (missingTables.length > 0) {
                console.warn(`포럼 DB ${categoryId}에 누락된 테이블: ${missingTables.join(', ')}`);
                return false;
            }

            // 필수 트리거 존재 확인
            const requiredTriggers = ['posts_ai', 'posts_ad', 'posts_au', 'comments_ai', 'comments_au'];
            const existingTriggers = await this.allQuery(
                forumDB,
                "SELECT name FROM sqlite_master WHERE type='trigger'"
            );

            const triggerNames = existingTriggers.map(t => t.name);
            const missingTriggers = requiredTriggers.filter(trigger => !triggerNames.includes(trigger));

            if (missingTriggers.length > 0) {
                console.warn(`포럼 DB ${categoryId}에 누락된 트리거: ${missingTriggers.join(', ')}`);
                return false;
            }

            console.log(`포럼 DB ${categoryId} 스키마 검증 완료`);
            return true;
        } catch (error) {
            console.error(`포럼 DB ${categoryId} 스키마 검증 실패:`, error);
            return false;
        }
    }
}

// 싱글톤 인스턴스
let instance = null;

class DatabaseManagerSingleton {
    static getInstance() {
        if (!instance) {
            instance = new DatabaseManager();
        }
        return instance;
    }
}

module.exports = DatabaseManagerSingleton;