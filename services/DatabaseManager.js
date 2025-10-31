const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

class DatabaseManager {
    constructor() {
        this.configDB = null;
        this.forumDBs = new Map(); // categoryId -> database connection
        this.dbPath = path.join(__dirname, '../database');
    }

    async initialize() {
        try {
            // 데이터베이스 디렉토리 생성
            await this.ensureDirectoryExists(this.dbPath);

            // Config 데이터베이스 초기화
            await this.initializeConfigDB();

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
        const tables = [
            // 게시글 테이블
            `CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                title VARCHAR(200) NOT NULL,
                content TEXT NOT NULL,
                view_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_comment_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // 댓글 테이블
            `CREATE TABLE IF NOT EXISTS comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
            )`,

            // FTS5 검색 인덱스
            `CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
                title, content, content='posts', content_rowid='id'
            )`
        ];

        for (const tableSQL of tables) {
            await this.runQuery(db, tableSQL);
        }

        // FTS5 트리거 생성
        const triggers = [
            `CREATE TRIGGER IF NOT EXISTS posts_ai AFTER INSERT ON posts BEGIN
                INSERT INTO posts_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
            END`,

            `CREATE TRIGGER IF NOT EXISTS posts_ad AFTER DELETE ON posts BEGIN
                INSERT INTO posts_fts(posts_fts, rowid, title, content) VALUES('delete', old.id, old.title, old.content);
            END`,

            `CREATE TRIGGER IF NOT EXISTS posts_au AFTER UPDATE ON posts BEGIN
                INSERT INTO posts_fts(posts_fts, rowid, title, content) VALUES('delete', old.id, old.title, old.content);
                INSERT INTO posts_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
            END`
        ];

        for (const triggerSQL of triggers) {
            await this.runQuery(db, triggerSQL);
        }
    }

    getConfigDB() {
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

    async close() {
        // Config DB 닫기
        if (this.configDB) {
            await new Promise((resolve) => {
                this.configDB.close(resolve);
            });
        }

        // Forum DB들 닫기
        for (const [categoryId, db] of this.forumDBs) {
            await new Promise((resolve) => {
                db.close(resolve);
            });
        }

        this.forumDBs.clear();
        console.log('모든 데이터베이스 연결 종료');
    }
}

module.exports = DatabaseManager;