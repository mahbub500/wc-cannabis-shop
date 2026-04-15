<?php
namespace WCCannabisShop\Admin;

class Admin {

    private const META_KEY_SALE = '_wccs_sale_enabled';
    private const OPTION_KEY    = 'wccs_settings';

    public function init(): void {
        add_action( 'admin_menu',        [ $this, 'add_menu' ] );
        add_action( 'add_meta_boxes',    [ $this, 'add_sale_meta_box' ] );
        add_action( 'save_post_product', [ $this, 'save_sale_meta' ] );
        add_action( 'admin_init',        [ $this, 'register_settings' ] );
        add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_admin_assets' ] );
    }

    /* =========================================================
       Enqueue CSS + JS on our settings page only
    ========================================================= */
    public function enqueue_admin_assets( string $hook ): void {
        if ( $hook !== 'toplevel_page_wccs-settings' ) {
            return;
        }

        // Leaflet
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

        // Our own CSS (assets/css/admin-settings.css)
        wp_enqueue_style(
            'wccs-admin-css',
            WCCS_URL . 'assets/css/admin-settings.css',
            [ 'wccs-leaflet-css' ],
            WCCS_VERSION
        );

        // Our own JS (assets/js/admin-settings.js) — replaces old admin-map.js
        wp_enqueue_script(
            'wccs-admin-js',
            WCCS_URL . 'assets/js/admin-settings.js',
            [ 'wccs-leaflet-js' ],
            WCCS_VERSION,
            true
        );
    }

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

    public function register_settings(): void {
        register_setting( 'wccs_settings_group', self::OPTION_KEY );
    }

    /* =========================================================
       Settings Page (tabbed)
    ========================================================= */
    public function render_settings(): void {
        $options = get_option( self::OPTION_KEY, [
            'title'      => '',
            'location'   => '',
            'latitude'   => '',
            'longitude'  => '',
            'time_slots' => [],
        ] );

        // Pass map seed data before our JS file loads
        ?>
        <script>
        window.wccsMapData = {
            lat: <?php echo $options['latitude'] ? esc_js( $options['latitude'] ) : '23.8103'; ?>,
            lng: <?php echo $options['longitude'] ? esc_js( $options['longitude'] ) : '90.4125'; ?>,
            hasLocation: <?php echo $options['location'] ? 'true' : 'false'; ?>,
        };
        </script>

        <div class="wrap wccs-settings-page">
            <h1>WC Cannabis Shop Settings</h1>

            <!-- ── Tab Navigation ── -->
            <nav class="wccs-tab-nav" role="tablist">
                <button type="button"
                        class="wccs-tab-btn wccs-tab-active"
                        data-tab="settings"
                        role="tab"
                        aria-controls="wccs-panel-settings"
                        aria-selected="true">
                    ⚙️ Settings
                </button>
                <button type="button"
                        class="wccs-tab-btn"
                        data-tab="slots"
                        role="tab"
                        aria-controls="wccs-panel-slots"
                        aria-selected="false">
                    🕐 All Time Slots
                </button>
            </nav>

            <!-- ══════════════════════════════════════════════
                 TAB 1 — Settings (form)
            ══════════════════════════════════════════════ -->
            <div id="wccs-panel-settings"
                 class="wccs-tab-panel wccs-panel-active"
                 role="tabpanel"
                 aria-labelledby="wccs-tab-settings">

                <form method="post" action="options.php">
                    <?php settings_fields( 'wccs_settings_group' ); ?>

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

                    <!-- Store Location with Map -->
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
                                               placeholder="Search for a location (address or place name)"
                                               autocomplete="off">
                                        <button type="button" class="button wccs-search-location-btn" id="wccs-search-location-btn">
                                            Search
                                        </button>
                                    </div>
                                    <div class="wccs-location-details" id="wccs-location-details">
                                        <input type="hidden"
                                               id="wccs_latitude"
                                               name="<?php echo self::OPTION_KEY; ?>[latitude]"
                                               value="<?php echo esc_attr( $options['latitude'] ?? '' ); ?>">
                                        <input type="hidden"
                                               id="wccs_longitude"
                                               name="<?php echo self::OPTION_KEY; ?>[longitude]"
                                               value="<?php echo esc_attr( $options['longitude'] ?? '' ); ?>">
                                        <p class="wccs-selected-location" id="wccs-selected-location">
                                            <?php echo $options['location']
                                                ? 'Selected: ' . esc_html( $options['location'] )
                                                : 'Click on the map or search to set location'; ?>
                                        </p>
                                    </div>
                                    <div id="wccs-map" style="height:300px; margin-top:12px; border:1px solid #ccd0d4; border-radius:4px;"></div>
                                    <p class="description">Click on the map to set your store location, or search above.</p>
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
                                        <input type="text"
                                               id="wccs-slot-label"
                                               placeholder="Label (e.g. Morning)"
                                               class="regular-text"
                                               style="width:200px; margin-right:8px;">
                                        <input type="time" id="wccs-slot-start" style="margin-right:8px;">
                                        <span style="margin:0 8px;">to</span>
                                        <input type="time" id="wccs-slot-end" style="margin:0 8px;">
                                        <button type="button" class="button" id="wccs-add-slot-btn">Add Slot</button>
                                    </div>

                                    <div id="wccs-time-slots-list">
                                        <?php
                                        $slots = $options['time_slots'] ?? [];
                                        if ( is_array( $slots ) ) :
                                            foreach ( $slots as $i => $slot ) :
                                                ?>
                                                <div class="wccs-time-slot" data-index="<?php echo esc_attr( $i ); ?>">
                                                    <input type="hidden"
                                                           name="<?php echo self::OPTION_KEY; ?>[time_slots][<?php echo esc_attr( $i ); ?>][label]"
                                                           value="<?php echo esc_attr( $slot['label'] ?? '' ); ?>">
                                                    <input type="hidden"
                                                           name="<?php echo self::OPTION_KEY; ?>[time_slots][<?php echo esc_attr( $i ); ?>][start]"
                                                           value="<?php echo esc_attr( $slot['start'] ?? '' ); ?>">
                                                    <input type="hidden"
                                                           name="<?php echo self::OPTION_KEY; ?>[time_slots][<?php echo esc_attr( $i ); ?>][end]"
                                                           value="<?php echo esc_attr( $slot['end'] ?? '' ); ?>">
                                                    <span class="wccs-slot-display">
                                                        <strong><?php echo esc_html( $slot['label'] ?? '' ); ?></strong>
                                                        <?php echo esc_html( $slot['start'] ?? '' ); ?> – <?php echo esc_html( $slot['end'] ?? '' ); ?>
                                                    </span>
                                                    <button type="button" class="wccs-remove-slot-btn" aria-label="Remove slot">×</button>
                                                </div>
                                                <?php
                                            endforeach;
                                        endif;
                                        ?>
                                    </div>

                                    <p class="description">Add time slots for delivery or pickup scheduling.</p>
                                </div>
                            </td>
                        </tr>
                    </table>

                    <?php submit_button( 'Save Settings' ); ?>
                </form>
            </div><!-- /#wccs-panel-settings -->

            <!-- ══════════════════════════════════════════════
                 TAB 2 — All Time Slots (read-only list)
            ══════════════════════════════════════════════ -->
            <div id="wccs-panel-slots"
                 class="wccs-tab-panel"
                 role="tabpanel"
                 aria-labelledby="wccs-tab-slots">

                <div class="wccs-slots-table-wrap">
                    <p style="margin-bottom:12px;color:#646970;font-size:13px;">
                        All currently saved delivery time slots. To add or remove slots, switch to the <strong>Settings</strong> tab.
                    </p>

                    <?php $slots = $options['time_slots'] ?? []; ?>

                    <?php if ( empty( $slots ) ) : ?>
                        <p class="wccs-slots-empty">No time slots have been added yet.</p>
                    <?php else : ?>
                        <table class="wccs-slots-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Label</th>
                                    <th>Time Range</th>
                                </tr>
                            </thead>
                            <tbody id="wccs-slots-tbody">
                                <?php foreach ( $slots as $i => $slot ) : ?>
                                    <tr>
                                        <td><?php echo esc_html( $i + 1 ); ?></td>
                                        <td><span class="wccs-slot-badge"><?php echo esc_html( $slot['label'] ?? '' ); ?></span></td>
                                        <td class="wccs-slot-time">
                                            <?php echo esc_html( $slot['start'] ?? '' ); ?> &ndash; <?php echo esc_html( $slot['end'] ?? '' ); ?>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    <?php endif; ?>

                    <!-- JS will inject a tbody here if slots table isn't rendered server-side yet -->
                    <?php if ( empty( $slots ) ) : ?>
                        <table class="wccs-slots-table" style="display:none" id="wccs-slots-table-dynamic">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Label</th>
                                    <th>Time Range</th>
                                </tr>
                            </thead>
                            <tbody id="wccs-slots-tbody"></tbody>
                        </table>
                    <?php endif; ?>
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