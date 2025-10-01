export type Tab = {
  id: string;
  name: string;
  inputs: {
    command: string;
    url: string;
    requestType: 'fetch' | 'curl';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: Record<string, any>; // can refine later
  };
  outputs: {
    statusCode?: number;
    body?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    headers?: Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cookies?: Record<string, any>;
  };
};
