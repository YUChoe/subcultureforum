const path = require('path');
const fs = require('fs');

/**
 * SEO 최적화를 위한 전체 마이그레이션 실행 스크립트
 * 
 * 실행 순서:
 * 1. cache.db 초기화 (이미 존재하면 건너뜀)
 * 2. config.db에 og_images 테이블 추가
 * 3. site_settings에 SEO 설정 추가
 */

async function runSEOMigration() {
    console.log('='.repeat(60));
    console.log('SEO 최적화 데이터베이스 마이그레이션');
    console.log('='.repeat(60));
    console.log();

    try {
        // 1. cache.db 초기화
        console.log('[1/2] cache.db 초기화 확인...');
        const cacheDbPath = path.join(__dirname, 'cache.db');
        
        if (!fs.existsSync(cacheDbPath)) {
            console.log('cache.db가 존재하지 않습니다. 초기화를 실행합니다...');
            const initCacheDB = require('./init_cache_db');
            // init_cache_db.js는 실행 시 자동으로 초기화를 수행합니다
            console.log('cache.db 초기화 완료');
        } else {
            console.log('cache.db가 이미 존재합니다. 건너뜁니다.');
        }
        console.log();

        // 2. config.db에 SEO 테이블 및 설정 추가
        console.log('[2/2] config.db에 SEO 테이블 및 설정 추가...');
        const SEOMigration = require('./migrations/001_add_seo_tables');
        const seoMigration = new SEOMigration();
        await seoMigration.migrate();
        console.log();

        // 완료 메시지
        console.log('='.repeat(60));
        console.log('✅ SEO 마이그레이션이 성공적으로 완료되었습니다!');
        console.log('='.repeat(60));
        console.log();
        console.log('생성된 항목:');
        console.log('  - cache.db (캐시 데이터베이스)');
        console.log('  - cache 테이블 (sitemap 캐싱용)');
        console.log('  - og_images 테이블 (대표 이미지 저장용)');
        console.log('  - SEO 관련 site_settings 7개');
        console.log();

    } catch (error) {
        console.error('='.repeat(60));
        console.error('❌ SEO 마이그레이션 실패');
        console.error('='.repeat(60));
        console.error();
        console.error('오류 내용:', error.message);
        console.error();
        console.error('스택 트레이스:');
        console.error(error.stack);
        process.exit(1);
    }
}

// 스크립트 실행
if (require.main === module) {
    runSEOMigration()
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('예상치 못한 오류:', error);
            process.exit(1);
        });
}

module.exports = runSEOMigration;
