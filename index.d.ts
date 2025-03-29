export class TimeoutError extends Error {
    code: 'ETIMEOUT';
    id: string;
  }
  
  export class RetryError extends Error {
    attempts: number;
    finalDelay: number;
    cause: Error;
  }
  
  export function wait(ms: number): Promise<void>;
  export function waitWithId(ms: number): { id: string; promise: Promise<string> };
  export function cancelWait(id: string): boolean;