<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Simme Image Studio.
 *
 * All normal Studio edits are non-destructive. The original WordPress file is
 * captured as a protected master the first time Studio is opened, and new
 * versions are written into a separate uploads subdirectory.
 */
class Simme_Media_Organiser_Image_Studio {
    const MASTER_META    = '_smo_image_master';
    const VERSIONS_META  = '_smo_image_versions';
    const PREFERRED_META = '_smo_preferred_version';
    const ACTIVE_META    = '_smo_active_version';
    const HISTORY_META        = '_smo_image_history';
    const STATE_HISTORY_META  = '_smo_image_state_history';

    public function __construct() {
        add_action( 'wp_ajax_simme_media_organiser_studio_get', array( $this, 'get' ) );
        add_action( 'wp_ajax_simme_media_organiser_studio_estimate', array( $this, 'estimate' ) );
        add_action( 'wp_ajax_simme_media_organiser_studio_create_version', array( $this, 'create_version' ) );
        add_action( 'wp_ajax_simme_media_organiser_studio_recover_social_crop', array( $this, 'recover_social_crop' ) );
        add_action( 'wp_ajax_simme_media_organiser_studio_set_preferred', array( $this, 'set_preferred' ) );
        add_action( 'wp_ajax_simme_media_organiser_studio_publish_version', array( $this, 'publish_version' ) );
        add_action( 'wp_ajax_simme_media_organiser_studio_restore_master', array( $this, 'restore_master' ) );
        add_action( 'wp_ajax_simme_media_organiser_studio_undo_state', array( $this, 'undo_state' ) );
        add_action( 'wp_ajax_simme_media_organiser_studio_redo_state', array( $this, 'redo_state' ) );
        add_action( 'wp_ajax_simme_media_organiser_studio_delete_version', array( $this, 'delete_version' ) );
    }





    private function guard( $attachment_id ) {
        Simme_Media_Organiser_Plugin::require_capability();

        $attachment_id = absint( $attachment_id );
        if ( ! $attachment_id || 'attachment' !== get_post_type( $attachment_id ) || ! wp_attachment_is_image( $attachment_id ) ) {
            wp_send_json_error( array( 'message' => __( 'Image Studio can only edit WordPress image attachments.', 'simme-media-organiser' ) ), 400 );
        }
        if ( ! current_user_can( 'edit_post', $attachment_id ) ) {
            wp_send_json_error( array( 'message' => __( 'You do not have permission to edit this image.', 'simme-media-organiser' ) ), 403 );
        }
        return $attachment_id;
    }

    private function uploads() {
        $upload = wp_upload_dir();
        if ( ! empty( $upload['error'] ) ) {
            return new WP_Error( 'upload_dir', $upload['error'] );
        }
        return $upload;
    }

    private function absolute_from_relative( $relative ) {
        $relative = Simme_Media_Organiser_Plugin::safe_relative_upload_path( $relative );
        if ( ! $relative ) {
            return '';
        }
        $upload = $this->uploads();
        if ( is_wp_error( $upload ) ) {
            return '';
        }
        $path = wp_normalize_path( trailingslashit( $upload['basedir'] ) . $relative );
        $base = trailingslashit( wp_normalize_path( $upload['basedir'] ) );
        return 0 === strpos( $path, $base ) ? $path : '';
    }

    private function url_from_relative( $relative ) {
        $relative = Simme_Media_Organiser_Plugin::safe_relative_upload_path( $relative );
        if ( ! $relative ) {
            return '';
        }
        $upload = $this->uploads();
        if ( is_wp_error( $upload ) ) {
            return '';
        }
        return trailingslashit( $upload['baseurl'] ) . str_replace( '%2F', '/', rawurlencode( $relative ) );
    }

    private function capture_master( $attachment_id ) {
        $master = get_post_meta( $attachment_id, self::MASTER_META, true );
        if ( is_array( $master ) && ! empty( $master['relative_path'] ) ) {
            $path = $this->absolute_from_relative( $master['relative_path'] );
            if ( $path && file_exists( $path ) ) {
                return $master;
            }
        }

        $current_relative = Simme_Media_Organiser_Plugin::safe_relative_upload_path( get_post_meta( $attachment_id, '_wp_attached_file', true ) );
        $current_file = $current_relative ? $this->absolute_from_relative( $current_relative ) : '';
        if ( ! $current_relative || ! $current_file || ! file_exists( $current_file ) || ! is_readable( $current_file ) ) {
            return new WP_Error( 'master_missing', __( 'The current source image could not be found, so Image Studio cannot create a protected master.', 'simme-media-organiser' ) );
        }

        $metadata = wp_get_attachment_metadata( $attachment_id );
        $metadata = is_array( $metadata ) ? $metadata : array();
        $backup_sizes = get_post_meta( $attachment_id, '_wp_attachment_backup_sizes', true );
        $backup_sizes = is_array( $backup_sizes ) ? $backup_sizes : array();

        // If WordPress edited/scaled the image before Image Studio was installed,
        // prefer WordPress' own retained original where it can be identified
        // safely. This means existing edited attachments can often still gain a
        // true pre-edit protected master rather than merely capturing the current
        // edited derivative.
        $relative = $current_relative;
        $file = $current_file;
        $master_origin = 'current_attachment';
        $current_dir_relative = dirname( $current_relative );
        if ( '.' === $current_dir_relative ) {
            $current_dir_relative = '';
        }

        if ( ! empty( $backup_sizes['full-orig']['file'] ) ) {
            $candidate_relative = ltrim( trailingslashit( $current_dir_relative ) . wp_basename( $backup_sizes['full-orig']['file'] ), '/' );
            $candidate_file = $this->absolute_from_relative( $candidate_relative );
            if ( $candidate_file && file_exists( $candidate_file ) && is_readable( $candidate_file ) ) {
                $relative = $candidate_relative;
                $file = $candidate_file;
                $master_origin = 'wordpress_full_original';
            }
        } elseif ( ! empty( $metadata['original_image'] ) ) {
            $candidate_relative = ltrim( trailingslashit( $current_dir_relative ) . wp_basename( $metadata['original_image'] ), '/' );
            $candidate_file = $this->absolute_from_relative( $candidate_relative );
            if ( $candidate_file && file_exists( $candidate_file ) && is_readable( $candidate_file ) ) {
                $relative = $candidate_relative;
                $file = $candidate_file;
                $master_origin = 'wordpress_original_image';
            }
        }

        $image_size = @getimagesize( $file ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
        $width = isset( $image_size[0] ) ? (int) $image_size[0] : ( isset( $metadata['width'] ) ? (int) $metadata['width'] : 0 );
        $height = isset( $image_size[1] ) ? (int) $image_size[1] : ( isset( $metadata['height'] ) ? (int) $metadata['height'] : 0 );
        $mime = ! empty( $image_size['mime'] ) ? $image_size['mime'] : get_post_mime_type( $attachment_id );

        $master = array(
            'relative_path' => $relative,
            'filename'      => wp_basename( $file ),
            'url'           => $this->url_from_relative( $relative ),
            'mime'          => $mime ?: 'image/jpeg',
            'width'         => $width,
            'height'        => $height,
            'size_bytes'    => (int) filesize( $file ),
            'checksum'      => hash_file( 'sha256', $file ),
            'captured_at'   => gmdate( 'c' ),
            'wp_metadata'   => $metadata,
            'backup_sizes'  => $backup_sizes,
            'origin'        => $master_origin,
            'needs_metadata_regeneration' => $relative !== $current_relative,
        );

        update_post_meta( $attachment_id, self::MASTER_META, $master );
        if ( '' === (string) get_post_meta( $attachment_id, self::PREFERRED_META, true ) ) {
            update_post_meta( $attachment_id, self::PREFERRED_META, 'master' );
        }
        $capture_message = 'current_attachment' === $master_origin ? __( 'Protected master captured from the current WordPress source image.', 'simme-media-organiser' ) : __( 'Protected master captured from WordPress’ retained pre-edit original.', 'simme-media-organiser' );
        $this->log( $attachment_id, 'master_captured', $capture_message );
        return $master;
    }

    private function versions( $attachment_id ) {
        $versions = get_post_meta( $attachment_id, self::VERSIONS_META, true );
        return is_array( $versions ) ? array_values( array_filter( $versions, 'is_array' ) ) : array();
    }

    private function save_versions( $attachment_id, $versions ) {
        update_post_meta( $attachment_id, self::VERSIONS_META, array_values( $versions ) );
    }

    /**
     * Resolve which Studio source WordPress is actually pointing at.
     *
     * The attachment file pointer is authoritative. Studio bookkeeping is
     * reconciled to it so the UI cannot claim that a version is active when
     * WordPress is really serving the master (or vice versa).
     */
    private function current_wordpress_source_id( $attachment_id, $master, $versions ) {
        $current_relative = Simme_Media_Organiser_Plugin::safe_relative_upload_path( get_post_meta( $attachment_id, '_wp_attached_file', true ) );
        if ( ! $current_relative ) {
            return '';
        }

        $master_relative = Simme_Media_Organiser_Plugin::safe_relative_upload_path( $master['relative_path'] ?? '' );
        if ( $master_relative && $current_relative === $master_relative ) {
            return 'master';
        }

        foreach ( (array) $versions as $version ) {
            $version_relative = Simme_Media_Organiser_Plugin::safe_relative_upload_path( $version['relative_path'] ?? '' );
            if ( $version_relative && $current_relative === $version_relative ) {
                return (string) ( $version['id'] ?? '' );
            }
        }

        return '';
    }

    /**
     * Change the live WordPress attachment pointer without touching the
     * protected master file or any preserved working-version file.
     *
     * A compact rollback snapshot protects the previously active attachment if
     * WordPress cannot regenerate or accept metadata for the requested source.
     */
    private function switch_wordpress_attachment_source( $attachment_id, $relative_path, $mime, $path, $metadata = null, $regenerate_metadata = false ) {
        $relative_path = Simme_Media_Organiser_Plugin::safe_relative_upload_path( $relative_path );
        if ( ! $relative_path || ! $path || ! file_exists( $path ) || ! is_readable( $path ) ) {
            return new WP_Error( 'studio_switch_missing', __( 'The selected Image Studio source is not available on disk.', 'simme-media-organiser' ) );
        }

        $previous_relative = Simme_Media_Organiser_Plugin::safe_relative_upload_path( get_post_meta( $attachment_id, '_wp_attached_file', true ) );
        $previous_mime = (string) get_post_mime_type( $attachment_id );
        $previous_metadata_exists = metadata_exists( 'post', $attachment_id, '_wp_attachment_metadata' );
        $previous_metadata = wp_get_attachment_metadata( $attachment_id );
        $previous_metadata = is_array( $previous_metadata ) ? $previous_metadata : array();

        $rollback = static function () use ( $attachment_id, $previous_relative, $previous_mime, $previous_metadata_exists, $previous_metadata ) {
            if ( $previous_relative ) {
                update_post_meta( $attachment_id, '_wp_attached_file', $previous_relative );
            } else {
                delete_post_meta( $attachment_id, '_wp_attached_file' );
            }
            wp_update_post(
                array(
                    'ID'             => $attachment_id,
                    'post_mime_type' => $previous_mime,
                )
            );
            if ( $previous_metadata_exists ) {
                wp_update_attachment_metadata( $attachment_id, $previous_metadata );
            } else {
                delete_post_meta( $attachment_id, '_wp_attachment_metadata' );
            }
            clean_post_cache( $attachment_id );
        };

        update_post_meta( $attachment_id, '_wp_attached_file', $relative_path );
        $updated = wp_update_post(
            array(
                'ID'             => $attachment_id,
                'post_mime_type' => $mime,
            ),
            true
        );
        if ( is_wp_error( $updated ) ) {
            $rollback();
            return $updated;
        }

        $next_metadata = is_array( $metadata ) ? $metadata : array();
        if ( $regenerate_metadata || ! $next_metadata ) {
            require_once ABSPATH . 'wp-admin/includes/image.php';
            $generated = wp_generate_attachment_metadata( $attachment_id, $path );
            if ( ! is_array( $generated ) ) {
                $rollback();
                return new WP_Error( 'studio_metadata_failed', __( 'WordPress could not rebuild the image metadata for the selected Image Studio source.', 'simme-media-organiser' ) );
            }
            $next_metadata = $generated;
        }
        wp_update_attachment_metadata( $attachment_id, $next_metadata );
        clean_post_cache( $attachment_id );

        $resolved_relative = Simme_Media_Organiser_Plugin::safe_relative_upload_path( get_post_meta( $attachment_id, '_wp_attached_file', true ) );
        if ( $resolved_relative !== $relative_path ) {
            $rollback();
            return new WP_Error( 'studio_switch_not_applied', __( 'WordPress did not retain the requested Image Studio source, so the previous active image was restored.', 'simme-media-organiser' ) );
        }

        return $next_metadata;
    }

    /**
     * Capture the two deliberately separate Image Studio choices:
     * - preferred: Simme's saved go-to version;
     * - active: the file WordPress currently serves for the attachment.
     */
    private function studio_state_snapshot( $attachment_id, $master = null, $versions = null ) {
        if ( ! is_array( $master ) ) {
            $master = $this->capture_master( $attachment_id );
            if ( is_wp_error( $master ) ) {
                return $master;
            }
        }
        if ( ! is_array( $versions ) ) {
            $versions = $this->versions( $attachment_id );
        }

        $preferred = (string) get_post_meta( $attachment_id, self::PREFERRED_META, true );
        if ( ! $preferred ) {
            $preferred = 'master';
        }
        if ( 'master' !== $preferred ) {
            list( , $preferred_version ) = $this->find_version( $versions, $preferred );
            if ( ! $preferred_version ) {
                $preferred = 'master';
            }
        }

        $active = $this->current_wordpress_source_id( $attachment_id, $master, $versions );
        if ( ! $active ) {
            // Image Studio only records undoable state when the live attachment
            // points at a source it owns and can safely restore.
            $active = 'master';
        }

        return array(
            'preferred' => $preferred,
            'active'    => $active,
        );
    }

    private function state_history( $attachment_id ) {
        $history = get_post_meta( $attachment_id, self::STATE_HISTORY_META, true );
        $history = is_array( $history ) ? $history : array();
        return array(
            'undo' => ! empty( $history['undo'] ) && is_array( $history['undo'] ) ? array_values( $history['undo'] ) : array(),
            'redo' => ! empty( $history['redo'] ) && is_array( $history['redo'] ) ? array_values( $history['redo'] ) : array(),
        );
    }

    private function save_state_history( $attachment_id, $history ) {
        $history = is_array( $history ) ? $history : array();
        $undo = ! empty( $history['undo'] ) && is_array( $history['undo'] ) ? array_slice( array_values( $history['undo'] ), -25 ) : array();
        $redo = ! empty( $history['redo'] ) && is_array( $history['redo'] ) ? array_slice( array_values( $history['redo'] ), -25 ) : array();
        update_post_meta(
            $attachment_id,
            self::STATE_HISTORY_META,
            array(
                'undo' => $undo,
                'redo' => $redo,
            )
        );
    }

    private function public_state_history( $attachment_id ) {
        $history = $this->state_history( $attachment_id );
        $undo = ! empty( $history['undo'] ) ? end( $history['undo'] ) : array();
        $redo = ! empty( $history['redo'] ) ? end( $history['redo'] ) : array();
        return array(
            'canUndo'     => ! empty( $undo ),
            'canRedo'     => ! empty( $redo ),
            'undoSummary' => ! empty( $undo['summary'] ) ? (string) $undo['summary'] : '',
            'redoSummary' => ! empty( $redo['summary'] ) ? (string) $redo['summary'] : '',
        );
    }

    private function record_state_transition( $attachment_id, $before, $after, $summary ) {
        if ( is_wp_error( $before ) || is_wp_error( $after ) || ! is_array( $before ) || ! is_array( $after ) || $before === $after ) {
            return;
        }
        $history = $this->state_history( $attachment_id );
        $history['undo'][] = array(
            'before'  => $before,
            'after'   => $after,
            'summary' => sanitize_text_field( $summary ),
            'date'    => gmdate( 'c' ),
            'user_id' => get_current_user_id(),
        );
        // A new deliberate choice starts a fresh redo branch.
        $history['redo'] = array();
        $this->save_state_history( $attachment_id, $history );
    }

    /**
     * Apply an Image Studio state snapshot. This changes only the WordPress
     * attachment pointer/metadata and the Simme preferred marker; protected
     * source files and working-version files are never overwritten.
     */
    private function apply_studio_state( $attachment_id, $state ) {
        $state = is_array( $state ) ? $state : array();
        $master = $this->capture_master( $attachment_id );
        if ( is_wp_error( $master ) ) {
            return $master;
        }
        $versions = $this->versions( $attachment_id );
        $preferred = sanitize_text_field( (string) ( $state['preferred'] ?? 'master' ) );
        $active = sanitize_text_field( (string) ( $state['active'] ?? 'master' ) );
        if ( ! $preferred ) {
            $preferred = 'master';
        }
        if ( ! $active ) {
            $active = 'master';
        }

        if ( 'master' !== $preferred ) {
            list( , $preferred_version ) = $this->find_version( $versions, $preferred );
            if ( ! $preferred_version ) {
                return new WP_Error( 'studio_state_preferred_missing', __( 'The version needed to restore the previous preferred choice no longer exists.', 'simme-media-organiser' ) );
            }
        }

        $current_active = $this->current_wordpress_source_id( $attachment_id, $master, $versions );
        if ( $current_active !== $active ) {
            if ( 'master' === $active ) {
                $path = $this->absolute_from_relative( $master['relative_path'] ?? '' );
                if ( ! $path || ! file_exists( $path ) ) {
                    return new WP_Error( 'studio_state_master_missing', __( 'The protected master needed for this Undo/Redo action is missing.', 'simme-media-organiser' ) );
                }
                $saved_metadata = isset( $master['wp_metadata'] ) && is_array( $master['wp_metadata'] ) ? $master['wp_metadata'] : array();
                $needs_regeneration = ! empty( $master['needs_metadata_regeneration'] ) || ! $saved_metadata;
                $metadata = $this->switch_wordpress_attachment_source(
                    $attachment_id,
                    $master['relative_path'],
                    $master['mime'],
                    $path,
                    $saved_metadata,
                    $needs_regeneration
                );
                if ( is_wp_error( $metadata ) ) {
                    return $metadata;
                }
                if ( $needs_regeneration ) {
                    $master['wp_metadata'] = $metadata;
                    $master['needs_metadata_regeneration'] = false;
                    update_post_meta( $attachment_id, self::MASTER_META, $master );
                }
                if ( array_key_exists( 'backup_sizes', $master ) ) {
                    update_post_meta( $attachment_id, '_wp_attachment_backup_sizes', $master['backup_sizes'] );
                }
                delete_post_meta( $attachment_id, self::ACTIVE_META );
            } else {
                list( $index, $version ) = $this->find_version( $versions, $active );
                if ( ! $version ) {
                    return new WP_Error( 'studio_state_active_missing', __( 'The version needed for this Undo/Redo action no longer exists.', 'simme-media-organiser' ) );
                }
                $path = $this->absolute_from_relative( $version['relative_path'] ?? '' );
                if ( ! $path || ! file_exists( $path ) ) {
                    return new WP_Error( 'studio_state_active_file_missing', __( 'The version file needed for this Undo/Redo action is missing.', 'simme-media-organiser' ) );
                }
                $saved_metadata = isset( $version['wp_metadata'] ) && is_array( $version['wp_metadata'] ) ? $version['wp_metadata'] : array();
                $metadata = $this->switch_wordpress_attachment_source(
                    $attachment_id,
                    $version['relative_path'],
                    $version['mime'],
                    $path,
                    $saved_metadata,
                    ! $saved_metadata
                );
                if ( is_wp_error( $metadata ) ) {
                    return $metadata;
                }
                if ( ! $saved_metadata && $index >= 0 ) {
                    $versions[ $index ]['wp_metadata'] = $metadata;
                    $this->save_versions( $attachment_id, $versions );
                }
                update_post_meta( $attachment_id, self::ACTIVE_META, $active );
            }
        } elseif ( 'master' === $active ) {
            delete_post_meta( $attachment_id, self::ACTIVE_META );
        } else {
            update_post_meta( $attachment_id, self::ACTIVE_META, $active );
        }

        update_post_meta( $attachment_id, self::PREFERRED_META, $preferred );
        clean_post_cache( $attachment_id );
        return true;
    }

    private function find_version( $versions, $version_id ) {
        foreach ( $versions as $index => $version ) {
            if ( isset( $version['id'] ) && (string) $version['id'] === (string) $version_id ) {
                return array( $index, $version );
            }
        }
        return array( -1, null );
    }

    private function version_dir( $attachment_id ) {
        $upload = $this->uploads();
        if ( is_wp_error( $upload ) ) {
            return $upload;
        }
        $dir = trailingslashit( $upload['basedir'] ) . 'simme-media/' . absint( $attachment_id );
        if ( ! is_dir( $dir ) && ! wp_mkdir_p( $dir ) ) {
            return new WP_Error( 'version_dir', __( 'WordPress could not create the protected Image Studio versions folder.', 'simme-media-organiser' ) );
        }
        return $dir;
    }

    private function source_for( $attachment_id, $source_id ) {
        $master = $this->capture_master( $attachment_id );
        if ( is_wp_error( $master ) ) {
            return $master;
        }
        if ( ! $source_id || 'master' === $source_id ) {
            $path = $this->absolute_from_relative( $master['relative_path'] );
            if ( ! $path || ! file_exists( $path ) ) {
                return new WP_Error( 'master_missing', __( 'The protected master is no longer available on disk.', 'simme-media-organiser' ) );
            }
            return array( 'id' => 'master', 'path' => $path, 'data' => $master );
        }

        list( , $version ) = $this->find_version( $this->versions( $attachment_id ), $source_id );
        if ( ! $version ) {
            return new WP_Error( 'version_missing', __( 'The selected source version no longer exists.', 'simme-media-organiser' ) );
        }
        $path = $this->absolute_from_relative( $version['relative_path'] ?? '' );
        if ( ! $path || ! file_exists( $path ) ) {
            return new WP_Error( 'version_file_missing', __( 'The selected source version file is missing.', 'simme-media-organiser' ) );
        }
        return array( 'id' => $version['id'], 'path' => $path, 'data' => $version );
    }

    private function best_web_mime( $source_mime = '' ) {
        if ( version_compare( get_bloginfo( 'version' ), '6.5', '>=' ) && wp_image_editor_supports( array( 'mime_type' => 'image/avif' ) ) ) {
            return 'image/avif';
        }
        if ( wp_image_editor_supports( array( 'mime_type' => 'image/webp' ) ) ) {
            return 'image/webp';
        }
        if ( wp_image_editor_supports( array( 'mime_type' => 'image/jpeg' ) ) ) {
            return 'image/jpeg';
        }
        return $source_mime ?: 'image/png';
    }

    private function supported_formats( $source_mime ) {
        $best_web = $this->best_web_mime( $source_mime );
        return array(
            /* translators: %s: source image format, for example JPEG or PNG. */
            array( 'value' => 'original', 'label' => sprintf( __( 'Keep %s', 'simme-media-organiser' ), strtoupper( str_replace( 'image/', '', (string) $source_mime ) ) ), 'mime' => $source_mime ),
            /* translators: %s: automatically selected web image format, for example WEBP. */
            array( 'value' => 'auto', 'label' => sprintf( __( 'Auto · Best web (%s)', 'simme-media-organiser' ), strtoupper( str_replace( 'image/', '', $best_web ) ) ), 'mime' => $best_web ),
        );
    }

    private function human_bytes( $bytes ) {
        return Simme_Media_Organiser_Plugin::human_bytes( max( 0, (int) $bytes ) );
    }

    private function public_master( $master ) {
        return array(
            'id'        => 'master',
            'label'     => __( 'Master Original', 'simme-media-organiser' ),
            'url'       => $this->url_from_relative( $master['relative_path'] ?? '' ),
            'filename'  => (string) ( $master['filename'] ?? '' ),
            'mime'      => (string) ( $master['mime'] ?? '' ),
            'width'     => (int) ( $master['width'] ?? 0 ),
            'height'    => (int) ( $master['height'] ?? 0 ),
            'sizeBytes' => (int) ( $master['size_bytes'] ?? 0 ),
            'size'      => $this->human_bytes( $master['size_bytes'] ?? 0 ),
            'checksum'  => (string) ( $master['checksum'] ?? '' ),
            'date'      => (string) ( $master['captured_at'] ?? '' ),
            'protected' => true,
            'origin'    => (string) ( $master['origin'] ?? 'current_attachment' ),
        );
    }

    private function social_avatar_presets() {
        return array(
            'instagram' => array( 'label' => 'Instagram', 'id' => 'ig-profile', 'width' => 320, 'height' => 320 ),
            'facebook'  => array( 'label' => 'Facebook', 'id' => 'fb-profile', 'width' => 320, 'height' => 320 ),
            'x'         => array( 'label' => 'X', 'id' => 'x-profile', 'width' => 400, 'height' => 400 ),
            'linkedin'  => array( 'label' => 'LinkedIn', 'id' => 'li-profile', 'width' => 400, 'height' => 400 ),
            'youtube'   => array( 'label' => 'YouTube', 'id' => 'yt-profile', 'width' => 800, 'height' => 800 ),
            'tiktok'    => array( 'label' => 'TikTok', 'id' => 'tt-profile', 'width' => 200, 'height' => 200 ),
            'pinterest' => array( 'label' => 'Pinterest', 'id' => 'pin-profile', 'width' => 280, 'height' => 280 ),
            'threads'   => array( 'label' => 'Threads', 'id' => 'threads-profile', 'width' => 320, 'height' => 320 ),
        );
    }

    private function normalise_social_crop_recipe( $social ) {
        if ( ! is_array( $social ) ) {
            return null;
        }

        $presets = $this->social_avatar_presets();
        $platform = sanitize_key( (string) ( $social['platform'] ?? '' ) );
        if ( ! isset( $presets[ $platform ] ) ) {
            return null;
        }

        $preset = $presets[ $platform ];
        $preset_id = sanitize_key( (string) ( $social['preset_id'] ?? '' ) );
        if ( (string) $preset['id'] !== $preset_id ) {
            return null;
        }

        $target_width = max( 1, absint( $social['target_width'] ?? $preset['width'] ) );
        $target_height = max( 1, absint( $social['target_height'] ?? $preset['height'] ) );
        $safe_zone_model = sanitize_key( (string) ( $social['safe_zone_model'] ?? 'circular-avatar-v1' ) );
        if ( 'circular-avatar-v1' !== $safe_zone_model ) {
            $safe_zone_model = 'circular-avatar-v1';
        }

        return array(
            'platform'           => $platform,
            'preset_id'          => $preset_id,
            'target_width'       => $target_width,
            'target_height'      => $target_height,
            'fixed_aspect_ratio' => true,
            'aspect_ratio'       => '1:1',
            'safe_zones_enabled' => ! isset( $social['safe_zones_enabled'] ) || ! empty( $social['safe_zones_enabled'] ),
            'safe_zone_model'    => $safe_zone_model,
        );
    }

    private function social_crop_recipe_from_request() {
        // Defence in depth: verify here as well as in create_version() so this
        // request reader remains safe if called from another action later.
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $platform = sanitize_key( wp_unslash( $_POST['social_platform'] ?? '' ) );
        $preset_id = sanitize_key( wp_unslash( $_POST['social_preset_id'] ?? '' ) );
        if ( ! $platform || ! $preset_id ) {
            return null;
        }

        return $this->normalise_social_crop_recipe(
            array(
                'platform'           => $platform,
                'preset_id'          => $preset_id,
                'target_width'       => absint( wp_unslash( $_POST['social_target_w'] ?? 0 ) ),
                'target_height'      => absint( wp_unslash( $_POST['social_target_h'] ?? 0 ) ),
                'fixed_aspect_ratio' => (bool) absint( wp_unslash( $_POST['social_fixed_aspect_ratio'] ?? 0 ) ),
                'safe_zones_enabled' => (bool) absint( wp_unslash( $_POST['social_safe_zones_enabled'] ?? 0 ) ),
                'safe_zone_model'    => sanitize_key( wp_unslash( $_POST['social_safe_zone_model'] ?? '' ) ),
            )
        );
    }

    private function legacy_social_crop_recovery_candidates( $recipe ) {
        if ( ! is_array( $recipe ) || empty( $recipe['crop_mode'] ) || empty( $recipe['lock_ratio'] ) ) {
            return array();
        }

        $resize = isset( $recipe['resize'] ) && is_array( $recipe['resize'] ) ? $recipe['resize'] : array();
        $target_width = absint( $resize['width'] ?? 0 );
        $target_height = absint( $resize['height'] ?? 0 );
        if ( ! $target_width || $target_width !== $target_height ) {
            return array();
        }

        $priority = array(
            320 => array( 'facebook', 'instagram', 'threads' ),
            400 => array( 'x', 'linkedin' ),
        );
        $presets = $this->social_avatar_presets();
        $platforms = isset( $priority[ $target_width ] ) ? $priority[ $target_width ] : array_keys( $presets );
        $matches = array();

        foreach ( $platforms as $platform ) {
            if ( ! isset( $presets[ $platform ] ) ) {
                continue;
            }
            $preset = $presets[ $platform ];
            if ( (int) $preset['width'] === $target_width && (int) $preset['height'] === $target_height ) {
                $matches[] = array(
                    'platform'      => $platform,
                    'platformLabel' => (string) $preset['label'],
                    'preset_id'     => (string) $preset['id'],
                    'target_width'  => $target_width,
                    'target_height' => $target_height,
                );
            }
        }

        return $matches;
    }

    private function infer_legacy_social_crop_recipe( $version, $recipe ) {
        $matches = $this->legacy_social_crop_recovery_candidates( $recipe );

        // Older saved recipes did not preserve the platform. Only infer a
        // platform where the historical target size identifies it uniquely.
        if ( 1 !== count( $matches ) ) {
            return null;
        }

        $match = $matches[0];
        return $this->normalise_social_crop_recipe(
            array(
                'platform'           => $match['platform'],
                'preset_id'          => $match['preset_id'],
                'target_width'       => $match['target_width'],
                'target_height'      => $match['target_height'],
                'fixed_aspect_ratio' => true,
                'safe_zones_enabled' => true,
                'safe_zone_model'    => 'circular-avatar-v1',
            )
        );
    }

    private function version_edit_recipe( $version ) {
        if ( ! is_array( $version ) || 'master' !== (string) ( $version['source'] ?? 'master' ) ) {
            return null;
        }
        if ( ! empty( $version['edit_recipe'] ) && is_array( $version['edit_recipe'] ) ) {
            $recipe = $version['edit_recipe'];
            $social = $this->normalise_social_crop_recipe( $recipe['social_crop'] ?? null );
            $recovery_candidates = array();
            if ( ! $social ) {
                $social = $this->infer_legacy_social_crop_recipe( $version, $recipe );
                if ( ! $social ) {
                    $recovery_candidates = $this->legacy_social_crop_recovery_candidates( $recipe );
                }
            }
            $recipe['social_crop'] = $social;
            if ( count( $recovery_candidates ) > 1 ) {
                $resize = isset( $recipe['resize'] ) && is_array( $recipe['resize'] ) ? $recipe['resize'] : array();
                $recipe['social_recovery'] = array(
                    'target_width'  => absint( $resize['width'] ?? 0 ),
                    'target_height' => absint( $resize['height'] ?? 0 ),
                    'candidates'    => $recovery_candidates,
                );
            } else {
                unset( $recipe['social_recovery'] );
            }
            $recipe['schema'] = $social ? max( 2, (int) ( $recipe['schema'] ?? 1 ) ) : (int) ( $recipe['schema'] ?? 1 );
            return $recipe;
        }
        $transform = isset( $version['transform'] ) && is_array( $version['transform'] ) ? $version['transform'] : array();
        $recipe = array(
            'schema'            => 1,
            'source_id'         => 'master',
            'crop'              => isset( $transform['crop'] ) && is_array( $transform['crop'] ) ? $transform['crop'] : null,
            'crop_mode'         => ! empty( $transform['crop'] ),
            'crop_ratio'        => 'free',
            'resize'            => isset( $transform['resize'] ) && is_array( $transform['resize'] ) ? $transform['resize'] : array( 'width' => (int) ( $version['width'] ?? 0 ), 'height' => (int) ( $version['height'] ?? 0 ) ),
            'lock_ratio'        => true,
            'rotation'          => (int) ( $transform['rotation'] ?? 0 ),
            'flip_h'            => ! empty( $transform['flip_h'] ),
            'flip_v'            => ! empty( $transform['flip_v'] ),
            'format'            => (string) ( $transform['format'] ?? ( $version['mime'] ?? 'image/jpeg' ) ),
            'quality'           => (int) ( $transform['quality'] ?? 82 ),
            'label'             => (string) ( $version['label'] ?? __( 'Working Version', 'simme-media-organiser' ) ),
            'transparency_bg'   => 'checker',
            'social_crop'       => null,
        );
        $social = $this->infer_legacy_social_crop_recipe( $version, $recipe );
        if ( $social ) {
            $recipe['schema'] = 2;
            $recipe['social_crop'] = $social;
        } else {
            $recovery_candidates = $this->legacy_social_crop_recovery_candidates( $recipe );
            if ( count( $recovery_candidates ) > 1 ) {
                $resize = isset( $recipe['resize'] ) && is_array( $recipe['resize'] ) ? $recipe['resize'] : array();
                $recipe['social_recovery'] = array(
                    'target_width'  => absint( $resize['width'] ?? 0 ),
                    'target_height' => absint( $resize['height'] ?? 0 ),
                    'candidates'    => $recovery_candidates,
                );
            }
        }
        return $recipe;
    }

    private function public_version( $version, $preferred, $active ) {
        return array(
            'id'          => (string) ( $version['id'] ?? '' ),
            'label'       => (string) ( $version['label'] ?? __( 'Working Version', 'simme-media-organiser' ) ),
            'url'         => $this->url_from_relative( $version['relative_path'] ?? '' ),
            'filename'    => (string) ( $version['filename'] ?? '' ),
            'mime'        => (string) ( $version['mime'] ?? '' ),
            'width'       => (int) ( $version['width'] ?? 0 ),
            'height'      => (int) ( $version['height'] ?? 0 ),
            'sizeBytes'   => (int) ( $version['size_bytes'] ?? 0 ),
            'size'        => $this->human_bytes( $version['size_bytes'] ?? 0 ),
            'date'        => (string) ( $version['created_at'] ?? '' ),
            'source'      => (string) ( $version['source'] ?? 'master' ),
            'transform'   => isset( $version['transform'] ) && is_array( $version['transform'] ) ? $version['transform'] : array(),
            'editRecipe'  => $this->version_edit_recipe( $version ),
            'editable'    => null !== $this->version_edit_recipe( $version ),
            'revision'    => max( 1, (int) ( $version['revision'] ?? 1 ) ),
            'updatedDate' => (string) ( $version['updated_at'] ?? '' ),
            'preferred'   => (string) $preferred === (string) ( $version['id'] ?? '' ),
            'active'      => (string) $active === (string) ( $version['id'] ?? '' ),
        );
    }

    private function studio_payload( $attachment_id ) {
        $master = $this->capture_master( $attachment_id );
        if ( is_wp_error( $master ) ) {
            return $master;
        }
        $versions = $this->versions( $attachment_id );
        $preferred = (string) get_post_meta( $attachment_id, self::PREFERRED_META, true );
        if ( ! $preferred ) {
            $preferred = 'master';
        }

        // The real WordPress attachment pointer is the source of truth. Reconcile
        // the lightweight Studio active marker to it before building the payload.
        $resolved_active = $this->current_wordpress_source_id( $attachment_id, $master, $versions );
        $stored_active = (string) get_post_meta( $attachment_id, self::ACTIVE_META, true );
        if ( 'master' === $resolved_active ) {
            if ( $stored_active ) {
                delete_post_meta( $attachment_id, self::ACTIVE_META );
            }
            $active = '';
        } elseif ( $resolved_active ) {
            $active = $resolved_active;
            if ( $stored_active !== $resolved_active ) {
                update_post_meta( $attachment_id, self::ACTIVE_META, $resolved_active );
            }
        } else {
            $active = '';
            if ( $stored_active ) {
                delete_post_meta( $attachment_id, self::ACTIVE_META );
            }
        }

        $public_versions = array();
        foreach ( array_reverse( $versions ) as $version ) {
            $public_versions[] = $this->public_version( $version, $preferred, $active );
        }
        $master_public = $this->public_master( $master );
        $master_active = 'master' === $resolved_active;

        return array(
            'attachmentId' => (int) $attachment_id,
            'title'        => html_entity_decode( get_the_title( $attachment_id ), ENT_QUOTES, get_bloginfo( 'charset' ) ),
            'master'       => $master_public,
            'versions'     => $public_versions,
            'preferred'    => $preferred,
            'active'       => $master_active ? 'master' : $active,
            'masterActive' => (bool) $master_active,
            'formats'      => $this->supported_formats( $master['mime'] ?? get_post_mime_type( $attachment_id ) ),
            'history'      => array_slice( array_reverse( (array) get_post_meta( $attachment_id, self::HISTORY_META, true ) ), 0, 20 ),
            'versionStateHistory' => $this->public_state_history( $attachment_id ),
        );
    }

    private function log( $attachment_id, $action, $message, $extra = array() ) {
        $history = get_post_meta( $attachment_id, self::HISTORY_META, true );
        $history = is_array( $history ) ? $history : array();
        $history[] = array_merge(
            array(
                'action'  => sanitize_key( $action ),
                'message' => sanitize_text_field( $message ),
                'date'    => gmdate( 'c' ),
                'user_id' => get_current_user_id(),
            ),
            is_array( $extra ) ? $extra : array()
        );
        if ( count( $history ) > 100 ) {
            $history = array_slice( $history, -100 );
        }
        update_post_meta( $attachment_id, self::HISTORY_META, $history );
    }


    private function refresh_media_intelligence( $attachment_id, $action_key = '', $summary = '', $details = array() ) {
        if ( ! class_exists( 'Simme_Media_Organiser_Audit' ) ) {
            return;
        }
        Simme_Media_Organiser_Audit::scan_attachment( $attachment_id, false );
        if ( $action_key && $summary ) {
            Simme_Media_Organiser_Audit::log_action( $action_key, $summary, $attachment_id, $details, false );
        }
    }

    public function get() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $attachment_id = $this->guard( absint( wp_unslash( $_POST['id'] ?? 0 ) ) );
        $payload = $this->studio_payload( $attachment_id );
        if ( is_wp_error( $payload ) ) {
            wp_send_json_error( array( 'message' => $payload->get_error_message() ), 400 );
        }
        wp_send_json_success( $payload );
    }


    public function recover_social_crop() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $attachment_id = $this->guard( absint( wp_unslash( $_POST['id'] ?? 0 ) ) );
        $version_id = sanitize_text_field( wp_unslash( $_POST['version_id'] ?? '' ) );
        $platform = sanitize_key( wp_unslash( $_POST['platform'] ?? '' ) );
        $preset_id = sanitize_key( wp_unslash( $_POST['preset_id'] ?? '' ) );

        if ( ! $version_id || ! $platform || ! $preset_id ) {
            wp_send_json_error( array( 'message' => __( 'Choose the original social channel before continuing.', 'simme-media-organiser' ) ), 400 );
        }

        $versions = $this->versions( $attachment_id );
        list( $version_index, $version ) = $this->find_version( $versions, $version_id );
        if ( ! $version || $version_index < 0 ) {
            wp_send_json_error( array( 'message' => __( 'That Working Version could not be found.', 'simme-media-organiser' ) ), 404 );
        }

        $raw_recipe = isset( $version['edit_recipe'] ) && is_array( $version['edit_recipe'] ) ? $version['edit_recipe'] : null;
        if ( ! $raw_recipe ) {
            wp_send_json_error( array( 'message' => __( 'This older version does not contain enough recipe data for social-channel recovery.', 'simme-media-organiser' ) ), 400 );
        }

        $existing_social = $this->normalise_social_crop_recipe( $raw_recipe['social_crop'] ?? null );
        if ( $existing_social ) {
            $payload = $this->studio_payload( $attachment_id );
            if ( is_wp_error( $payload ) ) {
                wp_send_json_error( array( 'message' => $payload->get_error_message() ), 400 );
            }
            wp_send_json_success( $payload );
        }

        $candidates = $this->legacy_social_crop_recovery_candidates( $raw_recipe );
        $chosen = null;
        foreach ( $candidates as $candidate ) {
            if ( $platform === (string) $candidate['platform'] && $preset_id === (string) $candidate['preset_id'] ) {
                $chosen = $candidate;
                break;
            }
        }

        if ( ! $chosen || count( $candidates ) < 2 ) {
            wp_send_json_error( array( 'message' => __( 'That channel does not match the saved crop dimensions.', 'simme-media-organiser' ) ), 400 );
        }

        $social = $this->normalise_social_crop_recipe(
            array(
                'platform'           => $chosen['platform'],
                'preset_id'          => $chosen['preset_id'],
                'target_width'       => $chosen['target_width'],
                'target_height'      => $chosen['target_height'],
                'fixed_aspect_ratio' => true,
                'safe_zones_enabled' => true,
                'safe_zone_model'    => 'circular-avatar-v1',
            )
        );

        if ( ! $social ) {
            wp_send_json_error( array( 'message' => __( 'The selected channel could not be restored safely.', 'simme-media-organiser' ) ), 400 );
        }

        $raw_recipe['schema'] = 2;
        $raw_recipe['social_crop'] = $social;
        unset( $raw_recipe['social_recovery'] );
        $version['edit_recipe'] = $raw_recipe;
        $versions[ $version_index ] = $version;
        $this->save_versions( $attachment_id, $versions );

        $this->log(
            $attachment_id,
            'social_crop_recovered',
            sprintf(
                /* translators: %s: social channel name. */
                __( 'Recovered older social-avatar crop as %s.', 'simme-media-organiser' ),
                (string) $chosen['platformLabel']
            ),
            array(
                'version_id' => $version_id,
                'platform'   => $chosen['platform'],
                'preset_id'  => $chosen['preset_id'],
            )
        );

        $payload = $this->studio_payload( $attachment_id );
        if ( is_wp_error( $payload ) ) {
            wp_send_json_error( array( 'message' => $payload->get_error_message() ), 400 );
        }
        $payload['recoveredVersionId'] = $version_id;
        wp_send_json_success( $payload );
    }


    public function estimate() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $attachment_id = $this->guard( absint( wp_unslash( $_POST['id'] ?? 0 ) ) );
        $edit_version_id = sanitize_text_field( wp_unslash( $_POST['edit_version_id'] ?? '' ) );
        $existing_versions = $this->versions( $attachment_id );
        $edit_index = -1;
        $edit_version = null;
        if ( $edit_version_id ) {
            list( $edit_index, $edit_version ) = $this->find_version( $existing_versions, $edit_version_id );
            if ( ! $edit_version || null === $this->version_edit_recipe( $edit_version ) ) {
                wp_send_json_error( array( 'message' => __( 'This version cannot be safely re-edited from the protected master.', 'simme-media-organiser' ) ), 400 );
            }
            $source_id = 'master';
        } else {
            $source_id = 'master';
        }
        $source = $this->source_for( $attachment_id, $source_id );
        if ( is_wp_error( $source ) ) {
            wp_send_json_error( array( 'message' => $source->get_error_message() ), 400 );
        }

        require_once ABSPATH . 'wp-admin/includes/image.php';
        $editor = wp_get_image_editor( $source['path'] );
        if ( is_wp_error( $editor ) ) {
            wp_send_json_error( array( 'message' => $editor->get_error_message() ), 500 );
        }

        $source_size = $editor->get_size();
        $source_w = max( 1, (int) ( $source_size['width'] ?? 1 ) );
        $source_h = max( 1, (int) ( $source_size['height'] ?? 1 ) );

        $crop_x = max( 0, absint( wp_unslash( $_POST['crop_x'] ?? 0 ) ) );
        $crop_y = max( 0, absint( wp_unslash( $_POST['crop_y'] ?? 0 ) ) );
        $crop_w = absint( wp_unslash( $_POST['crop_w'] ?? 0 ) );
        $crop_h = absint( wp_unslash( $_POST['crop_h'] ?? 0 ) );
        if ( $crop_w > 0 && $crop_h > 0 ) {
            $crop_x = min( $crop_x, $source_w - 1 );
            $crop_y = min( $crop_y, $source_h - 1 );
            $crop_w = min( $crop_w, $source_w - $crop_x );
            $crop_h = min( $crop_h, $source_h - $crop_y );
            if ( $crop_w < 2 || $crop_h < 2 ) {
                wp_send_json_error( array( 'message' => __( 'The crop area is too small.', 'simme-media-organiser' ) ), 400 );
            }
            $result = $editor->crop( $crop_x, $crop_y, $crop_w, $crop_h );
            if ( is_wp_error( $result ) ) {
                wp_send_json_error( array( 'message' => $result->get_error_message() ), 500 );
            }
        }

        $resize_w = absint( wp_unslash( $_POST['resize_w'] ?? 0 ) );
        $resize_h = absint( wp_unslash( $_POST['resize_h'] ?? 0 ) );
        if ( $resize_w || $resize_h ) {
            $current = $editor->get_size();
            $cw = max( 1, (int) ( $current['width'] ?? 1 ) );
            $ch = max( 1, (int) ( $current['height'] ?? 1 ) );
            if ( ! $resize_w ) {
                $resize_w = max( 1, (int) round( $cw * ( $resize_h / $ch ) ) );
            }
            if ( ! $resize_h ) {
                $resize_h = max( 1, (int) round( $ch * ( $resize_w / $cw ) ) );
            }
            if ( $resize_w < $cw || $resize_h < $ch ) {
                $result = $editor->resize( $resize_w, $resize_h, false );
                if ( is_wp_error( $result ) ) {
                    wp_send_json_error( array( 'message' => $result->get_error_message() ), 500 );
                }
            }
        }

        $rotation = intval( wp_unslash( $_POST['rotation'] ?? 0 ) );
        $rotation = in_array( $rotation, array( -270, -180, -90, 0, 90, 180, 270 ), true ) ? $rotation : 0;
        if ( $rotation ) {
            $result = $editor->rotate( $rotation );
            if ( is_wp_error( $result ) ) {
                wp_send_json_error( array( 'message' => $result->get_error_message() ), 500 );
            }
        }

        $flip_h = ! empty( sanitize_text_field( wp_unslash( $_POST['flip_h'] ?? '' ) ) );
        $flip_v = ! empty( sanitize_text_field( wp_unslash( $_POST['flip_v'] ?? '' ) ) );
        if ( $flip_h || $flip_v ) {
            $result = $editor->flip( $flip_h, $flip_v );
            if ( is_wp_error( $result ) ) {
                wp_send_json_error( array( 'message' => $result->get_error_message() ), 500 );
            }
        }

        $quality = min( 100, max( 40, absint( wp_unslash( $_POST['quality'] ?? 82 ) ) ) );
        if ( method_exists( $editor, 'set_quality' ) ) {
            $editor->set_quality( $quality );
        }

        $requested_format = sanitize_text_field( wp_unslash( $_POST['format'] ?? 'original' ) );
        if ( ! in_array( $requested_format, array( 'original', 'auto' ), true ) ) {
            $requested_format = 'auto';
        }
        $source_mime = (string) ( $source['data']['mime'] ?? get_post_mime_type( $attachment_id ) );
        if ( 'auto' === $requested_format ) {
            $target_mime = $this->best_web_mime( $source_mime );
        } else {
            $target_mime = 'original' === $requested_format ? $source_mime : $requested_format;
        }
        $allowed_mimes = array( 'image/jpeg', 'image/png', 'image/webp', 'image/avif' );
        if ( 'image/avif' === $target_mime && version_compare( get_bloginfo( 'version' ), '6.5', '<' ) ) {
            wp_send_json_error( array( 'message' => __( 'AVIF output requires WordPress 6.5 or newer.', 'simme-media-organiser' ) ), 400 );
        }
        if ( ! in_array( $target_mime, $allowed_mimes, true ) ) {
            wp_send_json_error( array( 'message' => __( 'That output format is not supported by Image Studio.', 'simme-media-organiser' ) ), 400 );
        }
        if ( ! wp_image_editor_supports( array( 'mime_type' => $target_mime ) ) ) {
            wp_send_json_error( array( 'message' => __( 'Your server image library cannot save that format.', 'simme-media-organiser' ) ), 400 );
        }

        $extension_map = array(
            'image/jpeg' => 'jpg',
            'image/png'  => 'png',
            'image/webp' => 'webp',
            'image/avif' => 'avif',
        );
        $extension = $extension_map[ $target_mime ];
        $dir = $this->version_dir( $attachment_id );
        if ( is_wp_error( $dir ) ) {
            wp_send_json_error( array( 'message' => $dir->get_error_message() ), 500 );
        }

        $filename = wp_unique_filename( $dir, sprintf( 'estimate-%s.%s', substr( str_replace( '-', '', wp_generate_uuid4() ), 0, 12 ), $extension ) );
        $destination = trailingslashit( $dir ) . $filename;
        $saved = $editor->save( $destination, $target_mime );
        if ( is_wp_error( $saved ) ) {
            wp_send_json_error( array( 'message' => $saved->get_error_message() ), 500 );
        }
        $saved_path = wp_normalize_path( $saved['path'] ?? $destination );
        if ( ! file_exists( $saved_path ) ) {
            wp_send_json_error( array( 'message' => __( 'Image Studio could not calculate an estimate for that output.', 'simme-media-organiser' ) ), 500 );
        }
        $bytes = (int) filesize( $saved_path );
        $width = (int) ( $saved['width'] ?? 0 );
        $height = (int) ( $saved['height'] ?? 0 );
        $mime = (string) ( $saved['mime-type'] ?? $target_mime );
        wp_delete_file( $saved_path );

        wp_send_json_success(
            array(
                'bytes'  => $bytes,
                'size'   => $this->human_bytes( $bytes ),
                'width'  => $width,
                'height' => $height,
                'mime'   => $mime,
            )
        );
    }

    public function create_version() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $attachment_id = $this->guard( absint( wp_unslash( $_POST['id'] ?? 0 ) ) );
        $edit_version_id = sanitize_text_field( wp_unslash( $_POST['edit_version_id'] ?? '' ) );
        $existing_versions = $this->versions( $attachment_id );
        $edit_index = -1;
        $edit_version = null;
        if ( $edit_version_id ) {
            list( $edit_index, $edit_version ) = $this->find_version( $existing_versions, $edit_version_id );
            if ( ! $edit_version || null === $this->version_edit_recipe( $edit_version ) ) {
                wp_send_json_error( array( 'message' => __( 'This version cannot be safely re-edited from the protected master.', 'simme-media-organiser' ) ), 400 );
            }
            $source_id = 'master';
        } else {
            $source_id = 'master';
        }
        $source = $this->source_for( $attachment_id, $source_id );
        if ( is_wp_error( $source ) ) {
            wp_send_json_error( array( 'message' => $source->get_error_message() ), 400 );
        }

        require_once ABSPATH . 'wp-admin/includes/image.php';
        $editor = wp_get_image_editor( $source['path'] );
        if ( is_wp_error( $editor ) ) {
            wp_send_json_error( array( 'message' => $editor->get_error_message() ), 500 );
        }

        $source_size = $editor->get_size();
        $source_w = max( 1, (int) ( $source_size['width'] ?? 1 ) );
        $source_h = max( 1, (int) ( $source_size['height'] ?? 1 ) );

        $crop_x = max( 0, absint( wp_unslash( $_POST['crop_x'] ?? 0 ) ) );
        $crop_y = max( 0, absint( wp_unslash( $_POST['crop_y'] ?? 0 ) ) );
        $crop_w = absint( wp_unslash( $_POST['crop_w'] ?? 0 ) );
        $crop_h = absint( wp_unslash( $_POST['crop_h'] ?? 0 ) );
        $did_crop = false;
        if ( $crop_w > 0 && $crop_h > 0 ) {
            $crop_x = min( $crop_x, $source_w - 1 );
            $crop_y = min( $crop_y, $source_h - 1 );
            $crop_w = min( $crop_w, $source_w - $crop_x );
            $crop_h = min( $crop_h, $source_h - $crop_y );
            if ( $crop_w < 2 || $crop_h < 2 ) {
                wp_send_json_error( array( 'message' => __( 'The crop area is too small.', 'simme-media-organiser' ) ), 400 );
            }
            $result = $editor->crop( $crop_x, $crop_y, $crop_w, $crop_h );
            if ( is_wp_error( $result ) ) {
                wp_send_json_error( array( 'message' => $result->get_error_message() ), 500 );
            }
            $did_crop = true;
        }

        $resize_w = absint( wp_unslash( $_POST['resize_w'] ?? 0 ) );
        $resize_h = absint( wp_unslash( $_POST['resize_h'] ?? 0 ) );
        $did_resize = false;
        if ( $resize_w || $resize_h ) {
            $current = $editor->get_size();
            $cw = max( 1, (int) ( $current['width'] ?? 1 ) );
            $ch = max( 1, (int) ( $current['height'] ?? 1 ) );
            if ( ! $resize_w ) {
                $resize_w = max( 1, (int) round( $cw * ( $resize_h / $ch ) ) );
            }
            if ( ! $resize_h ) {
                $resize_h = max( 1, (int) round( $ch * ( $resize_w / $cw ) ) );
            }
            // Never upscale silently. If both requested dimensions are larger than the
            // current image, leave the image at its current dimensions.
            if ( $resize_w < $cw || $resize_h < $ch ) {
                $result = $editor->resize( $resize_w, $resize_h, false );
                if ( is_wp_error( $result ) ) {
                    wp_send_json_error( array( 'message' => $result->get_error_message() ), 500 );
                }
                $did_resize = true;
            }
        }

        $rotation = intval( wp_unslash( $_POST['rotation'] ?? 0 ) );
        $rotation = in_array( $rotation, array( -270, -180, -90, 0, 90, 180, 270 ), true ) ? $rotation : 0;
        if ( $rotation ) {
            $result = $editor->rotate( $rotation );
            if ( is_wp_error( $result ) ) {
                wp_send_json_error( array( 'message' => $result->get_error_message() ), 500 );
            }
        }

        $flip_h = ! empty( sanitize_text_field( wp_unslash( $_POST['flip_h'] ?? '' ) ) );
        $flip_v = ! empty( sanitize_text_field( wp_unslash( $_POST['flip_v'] ?? '' ) ) );
        if ( $flip_h || $flip_v ) {
            $result = $editor->flip( $flip_h, $flip_v );
            if ( is_wp_error( $result ) ) {
                wp_send_json_error( array( 'message' => $result->get_error_message() ), 500 );
            }
        }

        $quality = min( 100, max( 40, absint( wp_unslash( $_POST['quality'] ?? 82 ) ) ) );
        $editor->set_quality( $quality );

        $requested_format = sanitize_text_field( wp_unslash( $_POST['format'] ?? 'original' ) );
        if ( ! in_array( $requested_format, array( 'original', 'auto' ), true ) ) {
            $requested_format = 'auto';
        }
        $source_mime = (string) ( $source['data']['mime'] ?? get_post_mime_type( $attachment_id ) );
        if ( 'auto' === $requested_format ) {
            $target_mime = $this->best_web_mime( $source_mime );
        } else {
            $target_mime = 'original' === $requested_format ? $source_mime : $requested_format;
        }
        $allowed_mimes = array( 'image/jpeg', 'image/png', 'image/webp', 'image/avif' );
        if ( 'image/avif' === $target_mime && version_compare( get_bloginfo( 'version' ), '6.5', '<' ) ) {
            wp_send_json_error( array( 'message' => __( 'AVIF output requires WordPress 6.5 or newer.', 'simme-media-organiser' ) ), 400 );
        }
        if ( ! in_array( $target_mime, $allowed_mimes, true ) ) {
            wp_send_json_error( array( 'message' => __( 'That output format is not supported by Image Studio.', 'simme-media-organiser' ) ), 400 );
        }
        if ( ! wp_image_editor_supports( array( 'mime_type' => $target_mime ) ) ) {
            wp_send_json_error( array( 'message' => __( 'Your server image library cannot save that format.', 'simme-media-organiser' ) ), 400 );
        }

        $extension_map = array(
            'image/jpeg' => 'jpg',
            'image/png'  => 'png',
            'image/webp' => 'webp',
            'image/avif' => 'avif',
        );
        $extension = $extension_map[ $target_mime ];
        $dir = $this->version_dir( $attachment_id );
        if ( is_wp_error( $dir ) ) {
            wp_send_json_error( array( 'message' => $dir->get_error_message() ), 500 );
        }

        $label = sanitize_text_field( wp_unslash( $_POST['label'] ?? '' ) );
        if ( '' === $label ) {
            $label = __( 'Working Version', 'simme-media-organiser' );
        }
        $label = substr( $label, 0, 80 );

        // Version files live in an attachment-ID directory, so they do not need
        // to repeat the original filename or accumulate timestamp suffixes. Keep
        // public URLs short, readable and stable-looking while still unique.
        $version_number = count( $existing_versions ) + 1;
        $label_slug = sanitize_title( $label );
        $friendly_slugs = array(
            'website-version'   => 'web',
            'website-optimised' => 'web',
            'website-optimized' => 'web',
            'mobile-version'    => 'mobile',
            'mobile-crop'       => 'mobile',
            'square'            => 'square',
            'hero'              => 'hero',
            'thumbnail'         => 'thumb',
        );
        if ( isset( $friendly_slugs[ $label_slug ] ) ) {
            $label_slug = $friendly_slugs[ $label_slug ];
        }
        $label_slug = substr( $label_slug ?: 'version', 0, 24 );
        $file_prefix = $edit_version_id ? sprintf( 'reedit-%s', substr( sanitize_key( $edit_version_id ), -8 ) ) : sprintf( 'v%02d', $version_number );
        $filename = wp_unique_filename( $dir, sprintf( '%s-%s.%s', $file_prefix, $label_slug, $extension ) );
        $destination = trailingslashit( $dir ) . $filename;
        $saved = $editor->save( $destination, $target_mime );
        if ( is_wp_error( $saved ) ) {
            wp_send_json_error( array( 'message' => $saved->get_error_message() ), 500 );
        }
        $saved_path = wp_normalize_path( $saved['path'] ?? $destination );
        if ( ! file_exists( $saved_path ) ) {
            wp_send_json_error( array( 'message' => __( 'Image Studio could not verify the newly-created version.', 'simme-media-organiser' ) ), 500 );
        }

        $upload = $this->uploads();
        if ( is_wp_error( $upload ) ) {
            wp_delete_file( $saved_path );
            wp_send_json_error( array( 'message' => $upload->get_error_message() ), 500 );
        }
        $base_dir = trailingslashit( wp_normalize_path( $upload['basedir'] ) );
        if ( 0 !== strpos( $saved_path, $base_dir ) ) {
            wp_delete_file( $saved_path );
            wp_send_json_error( array( 'message' => __( 'Image Studio refused to save outside WordPress uploads.', 'simme-media-organiser' ) ), 500 );
        }
        $relative = ltrim( substr( $saved_path, strlen( $base_dir ) ), '/' );

        $version_id = $edit_version_id ? $edit_version_id : 'v-' . substr( str_replace( '-', '', wp_generate_uuid4() ), 0, 12 );
        $crop_ratio = sanitize_text_field( wp_unslash( $_POST['crop_ratio'] ?? 'free' ) );
        $transparency_bg = sanitize_key( wp_unslash( $_POST['transparency_bg'] ?? 'checker' ) );
        if ( ! in_array( $transparency_bg, array( 'checker', 'dark', 'light' ), true ) ) {
            $transparency_bg = 'checker';
        }
        $social_crop = $this->social_crop_recipe_from_request();
        $edit_recipe = array(
            'schema'          => $social_crop ? 2 : 1,
            'source_id'       => 'master',
            'crop'            => $did_crop ? array( 'x' => $crop_x, 'y' => $crop_y, 'width' => $crop_w, 'height' => $crop_h ) : null,
            'crop_mode'       => $did_crop,
            'crop_ratio'      => $crop_ratio ?: 'free',
            'resize'          => array( 'width' => $resize_w ?: (int) ( $saved['width'] ?? 0 ), 'height' => $resize_h ?: (int) ( $saved['height'] ?? 0 ) ),
            'lock_ratio'      => ! empty( sanitize_text_field( wp_unslash( $_POST['lock_ratio'] ?? '' ) ) ),
            'rotation'        => $rotation,
            'flip_h'          => $flip_h,
            'flip_v'          => $flip_v,
            'format'          => $target_mime,
            'quality'         => $quality,
            'label'           => $label,
            'transparency_bg' => $transparency_bg,
            'social_crop'     => $social_crop,
        );
        $version = array(
            'id'            => $version_id,
            'label'         => $label,
            'relative_path' => $relative,
            'filename'      => wp_basename( $saved_path ),
            'mime'          => (string) ( $saved['mime-type'] ?? $target_mime ),
            'width'         => (int) ( $saved['width'] ?? 0 ),
            'height'        => (int) ( $saved['height'] ?? 0 ),
            'size_bytes'    => (int) filesize( $saved_path ),
            'checksum'      => hash_file( 'sha256', $saved_path ),
            'created_at'    => $edit_version_id ? (string) ( $edit_version['created_at'] ?? gmdate( 'c' ) ) : gmdate( 'c' ),
            'updated_at'    => $edit_version_id ? gmdate( 'c' ) : '',
            'revision'      => $edit_version_id ? max( 2, (int) ( $edit_version['revision'] ?? 1 ) + 1 ) : 1,
            'source'        => 'master',
            'transform'     => array(
                'crop'     => $edit_recipe['crop'],
                'resize'   => $did_resize ? array( 'width' => $resize_w, 'height' => $resize_h ) : null,
                'rotation' => $rotation,
                'flip_h'   => $flip_h,
                'flip_v'   => $flip_v,
                'quality'  => $quality,
                'format'   => $target_mime,
            ),
            'edit_recipe'   => $edit_recipe,
        );

        $versions = $existing_versions;
        $old_path = '';
        $was_active = false;
        if ( $edit_version_id ) {
            $old_path = $this->absolute_from_relative( $edit_version['relative_path'] ?? '' );
            $was_active = (string) get_post_meta( $attachment_id, self::ACTIVE_META, true ) === $edit_version_id;
            $versions[ $edit_index ] = $version;
        } else {
            $versions[] = $version;
        }
        $this->save_versions( $attachment_id, $versions );

        if ( ! empty( sanitize_text_field( wp_unslash( $_POST['make_preferred'] ?? '' ) ) ) ) {
            update_post_meta( $attachment_id, self::PREFERRED_META, $version_id );
        } elseif ( $edit_version_id && (string) get_post_meta( $attachment_id, self::PREFERRED_META, true ) === $version_id ) {
            update_post_meta( $attachment_id, self::PREFERRED_META, 'master' );
        }

        if ( $was_active ) {
            update_post_meta( $attachment_id, '_wp_attached_file', $relative );
            wp_update_post( array( 'ID' => $attachment_id, 'post_mime_type' => $version['mime'] ) );
            $metadata = wp_generate_attachment_metadata( $attachment_id, $saved_path );
            if ( is_array( $metadata ) ) {
                wp_update_attachment_metadata( $attachment_id, $metadata );
                $versions = $this->versions( $attachment_id );
                list( $active_index ) = $this->find_version( $versions, $version_id );
                if ( $active_index >= 0 ) {
                    $versions[ $active_index ]['wp_metadata'] = $metadata;
                    $this->save_versions( $attachment_id, $versions );
                }
            }
        }
        if ( $edit_version_id && $old_path && wp_normalize_path( $old_path ) !== wp_normalize_path( $saved_path ) && file_exists( $old_path ) ) {
            wp_delete_file( $old_path );
        }

        if ( $edit_version_id ) {
            /* translators: %s: Image Studio working-version label. */
            $this->log( $attachment_id, 'version_reedited', sprintf( __( 'Re-edited Image Studio version “%s” from the protected master.', 'simme-media-organiser' ), $label ), array( 'version_id' => $version_id, 'revision' => $version['revision'] ) );
            /* translators: %s: Image Studio working-version label. */
            $this->refresh_media_intelligence( $attachment_id, 'studio_version_reedited', sprintf( __( 'Re-edited Image Studio version “%s”', 'simme-media-organiser' ), $label ), array( 'version_id' => $version_id ) );
        } else {
            /* translators: %s: Image Studio working-version label. */
            $this->log( $attachment_id, 'version_created', sprintf( __( 'Created Image Studio version “%s”.', 'simme-media-organiser' ), $label ), array( 'version_id' => $version_id ) );
            /* translators: %s: Image Studio working-version label. */
            $this->refresh_media_intelligence( $attachment_id, 'studio_version_created', sprintf( __( 'Created Image Studio version “%s”', 'simme-media-organiser' ), $label ), array( 'version_id' => $version_id ) );
        }

        $payload = $this->studio_payload( $attachment_id );
        if ( is_wp_error( $payload ) ) {
            wp_send_json_error( array( 'message' => $payload->get_error_message() ), 500 );
        }
        $payload['createdVersionId'] = $edit_version_id ? '' : $version_id;
        $payload['reeditedVersionId'] = $edit_version_id ? $version_id : '';
        $payload['resetToMaster'] = true;
        wp_send_json_success( $payload );
    }







    public function set_preferred() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $attachment_id = $this->guard( absint( wp_unslash( $_POST['id'] ?? 0 ) ) );
        $version_id = sanitize_text_field( wp_unslash( $_POST['version_id'] ?? 'master' ) );
        if ( 'master' !== $version_id ) {
            list( , $version ) = $this->find_version( $this->versions( $attachment_id ), $version_id );
            if ( ! $version ) {
                wp_send_json_error( array( 'message' => __( 'That version no longer exists.', 'simme-media-organiser' ) ), 404 );
            }
        }
        $before_state = $this->studio_state_snapshot( $attachment_id );
        update_post_meta( $attachment_id, self::PREFERRED_META, $version_id );
        $after_state = $this->studio_state_snapshot( $attachment_id );
        $summary = 'master' === $version_id ? __( 'Set Master Original as Studio default', 'simme-media-organiser' ) : __( 'Set working version as Studio default', 'simme-media-organiser' );
        $this->record_state_transition( $attachment_id, $before_state, $after_state, $summary );
        $this->log( $attachment_id, 'preferred_changed', 'master' === $version_id ? __( 'Master Original set as the Studio default.', 'simme-media-organiser' ) : __( 'Working version set as the Studio default.', 'simme-media-organiser' ), array( 'version_id' => $version_id ) );
        $this->refresh_media_intelligence( $attachment_id, 'studio_preferred', __( 'Changed Image Studio default source', 'simme-media-organiser' ), array( 'version_id' => $version_id ) );
        wp_send_json_success( $this->studio_payload( $attachment_id ) );
    }

    public function publish_version() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $attachment_id = $this->guard( absint( wp_unslash( $_POST['id'] ?? 0 ) ) );
        $version_id = sanitize_text_field( wp_unslash( $_POST['version_id'] ?? '' ) );
        $master = $this->capture_master( $attachment_id );
        if ( is_wp_error( $master ) ) {
            wp_send_json_error( array( 'message' => $master->get_error_message() ), 400 );
        }
        $versions = $this->versions( $attachment_id );
        list( $index, $version ) = $this->find_version( $versions, $version_id );
        if ( ! $version ) {
            wp_send_json_error( array( 'message' => __( 'That working version no longer exists.', 'simme-media-organiser' ) ), 404 );
        }
        $path = $this->absolute_from_relative( $version['relative_path'] ?? '' );
        if ( ! $path || ! file_exists( $path ) ) {
            wp_send_json_error( array( 'message' => __( 'The working version file is missing.', 'simme-media-organiser' ) ), 404 );
        }
        $before_state = $this->studio_state_snapshot( $attachment_id, $master, $versions );

        $metadata = $this->switch_wordpress_attachment_source(
            $attachment_id,
            $version['relative_path'],
            $version['mime'],
            $path,
            null,
            true
        );
        if ( is_wp_error( $metadata ) ) {
            wp_send_json_error( array( 'message' => $metadata->get_error_message() ), 500 );
        }
        $versions[ $index ]['wp_metadata'] = $metadata;
        $this->save_versions( $attachment_id, $versions );
        update_post_meta( $attachment_id, self::ACTIVE_META, $version_id );
        update_post_meta( $attachment_id, self::PREFERRED_META, $version_id );
        $after_state = $this->studio_state_snapshot( $attachment_id, $master, $versions );
        /* translators: %s: Image Studio working-version label. */
        $this->record_state_transition( $attachment_id, $before_state, $after_state, sprintf( __( 'Publish “%s” to WordPress', 'simme-media-organiser' ), $version['label'] ) );
        /* translators: %s: Image Studio working-version label. */
        $this->log( $attachment_id, 'version_published', sprintf( __( 'Published “%s” as the active WordPress image. The protected master was retained.', 'simme-media-organiser' ), $version['label'] ), array( 'version_id' => $version_id ) );
        /* translators: %s: Image Studio working-version label. */
        $this->refresh_media_intelligence( $attachment_id, 'studio_published', sprintf( __( 'Published Image Studio version “%s”', 'simme-media-organiser' ), $version['label'] ), array( 'version_id' => $version_id ) );
        wp_send_json_success( $this->studio_payload( $attachment_id ) );
    }

    public function restore_master() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $attachment_id = $this->guard( absint( wp_unslash( $_POST['id'] ?? 0 ) ) );
        $master = $this->capture_master( $attachment_id );
        if ( is_wp_error( $master ) ) {
            wp_send_json_error( array( 'message' => $master->get_error_message() ), 400 );
        }
        $path = $this->absolute_from_relative( $master['relative_path'] ?? '' );
        if ( ! $path || ! file_exists( $path ) ) {
            wp_send_json_error( array( 'message' => __( 'The protected master file is missing, so it cannot be restored.', 'simme-media-organiser' ) ), 404 );
        }
        $versions = $this->versions( $attachment_id );
        $before_state = $this->studio_state_snapshot( $attachment_id, $master, $versions );

        $saved_master_metadata = isset( $master['wp_metadata'] ) && is_array( $master['wp_metadata'] ) ? $master['wp_metadata'] : array();
        $needs_regeneration = ! empty( $master['needs_metadata_regeneration'] ) || ! $saved_master_metadata;
        $metadata = $this->switch_wordpress_attachment_source(
            $attachment_id,
            $master['relative_path'],
            $master['mime'],
            $path,
            $saved_master_metadata,
            $needs_regeneration
        );
        if ( is_wp_error( $metadata ) ) {
            wp_send_json_error( array( 'message' => $metadata->get_error_message() ), 500 );
        }
        if ( $needs_regeneration ) {
            $master['wp_metadata'] = $metadata;
            $master['needs_metadata_regeneration'] = false;
            update_post_meta( $attachment_id, self::MASTER_META, $master );
        }
        if ( array_key_exists( 'backup_sizes', $master ) ) {
            update_post_meta( $attachment_id, '_wp_attachment_backup_sizes', $master['backup_sizes'] );
        }
        delete_post_meta( $attachment_id, self::ACTIVE_META );
        update_post_meta( $attachment_id, self::PREFERRED_META, 'master' );
        $after_state = $this->studio_state_snapshot( $attachment_id, $master, $versions );
        $this->record_state_transition( $attachment_id, $before_state, $after_state, __( 'Restore Master Original to WordPress', 'simme-media-organiser' ) );
        $this->log( $attachment_id, 'master_restored', __( 'Protected master restored as the active WordPress image.', 'simme-media-organiser' ) );
        $this->refresh_media_intelligence( $attachment_id, 'studio_master_restored', __( 'Restored protected Image Studio master', 'simme-media-organiser' ) );
        wp_send_json_success( $this->studio_payload( $attachment_id ) );
    }

    public function undo_state() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $attachment_id = $this->guard( absint( wp_unslash( $_POST['id'] ?? 0 ) ) );
        $history = $this->state_history( $attachment_id );
        if ( empty( $history['undo'] ) ) {
            wp_send_json_error( array( 'message' => __( 'There is no Image Studio version choice to undo.', 'simme-media-organiser' ) ), 400 );
        }
        $operation = end( $history['undo'] );
        $result = $this->apply_studio_state( $attachment_id, $operation['before'] ?? array() );
        if ( is_wp_error( $result ) ) {
            wp_send_json_error( array( 'message' => $result->get_error_message() ), 500 );
        }
        array_pop( $history['undo'] );
        $history['redo'][] = $operation;
        $this->save_state_history( $attachment_id, $history );
        $summary = (string) ( $operation['summary'] ?? __( 'version choice', 'simme-media-organiser' ) );
        /* translators: %s: description of the Image Studio version-state choice being undone. */
        $this->log( $attachment_id, 'version_state_undone', sprintf( __( 'Undid Image Studio choice: %s.', 'simme-media-organiser' ), $summary ) );
        /* translators: %s: description of the Image Studio version-state choice being undone. */
        $this->refresh_media_intelligence( $attachment_id, 'studio_state_undone', sprintf( __( 'Undid Image Studio choice: %s', 'simme-media-organiser' ), $summary ) );
        $payload = $this->studio_payload( $attachment_id );
        if ( is_wp_error( $payload ) ) {
            wp_send_json_error( array( 'message' => $payload->get_error_message() ), 500 );
        }
        /* translators: %s: description of the Image Studio version-state choice that was undone. */
        $payload['stateHistoryMessage'] = sprintf( __( 'Undone: %s.', 'simme-media-organiser' ), $summary );
        wp_send_json_success( $payload );
    }

    public function redo_state() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $attachment_id = $this->guard( absint( wp_unslash( $_POST['id'] ?? 0 ) ) );
        $history = $this->state_history( $attachment_id );
        if ( empty( $history['redo'] ) ) {
            wp_send_json_error( array( 'message' => __( 'There is no Image Studio version choice to redo.', 'simme-media-organiser' ) ), 400 );
        }
        $operation = end( $history['redo'] );
        $result = $this->apply_studio_state( $attachment_id, $operation['after'] ?? array() );
        if ( is_wp_error( $result ) ) {
            wp_send_json_error( array( 'message' => $result->get_error_message() ), 500 );
        }
        array_pop( $history['redo'] );
        $history['undo'][] = $operation;
        $this->save_state_history( $attachment_id, $history );
        $summary = (string) ( $operation['summary'] ?? __( 'version choice', 'simme-media-organiser' ) );
        /* translators: %s: description of the Image Studio version-state choice being redone. */
        $this->log( $attachment_id, 'version_state_redone', sprintf( __( 'Redid Image Studio choice: %s.', 'simme-media-organiser' ), $summary ) );
        /* translators: %s: description of the Image Studio version-state choice being redone. */
        $this->refresh_media_intelligence( $attachment_id, 'studio_state_redone', sprintf( __( 'Redid Image Studio choice: %s', 'simme-media-organiser' ), $summary ) );
        $payload = $this->studio_payload( $attachment_id );
        if ( is_wp_error( $payload ) ) {
            wp_send_json_error( array( 'message' => $payload->get_error_message() ), 500 );
        }
        /* translators: %s: description of the Image Studio version-state choice that was redone. */
        $payload['stateHistoryMessage'] = sprintf( __( 'Redone: %s.', 'simme-media-organiser' ), $summary );
        wp_send_json_success( $payload );
    }

    public function delete_version() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $attachment_id = $this->guard( absint( wp_unslash( $_POST['id'] ?? 0 ) ) );
        $version_id = sanitize_text_field( wp_unslash( $_POST['version_id'] ?? '' ) );
        if ( ! $version_id ) {
            wp_send_json_error( array( 'message' => __( 'No version was selected.', 'simme-media-organiser' ) ), 400 );
        }
        if ( (string) get_post_meta( $attachment_id, self::ACTIVE_META, true ) === $version_id ) {
            wp_send_json_error( array( 'message' => __( 'That version is currently active in WordPress. Restore the master or publish another version before deleting it.', 'simme-media-organiser' ) ), 400 );
        }

        $versions = $this->versions( $attachment_id );
        list( $index, $version ) = $this->find_version( $versions, $version_id );
        if ( ! $version ) {
            wp_send_json_error( array( 'message' => __( 'That version no longer exists.', 'simme-media-organiser' ) ), 404 );
        }
        $path = $this->absolute_from_relative( $version['relative_path'] ?? '' );
        if ( $path && file_exists( $path ) ) {
            wp_delete_file( $path );
        }
        if ( ! empty( $version['wp_metadata']['sizes'] ) && is_array( $version['wp_metadata']['sizes'] ) && $path ) {
            foreach ( $version['wp_metadata']['sizes'] as $size ) {
                if ( empty( $size['file'] ) ) {
                    continue;
                }
                $sub = trailingslashit( dirname( $path ) ) . wp_basename( $size['file'] );
                if ( file_exists( $sub ) ) {
                    wp_delete_file( $sub );
                }
            }
        }
        array_splice( $versions, $index, 1 );
        $this->save_versions( $attachment_id, $versions );
        // Deleting a physical version can invalidate older state snapshots, so
        // deliberately reset the scoped version-choice Undo/Redo timeline.
        delete_post_meta( $attachment_id, self::STATE_HISTORY_META );
        if ( (string) get_post_meta( $attachment_id, self::PREFERRED_META, true ) === $version_id ) {
            update_post_meta( $attachment_id, self::PREFERRED_META, 'master' );
        }
        /* translators: %s: deleted Image Studio working-version label. */
        $this->log( $attachment_id, 'version_deleted', sprintf( __( 'Deleted working version “%s”. The protected master was untouched.', 'simme-media-organiser' ), $version['label'] ), array( 'version_id' => $version_id ) );
        /* translators: %s: deleted Image Studio working-version label. */
        $this->refresh_media_intelligence( $attachment_id, 'studio_version_deleted', sprintf( __( 'Deleted Image Studio version “%s”', 'simme-media-organiser' ), $version['label'] ), array( 'version_id' => $version_id ) );
        wp_send_json_success( $this->studio_payload( $attachment_id ) );
    }
}
