import { describe, expect, it } from "vitest";
import { applyBuild, committedBuild, markCommitted, registerBuildSetter } from "../src/dev/exportBridge";

describe("exportBridge", () => {
  it("applyBuild throws until a setter is registered, then returns what the setter applied", () => {
    expect(() => applyBuild("v=f250")).toThrow(/no build setter/);
    const off = registerBuildSetter((q) => `?${q}&p=white`);
    expect(applyBuild("v=f250")).toBe("?v=f250&p=white");
    off();
    expect(() => applyBuild("v=f250")).toThrow();
  });

  it("unregister ignores a setter that was already replaced", () => {
    const off1 = registerBuildSetter(() => "one");
    registerBuildSetter(() => "two");
    off1();
    expect(applyBuild("x")).toBe("two");
  });

  it("remembers the last committed build", () => {
    markCommitted("?v=f150");
    expect(committedBuild()).toBe("?v=f150");
  });
});
