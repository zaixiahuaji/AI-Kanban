/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PatchedTaskUpdate } from '../models/PatchedTaskUpdate';
import type { TaskCreate } from '../models/TaskCreate';
import type { TaskDetail } from '../models/TaskDetail';
import type { TaskList } from '../models/TaskList';
import type { TaskUpdate } from '../models/TaskUpdate';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class TasksService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * @returns TaskList
     * @throws ApiError
     */
    public tasksList(): CancelablePromise<Array<TaskList>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/tasks/',
        });
    }
    /**
     * @param requestBody
     * @returns TaskCreate
     * @throws ApiError
     */
    public tasksCreate(
        requestBody: TaskCreate,
    ): CancelablePromise<TaskCreate> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/tasks/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns TaskDetail
     * @throws ApiError
     */
    public tasksRetrieve(
        id: string,
    ): CancelablePromise<TaskDetail> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/tasks/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns TaskDetail
     * @throws ApiError
     */
    public tasksUpdate(
        id: string,
        requestBody: TaskUpdate,
    ): CancelablePromise<TaskDetail> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/api/tasks/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns TaskDetail
     * @throws ApiError
     */
    public tasksPartialUpdate(
        id: string,
        requestBody?: PatchedTaskUpdate,
    ): CancelablePromise<TaskDetail> {
        return this.httpRequest.request({
            method: 'PATCH',
            url: '/api/tasks/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * 软删除
     * @param id
     * @returns void
     * @throws ApiError
     */
    public tasksDestroy(
        id: string,
    ): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/tasks/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * 永久删除
     * @param id
     * @returns void
     * @throws ApiError
     */
    public tasksPermanentDestroy(
        id: string,
    ): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/tasks/{id}/permanent/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * 从回收站恢复
     * @param id
     * @param requestBody
     * @returns TaskDetail
     * @throws ApiError
     */
    public tasksRestoreCreate(
        id: string,
        requestBody: TaskDetail,
    ): CancelablePromise<TaskDetail> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/tasks/{id}/restore/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * 回收站列表
     * @returns TaskDetail
     * @throws ApiError
     */
    public tasksTrashRetrieve(): CancelablePromise<TaskDetail> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/tasks/trash/',
        });
    }
}
