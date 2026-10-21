import { describe, expect, it } from "vitest";
import { loadCatalog } from "../src/data/catalog";
import { decode } from "../src/flow";
import { buildRow, isBadCode, isRateLimit } from "../src/data/account";

const cat = loadCatalog();

describe("account", () => {
  it("buildRow names the build in words and keeps the share path", () => {
    const b = decode("v=f250&y=2021&p=race-red&l=4&b=jtx&m=Ace&s=26x14&f=polished&t=37x13.50R26", cat);
    const row = buildRow(cat, b, "abc");
    expect(row.source).toBe("visualize");
    expect(row.name).toContain("2021 Ford");
    expect(row.name).toContain("Ace 26x14");
    expect(row.name.length).toBeLessThanOrEqual(80);
    expect(row.url.startsWith("/visualize/?v=f250")).toBe(true);
    expect(row.url).toContain("p=race-red");
    expect(row.still_key).toBe("abc");
  });

  it("buildRow without a still carries null, never a price", () => {
    const b = decode("v=f150&y=2024&p=white", cat);
    const row = buildRow(cat, b);
    expect(row.still_key).toBeNull();
    expect(JSON.stringify(row)).not.toMatch(/\$|price|total/i);
  });

  it("recognises the two shopper-facing failures", () => {
    expect(isRateLimit(new Error("For security purposes, you can only request this after 59 seconds."))).toBe(true);
    expect(isRateLimit(new Error("email rate limit exceeded"))).toBe(true);
    expect(isBadCode(new Error("Token has expired or is invalid"))).toBe(true);
    expect(isBadCode(new Error("network"))).toBe(false);
  });
});
