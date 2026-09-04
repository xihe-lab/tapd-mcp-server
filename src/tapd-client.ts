/**
 * TAPD API Client
 *
 * Supports dual authentication modes:
 * - Basic Auth: using api_user + api_password
 * - OAuth/Bearer Token: using access_token
 *
 * Uses custom HTTP client for all API calls.
 */
export class TapdClient {
  private authHeader: string;
  private baseUrl: string;
  private authType: 'basic' | 'oauth';
  private apiUser?: string;
  private apiPassword?: string;

  private constructor(
    authHeader: string,
    baseUrl?: string,
    authType?: 'basic' | 'oauth',
    apiUser?: string,
    apiPassword?: string
  ) {
    this.authHeader = authHeader;
    this.baseUrl = baseUrl ?? process.env.TAPD_API_BASE_URL ?? 'https://api.tapd.cn';
    this.authType = authType ?? 'basic';
    this.apiUser = apiUser;
    this.apiPassword = apiPassword;
  }

  /**
   * Create client from OAuth access token
   */
  static fromAccessToken(accessToken: string, baseUrl?: string): TapdClient {
    return new TapdClient(`Bearer ${accessToken}`, baseUrl, 'oauth');
  }

  /**
   * Create client from Basic Auth credentials
   */
  static fromBasicAuth(apiUser: string, apiPassword: string, baseUrl?: string): TapdClient {
    const credentials = `${apiUser}:${apiPassword}`;
    return new TapdClient(
      `Basic ${Buffer.from(credentials).toString('base64')}`,
      baseUrl,
      'basic',
      apiUser,
      apiPassword
    );
  }

  /**
   * Create client from environment variables
   * Priority: TAPD_ACCESS_TOKEN > (TAPD_API_USER + TAPD_API_PASSWORD)
   */
  static fromEnv(): TapdClient {
    const apiUser = process.env.TAPD_API_USER;
    const apiPassword = process.env.TAPD_API_PASSWORD;
    const accessToken = process.env.TAPD_ACCESS_TOKEN;
    const baseUrl = process.env.TAPD_API_BASE_URL;

    if (accessToken) {
      return TapdClient.fromAccessToken(accessToken, baseUrl);
    }

    if (apiUser && apiPassword) {
      return TapdClient.fromBasicAuth(apiUser, apiPassword, baseUrl);
    }

    throw new Error(
      'Authentication required. Set TAPD_ACCESS_TOKEN or (TAPD_API_USER + TAPD_API_PASSWORD) environment variables.'
    );
  }

  /**
   * Get user nickname from environment variable TAPD_NICK_NAME
   */
  static getNickName(): string | undefined {
    return process.env.TAPD_NICK_NAME;
  }

  /**
   * Get default workspace ID from environment variable TAPD_DEFAULT_WORKSPACE_ID
   */
  static getDefaultWorkspaceId(): number | undefined {
    const id = process.env.TAPD_DEFAULT_WORKSPACE_ID;
    return id ? parseInt(id, 10) : undefined;
  }

  /**
   * Get default STORY workitem type ID from environment variable
   */
  static getDefaultStoryWorkitemTypeId(): string | undefined {
    return process.env.TAPD_DEFAULT_STORY_WORKITEM_TYPE_ID;
  }

  /**
   * Get default TASK workitem type ID from environment variable
   */
  static getDefaultTaskWorkitemTypeId(): string | undefined {
    return process.env.TAPD_DEFAULT_TASK_WORKITEM_TYPE_ID;
  }

  /**
   * Convert short ID to long ID
   *
   * Rules:
   * - Pure numeric ID with ≤9 digits is treated as short ID
   * - For cloud environment (is_cloud=true), prefix is '11'
   * - Pad short ID to 9 digits and concatenate with workspace_id
   * - Non-short IDs are returned unchanged
   *
   * @param id - Story/bug/task ID (short or long format)
   * @param workspaceId - Workspace ID for constructing long ID
   * @param isCloud - Whether it's cloud environment (default: true)
   */
  static toLongId(id: string | number, workspaceId: string | number, isCloud = true): string {
    const idStr = String(id).trim();
    const workspaceIdStr = String(workspaceId);

    // Check if it's a pure numeric short ID (≤9 digits)
    if (/^\d+$/.test(idStr) && idStr.length <= 9) {
      const prefix = isCloud ? '11' : '10';
      const paddedId = idStr.padStart(9, '0');
      return `${prefix}${workspaceIdStr}${paddedId}`;
    }

    return idStr;
  }

  /**
 * Make HTTP request to TAPD API with retry support
 *
 * Retry policy:
 * - Retry on 429/500/502/503 status codes
 * - Max 3 retries with exponential backoff (1s, 2s, 4s)
 * - POST requests do NOT retry (avoid duplicate creation)
 */
  async request<T>(
    method: 'GET' | 'POST',
    path: string,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);

    const headers: HeadersInit = {
      'Authorization': this.authHeader,
    };

    let body: string | undefined;

    if (method === 'GET' && params) {
      const filteredParams = Object.entries(params).filter(([, value]) => value !== undefined);
      for (const [key, value] of filteredParams) {
        url.searchParams.append(key, String(value));
      }
    } else if (method === 'POST' && params) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(
        Object.entries(params)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value).replace(/\\n/g, '\n')])
      ).toString();
    }

    // Retry configuration
    const maxRetries = 3;
    const retryableStatusCodes = [429, 500, 502, 503];
    const shouldRetry = method === 'GET'; // Only retry GET requests

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url.toString(), {
          method,
          headers,
          body,
        });

        if (!response.ok) {
          const errorText = await response.text();
          const error = new Error(`TAPD API error: ${response.status} ${response.statusText} - ${errorText.slice(0, 200)}`);

          // Check if we should retry
          if (shouldRetry && retryableStatusCodes.includes(response.status) && attempt < maxRetries) {
            lastError = error;
            const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue;
          }
          throw error;
        }

        const contentType = response.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          const text = await response.text();
          throw new Error(`TAPD API returned non-JSON response: ${text.slice(0, 100)}`);
        }

        const result = await response.json() as TapdResponse<T>;

        if (result.status !== 1) {
          throw new Error(`TAPD API error: ${result.info ?? 'Unknown error'}`);
        }

        return result.data;
      } catch (error) {
        // For non-retryable errors or final attempt, throw immediately
        if (!shouldRetry || attempt >= maxRetries) {
          throw error;
        }

        // For network errors, retry
        lastError = error instanceof Error ? error : new Error(String(error));
        const delayMs = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // All retries exhausted
    throw lastError ?? new Error('Request failed after all retries');
  }

  /**
   * GET request to TAPD API
   */
  async get<T>(path: string, params?: Record<string, string | number | boolean>): Promise<T> {
    return this.request<T>('GET', path, params);
  }

  /**
   * POST request to TAPD API
   */
  async post<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>('POST', path, params);
  }
}

/**
 * TAPD API response structure
 */
export interface TapdResponse<T> {
  status: number;
  data: T;
  info: string;
}