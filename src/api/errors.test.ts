import { describe, expect, it } from "vitest";

import { formatGatewayError, isAbortError, networkErrorMessage } from "./errors";

describe("formatGatewayError", () => {
  it("usa o texto de orçamento", () => {
    expect(
      formatGatewayError({ status: 402, reasonCode: "BUDGET_EXCEEDED", message: "x" }),
    ).toMatch(/orçamento mensal/);
  });

  it("não trata 402 genérico como UPSTREAM", () => {
    expect(formatGatewayError({ status: 402, message: "payment" })).toMatch(/saldo/);
  });
});

describe("networkErrorMessage", () => {
  it("reconhece abort", () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    expect(isAbortError(err)).toBe(true);
    expect(networkErrorMessage(err)).toMatch(/interrompid/);
  });
});
