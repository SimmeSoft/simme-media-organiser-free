<?php
/**
 * Plugin Name: Simme Media Organiser
 * Plugin URI:  https://www.simme.co.uk/simmes-media-organiser/
 * Description: Organise WordPress media with virtual folders, protected Trash, local health checks and a non-destructive Image Studio.
 * Version:     1.3.1
 * Author:      Simme
 * Author URI:  https://www.simme.co.uk/
 * License:     GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: simme-media-organiser
 * Requires at least: 6.4
 * Requires PHP: 7.4
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'SIMME_MEDIA_ORGANISER_VERSION', '1.3.1' );
define( 'SIMME_MEDIA_ORGANISER_FILE', __FILE__ );
define( 'SIMME_MEDIA_ORGANISER_DIR', plugin_dir_path( __FILE__ ) );
define( 'SIMME_MEDIA_ORGANISER_URL', plugin_dir_url( __FILE__ ) );
define( 'SIMME_MEDIA_ORGANISER_TAXONOMY', 'smo_media_folder' );

require_once SIMME_MEDIA_ORGANISER_DIR . 'includes/class-simme-media-organiser-plugin.php';
require_once SIMME_MEDIA_ORGANISER_DIR . 'includes/class-simme-media-organiser-admin.php';
require_once SIMME_MEDIA_ORGANISER_DIR . 'includes/class-simme-media-organiser-ajax.php';
require_once SIMME_MEDIA_ORGANISER_DIR . 'includes/class-simme-media-organiser-trash.php';
require_once SIMME_MEDIA_ORGANISER_DIR . 'includes/class-simme-media-organiser-image-studio.php';
require_once SIMME_MEDIA_ORGANISER_DIR . 'includes/class-simme-media-organiser-audit.php';

register_activation_hook( __FILE__, array( 'Simme_Media_Organiser_Plugin', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'Simme_Media_Organiser_Plugin', 'deactivate' ) );

add_action( 'plugins_loaded', static function () {
    Simme_Media_Organiser_Plugin::instance();
} );
