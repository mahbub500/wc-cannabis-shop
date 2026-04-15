<?php defined( 'ABSPATH' ) || exit; ?>

<div class="wccs-shop" 
     data-per-page="<?php echo esc_attr( $this->atts['per_page'] ); ?>"
     data-columns="<?php echo esc_attr( $this->atts['columns'] ); ?>">

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

    <!-- Sidebar Filters -->
    <aside class="wccs-sidebar">



        <div class="wccs-search-wrap">
            <span class="wccs-search-icon">🔍</span>
            <input type="text" id="wccs-search" placeholder="Search by name" autocomplete="off">
            <button class="wccs-search-clear" aria-label="Clear search">✕</button>
        </div>

        <!-- Clear Filters (above categories) -->
        <div class="wccs-filter-group">
            <button class="wccs-clear-filters" id="wccs-clear-filters-top">Clear</button>
        </div>

        

        <!-- Specials -->
        <div class="wccs-filter-group">
            <div class="wccs-filter-title">🔥 SPECIALS</div>
            <label class="wccs-special-checkbox">
                <input type="checkbox" id="wccs-sale-only">
                <svg class="wccs-custom-checkbox" width="20" height="20" viewBox="0 0 20 20">
                    <rect width="18" height="18" x="1" y="1" stroke="#d0d0d0" stroke-width="1.5" rx="3" fill="none"></rect>
                    <polyline class="wccs-checkmark" points="5,10 8,13 15,6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"></polyline>
                </svg>
                <span>10 percent off edibles</span>
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

        <!-- Price -->
        <div class="wccs-filter-group">
            <div class="wccs-filter-title">PRICE</div>
            <div class="wccs-price-filters">
                <label class="wccs-price-checkbox">
                    <input type="checkbox" name="price" value="0-20">
                    <svg class="wccs-custom-checkbox" width="20" height="20" viewBox="0 0 20 20">
                        <rect width="18" height="18" x="1" y="1" stroke="#d0d0d0" stroke-width="1.5" rx="3" fill="none"></rect>
                        <polyline class="wccs-checkmark" points="5,10 8,13 15,6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"></polyline>
                    </svg>
                    <span>Under $20</span>
                </label>
                <label class="wccs-price-checkbox">
                    <input type="checkbox" name="price" value="20-40">
                    <svg class="wccs-custom-checkbox" width="20" height="20" viewBox="0 0 20 20">
                        <rect width="18" height="18" x="1" y="1" stroke="#d0d0d0" stroke-width="1.5" rx="3" fill="none"></rect>
                        <polyline class="wccs-checkmark" points="5,10 8,13 15,6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"></polyline>
                    </svg>
                    <span>$20 – $40</span>
                </label>
                <label class="wccs-price-checkbox">
                    <input type="checkbox" name="price" value="40-60">
                    <svg class="wccs-custom-checkbox" width="20" height="20" viewBox="0 0 20 20">
                        <rect width="18" height="18" x="1" y="1" stroke="#d0d0d0" stroke-width="1.5" rx="3" fill="none"></rect>
                        <polyline class="wccs-checkmark" points="5,10 8,13 15,6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"></polyline>
                    </svg>
                    <span>$40 – $60</span>
                </label>
                <label class="wccs-price-checkbox">
                    <input type="checkbox" name="price" value="60-80">
                    <svg class="wccs-custom-checkbox" width="20" height="20" viewBox="0 0 20 20">
                        <rect width="18" height="18" x="1" y="1" stroke="#d0d0d0" stroke-width="1.5" rx="3" fill="none"></rect>
                        <polyline class="wccs-checkmark" points="5,10 8,13 15,6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"></polyline>
                    </svg>
                    <span>$60 – $80</span>
                </label>
                <label class="wccs-price-checkbox">
                    <input type="checkbox" name="price" value="80">
                    <svg class="wccs-custom-checkbox" width="20" height="20" viewBox="0 0 20 20">
                        <rect width="18" height="18" x="1" y="1" stroke="#d0d0d0" stroke-width="1.5" rx="3" fill="none"></rect>
                        <polyline class="wccs-checkmark" points="5,10 8,13 15,6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"></polyline>
                    </svg>
                    <span>Over $80</span>
                </label>
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

<!-- =============================================
     PERSISTENT CART BAR (Floating Bottom)
============================================= -->
<div class="wccs-cart-bar" id="wccs-cart-bar" style="display:none;">
    <button class="wccs-cart-bar-btn" id="wccs-cart-bar-btn">
        <div class="wccs-cart-bar-content">
            <svg class="wccs-cart-bar-icon" viewBox="0 0 24 24" width="20" height="20" fill="none">
                <circle cx="9" cy="21" r="1.5" fill="currentColor"/>
                <circle cx="17" cy="21" r="1.5" fill="currentColor"/>
                <path d="M1 1h3l1.5 9h13l1.5-9H6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <div class="wccs-cart-bar-text">
                <span class="wccs-cart-bar-title">Cart</span>
                <span class="wccs-cart-bar-subtitle" id="wccs-cart-bar-subtitle">0 products ($0.00)</span>
            </div>
        </div>
    </button>
</div>

<!-- Cart popup panel (full sidebar) -->
<div class="wccs-cart-popup-wrap" id="wccs-cart-popup-wrap">
    <div class="wccs-cart-backdrop" id="wccs-cart-backdrop"></div>
    <div class="wccs-cart-popup-inner">
        <div class="wccs-cart-popup-header">
            <h3 class="wccs-cart-popup-title">Your Cart</h3>
            <button class="wccs-cart-close" id="wccs-cart-close" aria-label="Close cart">
                <svg viewBox="0 0 16 16" width="18" height="18" fill="none">
                    <path d="M2.343 2.343L13.657 13.657" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <path d="M13.657 2.343L2.343 13.657" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>
        </div>
        <div class="wccs-cart-items" id="wccs-cart-items">
            <div class="wccs-cart-empty-state">
                <svg viewBox="0 0 48 48" width="48" height="48" fill="none">
                    <circle cx="18" cy="42" r="3" fill="#ccc"/>
                    <circle cx="34" cy="42" r="3" fill="#ccc"/>
                    <path d="M2 2h6l3 18h26l3-18H10" stroke="#ccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <p>Your cart is empty</p>
            </div>
        </div>
        <div class="wccs-cart-footer">
            <div class="wccs-cart-footer-info">
                <span class="wccs-cart-footer-label">Subtotal</span>
                <span class="wccs-cart-footer-total" id="wccs-cart-footer-total">$0.00</span>
            </div>
            <a href="<?php echo esc_url( wc_get_cart_url() ); ?>" class="wccs-cart-checkout-btn">
                Checkout
            </a>
        </div>
    </div>
</div>
