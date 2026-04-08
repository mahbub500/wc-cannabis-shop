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
            'ajax_url' => admin_url( 'admin-ajax.php' ),
            'nonce'    => wp_create_nonce( 'wccs_nonce' ),
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
}
