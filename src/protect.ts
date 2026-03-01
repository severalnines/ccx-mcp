/**
 * Protection mode prevents destructive operations from being executed.
 * Enabled by default — set CCX_PROTECT=false or CCX_PROTECT=0 to disable.
 */

export function isProtected(): boolean {
  const val = process.env.CCX_PROTECT?.toLowerCase();
  return val !== "false" && val !== "0";
}

export function protectedError(operation: string) {
  return {
    content: [
      {
        type: "text" as const,
        text:
          `BLOCKED: "${operation}" is not allowed while protection mode is enabled. ` +
          `Protection mode prevents destructive operations and is ON by default. ` +
          `To disable it, set the environment variable CCX_PROTECT=false and restart the MCP server.`,
      },
    ],
    isError: true,
  };
}
