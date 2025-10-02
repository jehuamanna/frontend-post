export type Tab = {
  id: string;
  name: string;
  inputs: {
    requestType: 'fetch' | 'curl';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: Record<string, any>; // can refine later
    editorLeft?: string;
    editorRight?: string;
  };
  outputs: {
    statusCode?: number;
  };
};
