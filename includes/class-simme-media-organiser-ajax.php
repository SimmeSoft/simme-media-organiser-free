<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Simme_Media_Organiser_Ajax {
    public function __construct() {
        $actions = array(
            'simme_media_organiser_list_media'       => 'list_media',
            'simme_media_organiser_create_folder'    => 'create_folder',
            'simme_media_organiser_update_folder'    => 'update_folder',
            'simme_media_organiser_delete_folder'    => 'delete_folder',
            'simme_media_organiser_move_folder'      => 'move_folder',
            'simme_media_organiser_move_media'       => 'move_media',
            'simme_media_organiser_toggle_favourite' => 'toggle_favourite',
            'simme_media_organiser_save_media'       => 'save_media',
            'simme_media_organiser_save_alt'         => 'save_alt',
            'simme_media_organiser_upload_media'     => 'upload_media',
            'simme_media_organiser_get_folders'      => 'get_folders',
            'simme_media_organiser_save_media_order' => 'save_media_order',
            'simme_media_organiser_reset_media_order' => 'reset_media_order',
        );

        foreach ( $actions as $action => $method ) {
            add_action( 'wp_ajax_' . $action, array( $this, $method ) );
        }
    }

    private function guard() {
        Simme_Media_Organiser_Plugin::require_capability();
    }

    public function get_folders() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $this->guard();
        wp_send_json_success( array( 'folders' => Simme_Media_Organiser_Plugin::folder_terms_tree() ) );
    }

    private function custom_order_key( $folder ) {
        $folder = (string) $folder;
        if ( ctype_digit( $folder ) && absint( $folder ) ) {
            return 'folder:' . absint( $folder );
        }
        if ( in_array( $folder, array( 'all', 'unfiled' ), true ) ) {
            return $folder;
        }
        return '';
    }

    private function get_custom_orders() {
        $orders = get_user_meta( get_current_user_id(), '_smo_media_custom_orders', true );
        return is_array( $orders ) ? $orders : array();
    }

    private function get_custom_order_for_view( $folder ) {
        $key = $this->custom_order_key( $folder );
        if ( ! $key ) {
            return array();
        }
        $orders = $this->get_custom_orders();
        $order = isset( $orders[ $key ] ) && is_array( $orders[ $key ] ) ? $orders[ $key ] : array();
        return array_values( array_unique( array_filter( array_map( 'absint', $order ) ) ) );
    }

    private function base_ids_for_order_view( $folder ) {
        $args = array(
            'post_type'      => 'attachment',
            'post_status'    => 'inherit',
            'posts_per_page' => -1,
            'fields'         => 'ids',
            'orderby'        => 'date',
            'order'          => 'DESC',
            'no_found_rows'  => true,
        );
        if ( class_exists( 'Simme_Media_Organiser_Trash' ) ) {
            $args['meta_query'] = array(
                array(
                    'key'     => Simme_Media_Organiser_Trash::META_KEY,
                    'compare' => 'NOT EXISTS',
                ),
            );
        }
        if ( 'unfiled' === (string) $folder ) {
            $args['tax_query'] = array(
                array(
                    'taxonomy' => SIMME_MEDIA_ORGANISER_TAXONOMY,
                    'operator' => 'NOT EXISTS',
                ),
            );
        } elseif ( ctype_digit( (string) $folder ) && absint( $folder ) ) {
            $args['tax_query'] = array(
                array(
                    'taxonomy'         => SIMME_MEDIA_ORGANISER_TAXONOMY,
                    'field'            => 'term_id',
                    'terms'            => array( absint( $folder ) ),
                    'include_children' => true,
                ),
            );
        }
        return array_values( array_map( 'absint', get_posts( $args ) ) );
    }

    public function save_media_order() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $this->guard();
        $folder = sanitize_text_field( wp_unslash( $_POST['folder'] ?? '' ) );
        $key = $this->custom_order_key( $folder );
        if ( ! $key ) {
            wp_send_json_error( array( 'message' => __( 'Open All Media, Unfiled or a virtual folder before arranging media.', 'simme-media-organiser' ) ), 400 );
        }
        $moved_id = absint( wp_unslash( $_POST['moved_id'] ?? 0 ) );
        $target_id = absint( wp_unslash( $_POST['target_id'] ?? 0 ) );
        $placement = sanitize_key( wp_unslash( $_POST['placement'] ?? 'before' ) );
        if ( ! $moved_id || ! $target_id || $moved_id === $target_id || ! in_array( $placement, array( 'before', 'after' ), true ) ) {
            wp_send_json_error( array( 'message' => __( 'That media position could not be saved.', 'simme-media-organiser' ) ), 400 );
        }

        $base_ids = $this->base_ids_for_order_view( $folder );
        if ( ! in_array( $moved_id, $base_ids, true ) || ! in_array( $target_id, $base_ids, true ) ) {
            wp_send_json_error( array( 'message' => __( 'The dragged media is no longer available in this folder.', 'simme-media-organiser' ) ), 409 );
        }

        $orders = $this->get_custom_orders();
        $existing = isset( $orders[ $key ] ) && is_array( $orders[ $key ] ) ? array_values( array_unique( array_filter( array_map( 'absint', $orders[ $key ] ) ) ) ) : array();
        $base_lookup = array_fill_keys( $base_ids, true );
        $order = array_values( array_filter( $existing, static function ( $id ) use ( $base_lookup ) {
            return isset( $base_lookup[ $id ] );
        } ) );
        $seen = array_fill_keys( $order, true );
        foreach ( $base_ids as $id ) {
            if ( ! isset( $seen[ $id ] ) ) {
                $order[] = $id;
                $seen[ $id ] = true;
            }
        }

        $order = array_values( array_diff( $order, array( $moved_id ) ) );
        $target_index = array_search( $target_id, $order, true );
        if ( false === $target_index ) {
            wp_send_json_error( array( 'message' => __( 'The drop target could not be found.', 'simme-media-organiser' ) ), 409 );
        }
        $insert_at = 'after' === $placement ? $target_index + 1 : $target_index;
        array_splice( $order, $insert_at, 0, array( $moved_id ) );

        $before_order = $existing;
        $orders[ $key ] = array_values( $order );
        update_user_meta( get_current_user_id(), '_smo_media_custom_orders', $orders );
        if ( class_exists( 'Simme_Media_Organiser_Audit' ) && $before_order !== $orders[ $key ] ) {
            Simme_Media_Organiser_Audit::log_action( 'custom_order', __( 'Repositioned media cards', 'simme-media-organiser' ), 0, array( 'order_key' => $key, 'before' => $before_order, 'after' => $orders[ $key ] ), true );
        }
        wp_send_json_success( array( 'customPositioning' => true, 'count' => count( $order ) ) );
    }

    public function reset_media_order() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $this->guard();
        $folder = sanitize_text_field( wp_unslash( $_POST['folder'] ?? '' ) );
        $key = $this->custom_order_key( $folder );
        if ( ! $key ) {
            wp_send_json_error( array( 'message' => __( 'This view does not have removable custom positioning.', 'simme-media-organiser' ) ), 400 );
        }
        $orders = $this->get_custom_orders();
        $before_order = isset( $orders[ $key ] ) && is_array( $orders[ $key ] ) ? array_values( array_map( 'absint', $orders[ $key ] ) ) : array();
        unset( $orders[ $key ] );
        if ( $orders ) {
            update_user_meta( get_current_user_id(), '_smo_media_custom_orders', $orders );
        } else {
            delete_user_meta( get_current_user_id(), '_smo_media_custom_orders' );
        }
        if ( class_exists( 'Simme_Media_Organiser_Audit' ) && $before_order ) {
            Simme_Media_Organiser_Audit::log_action( 'custom_order', __( 'Removed custom media positioning', 'simme-media-organiser' ), 0, array( 'order_key' => $key, 'before' => $before_order, 'after' => array() ), true );
        }
        wp_send_json_success( array( 'customPositioning' => false ) );
    }

    public function list_media() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $this->guard();

        $settings = Simme_Media_Organiser_Plugin::get_settings();
        $page = max( 1, absint( wp_unslash( $_POST['page'] ?? 1 ) ) );
        $per_page = min( 120, max( 12, absint( wp_unslash( $_POST['per_page'] ?? $settings['items_per_page'] ) ) ) );
        $search = sanitize_text_field( wp_unslash( $_POST['search'] ?? '' ) );
        $folder = sanitize_text_field( wp_unslash( $_POST['folder'] ?? 'all' ) );
        $type = sanitize_key( wp_unslash( $_POST['type'] ?? 'all' ) );
        $alt = sanitize_key( wp_unslash( $_POST['alt'] ?? 'all' ) );
        $sort = sanitize_key( wp_unslash( $_POST['sort'] ?? 'date_desc' ) );
        $favourite_only = ! empty( sanitize_text_field( wp_unslash( $_POST['favourite_only'] ?? '' ) ) );
        $custom_order_key = $this->custom_order_key( $folder );
        $custom_order = $custom_order_key ? $this->get_custom_order_for_view( $folder ) : array();
        $custom_positioning = ! empty( $custom_order );
        $prefer_custom = ! empty( sanitize_text_field( wp_unslash( $_POST['prefer_custom'] ?? '' ) ) );
        $use_custom_order = $custom_positioning && ( 'custom' === $sort || $prefer_custom );
        $effective_sort = $use_custom_order ? 'custom' : ( 'custom' === $sort ? 'date_desc' : $sort );

        $args = array(
            'post_type'      => 'attachment',
            'post_status'    => 'inherit',
            'posts_per_page' => $per_page,
            'paged'          => $page,
            's'              => $search,
        );

        if ( 0 === strpos( $folder, 'smart-' ) && class_exists( 'Simme_Media_Organiser_Audit' ) ) {
            $smart_ids = Simme_Media_Organiser_Audit::ids_for_smart_view( $folder );
            $args['post__in'] = $smart_ids ? $smart_ids : array( 0 );
        }

        switch ( $sort ) {
            case 'date_asc':
                $args['orderby'] = 'date';
                $args['order'] = 'ASC';
                break;
            case 'title_asc':
                $args['orderby'] = 'title';
                $args['order'] = 'ASC';
                break;
            case 'title_desc':
                $args['orderby'] = 'title';
                $args['order'] = 'DESC';
                break;
            case 'date_desc':
            default:
                $args['orderby'] = 'date';
                $args['order'] = 'DESC';
                break;
        }

        if ( 'missing-alt' === $folder ) {
            $args['post_mime_type'] = 'image';
        } elseif ( 'image' === $type ) {
            $args['post_mime_type'] = 'image';
        } elseif ( 'audio' === $type ) {
            $args['post_mime_type'] = 'audio';
        } elseif ( 'video' === $type ) {
            $args['post_mime_type'] = 'video';
        } elseif ( 'document' === $type ) {
            $args['post_mime_type'] = array(
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'text/csv',
                'application/csv',
                'application/vnd.ms-powerpoint',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                'application/zip',
                'application/x-zip-compressed',
                'application/x-rar-compressed',
                'application/x-7z-compressed',
                'text/plain',
                'application/json',
            );
        } else {
            $exact_type_mimes = array(
                'ext-jpg'         => array( 'image/jpeg' ),
                'ext-png'         => array( 'image/png' ),
                'ext-webp'        => array( 'image/webp' ),
                'ext-gif'         => array( 'image/gif' ),
                'ext-svg'         => array( 'image/svg+xml' ),
                'ext-avif'        => array( 'image/avif' ),
                'ext-pdf'         => array( 'application/pdf' ),
                'ext-doc'         => array( 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ),
                'ext-sheet'       => array( 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', 'application/csv' ),
                'ext-slides'      => array( 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ),
                'ext-archive'     => array( 'application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed', 'application/x-7z-compressed', 'application/gzip', 'application/x-tar' ),
                'ext-mp3'         => array( 'audio/mpeg', 'audio/mp3' ),
                'ext-audio-other' => array( 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/flac', 'audio/ogg' ),
                'ext-mp4'         => array( 'video/mp4' ),
                'ext-video-other' => array( 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/x-m4v' ),
            );
            if ( isset( $exact_type_mimes[ $type ] ) ) {
                $args['post_mime_type'] = $exact_type_mimes[ $type ];
            }
        }

        $tax_query = array();
        if ( 'unfiled' === $folder ) {
            $tax_query[] = array(
                'taxonomy' => SIMME_MEDIA_ORGANISER_TAXONOMY,
                'operator' => 'NOT EXISTS',
            );
        } elseif ( ctype_digit( (string) $folder ) && absint( $folder ) ) {
            $tax_query[] = array(
                'taxonomy'         => SIMME_MEDIA_ORGANISER_TAXONOMY,
                'field'            => 'term_id',
                'terms'            => array( absint( $folder ) ),
                'include_children' => true,
            );
        }
        if ( $tax_query ) {
            $args['tax_query'] = $tax_query; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query
        }

        $meta_query = array();
        if ( class_exists( 'Simme_Media_Organiser_Trash' ) ) {
            if ( 'trash' === $folder ) {
                $meta_query[] = array(
                    'key'     => Simme_Media_Organiser_Trash::META_KEY,
                    'compare' => 'EXISTS',
                );
            } else {
                $meta_query[] = array(
                    'key'     => Simme_Media_Organiser_Trash::META_KEY,
                    'compare' => 'NOT EXISTS',
                );
            }
        }
        if ( 'favourites' === $folder || $favourite_only ) {
            $meta_query[] = array(
                'key'   => '_smo_favourite',
                'value' => '1',
            );
        }
        if ( 'missing-alt' === $folder || 'missing' === $alt ) {
            $meta_query[] = array(
                'relation' => 'OR',
                array(
                    'key'     => '_wp_attachment_image_alt',
                    'compare' => 'NOT EXISTS',
                ),
                array(
                    'key'     => '_wp_attachment_image_alt',
                    'value'   => '',
                    'compare' => '=',
                ),
            );
        } elseif ( 'present' === $alt ) {
            $meta_query[] = array(
                'key'     => '_wp_attachment_image_alt',
                'value'   => '',
                'compare' => '!=',
            );
        }
        if ( $meta_query ) {
            $args['meta_query'] = $meta_query; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
        }

        if ( 'recent' === $folder ) {
            $args['date_query'] = array(
                array(
                    'after'     => '30 days ago',
                    'inclusive' => true,
                ),
            );
        }

        // WordPress core search does not include attachment alt text. Add a safe fallback
        // search pass when the title/filename search yields nothing. When a saved custom
        // layout is active we collect the matching IDs first, keep their saved relative
        // positions, then paginate that ordered list. Filters therefore never destroy the
        // user's underlying folder arrangement.
        $query_posts = array();
        $found_posts = 0;
        $max_num_pages = 1;
        if ( $use_custom_order ) {
            $id_args = $args;
            $id_args['posts_per_page'] = -1;
            $id_args['paged'] = 1;
            $id_args['fields'] = 'ids';
            $id_args['no_found_rows'] = true;
            $id_query = new WP_Query( $id_args );
            $matching_ids = array_values( array_map( 'absint', $id_query->posts ) );
            if ( $search && ! $matching_ids ) {
                $ids = $this->find_attachment_ids_by_meta_text( $search );
                if ( $ids ) {
                    unset( $id_args['s'] );
                    if ( isset( $id_args['post__in'] ) ) {
                        $ids = array_values( array_intersect( array_map( 'absint', (array) $id_args['post__in'] ), array_map( 'absint', $ids ) ) );
                    }
                    $id_args['post__in'] = $ids ? $ids : array( 0 );
                    $id_query = new WP_Query( $id_args );
                    $matching_ids = array_values( array_map( 'absint', $id_query->posts ) );
                }
            }

            $saved_rank = array_flip( $custom_order );
            $baseline_rank = array_flip( $matching_ids );
            usort( $matching_ids, static function ( $a, $b ) use ( $saved_rank, $baseline_rank ) {
                $a_saved = array_key_exists( $a, $saved_rank );
                $b_saved = array_key_exists( $b, $saved_rank );
                if ( $a_saved && $b_saved ) {
                    return $saved_rank[ $a ] <=> $saved_rank[ $b ];
                }
                if ( $a_saved ) {
                    return -1;
                }
                if ( $b_saved ) {
                    return 1;
                }
                return ( $baseline_rank[ $a ] ?? PHP_INT_MAX ) <=> ( $baseline_rank[ $b ] ?? PHP_INT_MAX );
            } );

            $found_posts = count( $matching_ids );
            $max_num_pages = max( 1, (int) ceil( $found_posts / $per_page ) );
            if ( $page > $max_num_pages ) {
                $page = $max_num_pages;
            }
            $page_ids = array_slice( $matching_ids, ( $page - 1 ) * $per_page, $per_page );
            foreach ( $page_ids as $page_id ) {
                $attachment = get_post( $page_id );
                if ( $attachment instanceof WP_Post ) {
                    $query_posts[] = $attachment;
                }
            }
        } else {
            $query = new WP_Query( $args );
            if ( $search && 0 === (int) $query->found_posts ) {
                $ids = $this->find_attachment_ids_by_meta_text( $search );
                if ( $ids ) {
                    unset( $args['s'] );
                    if ( isset( $args['post__in'] ) ) {
                        $ids = array_values( array_intersect( array_map( 'absint', (array) $args['post__in'] ), array_map( 'absint', $ids ) ) );
                    }
                    $args['post__in'] = $ids ? $ids : array( 0 );
                    $query = new WP_Query( $args );
                }
            }
            $query_posts = $query->posts;
            $found_posts = (int) $query->found_posts;
            $max_num_pages = max( 1, (int) $query->max_num_pages );
        }

        $items = array();
        if ( class_exists( 'Simme_Media_Organiser_Audit' ) ) {
            Simme_Media_Organiser_Audit::prime_index_cache( wp_list_pluck( $query_posts, 'ID' ) );
        }
        foreach ( $query_posts as $attachment ) {
            $items[] = $this->format_attachment( $attachment );
        }

        wp_send_json_success(
            array(
                'items'       => $items,
                'total'       => (int) $found_posts,
                'page'        => $page,
                'pages'       => $max_num_pages,
                'stats'       => $this->summary_stats(),
                'folders'     => Simme_Media_Organiser_Plugin::folder_terms_tree(),
                'currentPath' => $this->view_label( $folder ),
                'favouriteOnly' => (bool) $favourite_only,
                'customPositioningEligible' => (bool) $custom_order_key,
                'customPositioning' => (bool) $custom_positioning,
                'effectiveSort' => $effective_sort,
            )
        );
    }

    private function find_attachment_ids_by_meta_text( $search ) {
        global $wpdb;
        $like = '%' . $wpdb->esc_like( $search ) . '%';
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Search spans attachment posts and ALT metadata; no equivalent cached core query covers all fields together.
        $rows = $wpdb->get_col(
            $wpdb->prepare(
                "SELECT DISTINCT p.ID
                 FROM %i p
                 LEFT JOIN %i pm ON p.ID = pm.post_id
                 WHERE p.post_type = %s
                   AND p.post_status = %s
                   AND (
                        pm.meta_key = %s AND pm.meta_value LIKE %s
                        OR p.post_excerpt LIKE %s
                        OR p.post_content LIKE %s
                   )
                 LIMIT 500",
                $wpdb->posts,
                $wpdb->postmeta,
                'attachment',
                'inherit',
                '_wp_attachment_image_alt',
                $like,
                $like,
                $like
            )
        );
        return array_map( 'absint', $rows ?: array() );
    }

    private function view_label( $folder ) {
        if ( ctype_digit( (string) $folder ) && absint( $folder ) ) {
            return Simme_Media_Organiser_Plugin::folder_path( absint( $folder ) );
        }
        $labels = array(
            'all'         => __( 'All Media', 'simme-media-organiser' ),
            'favourites'  => __( 'Favourites', 'simme-media-organiser' ),
            'recent'      => __( 'Recently Added', 'simme-media-organiser' ),
            'unfiled'     => __( 'Unfiled', 'simme-media-organiser' ),
            'missing-alt' => __( 'Missing Alt Text', 'simme-media-organiser' ),
            'smart-heavy'      => __( 'Heavy Media', 'simme-media-organiser' ),
            'smart-duplicates' => __( 'Exact Duplicates', 'simme-media-organiser' ),
            'smart-protected'  => __( 'Protected Assets', 'simme-media-organiser' ),
            'trash'            => __( 'Trash', 'simme-media-organiser' ),
            'smart-broken'     => __( 'Broken Media', 'simme-media-organiser' ),
            'smart-studio'     => __( 'Image Studio Assets', 'simme-media-organiser' ),
            'smart-large'      => __( 'Files Over 1 MB', 'simme-media-organiser' ),
        );
        return $labels[ $folder ] ?? __( 'All Media', 'simme-media-organiser' );
    }

    private function summary_stats() {
        $trash_exclusion = class_exists( 'Simme_Media_Organiser_Trash' ) ? array(
            array( 'key' => Simme_Media_Organiser_Trash::META_KEY, 'compare' => 'NOT EXISTS' ),
        ) : array();
        $all_query = new WP_Query(
            array(
                'post_type'      => 'attachment',
                'post_status'    => 'inherit',
                'posts_per_page' => 1,
                'fields'         => 'ids',
                'meta_query'     => $trash_exclusion, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
            )
        );
        $total = (int) $all_query->found_posts;

        $unfiled = new WP_Query(
            array(
                'post_type'      => 'attachment',
                'post_status'    => 'inherit',
                'posts_per_page' => 1,
                'fields'         => 'ids',
                'meta_query'     => $trash_exclusion, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
                'tax_query'      => array(
                    array(
                        'taxonomy' => SIMME_MEDIA_ORGANISER_TAXONOMY,
                        'operator' => 'NOT EXISTS',
                    ),
                ),
            )
        );

        $favourites = new WP_Query(
            array(
                'post_type'      => 'attachment',
                'post_status'    => 'inherit',
                'posts_per_page' => 1,
                'fields'         => 'ids',
                'meta_query'     => array_merge( $trash_exclusion, array( array( 'key' => '_smo_favourite', 'value' => '1' ) ) ), // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
            )
        );

        $missing_alt = new WP_Query(
            array(
                'post_type'      => 'attachment',
                'post_status'    => 'inherit',
                'post_mime_type' => 'image',
                'posts_per_page' => 1,
                'fields'         => 'ids',
                'meta_query'     => array_merge( $trash_exclusion, array( array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
                    'relation' => 'OR',
                    array( 'key' => '_wp_attachment_image_alt', 'compare' => 'NOT EXISTS' ),
                    array( 'key' => '_wp_attachment_image_alt', 'value' => '', 'compare' => '=' ),
                ) ) ),
            )
        );

        $stats = array(
            'all'        => $total,
            'unfiled'    => (int) $unfiled->found_posts,
            'favourites' => (int) $favourites->found_posts,
            'missingAlt' => (int) $missing_alt->found_posts,
            'trash'      => class_exists( 'Simme_Media_Organiser_Trash' ) ? Simme_Media_Organiser_Trash::trash_count() : 0,
        );
        if ( class_exists( 'Simme_Media_Organiser_Audit' ) ) {
            $health = Simme_Media_Organiser_Audit::health_summary();
            $stats = array_merge( $stats, array(
                'heavy'             => (int) ( $health['heavy'] ?? 0 ),
                'duplicateItems'    => (int) ( $health['duplicateItems'] ?? 0 ),
                'protected'         => (int) ( $health['protected'] ?? 0 ),
            ) );
        }
        return $stats;
    }

    private function format_attachment( $attachment ) {
        $id = (int) $attachment->ID;
        $file = get_attached_file( $id );
        $metadata = wp_get_attachment_metadata( $id );
        $metadata = is_array( $metadata ) ? $metadata : array();
        $mime = get_post_mime_type( $id ) ?: '';
        $kind = 'document';
        if ( 0 === strpos( $mime, 'image/' ) ) {
            $kind = 'image';
        } elseif ( 0 === strpos( $mime, 'audio/' ) ) {
            $kind = 'audio';
        } elseif ( 0 === strpos( $mime, 'video/' ) ) {
            $kind = 'video';
        }

        $folder = Simme_Media_Organiser_Plugin::attachment_folder( $id );
        $storage = Simme_Media_Organiser_Plugin::attachment_storage( $id, $metadata );
        $edit_state = Simme_Media_Organiser_Plugin::attachment_edit_state( $id, $metadata );
        $url = wp_get_attachment_url( $id );
        $thumb = '';

        $preview_url = '';
        if ( 'image' === $kind ) {
            $thumb = wp_get_attachment_image_url( $id, 'medium' ) ?: $url;
            $preview_url = wp_get_attachment_image_url( $id, 'large' ) ?: $url;
        } elseif ( 'video' === $kind ) {
            $thumb = wp_get_attachment_image_url( get_post_thumbnail_id( $id ), 'medium' ) ?: '';
            $preview_url = $thumb;
        }

        $width = isset( $metadata['width'] ) ? (int) $metadata['width'] : 0;
        $height = isset( $metadata['height'] ) ? (int) $metadata['height'] : 0;
        $extension = $file ? strtoupper( pathinfo( $file, PATHINFO_EXTENSION ) ) : strtoupper( pathinfo( (string) $url, PATHINFO_EXTENSION ) );
        $audit = class_exists( 'Simme_Media_Organiser_Audit' ) ? Simme_Media_Organiser_Audit::index_row( $id ) : array();
        $protected = (bool) get_post_meta( $id, '_simme_media_organiser_protected', true );
        $trash_state = class_exists( 'Simme_Media_Organiser_Trash' ) ? Simme_Media_Organiser_Trash::item_state( $id ) : array( 'trashed' => false );

        return array_merge( array(
            'id'            => $id,
            'title'         => html_entity_decode( get_the_title( $id ), ENT_QUOTES, get_bloginfo( 'charset' ) ),
            'filename'      => $file ? wp_basename( $file ) : wp_basename( (string) $url ),
            'url'           => $url,
            'thumb'         => $thumb,
            'previewUrl'    => $preview_url,
            'mime'          => $mime,
            'kind'          => $kind,
            'extension'     => $extension ?: 'FILE',
            'sizeBytes'     => $storage['original'],
            'size'          => Simme_Media_Organiser_Plugin::human_bytes( $storage['original'] ),
            'totalBytes'    => $storage['total'],
            'totalStorage'  => Simme_Media_Organiser_Plugin::human_bytes( $storage['total'] ),
            'derivatives'   => Simme_Media_Organiser_Plugin::human_bytes( $storage['derivatives'] ),
            'width'         => $width,
            'height'        => $height,
            'ratio'         => ( $width && $height ) ? $this->ratio_label( $width, $height ) : '',
            'alt'           => (string) get_post_meta( $id, '_wp_attachment_image_alt', true ),
            'caption'       => (string) $attachment->post_excerpt,
            'description'   => (string) $attachment->post_content,
            'folder'        => $folder,
            'favourite'     => (bool) get_post_meta( $id, '_smo_favourite', true ),
            'editState'     => $edit_state,
            'date'          => get_post_time( 'c', false, $id ),
            'dateLabel'     => get_the_date( get_option( 'date_format' ), $id ),
            'attachmentId'  => $id,
            'canEdit'       => current_user_can( 'edit_post', $id ),
            'protected'     => $protected,
            'loadGrade'     => ! empty( $audit['load_grade'] ) ? (string) $audit['load_grade'] : ( class_exists( 'Simme_Media_Organiser_Audit' ) ? Simme_Media_Organiser_Audit::load_grade( $storage['original'] ) : '' ),
            'duplicateCount'=> isset( $audit['duplicate_count'] ) ? (int) $audit['duplicate_count'] : 0,
            'broken'        => ! empty( $audit['broken'] ),
            'studioVersionCount' => count( array_filter( (array) get_post_meta( $id, '_smo_image_versions', true ), 'is_array' ) ),
            'studioPreferred'    => (string) get_post_meta( $id, '_smo_preferred_version', true ),
            'studioActive'       => (string) get_post_meta( $id, '_smo_active_version', true ),
            'studioMasterReady'  => (bool) get_post_meta( $id, '_smo_image_master', true ),
        ), $trash_state );
    }

    private function ratio_label( $width, $height ) {
        if ( ! $width || ! $height ) {
            return '';
        }
        $gcd = $this->gcd( $width, $height );
        $a = (int) ( $width / $gcd );
        $b = (int) ( $height / $gcd );
        if ( $a > 32 || $b > 32 ) {
            return $width > $height ? 'Landscape' : ( $height > $width ? 'Portrait' : '1:1' );
        }
        return $a . ':' . $b;
    }

    private function gcd( $a, $b ) {
        $a = absint( $a );
        $b = absint( $b );
        while ( $b ) {
            $temp = $b;
            $b = $a % $b;
            $a = $temp;
        }
        return max( 1, $a );
    }

    private function folder_siblings( $parent_id, $exclude_id = 0 ) {
        $terms = get_terms(
            array(
                'taxonomy'   => SIMME_MEDIA_ORGANISER_TAXONOMY,
                'hide_empty' => false,
                'parent'     => absint( $parent_id ),
                'orderby'    => 'name',
                'order'      => 'ASC',
            )
        );
        if ( is_wp_error( $terms ) ) {
            return array();
        }
        $exclude_id = absint( $exclude_id );
        $terms = array_values( array_filter( $terms, static function ( $term ) use ( $exclude_id ) {
            return ! $exclude_id || (int) $term->term_id !== $exclude_id;
        } ) );
        usort( $terms, static function ( $a, $b ) {
            $a_order = (int) get_term_meta( (int) $a->term_id, '_smo_folder_order', true );
            $b_order = (int) get_term_meta( (int) $b->term_id, '_smo_folder_order', true );
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
        return $terms;
    }

    private function normalise_folder_order( $parent_id, $preferred_ids = array() ) {
        $parent_id = absint( $parent_id );
        $siblings = $this->folder_siblings( $parent_id );
        $valid = array();
        foreach ( $siblings as $term ) {
            $valid[ (int) $term->term_id ] = true;
        }
        $ids = array();
        foreach ( (array) $preferred_ids as $id ) {
            $id = absint( $id );
            if ( $id && isset( $valid[ $id ] ) && ! in_array( $id, $ids, true ) ) {
                $ids[] = $id;
            }
        }
        foreach ( $siblings as $term ) {
            $id = (int) $term->term_id;
            if ( ! in_array( $id, $ids, true ) ) {
                $ids[] = $id;
            }
        }
        foreach ( $ids as $index => $id ) {
            update_term_meta( $id, '_smo_folder_order', ( $index + 1 ) * 10 );
        }
        return $ids;
    }

    private function next_folder_order( $parent_id ) {
        $max = 0;
        foreach ( $this->folder_siblings( $parent_id ) as $term ) {
            $max = max( $max, (int) get_term_meta( (int) $term->term_id, '_smo_folder_order', true ) );
        }
        return $max ? $max + 10 : 10;
    }

    private function folder_order_state( $parent_ids ) {
        $state = array();
        foreach ( array_unique( array_map( 'absint', (array) $parent_ids ) ) as $parent_id ) {
            $state[ $parent_id ] = array();
            foreach ( $this->folder_siblings( $parent_id ) as $term ) {
                $state[ $parent_id ][ (int) $term->term_id ] = (int) get_term_meta( (int) $term->term_id, '_smo_folder_order', true );
            }
        }
        return $state;
    }

    private function ensure_lost_property_folder() {
        $existing = term_exists( 'Lost Property', SIMME_MEDIA_ORGANISER_TAXONOMY, 0 );
        if ( $existing ) {
            $term_id = is_array( $existing ) ? (int) $existing['term_id'] : (int) $existing;
            update_term_meta( $term_id, '_smo_lost_property', 1 );
            if ( ! get_term_meta( $term_id, '_smo_colour', true ) ) {
                update_term_meta( $term_id, '_smo_colour', '#ff9f55' );
            }
            return $term_id;
        }
        $created = wp_insert_term( 'Lost Property', SIMME_MEDIA_ORGANISER_TAXONOMY, array( 'parent' => 0 ) );
        if ( is_wp_error( $created ) ) {
            return $created;
        }
        $term_id = (int) $created['term_id'];
        update_term_meta( $term_id, '_smo_lost_property', 1 );
        update_term_meta( $term_id, '_smo_colour', '#ff9f55' );
        update_term_meta( $term_id, '_smo_folder_order', $this->next_folder_order( 0 ) );
        return $term_id;
    }

    public function create_folder() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $this->guard();
        $name = sanitize_text_field( wp_unslash( $_POST['name'] ?? '' ) );
        $parent = absint( wp_unslash( $_POST['parent'] ?? 0 ) );
        $colour = sanitize_hex_color( wp_unslash( $_POST['colour'] ?? '' ) );

        if ( '' === $name ) {
            wp_send_json_error( array( 'message' => __( 'Please enter a folder name.', 'simme-media-organiser' ) ), 400 );
        }
        if ( $parent && ! term_exists( $parent, SIMME_MEDIA_ORGANISER_TAXONOMY ) ) {
            wp_send_json_error( array( 'message' => __( 'The selected parent folder no longer exists.', 'simme-media-organiser' ) ), 400 );
        }

        $term = wp_insert_term( $name, SIMME_MEDIA_ORGANISER_TAXONOMY, array( 'parent' => $parent ) );
        if ( is_wp_error( $term ) ) {
            wp_send_json_error( array( 'message' => $term->get_error_message() ), 400 );
        }

        if ( $colour ) {
            update_term_meta( (int) $term['term_id'], '_smo_colour', $colour );
        }
        update_term_meta( (int) $term['term_id'], '_smo_folder_order', $this->next_folder_order( $parent ) );

        wp_send_json_success(
            array(
                'message' => __( 'Folder created.', 'simme-media-organiser' ),
                'folder'  => (int) $term['term_id'],
                'folders' => Simme_Media_Organiser_Plugin::folder_terms_tree(),
            )
        );
    }

    public function update_folder() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $this->guard();
        $term_id = absint( wp_unslash( $_POST['term_id'] ?? 0 ) );
        $name = sanitize_text_field( wp_unslash( $_POST['name'] ?? '' ) );
        $parent = absint( wp_unslash( $_POST['parent'] ?? 0 ) );
        $colour = sanitize_hex_color( wp_unslash( $_POST['colour'] ?? '' ) );

        if ( ! $term_id || ! $name || ! term_exists( $term_id, SIMME_MEDIA_ORGANISER_TAXONOMY ) ) {
            wp_send_json_error( array( 'message' => __( 'Invalid folder details.', 'simme-media-organiser' ) ), 400 );
        }
        if ( $parent && ( ! term_exists( $parent, SIMME_MEDIA_ORGANISER_TAXONOMY ) || $term_id === $parent || term_is_ancestor_of( $term_id, $parent, SIMME_MEDIA_ORGANISER_TAXONOMY ) ) ) {
            wp_send_json_error( array( 'message' => __( 'A folder cannot be moved inside itself or one of its child folders.', 'simme-media-organiser' ) ), 400 );
        }

        $before_term = get_term( $term_id, SIMME_MEDIA_ORGANISER_TAXONOMY );
        $old_parent = ( $before_term && ! is_wp_error( $before_term ) ) ? (int) $before_term->parent : 0;
        $before_colour = (string) get_term_meta( $term_id, '_smo_colour', true );
        $before_order = (int) get_term_meta( $term_id, '_smo_folder_order', true );
        $updated = wp_update_term( $term_id, SIMME_MEDIA_ORGANISER_TAXONOMY, array( 'name' => $name, 'parent' => $parent ) );
        if ( is_wp_error( $updated ) ) {
            wp_send_json_error( array( 'message' => $updated->get_error_message() ), 400 );
        }
        if ( $colour ) {
            update_term_meta( $term_id, '_smo_colour', $colour );
        }
        if ( $old_parent !== $parent ) {
            update_term_meta( $term_id, '_smo_folder_order', $this->next_folder_order( $parent ) );
            $this->normalise_folder_order( $old_parent );
            $this->normalise_folder_order( $parent );
        }
        if ( class_exists( 'Simme_Media_Organiser_Audit' ) && $before_term && ! is_wp_error( $before_term ) ) {
            $after_colour = $colour ? $colour : $before_colour;
            $after_order = (int) get_term_meta( $term_id, '_smo_folder_order', true );
            $before_state = array( 'name' => (string) $before_term->name, 'parent' => $old_parent, 'colour' => $before_colour, 'order' => $before_order );
            $after_state  = array( 'name' => $name, 'parent' => $parent, 'colour' => $after_colour, 'order' => $after_order );
            if ( $before_state !== $after_state ) {
                /* translators: %s: updated virtual folder name. */
                Simme_Media_Organiser_Audit::log_action( 'folder_update', sprintf( __( 'Updated folder “%s”', 'simme-media-organiser' ), $name ), 0, array( 'folder_id' => $term_id, 'before' => $before_state, 'after' => $after_state ), true );
            }
        }
        wp_send_json_success( array( 'folders' => Simme_Media_Organiser_Plugin::folder_terms_tree() ) );
    }

    public function move_folder() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $this->guard();
        $term_id = absint( wp_unslash( $_POST['term_id'] ?? 0 ) );
        $target_id = absint( wp_unslash( $_POST['target_id'] ?? 0 ) );
        $placement = sanitize_key( wp_unslash( $_POST['placement'] ?? 'inside' ) );
        if ( ! $term_id || ! in_array( $placement, array( 'inside', 'before', 'after', 'root' ), true ) ) {
            wp_send_json_error( array( 'message' => __( 'That folder move is not valid.', 'simme-media-organiser' ) ), 400 );
        }
        $term = get_term( $term_id, SIMME_MEDIA_ORGANISER_TAXONOMY );
        if ( ! $term || is_wp_error( $term ) ) {
            wp_send_json_error( array( 'message' => __( 'That folder no longer exists.', 'simme-media-organiser' ) ), 404 );
        }
        $old_parent = (int) $term->parent;
        $new_parent = 0;
        $target = null;
        if ( 'root' !== $placement ) {
            if ( ! $target_id || $target_id === $term_id ) {
                wp_send_json_error( array( 'message' => __( 'Choose another folder as the destination.', 'simme-media-organiser' ) ), 400 );
            }
            $target = get_term( $target_id, SIMME_MEDIA_ORGANISER_TAXONOMY );
            if ( ! $target || is_wp_error( $target ) ) {
                wp_send_json_error( array( 'message' => __( 'The destination folder no longer exists.', 'simme-media-organiser' ) ), 404 );
            }
            if ( term_is_ancestor_of( $term_id, $target_id, SIMME_MEDIA_ORGANISER_TAXONOMY ) ) {
                wp_send_json_error( array( 'message' => __( 'A folder cannot be moved into or beside one of its own child folders.', 'simme-media-organiser' ) ), 400 );
            }
            $new_parent = 'inside' === $placement ? $target_id : (int) $target->parent;
        }
        if ( $new_parent && ( $new_parent === $term_id || term_is_ancestor_of( $term_id, $new_parent, SIMME_MEDIA_ORGANISER_TAXONOMY ) ) ) {
            wp_send_json_error( array( 'message' => __( 'That move would create a circular folder structure.', 'simme-media-organiser' ) ), 400 );
        }

        $before_order_state = $this->folder_order_state( array( $old_parent, $new_parent ) );
        $updated = wp_update_term( $term_id, SIMME_MEDIA_ORGANISER_TAXONOMY, array( 'parent' => $new_parent ) );
        if ( is_wp_error( $updated ) ) {
            wp_send_json_error( array( 'message' => $updated->get_error_message() ), 400 );
        }

        $preferred = array_values( array_map( static function ( $sibling ) { return (int) $sibling->term_id; }, $this->folder_siblings( $new_parent, $term_id ) ) );
        if ( in_array( $placement, array( 'before', 'after' ), true ) && $target_id ) {
            $target_index = array_search( $target_id, $preferred, true );
            if ( false === $target_index ) {
                $preferred[] = $term_id;
            } else {
                $insert_at = 'after' === $placement ? $target_index + 1 : $target_index;
                array_splice( $preferred, $insert_at, 0, array( $term_id ) );
            }
        } else {
            $preferred[] = $term_id;
        }
        $this->normalise_folder_order( $new_parent, $preferred );
        if ( $old_parent !== $new_parent ) {
            $this->normalise_folder_order( $old_parent );
        }
        if ( class_exists( 'Simme_Media_Organiser_Audit' ) ) {
            $after_order_state = $this->folder_order_state( array( $old_parent, $new_parent ) );
            /* translators: %s: moved virtual folder name. */
            Simme_Media_Organiser_Audit::log_action( 'folder_move', sprintf( __( 'Moved folder “%s”', 'simme-media-organiser' ), $term->name ), 0, array( 'folder_id' => $term_id, 'from_parent' => $old_parent, 'to_parent' => $new_parent, 'placement' => $placement, 'before_order' => $before_order_state, 'after_order' => $after_order_state ), true );
        }
        wp_send_json_success( array( 'folders' => Simme_Media_Organiser_Plugin::folder_terms_tree(), 'folder' => $term_id, 'parent' => $new_parent ) );
    }

    public function delete_folder() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $this->guard();
        $term_id = absint( wp_unslash( $_POST['term_id'] ?? 0 ) );
        $destination = sanitize_key( wp_unslash( $_POST['destination'] ?? 'unfiled' ) );
        $gate = sanitize_text_field( wp_unslash( $_POST['gate'] ?? '' ) );
        if ( ! $term_id || 'DELETE:' . $term_id !== $gate ) {
            wp_send_json_error( array( 'message' => __( 'The delete safety gate was not completed.', 'simme-media-organiser' ) ), 400 );
        }
        if ( ! in_array( $destination, array( 'unfiled', 'lost_property' ), true ) ) {
            wp_send_json_error( array( 'message' => __( 'Choose where the folder’s media should go before deleting it.', 'simme-media-organiser' ) ), 400 );
        }
        $term = get_term( $term_id, SIMME_MEDIA_ORGANISER_TAXONOMY );
        if ( ! $term || is_wp_error( $term ) ) {
            wp_send_json_error( array( 'message' => __( 'That folder no longer exists.', 'simme-media-organiser' ) ), 404 );
        }
        $old_parent = (int) $term->parent;
        $is_lost_property = (bool) get_term_meta( $term_id, '_smo_lost_property', true );
        if ( $is_lost_property && 'lost_property' === $destination ) {
            wp_send_json_error( array( 'message' => __( 'Lost Property cannot be moved into itself. Choose Main Media Library instead.', 'simme-media-organiser' ) ), 400 );
        }

        $direct_ids = get_posts(
            array(
                'post_type'      => 'attachment',
                'post_status'    => 'inherit',
                'posts_per_page' => -1,
                'fields'         => 'ids',
                'no_found_rows'  => true,
                'tax_query'      => array(
                    array(
                        'taxonomy'         => SIMME_MEDIA_ORGANISER_TAXONOMY,
                        'field'            => 'term_id',
                        'terms'            => array( $term_id ),
                        'include_children' => false,
                    ),
                ),
            )
        );
        $destination_folder = 0;
        if ( $direct_ids && 'lost_property' === $destination ) {
            $destination_folder = $this->ensure_lost_property_folder();
            if ( is_wp_error( $destination_folder ) ) {
                wp_send_json_error( array( 'message' => $destination_folder->get_error_message() ), 400 );
            }
            $destination_folder = (int) $destination_folder;
        }

        $moved = 0;
        foreach ( $direct_ids as $attachment_id ) {
            if ( ! current_user_can( 'edit_post', $attachment_id ) ) {
                continue;
            }
            $result = $destination_folder
                ? wp_set_object_terms( $attachment_id, array( $destination_folder ), SIMME_MEDIA_ORGANISER_TAXONOMY, false )
                : wp_set_object_terms( $attachment_id, array(), SIMME_MEDIA_ORGANISER_TAXONOMY, false );
            if ( ! is_wp_error( $result ) ) {
                $moved++;
                if ( class_exists( 'Simme_Media_Organiser_Audit' ) ) {
                    Simme_Media_Organiser_Audit::scan_attachment( $attachment_id, false );
                }
            }
        }

        $children = get_terms(
            array(
                'taxonomy'   => SIMME_MEDIA_ORGANISER_TAXONOMY,
                'hide_empty' => false,
                'parent'     => $term_id,
            )
        );
        $promoted = 0;
        if ( ! is_wp_error( $children ) ) {
            foreach ( $children as $child ) {
                $updated_child = wp_update_term( (int) $child->term_id, SIMME_MEDIA_ORGANISER_TAXONOMY, array( 'parent' => $old_parent ) );
                if ( ! is_wp_error( $updated_child ) ) {
                    update_term_meta( (int) $child->term_id, '_smo_folder_order', $this->next_folder_order( $old_parent ) );
                    $promoted++;
                }
            }
        }

        $deleted = wp_delete_term( $term_id, SIMME_MEDIA_ORGANISER_TAXONOMY );
        if ( is_wp_error( $deleted ) ) {
            wp_send_json_error( array( 'message' => $deleted->get_error_message() ), 400 );
        }
        if ( false === $deleted || null === $deleted ) {
            wp_send_json_error( array( 'message' => __( 'WordPress did not delete that virtual folder. Please refresh the Library and try again.', 'simme-media-organiser' ) ), 409 );
        }

        clean_term_cache( $term_id, SIMME_MEDIA_ORGANISER_TAXONOMY );
        $still_exists = term_exists( $term_id, SIMME_MEDIA_ORGANISER_TAXONOMY );
        if ( $still_exists ) {
            wp_send_json_error( array( 'message' => __( 'The folder is still present after WordPress processed the delete request. Simme has stopped rather than reporting a false success.', 'simme-media-organiser' ) ), 409 );
        }

        $this->normalise_folder_order( $old_parent );
        if ( $destination_folder ) {
            $this->normalise_folder_order( 0 );
        }

        $orders = get_user_meta( get_current_user_id(), '_smo_media_custom_orders', true );
        if ( is_array( $orders ) && isset( $orders[ 'folder:' . $term_id ] ) ) {
            unset( $orders[ 'folder:' . $term_id ] );
            if ( $orders ) {
                update_user_meta( get_current_user_id(), '_smo_media_custom_orders', $orders );
            } else {
                delete_user_meta( get_current_user_id(), '_smo_media_custom_orders' );
            }
        }

        if ( class_exists( 'Simme_Media_Organiser_Audit' ) ) {
            /* translators: %s: deleted virtual folder name. */
            Simme_Media_Organiser_Audit::log_action( 'folder_delete', sprintf( __( 'Deleted virtual folder “%s”', 'simme-media-organiser' ), $term->name ), 0, array( 'folder_id' => $term_id, 'media_moved' => $moved, 'destination' => $destination_folder ? $destination_folder : 'unfiled', 'child_folders_promoted' => $promoted ), false );
        }

        wp_send_json_success(
            array(
                'message'           => __( 'Virtual folder deleted safely.', 'simme-media-organiser' ),
                'moved'             => $moved,
                'childrenPromoted'  => $promoted,
                'destinationFolder' => $destination_folder,
                'folders'           => Simme_Media_Organiser_Plugin::folder_terms_tree(),
            )
        );
    }

    public function move_media() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $this->guard();
        $ids = $this->posted_ids( array_map( 'absint', (array) wp_unslash( $_POST['ids'] ?? array() ) ) );
        $folder_id = absint( wp_unslash( $_POST['folder_id'] ?? 0 ) );

        if ( ! $ids ) {
            wp_send_json_error( array( 'message' => __( 'No media items were selected.', 'simme-media-organiser' ) ), 400 );
        }
        if ( $folder_id && ! term_exists( $folder_id, SIMME_MEDIA_ORGANISER_TAXONOMY ) ) {
            wp_send_json_error( array( 'message' => __( 'That folder no longer exists.', 'simme-media-organiser' ) ), 400 );
        }

        $moved = 0;
        $before = array();
        $changed_ids = array();
        foreach ( $ids as $id ) {
            if ( ! current_user_can( 'edit_post', $id ) ) {
                continue;
            }
            $previous_terms = wp_get_object_terms( $id, SIMME_MEDIA_ORGANISER_TAXONOMY, array( 'fields' => 'ids' ) );
            $before[ $id ] = is_wp_error( $previous_terms ) ? array() : array_values( array_map( 'absint', (array) $previous_terms ) );
            $result = $folder_id ? wp_set_object_terms( $id, array( $folder_id ), SIMME_MEDIA_ORGANISER_TAXONOMY, false ) : wp_set_object_terms( $id, array(), SIMME_MEDIA_ORGANISER_TAXONOMY, false );
            if ( ! is_wp_error( $result ) ) {
                $moved++;
                $changed_ids[] = $id;
            }
        }

        if ( class_exists( 'Simme_Media_Organiser_Audit' ) ) {
            foreach ( $changed_ids as $id ) {
                Simme_Media_Organiser_Audit::scan_attachment( $id, false );
            }
            /* translators: %d: number of media items moved. */
            Simme_Media_Organiser_Audit::log_action( 'move', sprintf( _n( 'Moved %d media item', 'Moved %d media items', $moved, 'simme-media-organiser' ), $moved ), 0, array( 'before' => $before, 'after_folder' => $folder_id ), true );
        }

        wp_send_json_success(
            array(
                /* translators: %d: number of media items organised. */
                'message' => sprintf( _n( '%d item organised.', '%d items organised.', $moved, 'simme-media-organiser' ), $moved ),
                'moved'   => $moved,
                'folders' => Simme_Media_Organiser_Plugin::folder_terms_tree(),
            )
        );
    }

    public function toggle_favourite() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $this->guard();
        $ids = $this->posted_ids( array_map( 'absint', (array) wp_unslash( $_POST['ids'] ?? array() ) ) );
        $value = empty( sanitize_text_field( wp_unslash( $_POST['value'] ?? '' ) ) ) ? 0 : 1;
        $changed = 0;
        $before = array();

        foreach ( $ids as $id ) {
            if ( current_user_can( 'edit_post', $id ) ) {
                $before[ $id ] = get_post_meta( $id, '_smo_favourite', true ) ? 1 : 0;
                update_post_meta( $id, '_smo_favourite', $value );
                if ( class_exists( 'Simme_Media_Organiser_Audit' ) ) { Simme_Media_Organiser_Audit::scan_attachment( $id, false ); }
                $changed++;
            }
        }

        if ( class_exists( 'Simme_Media_Organiser_Audit' ) ) {
            Simme_Media_Organiser_Audit::log_action( 'favourite', $value ? __( 'Added media to favourites', 'simme-media-organiser' ) : __( 'Removed media from favourites', 'simme-media-organiser' ), 0, array( 'before' => $before, 'after' => $value ), true );
        }
        wp_send_json_success( array( 'changed' => $changed ) );
    }


    public function save_alt() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $this->guard();
        $id = absint( wp_unslash( $_POST['id'] ?? 0 ) );
        if ( ! $id || 'attachment' !== get_post_type( $id ) || ! current_user_can( 'edit_post', $id ) ) {
            wp_send_json_error( array( 'message' => __( 'You cannot edit that media item.', 'simme-media-organiser' ) ), 403 );
        }

        if ( ! wp_attachment_is_image( $id ) ) {
            wp_send_json_error( array( 'message' => __( 'ALT text is only available for images.', 'simme-media-organiser' ) ), 400 );
        }

        $alt = sanitize_text_field( wp_unslash( $_POST['alt'] ?? '' ) );
        $before_alt = (string) get_post_meta( $id, '_wp_attachment_image_alt', true );
        update_post_meta( $id, '_wp_attachment_image_alt', $alt );
        if ( class_exists( 'Simme_Media_Organiser_Audit' ) ) {
            Simme_Media_Organiser_Audit::scan_attachment( $id, false );
            Simme_Media_Organiser_Audit::log_action( 'alt', __( 'Updated image ALT text', 'simme-media-organiser' ), $id, array( 'before' => $before_alt, 'after' => $alt ), true );
        }

        wp_send_json_success(
            array(
                'message' => __( 'ALT text saved.', 'simme-media-organiser' ),
                'item'    => $this->format_attachment( get_post( $id ) ),
            )
        );
    }

    public function save_media() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $this->guard();
        $id = absint( wp_unslash( $_POST['id'] ?? 0 ) );
        if ( ! $id || 'attachment' !== get_post_type( $id ) || ! current_user_can( 'edit_post', $id ) ) {
            wp_send_json_error( array( 'message' => __( 'You cannot edit that media item.', 'simme-media-organiser' ) ), 403 );
        }

        $before_media = array(
            'title'       => (string) get_the_title( $id ),
            'alt'         => (string) get_post_meta( $id, '_wp_attachment_image_alt', true ),
            'caption'     => (string) get_post_field( 'post_excerpt', $id ),
            'description' => (string) get_post_field( 'post_content', $id ),
            'terms'       => array(),
        );
        $previous_terms = wp_get_object_terms( $id, SIMME_MEDIA_ORGANISER_TAXONOMY, array( 'fields' => 'ids' ) );
        if ( ! is_wp_error( $previous_terms ) ) {
            $before_media['terms'] = array_values( array_map( 'absint', (array) $previous_terms ) );
        }

        $title = sanitize_text_field( wp_unslash( $_POST['title'] ?? '' ) );
        $alt = sanitize_text_field( wp_unslash( $_POST['alt'] ?? '' ) );
        $caption = sanitize_textarea_field( wp_unslash( $_POST['caption'] ?? '' ) );
        $description = sanitize_textarea_field( wp_unslash( $_POST['description'] ?? '' ) );
        $folder_id = absint( wp_unslash( $_POST['folder_id'] ?? 0 ) );
        if ( $folder_id && ! term_exists( $folder_id, SIMME_MEDIA_ORGANISER_TAXONOMY ) ) {
            wp_send_json_error( array( 'message' => __( 'That folder no longer exists.', 'simme-media-organiser' ) ), 400 );
        }

        $updated = wp_update_post(
            array(
                'ID'           => $id,
                'post_title'   => $title,
                'post_excerpt' => $caption,
                'post_content' => $description,
            ),
            true
        );
        if ( is_wp_error( $updated ) ) {
            wp_send_json_error( array( 'message' => $updated->get_error_message() ), 400 );
        }

        update_post_meta( $id, '_wp_attachment_image_alt', $alt );
        if ( $folder_id ) {
            wp_set_object_terms( $id, array( $folder_id ), SIMME_MEDIA_ORGANISER_TAXONOMY, false );
        } else {
            wp_set_object_terms( $id, array(), SIMME_MEDIA_ORGANISER_TAXONOMY, false );
        }
        if ( class_exists( 'Simme_Media_Organiser_Audit' ) ) {
            Simme_Media_Organiser_Audit::scan_attachment( $id, false );
            Simme_Media_Organiser_Audit::log_action(
                'media_details',
                __( 'Updated media details', 'simme-media-organiser' ),
                $id,
                array(
                    'before' => $before_media,
                    'after'  => array(
                        'title'       => $title,
                        'alt'         => $alt,
                        'caption'     => $caption,
                        'description' => $description,
                        'folder_id'   => $folder_id,
                    ),
                ),
                true
            );
        }

        wp_send_json_success(
            array(
                'message' => __( 'Media details saved.', 'simme-media-organiser' ),
                'item'    => $this->format_attachment( get_post( $id ) ),
                'folders' => Simme_Media_Organiser_Plugin::folder_terms_tree(),
            )
        );
    }

    public function upload_media() {
        check_ajax_referer( 'simme_media_organiser_admin', 'nonce' );
        $this->guard();
        if ( empty( $_FILES['file'] ) ) {
            wp_send_json_error( array( 'message' => __( 'No file was received.', 'simme-media-organiser' ) ), 400 );
        }

        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';

        $attachment_id = media_handle_upload( 'file', 0, array(), array( 'test_form' => false ) );
        if ( is_wp_error( $attachment_id ) ) {
            wp_send_json_error( array( 'message' => $attachment_id->get_error_message() ), 400 );
        }

        $folder_id = absint( wp_unslash( $_POST['folder_id'] ?? 0 ) );
        if ( $folder_id && term_exists( $folder_id, SIMME_MEDIA_ORGANISER_TAXONOMY ) ) {
            wp_set_object_terms( $attachment_id, array( $folder_id ), SIMME_MEDIA_ORGANISER_TAXONOMY, false );
        }
        if ( class_exists( 'Simme_Media_Organiser_Audit' ) ) {
            Simme_Media_Organiser_Audit::scan_attachment( $attachment_id, false );
            Simme_Media_Organiser_Audit::log_action(
                'upload',
                __( 'Uploaded media through Simme Media.', 'simme-media-organiser' ),
                $attachment_id,
                array( 'folder_id' => $folder_id ),
                false
            );
        }

        wp_send_json_success(
            array(
                'message' => __( 'File uploaded.', 'simme-media-organiser' ),
                'item'    => $this->format_attachment( get_post( $attachment_id ) ),
            )
        );
    }

    private function posted_ids( $raw ) {
        $ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $raw ) ) ) );
        return array_values(
            array_filter(
                $ids,
                static function ( $id ) {
                    return 'attachment' === get_post_type( $id );
                }
            )
        );
    }
}
