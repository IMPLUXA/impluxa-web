import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://impluxa.com";
  return [
    {
      url: base,
      changeFrequency: "weekly",
      priority: 1,
      alternates: { languages: { en: `${base}/en` } },
    },
    { url: `${base}/en`, changeFrequency: "weekly", priority: 0.9 },
  ];
}
