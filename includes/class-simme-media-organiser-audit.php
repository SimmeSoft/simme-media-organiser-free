<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Local-only Media Health and activity history for Simme Media Organiser Free.
 * No media or scan data is sent to an external service.
 */
class Simme_Media_Organiser_Audit {
    private static $index_cache = array();
    const DB_VERSION = '1.3.0-public';
    const DB_OPTION  = 'simme_media_organiser_audit_db_version';

    public function __construct() {
        self::maybe_install_tables();
        $actions = array(
            'simme_media_organiser_health_summary'    => 'health_summary_ajax',
            'simme_media_organiser_scan_batch'        => 'scan_batch',
            'simme_media_organiser_duplicate_details' => 'duplicate_details_ajax',
            'simme_media_organiser_toggle_protection' => 'toggle_protection',
            'simme_media_organiser_activity'          => 'activity_ajax',
            'simme_media_organiser_history_state'     => 'history_state_ajax',
            'simme_media_organiser_undo_activity'     => 'undo_activity',
            'simme_media_organiser_redo_activity'     => 'redo_activity',
        );
        foreach ( $actions as $action => $method ) {
            add_action( 'wp_ajax_' . $action, array( $this, $method ) );
        }
        add_action( 'add_attachment', array( __CLASS__, 'refresh_index_light' ) );
        add_action( 'edit_attachment', array( __CLASS__, 'refresh_index_light' ) );
        add_action( 'delete_attachment', array( __CLASS__, 'delete_index_row' ) );
        add_filter( 'pre_delete_post', array( __CLASS__, 'prevent_protected_delete' ), 10, 3 );
        add_filter( 'pre_delete_attachment', array( __CLASS__, 'prevent_protected_delete' ), 10, 3 );
        add_action( 'admin_notices', array( __CLASS__, 'protected_delete_notice' ) );
    }

    private function guard() {
        Simme_Media_Organiser_Plugin::require_capability();
    }

    public static function index_table() {
        global $wpdb;
        return $wpdb->prefix . 'simme_media_index';
    }

    public static function activity_table() {
        global $wpdb;
        return $wpdb->prefix . 'simme_media_activity';
    }

    public static function maybe_install_tables() {
        if ( self::DB_VERSION === get_option( self::DB_OPTION, '' ) ) {
            return;
        }
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $charset  = $wpdb->get_charset_collate();
        $index    = self::index_table();
        $activity = self::activity_table();
        $sql_index = "CREATE TABLE {$index} (
            attachment_id BIGINT(20) UNSIGNED NOT NULL,
            mime_type VARCHAR(100) NOT NULL DEFAULT '',
            original_bytes BIGINT(20) UNSIGNED NOT NULL DEFAULT 0,
            derivative_bytes BIGINT(20) UNSIGNED NOT NULL DEFAULT 0,
            studio_bytes BIGINT(20) UNSIGNED NOT NULL DEFAULT 0,
            total_bytes BIGINT(20) UNSIGNED NOT NULL DEFAULT 0,
            width INT(10) UNSIGNED NOT NULL DEFAULT 0,
            height INT(10) UNSIGNED NOT NULL DEFAULT 0,
            has_alt TINYINT(1) NOT NULL DEFAULT 0,
            folder_id BIGINT(20) UNSIGNED NOT NULL DEFAULT 0,
            favourite TINYINT(1) NOT NULL DEFAULT 0,
            protected TINYINT(1) NOT NULL DEFAULT 0,
            load_grade CHAR(1) NOT NULL DEFAULT '',
            sha256 CHAR(64) NOT NULL DEFAULT '',
            broken TINYINT(1) NOT NULL DEFAULT 0,
            scanned_at DATETIME NULL,
            PRIMARY KEY  (attachment_id),
            KEY sha256 (sha256),
            KEY load_grade (load_grade),
            KEY protected (protected),
            KEY broken (broken)
        ) {$charset};";
        $sql_activity = "CREATE TABLE {$activity} (
            id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT(20) UNSIGNED NOT NULL DEFAULT 0,
            action_key VARCHAR(64) NOT NULL DEFAULT '',
            attachment_id BIGINT(20) UNSIGNED NOT NULL DEFAULT 0,
            summary TEXT NOT NULL,
            details LONGTEXT NULL,
            undoable TINYINT(1) NOT NULL DEFAULT 0,
            undone TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL,
            PRIMARY KEY  (id),
            KEY action_key (action_key),
            KEY attachment_id (attachment_id),
            KEY created_at (created_at)
        ) {$charset};";
        dbDelta( $sql_index );
        dbDelta( $sql_activity );
        update_option( self::DB_OPTION, self::DB_VERSION, false );
    }

    public static function prevent_protected_delete( $delete, $post, $force_delete ) {
        unset( $force_delete );
        if ( $delete || ! $post || 'attachment' !== $post->post_type ) {
            return $delete;
        }
        if ( get_post_meta( $post->ID, '_simme_media_organiser_protected', true ) ) {
            $user_id = get_current_user_id();
            if ( $user_id ) {
                set_transient( 'simme_media_organiser_delete_blocked_' . $user_id, array( 'id' => (int) $post->ID, 'title' => sanitize_text_field( get_the_title( $post->ID ) ) ), MINUTE_IN_SECONDS );
            }
            return false;
        }
        return $delete;
    }

    public static function protected_delete_notice() {
        $user_id = get_current_user_id();
        if ( ! $user_id ) {
            return;
        }
        $key = 'simme_media_organiser_delete_blocked_' . $user_id;
        $blocked = get_transient( $key );
        if ( ! is_array( $blocked ) ) {
            return;
        }
        delete_transient( $key );
        $title = ! empty( $blocked['title'] ) ? $blocked['title'] : __( 'that media item', 'simme-media-organiser' );
        /* translators: %s: protected media title. */
        echo '<div class="notice notice-warning is-dismissible"><p>' . wp_kses_post( sprintf( __( '<strong>Simme Media protection blocked deletion.</strong> “%s” is protected. Remove protection in Simme Media before deleting the WordPress attachment.', 'simme-media-organiser' ), esc_html( $title ) ) ) . '</p></div>';
    }

    public static function refresh_index_light( $attachment_id ) {
        $attachment_id = absint( $attachment_id );
        if ( $attachment_id && 'attachment' === get_post_type( $attachment_id ) ) {
            self::scan_attachment( $attachment_id );
        }
    }

    public static function delete_index_row( $attachment_id ) {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Plugin-owned index row; class cache is invalidated immediately below.
        $wpdb->delete( self::index_table(), array( 'attachment_id' => absint( $attachment_id ) ), array( '%d' ) );
        unset( self::$index_cache[ absint( $attachment_id ) ] );
    }

    private static function studio_bytes( $attachment_id ) {
        $versions = get_post_meta( $attachment_id, '_smo_image_versions', true );
        $bytes = 0;
        if ( is_array( $versions ) ) {
            foreach ( $versions as $version ) {
                if ( is_array( $version ) && isset( $version['size_bytes'] ) ) {
                    $bytes += max( 0, (int) $version['size_bytes'] );
                }
            }
        }
        return $bytes;
    }

    public static function load_grade( $bytes ) {
        $bytes = max( 0, (int) $bytes );
        if ( $bytes > 1024 * 1024 ) return 'E';
        if ( $bytes > 650 * 1024 ) return 'D';
        if ( $bytes > 350 * 1024 ) return 'C';
        if ( $bytes > 180 * 1024 ) return 'B';
        return 'A';
    }

    public static function scan_attachment( $attachment_id, $unused = false ) {
        unset( $unused );
        global $wpdb;
        $attachment_id = absint( $attachment_id );
        $post = get_post( $attachment_id );
        if ( ! $post || 'attachment' !== $post->post_type ) return false;
        $file = get_attached_file( $attachment_id );
        $broken = ! $file || ! file_exists( $file ) || ! is_readable( $file );
        $meta = wp_get_attachment_metadata( $attachment_id );
        $meta = is_array( $meta ) ? $meta : array();
        $storage = Simme_Media_Organiser_Plugin::attachment_storage( $attachment_id, $meta );
        $studio_bytes = self::studio_bytes( $attachment_id );
        $folder = Simme_Media_Organiser_Plugin::attachment_folder( $attachment_id );
        $mime = (string) get_post_mime_type( $attachment_id );
        $alt = (string) get_post_meta( $attachment_id, '_wp_attachment_image_alt', true );
        $sha = ( ! $broken && $file && is_readable( $file ) ) ? (string) hash_file( 'sha256', $file ) : '';
        $row = array(
            'attachment_id'    => $attachment_id,
            'mime_type'        => $mime,
            'original_bytes'   => (int) $storage['original'],
            'derivative_bytes' => (int) $storage['derivatives'],
            'studio_bytes'     => $studio_bytes,
            'total_bytes'      => (int) $storage['total'] + $studio_bytes,
            'width'            => isset( $meta['width'] ) ? (int) $meta['width'] : 0,
            'height'           => isset( $meta['height'] ) ? (int) $meta['height'] : 0,
            'has_alt'          => 0 === strpos( $mime, 'image/' ) ? ( '' !== trim( $alt ) ? 1 : 0 ) : 1,
            'folder_id'        => $folder ? (int) $folder['id'] : 0,
            'favourite'        => get_post_meta( $attachment_id, '_smo_favourite', true ) ? 1 : 0,
            'protected'        => get_post_meta( $attachment_id, '_simme_media_organiser_protected', true ) ? 1 : 0,
            'load_grade'       => self::load_grade( (int) $storage['original'] ),
            'sha256'           => $sha,
            'broken'           => $broken ? 1 : 0,
            'scanned_at'       => current_time( 'mysql', true ),
        );
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Plugin-owned local Media Health index; this write is the canonical index refresh.
        $wpdb->replace( self::index_table(), $row, array( '%d','%s','%d','%d','%d','%d','%d','%d','%d','%d','%d','%d','%s','%s','%d','%s' ) );
        self::$index_cache[ $attachment_id ] = $row;
        return $row;
    }

    public static function health_summary() {
        global $wpdb;
        $table      = self::index_table();
        $trash_meta = '_simme_media_organiser_trash';
        $image_like = $wpdb->esc_like( 'image/' ) . '%';
        $video_like = $wpdb->esc_like( 'video/' ) . '%';
        $audio_like = $wpdb->esc_like( 'audio/' ) . '%';

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Live aggregate over WordPress attachments; caching would make Media Health stale.
        $total = (int) $wpdb->get_var(
            $wpdb->prepare(
                'SELECT COUNT(ID) FROM %i WHERE post_type = %s AND post_status = %s AND ID NOT IN (SELECT post_id FROM %i WHERE meta_key = %s)',
                $wpdb->posts,
                'attachment',
                'inherit',
                $wpdb->postmeta,
                $trash_meta
            )
        );

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Live aggregate over plugin-owned index data; caching would make Media Health stale.
        $row = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT COUNT(*) scanned,
                    SUM(CASE WHEN has_alt=0 AND mime_type LIKE %s THEN 1 ELSE 0 END) missing_alt,
                    SUM(CASE WHEN load_grade IN ('D','E') THEN 1 ELSE 0 END) heavy,
                    SUM(CASE WHEN broken=1 THEN 1 ELSE 0 END) broken,
                    SUM(CASE WHEN folder_id=0 THEN 1 ELSE 0 END) unfiled,
                    SUM(CASE WHEN protected=1 THEN 1 ELSE 0 END) protected_count,
                    SUM(CASE WHEN studio_bytes>0 THEN 1 ELSE 0 END) studio_items,
                    COALESCE(SUM(original_bytes),0) original_bytes,
                    COALESCE(SUM(derivative_bytes),0) derivative_bytes,
                    COALESCE(SUM(studio_bytes),0) studio_bytes,
                    COALESCE(SUM(total_bytes),0) total_bytes
                 FROM %i i INNER JOIN %i p ON p.ID=i.attachment_id
                 WHERE p.post_type=%s AND p.post_status=%s AND i.attachment_id NOT IN (SELECT post_id FROM %i WHERE meta_key=%s)",
                $image_like,
                $table,
                $wpdb->posts,
                'attachment',
                'inherit',
                $wpdb->postmeta,
                $trash_meta
            ),
            ARRAY_A
        );
        $row = is_array( $row ) ? $row : array();

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Live duplicate summary over plugin-owned index data.
        $duplicate_groups = (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT COUNT(*) FROM (SELECT sha256 FROM %i WHERE sha256<>'' AND attachment_id NOT IN (SELECT post_id FROM %i WHERE meta_key=%s) GROUP BY sha256 HAVING COUNT(*)>1) d",
                $table,
                $wpdb->postmeta,
                $trash_meta
            )
        );

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Live duplicate summary over plugin-owned index data.
        $duplicate_items = (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT COALESCE(SUM(c),0) FROM (SELECT COUNT(*) c FROM %i WHERE sha256<>'' AND attachment_id NOT IN (SELECT post_id FROM %i WHERE meta_key=%s) GROUP BY sha256 HAVING COUNT(*)>1) d",
                $table,
                $wpdb->postmeta,
                $trash_meta
            )
        );

        $scanned = (int) ( $row['scanned'] ?? 0 );
        $issues  = (int) ( $row['missing_alt'] ?? 0 ) + (int) ( $row['heavy'] ?? 0 ) + (int) ( $row['broken'] ?? 0 ) + (int) ( $row['unfiled'] ?? 0 );
        $score   = $scanned ? max( 0, min( 100, (int) round( 100 - ( 100 * $issues / max( 1, $scanned * 4 ) ) ) ) ) : 0;

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Live storage summary over plugin-owned index data.
        $storage_types = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT CASE WHEN mime_type LIKE %s THEN 'images' WHEN mime_type LIKE %s THEN 'video' WHEN mime_type LIKE %s THEN 'audio' WHEN mime_type=%s THEN 'pdf' ELSE 'other' END media_group,
                        COUNT(*) items,
                        COALESCE(SUM(total_bytes),0) bytes
                 FROM %i
                 WHERE attachment_id NOT IN (SELECT post_id FROM %i WHERE meta_key=%s)
                 GROUP BY media_group ORDER BY bytes DESC",
                $image_like,
                $video_like,
                $audio_like,
                'application/pdf',
                $table,
                $wpdb->postmeta,
                $trash_meta
            ),
            ARRAY_A
        );
        $by_type = array();
        foreach ( (array) $storage_types as $item ) {
            $by_type[] = array(
                'type'  => sanitize_key( $item['media_group'] ?? 'other' ),
                'items' => (int) ( $item['items'] ?? 0 ),
                'bytes' => (int) ( $item['bytes'] ?? 0 ),
                'label' => Simme_Media_Organiser_Plugin::human_bytes( (int) ( $item['bytes'] ?? 0 ) ),
            );
        }

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Live largest-file summary over plugin-owned index data.
        $largest_rows = $wpdb->get_results(
            $wpdb->prepare(
                'SELECT attachment_id,total_bytes,mime_type FROM %i WHERE total_bytes>0 AND attachment_id NOT IN (SELECT post_id FROM %i WHERE meta_key=%s) ORDER BY total_bytes DESC LIMIT 8',
                $table,
                $wpdb->postmeta,
                $trash_meta
            ),
            ARRAY_A
        );
        $largest = array();
        foreach ( (array) $largest_rows as $item ) {
            $id = absint( $item['attachment_id'] ?? 0 );
            if ( ! $id || 'attachment' !== get_post_type( $id ) ) {
                continue;
            }
            $folder = Simme_Media_Organiser_Plugin::attachment_folder( $id );
            $largest[] = array(
                'id'     => $id,
                'title'  => html_entity_decode( get_the_title( $id ), ENT_QUOTES, get_bloginfo( 'charset' ) ),
                'bytes'  => (int) $item['total_bytes'],
                'label'  => Simme_Media_Organiser_Plugin::human_bytes( (int) $item['total_bytes'] ),
                'mime'   => sanitize_text_field( $item['mime_type'] ?? '' ),
                'folder' => $folder ? $folder['path'] : __( 'Unfiled', 'simme-media-organiser' ),
            );
        }

        return array(
            'total'           => $total,
            'scanned'         => $scanned,
            'scanPercent'     => $total ? (int) round( 100 * $scanned / $total ) : 100,
            'score'           => $score,
            'missingAlt'      => (int) ( $row['missing_alt'] ?? 0 ),
            'heavy'           => (int) ( $row['heavy'] ?? 0 ),
            'broken'          => (int) ( $row['broken'] ?? 0 ),
            'unfiled'         => (int) ( $row['unfiled'] ?? 0 ),
            'protected'       => (int) ( $row['protected_count'] ?? 0 ),
            'studioItems'     => (int) ( $row['studio_items'] ?? 0 ),
            'duplicateGroups' => $duplicate_groups,
            'duplicateItems'  => $duplicate_items,
            'storage'         => array(
                'original'         => (int) ( $row['original_bytes'] ?? 0 ),
                'derivatives'      => (int) ( $row['derivative_bytes'] ?? 0 ),
                'studio'           => (int) ( $row['studio_bytes'] ?? 0 ),
                'total'            => (int) ( $row['total_bytes'] ?? 0 ),
                'originalLabel'    => Simme_Media_Organiser_Plugin::human_bytes( (int) ( $row['original_bytes'] ?? 0 ) ),
                'derivativesLabel' => Simme_Media_Organiser_Plugin::human_bytes( (int) ( $row['derivative_bytes'] ?? 0 ) ),
                'studioLabel'      => Simme_Media_Organiser_Plugin::human_bytes( (int) ( $row['studio_bytes'] ?? 0 ) ),
                'totalLabel'       => Simme_Media_Organiser_Plugin::human_bytes( (int) ( $row['total_bytes'] ?? 0 ) ),
                'byType'           => $by_type,
                'largest'          => $largest,
            ),
        );
    }

    public static function ids_for_smart_view( $view ) {
        global $wpdb;
        $table      = self::index_table();
        $trash_meta = '_simme_media_organiser_trash';
        $view       = sanitize_key( $view );

        switch ( $view ) {
            case 'smart-duplicates':
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Smart views query the plugin-owned live index; caching would make the view stale.
                $ids = $wpdb->get_col(
                    $wpdb->prepare(
                        "SELECT attachment_id FROM %i WHERE attachment_id NOT IN (SELECT post_id FROM %i WHERE meta_key=%s) AND sha256 IN (SELECT sha256 FROM %i WHERE sha256<>'' AND attachment_id NOT IN (SELECT post_id FROM %i WHERE meta_key=%s) GROUP BY sha256 HAVING COUNT(*)>1) ORDER BY sha256,attachment_id",
                        $table,
                        $wpdb->postmeta,
                        $trash_meta,
                        $table,
                        $wpdb->postmeta,
                        $trash_meta
                    )
                );
                break;
            case 'smart-heavy':
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Smart views query the plugin-owned live index; caching would make the view stale.
                $ids = $wpdb->get_col( $wpdb->prepare( "SELECT attachment_id FROM %i WHERE load_grade IN ('D','E') AND attachment_id NOT IN (SELECT post_id FROM %i WHERE meta_key=%s) ORDER BY attachment_id DESC", $table, $wpdb->postmeta, $trash_meta ) );
                break;
            case 'smart-protected':
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Smart views query the plugin-owned live index; caching would make the view stale.
                $ids = $wpdb->get_col( $wpdb->prepare( 'SELECT attachment_id FROM %i WHERE protected=1 AND attachment_id NOT IN (SELECT post_id FROM %i WHERE meta_key=%s) ORDER BY attachment_id DESC', $table, $wpdb->postmeta, $trash_meta ) );
                break;
            case 'smart-broken':
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Smart views query the plugin-owned live index; caching would make the view stale.
                $ids = $wpdb->get_col( $wpdb->prepare( 'SELECT attachment_id FROM %i WHERE broken=1 AND attachment_id NOT IN (SELECT post_id FROM %i WHERE meta_key=%s) ORDER BY attachment_id DESC', $table, $wpdb->postmeta, $trash_meta ) );
                break;
            case 'smart-studio':
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Smart views query the plugin-owned live index; caching would make the view stale.
                $ids = $wpdb->get_col( $wpdb->prepare( 'SELECT attachment_id FROM %i WHERE studio_bytes>0 AND attachment_id NOT IN (SELECT post_id FROM %i WHERE meta_key=%s) ORDER BY attachment_id DESC', $table, $wpdb->postmeta, $trash_meta ) );
                break;
            case 'smart-large':
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Smart views query the plugin-owned live index; caching would make the view stale.
                $ids = $wpdb->get_col( $wpdb->prepare( 'SELECT attachment_id FROM %i WHERE original_bytes>1048576 AND attachment_id NOT IN (SELECT post_id FROM %i WHERE meta_key=%s) ORDER BY attachment_id DESC', $table, $wpdb->postmeta, $trash_meta ) );
                break;
            default:
                return array();
        }

        return array_map( 'intval', (array) $ids );
    }

    public static function prime_index_cache( $ids ) {
        global $wpdb;
        $ids     = array_values( array_unique( array_filter( array_map( 'absint', (array) $ids ) ) ) );
        $missing = array_values( array_filter( $ids, static function ( $id ) { return ! array_key_exists( $id, self::$index_cache ); } ) );
        if ( ! $missing ) {
            return;
        }

        $table        = self::index_table();
        $trash_meta   = '_simme_media_organiser_trash';
        $placeholders = implode( ',', array_fill( 0, count( $missing ), '%d' ) );
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $placeholders contains only a generated list of fixed %d tokens matching the sanitised integer ID list below.
        $query = "SELECT i.*, (SELECT COUNT(*) FROM %i d WHERE d.sha256=i.sha256 AND i.sha256<>'' AND d.attachment_id NOT IN (SELECT post_id FROM %i WHERE meta_key=%s)) duplicate_count FROM %i i WHERE i.attachment_id IN ({$placeholders})";
        $args  = array_merge( array( $table, $wpdb->postmeta, $trash_meta, $table ), $missing );
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- $query is fixed SQL plus a generated list of %d placeholders; identifiers and values are supplied separately to prepare().
        $sql   = $wpdb->prepare( $query, $args );
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching,WordPress.DB.PreparedSQL.NotPrepared -- $sql is the result of $wpdb->prepare() immediately above; the only dynamic SQL fragment is a generated list of %d placeholders.
        $rows = $wpdb->get_results( $sql, ARRAY_A );
        foreach ( $missing as $id ) {
            self::$index_cache[ $id ] = array();
        }
        foreach ( (array) $rows as $row ) {
            self::$index_cache[ (int) $row['attachment_id'] ] = $row;
        }
    }

    public static function index_row( $attachment_id ) {
        $attachment_id = absint( $attachment_id );
        self::prime_index_cache( array( $attachment_id ) );
        return self::$index_cache[ $attachment_id ] ?? array();
    }

    public static function log_action( $action_key, $summary, $attachment_id = 0, $details = array(), $undoable = false ) {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Plugin-owned activity table; WordPress has no higher-level API for this data.
        $wpdb->insert( self::activity_table(), array( 'user_id'=>get_current_user_id(), 'action_key'=>sanitize_key( $action_key ), 'attachment_id'=>absint( $attachment_id ), 'summary'=>sanitize_text_field( $summary ), 'details'=>wp_json_encode( $details ), 'undoable'=>$undoable?1:0, 'undone'=>0, 'created_at'=>current_time( 'mysql', true ) ), array( '%d','%s','%d','%s','%s','%d','%d','%s' ) );
        return (int) $wpdb->insert_id;
    }

    private static function reversible_action_keys() {
        return array( 'protection', 'move', 'favourite', 'media_details', 'alt', 'folder_move', 'folder_update', 'custom_order' );
    }
    private static function is_reversible_action_key( $action_key ) { return in_array( (string)$action_key, self::reversible_action_keys(), true ); }

    private static function history_state_for_user( $user_id ) {
        global $wpdb;
        $user_id = absint( $user_id );
        $rows = $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM %i WHERE user_id=%d AND undoable=1 ORDER BY id DESC LIMIT 100', self::activity_table(), $user_id ), ARRAY_A ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Activity history is a small plugin-owned live table.
        $undo = null; $redo = null;
        foreach ( (array)$rows as $row ) {
            if ( ! self::is_reversible_action_key( $row['action_key'] ) ) continue;
            if ( ! $undo && empty( $row['undone'] ) ) $undo = $row;
            if ( ! $redo && ! empty( $row['undone'] ) ) $redo = $row;
            if ( $undo && $redo ) break;
        }
        $normalise = static function ( $row ) {
            if ( ! is_array( $row ) ) return null;
            return array( 'id'=>(int)$row['id'], 'summary'=>(string)$row['summary'], 'action'=>(string)$row['action_key'] );
        };
        return array( 'undo'=>$normalise($undo), 'redo'=>$normalise($redo) );
    }

    public static function recent_activity( $limit = 20 ) {
        global $wpdb;
        $limit = min( 100, max( 1, absint( $limit ) ) );
        $rows = $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM %i ORDER BY id DESC LIMIT %d', self::activity_table(), $limit ), ARRAY_A ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Activity history is a small plugin-owned live table.
        $state = self::history_state_for_user( get_current_user_id() );
        $undo_id = absint( $state['undo']['id'] ?? 0 );
        foreach ( $rows as &$row ) {
            $row['id']=(int)$row['id']; $row['attachment_id']=(int)$row['attachment_id']; $row['undone']=(bool)$row['undone'];
            $row['undoable']=(bool)$row['undoable'] && self::is_reversible_action_key( $row['action_key'] ) && $undo_id===(int)$row['id'];
            $row['details']=json_decode( (string)$row['details'], true ) ?: array();
            $row['when']=human_time_diff( strtotime( $row['created_at'] . ' UTC' ), current_time( 'timestamp', true ) ) . ' ' . __( 'ago', 'simme-media-organiser' );
        }
        unset($row); return $rows;
    }

    public function health_summary_ajax() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $this->guard();
        wp_send_json_success( array( 'summary' => self::health_summary(), 'activity' => self::recent_activity( 12 ) ) );
    }

    public function scan_batch() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $this->guard();
        $offset = max( 0, absint( wp_unslash( $_POST['offset'] ?? 0 ) ) ); $limit = min( 10, max( 1, absint( wp_unslash( $_POST['limit'] ?? 6 ) ) ) );
        $ids=get_posts(array('post_type'=>'attachment','post_status'=>'inherit','posts_per_page'=>$limit,'offset'=>$offset,'fields'=>'ids','orderby'=>'ID','order'=>'ASC','meta_query'=>array(array('key'=>'_simme_media_organiser_trash','compare'=>'NOT EXISTS')))); // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
        foreach((array)$ids as $id) self::scan_attachment($id);
        $summary=self::health_summary();
        wp_send_json_success(array('processed'=>count($ids),'offset'=>$offset+count($ids),'done'=>count($ids)<$limit,'summary'=>$summary));
    }

    public function duplicate_details_ajax() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $this->guard();
        global $wpdb;
        $sha = sanitize_text_field( wp_unslash( $_POST['sha256'] ?? '' ) );
        $id  = absint( wp_unslash( $_POST['id'] ?? 0 ) );
        if(!$sha && $id){$row=self::index_row($id);$sha=(string)($row['sha256']??'');}
        if(!$sha){wp_send_json_error(array('message'=>__('No exact-duplicate fingerprint is available for this item.','simme-media-organiser')),400);}
        $ids = array_map( 'intval', $wpdb->get_col( $wpdb->prepare( 'SELECT attachment_id FROM %i WHERE sha256=%s ORDER BY attachment_id ASC', self::index_table(), $sha ) ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Exact-duplicate details query the plugin-owned live index.
        $items=array(); foreach($ids as $item_id){if('attachment'!==get_post_type($item_id))continue;$items[]=array('id'=>$item_id,'title'=>get_the_title($item_id),'url'=>wp_get_attachment_url($item_id));}
        wp_send_json_success(array('sha256'=>$sha,'items'=>$items));
    }

    public function toggle_protection() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $this->guard();
        $ids = array_values( array_filter( array_map( 'absint', (array) wp_unslash( $_POST['ids'] ?? array() ) ) ) ); $value = ! empty( sanitize_text_field( wp_unslash( $_POST['value'] ?? '' ) ) ); $before = array();
        foreach($ids as $id){if('attachment'!==get_post_type($id)||!current_user_can('edit_post',$id))continue;$before[$id]=(bool)get_post_meta($id,'_simme_media_organiser_protected',true);update_post_meta($id,'_simme_media_organiser_protected',$value?1:0);self::scan_attachment($id);}
        $activity=self::log_action('protection',$value?__('Protected media assets','simme-media-organiser'):__('Removed media protection','simme-media-organiser'),0,array('ids'=>array_keys($before),'before'=>$before,'after'=>$value),true);
        wp_send_json_success(array('protected'=>$value,'activityId'=>$activity,'summary'=>self::health_summary(),'history'=>self::history_state_for_user(get_current_user_id())));
    }

    public function history_state_ajax() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $this->guard();
        wp_send_json_success( array( 'history' => self::history_state_for_user( get_current_user_id() ) ) );
    }

    private static function apply_folder_order_state( $state ) {
        if(!is_array($state))return false; $ok=false;
        foreach($state as $term_id=>$order){$term_id=absint($term_id);if($term_id&&term_exists($term_id,SIMME_MEDIA_ORGANISER_TAXONOMY)){update_term_meta($term_id,'_smo_folder_order',(int)$order);$ok=true;}}
        return $ok;
    }

    private static function apply_activity_state( $row, $direction ) {
        $after='after'===$direction; $details=json_decode((string)$row['details'],true); $details=is_array($details)?$details:array(); $action=(string)$row['action_key']; $ok=false;
        if('protection'===$action){$values=$after?array_fill_keys(array_map('absint',array_keys((array)($details['before']??array()))),empty($details['after'])?0:1):(array)($details['before']??array());foreach($values as $id=>$value){$id=absint($id);if($id&&current_user_can('edit_post',$id)){update_post_meta($id,'_simme_media_organiser_protected',empty($value)?0:1);self::scan_attachment($id);$ok=true;}}}
        elseif('move'===$action){if($after){$folder=absint($details['after_folder']??0);foreach(array_keys((array)($details['before']??array())) as $id){$id=absint($id);if($id&&current_user_can('edit_post',$id)){wp_set_object_terms($id,$folder?array($folder):array(),SIMME_MEDIA_ORGANISER_TAXONOMY,false);self::scan_attachment($id);$ok=true;}}}else{foreach((array)($details['before']??array()) as $id=>$terms){$id=absint($id);if($id&&current_user_can('edit_post',$id)){wp_set_object_terms($id,array_map('absint',(array)$terms),SIMME_MEDIA_ORGANISER_TAXONOMY,false);self::scan_attachment($id);$ok=true;}}}}
        elseif('favourite'===$action){$values=$after?array_fill_keys(array_map('absint',array_keys((array)($details['before']??array()))),empty($details['after'])?0:1):(array)($details['before']??array());foreach($values as $id=>$value){$id=absint($id);if($id&&current_user_can('edit_post',$id)){update_post_meta($id,'_smo_favourite',empty($value)?0:1);self::scan_attachment($id);$ok=true;}}}
        elseif('alt'===$action&&!empty($row['attachment_id'])){$id=(int)$row['attachment_id'];if(current_user_can('edit_post',$id)){update_post_meta($id,'_wp_attachment_image_alt',sanitize_text_field($after?($details['after']??''):($details['before']??'')));self::scan_attachment($id);$ok=true;}}
        elseif('media_details'===$action&&!empty($row['attachment_id'])){$id=(int)$row['attachment_id'];$state=is_array($details[$after?'after':'before']??null)?$details[$after?'after':'before']:array();if(current_user_can('edit_post',$id)){$r=wp_update_post(array('ID'=>$id,'post_title'=>sanitize_text_field($state['title']??''),'post_excerpt'=>sanitize_textarea_field($state['caption']??''),'post_content'=>sanitize_textarea_field($state['description']??'')),true);if(!is_wp_error($r)){update_post_meta($id,'_wp_attachment_image_alt',sanitize_text_field($state['alt']??''));$terms=$after?(absint($state['folder_id']??0)?array(absint($state['folder_id'])):array()):array_map('absint',(array)($state['terms']??array()));wp_set_object_terms($id,$terms,SIMME_MEDIA_ORGANISER_TAXONOMY,false);self::scan_attachment($id);$ok=true;}}}
        elseif('folder_move'===$action){$folder=absint($details['folder_id']??0);$parent=absint($after?($details['to_parent']??0):($details['from_parent']??0));$term=$folder?get_term($folder,SIMME_MEDIA_ORGANISER_TAXONOMY):null;if($term&&!is_wp_error($term)&&(!$parent||($parent!==$folder&&!term_is_ancestor_of($folder,$parent,SIMME_MEDIA_ORGANISER_TAXONOMY)))){$r=wp_update_term($folder,SIMME_MEDIA_ORGANISER_TAXONOMY,array('parent'=>$parent));if(!is_wp_error($r)){self::apply_folder_order_state($details[$after?'after_order':'before_order']??array());$ok=true;}}}
        elseif('folder_update'===$action){$folder=absint($details['folder_id']??0);$state=is_array($details[$after?'after':'before']??null)?$details[$after?'after':'before']:array();$term=$folder?get_term($folder,SIMME_MEDIA_ORGANISER_TAXONOMY):null;$parent=absint($state['parent']??0);if($term&&!is_wp_error($term)&&(!$parent||($parent!==$folder&&!term_is_ancestor_of($folder,$parent,SIMME_MEDIA_ORGANISER_TAXONOMY)))){$r=wp_update_term($folder,SIMME_MEDIA_ORGANISER_TAXONOMY,array('name'=>sanitize_text_field($state['name']??$term->name),'parent'=>$parent));if(!is_wp_error($r)){$colour=sanitize_hex_color($state['colour']??'');if($colour)update_term_meta($folder,'_smo_colour',$colour);else delete_term_meta($folder,'_smo_colour');if(isset($state['order']))update_term_meta($folder,'_smo_folder_order',(int)$state['order']);$ok=true;}}}
        elseif('custom_order'===$action){$key=sanitize_key($details['order_key']??'');$user=absint($row['user_id']??0);$state=array_values(array_filter(array_map('absint',(array)($details[$after?'after':'before']??array()))));if($key&&$user===get_current_user_id()){$orders=get_user_meta($user,'_smo_media_custom_orders',true);$orders=is_array($orders)?$orders:array();if($state)$orders[$key]=$state;else unset($orders[$key]);if($orders)update_user_meta($user,'_smo_media_custom_orders',$orders);else delete_user_meta($user,'_smo_media_custom_orders');$ok=true;}}
        return $ok;
    }

    public function activity_ajax() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $this->guard();
        $limit = absint( wp_unslash( $_POST['limit'] ?? 30 ) );
        wp_send_json_success( array( 'activity' => self::recent_activity( $limit ) ) );
    }

    public function undo_activity(){
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $this->guard(); global $wpdb; $id = absint( wp_unslash( $_POST['id'] ?? 0 ) ); $row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM %i WHERE id=%d', self::activity_table(), $id ), ARRAY_A ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Activity history is a small plugin-owned live table.
        if(!$row||(int)$row['user_id']!==get_current_user_id()||empty($row['undoable'])||!empty($row['undone'])||!self::is_reversible_action_key($row['action_key']))wp_send_json_error(array('message'=>__('That action cannot be undone.','simme-media-organiser')),400);
        $state=self::history_state_for_user(get_current_user_id());if(empty($state['undo']['id'])||(int)$state['undo']['id']!==$id)wp_send_json_error(array('message'=>__('Undo the most recent reversible action first.','simme-media-organiser')),409);
        if(!self::apply_activity_state($row,'before'))wp_send_json_error(array('message'=>__('Simme could not safely undo that action.','simme-media-organiser')),400);
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Plugin-owned activity table state transition; this is a write and the live history state must change immediately.
        $wpdb->update( self::activity_table(), array( 'undone' => 1 ), array( 'id' => $id ), array( '%d' ), array( '%d' ) );
        /* translators: %s: summary of the action that was undone. */
        self::log_action( 'undo', sprintf( __( 'Undid: %s', 'simme-media-organiser' ), $row['summary'] ), (int) $row['attachment_id'], array( 'activity_id' => $id ), false );
        /* translators: %s: summary of the action that was undone. */
        $message = sprintf( __( 'Undid: %s', 'simme-media-organiser' ), $row['summary'] );
        wp_send_json_success( array( 'message' => $message, 'history' => self::history_state_for_user( get_current_user_id() ), 'summary' => self::health_summary() ) );
    }

    public function redo_activity(){
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $this->guard(); global $wpdb; $id = absint( wp_unslash( $_POST['id'] ?? 0 ) ); $row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM %i WHERE id=%d', self::activity_table(), $id ), ARRAY_A ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Activity history is a small plugin-owned live table.
        if(!$row||(int)$row['user_id']!==get_current_user_id()||empty($row['undoable'])||empty($row['undone'])||!self::is_reversible_action_key($row['action_key']))wp_send_json_error(array('message'=>__('That action cannot be redone.','simme-media-organiser')),400);
        $state=self::history_state_for_user(get_current_user_id());if(empty($state['redo']['id'])||(int)$state['redo']['id']!==$id)wp_send_json_error(array('message'=>__('That redo is no longer available because a newer action changed the history.','simme-media-organiser')),409);
        if(!self::apply_activity_state($row,'after'))wp_send_json_error(array('message'=>__('Simme could not safely redo that action.','simme-media-organiser')),400);
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Plugin-owned activity table state transition; this is a write and the live history state must change immediately.
        $wpdb->update( self::activity_table(), array( 'undone' => 0 ), array( 'id' => $id ), array( '%d' ), array( '%d' ) );
        /* translators: %s: summary of the action that was redone. */
        self::log_action( 'redo', sprintf( __( 'Redid: %s', 'simme-media-organiser' ), $row['summary'] ), (int) $row['attachment_id'], array( 'activity_id' => $id ), false );
        /* translators: %s: summary of the action that was redone. */
        $message = sprintf( __( 'Redid: %s', 'simme-media-organiser' ), $row['summary'] );
        wp_send_json_success( array( 'message' => $message, 'history' => self::history_state_for_user( get_current_user_id() ), 'summary' => self::health_summary() ) );
    }
}
