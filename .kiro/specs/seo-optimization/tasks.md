
# 구현 계획: SEO 최적화
## 개요

Node.js + Express.js 기반 커뮤니티 포럼의 검색엔진 최적화(SEO) 기능을 구현합니다. 메타 태그 생성, Open Graph/Twitter Card 지원, 구조화된 데이터(JSON-LD), sitemap.xml, robots.txt, 게시글 대표 이미지 자동 생성 등을 포함합니다.

## 태스크

- [x] 1. 데이터베이스 스키마 및 초기 설정
  - [x] 1.1 cache.db 데이터베이스 파일 생성 및 cache 테이블 스키마 작성
    - database/cache.db 파일 생성
    - database/schema/cache_schema.sql 작성 (cache 테이블, 인덱스, 트리거)
    - 요구사항: 7.3, 7.4
  
  - [x] 1.2 og_images 테이블 스키마 작성 (config.db)
    - database/schema/seo_schema.sql 작성 (og_images 테이블, 인덱스)
    - 요구사항: 1.8, 11.8
  
  - [x] 1.3 데이터베이스 마이그레이션 스크립트 작성
    - cache.db 초기화 스크립트
    - config.db에 og_images 테이블 추가
    - site_settings 테이블에 SEO 설정 추가
    - 요구사항: 1.1, 10.1, 10.2

- [ ] 2. SEO 유틸리티 모듈 구현
  - [ ] 2.1 MetaTagGenerator 클래스 구현
    - utils/MetaTagGenerator.js 생성
    - generateBasicMeta, generateOpenGraphMeta, generateTwitterCardMeta 메서드
    - generatePostMeta, generateCategoryMeta, generateHomeMeta 메서드
    - extractDescription 메서드 (160자 제한)
    - 요구사항: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
  
  - [ ]* 2.2 MetaTagGenerator 속성 테스트 작성
    - Property 1: 모든 페이지 필수 메타데이터
    - Property 2: 카테고리 페이지 메타 태그 정확성
    - Property 3: 게시글 페이지 메타 태그 정확성
    - Property 4: Description 길이 제한
    - Property 5: 소셜 미디어 메타데이터 완전성
    - Property 6: 게시글 OG 이미지 URL 형식
    - 검증: 요구사항 1.2, 1.3, 1.4, 1.5, 2.2, 2.5, 2.6, 2.7
  
  - [ ] 2.3 StructuredDataGenerator 클래스 구현
    - utils/StructuredDataGenerator.js 생성
    - generateWebSiteSchema, generateArticleSchema 메서드
    - generateBreadcrumbSchema, generateCollectionPageSchema 메서드
    - generateSearchResultsSchema 메서드
    - 요구사항: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
  
  - [ ]* 2.4 StructuredDataGenerator 속성 테스트 작성
    - Property 7: Article 스키마 필수 속성
    - Property 8: 카테고리 페이지 스키마 타입
    - Property 9: 하위 페이지 Breadcrumb
    - Property 28: 구조화된 데이터 유효성
    - 검증: 요구사항 3.4, 3.5, 3.7, 12.3
  
  - [ ] 2.5 SitemapGenerator 클래스 구현
    - utils/SitemapGenerator.js 생성
    - generateSitemap, getCachedSitemap, saveCachedSitemap 메서드
    - isCacheValid, createURLEntry 메서드
    - getPostURLs, getCategoryURLs 메서드
    - 요구사항: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 7.3, 7.4
  
  - [ ]* 2.6 SitemapGenerator 속성 테스트 작성
    - Property 10: Sitemap 공개 게시글 일치
    - Property 11: Sitemap URL 우선순위
    - Property 12: Sitemap changefreq 규칙
    - Property 13: Sitemap URL 개수 제한
    - Property 17: Sitemap 캐싱 동작
    - 검증: 요구사항 5.2, 5.5, 5.6, 5.7, 5.8, 5.9, 7.3
  
  - [ ] 2.7 OGImageGenerator 클래스 구현
    - utils/OGImageGenerator.js 생성
    - generateImage, saveImage, getImage 메서드
    - regenerateImage, getDefaultImage, wrapText 메서드
    - Canvas API를 사용한 1200x630 이미지 생성
    - 요구사항: 1.6, 1.7, 1.8, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.10, 11.12
  
  - [ ]* 2.8 OGImageGenerator 속성 테스트 작성
    - Property 21: 대표 이미지 생성 라운드트립
    - Property 22: 대표 이미지 크기
    - Property 23: 대표 이미지 필수 정보
    - Property 24: 대표 이미지 형식
    - Property 25: 대표 이미지 엔드포인트
    - Property 26: 대표 이미지 생성 실패 처리
    - Property 27: 게시글 수정 시 이미지 재생성
    - 검증: 요구사항 1.6, 1.8, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11

- [ ] 3. SEO 서비스 레이어 구현
  - [ ] 3.1 SEOService 클래스 구현
    - services/SEOService.js 생성
    - generatePageSEO, generateMetaTags, generateStructuredData 메서드
    - generateCanonicalURL 메서드
    - 요구사항: 1.1, 1.2, 1.3, 3.1, 6.1, 6.2, 6.3, 6.4
  
  - [ ]* 3.2 SEOService 속성 테스트 작성
    - Property 14: Canonical URL 쿼리 파라미터 제거
    - Property 15: Canonical URL 절대 경로
    - Property 16: 메타 태그 생성 성능
    - 검증: 요구사항 6.2, 6.4, 7.1

- [ ] 4. SEO 미들웨어 및 라우트 구현
  - [ ] 4.1 SEO 미들웨어 구현
    - middleware/seo.js 생성
    - res.locals에 SEO 헬퍼 함수 추가
    - X-Robots-Tag 헤더 설정
    - 요구사항: 8.4, 8.5
  
  - [ ] 4.2 SEO 라우트 구현
    - routes/seo.js 생성
    - GET /robots.txt 엔드포인트
    - GET /sitemap.xml 엔드포인트
    - GET /api/og-image/:postId 엔드포인트
    - 요구사항: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 11.9
  
  - [ ]* 4.3 SEO 라우트 속성 테스트 작성
    - Property 18: X-Robots-Tag 헤더 포함
    - 검증: 요구사항 8.4

- [ ] 5. EJS 템플릿 통합
  - [ ] 5.1 SEO 메타 태그 partial 생성
    - views/partials/seo-meta.ejs 생성
    - 메타 태그, Open Graph, Twitter Card, JSON-LD, canonical 링크 렌더링
    - 요구사항: 1.4, 2.1, 2.4, 3.1, 6.1, 10.1
  
  - [ ] 5.2 메인 레이아웃에 SEO partial 통합
    - views/layouts/main.ejs 수정
    - lang 속성 추가
    - seo-meta partial 포함
    - 요구사항: 10.1, 10.2
  
  - [ ] 5.3 페이지네이션 링크 추가
    - rel="prev", rel="next" 링크 구현
    - 요구사항: 9.3
  
  - [ ]* 5.4 페이지네이션 속성 테스트 작성
    - Property 19: 페이지네이션 링크
    - 검증: 요구사항 9.3

- [ ] 6. 기존 서비스 통합
  - [ ] 6.1 ForumService에 대표 이미지 생성 통합
    - services/ForumService.js 수정
    - createPost 메서드에 OGImageGenerator 호출 추가 (비동기)
    - updatePost 메서드에 이미지 재생성 로직 추가
    - 요구사항: 11.1, 11.11, 11.12
  
  - [ ] 6.2 라우터에 SEO 데이터 주입
    - 메인 페이지, 카테고리 페이지, 게시글 페이지 라우터 수정
    - SEOService를 사용하여 res.locals.seo 설정
    - 검색 결과 페이지에 noindex 설정
    - 요구사항: 1.1, 1.2, 1.3, 9.1, 9.2, 9.4
  
  - [ ]* 6.3 검색 결과 페이지 속성 테스트 작성
    - Property 20: 검색 결과 동적 title
    - 검증: 요구사항 9.4

- [ ] 7. 체크포인트 - 핵심 기능 검증
  - 모든 테스트가 통과하는지 확인
  - 사용자에게 질문이 있으면 문의

- [ ] 8. 통합 테스트 작성
  - [ ]* 8.1 페이지 렌더링 통합 테스트
    - 메인 페이지 SEO 데이터 확인
    - 카테고리 페이지 SEO 데이터 확인
    - 게시글 페이지 SEO 데이터 확인
    - 검색 결과 페이지 SEO 데이터 확인
  
  - [ ]* 8.2 엔드포인트 통합 테스트
    - /robots.txt 응답 확인
    - /sitemap.xml 응답 확인
    - /api/og-image/:postId 응답 확인
  
  - [ ]* 8.3 데이터베이스 통합 테스트
    - 게시글 생성 시 대표 이미지 자동 생성
    - 게시글 수정 시 대표 이미지 재생성
    - og_images 테이블 CRUD 동작

- [ ] 9. 예제 기반 테스트 작성
  - [ ]* 9.1 메인 페이지 메타 태그 테스트
    - 검증: 요구사항 1.1
  
  - [ ]* 9.2 게시글 페이지 og:type="article" 테스트
    - 검증: 요구사항 2.3
  
  - [ ]* 9.3 메인 페이지 WebSite 스키마 테스트
    - 검증: 요구사항 3.2
  
  - [ ]* 9.4 검색 페이지 SearchResultsPage 스키마 테스트
    - 검증: 요구사항 3.6
  
  - [ ]* 9.5 robots.txt 내용 확인 테스트
    - 검증: 요구사항 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 8.1, 8.2, 8.3
  
  - [ ]* 9.6 sitemap.xml 기본 구조 테스트
    - 검증: 요구사항 5.1
  
  - [ ]* 9.7 sitemap 메인 페이지 priority=1.0 테스트
    - 검증: 요구사항 5.4
  
  - [ ]* 9.8 sitemap index 생성 테스트
    - 검증: 요구사항 5.10
  
  - [ ]* 9.9 검색 결과 noindex 테스트
    - 검증: 요구사항 9.1
  
  - [ ]* 9.10 검색 결과 canonical 테스트
    - 검증: 요구사항 9.2
  
  - [ ]* 9.11 lang="ko" 설정 테스트
    - 검증: 요구사항 10.2
  
  - [ ]* 9.12 개발 환경 HTML 주석 테스트
    - 검증: 요구사항 12.1
  
  - [ ]* 9.13 스키마 유효성 경고 테스트
    - 검증: 요구사항 12.4
  
  - [ ]* 9.14 sitemap 오류 로그 테스트
    - 검증: 요구사항 12.5

- [ ] 10. 환경 설정 및 배포 준비
  - [ ] 10.1 환경 변수 설정
    - .env.example 파일에 SEO 관련 변수 추가
    - SITE_NAME, SITE_DESCRIPTION, SITE_URL 등
    - 요구사항: 1.1, 2.1, 3.2
  
  - [ ] 10.2 기본 OG 이미지 파일 추가
    - public/images/og-default.png 생성
    - 요구사항: 11.10
  
  - [ ] 10.3 app.js에 미들웨어 및 라우트 등록
    - SEO 미들웨어 등록
    - SEO 라우트 등록
    - 요구사항: 4.1, 5.1, 11.9

- [ ] 11. 최종 체크포인트
  - 모든 테스트가 통과하는지 확인
  - 사용자에게 질문이 있으면 문의

## 참고사항

- 태스크에 "*" 표시가 있는 항목은 선택적으로 구현 가능합니다
- 각 태스크는 이전 태스크를 기반으로 구축됩니다
- 속성 기반 테스트는 fast-check 라이브러리를 사용합니다
- 통합 테스트는 실제 데이터베이스와 Express 서버를 사용합니다
