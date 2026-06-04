/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Statistics } from '../models/Statistics';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class StatisticsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * 当前用户的任务统计聚合数据
     * @returns Statistics
     * @throws ApiError
     */
    public statisticsRetrieve(): CancelablePromise<Statistics> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/statistics/',
        });
    }
}
