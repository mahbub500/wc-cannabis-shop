<?php
namespace WCCannabisShop\Admin;

class Admin {

    private const META_KEY       = '_wccs_sale_enabled';
    private const LOCATIONS_KEY  = 'wccs_pickup_locations';

    public function init(): void {
        add_action( 'admin_menu',              [ $this, 'add_menu' ] );
        add_action( 'add_meta_boxes',          [ $this, 'add_sale_meta_box' ] );
        add_action( 'save_post_product',       [ $this, 'save_sale_meta' ] );
        add_action( 'admin_post_wccs_save_location',   [ $this, 'handle_save_location' ] );
        add_action( 'admin_post_wccs_delete_location', [ $this, 'handle_delete_location' ] );
        add_action( 'admin_enqueue_scripts',   [ $this, 'enqueue_assets' ] );
    }

    /* -------------------------------------------------------------------------
     * Menu
     * ---------------------------------------------------------------------- */

    public function add_menu(): void {
        

        add_submenu_page(
            'woocommerce', // WooCommerce parent menu
            'Pickup Locations',
            'Pickup Locations',
            'manage_woocommerce', // better than manage_options
            'pickup-locations',
            [ $this, 'render_locations_page' ]
        );
    }

    /* -------------------------------------------------------------------------
     * Enqueue assets only on our admin pages
     * ---------------------------------------------------------------------- */

    public function enqueue_assets( string $hook ): void {
        $pages = [ 'woocommerce_page_pickup-locations' ];

        // var_dump( $hook );  
        if ( ! in_array( $hook, $pages, true ) ) {
            return;
        }

        // Leaflet (OpenStreetMap)
        wp_enqueue_style(
            'leaflet',
            'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
            [],
            '1.9.4'
        );
        wp_enqueue_script(
            'leaflet',
            'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
            [],
            '1.9.4',
            true
        );

        // Plugin CSS
        wp_enqueue_style(
            'wccs-admin',
            WCCS_URL . 'assets/css/admin.css',
            [ 'leaflet' ],
            WCCS_VERSION
        );

        // Plugin JS (depends on jQuery + Leaflet)
        wp_enqueue_script(
            'wccs-admin',
            WCCS_URL . 'assets/js/admin.js',
            [ 'jquery', 'leaflet' ],
            WCCS_VERSION,
            true
        );

        // Pass data to JS
        wp_localize_script( 'wccs-admin', 'wccAdmin', [
            'ajaxUrl' => admin_url( 'admin-ajax.php' ),
            'nonce'   => wp_create_nonce( 'wccs_admin' ),
            'strings' => [
                'pickPoint'  => __( 'Click on the map to pick a location', 'wc-cannabis-shop' ),
                'myLocation' => __( 'Use my current location', 'wc-cannabis-shop' ),
                'locError'   => __( 'Could not get your location.', 'wc-cannabis-shop' ),
            ],
        ] );
    }

    /* -------------------------------------------------------------------------
     * Pickup Locations page
     * ---------------------------------------------------------------------- */

    public function render_locations_page(): void {
        $locations     = $this->get_locations();
        $editing       = null;
        $edit_id       = isset( $_GET['edit'] ) ? absint( $_GET['edit'] ) : null;
        $time_slots    = $this->default_time_slots();

        if ( $edit_id !== null && isset( $locations[ $edit_id ] ) ) {
            $editing = $locations[ $edit_id ];
        }

        // Flash messages
        $notice = '';
        if ( isset( $_GET['wccs_saved'] ) ) {
            $notice = '<div class="notice notice-success is-dismissible"><p>' . esc_html__( 'Location saved successfully.', 'wc-cannabis-shop' ) . '</p></div>';
        } elseif ( isset( $_GET['wccs_deleted'] ) ) {
            $notice = '<div class="notice notice-warning is-dismissible"><p>' . esc_html__( 'Location deleted.', 'wc-cannabis-shop' ) . '</p></div>';
        }

        ?>
        <div class="wrap wccs-wrap">
            <h1 class="wccs-page-title">
                <span class="wccs-icon">📍</span>
                <?php esc_html_e( 'Pickup Locations', 'wc-cannabis-shop' ); ?>
            </h1>

            <?php echo wp_kses_post( $notice ); ?>

            <div class="wccs-locations-layout">

                <!-- ── Left column: Add / Edit form ─────────────────────── -->
                <div class="wccs-card wccs-form-panel">
                    <h2><?php echo $editing ? esc_html__( 'Edit Location', 'wc-cannabis-shop' ) : esc_html__( 'Add New Location', 'wc-cannabis-shop' ); ?></h2>

                    <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" id="wccs-location-form">
                        <?php wp_nonce_field( 'wccs_save_location', 'wccs_location_nonce' ); ?>
                        <input type="hidden" name="action" value="wccs_save_location">
                        <?php if ( $editing !== null ) : ?>
                            <input type="hidden" name="location_id" value="<?php echo esc_attr( $edit_id ); ?>">
                        <?php endif; ?>

                        <!-- Title -->
                        <div class="wccs-field">
                            <label for="wccs_title"><?php esc_html_e( 'Location Title', 'wc-cannabis-shop' ); ?> <span class="required">*</span></label>
                            <input
                                type="text"
                                id="wccs_title"
                                name="wccs_title"
                                class="regular-text"
                                required
                                placeholder="<?php esc_attr_e( 'e.g. Downtown Dispensary', 'wc-cannabis-shop' ); ?>"
                                value="<?php echo $editing ? esc_attr( $editing['title'] ) : ''; ?>"
                            >
                        </div>

                        <!-- Address (auto-filled by map) -->
                        <div class="wccs-field">
                            <label for="wccs_address"><?php esc_html_e( 'Address', 'wc-cannabis-shop' ); ?></label>
                            <input
                                type="text"
                                id="wccs_address"
                                name="wccs_address"
                                class="regular-text"
                                placeholder="<?php esc_attr_e( 'Pick from map or type manually', 'wc-cannabis-shop' ); ?>"
                                value="<?php echo $editing ? esc_attr( $editing['address'] ) : ''; ?>"
                            >
                        </div>

                        <!-- Lat / Lng (hidden, driven by map) -->
                        <input type="hidden" id="wccs_lat" name="wccs_lat" value="<?php echo $editing ? esc_attr( $editing['lat'] ) : ''; ?>">
                        <input type="hidden" id="wccs_lng" name="wccs_lng" value="<?php echo $editing ? esc_attr( $editing['lng'] ) : ''; ?>">

                        <!-- ── Map picker ─────────────────────────────── -->
                        <div class="wccs-field">
                            <label><?php esc_html_e( 'Pin Location on Map', 'wc-cannabis-shop' ); ?></label>
                            <div class="wccs-map-toolbar">
                                <button type="button" id="wccs-locate-me" class="button wccs-locate-btn">
                                    🎯 <?php esc_html_e( 'Use My Location', 'wc-cannabis-shop' ); ?>
                                </button>
                                <span class="wccs-map-hint"><?php esc_html_e( 'or click on map to place pin', 'wc-cannabis-shop' ); ?></span>
                            </div>
                            <div
                                id="wccs-map"
                                class="wccs-map"
                                data-lat="<?php echo $editing ? esc_attr( $editing['lat'] ) : ''; ?>"
                                data-lng="<?php echo $editing ? esc_attr( $editing['lng'] ) : ''; ?>"
                            ></div>
                        </div>

                        <!-- Pickup Time Slots -->
                        <div class="wccs-field">
                            <label><?php esc_html_e( 'Pickup Time Slots', 'wc-cannabis-shop' ); ?></label>
                            <div class="wccs-time-slots">
                                <?php
                                $saved_slots = $editing ? ( $editing['time_slots'] ?? [] ) : [];
                                foreach ( $time_slots as $slot_value => $slot_label ) :
                                    $checked = in_array( $slot_value, $saved_slots, true ) ? 'checked' : '';
                                ?>
                                    <label class="wccs-slot-label">
                                        <input type="checkbox" name="wccs_time_slots[]" value="<?php echo esc_attr( $slot_value ); ?>" <?php echo $checked; ?>>
                                        <span><?php echo esc_html( $slot_label ); ?></span>
                                    </label>
                                <?php endforeach; ?>
                            </div>
                            <p class="description"><?php esc_html_e( 'Select all available pickup windows for this location.', 'wc-cannabis-shop' ); ?></p>
                        </div>

                        <div class="wccs-form-actions">
                            <button type="submit" class="button button-primary wccs-btn">
                                <?php echo $editing ? esc_html__( '💾 Update Location', 'wc-cannabis-shop' ) : esc_html__( '➕ Add Location', 'wc-cannabis-shop' ); ?>
                            </button>
                            <?php if ( $editing ) : ?>
                                <a href="<?php echo esc_url( admin_url( 'admin.php?page=pickup-locations' ) ); ?>" class="button wccs-btn-secondary">
                                    <?php esc_html_e( 'Cancel', 'wc-cannabis-shop' ); ?>
                                </a>
                            <?php endif; ?>
                        </div>
                    </form>
                </div>

                <!-- ── Right column: Locations list ─────────────────────── -->
                <div class="wccs-locations-list-panel">

                    <?php if ( empty( $locations ) ) : ?>
                        <div class="wccs-card wccs-empty-state">
                            <span class="wccs-empty-icon">🗺️</span>
                            <p><?php esc_html_e( 'No pickup locations added yet. Add your first location using the form.', 'wc-cannabis-shop' ); ?></p>
                        </div>
                    <?php else : ?>

                        <!-- ── Preview map (all pins) ──────────────────── -->
                        <div class="wccs-card wccs-map-preview-card">
                            <h2><?php esc_html_e( 'All Locations Map', 'wc-cannabis-shop' ); ?></h2>
                            <div
                                id="wccs-preview-map"
                                class="wccs-map wccs-map--preview"
                                data-locations="<?php echo esc_attr( wp_json_encode( array_values( $locations ) ) ); ?>"
                            ></div>
                        </div>

                        <!-- ── Location cards ─────────────────────────── -->
                        <div class="wccs-location-cards">
                        <?php foreach ( $locations as $idx => $loc ) : ?>
                            <div class="wccs-card wccs-location-card">
                                <div class="wccs-location-card__header">
                                    <span class="wccs-location-card__icon">📍</span>
                                    <h3 class="wccs-location-card__title"><?php echo esc_html( $loc['title'] ); ?></h3>
                                </div>

                                <?php if ( ! empty( $loc['address'] ) ) : ?>
                                    <p class="wccs-location-card__address">
                                        🏠 <?php echo esc_html( $loc['address'] ); ?>
                                    </p>
                                <?php endif; ?>

                                <?php if ( ! empty( $loc['lat'] ) && ! empty( $loc['lng'] ) ) : ?>
                                    <p class="wccs-location-card__coords">
                                        🌐 <?php echo esc_html( number_format( (float) $loc['lat'], 6 ) ); ?>,
                                           <?php echo esc_html( number_format( (float) $loc['lng'], 6 ) ); ?>
                                    </p>
                                <?php endif; ?>

                                <?php if ( ! empty( $loc['time_slots'] ) ) : ?>
                                    <div class="wccs-location-card__slots">
                                        <span class="wccs-slots-label">🕐 <?php esc_html_e( 'Pickup times:', 'wc-cannabis-shop' ); ?></span>
                                        <div class="wccs-slot-tags">
                                            <?php foreach ( $loc['time_slots'] as $s ) : ?>
                                                <span class="wccs-slot-tag"><?php echo esc_html( $time_slots[ $s ] ?? $s ); ?></span>
                                            <?php endforeach; ?>
                                        </div>
                                    </div>
                                <?php endif; ?>

                                <div class="wccs-location-card__actions">
                                    <a
                                        href="<?php echo esc_url( admin_url( 'admin.php?page=wccs-locations&edit=' . $idx ) ); ?>"
                                        class="button wccs-btn-edit"
                                    >✏️ <?php esc_html_e( 'Edit', 'wc-cannabis-shop' ); ?></a>

                                    <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline;">
                                        <?php wp_nonce_field( 'wccs_delete_location', 'wccs_delete_nonce' ); ?>
                                        <input type="hidden" name="action" value="wccs_delete_location">
                                        <input type="hidden" name="location_id" value="<?php echo esc_attr( $idx ); ?>">
                                        <button
                                            type="submit"
                                            class="button wccs-btn-delete"
                                            onclick="return confirm('<?php esc_attr_e( 'Delete this location?', 'wc-cannabis-shop' ); ?>')"
                                        >🗑️ <?php esc_html_e( 'Delete', 'wc-cannabis-shop' ); ?></button>
                                    </form>
                                </div>
                            </div>
                        <?php endforeach; ?>
                        </div>

                    <?php endif; ?>
                </div><!-- .wccs-locations-list-panel -->

            </div><!-- .wccs-locations-layout -->
        </div><!-- .wccs-wrap -->
        <?php
    }

    /* -------------------------------------------------------------------------
     * CRUD handlers
     * ---------------------------------------------------------------------- */

    public function handle_save_location(): void {
        if ( ! isset( $_POST['wccs_location_nonce'] ) || ! wp_verify_nonce( $_POST['wccs_location_nonce'], 'wccs_save_location' ) ) {
            wp_die( esc_html__( 'Security check failed.', 'wc-cannabis-shop' ) );
        }
        if ( ! current_user_can( 'manage_woocommerce' ) ) {
            wp_die( esc_html__( 'Insufficient permissions.', 'wc-cannabis-shop' ) );
        }

        $locations   = $this->get_locations();
        $location_id = isset( $_POST['location_id'] ) ? absint( $_POST['location_id'] ) : null;

        $entry = [
            'title'      => sanitize_text_field( $_POST['wccs_title']   ?? '' ),
            'address'    => sanitize_text_field( $_POST['wccs_address']  ?? '' ),
            'lat'        => sanitize_text_field( $_POST['wccs_lat']      ?? '' ),
            'lng'        => sanitize_text_field( $_POST['wccs_lng']      ?? '' ),
            'time_slots' => array_map( 'sanitize_text_field', (array) ( $_POST['wccs_time_slots'] ?? [] ) ),
        ];

        if ( $location_id !== null && isset( $locations[ $location_id ] ) ) {
            $locations[ $location_id ] = $entry;
        } else {
            $locations[] = $entry;
        }

        update_option( self::LOCATIONS_KEY, $locations );
        wp_safe_redirect( admin_url( 'admin.php?page=pickup-locations&wccs_saved=1' ) );
        exit;
    }

    public function handle_delete_location(): void {
        if ( ! isset( $_POST['wccs_delete_nonce'] ) || ! wp_verify_nonce( $_POST['wccs_delete_nonce'], 'wccs_delete_location' ) ) {
            wp_die( esc_html__( 'Security check failed.', 'wc-cannabis-shop' ) );
        }
        if ( ! current_user_can( 'manage_woocommerce' ) ) {
            wp_die( esc_html__( 'Insufficient permissions.', 'wc-cannabis-shop' ) );
        }

        $location_id = absint( $_POST['location_id'] ?? -1 );
        $locations   = $this->get_locations();

        if ( isset( $locations[ $location_id ] ) ) {
            array_splice( $locations, $location_id, 1 );
            update_option( self::LOCATIONS_KEY, $locations );
        }

        wp_safe_redirect( admin_url( 'admin.php?page=pickup-locations&wccs_deleted=1' ) );
        exit;
    }

    /* -------------------------------------------------------------------------
     * Product meta box (existing functionality, unchanged)
     * ---------------------------------------------------------------------- */

    public function add_sale_meta_box(): void {
        add_meta_box(
            'wccs_sale_box',
            __( '🔥 10% Off Edibles', 'wc-cannabis-shop' ),
            [ $this, 'render_sale_meta_box' ],
            'product',
            'side',
            'default'
        );
    }

    public function render_sale_meta_box( \WP_Post $post ): void {
        wp_nonce_field( 'wccs_sale_meta', 'wccs_sale_nonce' );
        $checked = get_post_meta( $post->ID, self::META_KEY, true );
        ?>
        <label for="wccs_sale_enabled" style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <input type="checkbox" id="wccs_sale_enabled" name="wccs_sale_enabled" value="1" <?php checked( $checked, '1' ); ?>>
            <span><?php esc_html_e( 'Enable 10% off sale', 'wc-cannabis-shop' ); ?></span>
        </label>
        <p class="description"><?php esc_html_e( 'When checked, this product appears in the "10% off edibles" filtered view.', 'wc-cannabis-shop' ); ?></p>
        <?php
    }

    public function save_sale_meta( int $post_id ): void {
        if ( ! isset( $_POST['wccs_sale_nonce'] ) || ! wp_verify_nonce( $_POST['wccs_sale_nonce'], 'wccs_sale_meta' ) ) {
            return;
        }
        if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
            return;
        }
        if ( ! current_user_can( 'edit_post', $post_id ) ) {
            return;
        }
        $value = isset( $_POST['wccs_sale_enabled'] ) ? '1' : '0';
        update_post_meta( $post_id, self::META_KEY, $value );
    }

    /* -------------------------------------------------------------------------
     * Helpers
     * ---------------------------------------------------------------------- */

    private function get_locations(): array {
        return (array) get_option( self::LOCATIONS_KEY, [] );
    }

    private function default_time_slots(): array {
        return [
            '08:00-10:00' => '08:00 – 10:00 AM',
            '10:00-12:00' => '10:00 AM – 12:00 PM',
            '12:00-14:00' => '12:00 – 02:00 PM',
            '14:00-16:00' => '02:00 – 04:00 PM',
            '16:00-18:00' => '04:00 – 06:00 PM',
            '18:00-20:00' => '06:00 – 08:00 PM',
        ];
    }
}