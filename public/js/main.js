// 포럼 사이트 메인 JavaScript

// 페이지 로드 완료 후 실행
document.addEventListener('DOMContentLoaded', function() {
    console.log('포럼 사이트 로드 완료');

    // 폼 제출 시 로딩 표시
    setupFormLoading();

    // 댓글 토글 기능
    setupCommentToggle();

    // 자동 저장 기능 (게시글 작성 시)
    setupAutoSave();
});

// 폼 제출 시 로딩 표시
function setupFormLoading() {
    const forms = document.querySelectorAll('form');

    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            const submitButton = form.querySelector('button[type="submit"]');
            if (submitButton) {
                const originalText = submitButton.textContent;
                submitButton.innerHTML = '<span class="loading"></span> 처리 중...';
                submitButton.disabled = true;

                // 5초 후 원래 상태로 복구 (에러 방지)
                setTimeout(() => {
                    submitButton.textContent = originalText;
                    submitButton.disabled = false;
                }, 5000);
            }
        });
    });
}

// 댓글 토글 기능
function setupCommentToggle() {
    const commentToggles = document.querySelectorAll('[data-comment-toggle]');

    commentToggles.forEach(toggle => {
        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('data-comment-toggle');
            const target = document.getElementById(targetId);

            if (target) {
                if (target.style.display === 'none' || target.style.display === '') {
                    target.style.display = 'block';
                    this.textContent = '댓글 숨기기';
                } else {
                    target.style.display = 'none';
                    this.textContent = '댓글 보기';
                }
            }
        });
    });
}

// 자동 저장 기능 (로컬 스토리지 사용)
function setupAutoSave() {
    const titleInput = document.querySelector('input[name="title"]');
    const contentTextarea = document.querySelector('textarea[name="content"]');

    if (titleInput || contentTextarea) {
        const saveKey = 'forum_draft_' + window.location.pathname;

        // 저장된 내용 복원
        const savedData = localStorage.getItem(saveKey);
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                if (titleInput && data.title && !titleInput.value) {
                    titleInput.value = data.title;
                }
                if (contentTextarea && data.content && !contentTextarea.value) {
                    contentTextarea.value = data.content;
                }

                // 복원 알림
                showAlert('임시 저장된 내용을 복원했습니다.', 'success');
            } catch (e) {
                console.error('저장된 데이터 복원 실패:', e);
            }
        }

        // 자동 저장 설정
        let saveTimeout;
        const autoSave = () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                const data = {};
                if (titleInput) data.title = titleInput.value;
                if (contentTextarea) data.content = contentTextarea.value;

                if (data.title || data.content) {
                    localStorage.setItem(saveKey, JSON.stringify(data));
                }
            }, 2000); // 2초 후 저장
        };

        if (titleInput) {
            titleInput.addEventListener('input', autoSave);
        }
        if (contentTextarea) {
            contentTextarea.addEventListener('input', autoSave);
        }

        // 폼 제출 시 임시 저장 데이터 삭제
        const form = titleInput?.closest('form') || contentTextarea?.closest('form');
        if (form) {
            form.addEventListener('submit', () => {
                localStorage.removeItem(saveKey);
            });
        }
    }
}

// 알림 메시지 표시
function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;

    // 페이지 상단에 삽입
    const main = document.querySelector('main');
    if (main) {
        main.insertBefore(alertDiv, main.firstChild);

        // 5초 후 자동 제거
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.parentNode.removeChild(alertDiv);
            }
        }, 5000);
    }
}

// AJAX 요청 헬퍼 함수
async function apiRequest(url, options = {}) {
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '요청 처리 중 오류가 발생했습니다.');
        }

        return data;
    } catch (error) {
        console.error('API 요청 오류:', error);
        showAlert(error.message, 'error');
        throw error;
    }
}

// 댓글 작성 함수 (AJAX)
async function submitComment(postId, content) {
    try {
        const data = await apiRequest(`/forum/comment/${postId}`, {
            method: 'POST',
            body: JSON.stringify({ content })
        });

        showAlert('댓글이 작성되었습니다.', 'success');

        // 페이지 새로고침 또는 댓글 목록 업데이트
        setTimeout(() => {
            window.location.reload();
        }, 1000);

        return data;
    } catch (error) {
        // 에러는 apiRequest에서 처리됨
        return null;
    }
}

// 전역 함수로 내보내기
window.forumUtils = {
    showAlert,
    apiRequest,
    submitComment
};
//
 Alpine.js 글로벌 스토어 설정
document.addEventListener('alpine:init', () => {
    // 전역 상태 관리
    Alpine.store('app', {
        loading: false,
        alerts: [],

        setLoading(state) {
            this.loading = state;
        },

        addAlert(message, type = 'info', duration = 5000) {
            const alert = {
                id: Date.now(),
                message,
                type,
                show: true
            };

            this.alerts.push(alert);

            // 자동 제거
            if (duration > 0) {
                setTimeout(() => {
                    this.removeAlert(alert.id);
                }, duration);
            }

            return alert.id;
        },

        removeAlert(id) {
            const index = this.alerts.findIndex(alert => alert.id === id);
            if (index > -1) {
                this.alerts[index].show = false;
                setTimeout(() => {
                    this.alerts.splice(index, 1);
                }, 300); // 트랜지션 시간
            }
        },

        clearAlerts() {
            this.alerts.forEach(alert => {
                alert.show = false;
            });
            setTimeout(() => {
                this.alerts = [];
            }, 300);
        }
    });

    // 포럼 관련 기능
    Alpine.store('forum', {
        currentSort: 'created_at',
        currentPage: 1,
        searchQuery: '',

        setSortOption(sort) {
            this.currentSort = sort;
        },

        setPage(page) {
            this.currentPage = page;
        },

        setSearchQuery(query) {
            this.searchQuery = query;
        }
    });
});

// Alpine.js 매직 프로퍼티 추가
document.addEventListener('alpine:init', () => {
    Alpine.magic('api', () => {
        return {
            async request(url, options = {}) {
                Alpine.store('app').setLoading(true);

                try {
                    const response = await fetch(url, {
                        headers: {
                            'Content-Type': 'application/json',
                            ...options.headers
                        },
                        ...options
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        throw new Error(data.error || '요청 처리 중 오류가 발생했습니다.');
                    }

                    return data;
                } catch (error) {
                    Alpine.store('app').addAlert(error.message, 'error');
                    throw error;
                } finally {
                    Alpine.store('app').setLoading(false);
                }
            },

            async submitComment(postId, content) {
                return this.request(`/forum/comment/${postId}`, {
                    method: 'POST',
                    body: JSON.stringify({ content })
                });
            },

            async deleteComment(commentId) {
                return this.request(`/comment/${commentId}/delete`, {
                    method: 'DELETE'
                });
            },

            async votePost(postId, voteType) {
                return this.request(`/post/${postId}/vote`, {
                    method: 'POST',
                    body: JSON.stringify({ type: voteType })
                });
            }
        };
    });
});

// 유틸리티 함수들
const ForumUtils = {
    // 날짜 포맷팅
    formatDate(dateString, options = {}) {
        const date = new Date(dateString);
        const defaultOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };

        return date.toLocaleDateString('ko-KR', { ...defaultOptions, ...options });
    },

    // 상대 시간 표시
    timeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        const intervals = [
            { label: '년', seconds: 31536000 },
            { label: '개월', seconds: 2592000 },
            { label: '일', seconds: 86400 },
            { label: '시간', seconds: 3600 },
            { label: '분', seconds: 60 }
        ];

        for (const interval of intervals) {
            const count = Math.floor(diffInSeconds / interval.seconds);
            if (count > 0) {
                return `${count}${interval.label} 전`;
            }
        }

        return '방금 전';
    },

    // 텍스트 길이 제한
    truncateText(text, maxLength = 100) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    },

    // HTML 이스케이프
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // 쿼리 스트링 파싱
    parseQueryString(queryString = window.location.search) {
        const params = new URLSearchParams(queryString);
        const result = {};
        for (const [key, value] of params) {
            result[key] = value;
        }
        return result;
    },

    // URL 업데이트 (히스토리 API 사용)
    updateUrl(params, replaceState = false) {
        const url = new URL(window.location);

        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
                url.searchParams.set(key, params[key]);
            } else {
                url.searchParams.delete(key);
            }
        });

        if (replaceState) {
            window.history.replaceState({}, '', url);
        } else {
            window.history.pushState({}, '', url);
        }
    },

    // 로컬 스토리지 헬퍼
    storage: {
        get(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (error) {
                console.error('로컬 스토리지 읽기 오류:', error);
                return defaultValue;
            }
        },

        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (error) {
                console.error('로컬 스토리지 쓰기 오류:', error);
                return false;
            }
        },

        remove(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (error) {
                console.error('로컬 스토리지 삭제 오류:', error);
                return false;
            }
        }
    }
};

// 전역 객체에 추가
window.ForumUtils = ForumUtils;

// 키보드 단축키 설정
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + K: 검색 포커스
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="search"], input[name="query"]');
        if (searchInput) {
            searchInput.focus();
        }
    }

    // ESC: 모달/드롭다운 닫기
    if (e.key === 'Escape') {
        // 열린 details 요소들 닫기
        document.querySelectorAll('details[open]').forEach(details => {
            details.removeAttribute('open');
        });
    }
});

// 페이지 가시성 API 사용 (탭 전환 감지)
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
        // 페이지가 다시 보일 때 실행할 코드
        console.log('페이지가 활성화됨');
    } else {
        // 페이지가 숨겨질 때 실행할 코드
        console.log('페이지가 비활성화됨');
    }
});

// 서비스 워커 등록 (PWA 지원 준비)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                console.log('ServiceWorker 등록 성공:', registration.scope);
            })
            .catch(function(error) {
                console.log('ServiceWorker 등록 실패:', error);
            });
    });
}

// 개발 모드에서만 실행되는 코드
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('개발 모드에서 실행 중');

    // 개발용 단축키
    document.addEventListener('keydown', function(e) {
        // Ctrl + Shift + D: 개발자 정보 표시
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            console.log('Alpine.js 스토어:', Alpine.store('app'), Alpine.store('forum'));
            console.log('현재 URL 파라미터:', ForumUtils.parseQueryString());
        }
    });
}