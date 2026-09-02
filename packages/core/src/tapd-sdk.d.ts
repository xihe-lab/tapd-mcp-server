declare module '@opentapd/tapd-node-sdk' {
  export interface TapdSdkOptions {
    client?: string;
    secret?: string;
    accessToken?: string;
    address?: string;
    env?: string;
    authType?: string;
    rioToken?: string;
  }

  export default class TapdSdk {
    constructor(options?: TapdSdkOptions);
  }
}
