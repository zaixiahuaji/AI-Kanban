/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PriorityEnum } from './PriorityEnum';
import type { TagBrief } from './TagBrief';
export type TaskDetail = {
    readonly id: string;
    title: string;
    description?: string;
    status?: string;
    priority?: PriorityEnum;
    readonly priority_display: string;
    due_date?: string | null;
    readonly is_overdue: string;
    readonly tags: Array<TagBrief>;
    readonly created_at: string;
    readonly modified_at: string;
    created_by: number;
};

