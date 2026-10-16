import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig(({ command }) => ({
  define: {
    "process.env.TSS_SERVER_FN_BASE": JSON.stringify("/_serverFn/"),
    "import.meta.env.TSS_SERVER_FN_BASE": JSON.stringify("/_serverFn/"),
  },
  plugins: [
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
    }),
    viteReact(),
    command === "build" ? nitro() : null,
  ],
}));
