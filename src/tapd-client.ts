import SDK from '@opentapd/tapd-node-sdk';
import fs from 'fs';

/**
 * TAPD API Client
 *
 * Supports dual authentication modes:
 * - Basic Auth: using api_user + api_password
 * - OAuth/Bearer Token: using access_token
 *
 * Provides two ways to call API:
 * - callSdk(): use official TAPD Node SDK (recommended)
 * - get/post(): use custom HTTP client (fallback)
 */
export class TapdClient {
  private authHeader: string;
  private baseUrl: string;
  private sdk: SDK | null = null;
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
   * Get or create SDK instance (lazy initialization)
   */
  getSdk(): SDK {
    if (!this.sdk) {
      if (this.authType === 'oauth') {
        const token = this.authHeader.replace('Bearer ', '');
        this.sdk = new SDK({
          client: '',
          secret: '',
          accessToken: token,
          address: this.baseUrl,
        });
      } else {
        this.sdk = new SDK({
          client: this.apiUser ?? process.env.TAPD_API_USER ?? '',
          secret: this.apiPassword ?? process.env.TAPD_API_PASSWORD ?? '',
          address: this.baseUrl,
        });
      }
    }
    return this.sdk;
  }

  /**
   * Call SDK method directly, returns data portion of response
   */
  async callSdk<T>(methodName: string, params?: Record<string, unknown>): Promise<T> {
    const sdk = this.getSdk();
    const method = sdk[methodName as keyof SDK];

    if (typeof method !== 'function') {
      throw new Error(`SDK method "${methodName}" not found`);
    }

    // Call SDK method dynamically - type assertion for dynamic method call
    type SdkMethod = (p?: Record<string, unknown>) => Promise<TapdResponse<T>>;
    const sdkMethod = method as SdkMethod;
    const result = await sdkMethod(params);

    if (result.status !== 200 && result.status !== 1) {
      throw new Error(`TAPD API error: ${result.info ?? 'Unknown error'}`);
    }

    return result.data;
  }

  /**
   * Upload file using SDK
   */
  async uploadFile(
    type: 'image' | 'attachment',
    params: {
      workspace_id: string | number;
      file: string | fs.ReadStream;
      filename?: string;
    }
  ): Promise<unknown> {
    const sdk = this.getSdk();

    const fileStream = typeof params.file === 'string'
      ? fs.createReadStream(params.file)
      : params.file;

    if (type === 'image') {
      return sdk.uploadImage({
        workspace_id: params.workspace_id,
        image: fileStream,
      });
    }

    return sdk.uploadAttachment({
      workspace_id: params.workspace_id,
      filename: params.filename ?? 'attachment',
      file: fileStream,
    });
  }

  // ============ Original HTTP Client Methods (Fallback) ============

  /**
   * Make HTTP request to TAPD API
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

    const response = await fetch(url.toString(), {
      method,
      headers,
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TAPD API error: ${response.status} ${response.statusText} - ${errorText.slice(0, 200)}`);
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