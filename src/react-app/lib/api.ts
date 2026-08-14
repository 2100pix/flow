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

  const body = (await response.json().catch(() => null)) as T | ApiErrorBody | null;

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event(SESSION_INVALID_EVENT));
    }

    const errorBody = body as ApiErrorBody | null;

    throw new ApiError(response.status, errorBody?.error?.code ?? "REQUEST_FAILED", errorBody?.error?.message ?? "Request failed");
  }

  return body as T;
}
