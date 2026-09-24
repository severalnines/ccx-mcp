/**
 * Protection mode is ON unless CCX_PROTECT is "false" or "0". While it is on,
 * the destructive tools are not registered at all, so an assistant never sees
 * them. When it is off, every destructive tool still requires confirm=true.
 */
export function isProtected(): boolean {
  const val = process.env.CCX_PROTECT?.toLowerCase();
  return val !== "false" && val !== "0";
}
