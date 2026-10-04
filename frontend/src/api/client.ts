import type { Session } from "./types";
let csrf = "";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
function errorText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(errorText).join(" ");
  if (value && typeof value === "object")
    return Object.entries(value)
      .map(
        ([key, text]) =>
          `${key === "detail" || key === "non_field_errors" ? "" : key + ": "}${errorText(text)}`,
      )
      .join(" ");
  return "The request could not be completed.";
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (csrf) headers.set("X-CSRFToken", csrf);
  const response = await fetch("/api/v1/" + path, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  const data = await response
    .json()
    .catch(() => ({
      detail: "Unexpected response. Please reload and try again.",
    }));
  if (!response.ok) throw new ApiError(errorText(data), response.status);
  return data as T;
}
export async function session(): Promise<Session> {
  const result = await api<Session>("session/");
  csrf = result.csrf;
  return result;
}
export function write<T>(path: string, data: unknown, method = "POST") {
  return api<T>(path, { method, body: JSON.stringify(data) });
}
export const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
