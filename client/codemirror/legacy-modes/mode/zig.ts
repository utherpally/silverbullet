import {StreamLanguage} from "@codemirror/language"
import {StreamParser} from "@codemirror/language"

// Zig language mode for CodeMirror
// Based on Zig language specification and syntax

// Control flow keywords
const controlKeywords = [
  "if", "else", "switch", "while", "for", "break", "continue", "return",
  "defer", "errdefer", "try", "catch", "orelse", "unreachable",
  "suspend", "resume", "nosuspend",
];

// Definition keywords
const definitionKeywords = [
  "const", "var", "fn", "struct", "enum", "union", "error", "opaque", "test",
];

// Module-related keywords
const moduleKeywords = [
  "pub", "export", "extern",
];

// Operator keywords
const operatorKeywords = [
  "and", "or",
];

// Modifier keywords
const modifiers = [
  "packed", "comptime", "inline", "noinline", "asm", "volatile",
  "allowzero", "align", "linksection", "callconv", "noalias", "addrspace",
  "threadlocal", "anyframe", "anytype",
];

const types = [
  // Integer types
  "i8", "u8", "i16", "u16", "i32", "u32", "i64", "u64", "i128", "u128",
  "isize", "usize",

  // Floating point types
  "f16", "f32", "f64", "f80", "f128",

  // Other types
  "bool", "void", "noreturn", "type", "anyerror", "anyopaque",
  "c_char", "c_short", "c_ushort", "c_int", "c_uint", "c_long", "c_ulong",
  "c_longlong", "c_ulonglong", "c_longdouble",

  // Compile-time types
  "comptime_int", "comptime_float",
];

const builtins = [
  // Type manipulation
  "@Type", "@TypeOf", "@typeName", "@typeInfo",

  // Compile-time operations
  "@compileError", "@compileLog",

  // Memory operations
  "@sizeOf", "@alignOf", "@offsetOf", "@bitSizeOf", "@alignCast",
  "@ptrCast", "@intCast", "@floatCast", "@intToFloat", "@floatToInt",
  "@boolToInt", "@errorToInt", "@intToError", "@intToEnum", "@enumToInt",
  "@intToPtr", "@ptrToInt", "@truncate", "@bitCast",

  // Math operations
  "@abs", "@min", "@max", "@sqrt", "@sin", "@cos", "@tan",
  "@exp", "@exp2", "@log", "@log2", "@log10",
  "@floor", "@ceil", "@trunc", "@round",
  "@mod", "@rem", "@divFloor", "@divTrunc", "@divExact",
  "@shlExact", "@shrExact",

  // Arithmetic operations
  "@addWithOverflow", "@subWithOverflow", "@mulWithOverflow",
  "@shlWithOverflow",

  // Bit operations
  "@clz", "@ctz", "@popCount", "@byteSwap", "@bitReverse",

  // Memory intrinsics
  "@memcpy", "@memset",

  // Atomic operations
  "@atomicLoad", "@atomicStore", "@atomicRmw", "@cmpxchgStrong", "@cmpxchgWeak",
  "@fence", "@atomicStore",

  // Error handling
  "@errorName", "@errorReturnTrace", "@errorCast",

  // Pointer operations
  "@addrSpaceCast",

  // Import/export
  "@import", "@cImport", "@cInclude", "@cDefine", "@cUndef",
  "@embedFile", "@export",

  // Code generation
  "@extern", "@setAlignStack", "@setCold", "@setEvalBranchQuota",
  "@setFloatMode", "@setRuntimeSafety",

  // Other builtins
  "@breakpoint", "@frame", "@frameAddress", "@returnAddress",
  "@hasDecl", "@hasField", "@fieldParentPtr",
  "@panic", "@splat", "@reduce", "@shuffle", "@select",
  "@as", "@call", "@field", "@tagName", "@This", "@src",
  "@volatileCast", "@constCast", "@wasmMemorySize", "@wasmMemoryGrow",
  "@inComptime",
];

const bools = ["true", "false"];
const atoms = ["undefined"];

function tokenBase(stream: any, state: any) {
  // Handle whitespace
  if (stream.eatSpace()) return null;

  const ch = stream.next();

  // Comments
  if (ch === "/") {
    if (stream.eat("/")) {
      // Check for doc comments
      if (stream.eat("!")) {
        stream.skipToEnd();
        return "docComment";
      } else if (stream.eat("/")) {
        stream.skipToEnd();
        return "docComment";
      }
      stream.skipToEnd();
      return "lineComment";
    }
    return "operator";
  }

  // Strings
  if (ch === '"') {
    state.tokenize = tokenString;
    return tokenString(stream, state);
  }

  // Multiline strings (line strings starting with \\)
  if (ch === "\\" && stream.eat("\\")) {
    stream.skipToEnd();
    state.tokenize = tokenMultilineString;
    return "string";
  }

  // Character literals
  if (ch === "'") {
    stream.match(/^(?:[^'\\]|\\(?:[nrt'\\]|x[0-9a-fA-F]{2}|u\{[0-9a-fA-F]+\}))/);
    stream.eat("'");
    return "character";
  }

  // Numbers
  if (/\d/.test(ch) || (ch === "." && stream.eat(/\d/))) {
    let isFloat = ch === ".";

    if (ch === "0") {
      if (stream.eat(/[xX]/)) {
        stream.eatWhile(/[0-9a-fA-F_]/);
        return "integer";
      } else if (stream.eat(/[oO]/)) {
        stream.eatWhile(/[0-7_]/);
        return "integer";
      } else if (stream.eat(/[bB]/)) {
        stream.eatWhile(/[01_]/);
        return "integer";
      }
    }

    stream.eatWhile(/[\d_]/);

    if (stream.eat(".")) {
      isFloat = true;
      stream.eatWhile(/[\d_]/);
    }

    if (stream.eat(/[eE]/)) {
      isFloat = true;
      stream.eat(/[+-]/);
      stream.eatWhile(/[\d_]/);
    }

    return isFloat ? "float" : "integer";
  }

  // Builtins (start with @)
  if (ch === "@") {
    if (stream.eat('"')) {
      // @"identifier" syntax
      while (true) {
        const next = stream.next();
        if (next === '"') break;
        if (next === "\\") stream.next();
        if (!next) break;
      }
      return "variableName";
    }
    stream.eatWhile(/[\w]/);
    const builtin = stream.current();
    if (builtins.indexOf(builtin) !== -1) {
      return "macroName";
    }
    return "variableName";
  }

  // Identifiers and keywords
  if (/[a-zA-Z_]/.test(ch)) {
    stream.eatWhile(/[\w]/);
    const cur = stream.current();

    if (controlKeywords.indexOf(cur) !== -1) return "controlKeyword";
    if (definitionKeywords.indexOf(cur) !== -1) return "definitionKeyword";
    if (moduleKeywords.indexOf(cur) !== -1) return "moduleKeyword";
    if (operatorKeywords.indexOf(cur) !== -1) return "operatorKeyword";
    if (modifiers.indexOf(cur) !== -1) return "modifier";
    if (types.indexOf(cur) !== -1) return "typeName";
    if (bools.indexOf(cur) !== -1) return "bool";
    if (cur === "null") return "null";
    if (atoms.indexOf(cur) !== -1) return "atom";

    return "variableName";
  }

  // Operators
  if (/[+\-*/%=<>!&|^~?:]/.test(ch)) {
    stream.eatWhile(/[+\-*/%=<>!&|^~?:]/);
    return "operator";
  }

  // Brackets and punctuation
  if (/[{}\[\](),;.]/.test(ch)) {
    return null;
  }

  return null;
}

function tokenString(stream: any, state: any) {
  let escaped = false;
  let ch;

  while ((ch = stream.next()) != null) {
    if (ch === '"' && !escaped) {
      state.tokenize = tokenBase;
      return "string";
    }
    escaped = !escaped && ch === "\\";
  }

  return "string";
}

function tokenMultilineString(stream: any, state: any) {
  // Multiline strings continue on lines that start with \\
  // If the line doesn't start with \\, the multiline string has ended
  if (stream.sol()) {
    if (stream.match(/^\s*\\\\/)) {
      // Line continues the multiline string
      stream.skipToEnd();
      return "string";
    } else {
      // Multiline string ended, reset to base tokenizer
      state.tokenize = tokenBase;
      return tokenBase(stream, state);
    }
  }

  // Continue consuming the rest of the line
  stream.skipToEnd();
  return "string";
}

export const zigLanguage: StreamParser<{tokenize: any}> = {
  name: "zig",

  startState: function() {
    return {
      tokenize: tokenBase
    };
  },

  token: function(stream, state) {
    return state.tokenize(stream, state);
  },

  languageData: {
    commentTokens: {line: "//", block: {open: "", close: ""}},
    closeBrackets: {brackets: ["(", "[", "{", "'", '"']},
  }
};

export const zig = zigLanguage;
