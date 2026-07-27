/**
 * 极简 Java 表达式解析：只处理插件 Service 里 createDefaultRecipes 使用的子集。
 * 支持：方法调用 name(args...)、new Type(args...)、字符串、数字、布尔、null、
 * 静态字段引用（Material.APPLE / CuttingBoardTool.SHOVEL）。
 * 不支持运算符——源码里也没有用到。
 */

function stripThis(name) {
  return name.startsWith('this.') ? name.slice(5) : name;
}

/** 把 Java 源码切成 token 流，注释与空白丢弃。 */
export function tokenize(source) {
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (char === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (char === '/' && source[i + 1] === '*') {
      i = source.indexOf('*/', i + 2);
      i = i < 0 ? source.length : i + 2;
      continue;
    }
    if (/\s/.test(char)) {
      i++;
      continue;
    }
    if (char === '"') {
      let value = '';
      i++;
      while (i < source.length && source[i] !== '"') {
        if (source[i] === '\\') {
          const escape = source[i + 1];
          if (escape === 'u') {
            value += String.fromCharCode(parseInt(source.slice(i + 2, i + 6), 16));
            i += 6;
            continue;
          }
          value += {n: '\n', t: '\t', r: '\r', '"': '"', "'": "'", '\\': '\\'}[escape] ?? escape;
          i += 2;
          continue;
        }
        value += source[i];
        i++;
      }
      i++;
      tokens.push({kind: 'string', value});
      continue;
    }
    if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(source[i + 1] ?? ''))) {
      let raw = '';
      while (i < source.length && /[0-9._fFdDLlxXeE+-]/.test(source[i])) {
        // 指数与符号只在紧跟 e/E 后有效，避免吞掉后续 token。
        if (/[+-]/.test(source[i]) && !/[eE]/.test(raw.at(-1) ?? '')) break;
        raw += source[i];
        i++;
      }
      tokens.push({kind: 'number', value: Number(raw.replace(/[_fFdDLl]$/g, '').replace(/_/g, ''))});
      continue;
    }
    if (/[A-Za-z_$]/.test(char)) {
      let raw = '';
      while (i < source.length && /[A-Za-z0-9_$.]/.test(source[i])) {
        raw += source[i];
        i++;
      }
      tokens.push({kind: 'name', value: raw});
      continue;
    }
    tokens.push({kind: 'punct', value: char});
    i++;
  }
  return tokens;
}

/**
 * 从 token 流解析一个表达式。返回 {node, next}。
 * 调用节点：{call: '方法名', args: [...]}
 * 字面量：{literal: value} / {ref: 'Material.APPLE'}
 */
export function parseExpression(tokens, start) {
  let i = start;
  const token = tokens[i];
  if (!token) throw new Error('表达式意外结束');

  if (token.kind === 'string' || token.kind === 'number') {
    return {node: {literal: token.value}, next: i + 1};
  }
  if (token.kind === 'punct' && token.value === '-') {
    const inner = parseExpression(tokens, i + 1);
    return {node: {literal: -inner.node.literal}, next: inner.next};
  }
  if (token.kind === 'name') {
    let name = token.value;
    i++;
    if (name === 'new') {
      name = `new ${tokens[i].value}`;
      i++;
    }
    if (tokens[i]?.kind === 'punct' && tokens[i].value === '(') {
      i++;
      const args = [];
      while (!(tokens[i]?.kind === 'punct' && tokens[i].value === ')')) {
        if (tokens[i]?.kind === 'punct' && tokens[i].value === ',') {
          i++;
          continue;
        }
        const parsed = parseExpression(tokens, i);
        args.push(parsed.node);
        i = parsed.next;
      }
      i++;
      // 支持链式 .method()，如 List.of(...).size()——实际未用到，忽略链尾。
      return {node: {call: stripThis(name), args}, next: i};
    }
    if (name === 'null') return {node: {literal: null}, next: i};
    if (name === 'true' || name === 'false') return {node: {literal: name === 'true'}, next: i};
    return {node: {ref: name}, next: i};
  }
  throw new Error(`无法解析的 token: ${JSON.stringify(token)}`);
}

/** 提取某方法体内的顶层调用语句与局部变量声明。 */
export function extractMethodBody(source, methodName) {
  const signature = new RegExp(`(private|public|protected)[^\\n]*\\b${methodName}\\s*\\([^)]*\\)\\s*\\{`);
  const match = signature.exec(source);
  if (!match) return [];
  let depth = 0;
  let i = match.index + match[0].length - 1;
  const bodyStart = i + 1;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  const tokens = tokenize(source.slice(bodyStart, i));
  const calls = [];
  const locals = new Map();
  let cursor = 0;
  while (cursor < tokens.length) {
    const token = tokens[cursor];
    if (token.kind === 'punct') {
      cursor++;
      continue;
    }
    // 局部变量声明：Type name = 表达式;
    if (
      token.kind === 'name' &&
      tokens[cursor + 1]?.kind === 'name' &&
      tokens[cursor + 2]?.kind === 'punct' &&
      tokens[cursor + 2].value === '='
    ) {
      const varName = tokens[cursor + 1].value;
      try {
        const parsed = parseExpression(tokens, cursor + 3);
        locals.set(varName, parsed.node);
        cursor = parsed.next;
      } catch {
        cursor += 3;
      }
      continue;
    }
    try {
      const parsed = parseExpression(tokens, cursor);
      if (parsed.node.call) calls.push(parsed.node);
      cursor = parsed.next;
    } catch {
      cursor++;
    }
  }
  return {calls, locals};
}

/** 解析类内 `static final` 常量的字面量值，供 {ref: NAME} 求值使用。 */
export function extractStaticConstants(source) {
  const constants = new Map();
  const re = /static\s+final\s+(?:int|long|double|float|String)\s+([A-Z][A-Z0-9_]*)\s*=\s*("(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?)\s*;/g;
  for (const match of source.matchAll(re)) {
    const raw = match[2];
    constants.set(
      match[1],
      raw.startsWith('"') ? JSON.parse(raw) : Number(raw),
    );
  }
  return constants;
}
