import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ProQuote — quoting for trades",
    short_name: "ProQuote",
    description: "Manage trade clients and build quotes from one simple workspace.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f4f6f8",
    theme_color: "#f2763e",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
