<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Recoverable holding Trash for Simme Media Organiser.
 *
 * Important: moving media here never deletes or moves the physical upload.
 * The original WordPress attachment, attachment ID, URL, folder assignments,
 * favourites and Image Studio metadata remain intact until an explicit purge.
 */
class Simme_Media_Organiser_Trash {
    const META_KEY = '_simme_media_organiser_trash';

    public function __construct() {
        add_action( 'wp_ajax_simme_media_organiser_trash_media', array( $this, 'trash_media' ) );
        add_action( 'wp_ajax_simme_media_organiser_restore_media', array( $this, 'restore_media' ) );
        add_action( 'wp_ajax_simme_media_organiser_purge_media', array( $this, 'purge_media' ) );
        add_action( 'wp_ajax_simme_media_organiser_set_purge_timer', array( $this, 'set_purge_timer' ) );
        add_action( 'wp_ajax_simme_media_organiser_purge_ready_trash', array( $this, 'purge_ready_trash' ) );
    }

    private function guard() {
        Simme_Media_Organiser_Plugin::require_capability();
    }

    public static function retention_days() {
        $settings = Simme_Media_Organiser_Plugin::get_settings();
        $allowed = array( 1, 7, 14, 30, 60, 90 );
        $days = absint( $settings['trash_retention_days'] ?? 30 );
        return in_array( $days, $allowed, true ) ? $days : 30;
    }

    public static function trash_data( $attachment_id ) {
        $data = get_post_meta( absint( $attachment_id ), self::META_KEY, true );
        return is_array( $data ) && ! empty( $data['trashed_at'] ) ? $data : array();
    }

    public static function is_trashed( $attachment_id ) {
        return ! empty( self::trash_data( $attachment_id ) );
    }

    public static function trash_count() {
        $query = new WP_Query(
            array(
                'post_type'      => 'attachment',
                'post_status'    => 'inherit',
                'posts_per_page' => 1,
                'fields'         => 'ids',
                'meta_query'     => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
                    array(
                        'key'     => self::META_KEY,
                        'compare' => 'EXISTS',
                    ),
                ),
                'no_found_rows'  => false,
            )
        );
        return (int) $query->found_posts;
    }


    private static function remaining_label( $seconds ) {
        $seconds = max( 0, absint( $seconds ) );
        if ( 0 === $seconds ) {
            return __( 'Ready now', 'simme-media-organiser' );
        }
        if ( $seconds < HOUR_IN_SECONDS ) {
            $minutes = max( 1, (int) ceil( $seconds / MINUTE_IN_SECONDS ) );
            /* translators: %d: number of minutes remaining before purge is unlocked. */
            return sprintf( _n( '%d minute remaining', '%d minutes remaining', $minutes, 'simme-media-organiser' ), $minutes );
        }
        if ( $seconds < DAY_IN_SECONDS ) {
            $hours = max( 1, (int) ceil( $seconds / HOUR_IN_SECONDS ) );
            /* translators: %d: number of hours remaining before purge is unlocked. */
            return sprintf( _n( '%d hour remaining', '%d hours remaining', $hours, 'simme-media-organiser' ), $hours );
        }
        $days = max( 1, (int) ceil( $seconds / DAY_IN_SECONDS ) );
        /* translators: %d: number of days remaining before purge is unlocked. */
        return sprintf( _n( '%d day remaining', '%d days remaining', $days, 'simme-media-organiser' ), $days );
    }

    public static function item_state( $attachment_id ) {
        $data = self::trash_data( $attachment_id );
        if ( ! $data ) {
            return array(
                'trashed'            => false,
                'trashReady'         => false,
                'trashDaysRemaining' => 0,
            );
        }

        $trashed_at = absint( $data['trashed_at'] ?? 0 );
        $days = self::retention_days();
        $default_ready_at = $trashed_at + ( $days * DAY_IN_SECONDS );
        $override_ready_at = absint( $data['purge_override_at'] ?? 0 );
        $ready_at = $override_ready_at ?: $default_ready_at;
        $remaining = max( 0, $ready_at - time() );
        $days_remaining = $remaining ? (int) ceil( $remaining / DAY_IN_SECONDS ) : 0;
        $remaining_label = self::remaining_label( $remaining );

        return array(
            'trashed'              => true,
            'trashedAt'            => $trashed_at ? gmdate( 'c', $trashed_at ) : '',
            'trashedLabel'         => $trashed_at ? wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), $trashed_at ) : '',
            'trashReadyAt'         => gmdate( 'c', $ready_at ),
            'trashReadyLabel'      => wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), $ready_at ),
            'trashReady'           => time() >= $ready_at,
            'trashDaysRemaining'   => $days_remaining,
            'trashRemainingLabel'  => $remaining_label,
            'trashRetentionDays'   => $days,
            'trashTimerOverridden' => (bool) $override_ready_at,
            'trashDefaultReadyAt'  => gmdate( 'c', $default_ready_at ),
            'trashDefaultReadyLabel' => wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), $default_ready_at ),
            'trashTimerSetBy'      => absint( $data['purge_override_by'] ?? 0 ),
            'trashTimerSetAt'      => ! empty( $data['purge_override_set_at'] ) ? gmdate( 'c', absint( $data['purge_override_set_at'] ) ) : '',
            'trashedBy'            => absint( $data['trashed_by'] ?? 0 ),
        );
    }

    private static function attachment_snapshot( $attachment_id ) {
        $terms = wp_get_object_terms( $attachment_id, SIMME_MEDIA_ORGANISER_TAXONOMY, array( 'fields' => 'ids' ) );
        if ( is_wp_error( $terms ) ) {
            $terms = array();
        }
        return array(
            'trashed_at'  => time(),
            'trashed_by'  => get_current_user_id(),
            'folders'     => array_map( 'absint', (array) $terms ),
            'favourite'   => get_post_meta( $attachment_id, '_smo_favourite', true ) ? 1 : 0,
        );
    }

    public function trash_media() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $this->guard();
        $ids = array_values( array_unique( array_filter( array_map( 'absint', (array) wp_unslash( $_POST['ids'] ?? array() ) ) ) ) );
        if ( ! $ids ) {
            wp_send_json_error( array( 'message' => __( 'No media items were selected.', 'simme-media-organiser' ) ), 400 );
        }

        $changed = array();
        $blocked_protected = array();
        $blocked_permission = array();
        foreach ( $ids as $id ) {
            if ( 'attachment' !== get_post_type( $id ) ) {
                continue;
            }
            if ( ! current_user_can( 'delete_post', $id ) ) {
                $blocked_permission[] = $id;
                continue;
            }
            if ( get_post_meta( $id, '_simme_media_organiser_protected', true ) ) {
                $blocked_protected[] = $id;
                continue;
            }
            if ( self::is_trashed( $id ) ) {
                continue;
            }
            update_post_meta( $id, self::META_KEY, self::attachment_snapshot( $id ) );
            $changed[] = $id;
        }

        if ( class_exists( 'Simme_Media_Organiser_Audit' ) && $changed ) {
            Simme_Media_Organiser_Audit::log_action(
                'trash_hold',
                __( 'Moved media to Simme Trash', 'simme-media-organiser' ),
                0,
                array( 'ids' => $changed ),
                false
            );
        }

        wp_send_json_success(
            array(
                'changed'           => count( $changed ),
                'ids'               => $changed,
                'blockedProtected'  => count( $blocked_protected ),
                'blockedPermission' => count( $blocked_permission ),
                'trashCount'        => self::trash_count(),
                'retentionDays'     => self::retention_days(),
            )
        );
    }

    public function restore_media() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $this->guard();
        $ids = array_values( array_unique( array_filter( array_map( 'absint', (array) wp_unslash( $_POST['ids'] ?? array() ) ) ) ) );
        if ( ! $ids ) {
            wp_send_json_error( array( 'message' => __( 'No media items were selected.', 'simme-media-organiser' ) ), 400 );
        }

        $changed = array();
        foreach ( $ids as $id ) {
            if ( 'attachment' !== get_post_type( $id ) || ! current_user_can( 'edit_post', $id ) || ! self::is_trashed( $id ) ) {
                continue;
            }
            delete_post_meta( $id, self::META_KEY );
            $changed[] = $id;
        }

        if ( class_exists( 'Simme_Media_Organiser_Audit' ) && $changed ) {
            Simme_Media_Organiser_Audit::log_action(
                'trash_restore',
                __( 'Restored media from Simme Trash', 'simme-media-organiser' ),
                0,
                array( 'ids' => $changed ),
                false
            );
        }

        wp_send_json_success(
            array(
                'changed'    => count( $changed ),
                'ids'        => $changed,
                'trashCount' => self::trash_count(),
            )
        );
    }

    public function set_purge_timer() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $this->guard();
        $ids = array_values( array_unique( array_filter( array_map( 'absint', (array) wp_unslash( $_POST['ids'] ?? array() ) ) ) ) );
        if ( ! $ids ) {
            wp_send_json_error( array( 'message' => __( 'No Trash items were selected.', 'simme-media-organiser' ) ), 400 );
        }

        $reset = ! empty( sanitize_text_field( wp_unslash( $_POST['reset'] ?? '' ) ) );
        $amount = isset( $_POST['amount'] ) ? max( 0, (float) sanitize_text_field( wp_unslash( $_POST['amount'] ) ) ) : 0;
        $unit = sanitize_key( wp_unslash( $_POST['unit'] ?? 'hours' ) );
        $multipliers = array(
            'minutes' => MINUTE_IN_SECONDS,
            'hours'   => HOUR_IN_SECONDS,
            'days'    => DAY_IN_SECONDS,
        );
        if ( ! $reset && ! isset( $multipliers[ $unit ] ) ) {
            wp_send_json_error( array( 'message' => __( 'Choose minutes, hours or days for the purge unlock timer.', 'simme-media-organiser' ) ), 400 );
        }

        $seconds = $reset ? 0 : (int) round( $amount * $multipliers[ $unit ] );
        $max_seconds = 365 * DAY_IN_SECONDS;
        if ( ! $reset && $seconds > $max_seconds ) {
            wp_send_json_error( array( 'message' => __( 'The custom purge unlock timer cannot be longer than 365 days.', 'simme-media-organiser' ) ), 400 );
        }

        $changed = array();
        $blocked_protected = array();
        $blocked_permission = array();
        $ready_at = time() + max( 0, $seconds );
        foreach ( $ids as $id ) {
            if ( 'attachment' !== get_post_type( $id ) || ! self::is_trashed( $id ) ) {
                continue;
            }
            if ( ! current_user_can( 'delete_post', $id ) ) {
                $blocked_permission[] = $id;
                continue;
            }
            if ( get_post_meta( $id, '_simme_media_organiser_protected', true ) ) {
                $blocked_protected[] = $id;
                continue;
            }

            $data = self::trash_data( $id );
            if ( $reset ) {
                unset( $data['purge_override_at'], $data['purge_override_by'], $data['purge_override_set_at'] );
            } else {
                $data['purge_override_at'] = $ready_at;
                $data['purge_override_by'] = get_current_user_id();
                $data['purge_override_set_at'] = time();
            }
            update_post_meta( $id, self::META_KEY, $data );
            $changed[] = $id;
        }

        if ( class_exists( 'Simme_Media_Organiser_Audit' ) && $changed ) {
            Simme_Media_Organiser_Audit::log_action(
                $reset ? 'trash_timer_reset' : 'trash_timer_override',
                $reset ? __( 'Reset Trash purge timer to the normal protection period', 'simme-media-organiser' ) : __( 'Set a custom Trash purge unlock timer', 'simme-media-organiser' ),
                0,
                array(
                    'ids'      => $changed,
                    'amount'   => $reset ? null : $amount,
                    'unit'     => $reset ? null : $unit,
                    'ready_at' => $reset ? null : $ready_at,
                ),
                false
            );
        }

        wp_send_json_success(
            array(
                'changed'           => count( $changed ),
                'ids'               => $changed,
                'reset'             => $reset,
                'readyAt'           => $reset ? '' : gmdate( 'c', $ready_at ),
                'readyLabel'        => $reset ? '' : wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), $ready_at ),
                'blockedProtected'  => count( $blocked_protected ),
                'blockedPermission' => count( $blocked_permission ),
            )
        );
    }

    private static function purge_preflight( $ids ) {
        $ready = array();
        $not_ready = array();
        $protected = array();
        $permission = array();

        foreach ( $ids as $id ) {
            $id = absint( $id );
            if ( ! $id || 'attachment' !== get_post_type( $id ) || ! self::is_trashed( $id ) ) {
                continue;
            }
            if ( ! current_user_can( 'delete_post', $id ) ) {
                $permission[] = $id;
                continue;
            }
            if ( get_post_meta( $id, '_simme_media_organiser_protected', true ) ) {
                $protected[] = $id;
                continue;
            }
            $state = self::item_state( $id );
            if ( empty( $state['trashReady'] ) ) {
                $not_ready[ $id ] = $state['trashReadyLabel'] ?? '';
                continue;
            }
            $ready[] = $id;
        }

        return array( $ready, $not_ready, $protected, $permission );
    }

    private static function delete_path_and_sizes( $relative_path, $metadata = array(), &$deleted = array() ) {
        $relative_path = Simme_Media_Organiser_Plugin::safe_relative_upload_path( $relative_path );
        if ( ! $relative_path ) {
            return;
        }
        $upload = wp_get_upload_dir();
        if ( empty( $upload['basedir'] ) ) {
            return;
        }
        $base = wp_normalize_path( trailingslashit( $upload['basedir'] ) );
        $path = wp_normalize_path( $base . ltrim( $relative_path, '/' ) );
        if ( 0 !== strpos( $path, $base ) ) {
            return;
        }

        $paths = array( $path );
        if ( is_array( $metadata ) && ! empty( $metadata['sizes'] ) && is_array( $metadata['sizes'] ) ) {
            foreach ( $metadata['sizes'] as $size ) {
                if ( empty( $size['file'] ) ) {
                    continue;
                }
                $paths[] = wp_normalize_path( trailingslashit( dirname( $path ) ) . wp_basename( $size['file'] ) );
            }
        }
        foreach ( array_unique( $paths ) as $candidate ) {
            if ( isset( $deleted[ $candidate ] ) ) {
                continue;
            }
            $deleted[ $candidate ] = true;
            if ( file_exists( $candidate ) ) {
                wp_delete_file( $candidate );
            }
        }
    }

    /**
     * Capture Image Studio files that WordPress core does not know about.
     *
     * We collect these paths before wp_delete_attachment() removes the post
     * metadata, but do not delete them until WordPress confirms that the main
     * attachment deletion actually succeeded. This prevents a third-party
     * deletion veto from leaving an attachment alive after its Studio files
     * have already been removed.
     */
    private static function studio_cleanup_targets( $attachment_id ) {
        $targets = array();
        $current_relative = Simme_Media_Organiser_Plugin::safe_relative_upload_path( get_post_meta( $attachment_id, '_wp_attached_file', true ) );

        $add_target = static function ( $relative_path, $metadata = array() ) use ( &$targets, $current_relative ) {
            $relative = Simme_Media_Organiser_Plugin::safe_relative_upload_path( $relative_path );
            if ( ! $relative || $relative === $current_relative || isset( $targets[ $relative ] ) ) {
                return;
            }
            $targets[ $relative ] = is_array( $metadata ) ? $metadata : array();
        };

        $versions = get_post_meta( $attachment_id, '_smo_image_versions', true );
        foreach ( (array) $versions as $version ) {
            if ( is_array( $version ) && ! empty( $version['relative_path'] ) ) {
                $add_target( $version['relative_path'], is_array( $version['wp_metadata'] ?? null ) ? $version['wp_metadata'] : array() );
            }
        }

        $master = get_post_meta( $attachment_id, '_smo_image_master', true );
        if ( is_array( $master ) && ! empty( $master['relative_path'] ) ) {
            $add_target( $master['relative_path'], is_array( $master['wp_metadata'] ?? null ) ? $master['wp_metadata'] : array() );
        }

        return $targets;
    }

    private static function cleanup_studio_targets( $targets ) {
        $deleted = array();
        foreach ( (array) $targets as $relative => $metadata ) {
            self::delete_path_and_sizes( $relative, is_array( $metadata ) ? $metadata : array(), $deleted );
        }
    }

    private static function purge_ids( $ids ) {
        $purged = array();
        foreach ( $ids as $id ) {
            $studio_targets = self::studio_cleanup_targets( $id );
            $deleted = wp_delete_attachment( $id, true );
            if ( $deleted ) {
                self::cleanup_studio_targets( $studio_targets );
                $purged[] = $id;
            }
        }
        return $purged;
    }

    public function purge_media() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $this->guard();
        $ids = array_values( array_unique( array_filter( array_map( 'absint', (array) wp_unslash( $_POST['ids'] ?? array() ) ) ) ) );
        if ( ! $ids ) {
            wp_send_json_error( array( 'message' => __( 'No trashed media items were selected.', 'simme-media-organiser' ) ), 400 );
        }

        list( $ready, $not_ready, $protected, $permission ) = self::purge_preflight( $ids );
        if ( $not_ready ) {
            $first_ready = reset( $not_ready );
            wp_send_json_error(
                /* translators: %s: date/time when the first blocked Trash item becomes purgeable. */
                array( 'message' => sprintf( __( 'Permanent purge is still locked by the Trash purge timer. The first blocked item becomes purgeable on %s.', 'simme-media-organiser' ), $first_ready ) ),
                409
            );
        }
        if ( $protected ) {
            wp_send_json_error( array( 'message' => __( 'One or more selected items are protected. Remove protection before permanently purging them.', 'simme-media-organiser' ) ), 409 );
        }
        if ( $permission || count( $ready ) !== count( $ids ) ) {
            wp_send_json_error( array( 'message' => __( 'One or more selected items cannot be permanently deleted by the current WordPress user.', 'simme-media-organiser' ) ), 403 );
        }

        $purged = self::purge_ids( $ready );
        if ( class_exists( 'Simme_Media_Organiser_Audit' ) && $purged ) {
            Simme_Media_Organiser_Audit::log_action( 'trash_purge', __( 'Permanently purged media from Simme Trash', 'simme-media-organiser' ), 0, array( 'ids' => $purged ), false );
        }

        wp_send_json_success(
            array(
                'purged'     => count( $purged ),
                'ids'        => $purged,
                'trashCount' => self::trash_count(),
            )
        );
    }

    public function purge_ready_trash() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $this->guard();
        $ids = get_posts(
            array(
                'post_type'      => 'attachment',
                'post_status'    => 'inherit',
                'posts_per_page' => 500,
                'fields'         => 'ids',
                'orderby'        => 'ID',
                'order'          => 'ASC',
                'meta_query'     => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
                    array( 'key' => self::META_KEY, 'compare' => 'EXISTS' ),
                ),
            )
        );
        list( $ready ) = self::purge_preflight( $ids );
        if ( ! $ready ) {
            wp_send_json_success( array( 'purged' => 0, 'trashCount' => self::trash_count(), 'message' => __( 'No Trash items are ready to purge yet.', 'simme-media-organiser' ) ) );
        }
        $purged = self::purge_ids( $ready );
        if ( class_exists( 'Simme_Media_Organiser_Audit' ) && $purged ) {
            Simme_Media_Organiser_Audit::log_action( 'trash_purge_ready', __( 'Permanently purged ready media from Simme Trash', 'simme-media-organiser' ), 0, array( 'ids' => $purged ), false );
        }
        wp_send_json_success(
            array(
                'purged'     => count( $purged ),
                'trashCount' => self::trash_count(),
                'limited'    => count( $ids ) >= 500,
            )
        );
    }
}
