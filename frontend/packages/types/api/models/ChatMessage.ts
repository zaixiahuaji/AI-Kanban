/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AIAction } from './AIAction';
import type { RoleEnum } from './RoleEnum';
/**
 * 聊天消息序列化器（含关联操作）
 */
export type ChatMessage = {
    readonly id: string;
    readonly role: RoleEnum;
    readonly content: string;
    readonly created_at: string;
    readonly actions: Array<AIAction>;
};

