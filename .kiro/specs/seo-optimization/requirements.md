# SEO 최적화 요구사항 문서

## 소개

Node.js + Express.js 기반 커뮤니티 포럼 사이트의 검색엔진 최적화(SEO) 및 AI 크롤러 친화적 기능을 구현합니다. 검색엔진(Google, Naver, Bing)과 AI 크롤러(GPTBot, Claude-Web 등)가 포럼 콘텐츠를 효과적으로 크롤링하고 인덱싱할 수 있도록 메타데이터, 구조화된 데이터, sitemap 등을 제공합니다.

## 용어 정의

- **SEO_System**: 검색엔진 최적화를 담당하는 시스템 컴포넌트
- **Meta_Tag_Generator**: 페이지별 동적 메타 태그를 생성하는 모듈
- **Sitemap_Generator**: XML 형식의 사이트맵을 동적으로 생성하는 모듈
- **Structured_Data**: JSON-LD 형식의 구조화된 데이터 (Schema.org 표준)
- **Open_Graph**: 소셜 미디어 공유를 위한 메타데이터 프로토콜
- **Twitter_Card**: 트위터 공유를 위한 메타데이터
- **Robots_File**: 크롤러의 접근 규칙을 정의하는 robots.txt 파일
- **Canonical_URL**: 중복 콘텐츠 방지를 위한 표준 URL
- **AI_Crawler**: GPTBot, Claude-Web 등 AI 학습을 위한 웹 크롤러
- **Search_Engine**: Google, Naver, Bing 등 검색엔진 크롤러

## 요구사항

### 요구사항 1: 동적 메타 태그 시스템

**사용자 스토리:** 검색엔진 운영자로서, 각 페이지의 콘텐츠를 정확히 이해할 수 있는 메타데이터를 제공받아야 하므로, 검색 결과에 적절한 정보를 표시할 수 있습니다.

#### 승인 기준

1. WHEN 사용자가 메인 페이지에 접근할 때, THE Meta_Tag_Generator SHALL 사이트 전체 정보를 담은 메타 태그를 생성한다
2. WHEN 사용자가 포럼 카테고리 페이지에 접근할 때, THE Meta_Tag_Generator SHALL 해당 카테고리 정보를 담은 메타 태그를 생성한다
3. WHEN 사용자가 게시글 상세 페이지에 접근할 때, THE Meta_Tag_Generator SHALL 게시글 제목, 내용 요약, 작성자, 작성일을 포함한 메타 태그를 생성한다
4. THE Meta_Tag_Generator SHALL title, description, keywords 메타 태그를 모든 페이지에 포함한다
5. THE Meta_Tag_Generator SHALL 게시글 내용에서 처음 160자를 추출하여 description으로 사용한다
6. THE Meta_Tag_Generator SHALL 게시글마다 고유한 대표 이미지를 자동 생성한다
7. THE Meta_Tag_Generator SHALL 대표 이미지에 게시글 제목, 작성자, 카테고리 정보를 포함한다
8. THE Meta_Tag_Generator SHALL 생성된 대표 이미지를 BLOB 형태로 데이터베이스에 저장한다

### 요구사항 2: Open Graph 및 Twitter Card 지원

**사용자 스토리:** 소셜 미디어 사용자로서, 포럼 링크를 공유할 때 풍부한 미리보기를 볼 수 있어야 하므로, 콘텐츠를 더 효과적으로 공유할 수 있습니다.

#### 승인 기준

1. THE Meta_Tag_Generator SHALL 모든 페이지에 Open Graph 메타 태그를 포함한다
2. THE Meta_Tag_Generator SHALL og:title, og:description, og:type, og:url, og:image 속성을 제공한다
3. THE Meta_Tag_Generator SHALL 게시글 페이지에 og:type을 "article"로 설정한다
4. THE Meta_Tag_Generator SHALL 모든 페이지에 Twitter Card 메타 태그를 포함한다
5. THE Meta_Tag_Generator SHALL twitter:card, twitter:title, twitter:description, twitter:image 속성을 제공한다
6. THE Meta_Tag_Generator SHALL 각 게시글의 자동 생성된 대표 이미지를 og:image로 사용한다
7. THE Meta_Tag_Generator SHALL 대표 이미지 URL을 /api/og-image/:postId 형식으로 제공한다

### 요구사항 3: 구조화된 데이터 (JSON-LD)

**사용자 스토리:** 검색엔진 운영자로서, 구조화된 데이터를 통해 콘텐츠의 의미를 정확히 파악할 수 있어야 하므로, 리치 스니펫을 검색 결과에 표시할 수 있습니다.

#### 승인 기준

1. THE SEO_System SHALL 모든 페이지에 JSON-LD 형식의 구조화된 데이터를 포함한다
2. THE SEO_System SHALL 메인 페이지에 WebSite 스키마를 포함한다
3. THE SEO_System SHALL 게시글 페이지에 Article 스키마를 포함한다
4. THE SEO_System SHALL Article 스키마에 headline, author, datePublished, dateModified, articleBody 속성을 포함한다
5. THE SEO_System SHALL 포럼 카테고리 페이지에 CollectionPage 스키마를 포함한다
6. THE SEO_System SHALL 검색 페이지에 SearchResultsPage 스키마를 포함한다
7. THE SEO_System SHALL BreadcrumbList 스키마를 모든 하위 페이지에 포함한다

### 요구사항 4: Robots.txt 파일 생성

**사용자 스토리:** 크롤러 운영자로서, 사이트의 크롤링 규칙을 명확히 알 수 있어야 하므로, 효율적으로 콘텐츠를 수집할 수 있습니다.

#### 승인 기준

1. THE SEO_System SHALL /robots.txt 경로에 robots 파일을 제공한다
2. THE Robots_File SHALL 모든 검색엔진 크롤러에게 공개 콘텐츠 접근을 허용한다
3. THE Robots_File SHALL 관리자 페이지(/admin)에 대한 크롤링을 차단한다
4. THE Robots_File SHALL 로그인 페이지(/auth)에 대한 크롤링을 차단한다
5. THE Robots_File SHALL 업로드 디렉토리(/uploads)에 대한 직접 크롤링을 차단한다
6. THE Robots_File SHALL sitemap.xml 위치를 명시한다
7. THE Robots_File SHALL AI 크롤러(GPTBot, Claude-Web, CCBot)에 대한 접근 규칙을 포함한다

### 요구사항 5: 동적 Sitemap.xml 생성

**사용자 스토리:** 검색엔진 운영자로서, 사이트의 모든 페이지 목록을 XML 형식으로 제공받아야 하므로, 효율적으로 페이지를 인덱싱할 수 있습니다.

#### 승인 기준

1. THE Sitemap_Generator SHALL /sitemap.xml 경로에 XML 사이트맵을 제공한다
2. THE Sitemap_Generator SHALL 데이터베이스에서 모든 공개 게시글 목록을 조회한다
3. THE Sitemap_Generator SHALL 각 URL에 대해 loc, lastmod, changefreq, priority 정보를 포함한다
4. THE Sitemap_Generator SHALL 메인 페이지의 priority를 1.0으로 설정한다
5. THE Sitemap_Generator SHALL 포럼 카테고리 페이지의 priority를 0.8로 설정한다
6. THE Sitemap_Generator SHALL 게시글 페이지의 priority를 0.6으로 설정한다
7. THE Sitemap_Generator SHALL 최근 수정된 게시글의 changefreq를 "daily"로 설정한다
8. THE Sitemap_Generator SHALL 오래된 게시글의 changefreq를 "monthly"로 설정한다
9. THE Sitemap_Generator SHALL 최대 50,000개의 URL을 포함한다
10. IF URL 개수가 50,000개를 초과하면, THEN THE Sitemap_Generator SHALL sitemap index 파일을 생성한다

### 요구사항 6: Canonical URL 설정

**사용자 스토리:** 검색엔진 운영자로서, 중복 콘텐츠를 방지하기 위한 표준 URL을 알 수 있어야 하므로, 올바른 페이지를 인덱싱할 수 있습니다.

#### 승인 기준

1. THE Meta_Tag_Generator SHALL 모든 페이지에 canonical link 태그를 포함한다
2. THE Meta_Tag_Generator SHALL 쿼리 파라미터가 있는 URL의 canonical을 기본 URL로 설정한다
3. WHEN 게시글이 여러 카테고리에 속할 때, THE Meta_Tag_Generator SHALL 주 카테고리의 URL을 canonical로 설정한다
4. THE Meta_Tag_Generator SHALL canonical URL에 프로토콜(https)과 도메인을 포함한 절대 URL을 사용한다

### 요구사항 7: 페이지 로딩 성능 최적화

**사용자 스토리:** 사용자로서, SEO 기능이 추가되어도 페이지 로딩 속도가 느려지지 않아야 하므로, 빠른 브라우징 경험을 유지할 수 있습니다.

#### 승인 기준

1. THE SEO_System SHALL 메타 태그 생성 로직을 200ms 이내에 완료한다
2. THE SEO_System SHALL 구조화된 데이터 생성을 서버 사이드에서 수행한다
3. THE Sitemap_Generator SHALL 생성된 sitemap을 메모리에 캐싱한다
4. THE Sitemap_Generator SHALL 캐시를 1시간마다 갱신한다
5. THE SEO_System SHALL 데이터베이스 쿼리를 최소화하기 위해 필요한 데이터만 조회한다

### 요구사항 8: AI 크롤러 친화적 설정

**사용자 스토리:** AI 서비스 운영자로서, 포럼 콘텐츠를 학습 데이터로 수집할 수 있는 명확한 규칙을 알 수 있어야 하므로, 적절한 방식으로 크롤링할 수 있습니다.

#### 승인 기준

1. THE Robots_File SHALL GPTBot, Claude-Web, CCBot, Google-Extended 크롤러에 대한 규칙을 명시한다
2. THE Robots_File SHALL AI 크롤러에게 공개 게시글 접근을 허용한다
3. THE Robots_File SHALL AI 크롤러의 크롤링 속도 제한(Crawl-delay)을 10초로 설정한다
4. THE SEO_System SHALL 응답 헤더에 X-Robots-Tag를 포함하여 페이지별 크롤링 규칙을 제공한다
5. IF 게시글이 비공개로 설정되어 있으면, THEN THE SEO_System SHALL X-Robots-Tag를 "noindex, nofollow"로 설정한다

### 요구사항 9: 검색 결과 페이지 최적화

**사용자 스토리:** 사용자로서, 포럼 내 검색 결과가 검색엔진에 중복 인덱싱되지 않아야 하므로, 검색엔진 결과의 품질을 유지할 수 있습니다.

#### 승인 기준

1. THE Meta_Tag_Generator SHALL 검색 결과 페이지에 noindex 메타 태그를 포함한다
2. THE Meta_Tag_Generator SHALL 검색 결과 페이지의 canonical을 검색 페이지 기본 URL로 설정한다
3. THE SEO_System SHALL 페이지네이션이 있는 페이지에 rel="prev"와 rel="next" 링크를 포함한다
4. THE Meta_Tag_Generator SHALL 검색 결과 페이지에 동적 title을 생성한다

### 요구사항 10: 다국어 SEO 지원 준비

**사용자 스토리:** 사이트 관리자로서, 향후 다국어 지원 시 SEO 설정을 쉽게 확장할 수 있어야 하므로, 국제화를 효율적으로 진행할 수 있습니다.

#### 승인 기준

1. THE Meta_Tag_Generator SHALL 모든 페이지에 lang 속성을 html 태그에 포함한다
2. THE Meta_Tag_Generator SHALL 현재 언어를 "ko"로 설정한다
3. THE SEO_System SHALL hreflang 태그를 추가할 수 있는 구조를 제공한다
4. THE SEO_System SHALL 언어별 메타데이터를 관리할 수 있는 설정 구조를 제공한다

### 요구사항 11: 게시글 대표 이미지 자동 생성

**사용자 스토리:** 소셜 미디어 사용자로서, 포럼 링크를 공유할 때 시각적으로 매력적인 대표 이미지를 볼 수 있어야 하므로, 콘텐츠를 더 효과적으로 공유할 수 있습니다.

#### 승인 기준

1. THE SEO_System SHALL 게시글 생성 시 자동으로 대표 이미지를 생성한다
2. THE SEO_System SHALL 대표 이미지 크기를 1200x630 픽셀로 생성한다
3. THE SEO_System SHALL 대표 이미지에 게시글 제목을 포함한다
4. THE SEO_System SHALL 대표 이미지에 작성자 이름을 포함한다
5. THE SEO_System SHALL 대표 이미지에 카테고리 이름을 포함한다
6. THE SEO_System SHALL 대표 이미지에 사이트 로고를 포함한다
7. THE SEO_System SHALL 생성된 이미지를 PNG 형식으로 BLOB 데이터로 저장한다
8. THE SEO_System SHALL 대표 이미지를 og_images 테이블에 저장한다
9. THE SEO_System SHALL /api/og-image/:postId 엔드포인트를 통해 이미지를 제공한다
10. THE SEO_System SHALL 대표 이미지 생성 실패 시 기본 이미지를 사용한다
11. THE SEO_System SHALL 게시글 제목이 변경되면 대표 이미지를 재생성한다
12. THE SEO_System SHALL 대표 이미지 생성을 비동기로 처리한다

### 요구사항 12: SEO 모니터링 및 디버깅

**사용자 스토리:** 사이트 관리자로서, SEO 설정이 올바르게 적용되었는지 확인할 수 있어야 하므로, 문제를 빠르게 발견하고 수정할 수 있습니다.

#### 승인 기준

1. WHERE 개발 환경에서, THE SEO_System SHALL HTML 주석으로 생성된 메타 태그 정보를 표시한다
2. THE SEO_System SHALL 관리자 페이지에 SEO 미리보기 기능을 제공한다
3. THE SEO_System SHALL 생성된 구조화된 데이터의 유효성을 검증한다
4. IF 구조화된 데이터가 Schema.org 표준을 위반하면, THEN THE SEO_System SHALL 콘솔에 경고 메시지를 출력한다
5. THE SEO_System SHALL sitemap 생성 시 오류가 발생하면 로그에 기록한다
