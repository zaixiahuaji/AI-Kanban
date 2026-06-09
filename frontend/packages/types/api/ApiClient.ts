/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BaseHttpRequest } from './core/BaseHttpRequest';
import type { OpenAPIConfig } from './core/OpenAPI';
import { FetchHttpRequest } from './core/FetchHttpRequest';
import { AdminService } from './services/AdminService';
import { AiService } from './services/AiService';
import { ColumnsService } from './services/ColumnsService';
import { EmailService } from './services/EmailService';
import { SchemaService } from './services/SchemaService';
import { StatisticsService } from './services/StatisticsService';
import { TagsService } from './services/TagsService';
import { TasksService } from './services/TasksService';
import { TokenService } from './services/TokenService';
import { UsersService } from './services/UsersService';
type HttpRequestConstructor = new (config: OpenAPIConfig) => BaseHttpRequest;
export class ApiClient {
    public readonly admin: AdminService;
    public readonly ai: AiService;
    public readonly columns: ColumnsService;
    public readonly email: EmailService;
    public readonly schema: SchemaService;
    public readonly statistics: StatisticsService;
    public readonly tags: TagsService;
    public readonly tasks: TasksService;
    public readonly token: TokenService;
    public readonly users: UsersService;
    public readonly request: BaseHttpRequest;
    constructor(config?: Partial<OpenAPIConfig>, HttpRequest: HttpRequestConstructor = FetchHttpRequest) {
        this.request = new HttpRequest({
            BASE: config?.BASE ?? '',
            VERSION: config?.VERSION ?? '0.0.0',
            WITH_CREDENTIALS: config?.WITH_CREDENTIALS ?? false,
            CREDENTIALS: config?.CREDENTIALS ?? 'include',
            TOKEN: config?.TOKEN,
            USERNAME: config?.USERNAME,
            PASSWORD: config?.PASSWORD,
            HEADERS: config?.HEADERS,
            ENCODE_PATH: config?.ENCODE_PATH,
        });
        this.admin = new AdminService(this.request);
        this.ai = new AiService(this.request);
        this.columns = new ColumnsService(this.request);
        this.email = new EmailService(this.request);
        this.schema = new SchemaService(this.request);
        this.statistics = new StatisticsService(this.request);
        this.tags = new TagsService(this.request);
        this.tasks = new TasksService(this.request);
        this.token = new TokenService(this.request);
        this.users = new UsersService(this.request);
    }
}

