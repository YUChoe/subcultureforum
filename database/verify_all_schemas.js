#!/usr/bin/env node

/**
 * 전체 데이터베이스 스키마 검증 스크립트
 * Config DB와 모든 Forum DB의 스키마를 검증합니다.
 */

const ConfigSchemaVerifier = require('./verify_config_schema');
const ForumSchemaInitializer = require('./init_forum_schema');
const DatabaseManager = require('../services/DatabaseManager');

class AllSchemasVerifier {
    constructor() {
        this.configVerifier = new ConfigSchemaVerifier();
        this.forumInitializer = new ForumSchemaInitializer();
        this.dbManager = DatabaseManager.getInstance();
    }

    async verify() {
        try {
            console.log('🔍 전체 데이터베이스 스키마 검증 시작\n');

            // 1. Config 데이터베이스 검증
            console.log('=== 1. Config 데이터베이스 검증 ===');
            await this.configVerifier.verify();

            console.log('\n' + '='.repeat(50) + '\n');

            // 2. DatabaseManager 초기화
            console.log('=== 2. DatabaseManager 초기화 ===');
            await this.forumInitializer.initialize();

            // 3. Forum 데이터베이스들 검증
            console.log('=== 3. Forum 데이터베이스들 검증 ===');
            await this.verifyForumDatabases();

            console.log('\n✅ 전체 데이터베이스 스키마 검증 완료!');

        } catch (error) {
            console.error('❌ 검증 중 오류 발생:', error);
            throw error;
        } finally {
            await this.forumInitializer.close();
        }
    }

    async verifyForumDatabases() {
        try {
            // 모든 카테고리 조회
            const categories = await this.dbManager.getAllCategories();

            if (categories.length === 0) {
                console.log('📝 등록된 포럼 카테고리가 없습니다.');
                return;
            }

            console.log(`📋 총 ${categories.length}개의 포럼 카테고리 발견:`);
            categories.forEach(category => {
                console.log(`  - ${category.name} (ID: ${category.id})`);
            });
            console.log();

            // 각 포럼 DB 검증
            const results = [];
            for (const category of categories) {
                console.log(`🔍 포럼 DB 검증 중: ${category.name} (ID: ${category.id})`);

                try {
                    const isValid = await this.dbManager.validateForumSchema(category.id);

                    if (isValid) {
                        console.log(`  ✅ 스키마 검증 성공`);

                        // 추가 정보 조회
                        const stats = await this.getForumStats(category.id);
                        console.log(`  📊 게시글: ${stats.posts}개, 댓글: ${stats.comments}개`);

                        results.push({
                            categoryId: category.id,
                            categoryName: category.name,
                            status: '✅ 정상',
                            posts: stats.posts,
                            comments: stats.comments
                        });
                    } else {
                        console.log(`  ❌ 스키마 검증 실패`);
                        results.push({
                            categoryId: category.id,
                            categoryName: category.name,
                            status: '❌ 스키마 오류',
                            posts: 0,
                            comments: 0
                        });
                    }
                } catch (error) {
                    console.log(`  ❌ 검증 오류: ${error.message}`);
                    results.push({
                        categoryId: category.id,
                        categoryName: category.name,
                        status: `❌ 오류: ${error.message}`,
                        posts: 0,
                        comments: 0
                    });
                }
                console.log();
            }

            // 결과 요약 테이블
            console.log('📊 포럼 DB 검증 결과 요약:');
            console.table(results);

        } catch (error) {
            console.error('포럼 데이터베이스 검증 실패:', error);
            throw error;
        }
    }

    async getForumStats(categoryId) {
        try {
            const forumDB = await this.dbManager.getForumDB(categoryId);

            const postsCount = await new Promise((resolve, reject) => {
                forumDB.get('SELECT COUNT(*) as count FROM posts', (err, row) => {
                    if (err) reject(err);
                    else resolve(row.count);
                });
            });

            const commentsCount = await new Promise((resolve, reject) => {
                forumDB.get('SELECT COUNT(*) as count FROM comments', (err, row) => {
                    if (err) reject(err);
                    else resolve(row.count);
                });
            });

            return {
                posts: postsCount,
                comments: commentsCount
            };
        } catch (error) {
            console.warn(`포럼 통계 조회 실패 (categoryId: ${categoryId}):`, error.message);
            return { posts: 0, comments: 0 };
        }
    }

    // 스키마 복구 기능
    async repairSchemas() {
        try {
            console.log('🔧 스키마 복구 시작\n');

            // DatabaseManager 초기화
            await this.forumInitializer.initialize();

            // 모든 포럼 스키마 검증 및 복구
            console.log('=== 포럼 스키마 복구 ===');
            const results = await this.forumInitializer.validateAllForumSchemas();

            console.log('\n📊 복구 결과:');
            console.table(results);

            const failedCount = results.filter(r => !r.isValid).length;
            if (failedCount === 0) {
                console.log('✅ 모든 포럼 스키마가 정상입니다.');
            } else {
                console.log(`⚠️  ${failedCount}개의 포럼 스키마에서 문제가 발견되어 복구를 시도했습니다.`);
            }

        } catch (error) {
            console.error('❌ 스키마 복구 실패:', error);
            throw error;
        } finally {
            await this.forumInitializer.close();
        }
    }
}

// CLI 실행 지원
if (require.main === module) {
    const verifier = new AllSchemasVerifier();

    async function main() {
        try {
            const args = process.argv.slice(2);
            const command = args[0];

            switch (command) {
                case 'repair':
                    await verifier.repairSchemas();
                    break;
                case 'verify':
                default:
                    await verifier.verify();
                    break;
            }
        } catch (error) {
            console.error('실행 실패:', error);
            process.exit(1);
        }
    }

    main();
}

module.exports = AllSchemasVerifier;