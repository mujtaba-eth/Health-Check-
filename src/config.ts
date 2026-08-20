/**
 * Leave this empty when the UI and API are deployed together (the default).
 * Set VITE_API_BASE_URL only when the API is hosted at a separate origin.
 */
export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
export const apiUrl = (path: string) => `${apiBaseUrl}${path}`
