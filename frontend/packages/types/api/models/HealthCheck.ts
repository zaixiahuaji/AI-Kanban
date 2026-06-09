/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ErrorLog } from './ErrorLog';
export type HealthCheck = {
    database: string;
    total_users: number;
    active_users_today: number;
    api_version: string;
    recent_errors: Array<ErrorLog>;
};

