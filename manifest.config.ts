import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

export default defineManifest({
  manifest_version: 3,
  name: pkg.name,
  version: pkg.version,
  icons: {
    48: "public/logo.png",
  },
  action: {
    default_icon: {
      48: "public/logo.png",
    },
    default_popup: "src/popup/index.html",
  },
  content_scripts: [
    {
      matches: [
        "*://asurascans.com/*",
        "*://flamecomics.xyz/*",
        "*://mangahub.io/*",
        "*://*.natomanga.com/*",
        "*://drakecomic.org/*",
        "*://*.mangago.me/*",
        "*://rizzfables.com/*",
        "*://*.webtoons.com/*",
        "*://*.comix.to/*",
        "*://*.luacomic.org/*",
        "*://*.madarascans.org/*",
        // '<all_urls>',
      ],
      js: ["src/content/content.ts"],
    },
  ],
  background: {
    service_worker: "src/background/background.ts",
    type: "module",
  },
  permissions: ["sidePanel", "contentSettings", "storage", "unlimitedStorage", "identity"],
  host_permissions: ["<all_urls>", "https://graphql.anilist.co/*", "https://api.mangadex.org/*", "https://kitsu.io/api/edge/*"],
  side_panel: {
    default_path: "src/sidepanel/index.html",
  },
});
