<?php
namespace WCCannabisShop\Admin;

class Admin {

    private const META_KEY_SALE = '_wccs_sale_enabled';
    private const OPTION_KEY    = 'wccs_settings';

    public function init(): void {
        add_action( 'admin_menu',            [ $this, 'add_menu' ] );
        add_action( 'add_meta_boxes',        [ $this, 'add_sale_meta_box' ] );
        add_action( 'save_post_product',     [ $this, 'save_sale_meta' ] );
        add_action( 'admin_init',            [ $this, 'register_settings' ] );
        add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_admin_assets' ] );
        add_action( 'wp_ajax_wccs_save_settings', [ $this, 'ajax_save_settings' ] );
    }

    /* =========================================================
       Register setting with sanitize callback
       (prevents WordPress from stripping the nested array)
    ========================================================= */
    public function register_settings(): void {
        register_setting(
            'wccs_settings_group',
            self::OPTION_KEY,
            [
                'sanitize_callback' => [ $this, 'sanitize_options' ],
                'default'           => [
                    'title'      => '',
                    'location'   => '',
                    'latitude'   => '',
                    'longitude'  => '',
                    'time_slots' => [],
                ],
            ]
        );
    }

    public function sanitize_options( $input ): array {
        $clean = [];
        $clean['title']     = sanitize_text_field( $input['title']     ?? '' );
        $clean['location']  = sanitize_text_field( $input['location']  ?? '' );
        $clean['latitude']  = sanitize_text_field( $input['latitude']  ?? '' );
        $clean['longitude'] = sanitize_text_field( $input['longitude'] ?? '' );

        $clean['time_slots'] = [];
        if ( ! empty( $input['time_slots'] ) && is_array( $input['time_slots'] ) ) {
            foreach ( array_values( $input['time_slots'] ) as $slot ) {
                if ( empty( $slot['label'] ) && empty( $slot['start'] ) ) {
                    continue;
                }
                $clean['time_slots'][] = [
                    'label' => sanitize_text_field( $slot['label'] ?? '' ),
                    'start' => sanitize_text_field( $slot['start'] ?? '' ),
                    'end'   => sanitize_text_field( $slot['end']   ?? '' ),
                ];
            }
        }

        return $clean;
    }

    /* =========================================================
       AJAX Save — form submits here via jQuery so the page
       stays on the same tab and no redirect happens
    ========================================================= */
    public function ajax_save_settings(): void {
        check_ajax_referer( 'wccs_ajax_nonce', 'nonce' );

        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( [ 'message' => 'Permission denied.' ], 403 );
        }

        $raw = [];
        parse_str( $_POST['form_data'] ?? '', $raw );

        $input = $raw[ self::OPTION_KEY ] ?? [];
        $clean = $this->sanitize_options( $input );

        update_option( self::OPTION_KEY, $clean );

        wp_send_json_success( [
            'message'    => 'Settings saved successfully.',
            'time_slots' => $clean['time_slots'],
        ] );
    }

    /* =========================================================
       Enqueue assets — our page only
    ========================================================= */
    public function enqueue_admin_assets( string $hook ): void {
        if ( $hook !== 'toplevel_page_wccs-settings' ) {
            return;
        }

        wp_enqueue_style(
            'wccs-leaflet-css',
            'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
            [],
            '1.9.4'
        );
        wp_enqueue_script(
            'wccs-leaflet-js',
            'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
            [],
            '1.9.4',
            true
        );

        wp_enqueue_style(
            'wccs-admin-css',
            WCCS_URL . 'assets/css/admin-settings.css',
            [ 'wccs-leaflet-css' ],
            WCCS_VERSION
        );

        // Depends on WordPress-bundled jQuery + Leaflet
        wp_enqueue_script(
            'wccs-admin-js',
            WCCS_URL . 'assets/js/admin-settings.js',
            [ 'jquery', 'wccs-leaflet-js' ],
            WCCS_VERSION,
            true
        );

        $options = get_option( self::OPTION_KEY, [
            'title'      => '',
            'location'   => '',
            'latitude'   => '',
            'longitude'  => '',
            'time_slots' => [],
        ] );

        // All PHP data available to JS as wccsData global
        wp_localize_script( 'wccs-admin-js', 'wccsData', [
            'ajaxUrl'     => admin_url( 'admin-ajax.php' ),
            'nonce'       => wp_create_nonce( 'wccs_ajax_nonce' ),
            'lat'         => $options['latitude']  ?: '23.8103',
            'lng'         => $options['longitude'] ?: '90.4125',
            'hasLocation' => ! empty( $options['location'] ),
            'timeSlots'   => array_values( $options['time_slots'] ?? [] ),
        ] );
    }

    /* =========================================================
       Admin Menu
    ========================================================= */
    public function add_menu(): void {
        add_menu_page(
            'WC Cannabis Shop',
            'WC Cannabis Shop',
            'manage_options',
            'wccs-settings',
            [ $this, 'render_settings' ],
            'dashicons-store',
            56
        );
    }

    /* =========================================================
       Settings Page HTML
    ========================================================= */
    public function render_settings(): void {
        $options = get_option( self::OPTION_KEY, [
            'title'      => '',
            'location'   => '',
            'latitude'   => '',
            'longitude'  => '',
            'time_slots' => [],
        ] );

        $slots = array_values( $options['time_slots'] ?? [] );
        ?>

        <div class="wrap wccs-settings-page">
            <h1>WC Cannabis Shop Settings</h1>

            <!-- JS-driven notices -->
            <div id="wccs-save-notice" class="notice notice-success is-dismissible" style="display:none;">
                <p><strong>Settings saved successfully.</strong></p>
            </div>
            <div id="wccs-save-error" class="notice notice-error is-dismissible" style="display:none;">
                <p id="wccs-save-error-msg"><strong>Error saving settings.</strong></p>
            </div>

            <!-- ── Tab Navigation ── -->
            <nav class="wccs-tab-nav" role="tablist">
                <button type="button" class="wccs-tab-btn wccs-tab-active" data-tab="settings" role="tab" aria-selected="true">
                    ⚙️ Settings
                </button>
                <button type="button" class="wccs-tab-btn" data-tab="slots" role="tab" aria-selected="false">
                    🕐 All Time Slots
                    <span class="wccs-slot-count" id="wccs-slot-count"><?php echo count( $slots ); ?></span>
                </button>
            </nav>

            <!-- ══════════════════════════════════════════════
                 TAB 1 — Settings Form
            ══════════════════════════════════════════════ -->
            <div id="wccs-panel-settings" class="wccs-tab-panel wccs-panel-active">

                <form id="wccs-settings-form">

                    <!-- Shop Title -->
                    <table class="form-table" role="presentation">
                        <tr>
                            <th><label for="wccs_title">Shop Title</label></th>
                            <td>
                                <input type="text"
                                       id="wccs_title"
                                       name="<?php echo self::OPTION_KEY; ?>[title]"
                                       value="<?php echo esc_attr( $options['title'] ?? '' ); ?>"
                                       class="regular-text"
                                       placeholder="Enter shop title">
                                <p class="description">This title appears in the shop page header.</p>
                            </td>
                        </tr>
                    </table>

                    <!-- Store Location -->
                    <table class="form-table" role="presentation">
                        <tr>
                            <th><label>Store Location</label></th>
                            <td>
                                <div class="wccs-location-wrap">
                                    <div class="wccs-location-inputs">
                                        <input type="text"
                                               id="wccs_location"
                                               name="<?php echo self::OPTION_KEY; ?>[location]"
                                               value="<?php echo esc_attr( $options['location'] ?? '' ); ?>"
                                               class="regular-text"
                                               placeholder="Search for an address or place name"
                                               autocomplete="off">
                                        <button type="button" class="button" id="wccs-search-location-btn">🔍 Search</button>
                                        <button type="button" class="button" id="wccs-current-location-btn" title="Use my current location">📍 My Location</button>
                                    </div>
                                    <div class="wccs-location-details">
                                        <input type="hidden" id="wccs_latitude"  name="<?php echo self::OPTION_KEY; ?>[latitude]"  value="<?php echo esc_attr( $options['latitude']  ?? '' ); ?>">
                                        <input type="hidden" id="wccs_longitude" name="<?php echo self::OPTION_KEY; ?>[longitude]" value="<?php echo esc_attr( $options['longitude'] ?? '' ); ?>">
                                        <p class="wccs-selected-location" id="wccs-selected-location">
                                            <?php echo ! empty( $options['location'] )
                                                ? '📍 ' . esc_html( $options['location'] )
                                                : 'Click the map, drag the pin, search, or use My Location.'; ?>
                                        </p>
                                    </div>
                                    <div id="wccs-map"></div>
                                    <p class="description">Drag the pin or click anywhere on the map to set coordinates. The address field updates automatically.</p>
                                </div>
                            </td>
                        </tr>
                    </table>

                    <!-- Delivery Time Slots -->
                    <table class="form-table" role="presentation">
                        <tr>
                            <th><label>Delivery Time Slots</label></th>
                            <td>
                                <div class="wccs-time-slots-wrap">
                                    <div class="wccs-add-time-slot">
                                        <input type="text" id="wccs-slot-label" placeholder="Label (e.g. Morning)" style="width:180px;">
                                        <input type="time" id="wccs-slot-start">
                                        <span class="wccs-to-label">to</span>
                                        <input type="time" id="wccs-slot-end">
                                        <button type="button" class="button button-primary" id="wccs-add-slot-btn">+ Add Slot</button>
                                    </div>

                                    <div id="wccs-time-slots-list">
                                        <?php foreach ( $slots as $i => $slot ) : ?>
                                            <div class="wccs-time-slot" data-index="<?php echo esc_attr( $i ); ?>">
                                                <input type="hidden" name="<?php echo self::OPTION_KEY; ?>[time_slots][<?php echo $i; ?>][label]" value="<?php echo esc_attr( $slot['label'] ?? '' ); ?>">
                                                <input type="hidden" name="<?php echo self::OPTION_KEY; ?>[time_slots][<?php echo $i; ?>][start]" value="<?php echo esc_attr( $slot['start'] ?? '' ); ?>">
                                                <input type="hidden" name="<?php echo self::OPTION_KEY; ?>[time_slots][<?php echo $i; ?>][end]"   value="<?php echo esc_attr( $slot['end']   ?? '' ); ?>">
                                                <span class="wccs-slot-display">
                                                    <strong><?php echo esc_html( $slot['label'] ?? '' ); ?></strong>
                                                    &nbsp;<?php echo esc_html( $slot['start'] ?? '' ); ?> – <?php echo esc_html( $slot['end'] ?? '' ); ?>
                                                </span>
                                                <button type="button" class="wccs-remove-slot-btn" aria-label="Remove slot">×</button>
                                            </div>
                                        <?php endforeach; ?>
                                    </div>

                                    <p class="description">Add time slots for delivery or pickup scheduling.</p>
                                </div>
                            </td>
                        </tr>
                    </table>

                    <p class="submit">
                        <button type="submit" id="wccs-save-btn" class="button button-primary button-large">
                            💾 Save Settings
                        </button>
                        <span id="wccs-saving-spinner" class="spinner" style="float:none;vertical-align:middle;visibility:hidden;"></span>
                    </p>
                </form>

            </div><!-- /#wccs-panel-settings -->

            <!-- ══════════════════════════════════════════════
                 TAB 2 — All Time Slots (live, updated on save)
            ══════════════════════════════════════════════ -->
            <div id="wccs-panel-slots" class="wccs-tab-panel">
                <div class="wccs-slots-table-wrap">
                    <p class="wccs-slots-intro">
                        All saved delivery time slots. Add or remove them in the <strong>Settings</strong> tab, then hit Save.
                    </p>

                    <div id="wccs-slots-empty-msg" <?php echo ! empty( $slots ) ? 'style="display:none"' : ''; ?>>
                        <p class="wccs-slots-empty">No time slots have been added yet.</p>
                    </div>

                    <table class="wccs-slots-table" id="wccs-slots-table" <?php echo empty( $slots ) ? 'style="display:none"' : ''; ?>>
                        <thead>
                            <tr>
                                <th style="width:44px">#</th>
                                <th>Label</th>
                                <th>Time Range</th>
                            </tr>
                        </thead>
                        <tbody id="wccs-slots-tbody">
                            <?php foreach ( $slots as $i => $slot ) : ?>
                                <tr>
                                    <td><?php echo $i + 1; ?></td>
                                    <td><span class="wccs-slot-badge"><?php echo esc_html( $slot['label'] ?? '' ); ?></span></td>
                                    <td class="wccs-slot-time"><?php echo esc_html( $slot['start'] ?? '' ); ?> &ndash; <?php echo esc_html( $slot['end'] ?? '' ); ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </div><!-- /#wccs-panel-slots -->

        </div><!-- /.wrap -->
        <?php
    }

    /* =========================================================
       Product Sale Meta Box
    ========================================================= */
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
        $checked = get_post_meta( $post->ID, self::META_KEY_SALE, true );
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
        update_post_meta( $post_id, self::META_KEY_SALE, $value );
    }
}