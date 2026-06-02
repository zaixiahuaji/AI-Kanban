/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PriorityEnum } from './PriorityEnum';
import type { StatusEnum } from './StatusEnum';
export type TaskUpdate = {
    title: string;
    description?: string;
    status?: StatusEnum;
    priority?: PriorityEnum;
    due_date?: string | null;
    tags?: Array<string>;
};

