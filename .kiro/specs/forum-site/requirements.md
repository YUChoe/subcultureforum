# 포럼 사이트 요구사항 문서

## 소개

루리웹과 같은 커뮤니티 포럼 사이트를 Node.js와 SQLite를 사용하여 구축합니다. 각 주제별 포럼마다 저장되는 컨텐츠와 사이트 구성 정보를 분리하여 관리하는 시스템입니다.

## 용어 정의

- **Forum_System**: Node.js 기반 포럼 웹 애플리케이션
- **Content_Database**: 각 포럼의 게시글, 댓글 등 사용자 생성 컨텐츠를 저장하는 SQLite 데이터베이스
- **Config_Database**: 포럼 설정, 카테고리, 사용자 권한 등 사이트 구성 정보를 저장하는 SQLite 데이터베이스
- **Forum_Category**: 특정 주제를 다루는 포럼 섹션 (예: 게임, 영화, 자유게시판)
- **User_Account**: 포럼에 가입한 사용자 계정
- **Post**: 포럼에 작성된 게시글
- **Comment**: 게시글에 달린 댓글
- **Forum_Moderator**: 특정 포럼 카테고리의 관리 권한을 가진 사용자
- **Super_Admin**: 전체 사이트 관리 권한을 가진 최고 관리자

## 요구사항

### 요구사항 1

**사용자 스토리:** 사용자로서, 포럼에 회원가입하고 로그인할 수 있어야 하므로, 커뮤니티에 참여할 수 있습니다.

#### 승인 기준

1. WHEN 사용자가 회원가입 양식을 제출할 때, THE Forum_System SHALL 사용자 정보를 Config_Database에 저장한다
2. WHEN 사용자가 로그인 정보를 입력할 때, THE Forum_System SHALL 인증을 수행하고 세션을 생성한다
3. THE Forum_System SHALL 비밀번호를 해시화하여 저장한다
4. IF 중복된 사용자명이 입력되면, THEN THE Forum_System SHALL 오류 메시지를 표시한다

### 요구사항 2

**사용자 스토리:** 방문자로서, 로그인 없이도 포럼 내용을 열람할 수 있어야 하므로, 회원가입 전에도 커뮤니티 내용을 확인할 수 있습니다.

#### 승인 기준

1. THE Forum_System SHALL 비로그인 사용자에게 포럼 카테고리 목록을 표시한다
2. THE Forum_System SHALL 비로그인 사용자가 게시글을 읽을 수 있도록 한다
3. THE Forum_System SHALL 비로그인 사용자가 댓글을 읽을 수 있도록 한다
4. THE Forum_System SHALL 비로그인 사용자에게는 작성 기능을 제한한다

### 요구사항 3

**사용자 스토리:** 사용자로서, 다양한 주제의 포럼 카테고리를 탐색할 수 있어야 하므로, 관심 있는 주제의 게시글을 찾을 수 있습니다.

#### 승인 기준

1. THE Forum_System SHALL 포럼 카테고리 목록을 메인 페이지에 표시한다
2. WHEN 사용자가 특정 카테고리를 클릭할 때, THE Forum_System SHALL 해당 카테고리의 게시글 목록을 표시한다
3. THE Forum_System SHALL 각 카테고리별로 게시글 수와 최근 활동 정보를 표시한다
4. THE Forum_System SHALL 카테고리 정보를 Config_Database에서 관리한다
5. THE Forum_System SHALL 게시글 목록을 최신 작성일 순으로 기본 정렬한다
6. THE Forum_System SHALL 최신 댓글 순 정렬 옵션을 제공한다
7. WHEN 사용자가 정렬 방식을 선택할 때, THE Forum_System SHALL 선택된 방식으로 게시글 목록을 재정렬한다

### 요구사항 4

**사용자 스토리:** 사용자로서, 포럼에 게시글을 작성하고 수정할 수 있어야 하므로, 다른 사용자들과 소통할 수 있습니다.

#### 승인 기준

1. WHEN 로그인한 사용자가 게시글 작성 버튼을 클릭할 때, THE Forum_System SHALL 게시글 작성 폼을 표시한다
2. WHEN 사용자가 게시글을 제출할 때, THE Forum_System SHALL 게시글을 Content_Database에 저장한다
3. WHEN 게시글 작성자가 수정 버튼을 클릭할 때, THE Forum_System SHALL 게시글 수정 폼을 표시한다
4. THE Forum_System SHALL 게시글 작성 시간과 수정 시간을 기록한다
5. THE Forum_System SHALL 게시글에 제목, 내용, 작성자 정보를 포함한다

### 요구사항 5

**사용자 스토리:** 사용자로서, 게시글에 댓글을 달 수 있어야 하므로, 게시글에 대한 의견을 표현할 수 있습니다.

#### 승인 기준

1. WHEN 로그인한 사용자가 댓글 작성 폼에 내용을 입력할 때, THE Forum_System SHALL 댓글을 Content_Database에 저장한다
2. THE Forum_System SHALL 댓글을 게시글 하단에 시간순으로 표시한다
3. WHEN 댓글 작성자가 자신의 댓글을 수정할 때, THE Forum_System SHALL 댓글 수정을 허용한다
4. THE Forum_System SHALL 각 게시글의 댓글 수를 표시한다

### 요구사항 6

**사용자 스토리:** 슈퍼 관리자로서, 포럼 카테고리를 생성하고 전체 사이트를 관리할 수 있어야 하므로, 포럼 구조를 체계적으로 운영할 수 있습니다.

#### 승인 기준

1. WHEN Super_Admin이 관리자 패널에 접근할 때, THE Forum_System SHALL 전체 사이트 관리 인터페이스를 제공한다
2. WHEN Super_Admin이 새 카테고리를 생성할 때, THE Forum_System SHALL 카테고리 정보를 Config_Database에 저장한다
3. THE Forum_System SHALL Super_Admin이 사용자 권한을 관리할 수 있도록 한다
4. THE Forum_System SHALL Super_Admin이 카테고리 순서를 변경할 수 있도록 한다

### 요구사항 7

**사용자 스토리:** 포럼 모더레이터로서, 담당 카테고리의 게시글과 댓글을 관리할 수 있어야 하므로, 해당 포럼의 질서를 유지할 수 있습니다.

#### 승인 기준

1. WHEN Forum_Moderator가 담당 카테고리에 접근할 때, THE Forum_System SHALL 모더레이션 도구를 제공한다
2. THE Forum_System SHALL Forum_Moderator가 담당 카테고리의 게시글을 삭제할 수 있도록 한다
3. THE Forum_System SHALL Forum_Moderator가 담당 카테고리의 댓글을 수정하거나 삭제할 수 있도록 한다
4. THE Forum_System SHALL Forum_Moderator의 권한을 특정 카테고리로 제한한다

### 요구사항 8

**사용자 스토리:** 사용자로서, 게시글과 댓글을 검색할 수 있어야 하므로, 원하는 정보를 빠르게 찾을 수 있습니다.

#### 승인 기준

1. WHEN 사용자가 검색어를 입력할 때, THE Forum_System SHALL Content_Database에서 제목과 내용을 검색한다
2. THE Forum_System SHALL 검색 결과를 관련도 순으로 정렬하여 표시한다
3. THE Forum_System SHALL 카테고리별 검색 필터를 제공한다
4. THE Forum_System SHALL 검색 결과에 게시글 제목, 작성자, 작성일을 표시한다

### 요구사항 9

**사용자 스토리:** 시스템 관리자로서, 컨텐츠 데이터베이스와 설정 데이터베이스를 분리하여 관리할 수 있어야 하므로, 데이터 백업과 유지보수를 효율적으로 수행할 수 있습니다.

#### 승인 기준

1. THE Forum_System SHALL 사용자 계정, 카테고리 설정, 권한 정보를 Config_Database에 저장한다
2. THE Forum_System SHALL 게시글, 댓글, 첨부파일 정보를 Content_Database에 저장한다
3. THE Forum_System SHALL 두 데이터베이스 간의 참조 무결성을 유지한다
4. THE Forum_System SHALL 각 데이터베이스를 독립적으로 백업할 수 있도록 한다