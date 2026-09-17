import { describe, expect, it } from "vitest";

import { previewPlain, stabilizeStreamingMarkdown } from "./MarkdownBody";

describe("previewPlain", () => {
  it("tira ênfase e títulos do preview da lista", () => {
    expect(previewPlain("**Olá** — o que você sabe sobre SQL")).toBe(
      "Olá — o que você sabe sobre SQL",
    );
    expect(previewPlain("# Política\n\nVer `estoque`")).toBe("Política Ver estoque");
  });
});

describe("stabilizeStreamingMarkdown", () => {
  it("fecha cerca de código aberta no stream", () => {
    expect(stabilizeStreamingMarkdown("veja:\n```sql\nSELECT 1")).toBe(
      "veja:\n```sql\nSELECT 1\n```",
    );
  });

  it("fecha negrito e código inline abertos", () => {
    expect(stabilizeStreamingMarkdown("**olá e `sku")).toBe("**olá e `sku`**");
  });
});
