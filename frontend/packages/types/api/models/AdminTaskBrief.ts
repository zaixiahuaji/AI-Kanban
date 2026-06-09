/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TagBrief } from './TagBrief';
/**
 * 用户详情中的简要任务信息
 */
export type AdminTaskBrief = {
    id: string;
    title: string;
    status: string;
    priority: string;
    tags: Array<TagBrief>;
    created_at: string;
};

