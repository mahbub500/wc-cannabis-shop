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
        add_action( 'wp_ajax_wccs_get_cart_data', [ $this, 'ajax_get_cart_data' ] );
        add_action( 'wp_ajax_nopriv_wccs_get_cart_data', [ $this, 'ajax_get_cart_data' ] );
        add_action( 'wp_ajax_wccs_remove_from_cart', [ $this, 'ajax_remove_from_cart' ] );
        add_action( 'wp_ajax_nopriv_wccs_remove_from_cart', [ $this, 'ajax_remove_from_cart' ] );
        add_action( 'wp_ajax_wccs_update_cart_qty', [ $this, 'ajax_update_cart_qty' ] );
        add_action( 'wp_ajax_nopriv_wccs_update_cart_qty', [ $this, 'ajax_update_cart_qty' ] );
        add_action( 'wp_ajax_wccs_clear_cart', [ $this, 'ajax_clear_cart' ] );
        add_action( 'wp_ajax_nopriv_wccs_clear_cart', [ $this, 'ajax_clear_cart' ] );
        add_action( 'wp_ajax_wccs_get_variations', [ $this, 'ajax_get_variations' ] );
        add_action( 'wp_ajax_nopriv_wccs_get_variations', [ $this, 'ajax_get_variations' ] );
        add_action( 'wp_ajax_wccs_match_variation', [ $this, 'ajax_match_variation' ] );
        add_action( 'wp_ajax_nopriv_wccs_match_variation', [ $this, 'ajax_match_variation' ] );
        add_action( 'woocommerce_cart_calculate_fees', [ $this, 'delivery_fee_rules' ] );
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

        wp_enqueue_script(
            'wccs-script',
            WCCS_URL . 'assets/js/shop.js',
            [],
            '1.0.0',
            true
        );

        wp_localize_script( 'wccs-script', 'wccs', [
            'ajax_url'  => admin_url( 'admin-ajax.php' ),
            'nonce'     => wp_create_nonce( 'wccs_nonce' ),
            'cart_nonce' => wp_create_nonce( 'wccs_add_to_cart' ),
        ] );
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
            'category'    => sanitize_text_field( $_POST['category'] ?? '' ),
            'strain'      => sanitize_text_field( $_POST['strain'] ?? '' ),
            'search'      => sanitize_text_field( $_POST['search'] ?? '' ),
            'per_page'    => absint( $_POST['per_page'] ?? 12 ),
            'paged'       => absint( $_POST['paged'] ?? 1 ),
            'sale_only'   => ! empty( $_POST['sale_only'] ),
            'price'       => sanitize_text_field( $_POST['price'] ?? '' ),
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

        // Ensure cart is loaded (important for live)
        if ( ! WC()->cart ) {
            wc_load_cart();
        }

        $product_id   = absint( $_POST['product_id'] ?? 0 );
        $variation_id = absint( $_POST['variation_id'] ?? 0 );
        $quantity     = absint( $_POST['quantity'] ?? 1 );

        if ( ! $product_id ) {
            wp_send_json_error( [ 'message' => 'Invalid product.' ] );
        }

        $product = wc_get_product( $product_id );

        if ( ! $product ) {
            wp_send_json_error( [ 'message' => 'Product not found.' ] );
        }

        // Optional safety check
        if ( ! $product->is_purchasable() || ! $product->is_in_stock() ) {
            wp_send_json_error( [ 'message' => 'Product not available.' ] );
        }

        $variation = [];

        if ( $variation_id ) {
            $variation_product = wc_get_product( $variation_id );

            if ( $variation_product ) {
                $variation = $variation_product->get_variation_attributes();
            }
        }

        $cart_item_key = WC()->cart->add_to_cart(
            $product_id,
            $quantity,
            $variation_id,
            $variation
        );

        if ( $cart_item_key ) {

            ob_start();
            woocommerce_mini_cart();
            $mini_cart = ob_get_clean();

            wp_send_json_success( [
                'cart_item_key' => $cart_item_key,
                'fragments'     => [
                    '.widget_shopping_cart_content' =>
                        '<div class="widget_shopping_cart_content">' . $mini_cart . '</div>',
                ],
                'cart_count' => WC()->cart->get_cart_contents_count(),
                'cart_total' => WC()->cart->get_cart_total(),
            ] );
        }

        wp_send_json_error( [ 'message' => 'Failed to add to cart.' ] );
    }

    /**
     * Get cart data via AJAX.
     */
    public function ajax_get_cart_data(): void {
        check_ajax_referer( 'wccs_nonce', 'nonce' );

        $cart  = WC()->cart;
        $items = [];

        foreach ( $cart->get_cart() as $cart_item_key => $cart_item ) {
            $product   = $cart_item['data'];
            $image_id  = $product->get_image_id();
            $image_url = $image_id ? wp_get_attachment_image_url( $image_id, [48, 48] ) : wc_placeholder_img_src( [48, 48] );
            $raw_price = wp_strip_all_tags( wc_price( $cart_item['line_total'] ) );

            $items[] = [
                    'key'        => $cart_item_key,
                    'name'       => $product->get_name(),
                    'qty'        => $cart_item['quantity'],
                    'price'      => html_entity_decode( trim( $raw_price ), ENT_QUOTES, 'UTF-8' ),
                    'unit_price' => html_entity_decode( trim( wp_strip_all_tags( wc_price( $cart_item['line_subtotal'] / $cart_item['quantity'] ) ) ), ENT_QUOTES, 'UTF-8' ),
                    'image'      => esc_url( $image_url ),
                ];
        }

        $raw_total = wp_strip_all_tags( $cart->get_cart_total() );

        wp_send_json_success( [
            'count' => $cart->get_cart_contents_count(),
            'total' => html_entity_decode( trim( $raw_total ), ENT_QUOTES, 'UTF-8' ),
            'items' => $items,
        ] );
    }

    /**
     * Remove item from cart via AJAX.
     */
    public function ajax_remove_from_cart(): void {
        check_ajax_referer( 'wccs_nonce', 'nonce' );

        $cart_key = sanitize_text_field( $_POST['cart_key'] ?? '' );

        if ( ! $cart_key ) {
            wp_send_json_error( [ 'message' => 'Invalid cart key.' ] );
        }

        $removed = WC()->cart->remove_cart_item( $cart_key );

        if ( $removed ) {
            // Return updated cart data
            $cart      = WC()->cart;
            $raw_total = wp_strip_all_tags( $cart->get_cart_total() );
            $items     = [];

            foreach ( $cart->get_cart() as $cart_item_key => $cart_item ) {
                $product   = $cart_item['data'];
                $image_id  = $product->get_image_id();
                $image_url = $image_id ? wp_get_attachment_image_url( $image_id, [48, 48] ) : wc_placeholder_img_src( [48, 48] );
                $raw_price = wp_strip_all_tags( wc_price( $cart_item['line_total'] ) );

                $items[] = [
    'key'        => $cart_item_key,
    'name'       => $product->get_name(),
    'qty'        => $cart_item['quantity'],
    'price'      => html_entity_decode( trim( $raw_price ), ENT_QUOTES, 'UTF-8' ),
    'unit_price' => html_entity_decode( trim( wp_strip_all_tags( wc_price( $cart_item['line_subtotal'] / $cart_item['quantity'] ) ) ), ENT_QUOTES, 'UTF-8' ),
    'image'      => esc_url( $image_url ),
];
            }

            wp_send_json_success( [
                'count' => $cart->get_cart_contents_count(),
                'total' => html_entity_decode( trim( $raw_total ), ENT_QUOTES, 'UTF-8' ),
                'items' => $items,
            ] );
        }

        wp_send_json_error( [ 'message' => 'Failed to remove item.' ] );
    }

    /**
     * Update cart item quantity via AJAX.
     */
    public function ajax_update_cart_qty(): void {
        check_ajax_referer( 'wccs_nonce', 'nonce' );

        $cart_key = sanitize_text_field( $_POST['cart_key'] ?? '' );
        $quantity = absint( $_POST['quantity'] ?? 1 );

        if ( ! $cart_key || $quantity < 1 ) {
            wp_send_json_error( [ 'message' => 'Invalid data.' ] );
        }

        $cart = WC()->cart;

        if ( ! $cart ) {
            wp_send_json_error( [ 'message' => 'Cart not found.' ] );
        }

        $updated = $cart->set_quantity( $cart_key, $quantity );

        if ( $updated ) {

            $raw_total = wp_strip_all_tags( $cart->get_cart_total() );
            $items     = [];

            foreach ( $cart->get_cart() as $item_key => $item ) {

                $product   = $item['data'];
                $image_id  = $product->get_image_id();
                $image_url = $image_id
                    ? wp_get_attachment_image_url( $image_id, [48, 48] )
                    : wc_placeholder_img_src( [48, 48] );

                $raw_price = wp_strip_all_tags( wc_price( $item['line_total'] ) );

                $unit_price = $item['quantity'] > 0
                    ? $item['line_subtotal'] / $item['quantity']
                    : 0;

                $items[] = [
                    'key'        => $item_key,
                    'name'       => $product->get_name(),
                    'qty'        => $item['quantity'],
                    'price'      => html_entity_decode( trim( $raw_price ), ENT_QUOTES, 'UTF-8' ),
                    'unit_price' => html_entity_decode(
                        trim( wp_strip_all_tags( wc_price( $unit_price ) ) ),
                        ENT_QUOTES,
                        'UTF-8'
                    ),
                    'image'      => esc_url( $image_url ),
                ];
            }

            wp_send_json_success( [
                'count' => $cart->get_cart_contents_count(),
                'total' => html_entity_decode( trim( $raw_total ), ENT_QUOTES, 'UTF-8' ),
                'items' => $items,
            ] );
        }

        wp_send_json_error( [ 'message' => 'Failed to update quantity.' ] );
    }

    /**
     * Clear entire cart via AJAX.
     */
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
     * Return attribute labels + option value/label pairs for a variable product.
     * Matching is done server-side via wccs_match_variation — no need to send all variations.
     */
    public function ajax_get_variations(): void {
        check_ajax_referer( 'wccs_nonce', 'nonce' );

        $product_id = absint( $_POST['product_id'] ?? 0 );
        if ( ! $product_id ) {
            wp_send_json_error( [ 'message' => 'Invalid product.' ] );
        }

        $product = wc_get_product( $product_id );
        if ( ! $product || $product->get_type() !== 'variable' ) {
            wp_send_json_error( [ 'message' => 'Not a variable product.' ] );
        }

        $attributes = [];
        foreach ( $product->get_variation_attributes() as $attr_name => $option_slugs ) {
            $options = [];
            if ( taxonomy_exists( $attr_name ) ) {
                foreach ( $option_slugs as $slug ) {
                    $term      = get_term_by( 'slug', $slug, $attr_name );
                    $options[] = [
                        'value' => $slug,
                        'label' => $term ? $term->name : ucfirst( str_replace( '-', ' ', $slug ) ),
                    ];
                }
            } else {
                foreach ( $option_slugs as $value ) {
                    $options[] = [ 'value' => $value, 'label' => $value ];
                }
            }

            $attributes[] = [
                'name'    => $attr_name,
                'label'   => wc_attribute_label( $attr_name ),
                'options' => $options,
            ];
        }

        wp_send_json_success( [ 'attributes' => $attributes ] );
    }

    /**
     * Use WooCommerce's own data store to match the selected attributes to a variation ID.
     */
    public function ajax_match_variation(): void {

        $product_id = absint( $_POST['product_id'] ?? 0 );
        $raw_attrs  = wp_unslash( $_POST['attributes'] ?? '{}' );
        $attributes = json_decode( $raw_attrs, true );

        if ( ! $product_id || ! is_array( $attributes ) ) {
            wp_send_json_error( [ 'message' => 'Invalid request.' ] );
        }

        $product = wc_get_product( $product_id );

        if ( ! $product || $product->get_type() !== 'variable' ) {
            wp_send_json_error( [ 'message' => 'Invalid product.' ] );
        }

        $product_attributes = $product->get_attributes();
        $clean = [];

        foreach ( $attributes as $key => $val ) {

            // remove "attribute_" prefix
            $key = str_replace( 'attribute_', '', $key );

            $matched_taxonomy = null;

            foreach ( $product_attributes as $taxonomy => $attr_obj ) {
                if (
                    sanitize_title( $taxonomy ) === sanitize_title( $key ) ||
                    sanitize_title( wc_attribute_label( $taxonomy ) ) === sanitize_title( $key )
                ) {
                    $matched_taxonomy = $taxonomy;
                    break;
                }
            }

            // fallback
            if ( ! $matched_taxonomy ) {
                $matched_taxonomy = sanitize_title( $key );
            }

            $clean_key = 'attribute_' . $matched_taxonomy;

            // IMPORTANT:
            // - Custom attributes → use raw value
            // - Global attributes (pa_) → use slug
            if ( strpos( $matched_taxonomy, 'pa_' ) === 0 ) {
                $clean_val = sanitize_title( $val );
            } else {
                $clean_val = trim( $val );
            }

            $clean[ $clean_key ] = $clean_val;
        }

        $data_store   = \WC_Data_Store::load( 'product' );
        $variation_id = $data_store->find_matching_product_variation( $product, $clean );

        if ( ! $variation_id ) {
            wp_send_json_error( [ 'message' => 'No matching variation.' ] );
        }

        $variation = wc_get_product( $variation_id );

        if ( ! $variation ) {
            wp_send_json_error( [ 'message' => 'Variation not found.' ] );
        }

        wp_send_json_success( [
            'variation_id'   => $variation_id,
            'price_html'     => $variation->get_price_html(),
            'is_in_stock'    => $variation->is_in_stock(),
            'is_purchasable' => $variation->is_purchasable(),
        ] );
    }

    public function delivery_fee_rules(): void {
        if ( ! defined( 'DOING_AJAX' ) ) {
            return;
        }

        $subtotal = WC()->cart->get_subtotal();

        if ( $subtotal < 60 ) {
            wc_add_notice( 'Minimum order for delivery is $60.', 'error' );
            return;
        }

        if ( $subtotal < 100 ) {
            WC()->cart->add_fee( 'Delivery Fee', 10 );
        }
        // $100+ gets free delivery — no fee added
    }
}
