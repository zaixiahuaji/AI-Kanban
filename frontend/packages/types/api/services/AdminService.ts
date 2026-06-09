/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AdminStats } from '../models/AdminStats';
import type { AdminStatsTrend } from '../models/AdminStatsTrend';
import type { AdminUserDetail } from '../models/AdminUserDetail';
import type { AdminUserUpdate } from '../models/AdminUserUpdate';
import type { HealthCheck } from '../models/HealthCheck';
import type { PaginatedAdminTaskListList } from '../models/PaginatedAdminTaskListList';
import type { PaginatedAdminUserListList } from '../models/PaginatedAdminUserListList';
import type { PatchedAdminUserUpdate } from '../models/PatchedAdminUserUpdate';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class AdminService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * 系统健康检查
     * @returns HealthCheck
     * @throws ApiError
     */
    public adminHealthRetrieve(): CancelablePromise<HealthCheck> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/admin/health/',
        });
    }
    /**
     * 全局统计聚合数据
     * @returns AdminStats
     * @throws ApiError
     */
    public adminStatsRetrieve(): CancelablePromise<AdminStats> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/admin/stats/',
        });
    }
    /**
     * 注册与任务创建趋势
     * @param days
     * @returns AdminStatsTrend
     * @throws ApiError
     */
    public adminStatsTrendRetrieve(
        days: number = 30,
    ): CancelablePromise<AdminStatsTrend> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/admin/stats/trend/',
            query: {
                'days': days,
            },
        });
    }
    /**
     * 全局任务列表（含搜索和多维筛选）
     * @param page A page number within the paginated result set.
     * @param pageSize Number of results to return per page.
     * @returns PaginatedAdminTaskListList
     * @throws ApiError
     */
    public adminTasksList(
        page?: number,
        pageSize?: number,
    ): CancelablePromise<PaginatedAdminTaskListList> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/admin/tasks/',
            query: {
                'page': page,
                'page_size': pageSize,
            },
        });
    }
    /**
     * 管理员永久删除任务（硬删除）
     * @param id
     * @returns void
     * @throws ApiError
     */
    public adminTasksDestroy(
        id: string,
    ): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/admin/tasks/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * 用户列表（含搜索和状态筛选）
     * @param page A page number within the paginated result set.
     * @param pageSize Number of results to return per page.
     * @returns PaginatedAdminUserListList
     * @throws ApiError
     */
    public adminUsersList(
        page?: number,
        pageSize?: number,
    ): CancelablePromise<PaginatedAdminUserListList> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/admin/users/',
            query: {
                'page': page,
                'page_size': pageSize,
            },
        });
    }
    /**
     * 用户详情 / 修改状态 / 删除用户
     * @param id
     * @returns AdminUserDetail
     * @throws ApiError
     */
    public adminUsersRetrieve(
        id: number,
    ): CancelablePromise<AdminUserDetail> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/admin/users/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * 用户详情 / 修改状态 / 删除用户
     * @param id
     * @param requestBody
     * @returns AdminUserUpdate
     * @throws ApiError
     */
    public adminUsersUpdate(
        id: number,
        requestBody?: AdminUserUpdate,
    ): CancelablePromise<AdminUserUpdate> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/api/admin/users/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * 用户详情 / 修改状态 / 删除用户
     * @param id
     * @param requestBody
     * @returns AdminUserDetail
     * @throws ApiError
     */
    public adminUsersPartialUpdate(
        id: number,
        requestBody?: PatchedAdminUserUpdate,
    ): CancelablePromise<AdminUserDetail> {
        return this.httpRequest.request({
            method: 'PATCH',
            url: '/api/admin/users/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * 用户详情 / 修改状态 / 删除用户
     * @param id
     * @returns void
     * @throws ApiError
     */
    public adminUsersDestroy(
        id: number,
    ): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/admin/users/{id}/',
            path: {
                'id': id,
            },
        });
    }
}
