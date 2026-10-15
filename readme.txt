=== Simme Media Organiser ===
Contributors: simmesoftware
Tags: media library, media folders, media management, image editor, image optimisation
Requires at least: 6.4
Tested up to: 7.1
Stable tag: 1.3.1
Requires PHP: 7.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Organise WordPress media with virtual folders, protected Trash, local health checks and a non-destructive Image Studio.

== Description ==

Simme Media Organiser provides a visual workspace for organising and maintaining the WordPress Media Library without changing the physical location or public URL of existing attachments simply because they are placed in a Simme folder.

The plugin is designed around non-destructive media management. Virtual organisation is kept separate from WordPress attachment files, and Image Studio keeps the original source available as a protected Master while edits are created as separate working files.

Key features include:

* Hierarchical virtual folders for organising attachments without moving their physical upload files.
* Favourites, search, filtering and remembered card positioning for faster navigation.
* Media details and ALT text editing from the organiser.
* Asset protection that blocks normal Simme deletion until protection is deliberately removed.
* Recoverable protected Trash with configurable protection periods, purge-unlock timing and explicit permanent-purge confirmation.
* Local Media Health scanning for missing ALT text, heavy files, broken files, unfiled media and storage usage.
* Exact duplicate detection using local SHA-256 file hashes.
* Local action history with Undo and Redo for supported organisation and protection changes.
* Image Studio with a protected Master, multiple editable Working Versions, crop, resize, rotate, flip and adjustable output quality.
* Separate Studio-default and Active-in-WordPress states so choosing what Studio opens first does not silently change the attachment WordPress serves.
* Version-state Undo and Redo within Image Studio.
* Optional integration with the standard WordPress media selection frame.

Simme Media Organiser does not require an external cloud service for its media analysis. The health checks and exact-duplicate comparisons included in this release run on the WordPress site.

= Virtual folders are non-destructive =

Moving an attachment into a Simme virtual folder does not rename the physical media file, change the attachment ID, rewrite the uploads-relative path or change the existing public URL.

= Protected Image Studio workflow =

Image Studio keeps the original source as a protected Master. Normal Studio edits create a separate Working Version rather than overwriting that Master. A Working Version can be made active in WordPress, and the Master remains available for rollback.

= Optional separately distributed Pro edition =

Simme Media Organiser Free is a complete product and does not require a purchase, licence key or Pro installation to use its included features.

A separate optional Simme Media Organiser Pro edition is available for sites and teams that need advanced workflow automation, review and intelligence tools, transfer and batch workflows, and additional professional Studio capabilities.

Learn more at https://www.simme.co.uk/simmes-media-organiser/

== Installation ==

1. Upload the plugin ZIP through **Plugins > Add Plugin > Upload Plugin**, or install it from the WordPress Plugin Directory when available.
2. Activate **Simme Media Organiser**.
3. Open **Simme Media** in the WordPress admin sidebar.
4. Create virtual folders or organise existing attachments without changing their physical upload location.
5. Review **Media Health** and **Settings** as required for your site.

== Frequently Asked Questions ==

= Does moving media into a Simme folder change its WordPress URL? =

No. Simme folders are virtual organisation. Moving an existing attachment between Simme folders does not move or rename the physical upload file and does not change the attachment's existing public URL.

= Does Image Studio overwrite my original image? =

Normal Studio edits do not overwrite the protected Master. The edited Working Version is stored separately. Publishing a Working Version changes which file the WordPress attachment actively uses; it does not replace the protected Master file.

= What is the difference between Studio default and Active in WordPress? =

**Studio default** controls which source Image Studio opens first. **Active in WordPress** controls which file WordPress currently uses for that attachment in the Media Library and for new media selections.

= Are duplicate images compared with an external service? =

No. Exact duplicate detection in this release uses SHA-256 file hashes calculated locally on the WordPress site.

= Does the plugin automatically delete expired Trash items? =

No. Protection timing controls when permanent purge can become available. Permanent deletion remains a deliberate user action and requires confirmation.

= Does Simme Media Organiser track visitors or send media to Simme? =

The media-management and health features in this release operate locally on the WordPress site and do not require visitor tracking or remote media processing.

== Privacy ==

Simme Media Organiser stores its organisational metadata, media-health index and Image Studio metadata in the WordPress installation. The plugin does not require an external account or remote media-analysis service for the features in this release.

Your WordPress site, hosting environment and any other plugins may have their own privacy behaviour. Review those separately as appropriate for your site.

== Changelog ==

= 1.3.1-rc3.14 =
* Refines the complete Free product for WordPress.org distribution.
* Preserves responsive media cards, Favourites, Studio Close and the Free social/avatar crop workflow.
* Keeps the directory plugin focused on the complete Free product and removes unavailable advanced workflows.


= 1.3.0 =
* First public WordPress.org release of Simme Media Organiser.
* Includes virtual media organisation, protected Trash, local Media Health, exact duplicate detection and the non-destructive Image Studio workflow.
* Refines responsive folder headers, long folder-name handling, section artwork spacing and media-card controls across different browser scales.

== Source code ==

All PHP, JavaScript and CSS source code is included in the Free plugin.
There are no compiled or minified application bundles and no build tools are
required. The distributed JavaScript in `assets/js/admin.js` and
`assets/js/media-picker.js` is the original, human-readable source. The
JavaScript HTML template literals are intentionally multiline source code,
not minified bundles. The original styles are in `assets/css/admin.css` and
`assets/css/media-picker.css`, and media-picker styling is also embedded as
a readable multiline string for WordPress media-frame compatibility.
The PHP entry point is `simme-media-organiser.php`; the original PHP sources
are under `includes/`. No compiler, bundler, minifier, obfuscator, npm tools
or external build process is used, and the plugin can be reproduced directly
from the included source files. The separate commercial Pro edition is not
required to build or use this Free plugin.
