/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AdminPriorityCount } from './AdminPriorityCount';
import type { AdminStatusCount } from './AdminStatusCount';
export type AdminStats = {
    total_users: number;
    total_tasks: number;
    completed_tasks: number;
    completion_rate: number;
    active_users_today: number;
    tasks_by_status: Array<AdminStatusCount>;
    tasks_by_priority: Array<AdminPriorityCount>;
};

