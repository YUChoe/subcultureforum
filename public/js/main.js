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