import { readFileSync } from 'node:fs';
import type { ManifestType } from '@extension/shared';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));

/**
 * @prop default_locale
 * if you want to support multiple languages, you can use the following reference
 * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Internationalization
 *
 * @prop browser_specific_settings
 * Must be unique to your extension to upload to addons.mozilla.org
 * (you can delete if you only want a chrome extension)
 *
 * @prop permissions
 * Firefox doesn't support sidePanel (It will be deleted in manifest parser)
 *
 * @prop content_scripts
 * css: ['content.css'], // public folder
 */
const manifest = {
  manifest_version: 3,
  default_locale: 'en',
  name: '__MSG_extensionName__',
  browser_specific_settings: {
    gecko: {
      id: 'example@example.com',
      strict_min_version: '109.0',
    },
  },
  version: packageJson.version,
  description: '__MSG_extensionDescription__',
  permissions: ['storage', 'activeTab', 'cookies'],
  host_permissions: [
    'https://*/*', // Allow requests to any HTTPS domain
    'http://*/*'   // Allow requests to any HTTP domain (for testing)
  ],
  options_page: 'options/index.html',
  background: {
    service_worker: 'background.js',
    type: 'module',
  },
  action: {
    default_popup: 'popup/index.html',
    default_icon: 'icon-64.png',
  },
  icons: {
    '16': 'icon-16.png',
    '32': 'icon-32.png',
    '48': 'icon-48.png',
    '128': 'icon-128.png',
  },
  devtools_page: 'devtools/index.html',
  content_security_policy: {
    // Allow WASM eval for Monaco and keep scripts to 'self' (no CDN). Workers loaded via URL (no blob:).
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
  },
  web_accessible_resources: [
    {
      resources: [
        '*.js',
        '*.css',
        '*.svg',
        'icon-128.png',
        'icon-64.png',
        // Expose monaco worker bundles if emitted as files by Vite
        'assets/*worker*.js',
        'assets/*worker*.map',
      ],
      matches: ['*://*/*'],
    },
  ],
} satisfies ManifestType;

export default manifest;
