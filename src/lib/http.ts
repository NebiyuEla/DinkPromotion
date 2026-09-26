import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class AppError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "BAD_REQUEST") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function jsonError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid request", code: "VALIDATION_ERROR", details: error.flatten() },
      { status: 400 },
    );
  }
  console.error(error);
  return NextResponse.json(
    { error: "Something went wrong", code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}
