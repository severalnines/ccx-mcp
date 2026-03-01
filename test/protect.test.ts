import { describe, it, expect, afterEach } from "vitest";
import { isProtected, protectedError } from "../src/protect.js";

describe("isProtected", () => {
  afterEach(() => {
    delete process.env.CCX_PROTECT;
  });

  it("returns true when CCX_PROTECT is not set", () => {
    delete process.env.CCX_PROTECT;
    expect(isProtected()).toBe(true);
  });

  it("returns true when CCX_PROTECT is 'true'", () => {
    process.env.CCX_PROTECT = "true";
    expect(isProtected()).toBe(true);
  });

  it("returns false when CCX_PROTECT is 'false'", () => {
    process.env.CCX_PROTECT = "false";
    expect(isProtected()).toBe(false);
  });

  it("returns false when CCX_PROTECT is '0'", () => {
    process.env.CCX_PROTECT = "0";
    expect(isProtected()).toBe(false);
  });

  it("returns false when CCX_PROTECT is 'FALSE'", () => {
    process.env.CCX_PROTECT = "FALSE";
    expect(isProtected()).toBe(false);
  });

  it("returns true for random string", () => {
    process.env.CCX_PROTECT = "yes";
    expect(isProtected()).toBe(true);
  });
});

describe("protectedError", () => {
  it("returns error response with correct shape", () => {
    const result = protectedError("Delete datastore");
    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
  });

  it("includes the operation name", () => {
    const result = protectedError("Delete datastore");
    expect(result.content[0].text).toContain("Delete datastore");
  });

  it("includes disable instructions", () => {
    const result = protectedError("Delete datastore");
    expect(result.content[0].text).toContain("CCX_PROTECT=false");
  });
});
