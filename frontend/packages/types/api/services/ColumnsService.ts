/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BoardColumn } from '../models/BoardColumn';
import type { PaginatedBoardColumnList } from '../models/PaginatedBoardColumnList';
import type { PatchedBoardColumn } from '../models/PatchedBoardColumn';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class ColumnsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * @param page A page number within the paginated result set.
     * @returns PaginatedBoardColumnList
     * @throws ApiError
     */
    public columnsList(
        page?: number,
    ): CancelablePromise<PaginatedBoardColumnList> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/columns/',
            query: {
                'page': page,
            },
        });
    }
    /**
     * @param requestBody
     * @returns BoardColumn
     * @throws ApiError
     */
    public columnsCreate(
        requestBody: BoardColumn,
    ): CancelablePromise<BoardColumn> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/columns/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns BoardColumn
     * @throws ApiError
     */
    public columnsRetrieve(
        id: string,
    ): CancelablePromise<BoardColumn> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/columns/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns BoardColumn
     * @throws ApiError
     */
    public columnsUpdate(
        id: string,
        requestBody: BoardColumn,
    ): CancelablePromise<BoardColumn> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/api/columns/{id}/',
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
     * @returns BoardColumn
     * @throws ApiError
     */
    public columnsPartialUpdate(
        id: string,
        requestBody?: PatchedBoardColumn,
    ): CancelablePromise<BoardColumn> {
        return this.httpRequest.request({
            method: 'PATCH',
            url: '/api/columns/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns void
     * @throws ApiError
     */
    public columnsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/columns/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param requestBody
     * @returns BoardColumn
     * @throws ApiError
     */
    public columnsReorderCreate(
        requestBody: BoardColumn,
    ): CancelablePromise<BoardColumn> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/columns/reorder/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
}
