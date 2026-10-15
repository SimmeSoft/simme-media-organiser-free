# Source code reference — Simme Media Organiser Free 1.3.1

The deployed Free application source is included **directly in this public GitHub repository**. JavaScript is maintained by hand and is **not compiled, obfuscated, bundled or minified**; consequently, there is **no separate, hidden unminified upstream and no required build tools**.

| Source | Purpose |
|---|---|
| `simme-media-organiser.php` | Main WordPress plugin entry point and hooks |
| `includes/*.php` | Server-side features, administration, AJAX, Trash, Image Studio and health/audit operations |
| `assets/js/admin.js` | Readable Media Organiser and Image Studio JavaScript; extensive template literals are authored source |
| `assets/js/media-picker.js` | Readable WordPress media-frame integration source |
| `assets/css/*.css` | Editable stylesheets |
| `assets/img/*.svg` | Editable vector/animation assets |
| `assets/img/*.png`, `*.webp` | Media used by the plugin interface |
| `readme.txt` | WordPress.org-standard plugin metadata and feature description |

## Development workflow

Edit the PHP, JavaScript and CSS files directly; the plugin does not have an npm/webpack/Vite/minifier build pipeline. ZIP the top-level plugin folder named `simme-media-organiser` to install a development build. PHP, WordPress and JavaScript validation can be run directly on the shipped sources.

This repository is a source-publication mirror of the **Free** edition only. The paid Pro product is distributed separately and is not needed to run Free features.
