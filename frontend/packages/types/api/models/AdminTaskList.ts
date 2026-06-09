/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AdminUserBrief } from './AdminUserBrief';
import type { PriorityEnum } from './PriorityEnum';
import type { TagBrief } from './TagBrief';
export type AdminTaskList = {
    readonly id: string;
    title: string;
    status?: string;
    priority?: PriorityEnum;
    created_by: AdminUserBrief;
    tags: Array<TagBrief>;
    is_deleted?: boolean;
    readonly created_at: string;
};

