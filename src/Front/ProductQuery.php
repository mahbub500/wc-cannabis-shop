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

        // Sale only: products with sale meta enabled
        if ( ! empty( $this->filters['sale_only'] ) ) {
            $args['meta_query'][] = [
                'key'     => '_wccs_sale_enabled',
                'value'   => '1',
                'compare' => '=',
            ];
        }

        // Potency filter (THC / CBD range sliders)
        $thc_min = $this->filters['potency_thc_min'] ?? 0;
        $thc_max = $this->filters['potency_thc_max'] ?? 100;
        $cbd_min = $this->filters['potency_cbd_min'] ?? 0;
        $cbd_max = $this->filters['potency_cbd_max'] ?? 100;
        $unit    = $this->filters['potency_unit'] ?? '%';

        // THC filter — only apply if not full range
        if ( $thc_min > 0 || $thc_max < 100 ) {
            $thc_meta_key = $unit === 'mg' ? '_wccs_thc_mg' : '_wccs_thc_pct';
            $args['meta_query'][] = [
                'key'     => $thc_meta_key,
                'value'   => [ (float) $thc_min, (float) $thc_max ],
                'type'    => 'NUMERIC',
                'compare' => 'BETWEEN',
            ];
        }

        // CBD filter — only apply if not full range
        if ( $cbd_min > 0 || $cbd_max < 100 ) {
            $cbd_meta_key = $unit === 'mg' ? '_wccs_cbd_mg' : '_wccs_cbd_pct';
            $args['meta_query'][] = [
                'key'     => $cbd_meta_key,
                'value'   => [ (float) $cbd_min, (float) $cbd_max ],
                'type'    => 'NUMERIC',
                'compare' => 'BETWEEN',
            ];
        }

        // Price range filter
        if ( ! empty( $this->filters['price'] ) ) {
            $price_ranges = explode( ',', $this->filters['price'] );
            $meta_queries = [];

            foreach ( $price_ranges as $range ) {
                if ( strpos( $range, '-' ) !== false ) {
                    // Range like "20-40"
                    list( $min, $max ) = explode( '-', $range );
                    $meta_queries[] = [
                        'key'     => '_price',
                        'value'   => [ (float) $min, (float) $max ],
                        'type'    => 'NUMERIC',
                        'compare' => 'BETWEEN',
                    ];
                } else {
                    // "80" means over $80
                    $meta_queries[] = [
                        'key'     => '_price',
                        'value'   => (float) $range,
                        'type'    => 'NUMERIC',
                        'compare' => '>=',
                    ];
                }
            }

            if ( ! empty( $meta_queries ) ) {
                $meta_queries['relation'] = 'OR';
                $args['meta_query'][]     = $meta_queries;
            }
        }

        $query       = new \WP_Query( $args );
        $this->total = $query->found_posts;

        return $query->posts;
    }

    public function get_total(): int {
        return $this->total;
    }
}
