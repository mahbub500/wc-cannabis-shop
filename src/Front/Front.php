<?php
namespace WCCannabisShop\Front;

use WCCannabisShop\Front\ProductQuery;
use WCCannabisShop\Front\ShortcodeRenderer;

class Front {

    public function init(): void {
        add_shortcode( 'cannabis_shop', [ $this, 'render_shortcode' ] );
        add_action( 'wp_enqueue_scripts',          [ $this, 'enqueue_assets' ] );

        // ── Existing cart/product AJAX ───────────────────────────────────────
        add_action( 'wp_ajax_wccs_get_products',        [ $this, 'ajax_get_products' ] );
        add_action( 'wp_ajax_nopriv_wccs_get_products', [ $this, 'ajax_get_products' ] );
        add_action( 'wp_ajax_wccs_add_to_cart',         [ $this, 'ajax_add_to_cart' ] );
        add_action( 'wp_ajax_nopriv_wccs_add_to_cart',  [ $this, 'ajax_add_to_cart' ] );
        add_action( 'wp_ajax_wccs_get_cart_data',       [ $this, 'ajax_get_cart_data' ] );
        add_action( 'wp_ajax_nopriv_wccs_get_cart_data',[ $this, 'ajax_get_cart_data' ] );
        add_action( 'wp_ajax_wccs_remove_from_cart',        [ $this, 'ajax_remove_from_cart' ] );
        add_action( 'wp_ajax_nopriv_wccs_remove_from_cart', [ $this, 'ajax_remove_from_cart' ] );
        add_action( 'wp_ajax_wccs_update_cart_qty',         [ $this, 'ajax_update_cart_qty' ] );
        add_action( 'wp_ajax_nopriv_wccs_update_cart_qty',  [ $this, 'ajax_update_cart_qty' ] );
        add_action( 'wp_ajax_wccs_clear_cart',          [ $this, 'ajax_clear_cart' ] );
        add_action( 'wp_ajax_nopriv_wccs_clear_cart',   [ $this, 'ajax_clear_cart' ] );

        // ── NEW: Fulfilment bar AJAX ─────────────────────────────────────────
        add_action( 'wp_ajax_wccs_get_locations',           [ $this, 'ajax_get_locations' ] );
        add_action( 'wp_ajax_nopriv_wccs_get_locations',    [ $this, 'ajax_get_locations' ] );
        add_action( 'wp_ajax_wccs_save_fulfilment',         [ $this, 'ajax_save_fulfilment' ] );
        add_action( 'wp_ajax_nopriv_wccs_save_fulfilment',  [ $this, 'ajax_save_fulfilment' ] );

        // ── NEW: Inject saved fulfilment into WC checkout ───────────────────
        add_action( 'woocommerce_checkout_init',               [ $this, 'prefill_checkout_from_session' ] );
        add_filter( 'woocommerce_checkout_fields',             [ $this, 'add_fulfilment_checkout_fields' ] );
        add_action( 'woocommerce_checkout_update_order_meta',  [ $this, 'save_fulfilment_order_meta' ] );
        add_action( 'woocommerce_admin_order_data_after_billing_address', [ $this, 'display_fulfilment_admin_meta' ], 10, 1 );
        // Clear session once order is fully complete
        add_action( 'woocommerce_order_status_completed',      [ $this, 'clear_fulfilment_session_on_complete' ] );
        add_action( 'woocommerce_thankyou',                    [ $this, 'clear_fulfilment_session_on_complete' ] );
    }

    /* =========================================================================
     * Asset enqueue
     * ====================================================================== */

    public function enqueue_assets(): void {
        global $post;
        if ( ! is_a( $post, 'WP_Post' ) || ! has_shortcode( $post->post_content, 'cannabis_shop' ) ) {
            return;
        }

        // Leaflet — only needed for the Pickup tab map
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

        wp_enqueue_style(
            'wccs-style',
            WCCS_URL . 'assets/css/shop.css',
            [ 'leaflet' ],
            WCCS_VERSION
        );

        wp_enqueue_style(
            'wccs-bar-style',
            WCCS_URL . 'assets/css/fulfilment-bar.css',
            [ 'leaflet' ],
            WCCS_VERSION
        );

        wp_enqueue_script(
            'wccs-script',
            WCCS_URL . 'assets/js/shop.js',
            [ 'jquery' ],
            WCCS_VERSION,
            true
        );

        wp_enqueue_script(
            'wccs-bar-script',
            WCCS_URL . 'assets/js/fulfilment-bar.js',
            [ 'jquery', 'leaflet' ],
            WCCS_VERSION,
            true
        );

        // Shared localize (shop.js picks up wccs, bar picks up wccsFul)
        wp_localize_script( 'wccs-script', 'wccs', [
            'ajax_url'   => admin_url( 'admin-ajax.php' ),
            'nonce'      => wp_create_nonce( 'wccs_nonce' ),
            'cart_nonce' => wp_create_nonce( 'wccs_add_to_cart' ),
        ] );

        wp_localize_script( 'wccs-bar-script', 'wccsFul', [
            'ajax_url' => admin_url( 'admin-ajax.php' ),
            'nonce'    => wp_create_nonce( 'wccs_nonce' ),
            'saved'    => $this->get_session_fulfilment(),   // pre-populate forms
            'strings'  => [
                'selectLocation' => __( 'Select a location from the list', 'wc-cannabis-shop' ),
                'saved'          => __( 'Saved!', 'wc-cannabis-shop' ),
                'saving'         => __( 'Saving…', 'wc-cannabis-shop' ),
                'locError'       => __( 'Could not get your location.', 'wc-cannabis-shop' ),
            ],
        ] );
    }

    /* =========================================================================
     * Shortcode
     * ====================================================================== */

    public function render_shortcode( array $atts ): string {
        $atts = shortcode_atts( [
            'columns'  => 3,
            'per_page' => 12,
            'category' => '',
        ], $atts );

        // Render the fulfilment bar then the product grid
        $bar      = $this->render_fulfilment_bar();
        $renderer = new ShortcodeRenderer( $atts );

        return $bar . $renderer->render();
    }

    /* =========================================================================
     * Fulfilment bar HTML — single button + modal
     * ====================================================================== */

    private function render_fulfilment_bar(): string {
        $saved = $this->get_session_fulfilment();
        $mode  = $saved['mode'] ?? '';

        // Build button label from saved session
        $btn_label = __( 'Select Pickup / Delivery', 'wc-cannabis-shop' );
        if ( $mode === 'pickup' && ! empty( $saved['pickup_title'] ) ) {
            $btn_label = '📍 ' . $saved['pickup_title'];
        } elseif ( $mode === 'delivery' && ! empty( $saved['delivery_address'] ) ) {
            $btn_label = '🚚 ' . mb_strimwidth( $saved['delivery_address'], 0, 35, '…' );
        } elseif ( $mode === 'mail' && ! empty( $saved['mail_address'] ) ) {
            $btn_label = '✉️ ' . mb_strimwidth( $saved['mail_address'], 0, 35, '…' );
        }

        ob_start();
        ?>

        <!-- ── Fulfilment bar ─────────────────────────────────────────────── -->
        <div id="wccs-fulfilment-bar" class="wccs-fulfilment-bar">
            <button id="wccs-ful-open-btn" class="wccs-ful-open-btn" type="button">
                <span class="wccs-ful-open-btn__icon">🛒</span>
                <span class="wccs-ful-open-btn__label" id="wccs-ful-btn-label">
                    <?php echo esc_html( $btn_label ); ?>
                </span>
                <span class="wccs-ful-open-btn__arrow">▾</span>
            </button>
        </div>

        <!-- ── Modal overlay ─────────────────────────────────────────────── -->
        <div id="wccs-ful-modal-overlay" class="wccs-ful-modal-overlay" role="dialog" aria-modal="true" aria-label="<?php esc_attr_e( 'Choose fulfilment method', 'wc-cannabis-shop' ); ?>">
            <div class="wccs-ful-modal">

                <!-- Modal header -->
                <div class="wccs-ful-modal__header">
                    <h2 class="wccs-ful-modal__title">
                        <?php esc_html_e( 'How would you like to receive your order?', 'wc-cannabis-shop' ); ?>
                    </h2>
                    <button id="wccs-ful-close-btn" class="wccs-ful-close-btn" type="button" aria-label="Close">✕</button>
                </div>

                <!-- Modal tabs -->
                <div class="wccs-ful-modal__tabs" role="tablist">
                    <button class="wccs-ful-tab is-active" data-tab="pickup" role="tab">
                        <span>📍</span> <?php esc_html_e( 'Pickup', 'wc-cannabis-shop' ); ?>
                    </button>
                    <button class="wccs-ful-tab" data-tab="delivery" role="tab">
                        <span>🚚</span> <?php esc_html_e( 'Delivery', 'wc-cannabis-shop' ); ?>
                    </button>
                    <button class="wccs-ful-tab" data-tab="mail" role="tab">
                        <span>✉️</span> <?php esc_html_e( 'Mail', 'wc-cannabis-shop' ); ?>
                    </button>
                </div>

                <!-- Modal body -->
                <div class="wccs-ful-modal__body">

                    <!-- ── Tab: Pickup ──────────────────────────────────── -->
                    <div id="wccs-panel-pickup" class="wccs-ful-panel is-active" role="tabpanel">
                        <div class="wccs-pickup-inner">

                            <!-- Location list -->
                            <div class="wccs-pickup-list" id="wccs-pickup-list">
                                <div class="wccs-pickup-list__loading">
                                    <span class="wccs-spinner"></span>
                                    <?php esc_html_e( 'Loading locations…', 'wc-cannabis-shop' ); ?>
                                </div>
                            </div>

                            <!-- Map -->
                            <div class="wccs-pickup-map-wrap">
                                <div id="wccs-pickup-map" class="wccs-pickup-map"></div>
                                <div class="wccs-pickup-map__placeholder" id="wccs-map-placeholder">
                                    <span>🗺️</span>
                                    <p><?php esc_html_e( 'Select a location to see it on the map', 'wc-cannabis-shop' ); ?></p>
                                </div>
                            </div>

                        </div>

                        <!-- Confirm row -->
                        <div class="wccs-pickup-confirm">
                            <button class="wccs-ful-save-btn" id="wccs-pickup-save-btn" type="button" disabled>
                                ✅ <?php esc_html_e( 'Confirm Pickup', 'wc-cannabis-shop' ); ?>
                            </button>
                            <span class="wccs-ful-form__msg" id="wccs-pickup-msg"></span>
                        </div>
                    </div>

                    <!-- ── Tab: Delivery ────────────────────────────────── -->
                    <div id="wccs-panel-delivery" class="wccs-ful-panel" role="tabpanel">
                        <form id="wccs-delivery-form" class="wccs-ful-form" novalidate>
                            <div class="wccs-ful-field">
                                <label for="wccs_del_address">
                                    🚚 <?php esc_html_e( 'Delivery Address', 'wc-cannabis-shop' ); ?>
                                    <span class="req">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="wccs_del_address"
                                    name="delivery_address"
                                    required
                                    placeholder="<?php esc_attr_e( 'Enter your full delivery address…', 'wc-cannabis-shop' ); ?>"
                                    value="<?php echo esc_attr( $saved['delivery_address'] ?? '' ); ?>"
                                >
                            </div>
                            <div class="wccs-ful-form__footer">
                                <button type="submit" class="wccs-ful-save-btn">
                                    💾 <?php esc_html_e( 'Save & Close', 'wc-cannabis-shop' ); ?>
                                </button>
                                <span class="wccs-ful-form__msg" id="wccs-delivery-msg"></span>
                            </div>
                        </form>
                    </div>

                    <!-- ── Tab: Mail ────────────────────────────────────── -->
                    <div id="wccs-panel-mail" class="wccs-ful-panel" role="tabpanel">
                        <form id="wccs-mail-form" class="wccs-ful-form" novalidate>
                            <div class="wccs-ful-field">
                                <label for="wccs_mail_address">
                                    ✉️ <?php esc_html_e( 'Mailing Address', 'wc-cannabis-shop' ); ?>
                                    <span class="req">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="wccs_mail_address"
                                    name="mail_address"
                                    required
                                    placeholder="<?php esc_attr_e( 'Enter your mailing address…', 'wc-cannabis-shop' ); ?>"
                                    value="<?php echo esc_attr( $saved['mail_address'] ?? '' ); ?>"
                                >
                            </div>
                            <div class="wccs-ful-form__footer">
                                <button type="submit" class="wccs-ful-save-btn">
                                    💾 <?php esc_html_e( 'Save & Close', 'wc-cannabis-shop' ); ?>
                                </button>
                                <span class="wccs-ful-form__msg" id="wccs-mail-msg"></span>
                            </div>
                        </form>
                    </div>

                </div><!-- .wccs-ful-modal__body -->
            </div><!-- .wccs-ful-modal -->
        </div><!-- #wccs-ful-modal-overlay -->

        <?php
        return ob_get_clean();
    }

    /* =========================================================================
     * AJAX — get pickup locations (public)
     * ====================================================================== */

    public function ajax_get_locations(): void {
        // No nonce check — this is a read-only public endpoint.
        // Locations are non-sensitive (title, address, lat/lng).

        $raw = get_option( 'wccs_pickup_locations' );

        // Paranoid unserialise: get_option does it automatically,
        // but guard against edge cases where it comes back as a string.
        if ( is_string( $raw ) && ! empty( $raw ) ) {
            $raw = maybe_unserialize( $raw );
        }

        if ( ! is_array( $raw ) || empty( $raw ) ) {
            wp_send_json_success( [] );
            return;
        }

        $out = [];
        foreach ( array_values( $raw ) as $i => $loc ) {
            if ( ! is_array( $loc ) ) {
                continue;
            }

            $slots = ( ! empty( $loc['time_slots'] ) && is_array( $loc['time_slots'] ) )
                ? array_values( array_map( 'sanitize_text_field', $loc['time_slots'] ) )
                : [];

            $out[] = [
                'id'         => $i,
                'title'      => sanitize_text_field( $loc['title']   ?? '' ),
                'address'    => sanitize_text_field( $loc['address'] ?? '' ),
                'lat'        => (float) ( $loc['lat'] ?? 0 ),
                'lng'        => (float) ( $loc['lng'] ?? 0 ),
                'time_slots' => $slots,
            ];
        }

        wp_send_json_success( $out );
    }

    /* =========================================================================
     * AJAX — save fulfilment choice to WC session
     * ====================================================================== */

    public function ajax_save_fulfilment(): void {
        check_ajax_referer( 'wccs_nonce', 'nonce' );

        $mode = sanitize_text_field( $_POST['mode'] ?? '' );
        if ( ! in_array( $mode, [ 'pickup', 'delivery', 'mail' ], true ) ) {
            wp_send_json_error( [ 'message' => 'Invalid mode.' ] );
        }

        $data = [ 'mode' => $mode ];

        if ( $mode === 'pickup' ) {
            $data['pickup_id']    = absint( $_POST['pickup_id']    ?? 0 );
            $data['pickup_title'] = sanitize_text_field( $_POST['pickup_title'] ?? '' );
            $data['pickup_slot']  = sanitize_text_field( $_POST['pickup_slot']  ?? '' );
            $data['pickup_lat']   = (float) ( $_POST['pickup_lat'] ?? 0 );
            $data['pickup_lng']   = (float) ( $_POST['pickup_lng'] ?? 0 );
        } elseif ( $mode === 'delivery' ) {
            $data['delivery_address']  = sanitize_text_field( $_POST['delivery_address']  ?? '' );
            $data['delivery_city']     = sanitize_text_field( $_POST['delivery_city']     ?? '' );
            $data['delivery_state']    = sanitize_text_field( $_POST['delivery_state']    ?? '' );
            $data['delivery_postcode'] = sanitize_text_field( $_POST['delivery_postcode'] ?? '' );
            $data['delivery_country']  = sanitize_text_field( $_POST['delivery_country']  ?? '' );
            $data['delivery_note']     = sanitize_text_field( $_POST['delivery_note']     ?? '' );
        } elseif ( $mode === 'mail' ) {
            $data['mail_first_name'] = sanitize_text_field( $_POST['mail_first_name'] ?? '' );
            $data['mail_last_name']  = sanitize_text_field( $_POST['mail_last_name']  ?? '' );
            $data['mail_address']    = sanitize_text_field( $_POST['mail_address']    ?? '' );
            $data['mail_city']       = sanitize_text_field( $_POST['mail_city']       ?? '' );
            $data['mail_postcode']   = sanitize_text_field( $_POST['mail_postcode']   ?? '' );
            $data['mail_country']    = sanitize_text_field( $_POST['mail_country']    ?? '' );
        }

        // Store in WooCommerce session
        if ( WC()->session ) {
            WC()->session->set( 'wccs_fulfilment', $data );
        }

        wp_send_json_success( $data );
    }

    /* =========================================================================
     * WC Checkout integration
     * ====================================================================== */

    /**
     * Pre-fill WC shipping/billing fields from session data.
     */
    public function prefill_checkout_from_session(): void {
        $data = $this->get_session_fulfilment();

        // var_dump( $data[''] );
        if ( empty( $data['mode'] ) ) {
            return;
        }

        $mode = $data['mode'];

        add_filter( 'woocommerce_checkout_get_value', function( $value, $input ) use ( $data, $mode ) {

            // var_dump( $data );
            $map = [];



            if ( $mode === 'delivery' ) {
                $addr = $data['delivery_address'] ?? '';
                $map  = [
                    // Billing
                    'billing_address_1' => $addr,
                    // Shipping (mirror)
                    // 'shipping_address_1' => $addr,
                    'order_comments'     => $data['delivery_note'] ?? '',
                ];
            }

            if ( $mode === 'mail' ) {
                $addr = $data['mail_address'] ?? '';
                $map  = [
                    'billing_city' => $addr,
                ];
            }

            return $map[ $input ] ?? $value;
        }, 20, 2 );
    }

    /**
     * Add a hidden fulfilment-mode field to checkout.
     */
    public function add_fulfilment_checkout_fields( array $fields ): array {
        $fields['order']['wccs_fulfilment_mode'] = [
            'type'    => 'hidden',
            'default' => $this->get_session_fulfilment()['mode'] ?? 'pickup',
        ];
        return $fields;
    }

    /**
     * Persist fulfilment data to order meta on checkout
     * and write billing_address_1 directly into the WC order object.
     */
    public function save_fulfilment_order_meta( int $order_id ): void {
        $data = $this->get_session_fulfilment();
        if ( empty( $data ) ) {
            return;
        }

        $mode = $data['mode'] ?? '';

        // Save raw data + human label to order meta
        update_post_meta( $order_id, '_wccs_fulfilment', $data );

        $label = match ( $mode ) {
            'pickup'   => '📍 ' . ( $data['pickup_title'] ?? '' ) . ' @ ' . ( $data['pickup_slot'] ?? '' ),
            'delivery' => '🚚 ' . ( $data['delivery_address'] ?? '' ),
            'mail'     => '✉️ ' . ( $data['mail_address'] ?? '' ),
            default    => '',
        };
        update_post_meta( $order_id, '_wccs_fulfilment_label', $label );

        // Write the address directly into the WC order billing fields
        $order = wc_get_order( $order_id );
        if ( ! $order ) {
            return;
        }

        if ( $mode === 'delivery' && ! empty( $data['delivery_address'] ) ) {
            $order->set_billing_address_1( sanitize_text_field( $data['delivery_address'] ) );
            $order->set_shipping_address_1( sanitize_text_field( $data['delivery_address'] ) );
            $order->save();
        }

        if ( $mode === 'mail' && ! empty( $data['mail_address'] ) ) {
            $order->set_billing_address_1( sanitize_text_field( $data['mail_address'] ) );
            $order->save();
        }
    }

    /**
     * Clear the fulfilment session after order is completed / on thank-you page.
     */
    public function clear_fulfilment_session_on_complete( int $order_id ): void {
        if ( WC()->session ) {
            WC()->session->__unset( 'wccs_fulfilment' );
        }
    }

    /**
     * Show fulfilment info in WC admin order screen.
     */
    public function display_fulfilment_admin_meta( \WC_Order $order ): void {
        $label = get_post_meta( $order->get_id(), '_wccs_fulfilment_label', true );
        if ( $label ) {
            echo '<p><strong>' . esc_html__( 'Fulfilment:', 'wc-cannabis-shop' ) . '</strong> ' . esc_html( $label ) . '</p>';
        }
    }

    /* =========================================================================
     * Helpers
     * ====================================================================== */

    private function get_session_fulfilment(): array {
        if ( ! WC()->session ) {
            return [];
        }
        return (array) ( WC()->session->get( 'wccs_fulfilment' ) ?? [] );
    }

    /* =========================================================================
     * Existing AJAX handlers (unchanged)
     * ====================================================================== */

    public function ajax_get_products(): void {
        check_ajax_referer( 'wccs_nonce', 'nonce' );

        $filters = [
            'category'  => sanitize_text_field( $_POST['category']  ?? '' ),
            'strain'    => sanitize_text_field( $_POST['strain']    ?? '' ),
            'search'    => sanitize_text_field( $_POST['search']    ?? '' ),
            'per_page'  => absint( $_POST['per_page']  ?? 12 ),
            'paged'     => absint( $_POST['paged']     ?? 1 ),
            'sale_only' => ! empty( $_POST['sale_only'] ),
            'price'     => sanitize_text_field( $_POST['price']     ?? '' ),
        ];

        $query    = new ProductQuery( $filters );
        $products = $query->get_products();

        ob_start();
        foreach ( $products as $product_id ) {
            $product = wc_get_product( $product_id );
            if ( ! $product ) { continue; }
            include WCCS_DIR . 'templates/product-card.php';
        }
        $html = ob_get_clean();

        wp_send_json_success( [
            'html'  => $html,
            'total' => $query->get_total(),
        ] );
    }

    public function ajax_add_to_cart(): void {
        check_ajax_referer( 'wccs_add_to_cart', 'nonce' );

        $product_id = absint( $_POST['product_id'] ?? 0 );
        $quantity   = absint( $_POST['quantity']   ?? 1 );

        if ( ! $product_id ) {
            wp_send_json_error( [ 'message' => 'Invalid product.' ] );
        }

        $product = wc_get_product( $product_id );
        if ( ! $product ) {
            wp_send_json_error( [ 'message' => 'Product not found.' ] );
        }

        $cart_item_key = WC()->cart->add_to_cart( $product_id, $quantity );

        if ( $cart_item_key ) {
            ob_start();
            woocommerce_mini_cart();
            $mini_cart = ob_get_clean();

            wp_send_json_success( [
                'cart_item_key' => $cart_item_key,
                'fragments'     => [
                    '.widget_shopping_cart_content' => '<div class="widget_shopping_cart_content">' . $mini_cart . '</div>',
                ],
                'cart_count'    => WC()->cart->get_cart_contents_count(),
                'cart_total'    => WC()->cart->get_cart_total(),
            ] );
        }

        wp_send_json_error( [ 'message' => 'Failed to add to cart.' ] );
    }

    public function ajax_get_cart_data(): void {
        check_ajax_referer( 'wccs_nonce', 'nonce' );

        $cart  = WC()->cart;
        $items = $this->build_cart_items( $cart );

        $raw_total = wp_strip_all_tags( $cart->get_cart_total() );

        wp_send_json_success( [
            'count' => $cart->get_cart_contents_count(),
            'total' => html_entity_decode( trim( $raw_total ), ENT_QUOTES, 'UTF-8' ),
            'items' => $items,
        ] );
    }

    public function ajax_remove_from_cart(): void {
        check_ajax_referer( 'wccs_nonce', 'nonce' );

        $cart_key = sanitize_text_field( $_POST['cart_key'] ?? '' );
        if ( ! $cart_key ) {
            wp_send_json_error( [ 'message' => 'Invalid cart key.' ] );
        }

        $cart    = WC()->cart;
        $removed = $cart->remove_cart_item( $cart_key );

        if ( $removed ) {
            $raw_total = wp_strip_all_tags( $cart->get_cart_total() );
            wp_send_json_success( [
                'count' => $cart->get_cart_contents_count(),
                'total' => html_entity_decode( trim( $raw_total ), ENT_QUOTES, 'UTF-8' ),
                'items' => $this->build_cart_items( $cart ),
            ] );
        }

        wp_send_json_error( [ 'message' => 'Failed to remove item.' ] );
    }

    public function ajax_update_cart_qty(): void {
        check_ajax_referer( 'wccs_nonce', 'nonce' );

        $cart_key = sanitize_text_field( $_POST['cart_key'] ?? '' );
        $quantity = absint( $_POST['quantity'] ?? 1 );

        if ( ! $cart_key || $quantity < 1 ) {
            wp_send_json_error( [ 'message' => 'Invalid data.' ] );
        }

        $cart    = WC()->cart;
        $updated = $cart->set_quantity( $cart_key, $quantity );

        if ( $updated ) {
            $raw_total = wp_strip_all_tags( $cart->get_cart_total() );
            wp_send_json_success( [
                'count' => $cart->get_cart_contents_count(),
                'total' => html_entity_decode( trim( $raw_total ), ENT_QUOTES, 'UTF-8' ),
                'items' => $this->build_cart_items( $cart ),
            ] );
        }

        wp_send_json_error( [ 'message' => 'Failed to update quantity.' ] );
    }

    public function ajax_clear_cart(): void {
        check_ajax_referer( 'wccs_nonce', 'nonce' );
        WC()->cart->empty_cart();
        wp_send_json_success( [
            'count' => 0,
            'total' => wc_price( 0 ),
            'items' => [],
        ] );
    }

    /**
     * DRY helper — build cart items array (used by get/remove/update handlers).
     */
    private function build_cart_items( \WC_Cart $cart ): array {
        $items = [];
        foreach ( $cart->get_cart() as $cart_item_key => $cart_item ) {
            $product   = $cart_item['data'];
            $image_id  = $product->get_image_id();
            $image_url = $image_id
                ? wp_get_attachment_image_url( $image_id, [ 48, 48 ] )
                : wc_placeholder_img_src( [ 48, 48 ] );
            $raw_price = wp_strip_all_tags( wc_price( $cart_item['line_total'] ) );

            $items[] = [
                'key'   => $cart_item_key,
                'name'  => $product->get_name(),
                'qty'   => $cart_item['quantity'],
                'price' => html_entity_decode( trim( $raw_price ), ENT_QUOTES, 'UTF-8' ),
                'image' => esc_url( $image_url ),
            ];
        }
        return $items;
    }
}