export type SearchParamValue = string | string[] | undefined;
export type RouteSearchParams = Record<string, SearchParamValue>;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function readSingleSearchParam(value: SearchParamValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function readSearchParamAlias(
  params: RouteSearchParams,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = readSingleSearchParam(params[key]);
    if (value) {
      return value;
    }
  }
  return undefined;
}

export function parsePositiveIntParam(
  value: SearchParamValue,
  options: {
    defaultValue: number;
    min: number;
    max: number;
    field: string;
  },
) {
  const raw = readSingleSearchParam(value);
  if (!raw) {
    return { value: options.defaultValue, error: null as string | null };
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < options.min || parsed > options.max) {
    return {
      value: options.defaultValue,
      error: `Tham số "${options.field}" phải là số nguyên trong khoảng ${options.min}-${options.max}.`,
    };
  }

  return { value: parsed, error: null as string | null };
}

export function parseOptionalPositiveIntParam(
  value: SearchParamValue,
  options: {
    min: number;
    max: number;
    field: string;
  },
) {
  const raw = readSingleSearchParam(value);
  if (!raw) {
    return { value: undefined as number | undefined, error: null as string | null };
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < options.min || parsed > options.max) {
    return {
      value: undefined as number | undefined,
      error: `Tham số "${options.field}" phải là số nguyên trong khoảng ${options.min}-${options.max}.`,
    };
  }

  return { value: parsed, error: null as string | null };
}

export function parseSlugParam(value: SearchParamValue, field: string) {
  const raw = readSingleSearchParam(value);
  if (!raw) {
    return { value: undefined, error: null as string | null };
  }

  if (!SLUG_PATTERN.test(raw)) {
    return {
      value: undefined,
      error: `Tham số "${field}" không đúng định dạng slug hợp lệ.`,
    };
  }

  return { value: raw, error: null as string | null };
}

export function parseSortParam(
  value: SearchParamValue,
  allowedSorts: readonly string[],
  defaultValue: string,
) {
  const raw = readSingleSearchParam(value);
  if (!raw) {
    return { value: defaultValue, error: null as string | null };
  }

  if (!allowedSorts.includes(raw)) {
    return {
      value: defaultValue,
      error: `Tham số "sort" không hợp lệ. Giá trị cho phép: ${allowedSorts.join(", ")}.`,
    };
  }

  return { value: raw, error: null as string | null };
}

export function parseTextParam(value: SearchParamValue, maxLength: number) {
  const raw = readSingleSearchParam(value);
  if (!raw) {
    return { value: undefined, error: null as string | null };
  }

  if (raw.length > maxLength) {
    return {
      value: undefined,
      error: `Tham số text vượt quá ${maxLength} ký tự.`,
    };
  }

  return { value: raw, error: null as string | null };
}

export function collectErrors(...errors: Array<string | null>): string[] {
  return errors.filter((item): item is string => Boolean(item));
}

export function buildQueryString(
  params: Record<string, string | number | null | undefined>,
): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") {
      continue;
    }
    query.set(key, String(value));
  }

  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}
