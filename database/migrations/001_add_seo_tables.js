const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

/**
 * SEO 최적화를 위한 데이터베이스 마이그레이션
 * - config.db에 og_images 테이블 추가
 * - site_settings에 SEO 관련 설정 추가
 */
class SEOMigration {
    constructor() {
        this.configDbPath = path.join(__dirname, '..', 'config.db');
        this.seoSchemaPath = path.join(__dirname, '..', 'schema', 'seo_schema.sql');
    }

    /**
     * 마이그레이션 실행
     */
    async migrate() {
        try {
            console.log('SEO 마이그레이션 시작...');

            // config.db 존재 여부 확인
            if (!fs.existsSync(this.configDbPath)) {
                throw new Error('config.db가 존재하지 않습니다. 먼저 config.db를 초기화해주세요.');
            }

            const db = new sqlite3.Database(this.configDbPath);

            // 1. og_images 테이블 추가
            await this.addOGImagesTable(db);

            // 2. SEO 설정 추가
            await this.addSEOSettings(db);

            db.close();
            console.log('SEO 마이그레이션 완료!');

        } catch (error) {
            console.error('SEO 마이그레이션 실패:', error);
            throw error;
        }
    }

    /**
     * og_images 테이블 추가
     */
    async addOGImagesTable(db) {
        return new Promise((resolve, reject) => {
            // 테이블 존재 여부 확인
            db.get(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='og_images'",
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (row) {
                        console.log('og_images 테이블이 이미 존재합니다. 건너뜁니다.');
                        resolve();
                        return;
                    }

                    // 스키마 파일 읽기
                    const schema = fs.readFileSync(this.seoSchemaPath, 'utf8');

                    // 스키마 실행
                    db.exec(schema, (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            console.log('og_images 테이블 생성 완료');
                            console.log('idx_og_images_post_category 인덱스 생성 완료');
                            resolve();
                        }
                    });
                }
            );
        });
    }

    /**
     * SEO 설정 추가
     */
    async addSEOSettings(db) {
        return new Promise((resolve, reject) => {
            const seoSettings = [
                { key: 'site_name', value: '커뮤니티 포럼' },
                { key: 'site_description', value: '다양한 주제로 소통하는 커뮤니티 포럼입니다.' },
                { key: 'site_url', value: 'https://example.com' },
                { key: 'site_keywords', value: '포럼, 커뮤니티, 게시판' },
                { key: 'og_default_image', value: '/images/og-default.png' },
                { key: 'twitter_site', value: '@example' },
                { key: 'sitemap_cache_duration', value: '3600' }
            ];

            console.log('SEO 설정 추가 중...');

            // 각 설정을 INSERT OR IGNORE로 추가
            const stmt = db.prepare(
                'INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)'
            );

            let completed = 0;
            let hasError = false;

            seoSettings.forEach((setting, index) => {
                stmt.run(setting.key, setting.value, (err) => {
                    if (err && !hasError) {
                        hasError = true;
                        stmt.finalize();
                        reject(err);
                        return;
                    }

                    completed++;

                    if (completed === seoSettings.length) {
                        stmt.finalize((err) => {
                            if (err) {
                                reject(err);
                            } else {
                                console.log(`SEO 설정 ${seoSettings.length}개 추가 완료`);
                                resolve();
                            }
                        });
                    }
                });
            });
        });
    }

    /**
     * 마이그레이션 롤백 (개발용)
     */
    async rollback() {
        try {
            console.log('SEO 마이그레이션 롤백 시작...');

            const db = new sqlite3.Database(this.configDbPath);

            // og_images 테이블 삭제
            await new Promise((resolve, reject) => {
                db.run('DROP TABLE IF EXISTS og_images', (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        console.log('og_images 테이블 삭제 완료');
                        resolve();
                    }
                });
            });

            // SEO 설정 삭제
            await new Promise((resolve, reject) => {
                const seoKeys = [
                    'site_name',
                    'site_description',
                    'site_url',
                    'site_keywords',
                    'og_default_image',
                    'twitter_site',
                    'sitemap_cache_duration'
                ];

                db.run(
                    `DELETE FROM site_settings WHERE key IN (${seoKeys.map(() => '?').join(',')})`,
                    seoKeys,
                    (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            console.log('SEO 설정 삭제 완료');
                            resolve();
                        }
                    }
                );
            });

            db.close();
            console.log('SEO 마이그레이션 롤백 완료!');

        } catch (error) {
            console.error('SEO 마이그레이션 롤백 실패:', error);
            throw error;
        }
    }
}

module.exports = SEOMigration;

// 직접 실행 시 마이그레이션 수행
if (require.main === module) {
    const migration = new SEOMigration();

    // 명령행 인수 확인
    const args = process.argv.slice(2);
    const shouldRollback = args.includes('--rollback');

    const action = shouldRollback ? migration.rollback() : migration.migrate();

    action
        .then(() => {
            console.log('작업 성공!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('작업 실패:', error);
            process.exit(1);
        });
}
