export class TapdClient {
  private authHeader: string;
  private baseUrl: string;

  private constructor(authHeader: string, baseUrl?: string) {
    this.authHeader = authHeader;
    this.baseUrl = baseUrl ?? process.env.TAPD_API_BASE_URL ?? 'https://api.tapd.cn';
  }

  static fromAccessToken(accessToken: string, baseUrl?: string): TapdClient {
    return new TapdClient(`Bearer ${accessToken}`, baseUrl);
  }

  static fromBasicAuth(apiUser: string, apiPassword: string, baseUrl?: string): TapdClient {
    const credentials = `${apiUser}:${apiPassword}`;
    return new TapdClient(`Basic ${Buffer.from(credentials).toString('base64')}`, baseUrl);
  }

  static fromEnv(): TapdClient {
    const apiUser = process.env.TAPD_API_USER;
    const apiPassword = process.env.TAPD_API_PASSWORD;
    const accessToken = process.env.TAPD_ACCESS_TOKEN;
    const baseUrl = process.env.TAPD_API_BASE_URL;

    if (apiUser && apiPassword) {
      return TapdClient.fromBasicAuth(apiUser, apiPassword, baseUrl);
    }

    if (accessToken) {
      return TapdClient.fromAccessToken(accessToken, baseUrl);
    }

    throw new Error(
      'Authentication required. Set TAPD_ACCESS_TOKEN or (TAPD_API_USER + TAPD_API_PASSWORD) environment variables.'
    );
  }

  /**
   * Get user nickname from environment variable TAPD_NICK_NAME
   * Used as default value for owner/creator/current_user parameters
   */
  static getNickName(): string | undefined {
    return process.env.TAPD_NICK_NAME;
  }

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
      // Filter out undefined values and check if there are any params left
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
      // Try to get error message from response body
      const errorText = await response.text();
      throw new Error(`TAPD API error: ${response.status} ${response.statusText} - ${errorText.slice(0, 200)}`);
    }

    // Check if response is JSON
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

  async get<T>(path: string, params?: Record<string, string | number | boolean>): Promise<T> {
    return this.request<T>('GET', path, params);
  }

  async post<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>('POST', path, params);
  }
}

export interface TapdResponse<T> {
  status: number;
  data: T;
  info: string;
}