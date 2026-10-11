import { describe, it, expect } from "vitest";
import { APP_NAME } from "../src/App";
describe("app", () => {
  it("names itself", () => { expect(APP_NAME).toBe("DROOOLY Visualize"); });
});
