declare module 'fs' {
  const fs: {
    existsSync: (path: string) => boolean;
    readFileSync: (path: string, encoding: string) => string;
    writeFileSync: (path: string, data: string, encoding: string) => void;
    mkdirSync: (path: string, options?: { recursive?: boolean }) => void;
  };
  export default fs;
}

declare module 'path' {
  const path: {
    join: (...args: string[]) => string;
    resolve: (...args: string[]) => string;
  };
  export default path;
}

declare module 'crypto' {
  const crypto: {
    randomBytes: (size: number) => { toString: (encoding: string) => string };
    randomUUID: () => string;
    scryptSync: (password: string, salt: string, keylen: number) => { toString: (encoding: string) => string };
    pbkdf2Sync: (password: string, salt: string, iterations: number, keylen: number, digest: string) => { toString: (encoding: string) => string };
    timingSafeEqual: (a: unknown, b: unknown) => boolean;
    createHmac: (algorithm: string, key: string) => {
      update: (data: string) => {
        digest: (encoding: string) => string;
      };
    };
  };
  export default crypto;
}

declare const process: {
  env: Record<string, string | undefined>;
  cwd: () => string;
};

declare const Buffer: {
  from: (str: string, encoding?: string) => { toString: (enc?: string) => string };
};
