import { NextResponse } from "next/server";

export type ApiErrorBody = {
  code: string;
  message: string;
  details?: string;
};

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ApiErrorBody };

export function apiOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data } satisfies ApiResponse<T>, init);
}

export function apiError(message: string, status: number, code = "REQUEST_FAILED", details?: string) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {})
      }
    } satisfies ApiResponse<never>,
    { status }
  );
}

export function isApiResponse<T>(payload: unknown): payload is ApiResponse<T> {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "success" in payload &&
    typeof (payload as ApiResponse<T>).success === "boolean"
  );
}
