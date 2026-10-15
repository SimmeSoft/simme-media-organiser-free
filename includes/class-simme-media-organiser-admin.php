<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Simme_Media_Organiser_Admin {
    public function __construct() {
        add_action( 'admin_menu', array( $this, 'admin_menu' ) );
        add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ) );
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_media_picker_frontend' ), 100 );
        add_action( 'admin_init', array( $this, 'register_settings' ) );
        add_action( 'restrict_manage_posts', array( $this, 'native_media_folder_filter' ) );
        add_action( 'pre_get_posts', array( $this, 'filter_native_media_query' ) );
        add_filter( 'ajax_query_attachments_args', array( $this, 'filter_native_media_ajax_query' ) );
        add_filter( 'manage_media_columns', array( $this, 'native_media_columns' ) );
        add_action( 'manage_media_custom_column', array( $this, 'native_media_column_content' ), 10, 2 );
    }









    public function admin_menu() {
        $icon = SIMME_MEDIA_ORGANISER_URL . 'assets/img/simme-media-sidebar-sharp-1124.svg?ver=' . rawurlencode( SIMME_MEDIA_ORGANISER_VERSION );
        add_menu_page( __( 'Simme Media', 'simme-media-organiser' ), __( 'Simme Media', 'simme-media-organiser' ), 'upload_files', 'simme-media-organiser', array( $this, 'render_library' ), $icon, 81 );
        add_submenu_page( 'simme-media-organiser', __( 'Library', 'simme-media-organiser' ), __( 'Library', 'simme-media-organiser' ), 'upload_files', 'simme-media-organiser', array( $this, 'render_library' ) );
        add_submenu_page( 'simme-media-organiser', __( 'Media Health', 'simme-media-organiser' ), __( 'Media Health', 'simme-media-organiser' ), 'upload_files', 'simme-media-health', array( $this, 'render_health' ) );
        add_submenu_page( 'simme-media-organiser', __( 'Settings', 'simme-media-organiser' ), __( 'Settings', 'simme-media-organiser' ), 'upload_files', 'simme-media-settings', array( $this, 'render_settings' ) );
    }

    public function enqueue( $hook ) {
        wp_enqueue_style( 'simme-media-organiser-menu-icon', SIMME_MEDIA_ORGANISER_URL . 'assets/css/menu-icon.css', array(), SIMME_MEDIA_ORGANISER_VERSION );
        $settings = Simme_Media_Organiser_Plugin::get_settings();
        if ( ! empty( $settings['media_picker_enabled'] ) && current_user_can( 'upload_files' ) ) {
            $this->enqueue_media_picker_assets();
        }
        $is_smo = false !== strpos( (string) $hook, 'simme-media' );
        if ( ! $is_smo ) {
            if ( 'upload.php' === $hook ) {
                wp_enqueue_style( 'simme-media-organiser-native-media', SIMME_MEDIA_ORGANISER_URL . 'assets/css/native-media.css', array(), SIMME_MEDIA_ORGANISER_VERSION );
            }
            return;
        }
        wp_enqueue_style( 'simme-media-organiser-admin', SIMME_MEDIA_ORGANISER_URL . 'assets/css/admin.css', array(), SIMME_MEDIA_ORGANISER_VERSION );
        wp_enqueue_script( 'simme-media-organiser-admin', SIMME_MEDIA_ORGANISER_URL . 'assets/js/admin.js', array(), SIMME_MEDIA_ORGANISER_VERSION, true );
        wp_localize_script(
            'simme-media-organiser-admin',
            'SIMME_MEDIA_ORGANISER_DATA',
            array(
                'ajaxUrl'              => admin_url( 'admin-ajax.php' ),
                'nonce'                => wp_create_nonce( 'simme_media_organiser_admin' ),
                'settings'             => $settings,
                'urlDownloadLimit'     => 0,
                'folderTree'           => Simme_Media_Organiser_Plugin::folder_terms_tree(),
                'libraryUrl'           => admin_url( 'admin.php?page=simme-media-organiser' ),
                'healthUrl'            => admin_url( 'admin.php?page=simme-media-health' ),
                'settingsUrl'          => admin_url( 'admin.php?page=simme-media-settings' ),
                'addMediaIconUrl'      => SIMME_MEDIA_ORGANISER_URL . 'assets/img/add-media.png',
                'studioIconUrl'        => add_query_arg( 'ver', rawurlencode( SIMME_MEDIA_ORGANISER_VERSION ), SIMME_MEDIA_ORGANISER_URL . 'assets/img/studio-animated.svg' ),
                'studioLoaderUrl'      => add_query_arg( 'ver', rawurlencode( SIMME_MEDIA_ORGANISER_VERSION ), SIMME_MEDIA_ORGANISER_URL . 'assets/img/simme-character-bored-loader.svg' ),
                'historyUndoIconUrl'   => add_query_arg( 'ver', rawurlencode( SIMME_MEDIA_ORGANISER_VERSION ), SIMME_MEDIA_ORGANISER_URL . 'assets/img/history-undo.svg' ),
                'historyRedoIconUrl'   => add_query_arg( 'ver', rawurlencode( SIMME_MEDIA_ORGANISER_VERSION ), SIMME_MEDIA_ORGANISER_URL . 'assets/img/history-redo.svg' ),
                'strings'              => array(
                    'loading'       => __( 'Loading media…', 'simme-media-organiser' ),
                    'noItems'       => __( 'No media matches this view.', 'simme-media-organiser' ),
                    'moveSuccess'   => __( 'Media organised.', 'simme-media-organiser' ),
                    'saveSuccess'   => __( 'Media details saved.', 'simme-media-organiser' ),
                    'uploadSuccess' => __( 'Upload complete.', 'simme-media-organiser' ),
                    'serverError'   => __( 'Something went wrong. Please try again.', 'simme-media-organiser' ),
                ),
            )
        );
    }

    public function enqueue_media_picker_frontend() {
        if ( ! is_user_logged_in() || ! current_user_can( 'upload_files' ) ) {
            return;
        }
        $settings = Simme_Media_Organiser_Plugin::get_settings();
        if ( empty( $settings['media_picker_enabled'] ) ) {
            return;
        }
        $this->enqueue_media_picker_assets();
    }

    private function enqueue_media_picker_assets() {
        wp_enqueue_style(
            'simme-media-organiser-media-picker',
            SIMME_MEDIA_ORGANISER_URL . 'assets/css/media-picker.css',
            array(),
            SIMME_MEDIA_ORGANISER_VERSION
        );

        wp_enqueue_script(
            'simme-media-organiser-media-picker',
            SIMME_MEDIA_ORGANISER_URL . 'assets/js/media-picker.js',
            array(),
            SIMME_MEDIA_ORGANISER_VERSION,
            true
        );

        wp_localize_script(
            'simme-media-organiser-media-picker',
            'SIMME_MEDIA_PICKER_DATA',
            array(
                'ajaxUrl'    => admin_url( 'admin-ajax.php' ),
                'nonce'      => wp_create_nonce( 'simme_media_organiser_admin' ),
                'folders'    => Simme_Media_Organiser_Plugin::folder_terms_tree(),
                'accent'     => Simme_Media_Organiser_Plugin::get_settings()['accent'],
                'strings'    => array(
                    'tab'          => __( 'Simme Media', 'simme-media-organiser' ),
                    'allMedia'     => __( 'All media', 'simme-media-organiser' ),
                    'favourites'   => __( 'Favourites', 'simme-media-organiser' ),
                    'recent'       => __( 'Recently added', 'simme-media-organiser' ),
                    'unfiled'      => __( 'Unfiled', 'simme-media-organiser' ),
                    'folders'      => __( 'Folders', 'simme-media-organiser' ),
                    'search'       => __( 'Search organised media…', 'simme-media-organiser' ),
                    'loading'      => __( 'Loading organised media…', 'simme-media-organiser' ),
                    'empty'        => __( 'No media matches this Simme view.', 'simme-media-organiser' ),
                    'selected'     => __( 'Selected', 'simme-media-organiser' ),
                    'previous'     => __( 'Previous', 'simme-media-organiser' ),
                    'next'         => __( 'Next', 'simme-media-organiser' ),
                    'page'         => __( 'Page', 'simme-media-organiser' ),
                    'openLibrary'  => __( 'Open full Simme Media Organiser', 'simme-media-organiser' ),
                    'dropFiles'    => __( 'Drop files here', 'simme-media-organiser' ),
                    'dropPrefix'   => __( 'Drop', 'simme-media-organiser' ),
                    'dropSuffix'   => __( 'here', 'simme-media-organiser' ),
                    'uploadOr'     => __( 'Drag from your computer or', 'simme-media-organiser' ),
                    'chooseFiles'  => __( 'Choose files', 'simme-media-organiser' ),
                    'dragHint'     => __( 'or drag and drop them here', 'simme-media-organiser' ),
                    'uploadTo'     => __( 'Upload to', 'simme-media-organiser' ),
                    'uploadSafety' => __( 'Virtual filing never changes the physical WordPress upload URL.', 'simme-media-organiser' ),
                ),
                'maxUploadBytes' => (int) wp_max_upload_size(),
                'maxUploadLabel' => size_format( wp_max_upload_size(), 0 ),
                'libraryUrl' => admin_url( 'admin.php?page=simme-media-organiser' ),
                'cssUrl'       => add_query_arg( 'ver', rawurlencode( SIMME_MEDIA_ORGANISER_VERSION ), SIMME_MEDIA_ORGANISER_URL . 'assets/css/media-picker.css' ),
                'brandLogoUrl'   => add_query_arg( 'ver', rawurlencode( SIMME_MEDIA_ORGANISER_VERSION ), SIMME_MEDIA_ORGANISER_URL . 'assets/img/simme-media-logo-brand-96.png' ),
                'brandLockupUrl' => add_query_arg( 'ver', rawurlencode( SIMME_MEDIA_ORGANISER_VERSION ), add_query_arg( 'ver', rawurlencode( SIMME_MEDIA_ORGANISER_VERSION ), SIMME_MEDIA_ORGANISER_URL . 'assets/img/simme-media-organiser-lockup-animated.svg' ) ),
                'brandLogoAlt'   => __( 'Simme Media Organiser logo', 'simme-media-organiser' ),
            )
        );
    }

    public function register_settings() {
        register_setting(
            'simme_media_organiser_settings_group',
            'simme_media_organiser_settings',
            array(
                'type'              => 'array',
                'sanitize_callback' => array( $this, 'sanitize_settings' ),
                'default'           => Simme_Media_Organiser_Plugin::get_settings(),
            )
        );
    }

    public function sanitize_settings( $input ) {
        $input = is_array( $input ) ? $input : array();
        $allowed_views = array( 'grid', 'detailed', 'list' );
        $allowed_accents = array( 'violet', 'blue', 'lime', 'gold' );
        $allowed_trash_days = array( 1, 7, 14, 30, 60, 90 );
        $trash_days = absint( $input['trash_retention_days'] ?? 30 );
        if ( ! in_array( $trash_days, $allowed_trash_days, true ) ) {
            $trash_days = 30;
        }

        return array(
            'items_per_page' => min( 120, max( 12, absint( $input['items_per_page'] ?? 48 ) ) ),
            'default_view'   => in_array( $input['default_view'] ?? '', $allowed_views, true ) ? $input['default_view'] : 'grid',
            'reduce_motion'  => empty( $input['reduce_motion'] ) ? 0 : 1,
            'accent'         => in_array( $input['accent'] ?? '', $allowed_accents, true ) ? $input['accent'] : 'violet',
            'media_picker_enabled' => empty( $input['media_picker_enabled'] ) ? 0 : 1,
            'trash_retention_days' => $trash_days,
        );
    }

    private function render_sprite() {
        ?>
        <svg class="smo-svg-sprite" aria-hidden="true" focusable="false">
            <symbol id="smo-i-grid" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></symbol>
            <symbol id="smo-i-menu" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></symbol>
            <symbol id="smo-i-list" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></symbol>
            <symbol id="smo-i-folder" viewBox="0 0 24 24"><path d="M3 7.5h7l2 2H21v8.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 7.5V6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v1.5"/></symbol>
            <symbol id="smo-i-smart" viewBox="0 0 24 24"><path d="M3 8h7l2 2h9v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="m17 3 .7 1.8L19.5 5.5l-1.8.7L17 8l-.7-1.8-1.8-.7 1.8-.7z"/></symbol>
            <symbol id="smo-i-heart" viewBox="0 0 24 24"><path d="M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 6.8l-1-1a5.5 5.5 0 1 0-7.8 7.8L12 22l8.8-8.4a5.5 5.5 0 0 0 0-7.8z"/></symbol>
            <symbol id="smo-i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></symbol>
            <symbol id="smo-i-upload" viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></symbol>
            <symbol id="smo-i-export" viewBox="0 0 24 24"><path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 4v3M20 4v3M4 20h16"/></symbol>
            <symbol id="smo-i-edit" viewBox="0 0 24 24"><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z"/><path d="m14 7 3 3"/></symbol>
            <symbol id="smo-i-copy" viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></symbol>
            <symbol id="smo-i-close" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></symbol>
            <symbol id="smo-i-check" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></symbol>
            <symbol id="smo-i-image" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m5 18 5-5 3 3 2-2 4 4"/></symbol>
            <symbol id="smo-i-studio" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="3"/><path d="M8 9h5M8 12h8M8 15h4"/><path d="m17.1 4.5.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7z"/><path d="m18.6 12.2.5 1.1 1.1.5-1.1.5-.5 1.1-.5-1.1-1.1-.5 1.1-.5z"/></symbol>
            <symbol id="smo-i-crop" viewBox="0 0 24 24"><path d="M7 3v14a2 2 0 0 0 2 2h12"/><path d="M3 7h14a2 2 0 0 1 2 2v12"/></symbol>
            <symbol id="smo-i-rotate" viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2 5.3"/><path d="M20 4v7h-7"/></symbol>
            <symbol id="smo-i-flip" viewBox="0 0 24 24"><path d="M12 3v18"/><path d="m10 7-6 5 6 5z"/><path d="m14 7 6 5-6 5z"/></symbol>
            <symbol id="smo-i-lock" viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></symbol>
            <symbol id="smo-i-unlock" viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M9 10V7a4 4 0 0 1 7.6-1.7"/></symbol>
            <symbol id="smo-i-compare" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/><path d="M7 9h2M15 15h2"/></symbol>
            <symbol id="smo-i-audio" viewBox="0 0 24 24"><path d="M9 18V6l9-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="15" cy="16" r="3"/></symbol>
            <symbol id="smo-i-video" viewBox="0 0 24 24"><rect x="3" y="5" width="14" height="14" rx="3"/><path d="m17 10 4-2v8l-4-2z"/></symbol>
            <symbol id="smo-i-play" viewBox="0 0 24 24"><path d="M8 5.5 18 12 8 18.5z"/></symbol>
            <symbol id="smo-i-pause" viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></symbol>
            <symbol id="smo-i-volume" viewBox="0 0 24 24"><path d="M5 10h4l5-4v12l-5-4H5z"/><path d="M17 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/></symbol>
            <symbol id="smo-i-mute" viewBox="0 0 24 24"><path d="M5 10h4l5-4v12l-5-4H5z"/><path d="m17 10 4 4M21 10l-4 4"/></symbol>
            <symbol id="smo-i-file" viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/></symbol>
            <symbol id="smo-i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></symbol>
            <symbol id="smo-i-help" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.7 2.7 0 0 1 5.2 1c0 1.9-2.1 2.4-2.7 3.7"/><path d="M12 17h.01"/></symbol>
            <symbol id="smo-i-trash" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14"/></symbol>
            <symbol id="smo-i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
            <symbol id="smo-i-chevron" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></symbol>
            <symbol id="smo-i-unfiled" viewBox="0 0 24 24"><path d="M4 6h16v12H4z"/><path d="M8 10h8M12 7v6"/></symbol>
            <symbol id="smo-i-recent" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>
            <symbol id="smo-i-shield" viewBox="0 0 24 24"><path d="M12 3 20 6v6c0 5-3.4 8.2-8 9-4.6-.8-8-4-8-9V6z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></symbol>
            <symbol id="smo-i-shield-off" viewBox="0 0 24 24"><path d="M12 3 20 6v6c0 5-3.4 8.2-8 9-4.6-.8-8-4-8-9V6z"/><path d="M8 8l8 8M16 8l-8 8"/></symbol>
            <symbol id="smo-i-pulse" viewBox="0 0 24 24"><path d="M3 12h4l2.1-5 3.2 10 2.3-7 1.8 2H21"/></symbol>
            <symbol id="smo-i-eye" viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.7"/></symbol>
            <symbol id="smo-i-pin" viewBox="0 0 24 24"><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11z"/><circle cx="12" cy="10" r="2.2"/></symbol>
            <symbol id="smo-i-duplicate" viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><rect x="4" y="4" width="11" height="11" rx="2"/></symbol>
            <symbol id="smo-i-history" viewBox="0 0 24 24"><path d="M4 5v5h5"/><path d="M5.5 9A8 8 0 1 1 5 15"/><path d="M12 8v5l3 2"/></symbol>
            <symbol id="smo-i-command" viewBox="0 0 24 24"><path d="M9 7H7a3 3 0 1 1 3-3v16a3 3 0 1 1-3-3h10a3 3 0 1 1-3 3V4a3 3 0 1 1 3 3z"/></symbol>
            <symbol id="smo-i-settings" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.7a7 7 0 0 0-.8-1.8l.9-1.9-2.2-2.2-1.9.9a7 7 0 0 0-1.8-.8L10.5 2h-3l-.7 2a7 7 0 0 0-1.8.8l-1.9-.9L.9 6.1 1.8 8a7 7 0 0 0-.8 1.8l-2 .7v3l2 .7a7 7 0 0 0 .8 1.8l-.9 1.9 2.2 2.2 1.9-.9a7 7 0 0 0 1.8.8l.7 2h3l.7-2a7 7 0 0 0 1.8-.8l1.9.9 2.2-2.2-.9-1.9a7 7 0 0 0 .8-1.8z" transform="translate(2.5 1) scale(.8)"/></symbol>
        </svg>
        <?php
    }

    private function icon( $name, $class = '' ) {
        return '<svg class="smo-icon ' . esc_attr( $class ) . '" aria-hidden="true"><use href="#smo-i-' . esc_attr( $name ) . '"></use></svg>';
    }

    private function section_icon_url( $section ) {
        $map = array(
            'library'    => SIMME_MEDIA_ORGANISER_URL . 'assets/img/library-animated.svg',
            'health'     => SIMME_MEDIA_ORGANISER_URL . 'assets/img/media-health-animated.svg',
            'settings'   => SIMME_MEDIA_ORGANISER_URL . 'assets/img/settings-animated-v2.svg',
        );
        return isset( $map[ $section ] ) ? $map[ $section ] : '';
    }

    private function health_icon_url( $name ) {
        $map = array(
            'library-index' => SIMME_MEDIA_ORGANISER_URL . 'assets/img/health-library-index.png',
            'performance'   => SIMME_MEDIA_ORGANISER_URL . 'assets/img/health-performance-pulse.png',
            'duplicates'    => SIMME_MEDIA_ORGANISER_URL . 'assets/img/health-duplicates.png',
            'integrity'     => SIMME_MEDIA_ORGANISER_URL . 'assets/img/health-integrity-info.png',
            'organisation'  => SIMME_MEDIA_ORGANISER_URL . 'assets/img/health-organisation-folder.png',
        );
        return isset( $map[ $name ] ) ? $map[ $name ] : '';
    }

    private function render_section_hero_icon( $section, $label = '' ) {
        $url = $this->section_icon_url( $section );
        if ( '' === $url ) {
            return;
        }
        ?>
        <span class="smo-section-hero__icon-wrap" aria-hidden="true">
            <img class="smo-section-hero__icon" src="<?php echo esc_url( add_query_arg( 'ver', rawurlencode( SIMME_MEDIA_ORGANISER_VERSION ), $url ) ); ?>" alt="<?php echo esc_attr( $label ); ?>" />
        </span>
        <?php
    }

    private function render_brand_header( $active ) {
        $tabs = array(
            array( 'key' => 'library', 'label' => 'Library', 'url' => admin_url( 'admin.php?page=simme-media-organiser' ), 'icon' => SIMME_MEDIA_ORGANISER_URL . 'assets/img/library-animated.svg' ),
            array( 'key' => 'health', 'label' => 'Media Health', 'url' => admin_url( 'admin.php?page=simme-media-health' ), 'icon' => SIMME_MEDIA_ORGANISER_URL . 'assets/img/media-health-animated.svg' ),
            array( 'key' => 'settings', 'label' => 'Settings', 'url' => admin_url( 'admin.php?page=simme-media-settings' ), 'icon' => SIMME_MEDIA_ORGANISER_URL . 'assets/img/settings-animated-v2.svg' ),
        );
        ?>
        <header class="smo-brandbar smo-brandbar--hero">
            <div class="smo-brandbar__identity smo-brandbar__identity--lockup">
                <img src="<?php echo esc_url( add_query_arg( 'ver', rawurlencode( SIMME_MEDIA_ORGANISER_VERSION ), SIMME_MEDIA_ORGANISER_URL . 'assets/img/simme-media-organiser-lockup-animated.svg' ) ); ?>" class="smo-brand-lockup" alt="Simme Media Organiser" />
                <p class="smo-brandbar__tagline">A visual, non-destructive workspace for organising, checking, preparing and reusing WordPress media.</p>
            </div>
            <div class="smo-brandbar__status" aria-label="Simme Media Organiser status">
                <div class="smo-brand-status-pill"><span class="smo-brand-status-dot" aria-hidden="true"></span><strong>LOCAL &amp; READY</strong></div>
                <div class="smo-brand-version-pill"><span>Version</span><strong><?php echo esc_html( SIMME_MEDIA_ORGANISER_VERSION ); ?></strong></div>
                <button type="button" class="smo-pro-entry" id="smo-pro-open" aria-label="<?php echo esc_attr__( 'About Pro', 'simme-media-organiser' ); ?>" aria-haspopup="dialog" aria-controls="smo-pro-dialog" data-help-title="<?php echo esc_attr__( 'About Pro', 'simme-media-organiser' ); ?>" data-help-text="<?php echo esc_attr__( 'Learn about the optional separately distributed Simme Media Organiser Pro edition. Free remains fully usable without it.', 'simme-media-organiser' ); ?>">
                    <img class="smo-pro-entry__badge" src="<?php echo esc_url( add_query_arg( 'ver', rawurlencode( SIMME_MEDIA_ORGANISER_VERSION ), SIMME_MEDIA_ORGANISER_URL . 'assets/img/simme-pro-official-badge-mini.webp' ) ); ?>" width="104" height="32" alt="" aria-hidden="true" />
                    <span><?php echo esc_html__( 'About Pro', 'simme-media-organiser' ); ?></span>
                </button>
            </div>
        </header>
        <div class="smo-brand-tabs-deck"><nav class="smo-brand-tabs" aria-label="Simme Media sections">
            <?php foreach ( $tabs as $tab ) : ?>
                <a class="<?php echo esc_attr( $tab['key'] === $active ? 'is-active' : '' ); ?>" href="<?php echo esc_url( $tab['url'] ); ?>"><img class="smo-brand-tab-icon" src="<?php echo esc_url( $tab['icon'] ); ?>" alt="" aria-hidden="true" /><span><?php echo esc_html( $tab['label'] ); ?></span></a>
            <?php endforeach; ?>
        </nav></div>
        <?php $this->render_pro_promotion(); ?>
        <?php
    }

    private function render_pro_promotion() {
        $sales_url = 'https://www.simme.co.uk/simmes-media-organiser/';
        ?>
        <div class="smo-pro-dialog" id="smo-pro-dialog" role="dialog" aria-modal="true" aria-labelledby="smo-pro-title" aria-describedby="smo-pro-description" hidden>
            <button type="button" class="smo-pro-dialog__scrim" data-smo-pro-close tabindex="-1" aria-label="<?php echo esc_attr__( 'Close Pro information', 'simme-media-organiser' ); ?>"></button>
            <section class="smo-pro-card" role="document">
                <button type="button" class="smo-pro-card__close" data-smo-pro-close aria-label="<?php echo esc_attr__( 'Close Pro information', 'simme-media-organiser' ); ?>"><?php echo $this->icon( 'close' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></button>

                <div class="smo-pro-card__hero">
                    <div class="smo-pro-card__hero-copy">
                        <div class="smo-pro-card__eyebrow"><span aria-hidden="true"></span><?php echo esc_html__( 'Optional Pro edition', 'simme-media-organiser' ); ?></div>
                        <h2 id="smo-pro-title"><?php echo esc_html__( 'About Simme Media Organiser Pro', 'simme-media-organiser' ); ?></h2>
                        <p id="smo-pro-description"><?php echo esc_html__( 'Simme Media Organiser Pro is a separate optional add-on. The Free plugin remains fully usable without a purchase or licence key.', 'simme-media-organiser' ); ?></p>
                        <div class="smo-pro-card__assurance">
                            <?php echo $this->icon( 'check' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
                            <span><strong><?php echo esc_html__( 'Free stays fully usable.', 'simme-media-organiser' ); ?></strong> <?php echo esc_html__( 'The separately distributed Pro edition offers additional workflows when you need them.', 'simme-media-organiser' ); ?></span>
                        </div>
                    </div>

                    <div class="smo-pro-card__visual" aria-hidden="true">
                        <img class="smo-pro-card__character" src="<?php echo esc_url( add_query_arg( 'ver', rawurlencode( SIMME_MEDIA_ORGANISER_VERSION ), SIMME_MEDIA_ORGANISER_URL . 'assets/img/simme-pro-animated-character.svg' ) ); ?>" alt="" />
                    </div>
                </div>

                <div class="smo-pro-card__section-head">
                    <div>
                        <small><?php echo esc_html__( 'Available with Pro', 'simme-media-organiser' ); ?></small>
                        <strong><?php echo esc_html__( 'Additional workflow capabilities', 'simme-media-organiser' ); ?></strong>
                    </div>
                    <span><?php echo esc_html__( 'Separate edition', 'simme-media-organiser' ); ?></span>
                </div>

                <div class="smo-pro-card__features" aria-label="<?php echo esc_attr__( 'Examples of Pro capabilities', 'simme-media-organiser' ); ?>">
                    <article class="smo-pro-card__feature">
                        <div class="smo-pro-card__feature-icon"><img class="smo-pro-card__feature-glyph" src="<?php echo esc_url( add_query_arg( 'ver', rawurlencode( SIMME_MEDIA_ORGANISER_VERSION ), SIMME_MEDIA_ORGANISER_URL . 'assets/img/pro-workflow-automation.svg' ) ); ?>" alt="" aria-hidden="true" /></div>
                        <div><small>01</small><strong><?php echo esc_html__( 'Workflow automation', 'simme-media-organiser' ); ?></strong><p><?php echo esc_html__( 'Rules and repeatable organisation workflows.', 'simme-media-organiser' ); ?></p></div>
                    </article>
                    <article class="smo-pro-card__feature">
                        <div class="smo-pro-card__feature-icon"><img class="smo-pro-card__feature-glyph" src="<?php echo esc_url( add_query_arg( 'ver', rawurlencode( SIMME_MEDIA_ORGANISER_VERSION ), SIMME_MEDIA_ORGANISER_URL . 'assets/img/pro-review-intelligence.svg' ) ); ?>" alt="" aria-hidden="true" /></div>
                        <div><small>02</small><strong><?php echo esc_html__( 'Review and intelligence', 'simme-media-organiser' ); ?></strong><p><?php echo esc_html__( 'Review, matching and media-usage tools.', 'simme-media-organiser' ); ?></p></div>
                    </article>
                    <article class="smo-pro-card__feature">
                        <div class="smo-pro-card__feature-icon"><img class="smo-pro-card__feature-glyph" src="<?php echo esc_url( add_query_arg( 'ver', rawurlencode( SIMME_MEDIA_ORGANISER_VERSION ), SIMME_MEDIA_ORGANISER_URL . 'assets/img/pro-transfer-batch.svg' ) ); ?>" alt="" aria-hidden="true" /></div>
                        <div><small>03</small><strong><?php echo esc_html__( 'Transfer and batch tools', 'simme-media-organiser' ); ?></strong><p><?php echo esc_html__( 'Import, export and batch workflows.', 'simme-media-organiser' ); ?></p></div>
                    </article>
                    <article class="smo-pro-card__feature">
                        <div class="smo-pro-card__feature-icon"><img class="smo-pro-card__feature-glyph" src="<?php echo esc_url( add_query_arg( 'ver', rawurlencode( SIMME_MEDIA_ORGANISER_VERSION ), SIMME_MEDIA_ORGANISER_URL . 'assets/img/pro-studio-tools.svg' ) ); ?>" alt="" aria-hidden="true" /></div>
                        <div><small>04</small><strong><?php echo esc_html__( 'Additional Studio tools', 'simme-media-organiser' ); ?></strong><p><?php echo esc_html__( 'Additional image and version-management tools.', 'simme-media-organiser' ); ?></p></div>
                    </article>
                </div>

                <div class="smo-pro-card__footer">
                    <div class="smo-pro-card__footer-copy">
                        <strong><?php echo esc_html__( 'Want to see what Pro adds?', 'simme-media-organiser' ); ?></strong>
                        <span><?php echo esc_html__( 'Read the product information on simme.co.uk. The link opens in a new tab.', 'simme-media-organiser' ); ?></span>
                    </div>
                    <div class="smo-pro-card__actions">
                        <a class="smo-pro-card__primary" href="<?php echo esc_url( $sales_url ); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__( 'Learn about Pro', 'simme-media-organiser' ); ?><?php echo $this->icon( 'chevron' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></a>
                        <button type="button" class="smo-pro-card__secondary" data-smo-pro-close><?php echo esc_html__( 'Close', 'simme-media-organiser' ); ?></button>
                    </div>
                </div>
                <p class="smo-pro-card__note"><?php echo esc_html__( 'Optional product information only — no Pro feature is included or unlocked by this Free plugin.', 'simme-media-organiser' ); ?></p>
            </section>
        </div>
        <?php
    }

    private function render_page_help_control() {
        ?>
        <div class="smo-page-help-tools">
            <button type="button" class="smo-button smo-button--ghost smo-button--help" id="smo-help-toggle" aria-pressed="true" data-help-title="Hover help" data-help-text="Turn contextual Help on or off. When Help is on, rest the pointer over a control to see a short explanation positioned away from the work you are doing."><?php echo $this->icon( 'help' ); // phpcs:ignore ?><span>Help: On</span></button>
        </div>
        <?php
    }

    private function render_context_help_panel() {
        ?>
        <div class="smo-help-panel" id="smo-help-panel" aria-live="polite" aria-atomic="true" hidden>
            <div class="smo-help-panel__eyebrow">Hover help</div>
            <div class="smo-help-panel__title" id="smo-help-title">Help</div>
            <div class="smo-help-panel__text" id="smo-help-text">Rest the pointer over a control to see a short explanation.</div>
        </div>
        <?php
    }

    public function render_library() {
        if ( ! Simme_Media_Organiser_Plugin::can_manage() ) {
            wp_die( esc_html__( 'You do not have permission to access Simme Media Organiser.', 'simme-media-organiser' ) );
        }

        $settings = Simme_Media_Organiser_Plugin::get_settings();
        ?>
        <div class="wrap smo-wrap" data-smo-screen="library" data-accent="<?php echo esc_attr( $settings['accent'] ); ?>"<?php if ( ! empty( $settings['reduce_motion'] ) ) : ?> data-reduce-motion="1"<?php endif; ?>>
            <?php $this->render_sprite(); ?>
            <?php $this->render_brand_header( 'library' ); ?>

            <div class="smo-app-shell is-compact-nav" id="smo-library-shell">
                <button type="button" class="smo-mobile-nav-trigger" id="smo-mobile-nav-trigger" aria-controls="smo-library-sidebar" aria-expanded="false" aria-label="Open media menu. Current view: All Media">
                    <?php echo $this->icon( 'menu' ); // phpcs:ignore ?>
                    <strong class="smo-mobile-nav-trigger__action" id="smo-mobile-nav-action">Open menu</strong>
                    <span class="smo-mobile-nav-trigger__current"><small>Viewing</small><strong id="smo-mobile-nav-current">All Media</strong></span>
                    <span class="smo-mobile-nav-trigger__chevron" aria-hidden="true"><?php echo $this->icon( 'chevron' ); // phpcs:ignore ?></span>
                </button>

                <button type="button" class="smo-mobile-nav-scrim" id="smo-mobile-nav-scrim" aria-label="Close media navigation" tabindex="-1"></button>

                <aside class="smo-sidebar" id="smo-library-sidebar" aria-label="Media library navigation">
                    <div class="smo-sidebar__desktop-head">
                        <div><small>Library navigation</small><strong>Media menu</strong></div>
                        <button type="button" class="smo-sidebar__desktop-collapse" id="smo-desktop-nav-collapse" aria-controls="smo-library-sidebar" aria-expanded="true" aria-label="Hide media menu"><?php echo $this->icon( 'chevron' ); // phpcs:ignore ?><span>Hide menu</span></button>
                    </div>
                    <div class="smo-sidebar__mobile-head">
                        <div><small>Simme library</small><strong>Media menu</strong></div>
                        <button type="button" class="smo-sidebar__mobile-close" id="smo-mobile-nav-close" aria-label="Close media menu"><?php echo $this->icon( 'close' ); // phpcs:ignore ?><span>Close menu</span></button>
                    </div>
                    <div class="smo-sidebar__search">
                        <?php echo $this->icon( 'search' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
                        <input id="smo-search" type="search" placeholder="Search media, titles, alt text…" autocomplete="off" />
                    </div>

                    <div class="smo-side-section">
                        <div class="smo-side-section__title">Smart views</div>
                        <button type="button" class="smo-nav-item is-active" data-folder="all" data-help-title="All media" data-help-text="Shows every media item in your library, regardless of folder. Use this as your master view when you want to organise everything."><?php echo $this->icon( 'grid' ); // phpcs:ignore ?> <span>All media</span><span class="smo-count" data-count="all">—</span></button>
                        <button type="button" class="smo-nav-item smo-nav-item--favourites" data-folder="favourites" data-help-title="Favourites" data-help-text="Shows every favourited item across your whole media library. Use this when you want a global favourites collection."><?php echo $this->icon( 'heart' ); // phpcs:ignore ?> <span>See your favourites</span><span class="smo-count" data-count="favourites">—</span></button>
                        <button type="button" class="smo-nav-item" data-folder="recent" data-help-title="Recently added" data-help-text="Shows items uploaded in the last 30 days so you can quickly find newer media."><?php echo $this->icon( 'recent' ); // phpcs:ignore ?> <span>Recently added</span></button>
                        <button type="button" class="smo-nav-item" data-folder="unfiled" data-help-title="Unfiled" data-help-text="Shows media that has not yet been placed into a virtual folder. This is the easiest place to tidy up newly uploaded items."><?php echo $this->icon( 'unfiled' ); // phpcs:ignore ?> <span>Unfiled</span><span class="smo-count" data-count="unfiled">—</span></button>
                        <button type="button" class="smo-nav-item" data-folder="missing-alt" data-help-title="Missing alt text" data-help-text="Shows image files without alt text so you can quickly improve accessibility and completeness."><?php echo $this->icon( 'info' ); // phpcs:ignore ?> <span>Missing alt text</span><span class="smo-count" data-count="missingAlt">—</span></button>
                        <button type="button" class="smo-nav-item" data-folder="smart-heavy" data-help-title="Heavy media" data-help-text="Shows scanned media with Load Grade D or E so you can focus optimisation where it matters most."><?php echo $this->icon( 'pulse' ); // phpcs:ignore ?> <span>Heavy media</span><span class="smo-count" data-count="heavy">—</span></button>
                        <button type="button" class="smo-nav-item" data-folder="smart-duplicates" data-help-title="Exact duplicates" data-help-text="Shows byte-for-byte duplicate files discovered by the local checksum scanner."><?php echo $this->icon( 'duplicate' ); // phpcs:ignore ?> <span>Exact duplicates</span><span class="smo-count" data-count="duplicateItems">—</span></button>
                        <button type="button" class="smo-nav-item" data-folder="smart-protected" data-help-title="Protected assets" data-help-text="Shows assets you have explicitly protected against deletion from WordPress."><?php echo $this->icon( 'shield' ); // phpcs:ignore ?> <span>Protected</span><span class="smo-count" data-count="protected">—</span></button>
                        <button type="button" class="smo-nav-item smo-nav-item--trash" data-folder="trash" data-help-title="Trash" data-help-text="A protected holding area for media removed from the working library. Items stay recoverable until you restore them or deliberately purge them after the protection period."><?php echo $this->icon( 'trash' ); // phpcs:ignore ?> <span>Trash</span><span class="smo-count" data-count="trash">—</span></button>
                    </div>

                    <div class="smo-side-section smo-folder-section">
                        <div class="smo-side-section__title smo-folder-title-row">
                            <span>Folders</span>
                            <button type="button" class="smo-icon-button" id="smo-new-folder" title="Create folder" data-help-title="Create folder" data-help-text="Creates a new virtual folder. Existing media URLs and physical file locations stay exactly the same."><?php echo $this->icon( 'plus' ); // phpcs:ignore ?></button>
                        </div>
                        <div id="smo-folder-tree" class="smo-folder-tree" aria-live="polite"></div>
                    </div>

                    <div class="smo-side-section smo-pro-feature-section" aria-labelledby="smo-pro-feature-title">
                        <div class="smo-side-section__title" id="smo-pro-feature-title">Available with Pro</div>
                        <button type="button" class="smo-pro-feature-link" data-smo-pro-open data-pro-feature="workflow" data-help-title="Workflow automation · Pro" data-help-text="Learn about the optional Pro add-on. This button opens product information only; the Pro implementation is not included in Free.">
                            <?php echo $this->icon( 'command' ); // phpcs:ignore ?>
                            <span>Workflow automation</span>
                            <span class="smo-pro-feature-link__badge" aria-label="Pro">PRO</span>
                        </button>
                        <button type="button" class="smo-pro-feature-link" data-smo-pro-open data-pro-feature="review" data-help-title="Review and intelligence · Pro" data-help-text="Learn about the optional Pro add-on. This button opens product information only; the Pro implementation is not included in Free.">
                            <?php echo $this->icon( 'compare' ); // phpcs:ignore ?>
                            <span>Review &amp; intelligence</span>
                            <span class="smo-pro-feature-link__badge" aria-label="Pro">PRO</span>
                        </button>
                        <button type="button" class="smo-pro-feature-link" data-smo-pro-open data-pro-feature="transfer" data-help-title="Transfer and batch tools · Pro" data-help-text="Learn about the optional Pro add-on. This button opens product information only; the Pro implementation is not included in Free.">
                            <?php echo $this->icon( 'export' ); // phpcs:ignore ?>
                            <span>Transfer &amp; batch</span>
                            <span class="smo-pro-feature-link__badge" aria-label="Pro">PRO</span>
                        </button>
                        <button type="button" class="smo-pro-feature-link" data-smo-pro-open data-pro-feature="studio" data-help-title="Additional Studio tools · Pro" data-help-text="Learn about the optional Pro add-on. This button opens product information only; the Pro implementation is not included in Free.">
                            <?php echo $this->icon( 'studio' ); // phpcs:ignore ?>
                            <span>Additional Studio tools</span>
                            <span class="smo-pro-feature-link__badge" aria-label="Pro">PRO</span>
                        </button>
                    </div>

                    <div class="smo-sidebar__footer">
                        <div class="smo-safety-note">
                            <span class="smo-safety-node"></span>
                            <div><strong>Virtual organisation</strong><span>Moving items here never changes their file URLs.</span></div>
                        </div>
                    </div>
                </aside>

                <main class="smo-library">
                    <div class="smo-library-topbar">
                        <div class="smo-heading-block smo-heading-block--with-icon">
                            <?php $this->render_section_hero_icon( 'library', 'Library' ); ?>
                            <div class="smo-heading-block__copy">
                                <div class="smo-eyebrow" id="smo-current-path">All Media</div>
                                <div class="smo-current-title-row">
                                    <span class="smo-current-folder-colour" id="smo-current-folder-colour" aria-hidden="true" hidden></span>
                                    <h1 id="smo-current-title">Media Library</h1>
                                    <button type="button" class="smo-current-folder-rename" id="smo-current-folder-rename" hidden aria-label="Rename current folder" data-help-title="Rename folder" data-help-text="Rename this virtual folder here without moving its media or changing any public media URLs."><?php echo $this->icon( 'edit' ); // phpcs:ignore ?><span>Rename</span></button>
                                    <div class="smo-current-folder-rename-form" id="smo-current-folder-rename-form" hidden>
                                        <input type="text" id="smo-current-folder-rename-input" maxlength="80" aria-label="New folder name" />
                                        <button type="button" class="smo-current-folder-rename-save" id="smo-current-folder-rename-save"><?php echo $this->icon( 'check' ); // phpcs:ignore ?><span>Save</span></button>
                                        <button type="button" class="smo-current-folder-rename-cancel" id="smo-current-folder-rename-cancel"><?php echo $this->icon( 'close' ); // phpcs:ignore ?><span>Cancel</span></button>
                                    </div>
                                </div>
                                <div class="smo-library-summary"><span id="smo-result-count">Loading…</span><span class="smo-view-explanation" id="smo-view-explanation" hidden></span></div>
                            </div>
                        </div>

                        <div class="smo-top-actions">
                            <input type="file" id="smo-upload-input" multiple hidden />
                            <a class="smo-button smo-button--ghost" href="<?php echo esc_url( admin_url( 'admin.php?page=simme-media-health' ) ); ?>" data-help-title="Media Health" data-help-text="Open the local Media Health Centre for performance, storage, duplicate and safety reports."><?php echo $this->icon( 'pulse' ); // phpcs:ignore ?> Health</a>
                            <button type="button" class="smo-button smo-button--ghost" id="smo-command-open" data-help-title="Command palette" data-help-text="Open Simme Quick Find. Shortcut: Command K on Mac or Control K elsewhere."><?php echo $this->icon( 'command' ); // phpcs:ignore ?> Quick Find</button>
                            <button type="button" class="smo-button smo-button--secondary smo-button--add-media" id="smo-upload-button" data-help-title="Add media" data-help-text="Uploads new media into WordPress. If you are currently inside a folder, the uploaded items will be organised into that folder automatically."><img class="smo-add-media-icon" src="<?php echo esc_url( SIMME_MEDIA_ORGANISER_URL . 'assets/img/add-media.png' ); ?>" alt="" aria-hidden="true" /><span class="smo-upload-button-label">Add media</span></button>
                            <button type="button" class="smo-button smo-button--secondary smo-button--favourites" id="smo-favourites-toggle" data-help-title="See your favourites" data-help-text="Shows every favourite across your whole media library. Click again to return to the exact folder, page and filters you were using before."><?php echo $this->icon( 'heart' ); // phpcs:ignore ?> <span>See your favourites</span></button>
                        </div>
                    </div>

                    <div class="smo-upload-progress" id="smo-upload-progress" hidden aria-live="polite" aria-atomic="true">
                        <div class="smo-upload-progress__status">
                            <span class="smo-upload-progress__pulse" aria-hidden="true"></span>
                            <strong id="smo-upload-progress-label">Uploading…</strong>
                            <span id="smo-upload-progress-detail">Starting upload…</span>
                        </div>
                        <div class="smo-upload-progress__track" id="smo-upload-progress-bar" role="progressbar" aria-label="Media upload progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                            <span class="smo-upload-progress__fill" id="smo-upload-progress-fill"></span>
                        </div>
                    </div>

                    <section class="smo-trash-guide" id="smo-trash-toolbar" hidden aria-labelledby="smo-trash-guide-title">
                        <div class="smo-trash-guide__head">
                            <div class="smo-trash-guide__intro">
                                <span class="smo-trash-guide__icon"><?php echo $this->icon( 'trash' ); // phpcs:ignore ?></span>
                                <div>
                                    <div class="smo-eyebrow">Protected holding area</div>
                                    <h2 id="smo-trash-guide-title">Trash keeps media recoverable until you deliberately purge it.</h2>
                                    <p id="smo-trash-toolbar-note">Nothing here is permanently deleted automatically.</p>
                                </div>
                            </div>
                            <div class="smo-trash-guide__head-actions">
                                <a class="smo-button smo-button--ghost smo-trash-settings-link" href="<?php echo esc_url( admin_url( 'admin.php?page=simme-media-settings' ) ); ?>" data-help-title="Trash settings" data-help-text="Change the normal protection period used when new items enter Trash."><?php echo $this->icon( 'settings' ); // phpcs:ignore ?><span>Trash settings</span></a>
                                <button type="button" class="smo-button smo-button--ghost smo-trash-purge-ready" id="smo-trash-purge-ready" data-help-title="Purge ready Trash items" data-help-text="Permanently deletes only Trash items whose purge gate is already unlocked. This requires two deliberate confirmations."><?php echo $this->icon( 'trash' ); // phpcs:ignore ?><span>Purge ready items</span></button>
                            </div>
                        </div>
                        <div class="smo-trash-guide__steps" role="list" aria-label="How Simme Trash works">
                            <article class="smo-trash-guide__step is-restore" role="listitem">
                                <span class="smo-trash-guide__step-number">1</span>
                                <div><strong>Restore if you change your mind</strong><p>Restore puts the same WordPress attachment back into your working library. Its file, URL, folder and Simme information stay intact.</p></div>
                            </article>
                            <article class="smo-trash-guide__step is-timer" role="listitem">
                                <span class="smo-trash-guide__step-number">2</span>
                                <div><strong>Wait, or set your own purge unlock timer</strong><p>Normal protection uses your Settings period. If you deliberately need server space sooner, select Trash media and choose <b>Set purge timer</b>. The timer only unlocks purge; it never deletes automatically.</p></div>
                            </article>
                            <article class="smo-trash-guide__step is-purge" role="listitem">
                                <span class="smo-trash-guide__step-number">3</span>
                                <div><strong>Purge only when you mean permanent</strong><p>Purge removes the WordPress attachment and its server files. It cannot be restored and still requires two deliberate confirmation gates.</p></div>
                            </article>
                        </div>
                        <div class="smo-trash-guide__rule">
                            <span><?php echo $this->icon( 'info' ); // phpcs:ignore ?></span>
                            <p><strong>Simple rule:</strong> Restore is safe. The timer only controls when purge becomes available. Purge is the only action here that permanently removes the media from the server.</p>
                        </div>
                    </section>

                    <div class="smo-controlbar">
                        <div class="smo-filter-group">
                            <div class="smo-file-type-filter" id="smo-file-type-filter">
                                <button type="button" class="smo-file-type-filter__trigger" id="smo-file-type-filter-trigger" aria-haspopup="menu" aria-expanded="false" aria-controls="smo-file-type-filter-menu" data-help-title="File Types" data-help-text="Choose a broad media family or a specific file format. Simme uses the same file-type panels shown on media cards.">
                                    <span class="smo-file-type-filter__current-visual" id="smo-file-type-filter-current-visual"><span class="smo-file-badge is-file">ALL</span></span>
                                    <span class="smo-file-type-filter__current-label" id="smo-file-type-filter-current-label">All file types</span>
                                    <span class="smo-file-type-filter__chevron" aria-hidden="true"><?php echo $this->icon( 'chevron' ); // phpcs:ignore ?></span>
                                </button>
                                <div class="smo-file-type-filter__menu" id="smo-file-type-filter-menu" role="menu" aria-label="File Types" hidden>
                                    <div class="smo-file-type-filter__menu-head"><strong>File Types</strong><span>Filter using the same format panels shown on your media.</span></div>
                                    <button type="button" class="smo-file-type-option is-active" role="menuitemradio" aria-checked="true" data-type-value="all" data-filter-label="All file types"><span class="smo-file-type-option__visual"><span class="smo-file-badge is-file">ALL</span></span><span><strong>All file types</strong><small>Show every supported format</small></span></button>

                                    <div class="smo-file-type-filter__group-label">Images</div>
                                    <button type="button" class="smo-file-type-option" role="menuitemradio" aria-checked="false" data-type-value="image" data-filter-label="All images"><span class="smo-file-type-option__visual"><span class="smo-file-badge is-file">IMG</span></span><span><strong>All images</strong><small>Every image format</small></span></button>
                                    <button type="button" class="smo-file-type-option" role="menuitemradio" aria-checked="false" data-type-value="ext-jpg" data-filter-label="JPG / JPEG"><span class="smo-file-type-option__visual"><span class="smo-file-badge is-jpg">JPG</span></span><span><strong>JPG / JPEG</strong><small>JPEG images</small></span></button>
                                    <button type="button" class="smo-file-type-option" role="menuitemradio" aria-checked="false" data-type-value="ext-png" data-filter-label="PNG"><span class="smo-file-type-option__visual"><span class="smo-file-badge is-png">PNG</span></span><span><strong>PNG</strong><small>Portable Network Graphics</small></span></button>
                                    <button type="button" class="smo-file-type-option" role="menuitemradio" aria-checked="false" data-type-value="ext-webp" data-filter-label="WEBP"><span class="smo-file-type-option__visual"><span class="smo-file-badge is-webp">WEBP</span></span><span><strong>WEBP</strong><small>WebP images</small></span></button>
                                    <button type="button" class="smo-file-type-option" role="menuitemradio" aria-checked="false" data-type-value="ext-gif" data-filter-label="GIF"><span class="smo-file-type-option__visual"><span class="smo-file-badge is-gif">GIF</span></span><span><strong>GIF</strong><small>Animated or static GIF</small></span></button>
                                    <button type="button" class="smo-file-type-option" role="menuitemradio" aria-checked="false" data-type-value="ext-svg" data-filter-label="SVG"><span class="smo-file-type-option__visual"><span class="smo-file-badge is-svg">SVG</span></span><span><strong>SVG</strong><small>Scalable vector graphics</small></span></button>
                                    <button type="button" class="smo-file-type-option" role="menuitemradio" aria-checked="false" data-type-value="ext-avif" data-filter-label="AVIF"><span class="smo-file-type-option__visual"><span class="smo-file-badge is-avif">AVIF</span></span><span><strong>AVIF</strong><small>AVIF images</small></span></button>

                                    <div class="smo-file-type-filter__group-label">Documents</div>
                                    <button type="button" class="smo-file-type-option" role="menuitemradio" aria-checked="false" data-type-value="document" data-filter-label="All documents"><span class="smo-file-type-option__visual"><span class="smo-file-badge is-file">DOCS</span></span><span><strong>All documents</strong><small>Documents and archives</small></span></button>
                                    <button type="button" class="smo-file-type-option" role="menuitemradio" aria-checked="false" data-type-value="ext-pdf" data-filter-label="PDF"><span class="smo-file-type-option__visual"><span class="smo-file-badge is-pdf">PDF</span></span><span><strong>PDF</strong><small>PDF documents</small></span></button>
                                    <button type="button" class="smo-file-type-option" role="menuitemradio" aria-checked="false" data-type-value="ext-doc" data-filter-label="DOC / DOCX"><span class="smo-file-type-option__visual"><span class="smo-file-badge is-doc">DOC</span></span><span><strong>DOC / DOCX</strong><small>Word documents</small></span></button>
                                    <button type="button" class="smo-file-type-option" role="menuitemradio" aria-checked="false" data-type-value="ext-sheet" data-filter-label="XLS / CSV"><span class="smo-file-type-option__visual"><span class="smo-file-badge is-sheet">XLS</span></span><span><strong>XLS / XLSX / CSV</strong><small>Spreadsheet files</small></span></button>
                                    <button type="button" class="smo-file-type-option" role="menuitemradio" aria-checked="false" data-type-value="ext-slides" data-filter-label="PPT / PPTX"><span class="smo-file-type-option__visual"><span class="smo-file-badge is-slides">PPT</span></span><span><strong>PPT / PPTX</strong><small>Presentation files</small></span></button>
                                    <button type="button" class="smo-file-type-option" role="menuitemradio" aria-checked="false" data-type-value="ext-archive" data-filter-label="Archives"><span class="smo-file-type-option__visual"><span class="smo-file-badge is-archive">ZIP</span></span><span><strong>ZIP / archives</strong><small>Compressed archive files</small></span></button>

                                    <div class="smo-file-type-filter__group-label">Audio &amp; video</div>
                                    <button type="button" class="smo-file-type-option" role="menuitemradio" aria-checked="false" data-type-value="audio" data-filter-label="All audio"><span class="smo-file-type-option__visual"><span class="smo-file-badge is-audio">AUD</span></span><span><strong>All audio</strong><small>Every audio format</small></span></button>
                                    <button type="button" class="smo-file-type-option" role="menuitemradio" aria-checked="false" data-type-value="ext-mp3" data-filter-label="MP3"><span class="smo-file-type-option__visual"><span class="smo-file-badge is-audio">MP3</span></span><span><strong>MP3</strong><small>MPEG audio</small></span></button>
                                    <button type="button" class="smo-file-type-option" role="menuitemradio" aria-checked="false" data-type-value="ext-audio-other" data-filter-label="WAV / M4A"><span class="smo-file-type-option__visual"><span class="smo-file-badge is-audio">WAV</span></span><span><strong>WAV / M4A / AAC</strong><small>Other common audio</small></span></button>
                                    <button type="button" class="smo-file-type-option" role="menuitemradio" aria-checked="false" data-type-value="video" data-filter-label="All video"><span class="smo-file-type-option__visual"><span class="smo-file-badge is-video">VID</span></span><span><strong>All video</strong><small>Every video format</small></span></button>
                                    <button type="button" class="smo-file-type-option" role="menuitemradio" aria-checked="false" data-type-value="ext-mp4" data-filter-label="MP4"><span class="smo-file-type-option__visual"><span class="smo-file-badge is-video">MP4</span></span><span><strong>MP4</strong><small>MPEG-4 video</small></span></button>
                                    <button type="button" class="smo-file-type-option" role="menuitemradio" aria-checked="false" data-type-value="ext-video-other" data-filter-label="MOV / WEBM"><span class="smo-file-type-option__visual"><span class="smo-file-badge is-video">MOV</span></span><span><strong>MOV / WEBM</strong><small>Other common video</small></span></button>
                                </div>
                                <select id="smo-type-filter" class="smo-file-type-filter__proxy" aria-hidden="true" tabindex="-1">
                                    <option value="all">All file types</option>
                                    <option value="image">All images</option>
                                    <option value="ext-jpg">JPG / JPEG</option>
                                    <option value="ext-png">PNG</option>
                                    <option value="ext-webp">WEBP</option>
                                    <option value="ext-gif">GIF</option>
                                    <option value="ext-svg">SVG</option>
                                    <option value="ext-avif">AVIF</option>
                                    <option value="document">All documents</option>
                                    <option value="ext-pdf">PDF</option>
                                    <option value="ext-doc">DOC / DOCX</option>
                                    <option value="ext-sheet">XLS / XLSX / CSV</option>
                                    <option value="ext-slides">PPT / PPTX</option>
                                    <option value="ext-archive">ZIP / archives</option>
                                    <option value="audio">All audio</option>
                                    <option value="ext-mp3">MP3</option>
                                    <option value="ext-audio-other">WAV / M4A / AAC</option>
                                    <option value="video">All video</option>
                                    <option value="ext-mp4">MP4</option>
                                    <option value="ext-video-other">MOV / WEBM</option>
                                </select>
                            </div>
                            <select id="smo-alt-filter" aria-label="Alt text status" data-help-title="Alt text filter" data-help-text="Filter the current view by alt text status so you can focus on missing or completed accessibility details.">
                                <option value="all">Any alt status</option>
                                <option value="missing">Missing alt text</option>
                                <option value="present">Has alt text</option>
                            </select>
                            <select id="smo-sort" aria-label="Sort media" data-help-title="Sort order" data-help-text="Changes the order of the media shown in the current view. Saved custom positioning returns when temporary sorting is cleared.">
                                <option value="custom" hidden disabled>Custom positioning</option>
                                <option value="date_desc">Newest first</option>
                                <option value="date_asc">Oldest first</option>
                                <option value="title_asc">Name A–Z</option>
                                <option value="title_desc">Name Z–A</option>
                            </select>
                        </div>

                        <div class="smo-controlbar-tools">
                            <div class="smo-history-controls" role="group" aria-label="Undo and redo recent media actions">
                                <button type="button" class="smo-history-button" id="smo-history-undo" disabled data-help-title="Undo" data-help-text="Undo the most recent reversible Media Organiser action, such as moving media between virtual folders. Destructive operations are never offered here.">
                                    <img src="<?php echo esc_url( add_query_arg( 'ver', rawurlencode( SIMME_MEDIA_ORGANISER_VERSION ), SIMME_MEDIA_ORGANISER_URL . 'assets/img/history-undo.svg' ) ); ?>" alt="" aria-hidden="true" /><span>Undo</span>
                                </button>
                                <button type="button" class="smo-history-button" id="smo-history-redo" disabled data-help-title="Redo" data-help-text="Re-apply the most recently undone reversible Media Organiser action when it is still safe to do so.">
                                    <img src="<?php echo esc_url( add_query_arg( 'ver', rawurlencode( SIMME_MEDIA_ORGANISER_VERSION ), SIMME_MEDIA_ORGANISER_URL . 'assets/img/history-redo.svg' ) ); ?>" alt="" aria-hidden="true" /><span>Redo</span>
                                </button>
                            </div>
                            <button type="button" class="smo-button smo-button--ghost smo-button--help" id="smo-help-toggle" aria-pressed="true" data-help-title="Hover help" data-help-text="Turn hover help on or off. When help is on, rest the pointer briefly over a control to see a short explanation positioned away from your working controls."><?php echo $this->icon( 'help' ); // phpcs:ignore ?> <span>Help: On</span></button>
                            <div class="smo-view-switcher" role="group" aria-label="View">
                                <button type="button" data-view="grid" title="Grid view" data-help-title="Grid view" data-help-text="Shows compact media cards so you can scan many items quickly."><?php echo $this->icon( 'grid' ); // phpcs:ignore ?></button>
                                <button type="button" data-view="detailed" title="Detailed grid" data-help-title="Detailed grid" data-help-text="Shows larger cards with more information visible at a glance."><?php echo $this->icon( 'info' ); // phpcs:ignore ?></button>
                                <button type="button" data-view="list" title="List view" data-help-title="List view" data-help-text="Shows media in a denser list layout for fast scanning and sorting."><?php echo $this->icon( 'list' ); // phpcs:ignore ?></button>
                            </div>
                        </div>
                    </div>

                    <div class="smo-selection-row">
                        <div class="smo-selection-row__left">
                            <label class="smo-select-all" data-help-title="Select this page" data-help-text="Selects every item currently shown on this page so you can move or favourite them in bulk."><input type="checkbox" id="smo-select-all" /> <span>Select this page</span></label>
                            <button type="button" class="smo-range-toggle is-on" id="smo-range-toggle" role="switch" aria-checked="true" data-help-title="Range selection" data-help-text="Turn Range Select on when you want to choose a first item and a last item and automatically select everything between them. Turn it off for normal individual selection.">
                                <span class="smo-range-toggle__switch" aria-hidden="true"><i></i></span>
                                <span class="smo-range-toggle__text"><strong>Range Select</strong><small id="smo-range-mode-label">On · choose first, then last</small></span>
                            </button>
                            <button type="button" class="smo-clear-selection-button smo-clear-selection-control" disabled data-help-title="Clear selection" data-help-text="Clears every currently selected media item without changing folders, favourites or Range Select mode."><?php echo $this->icon( 'close' ); // phpcs:ignore ?><span>Clear selection</span></button>
                        </div>
                        <div class="smo-selection-row__right">
                            <div class="smo-pagination smo-pagination--top" aria-label="Media pagination">
                                <button type="button" class="smo-button smo-button--ghost smo-page-prev" data-help-title="Previous page" data-help-text="Shows the previous page of media without needing to scroll to the bottom of the library.">← Previous</button>
                                <span class="smo-page-label">Page 1</span>
                                <button type="button" class="smo-button smo-button--ghost smo-page-next" data-help-title="Next page" data-help-text="Shows the next page of media without needing to scroll to the bottom of the library.">Next →</button>
                            </div>
                            <button type="button" class="smo-custom-positioning-remove" id="smo-remove-custom-positioning" hidden data-help-title="Remove Custom Positioning" data-help-text="Deletes the saved manual card order for this folder or view and returns it to automatic sorting. Media files, URLs and folder assignments are not changed."><?php echo $this->icon( 'grid' ); // phpcs:ignore ?><span>Remove Custom Positioning</span></button>
                            <button type="button" class="smo-clear-filters-button" id="smo-clear-filters" data-help-title="Clear active filters" data-help-text="Clears search, media-type, ALT and temporary sort filters while keeping you inside the folder or Smart View you are currently browsing. Saved custom positioning is preserved."><?php echo $this->icon( 'close' ); // phpcs:ignore ?><span>Clear filters</span></button>
                        </div>
                    </div>

                    <div id="smo-media-grid" class="smo-media-grid" data-view="<?php echo esc_attr( $settings['default_view'] ); ?>" aria-live="polite"></div>

                    <div class="smo-pagination smo-pagination--bottom" aria-label="Media pagination">
                        <button type="button" class="smo-button smo-button--ghost smo-page-prev" data-help-title="Previous page" data-help-text="Shows the previous page of media.">← Previous</button>
                        <span class="smo-page-label">Page 1</span>
                        <button type="button" class="smo-button smo-button--ghost smo-page-next" data-help-title="Next page" data-help-text="Shows the next page of media.">Next →</button>
                    </div>
                </main>
            </div>

            <div class="smo-bulkbar" id="smo-bulkbar" hidden>
                <div class="smo-bulkbar__count" data-help-title="Current selection" data-help-text="This is the exact live number of media items that will be included in the next bulk action.">
                    <div><span id="smo-selected-count">0</span> selected</div>
                    <small id="smo-bulk-protection-summary"></small>
                </div>
                <div class="smo-bulkbar__actions">
                    <section class="smo-bulkbar__group smo-bulkbar__group--organise" aria-label="Organise selection">
                        <span class="smo-bulkbar__group-label">Organise</span>
                        <div class="smo-bulkbar__group-controls">
                            <div class="smo-folder-picker" id="smo-bulk-folder-picker">
                                <input type="hidden" id="smo-bulk-folder" value="" />
                                <button type="button" class="smo-folder-picker__trigger" id="smo-bulk-folder-trigger" aria-haspopup="listbox" aria-expanded="false" data-help-title="Move to folder" data-help-text="Choose a virtual folder for the selected items. You can also create a new virtual folder directly from this menu.">
                                    <?php echo $this->icon( 'folder' ); // phpcs:ignore ?>
                                    <span id="smo-bulk-folder-label">Move to folder…</span>
                                    <?php echo $this->icon( 'chevron', 'smo-folder-picker__chevron' ); // phpcs:ignore ?>
                                </button>
                                <div class="smo-folder-picker__menu" id="smo-bulk-folder-menu" role="listbox" aria-label="Move selected media to folder" hidden>
                                    <div class="smo-folder-picker__head"><strong>Move selected media</strong><span>Choose a virtual folder</span></div>
                                    <button type="button" class="smo-folder-picker__option" data-bulk-folder-value="0" data-folder-label="Unfiled" role="option" style="--smo-folder-depth:0;--smo-picker-colour:#657287"><span class="smo-folder-picker__indent"></span><span class="smo-folder-picker__dot is-unfiled"></span><span class="smo-folder-picker__option-copy"><strong>Unfiled</strong><small>Main Media Library</small></span></button>
                                    <div id="smo-bulk-folder-options"></div>
                                    <div class="smo-folder-picker__divider"></div>
                                    <button type="button" class="smo-folder-picker__create" id="smo-bulk-folder-create"><?php echo $this->icon( 'plus' ); // phpcs:ignore ?><span><strong>Create new virtual folder</strong><small>Create it here, then use it as the destination</small></span></button>
                                </div>
                            </div>
                            <button type="button" class="smo-bulk-action" id="smo-bulk-move" data-help-title="Move selected items" data-help-text="Moves the selected items into the chosen virtual folder. Their URLs and physical file locations will not change."><span>Move</span></button>
                        </div>
                    </section>

                    <section class="smo-bulkbar__group smo-bulkbar__group--mark" aria-label="Mark and protect selection">
                        <span class="smo-bulkbar__group-label">Mark</span>
                        <div class="smo-bulkbar__group-controls">
                            <button type="button" class="smo-bulk-action smo-bulk-action--favourite" id="smo-bulk-favourite" data-help-title="Favourite selected items" data-help-text="Marks currently un-favourited selected items as favourites."><?php echo $this->icon( 'heart' ); // phpcs:ignore ?><span>Favourite</span></button>
                            <button type="button" class="smo-bulk-action smo-bulk-action--unfavourite" id="smo-bulk-unfavourite" data-help-title="Un-favourite selected items" data-help-text="Removes favourite status from the favourited items in the current selection." hidden><?php echo $this->icon( 'heart' ); // phpcs:ignore ?><span>Un-favourite</span></button>
                            <button type="button" class="smo-bulk-action smo-bulk-action--protect" id="smo-bulk-protect" data-help-title="Protect selected assets" data-help-text="Marks currently unprotected selected assets as protected so WordPress deletion is blocked until protection is removed."><?php echo $this->icon( 'shield' ); // phpcs:ignore ?><span>Protect</span></button>
                            <button type="button" class="smo-bulk-action smo-bulk-action--unprotect" id="smo-bulk-unprotect" data-help-title="Un-protect selected assets" data-help-text="Removes deletion protection from the protected items in the current selection." hidden><?php echo $this->icon( 'shield-off' ); // phpcs:ignore ?><span>Un-protect</span></button>
                        </div>
                    </section>

                    <section class="smo-bulkbar__group smo-bulkbar__group--trash" aria-label="Trash selected media">
                        <div class="smo-bulkbar__group-controls">
                            <button type="button" class="smo-bulk-action smo-bulk-action--trash" id="smo-bulk-trash" data-help-title="Move selected media to Trash" data-help-text="Moves eligible selected media into Simme's recoverable Trash holding area. The files and public URLs stay intact until a later permanent purge."><?php echo $this->icon( 'trash' ); // phpcs:ignore ?><span>Move to Trash</span></button>
                            <button type="button" class="smo-bulk-action smo-bulk-action--restore" id="smo-bulk-restore" hidden data-help-title="Restore selected media" data-help-text="Restores selected Trash items to the working library with their existing attachment IDs, URLs, folders and Simme metadata intact."><?php echo $this->icon( 'recent' ); // phpcs:ignore ?><span>Restore</span></button>
                            <button type="button" class="smo-bulk-action smo-bulk-action--timer" id="smo-bulk-trash-timer" hidden data-help-title="Set purge unlock timer" data-help-text="Choose exactly how long Simme should keep permanent purge locked for the selected Trash items. This never deletes anything automatically."><?php echo $this->icon( 'recent' ); // phpcs:ignore ?><span>Set purge timer</span></button>
                            <button type="button" class="smo-bulk-action smo-bulk-action--purge" id="smo-bulk-purge" hidden data-help-title="Permanently purge selected media" data-help-text="Permanently deletes selected Trash items after their purge gate is unlocked. This cannot be undone and requires two confirmations."><?php echo $this->icon( 'trash' ); // phpcs:ignore ?><span>Purge permanently</span></button>
                        </div>
                    </section>

                    <section class="smo-bulkbar__group smo-bulkbar__group--output" aria-label="Use selected media">
                        <span class="smo-bulkbar__group-label">Use</span>
                        <div class="smo-bulkbar__group-controls">
                            <button type="button" class="smo-bulk-action smo-bulk-action--url" id="smo-bulk-url-download" data-help-title="URL Download" data-help-text="Downloads one Markdown file containing the exact WordPress URLs and useful details for every selected media item."><?php echo $this->icon( 'export' ); // phpcs:ignore ?><span>URL Download</span></button>
                        </div>
                    </section>

                    <button type="button" class="smo-icon-button smo-clear-selection-control smo-bulkbar__close" title="Clear selection" aria-label="Clear selection" data-help-title="Clear selection" data-help-text="Clears every selected media item and closes this action bar without changing the media themselves."><?php echo $this->icon( 'close' ); // phpcs:ignore ?></button>
                </div>
            </div>

            <aside class="smo-inspector" id="smo-inspector" aria-hidden="true">
                <div class="smo-inspector__header">
                    <div>
                        <div class="smo-eyebrow">Quick edit</div>
                        <h2 id="smo-inspector-title">Media item</h2>
                    </div>
                    <button type="button" class="smo-icon-button" id="smo-inspector-close" title="Close"><?php echo $this->icon( 'close' ); // phpcs:ignore ?></button>
                </div>
                <div id="smo-inspector-content" class="smo-inspector__content"></div>
            </aside>

            <div class="smo-alt-modal" id="smo-alt-modal" aria-hidden="true">
                <div class="smo-alt-modal__scrim" id="smo-alt-cancel-scrim"></div>
                <div class="smo-alt-modal__panel" role="dialog" aria-modal="true" aria-labelledby="smo-alt-modal-title">
                    <div class="smo-alt-modal__head">
                        <div><div class="smo-eyebrow">Rapid ALT entry</div><h2 id="smo-alt-modal-title">Add ALT text</h2></div>
                        <button type="button" class="smo-icon-button" id="smo-alt-close" title="Close"><?php echo $this->icon( 'close' ); // phpcs:ignore ?></button>
                    </div>
                    <div class="smo-alt-modal__context">
                        <div class="smo-alt-modal__thumb"><img id="smo-alt-thumb" src="" alt="" /></div>
                        <div class="smo-alt-modal__file"><strong id="smo-alt-filename">Image</strong><span>Describe the image briefly for someone who cannot see it.</span></div>
                    </div>
                    <label class="smo-field smo-alt-modal__field"><span>ALT text</span><textarea id="smo-alt-input" rows="3" maxlength="500" placeholder="Describe what this image shows or communicates…"></textarea></label>
                    <div class="smo-alt-modal__hint"><span id="smo-alt-char-count">0</span>/500 · Keep it useful and specific. Decorative images can be left empty.</div>
                    <div class="smo-alt-modal__actions">
                        <button type="button" class="smo-button smo-button--ghost" id="smo-alt-cancel">Cancel</button>
                        <button type="button" class="smo-button smo-button--primary" id="smo-alt-save">Save ALT</button>
                    </div>
                </div>
            </div>

            <div class="smo-modal" id="smo-folder-modal" aria-hidden="true">
                <div class="smo-modal__scrim" data-close-modal></div>
                <div class="smo-modal__panel" role="dialog" aria-modal="true" aria-labelledby="smo-folder-modal-title">
                    <div class="smo-modal__head"><h2 id="smo-folder-modal-title">Create folder</h2><button type="button" class="smo-icon-button" data-close-modal><?php echo $this->icon( 'close' ); // phpcs:ignore ?></button></div>
                    <label class="smo-field"><span>Folder name</span><input id="smo-folder-name" type="text" maxlength="80" /></label>
                    <label class="smo-field"><span>Inside</span><select id="smo-folder-parent"><option value="0">Top level</option></select></label>
                    <label class="smo-field"><span>Accent colour</span><input id="smo-folder-colour" type="color" value="#8c5cff" /></label>
                    <div class="smo-modal__actions"><button type="button" class="smo-button smo-button--ghost" data-close-modal>Cancel</button><button type="button" class="smo-button smo-button--primary" id="smo-create-folder-submit">Create folder</button></div>
                </div>
            </div>
            </div>

            <div class="smo-command-modal" id="smo-command-modal" aria-hidden="true">
                <div class="smo-command-modal__scrim" data-command-close></div>
                <section class="smo-command-panel" role="dialog" aria-modal="true" aria-labelledby="smo-command-title">
                    <div class="smo-command-search"><?php echo $this->icon( 'search' ); // phpcs:ignore ?><input id="smo-command-input" type="search" placeholder="Search media or run a command…" autocomplete="off" /><kbd>⌘K</kbd></div>
                    <div class="smo-command-caption" id="smo-command-title">Quick Find</div>
                    <div class="smo-command-results" id="smo-command-results"></div>
                </section>
            </div>

            <div class="smo-help-panel" id="smo-help-panel" aria-live="polite" aria-atomic="true" hidden>
                <div class="smo-help-panel__eyebrow">Hover help</div>
                <div class="smo-help-panel__title" id="smo-help-title">Hover over something</div>
                <div class="smo-help-panel__text" id="smo-help-text">Rest the pointer over a control for about two seconds to see a short explanation.</div>
            </div>

            <div class="smo-studio-modal" id="smo-image-studio" aria-hidden="true">
                <div class="smo-studio-modal__scrim" data-studio-close></div>
                <section class="smo-studio-shell" role="dialog" aria-modal="true" aria-labelledby="smo-studio-title">
                    <header class="smo-studio-header">
                        <div class="smo-studio-heading">
                            <img class="smo-studio-heading__icon" src="<?php echo esc_url( add_query_arg( 'ver', rawurlencode( SIMME_MEDIA_ORGANISER_VERSION ), SIMME_MEDIA_ORGANISER_URL . 'assets/img/studio-animated.svg' ) ); ?>" alt="" aria-hidden="true" />
                            <div class="smo-studio-heading__copy">
                                <div class="smo-eyebrow">Simme Image Studio</div>
                                <h2 id="smo-studio-title">Image Studio</h2>
                                <div class="smo-studio-safe"><span><?php echo $this->icon( 'lock' ); // phpcs:ignore ?> Protected master</span><strong>Your source image is never overwritten by normal Studio edits.</strong></div>
                            </div>
                        </div>
                        <button type="button" class="smo-studio-close" data-studio-close aria-label="Close Image Studio"><?php echo $this->icon( 'close' ); // phpcs:ignore ?><span>Close Studio</span></button>
                    </header>
                    <div class="smo-studio-content" id="smo-studio-content"></div>
                </section>
            </div>

            <div class="smo-social-recovery-modal" id="smo-social-recovery-dialog" aria-hidden="true">
                <div class="smo-social-recovery-modal__scrim" data-social-recovery-cancel></div>
                <section class="smo-social-recovery-modal__panel" role="dialog" aria-modal="true" aria-labelledby="smo-social-recovery-title" aria-describedby="smo-social-recovery-copy">
                    <button type="button" class="smo-social-recovery-modal__close" data-social-recovery-cancel aria-label="Close social crop recovery"><?php echo $this->icon( 'close' ); // phpcs:ignore ?></button>
                    <div class="smo-eyebrow">Older saved version</div>
                    <h3 id="smo-social-recovery-title">Which social channel was this crop made for?</h3>
                    <p id="smo-social-recovery-copy">This Working Version was saved before Simme stored the social channel with the crop. Choose the original channel to restore the correct fixed ratio, target size and safe-zone guide.</p>
                    <div class="smo-social-recovery-modal__target" id="smo-social-recovery-target"></div>
                    <div class="smo-social-recovery-modal__options" id="smo-social-recovery-options" role="group" aria-label="Choose original social channel"></div>
                    <div class="smo-social-recovery-modal__note"><?php echo $this->icon( 'info' ); // phpcs:ignore ?><span>Your image file is not changed by this choice. Simme only adds the missing social-channel identity to the saved edit recipe.</span></div>
                    <div class="smo-social-recovery-modal__actions">
                        <button type="button" class="smo-button smo-button--ghost" data-social-recovery-cancel>Cancel</button>
                    </div>
                </section>
            </div>

            <div class="smo-trash-timer-modal" id="smo-trash-timer-dialog" aria-hidden="true">
                <div class="smo-trash-timer-modal__scrim" data-trash-timer-close></div>
                <section class="smo-trash-timer-modal__panel" role="dialog" aria-modal="true" aria-labelledby="smo-trash-timer-title" aria-describedby="smo-trash-timer-copy">
                    <div class="smo-trash-timer-modal__head">
                        <div>
                            <div class="smo-eyebrow">Trash safety gate</div>
                            <h3 id="smo-trash-timer-title">Set purge unlock timer</h3>
                        </div>
                        <button type="button" class="smo-icon-button" data-trash-timer-close aria-label="Close purge timer"><?php echo $this->icon( 'close' ); // phpcs:ignore ?></button>
                    </div>
                    <p id="smo-trash-timer-copy">Choose how long permanent purge should remain locked for the selected Trash media. When this timer ends, the files are only <strong>ready to purge</strong> — Simme still will not delete them automatically.</p>
                    <div class="smo-trash-timer-modal__selection" id="smo-trash-timer-selection">1 Trash item selected</div>
                    <div class="smo-trash-timer-modal__controls">
                        <label class="smo-field smo-trash-timer-field"><span>Unlock purge after</span><input id="smo-trash-timer-amount" type="number" min="0" step="1" value="24" inputmode="decimal" /></label>
                        <label class="smo-field smo-trash-timer-unit"><span>Time unit</span><select id="smo-trash-timer-unit"><option value="minutes">Minutes</option><option value="hours" selected>Hours</option><option value="days">Days</option></select></label>
                    </div>
                    <div class="smo-trash-timer-modal__quick" aria-label="Quick timer choices">
                        <button type="button" data-trash-timer-quick="0" data-trash-timer-unit="minutes">Ready now</button>
                        <button type="button" data-trash-timer-quick="1" data-trash-timer-unit="hours">1 hour</button>
                        <button type="button" data-trash-timer-quick="24" data-trash-timer-unit="hours">24 hours</button>
                        <button type="button" data-trash-timer-quick="7" data-trash-timer-unit="days">7 days</button>
                    </div>
                    <div class="smo-trash-timer-modal__warning"><?php echo $this->icon( 'info' ); // phpcs:ignore ?><span><strong>Ready now does not delete anything.</strong> It only removes the waiting period so the separate two-gate Purge permanently action can be used immediately.</span></div>
                    <div class="smo-trash-timer-modal__actions">
                        <button type="button" class="smo-button smo-button--ghost" id="smo-trash-timer-reset">Use normal protection period</button>
                        <span class="smo-trash-timer-modal__spacer"></span>
                        <button type="button" class="smo-button smo-button--ghost" data-trash-timer-close>Cancel</button>
                        <button type="button" class="smo-button smo-button--primary" id="smo-trash-timer-save">Set purge timer</button>
                    </div>
                </section>
            </div>

            <div class="smo-confirm-modal" id="smo-confirm-dialog" aria-hidden="true">
                <div class="smo-confirm-modal__scrim" data-smo-confirm-cancel></div>
                <section class="smo-confirm-modal__panel" role="dialog" aria-modal="true" aria-labelledby="smo-confirm-title" aria-describedby="smo-confirm-message">
                    <div class="smo-confirm-modal__icon" id="smo-confirm-icon"><?php echo $this->icon( 'info' ); // phpcs:ignore ?></div>
                    <div class="smo-confirm-modal__content">
                        <div class="smo-eyebrow">Simme Media</div>
                        <h3 id="smo-confirm-title">Confirm action</h3>
                        <p id="smo-confirm-message"></p>
                        <div class="smo-confirm-modal__note" id="smo-confirm-note" hidden></div>
                    </div>
                    <div class="smo-confirm-modal__actions">
                        <button type="button" class="smo-button smo-button--ghost" data-smo-confirm-cancel>Cancel</button>
                        <button type="button" class="smo-button smo-button--primary" id="smo-confirm-action">Continue</button>
                    </div>
                </section>
            </div>

            <div id="smo-toast-region" class="smo-toast-region" aria-live="polite" aria-atomic="true"></div>
        </div>
        <?php
    }

    public function render_health() {
        if ( ! Simme_Media_Organiser_Plugin::can_manage() ) {
            wp_die( esc_html__( 'You do not have permission to access Simme Media Organiser.', 'simme-media-organiser' ) );
        }
        $settings = Simme_Media_Organiser_Plugin::get_settings();
        $summary  = class_exists( 'Simme_Media_Organiser_Audit' ) ? Simme_Media_Organiser_Audit::health_summary() : array();
        ?>
        <div class="wrap smo-wrap" data-smo-screen="health" data-accent="<?php echo esc_attr( $settings['accent'] ); ?>"<?php if ( ! empty( $settings['reduce_motion'] ) ) : ?> data-reduce-motion="1"<?php endif; ?>>
            <?php $this->render_sprite(); ?><?php $this->render_brand_header( 'health' ); ?>
            <div class="smo-page-frame smo-health-frame">
                <div class="smo-health-hero"><div class="smo-section-hero-copy"><?php $this->render_section_hero_icon( 'health', 'Media Health' ); ?><div><div class="smo-eyebrow">Local media intelligence</div><h1>Media Health Centre</h1><p>Understand what needs attention before you touch anything. Scans run locally inside WordPress — no external API, cloud account or media upload to a third party.</p></div></div><div class="smo-health-score" id="smo-health-score"><span>Health</span><strong><?php echo esc_html( (string) ( $summary['score'] ?? 0 ) ); ?></strong><small>/ 100</small></div></div>
                <?php $this->render_page_help_control(); ?>
                <section class="smo-health-scan-panel"><div class="smo-health-scan-lane smo-health-scan-lane--library"><div class="smo-health-scan-lane__head"><div class="smo-health-scan-lane__identity"><span class="smo-health-scan-lane__icon smo-health-scan-lane__icon--image"><img class="smo-health-asset-icon" src="<?php echo esc_url( $this->health_icon_url( 'library-index' ) ); ?>" alt="" /></span><div><small>Library Index</small><strong>Media details &amp; health</strong><span>Local check of files, sizes, ALT text, folders, exact duplicates and storage.</span></div></div><div class="smo-health-scan-lane__state"><span class="smo-health-state-pill is-library">LOCAL SCAN</span><b id="smo-health-scan-state" aria-live="polite"><?php echo esc_html( (string) ( $summary['scanned'] ?? 0 ) ); ?> of <?php echo esc_html( (string) ( $summary['total'] ?? 0 ) ); ?> indexed</b></div></div><div class="smo-health-progress smo-health-progress--library"><i id="smo-health-progress-bar" style="width:<?php echo esc_attr( (string) ( $summary['scanPercent'] ?? 0 ) ); ?>%"></i></div><div class="smo-health-scan-lane__actions"><button type="button" class="smo-button smo-button--primary" id="smo-health-scan"><?php echo $this->icon( 'recent' ); // phpcs:ignore ?><span>Refresh Library Index</span></button><span>Refresh local health and storage facts without sending media off-site.</span></div></div></section>
                <div class="smo-health-grid">
                    <a class="smo-health-card" data-health-key="missingAlt" href="<?php echo esc_url( admin_url( 'admin.php?page=simme-media-organiser&view=missing-alt' ) ); ?>"><span class="smo-health-card__icon is-alt">ALT</span><div><small>Accessibility</small><strong id="smo-health-missing-alt"><?php echo esc_html( (string) ( $summary['missingAlt'] ?? 0 ) ); ?></strong><span>images missing ALT text</span></div></a>
                    <a class="smo-health-card" data-health-key="heavy" href="<?php echo esc_url( admin_url( 'admin.php?page=simme-media-organiser&view=smart-heavy' ) ); ?>"><span class="smo-health-card__icon smo-health-card__icon--image"><img class="smo-health-asset-icon" src="<?php echo esc_url( $this->health_icon_url( 'performance' ) ); ?>" alt="" /></span><div><small>Performance</small><strong id="smo-health-heavy"><?php echo esc_html( (string) ( $summary['heavy'] ?? 0 ) ); ?></strong><span>Load Grade D / E files</span></div></a>
                    <a class="smo-health-card" data-health-key="duplicates" href="<?php echo esc_url( admin_url( 'admin.php?page=simme-media-organiser&view=smart-duplicates' ) ); ?>"><span class="smo-health-card__icon smo-health-card__icon--image"><img class="smo-health-asset-icon" src="<?php echo esc_url( $this->health_icon_url( 'duplicates' ) ); ?>" alt="" /></span><div><small>Duplicates</small><strong id="smo-health-duplicates"><?php echo esc_html( (string) ( $summary['duplicateItems'] ?? 0 ) ); ?></strong><span>items in exact duplicate groups</span></div></a>
                    <a class="smo-health-card" data-health-key="broken" href="<?php echo esc_url( admin_url( 'admin.php?page=simme-media-organiser&view=smart-broken' ) ); ?>"><span class="smo-health-card__icon smo-health-card__icon--image"><img class="smo-health-asset-icon" src="<?php echo esc_url( $this->health_icon_url( 'integrity' ) ); ?>" alt="" /></span><div><small>Integrity</small><strong id="smo-health-broken"><?php echo esc_html( (string) ( $summary['broken'] ?? 0 ) ); ?></strong><span>missing or unreadable source files</span></div></a>
                    <a class="smo-health-card" data-health-key="unfiled" href="<?php echo esc_url( admin_url( 'admin.php?page=simme-media-organiser&view=unfiled' ) ); ?>"><span class="smo-health-card__icon smo-health-card__icon--image"><img class="smo-health-asset-icon" src="<?php echo esc_url( $this->health_icon_url( 'organisation' ) ); ?>" alt="" /></span><div><small>Organisation</small><strong id="smo-health-unfiled"><?php echo esc_html( (string) ( $summary['unfiled'] ?? 0 ) ); ?></strong><span>items not in a virtual folder</span></div></a>
                </div>
                <div class="smo-health-lower"><section class="smo-panel smo-storage-panel"><div class="smo-eyebrow">Storage explorer</div><h2>Where the media space goes</h2><div class="smo-storage-total"><strong id="smo-storage-total"><?php echo esc_html( (string) ( $summary['storage']['totalLabel'] ?? '0 B' ) ); ?></strong><span>indexed media storage</span></div><div class="smo-storage-bars"><div><span>Original files</span><strong id="smo-storage-original"><?php echo esc_html( (string) ( $summary['storage']['originalLabel'] ?? '0 B' ) ); ?></strong></div><div><span>WordPress generated sizes</span><strong id="smo-storage-derivatives"><?php echo esc_html( (string) ( $summary['storage']['derivativesLabel'] ?? '0 B' ) ); ?></strong></div><div><span>Image Studio versions</span><strong id="smo-storage-studio"><?php echo esc_html( (string) ( $summary['storage']['studioLabel'] ?? '0 B' ) ); ?></strong></div></div><div class="smo-storage-detail-grid"><div><strong>By media type</strong><div id="smo-storage-by-type" class="smo-storage-type-list"></div></div><div><strong>Largest indexed assets</strong><div id="smo-storage-largest" class="smo-storage-largest-list"></div></div></div></section><section class="smo-panel smo-activity-panel"><div class="smo-panel-title-row"><div><div class="smo-eyebrow">Safety history</div><h2>Recent activity</h2></div><?php echo $this->icon( 'history' ); // phpcs:ignore ?></div><div id="smo-health-activity" class="smo-activity-list"></div></section></div>
                <section class="smo-panel smo-health-recommendations"><div class="smo-panel-title-row"><div><div class="smo-eyebrow">Suggested next actions</div><h2>What is worth looking at first</h2></div><?php echo $this->icon( 'smart' ); // phpcs:ignore ?></div><div class="smo-health-recommendation-list" id="smo-health-recommendations"></div></section>
            </div><?php $this->render_context_help_panel(); ?><div id="smo-toast-region" class="smo-toast-region" aria-live="polite" aria-atomic="true"></div>
        </div><?php
    }



    public function render_settings() {
        if ( ! Simme_Media_Organiser_Plugin::can_manage() ) {
            wp_die( esc_html__( 'You do not have permission to access Simme Media Organiser.', 'simme-media-organiser' ) );
        }
        $settings = Simme_Media_Organiser_Plugin::get_settings();
        ?>
        <div class="wrap smo-wrap" data-smo-screen="settings" data-accent="<?php echo esc_attr( $settings['accent'] ); ?>">
            <?php $this->render_sprite(); ?><?php $this->render_brand_header( 'settings' ); ?>
            <div class="smo-page-frame smo-settings-frame">
                <div class="smo-page-intro"><div class="smo-section-hero-copy"><?php $this->render_section_hero_icon( 'settings', 'Settings' ); ?><div><div class="smo-eyebrow">Workspace</div><h1>Settings</h1><p>Control how dense and animated your media workspace feels. These settings never alter media files.</p></div></div></div>
                <?php $this->render_page_help_control(); ?>
                <form action="options.php" method="post" class="smo-settings-form">
                    <?php settings_fields( 'simme_media_organiser_settings_group' ); ?>
                    <section class="smo-panel"><div class="smo-panel-icon"><?php echo $this->icon( 'grid' ); // phpcs:ignore ?></div><h2>Library layout</h2><label class="smo-field"><span>Items per page</span><input type="number" name="simme_media_organiser_settings[items_per_page]" min="12" max="120" step="12" value="<?php echo esc_attr( (string) $settings['items_per_page'] ); ?>" /></label><label class="smo-field"><span>Default view</span><select name="simme_media_organiser_settings[default_view]"><option value="grid" <?php selected( $settings['default_view'], 'grid' ); ?>>Grid</option><option value="detailed" <?php selected( $settings['default_view'], 'detailed' ); ?>>Detailed grid</option><option value="list" <?php selected( $settings['default_view'], 'list' ); ?>>List</option></select></label><label class="smo-field"><span>Accent</span><select name="simme_media_organiser_settings[accent]"><option value="violet" <?php selected( $settings['accent'], 'violet' ); ?>>Violet</option><option value="blue" <?php selected( $settings['accent'], 'blue' ); ?>>Blue</option><option value="lime" <?php selected( $settings['accent'], 'lime' ); ?>>Lime</option><option value="gold" <?php selected( $settings['accent'], 'gold' ); ?>>Gold</option></select></label><label class="smo-check-field"><input type="checkbox" name="simme_media_organiser_settings[reduce_motion]" value="1" <?php checked( ! empty( $settings['reduce_motion'] ) ); ?> /><span><strong>Reduce motion</strong><small>Uses calmer transitions and discovery cues.</small></span></label></section>
                    <section class="smo-panel"><div class="smo-panel-icon"><?php echo $this->icon( 'grid' ); // phpcs:ignore ?></div><h2>WordPress media picker</h2><p class="smo-settings-note">Bring Simme folders and favourites into compatible WordPress media-selection windows that use the standard <code>wp.media</code> frame.</p><label class="smo-check-field"><input type="checkbox" name="simme_media_organiser_settings[media_picker_enabled]" value="1" <?php checked( ! empty( $settings['media_picker_enabled'] ) ); ?> /><span><strong>Show Simme Media in WordPress media windows</strong><small>Turning this off restores the standard WordPress picker with no other changes.</small></span></label><div class="smo-rule-safety"><strong>Compatibility first</strong><span>Simme does not replace WordPress Media Library. It adds another view and hands the selected WordPress attachment back to the original picker.</span></div></section>
                    <section class="smo-panel smo-trash-settings-panel"><div class="smo-panel-icon"><?php echo $this->icon( 'trash' ); // phpcs:ignore ?></div><h2>Trash &amp; deletion safety</h2><p class="smo-settings-note">Moving media to Trash is recoverable and does not delete its file. Expiry only makes an item ready to purge; deletion still requires deliberate safety gates.</p><label class="smo-field"><span>Default Trash protection period</span><select name="simme_media_organiser_settings[trash_retention_days]"><?php foreach ( array( 1 => '1 day', 7 => '7 days', 14 => '14 days', 30 => '30 days', 60 => '60 days', 90 => '90 days' ) as $trash_days => $trash_label ) : ?><option value="<?php echo esc_attr( $trash_days ); ?>" <?php selected( (int) $settings['trash_retention_days'], $trash_days ); ?>><?php echo esc_html( $trash_label ); ?></option><?php endforeach; ?></select></label><div class="smo-rule-safety"><strong>Manual purge only</strong><span>Expiry never deletes media by itself. You still have to deliberately use Purge permanently and pass both safety gates.</span></div></section>
                    <?php submit_button( __( 'Save settings', 'simme-media-organiser' ), 'primary smo-wp-submit' ); ?>
                </form>
            </div><?php $this->render_context_help_panel(); ?><div id="smo-toast-region" class="smo-toast-region" aria-live="polite" aria-atomic="true"></div>
        </div><?php
    }

    public function native_media_folder_filter() {
        global $pagenow;
        $screen = get_current_screen();
        if ( 'upload.php' !== $pagenow || ! $screen || 'attachment' !== $screen->post_type ) {
            return;
        }

        $selected = isset( $_GET['simme_media_organiser_folder'] ) ? sanitize_text_field( wp_unslash( $_GET['simme_media_organiser_folder'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        $terms = get_terms( array( 'taxonomy' => SIMME_MEDIA_ORGANISER_TAXONOMY, 'hide_empty' => false ) );
        ?>
        <select name="simme_media_organiser_folder" id="smo-folder-native-filter">
            <option value=""><?php esc_html_e( 'All Simme folders', 'simme-media-organiser' ); ?></option>
            <option value="unfiled" <?php selected( $selected, 'unfiled' ); ?>><?php esc_html_e( 'Unfiled', 'simme-media-organiser' ); ?></option>
            <?php if ( ! is_wp_error( $terms ) ) : foreach ( $terms as $term ) : ?>
                <option value="<?php echo esc_attr( $term->term_id ); ?>" <?php selected( $selected, (string) $term->term_id ); ?>><?php echo esc_html( Simme_Media_Organiser_Plugin::folder_path( $term->term_id ) ); ?></option>
            <?php endforeach; endif; ?>
        </select>
        <?php
    }

    private function native_trash_exclusion_meta_query( $existing = array() ) {
        $existing = is_array( $existing ) ? $existing : array();
        $trash_clause = array(
            'key'     => Simme_Media_Organiser_Trash::META_KEY,
            'compare' => 'NOT EXISTS',
        );

        // Existing WordPress/media-picker queries may use a top-level OR relation.
        // Nest that query beneath an explicit AND before adding the Trash exclusion,
        // otherwise an OR relation could accidentally make trashed attachments visible.
        if ( ! $existing ) {
            return array( $trash_clause );
        }

        return array(
            'relation' => 'AND',
            $existing,
            $trash_clause,
        );
    }

    public function filter_native_media_query( $query ) {
        if ( ! is_admin() || ! $query->is_main_query() || 'attachment' !== $query->get( 'post_type' ) ) {
            return;
        }

        // Simme Trash is a holding state, so items should disappear from the
        // working WordPress Media Library while the plugin is active. The files
        // remain untouched and reappear immediately if restored (or if Simme is
        // deactivated, because the holding state is only plugin metadata).
        if ( class_exists( 'Simme_Media_Organiser_Trash' ) ) {
            $query->set( 'meta_query', $this->native_trash_exclusion_meta_query( $query->get( 'meta_query' ) ) ); // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
        }

        if ( empty( $_GET['simme_media_organiser_folder'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
            return;
        }

        $folder = sanitize_text_field( wp_unslash( $_GET['simme_media_organiser_folder'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        if ( 'unfiled' === $folder ) {
            $query->set( 'tax_query', array( array( 'taxonomy' => SIMME_MEDIA_ORGANISER_TAXONOMY, 'operator' => 'NOT EXISTS' ) ) );
        } elseif ( absint( $folder ) ) {
            $query->set( 'tax_query', array( array( 'taxonomy' => SIMME_MEDIA_ORGANISER_TAXONOMY, 'field' => 'term_id', 'terms' => array( absint( $folder ) ), 'include_children' => true ) ) );
        }
    }

    public function filter_native_media_ajax_query( $args ) {
        if ( ! class_exists( 'Simme_Media_Organiser_Trash' ) ) {
            return $args;
        }
        $args = is_array( $args ) ? $args : array();
        $args['meta_query'] = $this->native_trash_exclusion_meta_query( $args['meta_query'] ?? array() ); // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
        return $args;
    }

    public function native_media_columns( $columns ) {
        $columns['simme_media_organiser_folder'] = __( 'Simme folder', 'simme-media-organiser' );
        return $columns;
    }

    public function native_media_column_content( $column_name, $attachment_id ) {
        if ( 'simme_media_organiser_folder' !== $column_name ) {
            return;
        }
        $folder = Simme_Media_Organiser_Plugin::attachment_folder( $attachment_id );
        if ( $folder ) {
            echo '<span class="smo-native-folder">' . esc_html( $folder['path'] ) . '</span>';
        } else {
            echo '<span class="smo-native-unfiled">' . esc_html__( 'Unfiled', 'simme-media-organiser' ) . '</span>';
        }
    }
}
