/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AdminTaskBrief } from './AdminTaskBrief';
export type AdminUserDetail = {
    readonly id: number;
    /**
     * Required. 150 characters or fewer. Letters, digits and @/./+/-/_ only.
     */
    username: string;
    email: string;
    /**
     * Designates whether this user should be treated as active. Unselect this instead of deleting accounts.
     */
    is_active?: boolean;
    /**
     * Designates whether the user can log into this admin site.
     */
    is_staff?: boolean;
    task_count: number;
    tag_count: number;
    column_count: number;
    date_joined?: string;
    last_login?: string | null;
    recent_tasks: Array<AdminTaskBrief>;
};

