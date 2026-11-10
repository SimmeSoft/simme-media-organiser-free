<?php
/**
 * Plugin Name: Simme Media Organiser
 * Plugin URI:  https://www.simme.co.uk/simmes-media-organiser/
 * Description: Organise WordPress media with virtual folders, protected Trash, local health checks and a non-destructive Image Studio.
 * Version:     1.3.2-rc1
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

// Free and Pro share PHP class names and Library hooks. Fail closed if a
// standalone or companion Pro edition is already active; preserve all media.
$simme_free_conflicting_pro = defined( 'SIMME_MEDIA_ORGANISER_PRO_ACTIVE' );
if ( ! $simme_free_conflicting_pro && function_exists( 'get_option' ) ) {
    $simme_free_pro_slugs = array(
        'simme-media-organiser-full-pro/simme-media-organiser-full-pro.php',
        'simme-media-organiser-pro/simme-media-organiser-pro.php',
    );
    $simme_free_active = (array) get_option( 'active_plugins', array() );
    $simme_free_conflicting_pro = (bool) array_intersect( $simme_free_pro_slugs, $simme_free_active );
    if ( ! $simme_free_conflicting_pro && is_multisite() ) {
        $simme_free_network = array_keys( (array) get_site_option( 'active_sitewide_plugins', array() ) );
        $simme_free_conflicting_pro = (bool) array_intersect( $simme_free_pro_slugs, $simme_free_network );
    }
}
if ( $simme_free_conflicting_pro ) {
    register_activation_hook( __FILE__, static function () {
        wp_die(
            esc_html__( 'Deactivate the standalone or companion Simme Media Organiser Pro edition before activating Free. Your existing media and virtual folders will not be deleted.', 'simme-media-organiser' ),
            esc_html__( 'Simme Media Organiser edition conflict', 'simme-media-organiser' ),
            array( 'back_link' => true )
        );
    } );
    add_action( 'admin_notices', static function () {
        if ( ! current_user_can( 'activate_plugins' ) ) { return; }
        echo '<div class="notice notice-error"><p>' . esc_html__( 'Simme Media Organiser Free is not loading while a Pro edition is active. Deactivate one edition to avoid duplicate Library handlers. Existing media is unaffected.', 'simme-media-organiser' ) . '</p></div>';
    } );
    return;
}

define( 'SIMME_MEDIA_ORGANISER_VERSION', '1.3.2-rc1' );
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
