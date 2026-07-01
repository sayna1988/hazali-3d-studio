import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "";
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "";

  return {
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(supabaseAnonKey)
  },

  plugins: [

    react(),

    VitePWA({

      registerType: "autoUpdate",

      manifest: {

        name:
          "Hazali 3D Studio",

        short_name:
          "Hazali",

        theme_color:
          "#0094FF",

        background_color:
          "#050B14",

        display:
          "standalone",

        orientation:
          "portrait",

        start_url:
          "/",

        icons: [

          {
            src: "/icons/app-icon-03-192.png",
            sizes: "192x192",
            type: "image/png"
          },

          {
            src: "/icons/app-icon-03-512.png",
            sizes: "512x512",
            type: "image/png"
          }

        ]

      }

    })

  ]

  };
});
