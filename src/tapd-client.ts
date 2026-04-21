export class TapdClient {
  private authHeader: string;
  private baseUrl: string;

  private constructor(authHeader: string) {
    this.authHeader = authHeader;
    this.baseUrl = 'https://api.tapd.cn';
  }

  static fromAccessToken(accessToken: string): TapdClient {
    return new TapdClient(`Bearer ${accessToken}`);
  }

  static fromBasicAuth(apiUser: string, apiPassword: string): TapdClient {
    const credentials = `${apiUser}:${apiPassword}`;
    return new TapdClient(`Basic ${Buffer.from(credentials).toString('base64')}`);
  }

  static fromEnv(): TapdClient {
    const apiUser = process.env.TAPD_API_USER;
    const apiPassword = process.env.TAPD_API_PASSWORD;
    const accessToken = process.env.TAPD_ACCESS_TOKEN;

    if (apiUser && apiPassword) {
      return TapdClient.fromBasicAuth(apiUser, apiPassword);
    }

    if (accessToken) {
      return TapdClient.fromAccessToken(accessToken);
    }

    throw new Error(
      'Authentication required. Set TAPD_ACCESS_TOKEN or (TAPD_API_USER + TAPD_API_PASSWORD) environment variables.'
    );
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
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    } else if (method === 'POST' && params) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(
        Object.entries(params)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)])
      ).toString();
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(`TAPD API error: ${response.status} ${response.statusText}`);
    }

    const result: TapdResponse<T> = await response.json();

    if (result.status !== 1) {
      throw new Error(`TAPD API error: ${result.info || 'Unknown error'}`);
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
