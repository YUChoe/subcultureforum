#!/usr/bin/env node

/**
 * Forum 데이터베이스 스키마 초기화 스크립트
 * 새로운 포럼 카테고리 생성 시 사용되는 스키마 템플릿을 적용합니다.
 */

const DatabaseManager = require('../services/DatabaseManager');
const path = require('path');
const fs = require('fs').promises;

class ForumSchemaInitializer {
    constructor() {
        this.dbManager = DatabaseManager.getInstance();
    }

    async initialize() {
        try {
            await this.dbManager.initialize();
            console.log('DatabaseManager 초기화 완료');
        } catch (error) {
            console.error('DatabaseManager 초기화 실패:', error);
            throw error;
        }
    }

    // 특정 카테고리 ID에 대해 포럼 DB 스키마 적용
    async initializeForumSchema(categoryId) {
        if (!categoryId) {
            throw new Error('categoryId가 필요합니다.');
        }

        try {
            console.log(`포럼 DB 스키마 초기화 시작: category_id=${categoryId}`);

            // 포럼 DB 생성 및 스키마 적용
            const forumDB = await this.dbManager.getForumDB(categoryId);

            // 스키마 검증
            const isValid = await this.dbManager.validateForumSchema(categoryId);
            if (!isValid) {
                throw new Error(`포럼 DB ${categoryId} 스키마 검증 실패`);
            }

            console.log(`포럼 DB 스키마 초기화 완료: category_id=${categoryId}`);
            return true;
        } catch (error) {
            console.error(`포럼 DB 스키마 초기화 실패: category_id=${categoryId}`, error);
            throw error;
        }
    }

    // 모든 기존 카테고리에 대해 포럼 DB 스키마 검증 및 재적용
    async validateAllForumSchemas() {
        try {
            console.log('모든 포럼 DB 스키마 검증 시작');

            const categories = await this.dbManager.getAllCategories();
            const results = [];

            for (const category of categories) {
                try {
                    const isValid = await this.dbManager.validateForumSchema(category.id);
                    results.push({
                        categoryId: category.id,
                        categoryName: category.name,
                        isValid: isValid
                    });

                    if (!isValid) {
                        console.log(`포럼 DB 스키마 재적용: ${category.name} (ID: ${category.id})`);
                        await this.initializeForumSchema(category.id);
                    }
                } catch (error) {
                    console.error(`카테고리 ${category.name} 스키마 검증 실패:`, error);
                    results.push({
                        categoryId: category.id,
                        categoryName: category.name,
                        isValid: false,
                        error: error.message
                    });
                }
            }

            console.log('포럼 DB 스키마 검증 완료');
            return results;
        } catch (error) {
            console.error('포럼 DB 스키마 검증 실패:', error);
            throw error;
        }
    }

    // 새 포럼 카테고리 생성 (스키마 초기화 포함)
    async createNewCategory(categoryData) {
        try {
            console.log('새 포럼 카테고리 생성 시작:', categoryData);

            // 카테고리 생성 및 DB 초기화
            const category = await this.dbManager.createNewForumCategory(categoryData);

            // 스키마 검증
            const isValid = await this.dbManager.validateForumSchema(category.id);
            if (!isValid) {
                throw new Error(`새 포럼 카테고리 ${category.id} 스키마 검증 실패`);
            }

            console.log('새 포럼 카테고리 생성 완료:', category);
            return category;
        } catch (error) {
            console.error('새 포럼 카테고리 생성 실패:', error);
            throw error;
        }
    }

    async close() {
        try {
            await this.dbManager.close();
            console.log('DatabaseManager 연결 종료');
        } catch (error) {
            console.error('DatabaseManager 연결 종료 실패:', error);
        }
    }
}

// CLI 실행 지원
if (require.main === module) {
    const initializer = new ForumSchemaInitializer();

    async function main() {
        try {
            await initializer.initialize();

            const args = process.argv.slice(2);
            const command = args[0];

            switch (command) {
                case 'validate':
                    console.log('모든 포럼 DB 스키마 검증 중...');
                    const results = await initializer.validateAllForumSchemas();
                    console.table(results);
                    break;

                case 'init':
                    const categoryId = args[1];
                    if (!categoryId) {
                        console.error('사용법: node init_forum_schema.js init <category_id>');
                        process.exit(1);
                    }
                    await initializer.initializeForumSchema(parseInt(categoryId));
                    break;

                case 'create':
                    const name = args[1];
                    const description = args[2] || '';
                    if (!name) {
                        console.error('사용법: node init_forum_schema.js create <name> [description]');
                        process.exit(1);
                    }
                    const category = await initializer.createNewCategory({ name, description });
                    console.log('생성된 카테고리:', category);
                    break;

                default:
                    console.log('사용 가능한 명령어:');
                    console.log('  validate - 모든 포럼 DB 스키마 검증');
                    console.log('  init <category_id> - 특정 카테고리 포럼 DB 스키마 초기화');
                    console.log('  create <name> [description] - 새 포럼 카테고리 생성');
                    break;
            }
        } catch (error) {
            console.error('실행 실패:', error);
            process.exit(1);
        } finally {
            await initializer.close();
        }
    }

    main();
}

module.exports = ForumSchemaInitializer;