<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

final class Simme_Media_Organiser_Plugin {
    private static $instance = null;

    public static function instance() {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public static function activate() {
        self::maybe_migrate_legacy_settings();
        self::register_taxonomy();
        if ( class_exists( 'Simme_Media_Organiser_Audit' ) ) {
            Simme_Media_Organiser_Audit::maybe_install_tables();
        }
    }

    public static function deactivate() {
        // Preserve folders, favourites, protection and Studio history on deactivation.
    }

    private function __construct() {
        self::maybe_migrate_legacy_settings();
        add_action( 'init', array( __CLASS__, 'register_taxonomy' ) );
        add_action( 'init', array( $this, 'register_meta' ) );
        add_action( 'admin_init', array( __CLASS__, 'add_privacy_policy_content' ) );

        new Simme_Media_Organiser_Admin();
        new Simme_Media_Organiser_Ajax();
        new Simme_Media_Organiser_Trash();
        new Simme_Media_Organiser_Image_Studio();
        new Simme_Media_Organiser_Audit();
    }

    public static function register_taxonomy() {
        register_taxonomy(
            SIMME_MEDIA_ORGANISER_TAXONOMY,
            array( 'attachment' ),
            array(
                'labels' => array(
                    'name'          => __( 'Media Folders', 'simme-media-organiser' ),
                    'singular_name' => __( 'Media Folder', 'simme-media-organiser' ),
                ),
                'public'            => false,
                'show_ui'           => false,
                'show_admin_column' => false,
                'show_in_rest'      => false,
                'hierarchical'      => true,
                'rewrite'           => false,
                'query_var'         => false,
                'update_count_callback' => '_update_generic_term_count',
                'capabilities'      => array(
                    'manage_terms' => 'upload_files',
                    'edit_terms'   => 'upload_files',
                    'delete_terms' => 'upload_files',
                    'assign_terms' => 'upload_files',
                ),
            )
        );
    }

    public function register_meta() {
        register_post_meta(
            'attachment',
            '_smo_favourite',
            array(
                'type'              => 'boolean',
                'single'            => true,
                'default'           => false,
                'show_in_rest'      => false,
                'sanitize_callback' => static function ( $value ) { return (bool) $value; },
                'auth_callback'     => static function () { return current_user_can( 'upload_files' ); },
            )
        );

        register_post_meta(
            'attachment',
            '_simme_media_organiser_protected',
            array(
                'type'              => 'boolean',
                'single'            => true,
                'default'           => false,
                'show_in_rest'      => false,
                'sanitize_callback' => static function ( $value ) { return (bool) $value; },
                'auth_callback'     => static function () { return current_user_can( 'upload_files' ); },
            )
        );

        register_post_meta(
            'attachment',
            '_simme_media_organiser_trash',
            array(
                'type'          => 'array',
                'single'        => true,
                'show_in_rest'  => false,
                'auth_callback' => static function () { return current_user_can( 'upload_files' ); },
            )
        );

        foreach ( array( '_smo_image_master', '_smo_image_versions', '_smo_image_history', '_smo_image_state_history' ) as $studio_meta_key ) {
            register_post_meta(
                'attachment',
                $studio_meta_key,
                array(
                    'type'          => 'array',
                    'single'        => true,
                    'show_in_rest'  => false,
                    'auth_callback' => static function () { return current_user_can( 'upload_files' ); },
                )
            );
        }

        foreach ( array( '_smo_preferred_version', '_smo_active_version' ) as $studio_string_key ) {
            register_post_meta(
                'attachment',
                $studio_string_key,
                array(
                    'type'              => 'string',
                    'single'            => true,
                    'show_in_rest'      => false,
                    'sanitize_callback' => 'sanitize_text_field',
                    'auth_callback'     => static function () { return current_user_can( 'upload_files' ); },
                )
            );
        }

        register_term_meta(
            SIMME_MEDIA_ORGANISER_TAXONOMY,
            '_smo_colour',
            array(
                'type'              => 'string',
                'single'            => true,
                'show_in_rest'      => false,
                'sanitize_callback' => 'sanitize_hex_color',
                'auth_callback'     => static function () { return current_user_can( 'upload_files' ); },
            )
        );
    }

    public static function maybe_migrate_legacy_settings() {
        if ( false !== get_option( 'simme_media_organiser_settings', false ) ) {
            return;
        }
        $legacy = get_option( 'smo_settings', false );
        if ( false !== $legacy && is_array( $legacy ) ) {
            add_option( 'simme_media_organiser_settings', $legacy );
            return;
        }
        add_option(
            'simme_media_organiser_settings',
            array(
                'items_per_page'        => 48,
                'default_view'          => 'grid',
                'reduce_motion'         => 0,
                'accent'                => 'violet',
                'media_picker_enabled'  => 1,
                'trash_retention_days'  => 30,
            )
        );
    }

    public static function add_privacy_policy_content() {
        if ( ! function_exists( 'wp_add_privacy_policy_content' ) ) {
            return;
        }
        $content = wp_kses_post(
            __( '<p>Simme Media Organiser organises media, runs local Media Health checks and creates Image Studio working versions inside this WordPress installation. It does not send media, metadata, analytics or usage data to Simme or another external service.</p><p>Image Studio history can record the WordPress user ID that performed a version action. The plugin can also store interface preferences in the administrator\'s browser local storage. Media Health and exact-duplicate checks run locally against this WordPress installation and do not require an external API or cloud account.</p><p>Deactivating the plugin does not delete virtual-folder relationships, favourites, protection state or Image Studio version metadata because doing so could destroy Media Library organisation.</p>', 'simme-media-organiser' )
        );
        wp_add_privacy_policy_content( __( 'Simme Media Organiser', 'simme-media-organiser' ), $content );
    }

    public static function can_manage() {
        return current_user_can( 'upload_files' );
    }

    public static function require_capability() {
        if ( ! self::can_manage() ) {
            wp_send_json_error( array( 'message' => __( 'You do not have permission to manage media.', 'simme-media-organiser' ) ), 403 );
        }
    }

    public static function verify_ajax_nonce() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
    }

    public static function get_settings() {
        $defaults = array(
            'items_per_page'       => 48,
            'default_view'         => 'grid',
            'reduce_motion'        => 0,
            'accent'               => 'violet',
            'media_picker_enabled' => 1,
            'trash_retention_days' => 30,
        );
        return wp_parse_args( (array) get_option( 'simme_media_organiser_settings', array() ), $defaults );
    }

    public static function folder_path( $term_id ) {
        $term_id = absint( $term_id );
        if ( ! $term_id ) {
            return '';
        }

        $term = get_term( $term_id, SIMME_MEDIA_ORGANISER_TAXONOMY );
        if ( ! $term || is_wp_error( $term ) ) {
            return '';
        }

        $names = array( $term->name );
        $guard = 0;
        while ( $term->parent && $guard < 100 ) {
            $term = get_term( $term->parent, SIMME_MEDIA_ORGANISER_TAXONOMY );
            if ( ! $term || is_wp_error( $term ) ) {
                break;
            }
            array_unshift( $names, $term->name );
            $guard++;
        }

        return implode( ' / ', $names );
    }

    public static function folder_terms_tree() {
        $terms = get_terms(
            array(
                'taxonomy'   => SIMME_MEDIA_ORGANISER_TAXONOMY,
                'hide_empty' => false,
                'orderby'    => 'name',
                'order'      => 'ASC',
            )
        );

        if ( is_wp_error( $terms ) ) {
            return array();
        }

        /*
         * Do not trust WP_Term::count here. Attachments normally have post_status
         * "inherit", and WordPress' default taxonomy counter can therefore report 0
         * even when media is assigned. Calculate the live direct counts from the
         * relationship table so the sidebar always reflects what the organiser shows.
         */
        global $wpdb;
        $direct_counts = array();
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Live taxonomy counts are required because WP_Term::count can omit inherit-status attachments.
        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT tt.term_id, COUNT(DISTINCT tr.object_id) AS attachment_count
                 FROM %i tr
                 INNER JOIN %i tt
                    ON tt.term_taxonomy_id = tr.term_taxonomy_id
                 INNER JOIN %i p
                    ON p.ID = tr.object_id
                 LEFT JOIN %i smo_trash
                    ON smo_trash.post_id = p.ID AND smo_trash.meta_key = %s
                 WHERE tt.taxonomy = %s
                   AND p.post_type = %s
                   AND p.post_status = %s
                   AND smo_trash.post_id IS NULL
                 GROUP BY tt.term_id",
                $wpdb->term_relationships,
                $wpdb->term_taxonomy,
                $wpdb->posts,
                $wpdb->postmeta,
                '_simme_media_organiser_trash',
                SIMME_MEDIA_ORGANISER_TAXONOMY,
                'attachment',
                'inherit'
            ),
            ARRAY_A
        );

        if ( is_array( $rows ) ) {
            foreach ( $rows as $row ) {
                $direct_counts[ (int) $row['term_id'] ] = (int) $row['attachment_count'];
            }
        }

        $by_parent = array();
        $colours = array();
        $orders = array();
        $lost_property = array();
        foreach ( $terms as $term ) {
            $term_id = (int) $term->term_id;
            $colours[ $term_id ] = (string) get_term_meta( $term_id, '_smo_colour', true );
            $orders[ $term_id ] = (int) get_term_meta( $term_id, '_smo_folder_order', true );
            $lost_property[ $term_id ] = (bool) get_term_meta( $term_id, '_smo_lost_property', true );
            $by_parent[ (int) $term->parent ][] = $term;
        }
        foreach ( $by_parent as $parent_id => &$siblings ) {
            usort( $siblings, static function ( $a, $b ) use ( $orders ) {
                $a_id = (int) $a->term_id;
                $b_id = (int) $b->term_id;
                $a_order = (int) ( $orders[ $a_id ] ?? 0 );
                $b_order = (int) ( $orders[ $b_id ] ?? 0 );
                if ( $a_order && $b_order && $a_order !== $b_order ) {
                    return $a_order <=> $b_order;
                }
                if ( $a_order && ! $b_order ) {
                    return -1;
                }
                if ( ! $a_order && $b_order ) {
                    return 1;
                }
                return strnatcasecmp( $a->name, $b->name );
            } );
        }
        unset( $siblings );

        $walk = static function ( $parent ) use ( &$walk, $by_parent, $direct_counts, $colours, $orders, $lost_property ) {
            $result = array();
            foreach ( $by_parent[ (int) $parent ] ?? array() as $term ) {
                $children = $walk( $term->term_id );
                $descendant_count = 0;
                foreach ( $children as $child ) {
                    $descendant_count += (int) $child['count'];
                }
                $direct_count = (int) ( $direct_counts[ (int) $term->term_id ] ?? 0 );
                $result[] = array(
                    'id'           => (int) $term->term_id,
                    'name'         => $term->name,
                    'direct_count' => $direct_count,
                    'count'        => $direct_count + $descendant_count,
                    'parent'       => (int) $term->parent,
                    'colour'       => $colours[ (int) $term->term_id ] ?? '',
                    'order'        => (int) ( $orders[ (int) $term->term_id ] ?? 0 ),
                    'lost_property'=> ! empty( $lost_property[ (int) $term->term_id ] ),
                    'path'         => Simme_Media_Organiser_Plugin::folder_path( $term->term_id ),
                    'children'     => $children,
                );
            }
            return $result;
        };

        return $walk( 0 );
    }

    public static function ensure_folder_path( $path, $parent_id = 0 ) {
        $path = trim( (string) $path );
        if ( '' === $path ) {
            return absint( $parent_id );
        }

        $parts = preg_split( '#\s*/\s*#', $path );
        $parts = array_values( array_filter( array_map( 'sanitize_text_field', $parts ) ) );
        $current_parent = absint( $parent_id );

        foreach ( $parts as $name ) {
            $existing = term_exists( $name, SIMME_MEDIA_ORGANISER_TAXONOMY, $current_parent );
            if ( $existing ) {
                $current_parent = is_array( $existing ) ? (int) $existing['term_id'] : (int) $existing;
                continue;
            }

            $created = wp_insert_term(
                $name,
                SIMME_MEDIA_ORGANISER_TAXONOMY,
                array( 'parent' => $current_parent )
            );

            if ( is_wp_error( $created ) ) {
                return $created;
            }
            $current_parent = (int) $created['term_id'];
        }

        return $current_parent;
    }

    public static function attachment_folder( $attachment_id ) {
        $terms = wp_get_object_terms(
            absint( $attachment_id ),
            SIMME_MEDIA_ORGANISER_TAXONOMY,
            array( 'orderby' => 'term_id', 'order' => 'ASC' )
        );

        if ( is_wp_error( $terms ) || empty( $terms ) ) {
            return null;
        }

        $term = end( $terms );
        $trail = array();
        $ancestor_ids = array_reverse( get_ancestors( (int) $term->term_id, SIMME_MEDIA_ORGANISER_TAXONOMY, 'taxonomy' ) );
        foreach ( $ancestor_ids as $ancestor_id ) {
            $ancestor = get_term( (int) $ancestor_id, SIMME_MEDIA_ORGANISER_TAXONOMY );
            if ( $ancestor && ! is_wp_error( $ancestor ) ) {
                $trail[] = array(
                    'id'     => (int) $ancestor->term_id,
                    'name'   => $ancestor->name,
                    'colour' => get_term_meta( (int) $ancestor->term_id, '_smo_colour', true ) ?: '',
                );
            }
        }
        $trail[] = array(
            'id'     => (int) $term->term_id,
            'name'   => $term->name,
            'colour' => get_term_meta( $term->term_id, '_smo_colour', true ) ?: '',
        );

        return array(
            'id'     => (int) $term->term_id,
            'name'   => $term->name,
            'path'   => self::folder_path( $term->term_id ),
            'colour' => get_term_meta( $term->term_id, '_smo_colour', true ) ?: '',
            'trail'  => $trail,
        );
    }

    public static function attachment_edit_state( $attachment_id, $metadata = null ) {
        $attachment_id = absint( $attachment_id );
        if ( null === $metadata ) {
            $metadata = wp_get_attachment_metadata( $attachment_id );
        }
        $metadata = is_array( $metadata ) ? $metadata : array();

        $backup = get_post_meta( $attachment_id, '_wp_attachment_backup_sizes', true );
        if ( ! empty( $backup ) ) {
            return array(
                'code'  => 'edited',
                'label' => __( 'Edited in WordPress', 'simme-media-organiser' ),
            );
        }

        if ( ! empty( $metadata['original_image'] ) ) {
            return array(
                'code'  => 'scaled',
                'label' => __( 'Automatically scaled', 'simme-media-organiser' ),
            );
        }

        return array(
            'code'  => 'original',
            'label' => __( 'Original', 'simme-media-organiser' ),
        );
    }

    public static function attachment_storage( $attachment_id, $metadata = null ) {
        $file = get_attached_file( $attachment_id );
        $original = ( $file && file_exists( $file ) ) ? (int) filesize( $file ) : 0;
        $derivatives = 0;

        if ( null === $metadata ) {
            $metadata = wp_get_attachment_metadata( $attachment_id );
        }

        if ( is_array( $metadata ) && ! empty( $metadata['sizes'] ) && is_array( $metadata['sizes'] ) && $file ) {
            $base = trailingslashit( dirname( $file ) );
            foreach ( $metadata['sizes'] as $size ) {
                if ( ! empty( $size['filesize'] ) ) {
                    $derivatives += (int) $size['filesize'];
                } elseif ( ! empty( $size['file'] ) ) {
                    $candidate = $base . wp_basename( $size['file'] );
                    if ( file_exists( $candidate ) ) {
                        $derivatives += (int) filesize( $candidate );
                    }
                }
            }
        }

        return array(
            'original'    => $original,
            'derivatives' => $derivatives,
            'total'       => $original + $derivatives,
        );
    }

    public static function human_bytes( $bytes ) {
        return size_format( max( 0, (int) $bytes ), 1 );
    }

    public static function safe_relative_upload_path( $relative ) {
        // Validate a WordPress uploads-relative path without renaming it. This is
        // deliberately non-destructive because migration packages are expected
        // to preserve the original relative uploads path exactly.
        $relative = wp_normalize_path( (string) $relative );
        $relative = ltrim( $relative, '/' );

        if ( '' === $relative || false !== strpos( $relative, "\0" ) ) {
            return false;
        }
        if ( preg_match( '#^[a-zA-Z][a-zA-Z0-9+.-]*:#', $relative ) ) {
            return false;
        }
        if ( preg_match( '/[\x00-\x1F\x7F]/', $relative ) ) {
            return false;
        }

        $segments = explode( '/', $relative );
        foreach ( $segments as $segment ) {
            if ( '' === $segment || '.' === $segment || '..' === $segment ) {
                return false;
            }
        }

        return implode( '/', $segments );
    }
}
