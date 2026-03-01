import { describe, it, expect } from "vitest";
import { validateDatabaseName, validateUsername } from "../src/validate.js";

describe("validateDatabaseName", () => {
  it("accepts a valid name", () => {
    expect(validateDatabaseName("my_app_db")).toBeNull();
  });

  it("accepts a name starting with underscore", () => {
    expect(validateDatabaseName("_private")).toBeNull();
  });

  it("accepts a single letter", () => {
    expect(validateDatabaseName("a")).toBeNull();
  });

  it("rejects empty string", () => {
    const err = validateDatabaseName("");
    expect(err).toContain("cannot be empty");
  });

  it("rejects whitespace-only string", () => {
    const err = validateDatabaseName("   ");
    expect(err).toContain("cannot be empty");
  });

  it("rejects reserved name 'mysql'", () => {
    const err = validateDatabaseName("mysql");
    expect(err).toContain("reserved");
  });

  it("rejects reserved name 'ccxdb'", () => {
    const err = validateDatabaseName("ccxdb");
    expect(err).toContain("reserved");
  });

  it("rejects reserved name 'information_schema'", () => {
    const err = validateDatabaseName("information_schema");
    expect(err).toContain("reserved");
  });

  it("rejects reserved name 'postgres'", () => {
    const err = validateDatabaseName("postgres");
    expect(err).toContain("reserved");
  });

  it("is case-insensitive for reserved names", () => {
    const err = validateDatabaseName("MySQL");
    expect(err).toContain("reserved");
  });

  it("rejects name with hyphens", () => {
    const err = validateDatabaseName("my-db");
    expect(err).toContain("Must start with a letter or underscore");
  });

  it("rejects name starting with a digit", () => {
    const err = validateDatabaseName("123abc");
    expect(err).toContain("Must start with a letter or underscore");
  });

  it("rejects name with spaces", () => {
    const err = validateDatabaseName("my db");
    expect(err).toContain("Must start with a letter or underscore");
  });

  it("rejects name exceeding 63 characters", () => {
    const longName = "a".repeat(64);
    const err = validateDatabaseName(longName);
    expect(err).toContain("cannot exceed 63 characters");
    expect(err).toContain("got 64");
  });

  it("accepts name of exactly 63 characters", () => {
    const name = "a".repeat(63);
    expect(validateDatabaseName(name)).toBeNull();
  });
});

describe("validateUsername", () => {
  it("accepts a valid username", () => {
    expect(validateUsername("appuser")).toBeNull();
  });

  it("accepts username with dots and hyphens", () => {
    expect(validateUsername("my-app.user")).toBeNull();
  });

  it("rejects empty string", () => {
    const err = validateUsername("");
    expect(err).toContain("cannot be empty");
  });

  it("rejects whitespace-only string", () => {
    const err = validateUsername("   ");
    expect(err).toContain("cannot be empty");
  });

  it("rejects reserved username 'root'", () => {
    const err = validateUsername("root");
    expect(err).toContain("reserved");
  });

  it("rejects reserved username 'postgres'", () => {
    const err = validateUsername("postgres");
    expect(err).toContain("reserved");
  });

  it("rejects reserved username 'cmon'", () => {
    const err = validateUsername("cmon");
    expect(err).toContain("reserved");
  });

  it("rejects reserved username 'default'", () => {
    const err = validateUsername("default");
    expect(err).toContain("reserved");
  });

  it("rejects reserved username 'mysql'", () => {
    const err = validateUsername("mysql");
    expect(err).toContain("reserved");
  });

  it("rejects username exceeding 63 characters", () => {
    const longName = "u".repeat(64);
    const err = validateUsername(longName);
    expect(err).toContain("cannot exceed 63 characters");
    expect(err).toContain("got 64");
  });

  it("accepts username of exactly 63 characters", () => {
    const name = "u".repeat(63);
    expect(validateUsername(name)).toBeNull();
  });
});
