// Page text helpers shared by the seed and the admin routes.

export const CONTENT_KEYS = ["home", "about", "rooms", "restaurant", "events", "contact"] as const;
export type ContentKey = (typeof CONTENT_KEYS)[number];

export type PageSection = { heading: string; body: string };

// The plain-text "body" column (used by GET /content/:key and the public site):
// every section's text, separated by a blank line. Headings are left out.
export function sectionsToBody(sections: PageSection[]): string {
  return sections
    .map((s) => s.body.trim())
    .filter(Boolean)
    .join("\n\n");
}
