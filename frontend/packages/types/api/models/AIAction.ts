/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { StatusEnum } from './StatusEnum';
/**
 * AI 操作记录序列化器
 */
export type AIAction = {
    readonly id: string;
    readonly tool_name: string;
    readonly tool_args: any;
    readonly status: StatusEnum;
    readonly result: any;
    readonly created_at: string;
};

