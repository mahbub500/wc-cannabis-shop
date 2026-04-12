<?php
namespace WCCannabisShop\Front;

use WCCannabisShop\Front\ProductQuery;
use WCCannabisShop\Front\ShortcodeRenderer;

class Front {

    public function init(): void {
        add_shortcode( 'cannabis_shop', [ $this, 'render_shortcode' ] );
        add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_assets' ] );
        add_action( 'wp_ajax_wccs_get_products', [ $this, 'ajax_get_products' ] );
        add_action( 'wp_ajax_nopriv_wccs_get_products', [ $this, 'ajax_get_products' ] );
        add_action( 'wp_ajax_wccs_add_to_cart', [ $this, 'ajax_add_to_cart' ] );
        add_action( 'wp_ajax_nopriv_wccs_add_to_cart', [ $this, 'ajax_add_to_cart' ] );
    }

    public function enqueue_assets(): void {
        // Only load on pages with our shortcode
        global $post;
        if ( ! is_a( $post, 'WP_Post' ) || ! has_shortcode( $post->post_content, 'cannabis_shop' ) ) {
            return;
        }

        wp_enqueue_style(
            'wccs-style',
            WCCS_URL . 'assets/css/shop.css',
            [],
            '1.0.0'
        );

        // Map/Store Picker styles
        wp_enqueue_style(
            'wccs-map-style',
            WCCS_URL . 'assets/css/map.css',
            [],
            '1.0.0'
        );

        // Map/Store Picker script (must load BEFORE shop.js)
        wp_enqueue_script(
            'wccs-map-script',
            WCCS_URL . 'assets/js/map.js',
            [],
            '1.0.0',
            true
        );

        // Store data for the map widget
        $stores_data = $this->get_store_data();
        wp_add_inline_script(
            'wccs-map-script',
            'window.WCCS_STORES = ' . wp_json_encode( $stores_data ) . ';',
            'before'
        );

        wp_enqueue_script(
            'wccs-script',
            WCCS_URL . 'assets/js/shop.js',
            [ 'wccs-map-script' ],
            '1.0.0',
            true
        );

        wp_localize_script( 'wccs-script', 'wccs', [
            'ajax_url'  => admin_url( 'admin-ajax.php' ),
            'nonce'     => wp_create_nonce( 'wccs_nonce' ),
            'cart_nonce' => wp_create_nonce( 'wccs_add_to_cart' ),
        ] );
    }

    /**
     * Get store data for the map widget.
     * Customize this with your actual store locations.
     */
    private function get_store_data(): array {
        return [
            [
                'id'       => 'fairview',
                'name'     => '6ix Dispensary Fairview Mall Dr',
                'address'  => '245 Fairview Mall Drive, Toronto, ON M2J 4T1',
                'distance' => '7725.5 mi',
                'hours'    => '9:00 AM – 3:00 AM',
                'open'     => true,
                'lat'      => 43.7776,
                'lng'      => -79.3468,
                'logo'     => 'https://dr5urbp0m8lal.cloudfront.net/1/office_logo/93eadd5e010da80cc86e0e41b63c7074.jpeg?width=88&height=88',
                'color'    => '#1bb98a',
            ],
            [
                'id'       => 'bloor',
                'name'     => '6ix Dispensary Bloor ST W',
                'address'  => '863 Bloor St W, Toronto, ON M6G 1M2',
                'distance' => '7734.2 mi',
                'hours'    => '12:00 AM – 12:00 AM',
                'open'     => true,
                'lat'      => 43.6629,
                'lng'      => -79.4215,
                'logo'     => 'https://dr5urbp0m8lal.cloudfront.net/1/office_logo/44f3f6aaa048bf92d5868e05d8b42bf3.jpeg?width=88&height=88',
                'color'    => '#953EB1',
            ],
            [
                'id'       => 'queen',
                'name'     => '6ix Dispensary Queen St West',
                'address'  => '452 Queen St West, Toronto, ON M5V 2A8',
                'distance' => '7734.9 mi',
                'hours'    => '12:00 AM – 12:00 AM',
                'open'     => true,
                'lat'      => 43.6484,
                'lng'      => -79.4021,
                'logo'     => 'https://dr5urbp0m8lal.cloudfront.net/1/office_logo/6cef4a4b9d0c20d35b6808ef366ad62b.jpeg?width=88&height=88',
                'color'    => '#953EB1',
            ],
        ];
    }

    public function render_shortcode( array $atts ): string {
        $atts = shortcode_atts( [
            'columns'  => 3,
            'per_page' => 12,
            'category' => '',
        ], $atts );

        $renderer = new ShortcodeRenderer( $atts );
        return $renderer->render();
    }

    public function ajax_get_products(): void {
        check_ajax_referer( 'wccs_nonce', 'nonce' );

        $filters = [
            'category'        => sanitize_text_field( $_POST['category'] ?? '' ),
            'strain'          => sanitize_text_field( $_POST['strain'] ?? '' ),
            'search'          => sanitize_text_field( $_POST['search'] ?? '' ),
            'per_page'        => absint( $_POST['per_page'] ?? 12 ),
            'paged'           => absint( $_POST['paged'] ?? 1 ),
            'sale_only'       => ! empty( $_POST['sale_only'] ),
            'price'           => sanitize_text_field( $_POST['price'] ?? '' ),
            'potency_unit'    => sanitize_text_field( $_POST['potency_unit'] ?? '%' ),
            'potency_thc_min' => absint( $_POST['potency_thc_min'] ?? 0 ),
            'potency_thc_max' => absint( $_POST['potency_thc_max'] ?? 100 ),
            'potency_cbd_min' => absint( $_POST['potency_cbd_min'] ?? 0 ),
            'potency_cbd_max' => absint( $_POST['potency_cbd_max'] ?? 100 ),
        ];

        $query    = new ProductQuery( $filters );
        $products = $query->get_products();

        ob_start();
        foreach ( $products as $product_id ) {
            $product = wc_get_product( $product_id );
            if ( ! $product ) continue;
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
        $quantity   = absint( $_POST['quantity'] ?? 1 );

        if ( ! $product_id ) {
            wp_send_json_error( [ 'message' => 'Invalid product.' ] );
        }

        $product = wc_get_product( $product_id );
        if ( ! $product ) {
            wp_send_json_error( [ 'message' => 'Product not found.' ] );
        }

        // Add to cart
        $cart_item_key = WC()->cart->add_to_cart( $product_id, $quantity );

        if ( $cart_item_key ) {
            // Get updated cart fragments
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
}
