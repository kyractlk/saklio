/** Public marketing / legal site base URL */
export const SITE_URL = "https://saklio.app";

export const legalUrl = (path: string) =>
  `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
