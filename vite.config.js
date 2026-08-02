import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ["77yj8h-5173.csb.app"],
    // or, since CodeSandbox hosts change per-sandbox/session:
    // allowedHosts: true,
  },
});
