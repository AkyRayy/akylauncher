"use strict";
const electron = require("electron");
const node_path = require("node:path");
const promises = require("node:fs/promises");
const node_crypto = require("node:crypto");
const node_child_process = require("node:child_process");
const node_util = require("node:util");
const node_fs = require("node:fs");
const promises$1 = require("node:stream/promises");
const node_stream = require("node:stream");
const node_os = require("node:os");
const node_zlib = require("node:zlib");
function rootDir() {
  return node_path.join(electron.app.getPath("userData"), "game");
}
const dirs = {
  root: () => rootDir(),
  versions: () => node_path.join(rootDir(), "versions"),
  versionDir: (id) => node_path.join(rootDir(), "versions", id),
  libraries: () => node_path.join(rootDir(), "libraries"),
  assets: () => node_path.join(rootDir(), "assets"),
  natives: (id) => node_path.join(rootDir(), "natives", id),
  instances: () => node_path.join(rootDir(), "instances"),
  instanceDir: (id) => node_path.join(rootDir(), "instances", id),
  java: () => node_path.join(rootDir(), "java"),
  config: () => electron.app.getPath("userData")
};
async function sha1Of(path) {
  const buf = await promises.readFile(path);
  return node_crypto.createHash("sha1").update(buf).digest("hex");
}
async function isFresh(task) {
  try {
    const st = await promises.stat(task.dest);
    if (task.size !== void 0 && st.size !== task.size) return false;
    if (task.sha1) return await sha1Of(task.dest) === task.sha1;
    return st.size > 0;
  } catch {
    return false;
  }
}
const USER_AGENT = "AkyLauncher/1.0.0-beta (github.com/AkyRayy/akylauncher)";
const HEADERS = { "User-Agent": USER_AGENT };
async function fetchOne(task, retries = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(task.url, { headers: HEADERS });
      if (!res.ok) throw new Error(`http ${res.status} ${task.url}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (task.sha1) {
        const got = node_crypto.createHash("sha1").update(buf).digest("hex");
        if (got !== task.sha1) throw new Error(`sha1 mismatch ${task.url}`);
      }
      await promises.mkdir(node_path.dirname(task.dest), { recursive: true });
      await promises.writeFile(task.dest, buf);
      return buf.length;
    } catch (err) {
      if (attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
}
async function downloadAll(tasks, concurrency = 8, onProgress) {
  const queue = [...tasks];
  let done = 0;
  let bytes = 0;
  const total = tasks.length;
  async function worker() {
    for (; ; ) {
      const task = queue.shift();
      if (!task) return;
      if (!await isFresh(task)) {
        bytes += await fetchOne(task);
      }
      done++;
      onProgress?.({ done, total, bytes });
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
}
async function fetchJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`http ${res.status} ${url}`);
  return res.json();
}
var util;
(function(util2) {
  util2.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
const ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
const getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};
const ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
class ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
}
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};
const errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
let overrideErrorMap = errorMap;
function getErrorMap() {
  return overrideErrorMap;
}
const makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === errorMap ? void 0 : errorMap
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
class ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
}
const INVALID = Object.freeze({
  status: "aborted"
});
const DIRTY = (value) => ({ status: "dirty", value });
const OK = (value) => ({ status: "valid", value });
const isAborted = (x) => x.status === "aborted";
const isDirty = (x) => x.status === "dirty";
const isValid = (x) => x.status === "valid";
const isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));
class ParseInputLazyPath {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
}
const handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
class ZodType {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
}
const cuidRegex = /^c[^\s-]{8,}$/i;
const cuid2Regex = /^[0-9a-z]+$/;
const ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
const uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
const nanoidRegex = /^[a-z0-9_-]{21}$/i;
const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
const durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
const emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
const _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
let emojiRegex;
const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
const ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
const ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
const base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
const base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
const dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
const dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
class ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
}
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
class ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
}
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
class ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
}
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
class ZodBoolean extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
class ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
}
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
class ZodSymbol extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
class ZodUndefined extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
class ZodNull extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
class ZodAny extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
}
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
class ZodUnknown extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
}
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
class ZodNever extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
}
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
class ZodVoid extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
class ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
}
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
class ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") ;
      else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
}
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
class ZodUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
}
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
class ZodIntersection extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
}
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
class ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new ZodTuple({
      ...this._def,
      rest
    });
  }
}
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
class ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
}
class ZodMap extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
}
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
class ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
}
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
class ZodLazy extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
}
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
class ZodLiteral extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
}
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
class ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
}
ZodEnum.create = createZodEnum;
class ZodNativeEnum extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
}
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
class ZodPromise extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
}
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
class ZodEffects extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
}
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
class ZodOptional extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
class ZodNullable extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
class ZodDefault extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
}
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
class ZodCatch extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
}
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
class ZodNaN extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
}
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
class ZodBranded extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
}
class ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
}
class ZodReadonly extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
const stringType = ZodString.create;
const numberType = ZodNumber.create;
const booleanType = ZodBoolean.create;
ZodNever.create;
const arrayType = ZodArray.create;
const objectType = ZodObject.create;
const unionType = ZodUnion.create;
ZodIntersection.create;
ZodTuple.create;
const recordType = ZodRecord.create;
const enumType = ZodEnum.create;
ZodPromise.create;
ZodOptional.create;
ZodNullable.create;
const VersionManifestSchema = objectType({
  latest: objectType({ release: stringType(), snapshot: stringType() }),
  versions: arrayType(
    objectType({
      id: stringType(),
      type: enumType(["release", "snapshot", "old_beta", "old_alpha"]),
      url: stringType().url(),
      releaseTime: stringType()
    })
  )
});
const DownloadSchema = objectType({
  sha1: stringType(),
  size: numberType(),
  url: stringType().url()
});
const OsRuleSchema = objectType({
  action: enumType(["allow", "disallow"]),
  os: objectType({
    name: enumType(["windows", "linux", "osx"]).optional(),
    arch: stringType().optional()
  }).optional(),
  features: recordType(booleanType()).optional()
});
const LibrarySchema = objectType({
  name: stringType(),
  downloads: objectType({
    artifact: DownloadSchema.extend({ path: stringType() }).optional(),
    classifiers: recordType(DownloadSchema.extend({ path: stringType() })).optional()
  }).optional(),
  natives: recordType(stringType()).optional(),
  rules: arrayType(OsRuleSchema).optional()
});
const ArgValueSchema = unionType([stringType(), arrayType(stringType())]);
const ConditionalArgSchema = unionType([
  stringType(),
  objectType({ rules: arrayType(OsRuleSchema), value: ArgValueSchema })
]);
const VersionJsonSchema = objectType({
  id: stringType(),
  type: stringType(),
  mainClass: stringType(),
  assets: stringType().optional(),
  assetIndex: objectType({ id: stringType(), url: stringType().url(), sha1: stringType() }).optional(),
  downloads: objectType({ client: DownloadSchema }).optional(),
  libraries: arrayType(LibrarySchema),
  arguments: objectType({
    game: arrayType(ConditionalArgSchema).optional(),
    jvm: arrayType(ConditionalArgSchema).optional()
  }).optional(),
  minecraftArguments: stringType().optional(),
  javaVersion: objectType({ majorVersion: numberType() }).optional(),
  inheritsFrom: stringType().optional()
});
const AssetIndexSchema = objectType({
  objects: recordType(objectType({ hash: stringType(), size: numberType() }))
});
function currentOs() {
  const platform = process.platform;
  const name = platform === "win32" ? "windows" : platform === "darwin" ? "osx" : "linux";
  return { name, arch: process.arch };
}
function rulesAllow(rules, os, features = {}) {
  if (!rules || rules.length === 0) return true;
  let allowed = false;
  for (const rule of rules) {
    let matches = true;
    if (rule.os?.name && rule.os.name !== os.name) matches = false;
    if (rule.os?.arch && rule.os.arch !== os.arch) matches = false;
    if (rule.features) {
      for (const [key, want] of Object.entries(rule.features)) {
        if ((features[key] ?? false) !== want) matches = false;
      }
    }
    if (matches) allowed = rule.action === "allow";
  }
  return allowed;
}
function filterLibraries(libraries, os) {
  return libraries.filter((lib) => rulesAllow(lib.rules, os));
}
function flattenArgs(args, os, features = {}) {
  if (!args) return [];
  const out = [];
  for (const arg of args) {
    if (typeof arg === "string") {
      out.push(arg);
      continue;
    }
    if (rulesAllow(arg.rules, os, features)) {
      if (typeof arg.value === "string") out.push(arg.value);
      else out.push(...arg.value);
    }
  }
  return out;
}
function substitute(args, vars) {
  return args.map((a) => a.replace(/\$\{(\w+)\}/g, (m, key) => vars[key] ?? m));
}
function mavenToPath(coord) {
  const [group, artifact, version, classifier] = coord.split(":");
  if (!group || !artifact || !version) throw new Error(`bad maven coord: ${coord}`);
  const file = classifier ? `${artifact}-${version}-${classifier}.jar` : `${artifact}-${version}.jar`;
  return `${group.replace(/\./g, "/")}/${artifact}/${version}/${file}`;
}
function dedupeLibraries(libs) {
  const seen = /* @__PURE__ */ new Set();
  return libs.filter((lib) => {
    const p = lib.name.split(":");
    const key = `${p[0]}:${p[1]}:${p[3] ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function libraryRelPath(lib) {
  if (lib.downloads?.artifact?.path) return lib.downloads.artifact.path;
  if (lib.downloads && !lib.downloads.artifact) return null;
  try {
    return mavenToPath(lib.name);
  } catch {
    return null;
  }
}
function mergeVersionJson(parent, child2) {
  return {
    ...parent,
    ...child2,
    downloads: child2.downloads ?? parent.downloads,
    assetIndex: child2.assetIndex ?? parent.assetIndex,
    assets: child2.assets ?? parent.assets,
    javaVersion: child2.javaVersion ?? parent.javaVersion,
    minecraftArguments: child2.minecraftArguments ?? parent.minecraftArguments,
    libraries: [...child2.libraries, ...parent.libraries],
    arguments: parent.arguments || child2.arguments ? {
      game: [...parent.arguments?.game ?? [], ...child2.arguments?.game ?? []],
      jvm: [...parent.arguments?.jvm ?? [], ...child2.arguments?.jvm ?? []]
    } : void 0,
    inheritsFrom: void 0
  };
}
const MANIFEST_URL = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const ASSETS_BASE = "https://resources.download.minecraft.net";
let manifestCache = null;
async function isVersionInstalled(id, requireJar = true) {
  try {
    await promises.access(node_path.join(dirs.versionDir(id), `${id}.json`));
    if (requireJar) await promises.access(node_path.join(dirs.versionDir(id), `${id}.jar`));
    return true;
  } catch {
    return false;
  }
}
const isInstalled = (id) => isVersionInstalled(id);
async function listVersions(force = false) {
  if (!force && manifestCache && Date.now() - manifestCache.fetchedAt < 10 * 6e4) {
    return manifestCache.data;
  }
  const raw = await fetchJson(MANIFEST_URL);
  const manifest = VersionManifestSchema.parse(raw);
  const data = [];
  for (const v of manifest.versions) {
    data.push({
      id: v.id,
      kind: v.type,
      url: v.url,
      releaseTime: v.releaseTime,
      installed: await isInstalled(v.id)
    });
  }
  manifestCache = { fetchedAt: Date.now(), data };
  return data;
}
async function readVersionJson(id) {
  const raw = JSON.parse(await promises.readFile(node_path.join(dirs.versionDir(id), `${id}.json`), "utf8"));
  return VersionJsonSchema.parse(raw);
}
async function resolveVersionJson(id, depth = 0) {
  if (depth > 4) throw new Error(`inheritsFrom: цикл или слишком глубокая цепочка у ${id}`);
  const child2 = await readVersionJson(id);
  if (!child2.inheritsFrom) return child2;
  const parent = await resolveVersionJson(child2.inheritsFrom, depth + 1);
  return mergeVersionJson(parent, child2);
}
async function installVersion(versionId, onProgress) {
  const taskId = `install-${versionId}-${Date.now()}`;
  const emit = (patch) => onProgress({
    taskId,
    label: versionId,
    ratio: 0,
    done: 0,
    total: 0,
    speedBps: 0,
    phase: "manifest",
    message: "",
    ...patch
  });
  try {
    emit({ phase: "manifest", message: "fetching manifest" });
    const versions = await listVersions();
    const entry = versions.find((v) => v.id === versionId);
    if (!entry) throw new Error(`unknown version ${versionId}`);
    const vjson = VersionJsonSchema.parse(await fetchJson(entry.url));
    const vdir = dirs.versionDir(versionId);
    await promises.mkdir(vdir, { recursive: true });
    await promises.writeFile(node_path.join(vdir, `${versionId}.json`), JSON.stringify(vjson, null, 2));
    if (vjson.downloads?.client) {
      emit({ phase: "client", message: "downloading client.jar", ratio: 0.05 });
      await downloadAll([
        {
          url: vjson.downloads.client.url,
          dest: node_path.join(vdir, `${versionId}.jar`),
          sha1: vjson.downloads.client.sha1,
          size: vjson.downloads.client.size
        }
      ]);
    }
    const os = currentOs();
    const libs = filterLibraries(vjson.libraries, os);
    const libTasks = [];
    for (const lib of libs) {
      const art = lib.downloads?.artifact;
      if (art) {
        libTasks.push({
          url: art.url,
          dest: node_path.join(dirs.libraries(), art.path),
          sha1: art.sha1,
          size: art.size
        });
      }
      const nativeKey = lib.natives?.[os.name];
      if (nativeKey && lib.downloads?.classifiers) {
        const cls = lib.downloads.classifiers[nativeKey.replace("${arch}", os.arch === "x64" ? "64" : "32")];
        if (cls) {
          libTasks.push({
            url: cls.url,
            dest: node_path.join(dirs.libraries(), cls.path),
            sha1: cls.sha1,
            size: cls.size
          });
        }
      }
    }
    const t0 = Date.now();
    await downloadAll(
      libTasks,
      8,
      ({ done, total, bytes }) => emit({
        phase: "libraries",
        message: `libraries ${done}/${total}`,
        done,
        total,
        ratio: 0.1 + 0.3 * (done / Math.max(total, 1)),
        speedBps: bytes / Math.max(Date.now() - t0, 1) * 1e3
      })
    );
    if (vjson.assetIndex) {
      const idxRaw = await fetchJson(vjson.assetIndex.url);
      const idx = AssetIndexSchema.parse(idxRaw);
      const idxDir = node_path.join(dirs.assets(), "indexes");
      await promises.mkdir(idxDir, { recursive: true });
      await promises.writeFile(node_path.join(idxDir, `${vjson.assetIndex.id}.json`), JSON.stringify(idxRaw));
      const assetTasks = Object.values(idx.objects).map((obj) => ({
        url: `${ASSETS_BASE}/${obj.hash.slice(0, 2)}/${obj.hash}`,
        dest: node_path.join(dirs.assets(), "objects", obj.hash.slice(0, 2), obj.hash),
        sha1: obj.hash,
        size: obj.size
      }));
      const t1 = Date.now();
      await downloadAll(
        assetTasks,
        8,
        ({ done, total, bytes }) => emit({
          phase: "assets",
          message: `fetching assets ${done}/${total}`,
          done,
          total,
          ratio: 0.4 + 0.6 * (done / Math.max(total, 1)),
          speedBps: bytes / Math.max(Date.now() - t1, 1) * 1e3
        })
      );
    }
    manifestCache = null;
    emit({ phase: "done", ratio: 1, message: "версия готова" });
  } catch (err) {
    emit({ phase: "error", message: `загрузка прервана · ${err.message}` });
    throw err;
  }
}
async function loadJson(name, schema, fallback) {
  try {
    const raw = JSON.parse(await promises.readFile(node_path.join(dirs.config(), name), "utf8"));
    return schema.parse(raw);
  } catch {
    return fallback;
  }
}
async function saveJson(name, data) {
  await promises.mkdir(dirs.config(), { recursive: true });
  await promises.writeFile(node_path.join(dirs.config(), name), JSON.stringify(data, null, 2));
}
const InstanceSchema = objectType({
  id: stringType(),
  name: stringType(),
  mcVersion: stringType(),
  loader: enumType(["vanilla", "fabric", "quilt", "forge", "neoforge"]),
  loaderVersion: stringType().nullable(),
  createdAt: stringType(),
  lastPlayedAt: stringType().nullable(),
  ramMb: numberType().int().min(512),
  javaPath: stringType().nullable(),
  jvmArgs: arrayType(stringType()),
  windowWidth: numberType().int(),
  windowHeight: numberType().int(),
  modsCount: numberType().int()
});
const ProfileSchema = objectType({
  id: stringType(),
  nickname: stringType(),
  uuid: stringType(),
  kind: enumType(["offline", "elyby"]),
  active: booleanType(),
  skinPath: stringType().nullable().default(null)
});
const SettingsSchema = objectType({
  gameDir: stringType(),
  defaultRamMb: numberType().int(),
  maxRamMb: numberType().int(),
  jvmArgs: arrayType(stringType()),
  windowWidth: numberType().int(),
  windowHeight: numberType().int(),
  keepLauncherOpen: booleanType(),
  groqApiKey: stringType().default(""),
  skinsInGame: booleanType().default(true)
});
const InstancesFileSchema = arrayType(InstanceSchema);
const ProfilesFileSchema = arrayType(ProfileSchema);
const FILE$2 = "instances.json";
async function listInstances() {
  return loadJson(FILE$2, InstancesFileSchema, []);
}
async function createInstance(name, mcVersion, loader, defaults) {
  const all = await listInstances();
  const inst = {
    id: node_crypto.randomUUID(),
    name: name.trim() || `${loader} ${mcVersion}`,
    mcVersion,
    loader,
    loaderVersion: null,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    lastPlayedAt: null,
    ramMb: defaults.ramMb,
    javaPath: null,
    jvmArgs: [],
    windowWidth: defaults.windowWidth,
    windowHeight: defaults.windowHeight,
    modsCount: 0
  };
  await promises.mkdir(dirs.instanceDir(inst.id), { recursive: true });
  await saveJson(FILE$2, [...all, inst]);
  return inst;
}
async function updateInstance(id, patch) {
  const all = await listInstances();
  const idx = all.findIndex((i) => i.id === id);
  if (idx === -1) throw new Error(`instance not found: ${id}`);
  const updated = { ...all[idx], ...patch, id };
  all[idx] = updated;
  await saveJson(FILE$2, all);
  return updated;
}
async function deleteInstance(id) {
  const all = await listInstances();
  await saveJson(FILE$2, all.filter((i) => i.id !== id));
  await promises.rm(dirs.instanceDir(id), { recursive: true, force: true }).catch(() => void 0);
}
function offlineUuid(nickname) {
  const hash = node_crypto.createHash("md5").update(`OfflinePlayer:${nickname}`, "utf8").digest();
  hash[6] = hash[6] & 15 | 48;
  hash[8] = hash[8] & 63 | 128;
  const hex = hash.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32)
  ].join("-");
}
function validNickname(nickname) {
  return /^[A-Za-z0-9_]{3,16}$/.test(nickname);
}
function offlineSession(nickname) {
  return {
    nickname,
    uuid: offlineUuid(nickname),
    accessToken: "0",
    userType: "legacy"
  };
}
const FILE$1 = "profiles.json";
async function listProfiles() {
  return loadJson(FILE$1, ProfilesFileSchema, []);
}
async function createOfflineProfile(nickname) {
  if (!validNickname(nickname)) throw new Error("ник: 3–16 символов, A-Z a-z 0-9 _");
  const all = await listProfiles();
  if (all.some((p) => p.nickname.toLowerCase() === nickname.toLowerCase())) {
    throw new Error("такой ник уже добавлен");
  }
  const profile = {
    id: node_crypto.randomUUID(),
    nickname,
    uuid: offlineUuid(nickname),
    kind: "offline",
    active: all.length === 0,
    skinPath: null
  };
  await saveJson(FILE$1, [...all, profile]);
  return profile;
}
async function updateProfile(id, patch) {
  const all = await listProfiles();
  const idx = all.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error(`профиль не найден: ${id}`);
  const updated = { ...all[idx], ...patch, id };
  all[idx] = updated;
  await saveJson(FILE$1, all);
  return updated;
}
async function setActiveProfile(id) {
  const all = await listProfiles();
  await saveJson(FILE$1, all.map((p) => ({ ...p, active: p.id === id })));
}
async function deleteProfile(id) {
  const all = await listProfiles();
  const rest = all.filter((p) => p.id !== id);
  if (rest.length > 0 && !rest.some((p) => p.active)) rest[0].active = true;
  await saveJson(FILE$1, rest);
}
async function activeProfile() {
  return (await listProfiles()).find((p) => p.active) ?? null;
}
const execFileAsync$1 = node_util.promisify(node_child_process.execFile);
function parseJavaVersion(stderr) {
  const m = stderr.match(/version "([^"]+)"/);
  if (!m || !m[1]) return null;
  const version = m[1];
  const major = version.startsWith("1.") ? Number(version.split(".")[1]) : Number(version.split(".")[0]);
  return Number.isFinite(major) ? { version, major } : null;
}
async function probe(path) {
  try {
    const { stderr } = await execFileAsync$1(path, ["-version"], { timeout: 1e4 });
    const parsed = parseJavaVersion(stderr);
    return parsed ? { path, ...parsed, source: "system" } : null;
  } catch {
    return null;
  }
}
async function listJava() {
  const found = [];
  const candidates = /* @__PURE__ */ new Set();
  const exe = process.platform === "win32" ? "java.exe" : "java";
  if (process.env.JAVA_HOME) candidates.add(node_path.join(process.env.JAVA_HOME, "bin", exe));
  candidates.add(exe);
  try {
    for (const dir of await promises.readdir(dirs.java())) {
      candidates.add(node_path.join(dirs.java(), dir, "bin", exe));
    }
  } catch {
  }
  for (const c of candidates) {
    const rt = await probe(c);
    if (rt) found.push(c.includes(dirs.java()) ? { ...rt, source: "managed" } : rt);
  }
  return found;
}
function requiredJavaMajor(mcVersion, fromJson) {
  if (fromJson) return fromJson;
  const minor = Number(mcVersion.split(".")[1] ?? 0);
  if (minor >= 21) return 21;
  if (minor >= 17) return 17;
  return 8;
}
async function ensureJava(major) {
  const existing = (await listJava()).find((j) => j.major === major);
  if (existing) return existing;
  const os = process.platform === "win32" ? "windows" : process.platform === "darwin" ? "mac" : "linux";
  const arch = process.arch === "arm64" ? "aarch64" : "x64";
  const ext = os === "windows" ? "zip" : "tar.gz";
  const url = `https://api.adoptium.net/v3/binary/latest/${major}/ga/${os}/${arch}/jre/hotspot/normal/eclipse`;
  await promises.mkdir(dirs.java(), { recursive: true });
  const archive = node_path.join(dirs.java(), `temurin-${major}.${ext}`);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`temurin download failed: http ${res.status}`);
  await promises$1.pipeline(node_stream.Readable.fromWeb(res.body), node_fs.createWriteStream(archive));
  const targetDir = node_path.join(dirs.java(), `temurin-${major}`);
  await promises.mkdir(targetDir, { recursive: true });
  if (ext === "zip") {
    await execFileAsync$1("powershell", [
      "-NoProfile",
      "-Command",
      `Expand-Archive -Force -Path "${archive}" -DestinationPath "${targetDir}"`
    ]);
  } else {
    await execFileAsync$1("tar", ["-xzf", archive, "-C", targetDir, "--strip-components=1"]);
  }
  const exe = process.platform === "win32" ? "java.exe" : "java";
  let binPath = node_path.join(targetDir, "bin", exe);
  try {
    const entries = await promises.readdir(targetDir);
    const nested = entries.find((e) => e.startsWith("jdk") || e.startsWith("jre"));
    if (nested) binPath = node_path.join(targetDir, nested, "bin", exe);
  } catch {
  }
  if (process.platform !== "win32") await promises.chmod(binPath, 493).catch(() => void 0);
  const rt = await probe(binPath);
  if (!rt) throw new Error("temurin: java -version failed after install");
  return { ...rt, source: "managed" };
}
function buildLaunchArgs(ctx) {
  const { vjson, session, instance, paths, os } = ctx;
  const libs = dedupeLibraries(filterLibraries(vjson.libraries, os));
  const cpEntries = libs.map((l) => libraryRelPath(l)).filter((p) => Boolean(p)).map((p) => node_path.join(paths.librariesDir, p));
  cpEntries.push(paths.versionJar);
  const classpath = cpEntries.join(node_path.delimiter);
  const vars = {
    auth_player_name: session.nickname,
    auth_uuid: session.uuid,
    auth_access_token: session.accessToken,
    auth_session: session.accessToken,
    user_type: session.userType,
    user_properties: "{}",
    version_name: ctx.versionId,
    version_type: vjson.type,
    game_directory: paths.gameDir,
    assets_root: paths.assetsDir,
    assets_index_name: vjson.assetIndex?.id ?? vjson.assets ?? "legacy",
    natives_directory: paths.nativesDir,
    launcher_name: "AkyLauncher",
    launcher_version: "1.0.0-beta",
    classpath,
    resolution_width: String(instance.windowWidth),
    resolution_height: String(instance.windowHeight)
  };
  const jvm = [`-Xmx${instance.ramMb}M`, `-Xms${Math.min(instance.ramMb, 1024)}M`, ...instance.jvmArgs];
  if (vjson.arguments?.jvm) {
    jvm.push(...substitute(flattenArgs(vjson.arguments.jvm, os), vars));
  } else {
    jvm.push(`-Djava.library.path=${paths.nativesDir}`, "-cp", classpath);
  }
  let game;
  if (vjson.arguments?.game) {
    game = substitute(flattenArgs(vjson.arguments.game, os), vars);
  } else if (vjson.minecraftArguments) {
    game = substitute(vjson.minecraftArguments.split(" "), vars);
  } else {
    game = [];
  }
  return [...jvm, vjson.mainClass, ...game];
}
let child = null;
let state = { running: false, pid: null, instanceId: null, startedAt: null };
function gameState() {
  return state;
}
function killGame() {
  child?.kill("SIGKILL");
}
function classify(line) {
  if (/\b(ERROR|FATAL|Exception|at .+\(.+\.java)/.test(line)) return "ERROR";
  if (/\bWARN/.test(line)) return "WARN";
  if (/\bDEBUG/.test(line)) return "DEBUG";
  return "INFO";
}
async function spawnGame(instance, vjson, versionId, session, javaPath, onLog, onState, extraJvmArgs = []) {
  if (state.running) throw new Error("игра уже запущена");
  await promises.mkdir(dirs.instanceDir(instance.id), { recursive: true });
  await promises.mkdir(dirs.natives(instance.mcVersion), { recursive: true });
  const built = buildLaunchArgs({
    vjson,
    versionId,
    session,
    instance,
    os: currentOs(),
    paths: {
      librariesDir: dirs.libraries(),
      versionJar: node_path.join(dirs.versionDir(instance.mcVersion), `${instance.mcVersion}.jar`),
      nativesDir: dirs.natives(instance.mcVersion),
      assetsDir: dirs.assets(),
      gameDir: dirs.instanceDir(instance.id)
    }
  });
  const args = [...extraJvmArgs, ...built];
  const proc = node_child_process.spawn(javaPath, args, { cwd: dirs.instanceDir(instance.id) });
  child = proc;
  state = { running: true, pid: proc.pid ?? null, instanceId: instance.id, startedAt: Date.now() };
  onState(state);
  proc.on("error", (err) => {
    onLog({ ts: Date.now(), level: "ERROR", text: `spawn failed · ${err.message}` });
    child = null;
    state = { running: false, pid: null, instanceId: null, startedAt: null };
    onState(state);
  });
  const feed = (chunk) => {
    for (const raw of chunk.toString("utf8").split("\n")) {
      const text = raw.trimEnd();
      if (text) onLog({ ts: Date.now(), level: classify(text), text });
    }
  };
  proc.stdout?.on("data", feed);
  proc.stderr?.on("data", feed);
  proc.on("exit", (code) => {
    onLog({ ts: Date.now(), level: code === 0 ? "INFO" : "WARN", text: `process exited · code ${code}` });
    child = null;
    state = { running: false, pid: null, instanceId: null, startedAt: null };
    onState(state);
  });
  return proc.pid ?? -1;
}
const FILE = "settings.json";
function defaultSettings() {
  const totalMb = Math.floor(node_os.totalmem() / 1024 / 1024);
  return {
    gameDir: dirs.root(),
    defaultRamMb: Math.min(4096, Math.floor(totalMb / 2)),
    maxRamMb: totalMb,
    jvmArgs: [],
    windowWidth: 1280,
    windowHeight: 720,
    keepLauncherOpen: true,
    groqApiKey: "",
    skinsInGame: true
  };
}
async function getSettings() {
  return loadJson(FILE, SettingsSchema, defaultSettings());
}
async function setSettings(patch) {
  const next = { ...await getSettings(), ...patch };
  await saveJson(FILE, next);
  return next;
}
const API = "https://api.modrinth.com/v2";
const SearchSchema = objectType({
  hits: arrayType(
    objectType({
      project_id: stringType(),
      slug: stringType(),
      title: stringType(),
      description: stringType(),
      downloads: numberType(),
      follows: numberType(),
      categories: arrayType(stringType()).optional(),
      icon_url: stringType().nullable().optional()
    })
  ),
  total_hits: numberType()
});
const VersionsSchema = arrayType(
  objectType({
    id: stringType(),
    version_number: stringType().optional(),
    date_published: stringType().optional(),
    game_versions: arrayType(stringType()),
    loaders: arrayType(stringType()),
    files: arrayType(
      objectType({
        url: stringType().url(),
        filename: stringType(),
        primary: booleanType(),
        hashes: objectType({ sha1: stringType().optional() }).optional(),
        size: numberType().optional()
      })
    )
  })
);
const SORT_INDEX = {
  relevance: "relevance",
  downloads: "downloads",
  newest: "newest",
  updated: "updated"
};
async function searchMods(query, mcVersion, loader, offset = 0, sort = "relevance") {
  const facets = [
    ["project_type:mod"],
    [`versions:${mcVersion}`],
    ...loader !== "vanilla" ? [[`categories:${loader}`]] : []
  ];
  const url = `${API}/search?query=${encodeURIComponent(query)}&offset=${offset}&limit=20&index=${SORT_INDEX[sort]}&facets=${encodeURIComponent(JSON.stringify(facets))}`;
  const parsed = SearchSchema.parse(await fetchJson(url));
  return {
    totalHits: parsed.total_hits,
    hits: parsed.hits.map((h) => ({
      projectId: h.project_id,
      slug: h.slug,
      title: h.title,
      description: h.description,
      downloads: h.downloads,
      follows: h.follows,
      categories: (h.categories ?? []).filter((c) => !["fabric", "forge", "quilt", "neoforge"].includes(c)),
      iconUrl: h.icon_url ?? null
    }))
  };
}
async function countMods(instanceId) {
  try {
    const files = await promises.readdir(node_path.join(dirs.instanceDir(instanceId), "mods"));
    return files.filter((f) => f.endsWith(".jar")).length;
  } catch {
    return 0;
  }
}
async function listModFiles(instanceId) {
  try {
    const files = await promises.readdir(node_path.join(dirs.instanceDir(instanceId), "mods"));
    return files.filter((f) => f.endsWith(".jar")).sort();
  } catch {
    return [];
  }
}
async function deleteModFile(instanceId, filename) {
  if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    throw new Error("некорректное имя файла");
  }
  await promises.rm(node_path.join(dirs.instanceDir(instanceId), "mods", filename));
  const inst = (await listInstances()).find((i) => i.id === instanceId);
  if (inst) await updateInstance(instanceId, { modsCount: await countMods(instanceId) });
}
async function installMod(projectId, instanceId) {
  const inst = (await listInstances()).find((i) => i.id === instanceId);
  if (!inst) throw new Error("профиль не найден");
  if (inst.loader === "vanilla") throw new Error("vanilla не поддерживает моды · выбери fabric/forge");
  const url = `${API}/project/${projectId}/version?game_versions=${encodeURIComponent(JSON.stringify([inst.mcVersion]))}&loaders=${encodeURIComponent(JSON.stringify([inst.loader]))}`;
  const versions = VersionsSchema.parse(await fetchJson(url));
  if (versions.length === 0) {
    throw new Error(`нет сборки под ${inst.mcVersion} · ${inst.loader}`);
  }
  const version = [...versions].sort(
    (a, b) => (b.date_published ?? "").localeCompare(a.date_published ?? "")
  )[0];
  const file = version.files.find((f) => f.primary) ?? version.files[0];
  if (!file) throw new Error("у версии мода нет файлов");
  await downloadAll([
    {
      url: file.url,
      dest: node_path.join(dirs.instanceDir(instanceId), "mods", file.filename),
      sha1: file.hashes?.sha1,
      size: file.size
    }
  ]);
  await updateInstance(instanceId, { modsCount: await countMods(instanceId) });
}
const MAX_SKIN_BYTES = 256 * 1024;
function skinsDir() {
  return node_path.join(dirs.root(), "skins");
}
function skinFilePath(profileId) {
  return node_path.join(skinsDir(), `${profileId}.png`);
}
async function pickAndSetSkin(profileId) {
  const profile = (await listProfiles()).find((p) => p.id === profileId);
  if (!profile) throw new Error("профиль не найден");
  const result = await electron.dialog.showOpenDialog({
    title: "Выбери скин · PNG 64×64",
    filters: [{ name: "Minecraft skin", extensions: ["png"] }],
    properties: ["openFile"]
  });
  if (result.canceled || !result.filePaths[0]) return false;
  const src = result.filePaths[0];
  const info = await promises.stat(src);
  if (info.size > MAX_SKIN_BYTES) throw new Error("файл больше 256KB · это не скин");
  const buf = await promises.readFile(src);
  if (buf.length < 8 || buf.readUInt32BE(0) !== 2303741511) {
    throw new Error("файл не png");
  }
  await promises.mkdir(skinsDir(), { recursive: true });
  const dest = skinFilePath(profileId);
  await promises.copyFile(src, dest);
  await updateProfile(profileId, { skinPath: dest });
  return true;
}
async function getSkinDataUrl(profileId) {
  const profile = (await listProfiles()).find((p) => p.id === profileId);
  if (!profile?.skinPath) return null;
  try {
    const buf = await promises.readFile(profile.skinPath);
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
async function clearSkin(profileId) {
  await promises.rm(skinFilePath(profileId), { force: true });
  await updateProfile(profileId, { skinPath: null });
}
const APP_VERSION = "1.0.0-beta";
const GITHUB_REPO = "AkyRayy/akylauncher";
const ReleaseSchema = objectType({
  tag_name: stringType(),
  html_url: stringType().url(),
  prerelease: booleanType().optional(),
  draft: booleanType().optional()
});
function parseSemver(tag) {
  const m = tag.replace(/^v/i, "").match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!m) return [0, 0, 0];
  return [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
}
function isNewer(latest, current) {
  const a = parseSemver(latest);
  const b = parseSemver(current);
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false;
}
async function checkUpdate() {
  const none = { available: false, current: APP_VERSION, latest: null, url: null };
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/vnd.github+json" }
    });
    if (!res.ok) return none;
    const release = ReleaseSchema.parse(await res.json());
    if (release.draft) return none;
    const latest = release.tag_name;
    return {
      available: isNewer(latest, APP_VERSION),
      current: APP_VERSION,
      latest,
      url: release.html_url
    };
  } catch {
    return none;
  }
}
const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 4294967295;
  for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 255] ^ c >>> 8;
  return (c ^ 4294967295) >>> 0;
}
async function walk(dir, base, out) {
  for (const e of await promises.readdir(dir, { withFileTypes: true })) {
    const p = node_path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, base, out);
    else out.push(node_path.relative(base, p).split("\\").join("/"));
  }
}
async function zipDirectory(srcDir, destFile, extra = []) {
  const files = [];
  await walk(srcDir, srcDir, files);
  files.sort();
  const entries = [];
  for (const rel of files) {
    entries.push({ name: Buffer.from(rel, "utf8"), data: await promises.readFile(node_path.join(srcDir, rel)) });
  }
  for (const e of extra) {
    entries.push({ name: Buffer.from(e.name, "utf8"), data: e.data });
  }
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const crc = crc32(data);
    const deflated = node_zlib.deflateRawSync(data, { level: 6 });
    const useDeflate = deflated.length < data.length;
    const payload = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(67324752, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(2048, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    chunks.push(local, name, payload);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(33639248, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(2048, 8);
    cen.writeUInt16LE(method, 10);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(payload.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(name.length, 28);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, name);
    offset += local.length + name.length + payload.length;
  }
  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(101010256, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  await promises.writeFile(destFile, Buffer.concat([...chunks, centralBuf, eocd]));
  return entries.length;
}
const FabricLoaderListSchema = arrayType(
  objectType({ loader: objectType({ version: stringType(), stable: booleanType().optional() }) })
);
const LoaderProfileSchema = objectType({
  id: stringType(),
  inheritsFrom: stringType().optional(),
  mainClass: stringType(),
  libraries: arrayType(
    objectType({
      name: stringType(),
      url: stringType().optional(),
      sha1: stringType().optional()
    })
  ).default([])
});
const META = {
  fabric: { meta: "https://meta.fabricmc.net/v2", maven: "https://maven.fabricmc.net" },
  quilt: { meta: "https://meta.quiltmc.org/v3", maven: "https://maven.quiltmc.org/repository/release" }
};
async function installFabricLike(kind, mcVersion) {
  const { meta, maven } = META[kind];
  const loadersRaw = await fetchJson(`${meta}/versions/loader/${encodeURIComponent(mcVersion)}`);
  const loaders = FabricLoaderListSchema.parse(loadersRaw);
  if (loaders.length === 0) {
    throw new Error(`${kind}: нет лоадера под ${mcVersion} · проверь, что версия поддерживается`);
  }
  const stable = loaders.find((l) => l.loader.stable !== false) ?? loaders[0];
  const loaderVersion = stable.loader.version;
  const profileRaw = await fetchJson(
    `${meta}/versions/loader/${encodeURIComponent(mcVersion)}/${encodeURIComponent(loaderVersion)}/profile/json`
  );
  const profile = LoaderProfileSchema.parse(profileRaw);
  const vdir = dirs.versionDir(profile.id);
  await promises.mkdir(vdir, { recursive: true });
  await promises.writeFile(node_path.join(vdir, `${profile.id}.json`), JSON.stringify(profileRaw, null, 2));
  const tasks = [];
  for (const lib of profile.libraries) {
    let rel;
    try {
      rel = mavenToPath(lib.name);
    } catch {
      continue;
    }
    const base = (lib.url ?? maven).replace(/\/$/, "");
    tasks.push({
      url: `${base}/${rel}`,
      dest: node_path.join(dirs.libraries(), rel),
      sha1: lib.sha1
    });
  }
  await downloadAll(tasks, 8);
  return profile.id;
}
const execFileAsync = node_util.promisify(node_child_process.execFile);
const PromosSchema = objectType({ promos: recordType(stringType()) });
function pickForgeVersion(promos, mcVersion) {
  return promos[`${mcVersion}-recommended`] ?? promos[`${mcVersion}-latest`] ?? null;
}
function parseMavenVersions(xml) {
  return [...xml.matchAll(/<version>([^<]+)<\/version>/g)].map((m) => m[1]);
}
function pickNeoforgeVersion(versions, mcVersion) {
  const m = mcVersion.match(/^1\.(\d+)(?:\.(\d+))?$/);
  if (!m) return null;
  const prefix = `${m[1]}.${m[2] ?? "0"}.`;
  const stable = versions.filter((v) => v.startsWith(prefix) && !v.includes("beta"));
  const pool = stable.length ? stable : versions.filter((v) => v.startsWith(prefix));
  return pool.length ? pool[pool.length - 1] : null;
}
async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`http ${res.status} ${url}`);
  return res.text();
}
async function installForgeLike(kind, mcVersion, javaPath, onLog) {
  let installerUrl;
  if (kind === "forge") {
    const promos = PromosSchema.parse(
      await fetchJson("https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json")
    ).promos;
    const ver = pickForgeVersion(promos, mcVersion);
    if (!ver) throw new Error(`forge: нет сборки под ${mcVersion}`);
    const full = `${mcVersion}-${ver}`;
    installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${full}/forge-${full}-installer.jar`;
  } else {
    const xml = await fetchText(
      "https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml"
    );
    const ver = pickNeoforgeVersion(parseMavenVersions(xml), mcVersion);
    if (!ver) throw new Error(`neoforge: нет сборки под ${mcVersion}`);
    installerUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${ver}/neoforge-${ver}-installer.jar`;
  }
  const root = dirs.root();
  await promises.mkdir(dirs.versions(), { recursive: true });
  const profilesFile = node_path.join(root, "launcher_profiles.json");
  try {
    await promises.access(profilesFile);
  } catch {
    await promises.writeFile(profilesFile, JSON.stringify({ profiles: {} }));
  }
  const installer = node_path.join(root, `${kind}-installer-${mcVersion}.jar`);
  onLog(`${kind} · скачиваю installer`);
  await downloadAll([{ url: installerUrl, dest: installer }]);
  const before = new Set(await promises.readdir(dirs.versions()).catch(() => []));
  onLog(`${kind} · запускаю installer · это может занять пару минут`);
  try {
    await execFileAsync(javaPath, ["-jar", installer, "--installClient", root], {
      timeout: 10 * 6e4,
      maxBuffer: 32 * 1024 * 1024
    });
  } catch (err) {
    throw new Error(`${kind} installer · ${String(err.message).slice(0, 300)}`);
  }
  const after = await promises.readdir(dirs.versions());
  const created = after.find((d) => !before.has(d) && d !== mcVersion);
  if (!created) throw new Error(`${kind} installer не создал версию`);
  onLog(`${kind} · версия ${created} готова`);
  return created;
}
const LatestSchema = objectType({
  version: stringType(),
  download_url: stringType().url()
});
async function ensureAuthlibInjector() {
  const dir = node_path.join(dirs.root(), "authlib");
  const jar = node_path.join(dir, "authlib-injector.jar");
  try {
    await promises.access(jar);
    return jar;
  } catch {
    const latest = LatestSchema.parse(
      await fetchJson("https://authlib-injector.yushi.moe/artifact/latest.json")
    );
    await promises.mkdir(dir, { recursive: true });
    await downloadAll([{ url: latest.download_url, dest: jar }]);
    return jar;
  }
}
function elyJvmArgs(jarPath) {
  return [`-javaagent:${jarPath}=ely.by`, "-Dauthlibinjector.side=client"];
}
const log = (io, level, text) => io.onLog({ ts: Date.now(), level, text });
async function bootstrapAndLaunch(inst, session, io) {
  log(io, "INFO", `launch · ${inst.name} · ${inst.mcVersion} · ${inst.loader}`);
  if (!await isVersionInstalled(inst.mcVersion)) {
    log(io, "INFO", `версия ${inst.mcVersion} не установлена · скачиваю`);
    await installVersion(inst.mcVersion, io.onProgress);
    log(io, "INFO", `версия ${inst.mcVersion} · готова`);
  }
  const baseJson = await resolveVersionJson(inst.mcVersion);
  const major = requiredJavaMajor(inst.mcVersion, baseJson.javaVersion?.majorVersion);
  log(io, "INFO", `java ${major} · проверяю`);
  io.onProgress({
    taskId: `java-${major}`,
    label: `java ${major}`,
    ratio: 0.3,
    done: 0,
    total: 1,
    speedBps: 0,
    phase: "java",
    message: `java ${major} · поиск или загрузка`
  });
  const java = inst.javaPath ? { path: inst.javaPath, version: "custom" } : await ensureJava(major);
  io.onProgress({
    taskId: `java-${major}`,
    label: `java ${major}`,
    ratio: 1,
    done: 1,
    total: 1,
    speedBps: 0,
    phase: "done",
    message: `java ${major} · установлена`
  });
  log(io, "INFO", `java ${java.version} · ${java.path}`);
  let launchId = inst.loaderVersion ?? inst.mcVersion;
  const needLoader = inst.loader !== "vanilla" && !(inst.loaderVersion && await isVersionInstalled(inst.loaderVersion, false));
  if (needLoader) {
    log(io, "INFO", `${inst.loader} · устанавливаю`);
    io.onProgress({
      taskId: `loader-${inst.id}`,
      label: inst.loader,
      ratio: 0.5,
      done: 0,
      total: 1,
      speedBps: 0,
      phase: "loader",
      message: `${inst.loader} · установка`
    });
    if (inst.loader === "fabric" || inst.loader === "quilt") {
      launchId = await installFabricLike(inst.loader, inst.mcVersion);
    } else if (inst.loader === "forge" || inst.loader === "neoforge") {
      launchId = await installForgeLike(
        inst.loader,
        inst.mcVersion,
        java.path,
        (t) => log(io, "INFO", t)
      );
    }
    await updateInstance(inst.id, { loaderVersion: launchId });
    inst = { ...inst, loaderVersion: launchId };
    io.onProgress({
      taskId: `loader-${inst.id}`,
      label: inst.loader,
      ratio: 1,
      done: 1,
      total: 1,
      speedBps: 0,
      phase: "done",
      message: `${inst.loader} · готов`
    });
    log(io, "INFO", `${inst.loader} · профиль ${launchId}`);
  }
  const vjson = await resolveVersionJson(launchId);
  const extraJvmArgs = [];
  const settings = await getSettings();
  if (settings.skinsInGame) {
    try {
      log(io, "INFO", "скины в игре · подключаю authlib-injector (ely.by)");
      const jar = await ensureAuthlibInjector();
      extraJvmArgs.push(...elyJvmArgs(jar));
      log(io, "INFO", "authlib-injector · готов · скин подтянется с ely.by по нику");
    } catch (err) {
      log(io, "WARN", `authlib-injector недоступен · ${err.message} · запускаю без скинов`);
    }
  }
  log(io, "INFO", "собираю аргументы и запускаю jvm");
  const pid = await spawnGame(inst, vjson, launchId, session, java.path, io.onLog, io.onState, extraJvmArgs);
  log(io, "INFO", `process started · pid ${pid}`);
  await updateInstance(inst.id, { lastPlayedAt: (/* @__PURE__ */ new Date()).toISOString() });
  return pid;
}
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const ChatRespSchema = objectType({
  choices: arrayType(objectType({ message: objectType({ content: stringType() }) })).min(1)
});
function buildAnalysisMessages(lines, context) {
  const tail = lines.slice(-120);
  return [
    {
      role: "system",
      content: [
        "Ты — встроенный диагност Minecraft-лаунчера AkyLauncher.",
        "Тебе дают хвост лога запуска/игры. Найди причину проблемы и дай решение.",
        "Формат ответа — строго:",
        "ДИАГНОЗ: одна строка — что сломалось.",
        "ПРИЧИНА: 1-2 строки — почему.",
        "РЕШЕНИЕ: нумерованные шаги, максимум 5, каждый — конкретное действие.",
        "Пиши по-русски, коротко, без эмодзи и без воды.",
        "Если лог чистый и ошибок нет — так и скажи одной строкой.",
        "Частые случаи: несовместимость версий модов и игры, нехватка RAM (OutOfMemoryError),",
        "неправильная версия Java (UnsupportedClassVersionError), отсутствие Fabric API,",
        "конфликты модов (Mixin apply failed), битые библиотеки (ClassNotFoundException)."
      ].join("\n")
    },
    {
      role: "user",
      content: `Контекст: ${context}

Лог:
${tail.join("\n")}`
    }
  ];
}
async function analyzeLog(lines, context) {
  const settings = await getSettings();
  const key = settings.groqApiKey.trim();
  if (!key) throw new Error("нет api-ключа · настройки → ии");
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: buildAnalysisMessages(lines, context),
      temperature: 0.2,
      max_tokens: 700
    })
  });
  if (res.status === 401) throw new Error("ключ отклонён · проверь его в console.groq.com");
  if (res.status === 429) throw new Error("лимит groq исчерпан · попробуй позже");
  if (!res.ok) throw new Error(`groq недоступен · http ${res.status}`);
  const parsed = ChatRespSchema.parse(await res.json());
  return parsed.choices[0].message.content.trim();
}
function registerIpc(win2) {
  const emit = (channel, payload) => {
    if (!win2.isDestroyed()) win2.webContents.send(channel, payload);
  };
  const handle = (channel, fn) => {
    electron.ipcMain.handle(channel, (_evt, ...args) => fn(...args));
  };
  handle("versions:list", ({ force } = {}) => listVersions(force));
  handle("versions:install", async ({ versionId }) => {
    const taskId = `install-${versionId}`;
    void installVersion(versionId, (p) => emit("evt:download-progress", p)).catch(() => void 0);
    return { taskId };
  });
  handle("instances:list", () => listInstances());
  handle("instances:create", async ({ name, mcVersion, loader }) => {
    const s = await getSettings();
    return createInstance(name, mcVersion, loader, {
      ramMb: s.defaultRamMb,
      windowWidth: s.windowWidth,
      windowHeight: s.windowHeight
    });
  });
  handle("instances:update", ({ id, patch }) => updateInstance(id, patch));
  handle("instances:delete", ({ id }) => deleteInstance(id));
  handle("instances:export", async ({ id }) => {
    const inst = (await listInstances()).find((i) => i.id === id);
    if (!inst) throw new Error("профиль не найден");
    const safe = inst.name.replace(/[^\w\d-]+/g, "_").toLowerCase() || "profile";
    const result = await electron.dialog.showSaveDialog({
      title: "Экспорт профиля",
      defaultPath: `${safe}-${inst.mcVersion}.zip`,
      filters: [{ name: "Zip archive", extensions: ["zip"] }]
    });
    if (result.canceled || !result.filePath) return { ok: false, path: null, files: 0 };
    const manifest = Buffer.from(
      JSON.stringify(
        {
          format: "akylauncher/profile@1",
          name: inst.name,
          mcVersion: inst.mcVersion,
          loader: inst.loader,
          loaderVersion: inst.loaderVersion,
          ramMb: inst.ramMb,
          jvmArgs: inst.jvmArgs,
          windowWidth: inst.windowWidth,
          windowHeight: inst.windowHeight,
          exportedAt: (/* @__PURE__ */ new Date()).toISOString()
        },
        null,
        2
      )
    );
    const files = await zipDirectory(dirs.instanceDir(id), result.filePath, [
      { name: "akyprofile.json", data: manifest }
    ]);
    return { ok: true, path: result.filePath, files };
  });
  handle("profiles:list", () => listProfiles());
  handle("profiles:createOffline", ({ nickname }) => createOfflineProfile(nickname));
  handle("profiles:setActive", ({ id }) => setActiveProfile(id));
  handle("profiles:delete", ({ id }) => deleteProfile(id));
  handle("profiles:setSkin", async ({ id }) => ({ ok: await pickAndSetSkin(id) }));
  handle("profiles:getSkin", async ({ id }) => ({ dataUrl: await getSkinDataUrl(id) }));
  handle("profiles:clearSkin", ({ id }) => clearSkin(id));
  handle("java:list", () => listJava());
  handle("java:ensure", async ({ major }) => {
    emit("evt:download-progress", {
      taskId: `java-${major}`,
      label: `temurin ${major}`,
      ratio: 0.5,
      done: 0,
      total: 1,
      speedBps: 0,
      phase: "java",
      message: `java ${major} · загрузка`
    });
    const rt = await ensureJava(major);
    emit("evt:download-progress", {
      taskId: `java-${major}`,
      label: `temurin ${major}`,
      ratio: 1,
      done: 1,
      total: 1,
      speedBps: 0,
      phase: "done",
      message: `java ${major} · установлена`
    });
    return rt;
  });
  handle("game:launch", async ({ instanceId }) => {
    const inst = (await listInstances()).find((i) => i.id === instanceId);
    if (!inst) throw new Error("профиль не найден");
    const profile = await activeProfile();
    if (!profile) throw new Error("нет активного профиля · добавь ник");
    try {
      const pid = await bootstrapAndLaunch(inst, offlineSession(profile.nickname), {
        onProgress: (p) => emit("evt:download-progress", p),
        onLog: (l) => emit("evt:game-log", l),
        onState: (s) => emit("evt:game-state", s)
      });
      return { pid };
    } catch (err) {
      const msg = err.message;
      emit("evt:game-log", { ts: Date.now(), level: "ERROR", text: `launch failed · ${msg}` });
      emit("evt:download-progress", {
        taskId: `launch-${instanceId}`,
        label: inst.name,
        ratio: 0,
        done: 0,
        total: 0,
        speedBps: 0,
        phase: "error",
        message: `запуск прерван · ${msg}`
      });
      throw err;
    }
  });
  handle("game:kill", async () => killGame());
  handle("game:state", async () => gameState());
  handle("settings:get", () => getSettings());
  handle("settings:set", ({ patch }) => setSettings(patch));
  handle(
    "modrinth:search",
    ({ query, mcVersion, loader, offset, sort }) => searchMods(query, mcVersion, loader, offset, sort)
  );
  handle("modrinth:install", ({ projectId, instanceId }) => installMod(projectId, instanceId));
  handle("mods:listFiles", ({ instanceId }) => listModFiles(instanceId));
  handle("mods:deleteFile", ({ instanceId, filename }) => deleteModFile(instanceId, filename));
  handle("ai:analyze", async ({ lines, context }) => ({ text: await analyzeLog(lines, context) }));
  handle("app:openDir", async ({ instanceId } = {}) => {
    await electron.shell.openPath(instanceId ? dirs.instanceDir(instanceId) : dirs.root());
  });
  handle("app:checkUpdate", () => checkUpdate());
  handle("win:minimize", async () => win2.minimize());
  handle("win:maximize", async () => win2.isMaximized() ? win2.unmaximize() : win2.maximize());
  handle("win:close", async () => win2.close());
}
let win = null;
function createWindow() {
  win = new electron.BrowserWindow({
    width: 1240,
    height: 780,
    minWidth: 1024,
    minHeight: 640,
    frame: false,
    backgroundColor: "#0E0F0C",
    show: false,
    webPreferences: {
      preload: node_path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  win.once("ready-to-show", () => win?.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    void electron.shell.openExternal(url);
    return { action: "deny" };
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(node_path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  createWindow();
  if (win) registerIpc(win);
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
