# 개정: DB 변경 없는 SEO 구현

소유자 결정에 따라 requirements/design/tasks 의 아래 항목은 다음과 같이 대체한다. 이 문서가 다른 문서와 충돌하면 이 문서가 우선한다.

## 원칙
- DB 스키마 변경, 신규 테이블, 신규 .db 파일, 마이그레이션 스크립트를 두지 않는다.
- 모든 SEO 데이터는 기존 데이터(categories, posts, attachments, users)로 요청 시점에 계산한다.
- sitemap 은 프로세스 메모리에 TTL(기본 1시간)로 캐시한다.
- 사이트 기준 URL은 환경변수 `SITE_URL` 에서 읽는다.
- canvas 등 네이티브 의존성을 추가하지 않는다.

## 대체 항목
| 원안 | 변경 |
|------|------|
| cache.db / cache 테이블 (요구사항 7.3, 7.4) | 프로세스 메모리 캐시 (TTL 1시간) |
| og_images 테이블, OGImageGenerator, `/api/og-image/:postId` (요구사항 1.6~1.8, 2.6, 2.7, 11 전체) | 이미지 생성 안 함. 게시글 첨부 이미지 > 본문 이미지 > 정적 기본 이미지(`/images/og-default.png`, 1200x630) 순으로 선택. `SEOService.resolveOgImage()` 한 곳에서 결정하므로 나중에 생성 이미지를 추가할 수 있다 |
| site_settings 의 SEO 설정 (태스크 1.3) | 환경변수 (`SITE_URL`, `SITE_NAME`, `SITE_DESCRIPTION`) |
| 비공개 게시글 noindex (요구사항 8.5) | 현재 스키마에 비공개 게시글 개념이 없어 해당 없음 |
| 관리자 SEO 미리보기, 스키마 유효성 검증 (요구사항 12.2~12.4) | 구현하지 않음 |
| 속성 기반 테스트 (선택 태스크) | 구현하지 않음. 스크립트로 수동 검증 |

## URL
dev-seo 초안의 `/forum/:id/post/:id` 는 실제 라우트가 아니다. 실제 URL을 사용한다.
- 카테고리: `/forum/subforum/:id` (페이지는 `?page=N`)
- 게시글: `/forum/subforum/:id/post/:postId`
- 검색: `/forum/search`
