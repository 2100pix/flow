type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
};
export const SESSION_INVALID_EVENT = "flow:session-invalid";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch<T>(input: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);

  headers.set("Accept", "application/json");

  const response = await fetch(input, {
    ...init,
    headers,
    credentials: "same-origin",
  });

  // SAFETY: this is the app-wide I/O boundary for fetch responses. The raw JSON is intentionally not schema-validated here;
  // every field read below is an optional access with a fallback string, and typed decoding is owned by each API client function.
  const body = (await response.json().catch(() => null)) as T | ApiErrorBody | null;

  if (!response.ok) {
    window.dispatchEvent(new Event(SESSION_INVALID_EVENT));

    // SAFETY: same untrusted payload captured above; every ApiErrorBody field is optional so a mismatch degrades to the fallback code/message.
    const errorBody = body as ApiErrorBody | null;

    throw new ApiError(response.status, errorBody?.error?.code ?? "REQUEST_FAILED", errorBody?.error?.message ?? "Request failed");
  }

  // SAFETY: on 2xx the payload is trusted to match the return type declared by the calling API client function.
  return body as T;
}
