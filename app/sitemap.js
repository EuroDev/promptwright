const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://promptwright.io";

export default function sitemap() {
  const now = new Date();
  return [
    { url: siteUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
