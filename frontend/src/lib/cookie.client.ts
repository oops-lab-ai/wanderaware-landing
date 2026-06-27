// Client-side cookie utilities.
// These functions manage cookies in the browser only.
// Server actions handle cookie updates on the server side.

export function setClientCookie(key: string, value: string, days = 7) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  // biome-ignore lint/suspicious/noDocumentCookie: Preference bootstrap runs before async Cookie Store reads are practical.
  document.cookie = `${key}=${value}; expires=${expires}; path=/`;
}

export function getClientCookie(key: string) {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${key}=`))
    ?.split("=")[1];
}

export function deleteClientCookie(key: string) {
  // biome-ignore lint/suspicious/noDocumentCookie: Keep deletion synchronous for the pre-hydration theme bootstrap.
  document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
}
