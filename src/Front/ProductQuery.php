<?php
namespace WCCannabisShop\Front;

class ProductQuery {

    private array $filters;
    private int $total = 0;

    public function __construct( array $filters ) {
        $this->filters = $filters;
    }

    public function get_products(): array {
        $args = [
            'post_type'      => 'product',
            'post_status'    => 'publish',
            'posts_per_page' => $this->filters['per_page'],
            'paged'          => $this->filters['paged'],
            'fields'         => 'ids',
            'tax_query'      => [ 'relation' => 'AND' ],
            'meta_query'     => [],
        ];

        // Category filter
        if ( ! empty( $this->filters['category'] ) ) {
            $args['tax_query'][] = [
                'taxonomy' => 'product_cat',
                'field'    => 'slug',
                'terms'    => explode( ',', $this->filters['category'] ),
            ];
        }

        // Strain type (stored as product attribute or custom taxonomy)
        if ( ! empty( $this->filters['strain'] ) ) {
            $args['tax_query'][] = [
                'taxonomy' => 'pa_train-type', // WC attribute taxonomy (hyphens become underscores)
                'field'    => 'slug',
                'terms'    => explode( ',', $this->filters['strain'] ),
            ];
        }

        // Search
        if ( ! empty( $this->filters['search'] ) ) {
            $args['s'] = $this->filters['search'];
        }

        // Sale only: restrict to "edibles" category
        if ( ! empty( $this->filters['sale_only'] ) ) {
            $args['tax_query'][] = [
                'taxonomy' => 'product_cat',
                'field'    => 'slug',
                'terms'    => [ 'edibles' ],
            ];
        }

        $query       = new \WP_Query( $args );
        $this->total = $query->found_posts;

        return $query->posts;
    }

    public function get_total(): int {
        return $this->total;
    }
}
