import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ROMANA COMPUSERVICE",
    short_name: "ROMANA",
    description: "Administración de reparaciones, clientes y pagos",
    start_url: "/offline",
    display: "standalone",
    background_color: "#f4f5f7",
    theme_color: "#111111",
    icons: [
      {
        src: "/brand/romana-logo.jpeg",
        sizes: "any",
        type: "image/jpeg",
      },
    ],
  };
}
