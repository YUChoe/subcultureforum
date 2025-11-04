const DatabaseManagerSingleton = require('./DatabaseManager');
const AuthService = require('./AuthService');

class AdminService {
    constructor() {
        this.dbManager = DatabaseManagerSingleton.getInstance();
        this.authService = new AuthService();
    }

    /**
     * 새 포럼 카테고리 생성
     * @param {number} adminUserId - 관리자 사용자 ID
     * @param {Object} categoryData - 카테고리 정보
     * @param {string} categoryData.name - 카테고리 이름
     * @param {string} categoryData.description - 카테고리 설명
     * @param {number} categoryData.displayOrder - 표시 순서
     * @returns {Promise<Object>} 생성된 카테고리 정보
     */
    async createCategory(adminUserId, categoryData) {
        // 관리자 권한 확인
        const hasPermission = await this.authService.checkPermission(adminUserId, 'admin_site');
        if (!hasPermission) {
            throw new Error('카테고리 생성 권한이 없습니다.');
        }

        const { name, description, displayOrder = 0 } = categoryData;

        if (!name || name.trim().length === 0) {
            throw new Error('카테고리 이름이 필요합니다.');
        }

        if (name.trim().length > 100) {
            throw new Error('카테고리 이름은 100자를 초과할 수 없습니다.');
        }

        try {
            // 중복 이름 확인
            const configDB = this.dbManager.getConfigDB();
            const existingCategory = await this.dbManager.getQuery(
                configDB,
                'SELECT id FROM categories WHERE name = ? AND is_active = 1',
                [name.trim()]
            );

            if (existingCategory) {
                throw new Error('이미 존재하는 카테고리 이름입니다.');
            }

            // 카테고리 생성 (DatabaseManager의 메서드 사용)
            const category = await this.dbManager.createNewForumCategory({
                name: name.trim(),
                description: description?.trim() || '',
                displayOrder: displayOrder
            });

            // 활동 로그 기록
            await this.authService.logUserActivity(
                adminUserId,
                'category_created',
                `카테고리 생성: ${category.name} (ID: ${category.id})`
            );

            console.log(`카테고리 생성 완료: ${category.name} (관리자: ${adminUserId})`);
            return category;

        } catch (error) {
            console.error('카테고리 생성 실패:', error);
            throw error;
        }
    }

    /**
     * 포럼 카테고리 수정
     * @param {number} adminUserId - 관리자 사용자 ID
     * @param {number} categoryId - 카테고리 ID
     * @param {Object} updateData - 수정할 데이터
     * @returns {Promise<Object>} 수정된 카테고리 정보
     */
    async updateCategory(adminUserId, categoryId, updateData) {
        // 관리자 권한 확인
        const hasPermission = await this.authService.checkPermission(adminUserId, 'admin_site');
        if (!hasPermission) {
            throw new Error('카테고리 수정 권한이 없습니다.');
        }

        if (!categoryId) {
            throw new Error('카테고리 ID가 필요합니다.');
        }

        try {
            const configDB = this.dbManager.getConfigDB();

            // 기존 카테고리 확인
            const existingCategory = await this.dbManager.getQuery(
                configDB,
                'SELECT * FROM categories WHERE id = ? AND is_active = 1',
                [categoryId]
            );

            if (!existingCategory) {
                throw new Error('카테고리를 찾을 수 없습니다.');
            }

            // 수정할 필드 준비
            const updates = {};
            const params = [];
            const setParts = [];

            if (updateData.name !== undefined) {
                if (!updateData.name || updateData.name.trim().length === 0) {
                    throw new Error('카테고리 이름이 필요합니다.');
                }
                if (updateData.name.trim().length > 100) {
                    throw new Error('카테고리 이름은 100자를 초과할 수 없습니다.');
                }

                // 중복 이름 확인 (자기 자신 제외)
                const duplicateCheck = await this.dbManager.getQuery(
                    configDB,
                    'SELECT id FROM categories WHERE name = ? AND id != ? AND is_active = 1',
                    [updateData.name.trim(), categoryId]
                );

                if (duplicateCheck) {
                    throw new Error('이미 존재하는 카테고리 이름입니다.');
                }

                updates.name = updateData.name.trim();
                setParts.push('name = ?');
                params.push(updates.name);
            }

            if (updateData.description !== undefined) {
                updates.description = updateData.description?.trim() || '';
                setParts.push('description = ?');
                params.push(updates.description);
            }

            if (updateData.displayOrder !== undefined) {
                updates.displayOrder = parseInt(updateData.displayOrder) || 0;
                setParts.push('display_order = ?');
                params.push(updates.displayOrder);
            }

            if (setParts.length === 0) {
                throw new Error('수정할 데이터가 없습니다.');
            }

            // 업데이트 실행
            setParts.push('updated_at = CURRENT_TIMESTAMP');
            params.push(categoryId);

            await this.dbManager.runQuery(
                configDB,
                `UPDATE categories SET ${setParts.join(', ')} WHERE id = ?`,
                params
            );

            // 수정된 카테고리 정보 조회
            const updatedCategory = await this.dbManager.getQuery(
                configDB,
                'SELECT * FROM categories WHERE id = ?',
                [categoryId]
            );

            // 활동 로그 기록
            const changeDetails = Object.keys(updates).map(key =>
                `${key}: ${existingCategory[key]} → ${updates[key]}`
            ).join(', ');

            await this.authService.logUserActivity(
                adminUserId,
                'category_updated',
                `카테고리 수정: ${updatedCategory.name} (${changeDetails})`
            );

            console.log(`카테고리 수정 완료: ${updatedCategory.name} (관리자: ${adminUserId})`);
            return updatedCategory;

        } catch (error) {
            console.error('카테고리 수정 실패:', error);
            throw error;
        }
    }

    /**
     * 포럼 카테고리 삭제
     * @param {number} adminUserId - 관리자 사용자 ID
     * @param {number} categoryId - 카테고리 ID
     * @returns {Promise<boolean>} 삭제 성공 여부
     */
    async deleteCategory(adminUserId, categoryId) {
        // 관리자 권한 확인
        const hasPermission = await this.authService.checkPermission(adminUserId, 'admin_site');
        if (!hasPermission) {
            throw new Error('카테고리 삭제 권한이 없습니다.');
        }

        if (!categoryId) {
            throw new Error('카테고리 ID가 필요합니다.');
        }

        try {
            const configDB = this.dbManager.getConfigDB();

            // 기존 카테고리 확인
            const existingCategory = await this.dbManager.getQuery(
                configDB,
                'SELECT * FROM categories WHERE id = ? AND is_active = 1',
                [categoryId]
            );

            if (!existingCategory) {
                throw new Error('카테고리를 찾을 수 없습니다.');
            }

            // 게시글 수 확인
            try {
                const forumDB = await this.dbManager.getForumDB(categoryId);
                const postCount = await this.dbManager.getQuery(
                    forumDB,
                    'SELECT COUNT(*) as count FROM posts WHERE category_id = ?',
                    [categoryId]
                );

                if (postCount && postCount.count > 0) {
                    throw new Error(`카테고리에 ${postCount.count}개의 게시글이 있어 삭제할 수 없습니다. 먼저 게시글을 삭제하세요.`);
                }
            } catch (error) {
                // 포럼 DB가 없는 경우는 무시 (빈 카테고리)
                if (!error.message.includes('게시글이 있어')) {
                    console.warn(`카테고리 ${categoryId} 포럼 DB 확인 실패:`, error.message);
                }
            }

            // DatabaseManager의 메서드 사용하여 삭제
            await this.dbManager.deleteForumCategory(categoryId);

            // 활동 로그 기록
            await this.authService.logUserActivity(
                adminUserId,
                'category_deleted',
                `카테고리 삭제: ${existingCategory.name} (ID: ${categoryId})`
            );

            console.log(`카테고리 삭제 완료: ${existingCategory.name} (관리자: ${adminUserId})`);
            return true;

        } catch (error) {
            console.error('카테고리 삭제 실패:', error);
            throw error;
        }
    }

    /**
     * 모든 카테고리 목록 조회 (관리자용)
     * @param {number} adminUserId - 관리자 사용자 ID
     * @param {boolean} includeInactive - 비활성 카테고리 포함 여부
     * @returns {Promise<Array>} 카테고리 목록
     */
    async getAllCategories(adminUserId, includeInactive = false) {
        // 관리자 권한 확인
        const hasPermission = await this.authService.checkPermission(adminUserId, 'admin_site');
        if (!hasPermission) {
            throw new Error('카테고리 조회 권한이 없습니다.');
        }

        try {
            const configDB = this.dbManager.getConfigDB();

            const whereClause = includeInactive ? '' : 'WHERE is_active = 1';
            const categories = await this.dbManager.allQuery(
                configDB,
                `SELECT id, name, description, display_order, is_active, created_at, updated_at
                 FROM categories
                 ${whereClause}
                 ORDER BY display_order ASC, created_at ASC`
            );

            // 각 카테고리의 통계 정보 추가
            const categoriesWithStats = await Promise.all(
                categories.map(async (category) => {
                    try {
                        const forumDB = await this.dbManager.getForumDB(category.id);

                        const postCount = await this.dbManager.getQuery(
                            forumDB,
                            'SELECT COUNT(*) as count FROM posts WHERE category_id = ?',
                            [category.id]
                        );

                        const commentCount = await this.dbManager.getQuery(
                            forumDB,
                            `SELECT COUNT(*) as count FROM comments c
                             JOIN posts p ON c.post_id = p.id
                             WHERE p.category_id = ?`,
                            [category.id]
                        );

                        return {
                            ...category,
                            post_count: postCount?.count || 0,
                            comment_count: commentCount?.count || 0
                        };
                    } catch (error) {
                        console.warn(`카테고리 ${category.id} 통계 조회 실패:`, error.message);
                        return {
                            ...category,
                            post_count: 0,
                            comment_count: 0
                        };
                    }
                })
            );

            return categoriesWithStats;

        } catch (error) {
            console.error('카테고리 목록 조회 실패:', error);
            throw error;
        }
    }

    /**
     * 카테고리 표시 순서 변경
     * @param {number} adminUserId - 관리자 사용자 ID
     * @param {Array} orderData - 순서 데이터 [{ id, displayOrder }, ...]
     * @returns {Promise<boolean>} 변경 성공 여부
     */
    async updateCategoryOrder(adminUserId, orderData) {
        // 관리자 권한 확인
        const hasPermission = await this.authService.checkPermission(adminUserId, 'admin_site');
        if (!hasPermission) {
            throw new Error('카테고리 순서 변경 권한이 없습니다.');
        }

        if (!Array.isArray(orderData) || orderData.length === 0) {
            throw new Error('순서 데이터가 필요합니다.');
        }

        try {
            const configDB = this.dbManager.getConfigDB();

            // 트랜잭션으로 처리
            const queries = orderData.map(item => ({
                sql: 'UPDATE categories SET display_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                params: [item.displayOrder, item.id]
            }));

            await this.dbManager.runTransaction(configDB, queries);

            // 활동 로그 기록
            await this.authService.logUserActivity(
                adminUserId,
                'category_order_updated',
                `카테고리 순서 변경: ${orderData.length}개 카테고리`
            );

            console.log(`카테고리 순서 변경 완료: ${orderData.length}개 (관리자: ${adminUserId})`);
            return true;

        } catch (error) {
            console.error('카테고리 순서 변경 실패:', error);
            throw error;
        }
    }

    /**
     * 사이트 통계 조회
     * @param {number} adminUserId - 관리자 사용자 ID
     * @returns {Promise<Object>} 사이트 통계
     */
    async getSiteStatistics(adminUserId) {
        // 관리자 권한 확인
        const hasPermission = await this.authService.checkPermission(adminUserId, 'admin_site');
        if (!hasPermission) {
            throw new Error('통계 조회 권한이 없습니다.');
        }

        try {
            const configDB = this.dbManager.getConfigDB();

            // 사용자 통계
            const userStats = await this.dbManager.getQuery(
                configDB,
                `SELECT
                    COUNT(*) as total_users,
                    SUM(CASE WHEN role = 'super_admin' THEN 1 ELSE 0 END) as admin_count,
                    SUM(CASE WHEN role = 'moderator' THEN 1 ELSE 0 END) as moderator_count,
                    SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as user_count
                 FROM users`
            );

            // 카테고리 통계
            const categoryStats = await this.dbManager.getQuery(
                configDB,
                'SELECT COUNT(*) as total_categories FROM categories WHERE is_active = 1'
            );

            // 전체 게시글 및 댓글 통계
            const categories = await this.dbManager.allQuery(
                configDB,
                'SELECT id FROM categories WHERE is_active = 1'
            );

            let totalPosts = 0;
            let totalComments = 0;

            for (const category of categories) {
                try {
                    const forumDB = await this.dbManager.getForumDB(category.id);

                    const postCount = await this.dbManager.getQuery(
                        forumDB,
                        'SELECT COUNT(*) as count FROM posts WHERE category_id = ?',
                        [category.id]
                    );

                    const commentCount = await this.dbManager.getQuery(
                        forumDB,
                        `SELECT COUNT(*) as count FROM comments c
                         JOIN posts p ON c.post_id = p.id
                         WHERE p.category_id = ?`,
                        [category.id]
                    );

                    totalPosts += postCount?.count || 0;
                    totalComments += commentCount?.count || 0;
                } catch (error) {
                    console.warn(`카테고리 ${category.id} 통계 조회 실패:`, error.message);
                }
            }

            // 최근 활동 (7일간)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const sevenDaysAgoStr = sevenDaysAgo.toISOString();

            const recentUsers = await this.dbManager.getQuery(
                configDB,
                'SELECT COUNT(*) as count FROM users WHERE created_at >= ?',
                [sevenDaysAgoStr]
            );

            return {
                users: {
                    total: userStats.total_users || 0,
                    admins: userStats.admin_count || 0,
                    moderators: userStats.moderator_count || 0,
                    regular_users: userStats.user_count || 0,
                    recent_signups: recentUsers.count || 0
                },
                content: {
                    categories: categoryStats.total_categories || 0,
                    posts: totalPosts,
                    comments: totalComments
                },
                activity: {
                    posts_per_category: categories.length > 0 ? Math.round(totalPosts / categories.length) : 0,
                    comments_per_post: totalPosts > 0 ? Math.round(totalComments / totalPosts) : 0
                }
            };

        } catch (error) {
            console.error('사이트 통계 조회 실패:', error);
            throw error;
        }
    }

    /**
     * 사용자 목록 조회 (관리자용)
     * @param {number} adminUserId - 관리자 사용자 ID
     * @param {Object} options - 조회 옵션
     * @returns {Promise<Object>} 사용자 목록과 페이지네이션 정보
     */
    async getUserList(adminUserId, options = {}) {
        // 관리자 권한 확인
        const hasPermission = await this.authService.checkPermission(adminUserId, 'admin_site');
        if (!hasPermission) {
            throw new Error('사용자 목록 조회 권한이 없습니다.');
        }

        const {
            page = 1,
            limit = 20,
            role = null,
            search = null,
            sortBy = 'created_at',
            sortOrder = 'DESC'
        } = options;

        try {
            const configDB = this.dbManager.getConfigDB();
            const offset = (page - 1) * limit;

            // WHERE 조건 구성
            const whereConditions = [];
            const params = [];

            if (role) {
                whereConditions.push('role = ?');
                params.push(role);
            }

            if (search) {
                whereConditions.push('(username LIKE ? OR email LIKE ?)');
                params.push(`%${search}%`, `%${search}%`);
            }

            const whereClause = whereConditions.length > 0 ?
                'WHERE ' + whereConditions.join(' AND ') : '';

            // 정렬 검증
            const validSortColumns = ['username', 'email', 'role', 'created_at'];
            const validSortOrders = ['ASC', 'DESC'];

            const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
            const safeSortOrder = validSortOrders.includes(sortOrder.toUpperCase()) ?
                sortOrder.toUpperCase() : 'DESC';

            // 사용자 목록 조회
            const users = await this.dbManager.allQuery(
                configDB,
                `SELECT id, username, email, role, created_at, updated_at
                 FROM users
                 ${whereClause}
                 ORDER BY ${safeSortBy} ${safeSortOrder}
                 LIMIT ? OFFSET ?`,
                [...params, limit, offset]
            );

            // 전체 사용자 수 조회
            const totalCountResult = await this.dbManager.getQuery(
                configDB,
                `SELECT COUNT(*) as count FROM users ${whereClause}`,
                params
            );

            const totalCount = totalCountResult?.count || 0;
            const totalPages = Math.ceil(totalCount / limit);

            return {
                users: users,
                pagination: {
                    current_page: page,
                    total_pages: totalPages,
                    total_count: totalCount,
                    limit: limit,
                    has_next: page < totalPages,
                    has_prev: page > 1
                },
                filters: {
                    role: role,
                    search: search,
                    sort_by: safeSortBy,
                    sort_order: safeSortOrder
                }
            };

        } catch (error) {
            console.error('사용자 목록 조회 실패:', error);
            throw error;
        }
    }
}

module.exports = AdminService;