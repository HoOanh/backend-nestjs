import type { TestCase } from '../data/curriculum.ts';
export type { TestCase };

export interface TestResultItem {
  name?: string;
  description?: string;
  passed: boolean;
  input?: string;
  expected?: string;
  actual?: string;
  received?: string;
  error?: string;
  hidden?: boolean;
}

export interface TestOutcome {
  passed: boolean;
  total: number;
  passedCount: number;
  syntaxError?: string;
  results: TestResultItem[];
  consoleLogs?: string[];
}

interface SerializedFunction {
  __kind: 'function';
  source: string;
}

type SerializedValue = null | boolean | number | string | SerializedFunction | SerializedValue[] | { [key: string]: SerializedValue };

interface WorkerRequest {
  code: string;
  testCases: SerializedValue[];
}

const WORKER_SOURCE = `
const logs = [];
const originalConsoleLog = console.log;
console.log = (...args) => {
  try {
    logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
  } catch (_) {}
  originalConsoleLog(...args);
};

const revive = (value) => {
  if (Array.isArray(value)) return value.map(revive);
  if (value && typeof value === 'object') {
    if (value.__kind === 'function') return Function('return (' + value.source + ')')();
    const output = {};
    for (const [key, item] of Object.entries(value)) output[key] = revive(item);
    return output;
  }
  return value;
};

const equal = (left, right) => {
  if (left === right) return true;
  if (left == null || right == null || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left)) return left.length === right.length && left.every((item, index) => equal(item, right[index]));
  const leftKeys = Object.keys(left).filter((key) => key !== 'timestamp' && key !== 'createdAt');
  const rightKeys = Object.keys(right).filter((key) => key !== 'timestamp' && key !== 'createdAt');
  return leftKeys.length === rightKeys.length && leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && equal(left[key], right[key]));
};

const blockNetwork = () => {
  const denied = () => Promise.reject(new Error('NETWORK_DISABLED_IN_SANDBOX'));
  try { self.fetch = denied; } catch (_) {}
  try { self.XMLHttpRequest = undefined; self.WebSocket = undefined; self.EventSource = undefined; } catch (_) {}
  try { self.importScripts = () => { throw new Error('IMPORT_DISABLED_IN_SANDBOX'); }; } catch (_) {}
};

self.onmessage = async (event) => {
  blockNetwork();
  const request = event.data;
  try {
    const cleanedCode = request.code;
    const match = cleanedCode.match(/(?:async\\s+)?(?:function\\*?|class)\\s+([A-Za-z0-9_$]+)/);
    const targetName = match ? match[1] : '';
    if (!targetName) throw new Error('Không tìm thấy hàm mục tiêu. Vui lòng giữ nguyên tên hàm như mẫu ban đầu.');
    const factory = Function(cleanedCode + '\\nreturn typeof ' + targetName + ' === "undefined" ? null : ' + targetName + ';');
    const fn = factory();
    if (!fn) throw new Error('Không tìm thấy hàm mục tiêu. Vui lòng giữ nguyên tên hàm như mẫu ban đầu.');
    const results = [];
    let passedCount = 0;
    for (const rawCase of request.testCases) {
      const testCase = revive(rawCase);
      let passed = false;
      let actual;
      let error;
      try {
        let result;
        if (typeof fn === 'function' && /^\\s*class\\s+/.test(cleanedCode)) {
          const instance = new fn();
          if (typeof instance.registerProvider === 'function') {
            instance.registerProvider(testCase.input[0], testCase.input[1]);
            result = instance.getProvider(testCase.input[0]);
          } else result = instance;
        } else result = fn(...testCase.input);
        actual = result && typeof result.then === 'function' ? await result : result;
        if (testCase.expected === 'ERROR_THROWN') error = 'Kỳ vọng ném ra lỗi nhưng hàm chạy thành công mà không báo lỗi';
        else passed = equal(actual, testCase.expected);
      } catch (caught) {
        if (testCase.expected === 'ERROR_THROWN') { passed = true; actual = 'Đã ném lỗi'; }
        else error = caught && caught.message ? caught.message : String(caught);
      }
      if (passed) passedCount++;
      const stringActual = testCase.hidden ? (passed ? '[MATCHED]' : '[FAIL]') : JSON.stringify(actual);
      results.push({
        name: testCase.name || testCase.description || 'Test case',
        description: testCase.description || testCase.name || 'Test case',
        passed,
        input: testCase.hidden ? '[HIDDEN]' : JSON.stringify(testCase.input),
        expected: testCase.hidden ? '[HIDDEN]' : JSON.stringify(testCase.expected),
        actual: stringActual,
        received: stringActual,
        error,
        hidden: Boolean(testCase.hidden)
      });
    }
    self.postMessage({
      kind: 'result',
      outcome: {
        passed: passedCount === request.testCases.length,
        total: request.testCases.length,
        passedCount,
        results,
        consoleLogs: logs
      }
    });
  } catch (caught) {
    self.postMessage({ kind: 'syntax', message: caught && caught.message ? caught.message : String(caught) });
  }
};
`;

const serialize = (value: unknown, seen = new WeakSet<object>()): SerializedValue => {
  if (typeof value === 'function') return { __kind: 'function', source: value.toString() };
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value as null | string | number | boolean;
  }
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) throw new Error('TEST_INPUT_NOT_SERIALIZABLE');
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => serialize(item, seen));
  const output: { [key: string]: SerializedValue } = {};
  for (const [key, item] of Object.entries(value)) output[key] = serialize(item, seen);
  return output;
};

export const CodeEvaluator = {
  stripSimpleTypeScript(code: string): string {
    return code
      .replace(/:\s*(?:string|number|boolean|any|void|unknown|never|Record<[^>]+>|Array<[^>]+>|Promise<[^>]+>|Map<[^>]+>|Set<[^>]+>|PrismaService|DeepMockProxy<[^>]+>|\w+Dto|\w+Props|\w+Payload)(?=[,\s\)=;\{])/g, '')
      .replace(/as\s+[A-Za-z0-9_<>]+(?=[,\s\)=;\{])/g, '')
      .replace(/<[A-Za-z0-9_,\s]+>(?=\()/g, '');
  },

  async runTests(userCode: string, testCases: TestCase[], includeHidden = true): Promise<TestOutcome> {
    const casesToRun = includeHidden ? testCases : testCases.filter((testCase) => !testCase.hidden);
    let serializedCases: SerializedValue[];
    try {
      serializedCases = casesToRun.map((testCase) => serialize(testCase));
    } catch (error) {
      return {
        passed: false,
        total: casesToRun.length,
        passedCount: 0,
        syntaxError: error instanceof Error ? error.message : String(error),
        results: [],
        consoleLogs: []
      };
    }

    const blobUrl = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
    const worker = new Worker(blobUrl);
    URL.revokeObjectURL(blobUrl);
    const request: WorkerRequest = { code: this.stripSimpleTypeScript(userCode), testCases: serializedCases };
    return new Promise((resolve) => {
      let settled = false;
      const finish = (outcome: TestOutcome) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        worker.terminate();
        resolve(outcome);
      };
      const timeout = window.setTimeout(
        () =>
          finish({
            passed: false,
            total: casesToRun.length,
            passedCount: 0,
            syntaxError: 'Bài chạy quá thời gian giới hạn (4 giây). Worker đã bị dừng.',
            results: [],
            consoleLogs: []
          }),
        4000
      );
      worker.onmessage = (event: MessageEvent<{ kind: string; outcome?: TestOutcome; message?: string }>) => {
        if (event.data.kind === 'result' && event.data.outcome) finish(event.data.outcome);
        else if (event.data.kind === 'syntax')
          finish({
            passed: false,
            total: casesToRun.length,
            passedCount: 0,
            syntaxError: event.data.message,
            results: [],
            consoleLogs: []
          });
      };
      worker.onerror = (event) =>
        finish({
          passed: false,
          total: casesToRun.length,
          passedCount: 0,
          syntaxError: event.message || 'Sandbox worker error',
          results: [],
          consoleLogs: []
        });
      worker.postMessage(request);
    });
  }
};
