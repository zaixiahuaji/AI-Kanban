/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChatMessage } from '../models/ChatMessage';
import type { ChatRequest } from '../models/ChatRequest';
import type { DailyUsage } from '../models/DailyUsage';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class AiService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * 取消待执行操作
     * @param id
     * @returns any No response body
     * @throws ApiError
     */
    public aiActionCancel(
        id: string,
    ): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/ai/actions/{id}/cancel/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * 确认待执行操作
     * @param id
     * @returns any No response body
     * @throws ApiError
     */
    public aiActionConfirm(
        id: string,
    ): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/ai/actions/{id}/confirm/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * 撤销已执行操作
     * @param id
     * @returns any No response body
     * @throws ApiError
     */
    public aiActionUndo(
        id: string,
    ): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/ai/actions/{id}/undo/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * SSE 流式聊天
     * @param requestBody
     * @returns any No response body
     * @throws ApiError
     */
    public aiChat(
        requestBody: ChatRequest,
    ): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/ai/chat/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * 获取/清空聊天历史
     * @returns ChatMessage
     * @throws ApiError
     */
    public aiChatHistory(): CancelablePromise<Array<ChatMessage>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/ai/chat/history/',
        });
    }
    /**
     * 清空当前用户的聊天历史
     * @returns any No response body
     * @throws ApiError
     */
    public aiChatHistoryClear(): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/ai/chat/history/',
        });
    }
    /**
     * 获取今日额度
     * @returns DailyUsage
     * @throws ApiError
     */
    public aiUsage(): CancelablePromise<DailyUsage> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/ai/usage/',
        });
    }
}
