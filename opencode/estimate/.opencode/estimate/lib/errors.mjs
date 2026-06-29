export class EstimateError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "EstimateError";
    this.code = code;
    this.details = details;
  }
}

export function toBoundedString(value, limit = 240) {
  const text = String(value ?? "");
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit)}...`;
}

export function formatCliError(error) {
  if (error instanceof EstimateError) {
    return JSON.stringify({
      ok: false,
      code: error.code,
      message: toBoundedString(error.message),
      details: error.details,
    });
  }

  return JSON.stringify({
    ok: false,
    code: "E_UNEXPECTED",
    message: toBoundedString(error?.message ?? error),
  });
}
