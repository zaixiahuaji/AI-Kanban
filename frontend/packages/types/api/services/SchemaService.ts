/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class SchemaService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * OpenApi3 schema for this API. Format can be selected via content negotiation.
     *
     * - YAML: application/vnd.oai.openapi
     * - JSON: application/vnd.oai.openapi+json
     * @param format
     * @param lang
     * @returns any
     * @throws ApiError
     */
    public schemaRetrieve(
        format?: 'json' | 'yaml',
        lang?: 'en' | 'zh-cn',
    ): CancelablePromise<Record<string, any>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/schema/',
            query: {
                'format': format,
                'lang': lang,
            },
        });
    }
}
