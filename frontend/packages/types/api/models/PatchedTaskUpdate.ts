/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PriorityEnum } from './PriorityEnum';
export type PatchedTaskUpdate = {
    title?: string;
    description?: string;
    status?: string;
    priority?: PriorityEnum;
    due_date?: string | null;
    tags?: Array<string>;
};

