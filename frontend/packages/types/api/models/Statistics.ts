/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PriorityCount } from './PriorityCount';
import type { StatusCount } from './StatusCount';
import type { TagCount } from './TagCount';
export type Statistics = {
    total: number;
    by_status: Array<StatusCount>;
    by_priority: Array<PriorityCount>;
    by_tag: Array<TagCount>;
};

