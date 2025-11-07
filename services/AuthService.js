const bcrypt = require('bcrypt');
const DatabaseManagerSingleton = require('./DatabaseManager');

class AuthService {
    constructor() {
        this.dbManager = DatabaseManagerSingleton.getInstance();
        this.saltRounds = 12; // bcrypt salt rounds
    }

    /**
     * 사용자 등록
     * @param {Object} userData - 사용자 정보
     * @param {string} userData.username - 사용자명
     * @param {string} userData.email - 이메일
     * @param {string} userData.password - 비밀번호
     * @param {string} userData.role - 사용자 역할 (기본값: 'user')
     * @returns {Promise<Object>} 생성된 사용자 정보
     */
    async register(userData) {
        const { username, email, password, role = 'user' } = userData;

        // 입력 검증
        if (!username || !email || !password) {
            throw new Error('사용자명, 이메일, 비밀번호는 필수 항목입니다.');
        }

        if (username.trim().length < 3) {
            throw new Error('사용자명은 최소 3자 이상이어야 합니다.');
        }

        if (password.length < 6) {
            throw new Error('비밀번호는 최소 6자 이상이어야 합니다.');
        }

        // 이메일 형식 검증
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('올바른 이메일 형식이 아닙니다.');
        }

        // 역할 검증
        const validRoles = ['user', 'moderator', 'super_admin'];
        if (!validRoles.includes(role)) {
            throw new Error('올바르지 않은 사용자 역할입니다.');
        }

        try {
            const configDB = this.dbManager.getConfigDB();

            // 중복 사용자명 확인
            const existingUser = await this.dbManager.getQuery(
                configDB,
                'SELECT id FROM users WHERE username = ? OR email = ?',
                [username.trim(), email.trim()]
            );

            if (existingUser) {
                throw new Error('이미 존재하는 사용자명 또는 이메일입니다.');
            }

            // 비밀번호 해싱
            const passwordHash = await bcrypt.hash(password, this.saltRounds);

            // 사용자 생성
            const result = await this.dbManager.runQuery(
                configDB,
                `INSERT INTO users (username, email, password_hash, role, created_at, updated_at)
                 VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [username.trim(), email.trim(), passwordHash, role]
            );

            // 생성된 사용자 정보 반환 (비밀번호 해시 제외)
            const newUser = await this.dbManager.getQuery(
                configDB,
                'SELECT id, username, email, role, created_at FROM users WHERE id = ?',
                [result.id]
            );

            // 사용자 활동 로그 기록
            await this.logUserActivity(result.id, 'register', '사용자 계정 생성');

            console.log(`새 사용자 등록 완료: ${username} (ID: ${result.id})`);
            return newUser;

        } catch (error) {
            console.error('사용자 등록 실패:', error);
            throw error;
        }
    }

    /**
     * 사용자 로그인
     * @param {string} username - 사용자명 또는 이메일
     * @param {string} password - 비밀번호
     * @param {string} ipAddress - 클라이언트 IP 주소
     * @returns {Promise<Object>} 로그인된 사용자 정보
     */
    async login(username, password, ipAddress = null) {
        if (!username || !password) {
            throw new Error('사용자명과 비밀번호를 입력해주세요.');
        }

        try {
            const configDB = this.dbManager.getConfigDB();

            // 사용자 조회 (사용자명 또는 이메일로)
            const user = await this.dbManager.getQuery(
                configDB,
                'SELECT * FROM users WHERE (username = ? OR email = ?) AND id NOT IN (SELECT user_id FROM user_bans WHERE is_active = 1 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP))',
                [username.trim(), username.trim()]
            );

            if (!user) {
                throw new Error('존재하지 않는 사용자이거나 차단된 사용자입니다.');
            }

            // 비밀번호 검증
            const isPasswordValid = await bcrypt.compare(password, user.password_hash);
            if (!isPasswordValid) {
                // 로그인 실패 로그 기록
                await this.logUserActivity(user.id, 'login_failed', '잘못된 비밀번호', ipAddress);
                throw new Error('잘못된 비밀번호입니다.');
            }

            // 로그인 성공 로그 기록
            await this.logUserActivity(user.id, 'login_success', '로그인 성공', ipAddress);

            // 사용자 정보 반환 (비밀번호 해시 제외)
            const { password_hash, ...userInfo } = user;

            console.log(`사용자 로그인 성공: ${user.username} (ID: ${user.id})`);
            return userInfo;

        } catch (error) {
            console.error('로그인 실패:', error);
            throw error;
        }
    }

    /**
     * 사용자 정보 조회 (ID로)
     * @param {number} userId - 사용자 ID
     * @returns {Promise<Object|null>} 사용자 정보
     */
    async getUserById(userId) {
        if (!userId) {
            return null;
        }

        try {
            const configDB = this.dbManager.getConfigDB();

            const user = await this.dbManager.getQuery(
                configDB,
                'SELECT id, username, email, role, created_at, updated_at FROM users WHERE id = ?',
                [userId]
            );

            return user;
        } catch (error) {
            console.error('사용자 조회 실패:', error);
            return null;
        }
    }

    /**
     * 사용자 정보 조회 (사용자명으로)
     * @param {string} username - 사용자명
     * @returns {Promise<Object|null>} 사용자 정보
     */
    async getUserByUsername(username) {
        if (!username) {
            return null;
        }

        try {
            const configDB = this.dbManager.getConfigDB();

            const user = await this.dbManager.getQuery(
                configDB,
                'SELECT id, username, email, role, created_at, updated_at FROM users WHERE username = ?',
                [username.trim()]
            );

            return user;
        } catch (error) {
            console.error('사용자 조회 실패:', error);
            return null;
        }
    }

    /**
     * 비밀번호 변경
     * @param {number} userId - 사용자 ID
     * @param {string} currentPassword - 현재 비밀번호
     * @param {string} newPassword - 새 비밀번호
     * @returns {Promise<boolean>} 변경 성공 여부
     */
    async changePassword(userId, currentPassword, newPassword) {
        if (!userId || !currentPassword || !newPassword) {
            throw new Error('모든 필드를 입력해주세요.');
        }

        if (newPassword.length < 6) {
            throw new Error('새 비밀번호는 최소 6자 이상이어야 합니다.');
        }

        try {
            const configDB = this.dbManager.getConfigDB();

            // 현재 사용자 정보 조회
            const user = await this.dbManager.getQuery(
                configDB,
                'SELECT password_hash FROM users WHERE id = ?',
                [userId]
            );

            if (!user) {
                throw new Error('사용자를 찾을 수 없습니다.');
            }

            // 현재 비밀번호 검증
            const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
            if (!isCurrentPasswordValid) {
                throw new Error('현재 비밀번호가 올바르지 않습니다.');
            }

            // 새 비밀번호 해싱
            const newPasswordHash = await bcrypt.hash(newPassword, this.saltRounds);

            // 비밀번호 업데이트
            await this.dbManager.runQuery(
                configDB,
                'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newPasswordHash, userId]
            );

            // 활동 로그 기록
            await this.logUserActivity(userId, 'password_changed', '비밀번호 변경');

            console.log(`사용자 비밀번호 변경 완료: ID ${userId}`);
            return true;

        } catch (error) {
            console.error('비밀번호 변경 실패:', error);
            throw error;
        }
    }

    /**
     * 사용자 권한 확인
     * @param {number} userId - 사용자 ID
     * @param {string} action - 수행하려는 작업
     * @param {number} resourceId - 리소스 ID (카테고리 ID 등)
     * @returns {Promise<boolean>} 권한 여부
     */
    async checkPermission(userId, action, resourceId = null) {
        if (!userId) {
            return false;
        }

        try {
            const user = await this.getUserById(userId);
            if (!user) {
                return false;
            }

            // 슈퍼 관리자는 모든 권한 보유
            if (user.role === 'super_admin') {
                return true;
            }

            // 액션별 권한 검사
            switch (action) {
                case 'read_posts':
                    // 모든 사용자가 게시글 읽기 가능
                    return true;

                case 'write_posts':
                case 'write_comments':
                    // 로그인한 사용자만 작성 가능
                    return user.role !== null;

                case 'edit_own_posts':
                case 'edit_own_comments':
                    // 자신의 게시글/댓글 수정 가능
                    return user.role !== null;

                case 'moderate_category':
                    // 해당 서브포럼(카테고리)의 모더레이터이거나 슈퍼 관리자
                    if (user.role === 'super_admin') {
                        return true;
                    }

                    // 모더레이터 역할이고 특정 카테고리 ID가 제공된 경우
                    if (user.role === 'moderator' && resourceId) {
                        const isCategoryModerator = await this.isModeratorOfCategory(userId, resourceId);
                        return isCategoryModerator;
                    }

                    // 일반 모더레이터 권한 (카테고리 지정 없음)
                    if (user.role === 'moderator' && !resourceId) {
                        // 최소 하나의 카테고리에서 모더레이터 권한이 있는지 확인
                        return await this.hasAnyModeratorPermission(userId);
                    }

                    return false;

                case 'admin_site':
                    // 슈퍼 관리자만 사이트 관리 가능
                    return user.role === 'super_admin';

                case 'manage_users':
                    // 슈퍼 관리자만 사용자 관리 가능
                    return user.role === 'super_admin';

                case 'create_category':
                case 'delete_category':
                    // 슈퍼 관리자만 카테고리 생성/삭제 가능
                    return user.role === 'super_admin';

                default:
                    return false;
            }

        } catch (error) {
            console.error('권한 확인 실패:', error);
            return false;
        }
    }

    /**
     * 특정 서브포럼(카테고리)의 모더레이터인지 확인
     * @param {number} userId - 사용자 ID
     * @param {number} categoryId - 카테고리 ID
     * @returns {Promise<boolean>} 모더레이터 여부
     */
    async isModeratorOfCategory(userId, categoryId) {
        if (!userId || !categoryId) {
            return false;
        }

        try {
            const configDB = this.dbManager.getConfigDB();

            const permission = await this.dbManager.getQuery(
                configDB,
                'SELECT id FROM moderator_permissions WHERE user_id = ? AND category_id = ?',
                [userId, categoryId]
            );

            return permission !== null && permission !== undefined;
        } catch (error) {
            console.error('서브포럼 모더레이터 권한 확인 실패:', error);
            return false;
        }
    }

    /**
     * 사용자가 최소 하나의 카테고리에서 모더레이터 권한을 가지고 있는지 확인
     * @param {number} userId - 사용자 ID
     * @returns {Promise<boolean>} 모더레이터 권한 여부
     */
    async hasAnyModeratorPermission(userId) {
        if (!userId) {
            return false;
        }

        try {
            const configDB = this.dbManager.getConfigDB();

            const permission = await this.dbManager.getQuery(
                configDB,
                'SELECT id FROM moderator_permissions WHERE user_id = ? LIMIT 1',
                [userId]
            );

            return permission !== null && permission !== undefined;
        } catch (error) {
            console.error('모더레이터 권한 확인 실패:', error);
            return false;
        }
    }

    /**
     * 사용자가 모더레이터 권한을 가진 모든 카테고리 목록 조회
     * @param {number} userId - 사용자 ID
     * @returns {Promise<Array>} 카테고리 목록
     */
    async getModeratedCategories(userId) {
        if (!userId) {
            return [];
        }

        try {
            const configDB = this.dbManager.getConfigDB();

            const stmt = configDB.prepare(`
                SELECT c.id, c.name, c.description
                FROM categories c
                JOIN moderator_permissions mp ON c.id = mp.category_id
                WHERE mp.user_id = ? AND c.is_active = 1
                ORDER BY c.display_order, c.name
            `);

            const categories = stmt.all(userId);
            stmt.finalize();

            return categories || [];
        } catch (error) {
            console.error('모더레이터 카테고리 목록 조회 실패:', error);
            return [];
        }
    }

    /**
     * 사용자 역할 변경 (슈퍼 관리자만 가능)
     * @param {number} adminUserId - 관리자 사용자 ID
     * @param {number} targetUserId - 대상 사용자 ID
     * @param {string} newRole - 새 역할
     * @returns {Promise<boolean>} 변경 성공 여부
     */
    async changeUserRole(adminUserId, targetUserId, newRole) {
        // 관리자 권한 확인
        const hasPermission = await this.checkPermission(adminUserId, 'manage_users');
        if (!hasPermission) {
            throw new Error('사용자 역할 변경 권한이 없습니다.');
        }

        // 역할 검증
        const validRoles = ['user', 'moderator', 'super_admin'];
        if (!validRoles.includes(newRole)) {
            throw new Error('올바르지 않은 사용자 역할입니다.');
        }

        // 자기 자신의 역할 변경 방지
        if (adminUserId === targetUserId) {
            throw new Error('자신의 역할은 변경할 수 없습니다.');
        }

        try {
            const configDB = this.dbManager.getConfigDB();

            // 대상 사용자 존재 확인
            const targetUser = await this.getUserById(targetUserId);
            if (!targetUser) {
                throw new Error('대상 사용자를 찾을 수 없습니다.');
            }

            // 역할 업데이트
            await this.dbManager.runQuery(
                configDB,
                'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newRole, targetUserId]
            );

            // 활동 로그 기록
            await this.logUserActivity(
                targetUserId,
                'role_changed',
                `역할 변경: ${targetUser.role} -> ${newRole} (관리자: ${adminUserId})`
            );

            console.log(`사용자 역할 변경 완료: ${targetUser.username} (${targetUser.role} -> ${newRole})`);
            return true;

        } catch (error) {
            console.error('사용자 역할 변경 실패:', error);
            throw error;
        }
    }

    /**
     * 모더레이터 권한 부여
     * @param {number} adminUserId - 관리자 사용자 ID
     * @param {number} userId - 사용자 ID
     * @param {number} categoryId - 카테고리 ID
     * @returns {Promise<boolean>} 권한 부여 성공 여부
     */
    async assignModerator(adminUserId, userId, categoryId) {
        // 관리자 권한 확인
        const hasPermission = await this.checkPermission(adminUserId, 'manage_users');
        if (!hasPermission) {
            throw new Error('모더레이터 권한 부여 권한이 없습니다.');
        }

        try {
            const configDB = this.dbManager.getConfigDB();

            // 사용자와 카테고리 존재 확인
            const user = await this.getUserById(userId);
            if (!user) {
                throw new Error('사용자를 찾을 수 없습니다.');
            }

            const category = await this.dbManager.getQuery(
                configDB,
                'SELECT id FROM categories WHERE id = ?',
                [categoryId]
            );
            if (!category) {
                throw new Error('카테고리를 찾을 수 없습니다.');
            }

            // 이미 모더레이터인지 확인
            const existingPermission = await this.dbManager.getQuery(
                configDB,
                'SELECT id FROM moderator_permissions WHERE user_id = ? AND category_id = ?',
                [userId, categoryId]
            );

            if (existingPermission) {
                throw new Error('이미 해당 카테고리의 모더레이터입니다.');
            }

            // 사용자 역할을 모더레이터로 변경 (user인 경우만)
            if (user.role === 'user') {
                await this.dbManager.runQuery(
                    configDB,
                    'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    ['moderator', userId]
                );
            }

            // 모더레이터 권한 추가
            await this.dbManager.runQuery(
                configDB,
                'INSERT INTO moderator_permissions (user_id, category_id) VALUES (?, ?)',
                [userId, categoryId]
            );

            // 활동 로그 기록
            await this.logUserActivity(
                userId,
                'moderator_assigned',
                `카테고리 ${categoryId} 모더레이터 권한 부여 (관리자: ${adminUserId})`
            );

            console.log(`모더레이터 권한 부여 완료: ${user.username} -> 카테고리 ${categoryId}`);
            return true;

        } catch (error) {
            console.error('모더레이터 권한 부여 실패:', error);
            throw error;
        }
    }

    /**
     * 모더레이터 권한 제거
     * @param {number} adminUserId - 관리자 사용자 ID
     * @param {number} userId - 사용자 ID
     * @param {number} categoryId - 카테고리 ID
     * @returns {Promise<boolean>} 권한 제거 성공 여부
     */
    async removeModerator(adminUserId, userId, categoryId) {
        // 관리자 권한 확인
        const hasPermission = await this.checkPermission(adminUserId, 'manage_users');
        if (!hasPermission) {
            throw new Error('모더레이터 권한 제거 권한이 없습니다.');
        }

        try {
            const configDB = this.dbManager.getConfigDB();

            // 모더레이터 권한 존재 확인
            const permission = await this.dbManager.getQuery(
                configDB,
                'SELECT id FROM moderator_permissions WHERE user_id = ? AND category_id = ?',
                [userId, categoryId]
            );

            if (!permission) {
                throw new Error('해당 카테고리의 모더레이터가 아닙니다.');
            }

            // 모더레이터 권한 제거
            await this.dbManager.runQuery(
                configDB,
                'DELETE FROM moderator_permissions WHERE user_id = ? AND category_id = ?',
                [userId, categoryId]
            );

            // 다른 카테고리의 모더레이터 권한이 있는지 확인
            const remainingPermissions = await this.dbManager.getQuery(
                configDB,
                'SELECT COUNT(*) as count FROM moderator_permissions WHERE user_id = ?',
                [userId]
            );

            // 다른 모더레이터 권한이 없으면 역할을 user로 변경
            if (remainingPermissions.count === 0) {
                const user = await this.getUserById(userId);
                if (user && user.role === 'moderator') {
                    await this.dbManager.runQuery(
                        configDB,
                        'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                        ['user', userId]
                    );
                }
            }

            // 활동 로그 기록
            await this.logUserActivity(
                userId,
                'moderator_removed',
                `카테고리 ${categoryId} 모더레이터 권한 제거 (관리자: ${adminUserId})`
            );

            console.log(`모더레이터 권한 제거 완료: 사용자 ${userId} -> 카테고리 ${categoryId}`);
            return true;

        } catch (error) {
            console.error('모더레이터 권한 제거 실패:', error);
            throw error;
        }
    }

    /**
     * 사용자 활동 로그 기록
     * @param {number} userId - 사용자 ID
     * @param {string} action - 수행된 작업
     * @param {string} details - 상세 정보
     * @param {string} ipAddress - IP 주소
     * @returns {Promise<void>}
     */
    async logUserActivity(userId, action, details = null, ipAddress = null) {
        try {
            const configDB = this.dbManager.getConfigDB();

            await this.dbManager.runQuery(
                configDB,
                'INSERT INTO user_activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
                [userId, action, details, ipAddress]
            );
        } catch (error) {
            // 로그 기록 실패는 치명적이지 않으므로 경고만 출력
            console.warn('사용자 활동 로그 기록 실패:', error);
        }
    }

    /**
     * 사용자 차단 여부 확인
     * @param {number} userId - 사용자 ID
     * @returns {Promise<Object|null>} 차단 정보 또는 null
     */
    async getUserBanStatus(userId) {
        if (!userId) {
            return null;
        }

        try {
            const configDB = this.dbManager.getConfigDB();

            const ban = await this.dbManager.getQuery(
                configDB,
                `SELECT ub.*, u.username as banned_by_username
                 FROM user_bans ub
                 JOIN users u ON ub.banned_by = u.id
                 WHERE ub.user_id = ? AND ub.is_active = 1
                 AND (ub.expires_at IS NULL OR ub.expires_at > CURRENT_TIMESTAMP)`,
                [userId]
            );

            return ban;
        } catch (error) {
            console.error('사용자 차단 상태 확인 실패:', error);
            return null;
        }
    }

    /**
     * 사용자 차단 여부 확인 (간단한 boolean 반환)
     * @param {number} userId - 사용자 ID
     * @returns {Promise<boolean>} 차단 여부
     */
    async isUserBanned(userId) {
        const banStatus = await this.getUserBanStatus(userId);
        return banStatus !== null && banStatus !== undefined;
    }

    /**
     * 세션 검증 및 사용자 정보 반환
     * @param {Object} session - Express 세션 객체
     * @returns {Promise<Object|null>} 사용자 정보 또는 null
     */
    async validateSession(session) {
        if (!session || !session.userId) {
            return null;
        }

        try {
            // 사용자 정보 조회
            const user = await this.getUserById(session.userId);
            if (!user) {
                return null;
            }

            // 차단 상태 확인
            const banStatus = await this.getUserBanStatus(user.id);
            if (banStatus) {
                return null;
            }

            return user;
        } catch (error) {
            console.error('세션 검증 실패:', error);
            return null;
        }
    }

    /**
     * 세션 생성
     * @param {Object} session - Express 세션 객체
     * @param {Object} user - 사용자 정보
     * @returns {void}
     */
    createSession(session, user) {
        session.userId = user.id;
        session.username = user.username;
        session.role = user.role;
        session.loginTime = new Date().toISOString();
    }

    /**
     * 세션 삭제
     * @param {Object} session - Express 세션 객체
     * @returns {void}
     */
    destroySession(session) {
        if (session) {
            session.destroy((err) => {
                if (err) {
                    console.error('세션 삭제 실패:', err);
                }
            });
        }
    }

    /**
     * 사용자 차단 상태 확인
     * @param {number} userId - 사용자 ID
     * @returns {Promise<boolean>} 차단 여부
     */
    async isUserBanned(userId) {
        if (!userId) {
            return false;
        }

        try {
            const configDB = this.dbManager.getConfigDB();

            const ban = await this.dbManager.getQuery(
                configDB,
                `SELECT id, expires_at FROM user_bans
                 WHERE user_id = ? AND is_active = 1
                 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
                [userId]
            );

            return !!ban;
        } catch (error) {
            console.error('사용자 차단 상태 확인 실패:', error);
            return false;
        }
    }

    /**
     * 사용자 차단 정보 조회
     * @param {number} userId - 사용자 ID
     * @returns {Promise<Object|null>} 차단 정보
     */
    async getUserBanInfo(userId) {
        if (!userId) {
            return null;
        }

        try {
            const configDB = this.dbManager.getConfigDB();

            const ban = await this.dbManager.getQuery(
                configDB,
                `SELECT ub.*, u.username, a.username as banned_by_username
                 FROM user_bans ub
                 JOIN users u ON ub.user_id = u.id
                 JOIN users a ON ub.banned_by = a.id
                 WHERE ub.user_id = ? AND ub.is_active = 1
                 AND (ub.expires_at IS NULL OR ub.expires_at > CURRENT_TIMESTAMP)`,
                [userId]
            );

            return ban;
        } catch (error) {
            console.error('사용자 차단 정보 조회 실패:', error);
            return null;
        }
    }
}

module.exports = AuthService;