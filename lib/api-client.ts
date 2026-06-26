import type { ApiResponse } from "@/lib/server/api-response";

export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: string
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function readApiResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiResponse<T> | T;

  if (typeof payload !== "object" || payload === null || !("success" in payload)) {
    if (!response.ok) {
      const legacyError = payload as { error?: string; message?: string };
      throw new ApiClientError(
        "REQUEST_FAILED",
        legacyError.error ?? legacyError.message ?? `HTTP ${response.status}`,
        response.status
      );
    }

    return payload as T;
  }

  if (!payload.success) {
    throw new ApiClientError(payload.error.code, payload.error.message, response.status, payload.error.details);
  }

  return payload.data;
}

export async function readOptionalApiResponse<T>(response: Response): Promise<T | null> {
  if (response.status === 404) {
    return null;
  }

  return readApiResponse<T>(response);
}
