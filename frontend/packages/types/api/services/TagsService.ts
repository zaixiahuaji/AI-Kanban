/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PaginatedTagList } from '../models/PaginatedTagList';
import type { PatchedTag } from '../models/PatchedTag';
import type { Tag } from '../models/Tag';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class TagsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * @param page A page number within the paginated result set.
     * @returns PaginatedTagList
     * @throws ApiError
     */
    public tagsList(
        page?: number,
    ): CancelablePromise<PaginatedTagList> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/tags/',
            query: {
                'page': page,
            },
        });
    }
    /**
     * @param requestBody
     * @returns Tag
     * @throws ApiError
     */
    public tagsCreate(
        requestBody: Tag,
    ): CancelablePromise<Tag> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/tags/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns Tag
     * @throws ApiError
     */
    public tagsRetrieve(
        id: string,
    ): CancelablePromise<Tag> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/tags/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns Tag
     * @throws ApiError
     */
    public tagsUpdate(
        id: string,
        requestBody: Tag,
    ): CancelablePromise<Tag> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/api/tags/{id}/',
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
     * @returns Tag
     * @throws ApiError
     */
    public tagsPartialUpdate(
        id: string,
        requestBody?: PatchedTag,
    ): CancelablePromise<Tag> {
        return this.httpRequest.request({
            method: 'PATCH',
            url: '/api/tags/{id}/',
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
    public tagsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/tags/{id}/',
            path: {
                'id': id,
            },
        });
    }
}
