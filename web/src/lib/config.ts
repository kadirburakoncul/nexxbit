const apiBase = import.meta.env.VITE_API_URL ?? ''

export const hubUrl = (path: string) => `${apiBase}${path}`
