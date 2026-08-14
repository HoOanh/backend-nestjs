/**
 * eSmiles Backend Academy - Interactive Code Evaluator & Test Runner
 * Evaluates JavaScript/TypeScript student code against public & hidden test cases
 */

window.CodeEvaluator = {
  /**
   * Deep equality comparison between actual and expected
   */
  deepEqual(actual, expected) {
    if (actual === expected) return true;
    if (actual === null || expected === null) return actual === expected;
    if (typeof actual !== typeof expected) return false;

    if (typeof actual === 'object') {
      if (Array.isArray(actual) !== Array.isArray(expected)) return false;

      if (Array.isArray(actual)) {
        if (actual.length !== expected.length) return false;
        for (let i = 0; i < actual.length; i++) {
          if (!this.deepEqual(actual[i], expected[i])) return false;
        }
        return true;
      }

      const actualKeys = Object.keys(actual).filter(k => k !== 'timestamp' && k !== 'processedAt' && k !== 'eventId');
      const expectedKeys = Object.keys(expected).filter(k => k !== 'timestamp' && k !== 'processedAt' && k !== 'eventId');

      if (actualKeys.length !== expectedKeys.length) return false;
      for (const key of expectedKeys) {
        if (!Object.prototype.hasOwnProperty.call(actual, key)) return false;
        if (!this.deepEqual(actual[key], expected[key])) return false;
      }
      return true;
    }

    return false;
  },

  /**
   * Evaluates user code string and runs against test cases
   * @param {string} userCode - JavaScript/TypeScript code string
   * @param {Array} testCases - Array of test cases { name, input, expected, hidden }
   * @param {boolean} includeHidden - Whether to run hidden test cases
   */
  async runTests(userCode, testCases, includeHidden = true) {
    const results = [];
    let passedCount = 0;

    // Transpile or clean TypeScript type annotations if needed (lightweight strip)
    const cleanedCode = this.stripSimpleTypeScript(userCode);

    let fn;
    try {
      // Find declared function or class name
      const match = cleanedCode.match(/(?:async\s+)?(?:function\*?|class)\s+([A-Za-z0-9_$]+)/);
      const targetName = match ? match[1] : '';

      // Evaluate function in a clean Function wrapper
      const factory = new Function(`
        ${cleanedCode}
        if ("${targetName}" && typeof eval !== 'undefined') {
          try {
            return eval("${targetName}");
          } catch(e){}
        }
        return null;
      `);
      fn = factory();
    } catch (syntaxErr) {
      return {
        passed: false,
        total: testCases.length,
        passedCount: 0,
        syntaxError: syntaxErr.message,
        results: testCases.map(tc => ({
          name: tc.name,
          hidden: tc.hidden,
          passed: false,
          error: `Lỗi cú pháp (Syntax Error): ${syntaxErr.message}`
        }))
      };
    }

    if (!fn) {
      return {
        passed: false,
        total: testCases.length,
        passedCount: 0,
        syntaxError: 'Không tìm thấy hàm mục tiêu. Vui lòng giữ nguyên tên hàm như mẫu ban đầu.',
        results: []
      };
    }

    // Filter test cases based on includeHidden
    const activeTestCases = includeHidden ? testCases : testCases.filter(t => !t.hidden);

    for (const tc of activeTestCases) {
      let actual;
      let passed = false;
      let error = null;

      try {
        if (typeof fn.prototype?.getProvider === 'function') {
          // Class constructor case (SimpleModuleContainer)
          const container = new fn();
          if (tc.input[0] && tc.input[1]) {
            container.registerProvider(tc.input[0], tc.input[1]);
          }
          actual = container.getProvider(tc.input[0]);
        } else {
          // Standard function call
          actual = await fn(...tc.input);
        }

        if (tc.expected === 'ERROR_THROWN') {
          passed = false;
          error = 'Kỳ vọng ném ra lỗi (Error) nhưng hàm lại chạy thành công không có lỗi.';
        } else {
          passed = this.deepEqual(actual, tc.expected);
        }
      } catch (err) {
        if (tc.expected === 'ERROR_THROWN') {
          passed = true;
          actual = `[Error thrown: ${err.message}]`;
        } else {
          passed = false;
          error = err.message;
        }
      }

      if (passed) passedCount++;

      results.push({
        name: tc.name,
        hidden: tc.hidden,
        passed,
        input: tc.hidden ? '[Bảo mật - Test Case Ẩn]' : JSON.stringify(tc.input),
        expected: tc.hidden ? '[Bảo mật - Test Case Ẩn]' : JSON.stringify(tc.expected),
        actual: tc.hidden && !passed ? '[Sai kết quả trên case ẩn]' : JSON.stringify(actual),
        error
      });
    }

    return {
      passed: passedCount === activeTestCases.length,
      total: activeTestCases.length,
      passedCount,
      results
    };
  },

  /**
   * Lightweight stripper for basic TS annotations (types, interfaces, return types)
   */
  stripSimpleTypeScript(code) {
    return code
      .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')
      .replace(/type\s+\w+\s*=\s*[^;]+;/g, '')
      .replace(/:\s*(string|number|boolean|any|void|unknown|never|Record<[^>]+>|Array<[^>]+>|\w+\[\]|Promise<[^>]+>)(?=[,\s\)=;\{])/g, '')
      .replace(/<[A-Za-z0-9_,\s]+>(?=\()/g, '')
      .replace(/!\s*:/g, ':');
  }
};
