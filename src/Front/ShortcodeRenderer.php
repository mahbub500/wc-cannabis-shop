<?php
namespace WCCannabisShop\Front;

class ShortcodeRenderer {

    private array $atts;

    public function __construct( array $atts ) {
        $this->atts = $atts;
    }

    public function render(): string {
        $query    = new ProductQuery( [
            'category' => $this->atts['category'],
            'strain'   => '',
            'search'   => '',
            'per_page' => (int) $this->atts['per_page'],
            'paged'    => 1,
        ] );
        $products = $query->get_products();
        $total    = $query->get_total();
        $cats     = $this->get_product_categories();

        ob_start();
        include WCCS_DIR . 'templates/shop-wrapper.php';
        return ob_get_clean();
    }

    private function get_product_categories(): array {
        return get_terms( [
            'taxonomy'   => 'product_cat',
            'hide_empty' => true,
        ] ) ?: [];
    }
}
