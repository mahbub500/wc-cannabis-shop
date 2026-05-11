<?php
namespace WCCannabisShop\Front;

class ShortcodeRenderer {

    private array $atts;

    public function __construct( array $atts ) {
        $this->atts = $atts;
    }

    public function render(): string {
        $query = new ProductQuery( [
            'category'  => $this->atts['category'],
            'strain'    => '',
            'search'    => '',
            'per_page'  => (int) $this->atts['per_page'],
            'paged'     => 1,
            'sale_only' => false,
            'price'     => '',
        ] );
        $products = $query->get_products();
        $total    = $query->get_total();
        $cats     = $this->get_product_categories();
        $atts     = $this->atts;

        remove_filter( 'the_content', 'wpautop' );

        ob_start();
        include WCCS_DIR . 'templates/shop-wrapper.php';
        $html = ob_get_clean();

        add_filter( 'the_content', 'wpautop' );

        return $html;
    }

    private function get_product_categories(): array {
        return get_terms( [
            'taxonomy'   => 'product_cat',
            'hide_empty' => true,
        ] ) ?: [];
    }
}