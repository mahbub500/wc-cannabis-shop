<?php defined( 'ABSPATH' ) || exit; ?>

<div class="wccs-shop" 
     data-per-page="<?php echo esc_attr( $this->atts['per_page'] ); ?>"
     data-columns="<?php echo esc_attr( $this->atts['columns'] ); ?>">

    <!-- Sidebar Filters -->
    <aside class="wccs-sidebar">

        <div class="wccs-search-wrap">
            <span class="wccs-search-icon">🔍</span>
            <input type="text" id="wccs-search" placeholder="Search by name" autocomplete="off">
            <button class="wccs-search-clear" aria-label="Clear search">✕</button>
        </div>

        <!-- Category Icons -->
        <div class="wccs-category-icons">
            <?php foreach ( $cats as $cat ) : ?>
                <?php if ( $cat->slug === 'uncategorized' ) continue; ?>
                <div class="wccs-cat-icon" data-cat="<?php echo esc_attr( $cat->slug ); ?>">
                    <?php
                    $thumbnail_id = get_term_meta( $cat->term_id, 'thumbnail_id', true );
                    if ( $thumbnail_id ) {
                        echo wp_get_attachment_image( $thumbnail_id, [60,60] );
                    } else {
                        echo '<span class="wccs-cat-placeholder">📦</span>';
                    }
                    ?>
                    <span><?php echo esc_html( $cat->name ); ?></span>
                </div>
            <?php endforeach; ?>
        </div>

        <!-- Specials -->
        <div class="wccs-filter-group">
            <div class="wccs-filter-title">🔥 SPECIALS</div>
            <label class="wccs-checkbox">
                <input type="checkbox" id="wccs-sale-only"> 10 percent off edibles
            </label>
        </div>

        <!-- Strain Type -->
        <div class="wccs-filter-group">
            <div class="wccs-filter-title">STRAIN TYPE</div>
            <div class="wccs-strain-buttons">
                <?php foreach ( ['INDICA','SATIVA','HYBRID','CBD','NONE'] as $strain ) : ?>
                    <button class="wccs-strain-btn" data-strain="<?php echo esc_attr( strtolower( $strain ) ); ?>">
                        <?php echo esc_html( $strain ); ?>
                    </button>
                <?php endforeach; ?>
            </div>
        </div>

        <!-- Potency -->
        <div class="wccs-filter-group">
            <div class="wccs-filter-title">POTENCY</div>
            <div class="wccs-potency-buttons">
                <button class="wccs-potency-btn active" data-potency="all">All</button>
                <button class="wccs-potency-btn" data-potency="%">%</button>
                <button class="wccs-potency-btn" data-potency="mg">mg</button>
            </div>
        </div>

        <!-- Clear All -->
        <div class="wccs-filter-group">
            <button class="wccs-clear-all" id="wccs-clear-all">✕ Clear All Filters</button>
        </div>
    </aside>

    <!-- Main Content -->
    <div class="wccs-main">

        <div class="wccs-results-bar">
            <span class="wccs-count">Found <strong><?php echo esc_html( $total ); ?></strong> Products</span>
            <div class="wccs-sort">
                <label>
                    <input type="checkbox" id="wccs-special-prices"> Special Prices
                </label>
                <select id="wccs-sort">
                    <option value="menu_order">Sort By A-Z</option>
                    <option value="price">Price Low-High</option>
                    <option value="price-desc">Price High-Low</option>
                    <option value="date">Newest</option>
                </select>
            </div>
        </div>

        <div class="wccs-grid" style="--wccs-cols:<?php echo esc_attr( $this->atts['columns'] ); ?>">
            <?php foreach ( $products as $product_id ) :
                $product = wc_get_product( $product_id );
                if ( ! $product ) continue;
                include __DIR__ . '/product-card.php';
            endforeach; ?>
        </div>

        <div class="wccs-loading" style="display:none;">
            <span class="wccs-spinner"></span> Loading products…
        </div>

        <div class="wccs-no-results" style="display:none;">No products found.</div>

        <div class="wccs-pagination">
            <button class="wccs-load-more" data-page="2">Load More</button>
        </div>
    </div>
</div>
