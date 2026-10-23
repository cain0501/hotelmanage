(function attachHotelOperationsCalculator(global) {
  const invalidExpression = () => new Error('请输入有效的算式');

  function evaluate(expression) {
    const normalized = String(expression || '')
      .replaceAll('×', '*')
      .replaceAll('÷', '/')
      .replaceAll('−', '-')
      .replaceAll('，', ',')
      .replaceAll(',', '')
      .trim();
    if (!normalized || !/^[0-9+\-*/().\s]+$/.test(normalized)) throw invalidExpression();

    let cursor = 0;
    const skipSpaces = () => { while (/\s/.test(normalized[cursor] || '')) cursor += 1; };
    const parseExpression = () => {
      let value = parseTerm();
      while (true) {
        skipSpaces();
        const operator = normalized[cursor];
        if (operator !== '+' && operator !== '-') return value;
        cursor += 1;
        const right = parseTerm();
        value = operator === '+' ? value + right : value - right;
      }
    };
    const parseTerm = () => {
      let value = parseFactor();
      while (true) {
        skipSpaces();
        const operator = normalized[cursor];
        if (operator !== '*' && operator !== '/') return value;
        cursor += 1;
        const right = parseFactor();
        if (operator === '/' && right === 0) throw new Error('计算结果无效');
        value = operator === '*' ? value * right : value / right;
      }
    };
    const parseFactor = () => {
      skipSpaces();
      const operator = normalized[cursor];
      if (operator === '+' || operator === '-') {
        cursor += 1;
        const value = parseFactor();
        return operator === '-' ? -value : value;
      }
      if (operator === '(') {
        cursor += 1;
        const value = parseExpression();
        skipSpaces();
        if (normalized[cursor] !== ')') throw invalidExpression();
        cursor += 1;
        return value;
      }
      const start = cursor;
      while (/[0-9.]/.test(normalized[cursor] || '')) cursor += 1;
      const token = normalized.slice(start, cursor);
      if (!token || (token.match(/\./g) || []).length > 1 || !Number.isFinite(Number(token))) throw invalidExpression();
      return Number(token);
    };

    const result = parseExpression();
    skipSpaces();
    if (cursor !== normalized.length) throw invalidExpression();
    if (!Number.isFinite(result)) throw new Error('计算结果无效');
    return Math.round((result + Number.EPSILON) * 100) / 100;
  }

  global.HotelOperationsCalculator = { evaluate };
})(globalThis);
