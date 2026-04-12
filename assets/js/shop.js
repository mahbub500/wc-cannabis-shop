/**
 * WC Cannabis Shop — JS-powered live filtering
 * No jQuery, pure vanilla ES6+
 */
( function () {
    'use strict';

    const shop     = document.querySelector( '.wccs-shop' );
    if ( ! shop ) return;

    const grid     = shop.querySelector( '.wccs-grid' );
    const loading  = shop.querySelector( '.wccs-loading' );
    const noResult = shop.querySelector( '.wccs-no-results' );
    const countEl  = shop.querySelector( '.wccs-count strong' );
    const loadMore = shop.querySelector( '.wccs-load-more' );

    // Filter state
    const state = {
        category   : '',
        strain     : '',
        search     : '',
        sort       : 'menu_order',
        paged      : 1,
        per_page   : parseInt( shop.dataset.perPage, 10 ) || 12,
        sale_only  : false,
        price      : [],
    };

    let debounceTimer = null;

    /* ---- Helpers ---- */

    function setLoading( on ) {
        loading.style.display = on ? 'block' : 'none';
        grid.style.opacity    = on ? '.4' : '1';
    }

    function updateCount( n ) {
        if ( countEl ) countEl.textContent = n;
    }

    function resetPage() { state.paged = 1; }

    /* ---- AJAX fetch ---- */

    async function fetchProducts( append = false ) {
        setLoading( true );
        noResult.style.display = 'none';

        const body = new URLSearchParams( {
            action    : 'wccs_get_products',
            nonce     : wccs.nonce,
            category  : state.category,
            strain    : state.strain,
            search    : state.search,
            per_page  : state.per_page,
            paged     : state.paged,
            sale_only : state.sale_only ? '1' : '0',
            price     : state.price.join( ',' ),
        } );

        try {
            const res  = await fetch( wccs.ajax_url, { method: 'POST', body } );
            const data = await res.json();

            if ( data.success ) {
                if ( ! append ) {
                    grid.innerHTML = data.data.html;
                } else {
                    grid.insertAdjacentHTML( 'beforeend', data.data.html );
                }

                updateCount( data.data.total );

                if ( ! data.data.html.trim() ) {
                    noResult.style.display = 'block';
                }

                // Show/hide load more
                const loaded = grid.querySelectorAll( '.wccs-product-card' ).length;
                loadMore.style.display = loaded < data.data.total ? 'block' : 'none';
            }
        } catch ( e ) {
            console.error( 'WCCS fetch error', e );
        } finally {
            setLoading( false );
        }
    }

    /* ---- Category icons ---- */

    shop.querySelectorAll( '.wccs-cat-icon' ).forEach( btn => {
        btn.addEventListener( 'click', () => {
            const cat = btn.dataset.cat;
            if ( state.category === cat ) {
                state.category = '';
                btn.classList.remove( 'active' );
            } else {
                shop.querySelectorAll( '.wccs-cat-icon' ).forEach( b => b.classList.remove( 'active' ) );
                state.category = cat;
                btn.classList.add( 'active' );
            }
            resetPage();
            fetchProducts();
        } );
    } );

    /* ---- Strain buttons (multi-select toggle) ---- */

    shop.querySelectorAll( '.wccs-strain-btn' ).forEach( btn => {
        btn.addEventListener( 'click', () => {
            btn.classList.toggle( 'active' );
            const active = [ ...shop.querySelectorAll( '.wccs-strain-btn.active' ) ]
                .map( b => b.dataset.strain );
            state.strain = active.join( ',' );
            resetPage();
            fetchProducts();
        } );
    } );

    /* ---- Potency buttons (single select) ---- */

    shop.querySelectorAll( '.wccs-potency-btn' ).forEach( btn => {
        btn.addEventListener( 'click', () => {
            shop.querySelectorAll( '.wccs-potency-btn' ).forEach( b => b.classList.remove( 'active' ) );
            btn.classList.add( 'active' );
            // potency filter — extend ProductQuery as needed
            resetPage();
            fetchProducts();
        } );
    } );

    /* ---- Sale Only (10% off edibles) ---- */

    const saleCheckbox = shop.querySelector( '#wccs-sale-only' );
    if ( saleCheckbox ) {
        saleCheckbox.addEventListener( 'change', () => {
            state.sale_only = saleCheckbox.checked;
            resetPage();
            fetchProducts();
        } );
    }

    /* ---- Price range checkboxes ---- */

    shop.querySelectorAll( '.wccs-price-checkbox input' ).forEach( cb => {
        cb.addEventListener( 'change', () => {
            const active = [ ...shop.querySelectorAll( '.wccs-price-checkbox input:checked' ) ]
                .map( c => c.value );
            state.price = active;
            resetPage();
            fetchProducts();
        } );
    } );

    /* ---- Search ---- */

    const searchInput = shop.querySelector( '#wccs-search' );
    const searchClear = shop.querySelector( '.wccs-search-clear' );

    if ( searchInput ) {
        searchInput.addEventListener( 'input', () => {
            clearTimeout( debounceTimer );
            debounceTimer = setTimeout( () => {
                state.search = searchInput.value.trim();
                searchClear.classList.toggle( 'visible', searchInput.value.length > 0 );
                resetPage();
                fetchProducts();
            }, 350 );
        } );
    }

    if ( searchClear ) {
        searchClear.addEventListener( 'click', () => {
            searchInput.value = '';
            searchClear.classList.remove( 'visible' );
            state.search = '';
            resetPage();
            fetchProducts();
        } );
    }

    /* ---- Sort ---- */

    const sortSelect = shop.querySelector( '#wccs-sort' );
    if ( sortSelect ) {
        sortSelect.addEventListener( 'change', () => {
            state.sort = sortSelect.value;
            resetPage();
            fetchProducts();
        } );
    }

    /* ---- Load more ---- */

    if ( loadMore ) {
        loadMore.addEventListener( 'click', () => {
            state.paged++;
            fetchProducts( true );
        } );
    }

    /* ---- Clear All Filters ---- */

    function resetAllFilters() {
        state.category = '';
        state.strain   = '';
        state.search   = '';
        state.sale_only = false;
        state.price    = [];

        searchInput.value = '';
        searchClear.classList.remove( 'visible' );

        shop.querySelectorAll( '.wccs-cat-icon' ).forEach( b => b.classList.remove( 'active' ) );
        shop.querySelectorAll( '.wccs-strain-btn' ).forEach( b => b.classList.remove( 'active' ) );
        shop.querySelectorAll( '.wccs-price-checkbox input' ).forEach( cb => cb.checked = false );

        if ( saleCheckbox ) saleCheckbox.checked = false;

        resetPage();
        fetchProducts();
    }

    const clearAllBtn = shop.querySelector( '#wccs-clear-all' );
    if ( clearAllBtn ) {
        clearAllBtn.addEventListener( 'click', resetAllFilters );
    }

    const clearFiltersTop = shop.querySelector( '#wccs-clear-filters-top' );
    if ( clearFiltersTop ) {
        clearFiltersTop.addEventListener( 'click', resetAllFilters );
    }

    /* ---- Add to cart (AJAX) ---- */

    grid.addEventListener( 'click', async e => {
        const btn = e.target.closest( '.wccs-add-to-cart' );
        if ( ! btn ) return;

        e.preventDefault();
        e.stopPropagation();

        const originalText = btn.textContent;
        btn.disabled    = true;
        btn.textContent = 'Adding…';

        const body = new URLSearchParams( {
            action     : 'wccs_add_to_cart',
            product_id : btn.dataset.productId,
            quantity   : 1,
            nonce      : wccs.cart_nonce,
        } );

        try {
            const res  = await fetch( wccs.ajax_url, { method: 'POST', body } );
            const data = await res.json();

            if ( data.success ) {
                btn.textContent = '✓ Added!';
                
                // Update cart count/total if available
                if ( data.data.cart_count ) {
                    const cartCountEls = document.querySelectorAll( '.cart-count, .count' );
                    cartCountEls.forEach( el => {
                        el.textContent = data.data.cart_count;
                    } );
                }

                // Trigger WooCommerce cart fragments refresh
                if ( typeof jQuery !== 'undefined' ) {
                    jQuery( document.body ).trigger( 'wc_fragment_refresh' );
                    jQuery( document.body ).trigger( 'added_to_cart' );
                }
                document.body.dispatchEvent( new CustomEvent( 'wc_fragment_refresh' ) );
                document.body.dispatchEvent( new CustomEvent( 'added_to_cart' ) );

                // Update cart fragments from response
                if ( data.data.fragments ) {
                    Object.keys( data.data.fragments ).forEach( selector => {
                        const el = document.querySelector( selector );
                        if ( el ) {
                            el.outerHTML = data.data.fragments[ selector ];
                        }
                    } );
                }
            } else {
                btn.textContent = data.data?.message || 'Error';
            }
        } catch ( err ) {
            console.error( 'WCCS add to cart error', err );
            btn.textContent = 'Error';
        }

        setTimeout( () => {
            btn.disabled    = false;
            btn.textContent = originalText;
        }, 2000 );
    } );

} )();


/**
 * WC Cannabis Shop — Product Quick-View Popup
 * Drop this file in your plugin's /assets/js/ folder and enqueue it.
 * Requires: jQuery (already loaded by WooCommerce)
 */
(function ($) {
    'use strict';

    /* ─── Build popup HTML once ─── */
    const POPUP_ID = 'wccs-quickview-overlay';

    function buildOverlay() {
        if ($('#' + POPUP_ID).length) return;

        $('body').append(`
        <div id="${POPUP_ID}" class="wccs-qv-overlay" role="dialog" aria-modal="true" aria-label="Product quick view">
            <div class="wccs-qv-backdrop"></div>
            <div class="wccs-qv-modal">
                <button class="wccs-qv-close" aria-label="Close">
                    <svg viewBox="0 0 16 16" width="18" height="18">
                        <path d="M2.343 2.343L13.657 13.657" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <path d="M13.657 2.343L2.343 13.657" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
                <div class="wccs-qv-inner">
                    <div class="wccs-qv-image-wrap">
                        <img class="wccs-qv-image" src="" alt="">
                        <span class="wccs-qv-badge"></span>
                    </div>
                    <div class="wccs-qv-details">
                        <h2 class="wccs-qv-title"></h2>
                        <div class="wccs-qv-price-row">
                            <span class="wccs-qv-price"></span>
                            <span class="wccs-qv-unit"></span>
                        </div>
                        <div class="wccs-qv-description"></div>
                        <div class="wccs-qv-actions">
                            <div class="wccs-qv-qty-wrap">
                                <button class="wccs-qv-qty-btn wccs-qv-minus" aria-label="Decrease quantity">
                                    <svg width="14" height="2" viewBox="0 0 14 2"><rect width="14" height="2" rx="1" fill="currentColor"/></svg>
                                </button>
                                <span class="wccs-qv-qty-display">1 pc</span>
                                <button class="wccs-qv-qty-btn wccs-qv-plus" aria-label="Increase quantity">
                                    <svg width="14" height="14" viewBox="0 0 14 14"><path d="M6 0h2v14H6zM0 6h14v2H0z" fill="currentColor"/></svg>
                                </button>
                            </div>
                            <button class="wccs-qv-atc">Add to Cart</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`);

        bindOverlayEvents();
    }

    /* ─── Bind close / qty events ─── */
    function bindOverlayEvents() {
        const $overlay = $('#' + POPUP_ID);

        // Close on backdrop or X button
        $overlay.on('click', '.wccs-qv-backdrop, .wccs-qv-close', closePopup);

        // Close on Escape key
        $(document).on('keydown.wccs-qv', function (e) {
            if (e.key === 'Escape') closePopup();
        });

        // Quantity controls
        $overlay.on('click', '.wccs-qv-minus', function () {
            let qty = parseInt($overlay.data('qty') || 1);
            if (qty > 1) {
                qty--;
                $overlay.data('qty', qty);
                $overlay.find('.wccs-qv-qty-display').text(qty + ' pc');
                $overlay.find('.wccs-qv-minus').prop('disabled', qty <= 1);
            }
        });

        $overlay.on('click', '.wccs-qv-plus', function () {
            let qty = parseInt($overlay.data('qty') || 1);
            qty++;
            $overlay.data('qty', qty);
            $overlay.find('.wccs-qv-qty-display').text(qty + ' pc');
            $overlay.find('.wccs-qv-minus').prop('disabled', false);
        });

        // Add to cart — fires WooCommerce AJAX add-to-cart
        $overlay.on('click', '.wccs-qv-atc', function () {
            const productId = $overlay.data('product-id');
            const qty       = parseInt($overlay.data('qty') || 1);
            const $btn      = $(this);

            if (!productId) return;

            $btn.addClass('wccs-qv-loading').prop('disabled', true).text('Adding…');

            $.ajax({
                url: wccs.ajax_url,
                type: 'POST',
                data: {
                    action:     'wccs_add_to_cart',
                    product_id: productId,
                    quantity:   qty,
                    nonce:      wccs.cart_nonce,
                },
                success: function (res) {
                    if (res.success) {
                        $btn.removeClass('wccs-qv-loading').addClass('wccs-qv-added').text('✓ Added!');
                        
                        // Trigger WooCommerce cart fragment refresh
                        $(document.body).trigger('wc_fragment_refresh');
                        $(document.body).trigger('added_to_cart');
                        
                        setTimeout(function () {
                            $btn.removeClass('wccs-qv-added').prop('disabled', false).text('Add to Cart');
                        }, 2000);
                    } else {
                        $btn.removeClass('wccs-qv-loading').prop('disabled', false).text(res.data?.message || 'Error');
                    }
                },
                error: function () {
                    $btn.removeClass('wccs-qv-loading').prop('disabled', false).text('Error');
                }
            });
        });
    }

    /* ─── Open popup with product data ─── */
    function openPopup($card) {
        const $overlay = $('#' + POPUP_ID);

        // Pull data from the card DOM
        const productId   = $card.data('product-id') || $card.find('[data-product-id]').data('product-id');
        const title       = $card.find('.wccs-product-title').text().trim();
        const price       = $card.find('.wccs-price').html();
        const unit        = $card.find('.wccs-qty').text().trim();
        const imgSrc      = $card.find('.wccs-product-image img').attr('src') || '';
        const imgAlt      = $card.find('.wccs-product-image img').attr('alt') || title;
        const badgeText   = $card.find('.wccs-badge').text().trim();
        const badgeColor  = $card.find('.wccs-badge').css('background-color') || '';
        const description = $card.find('.wccs-product-description').html() || '';

        // Reset qty
        $overlay.data('qty', 1).data('product-id', productId);

        // Populate
        $overlay.find('.wccs-qv-image').attr({ src: imgSrc, alt: imgAlt });
        $overlay.find('.wccs-qv-title').text(title);
        $overlay.find('.wccs-qv-price').html(price);
        $overlay.find('.wccs-qv-unit').text(unit ? '/ ' + unit : '');
        $overlay.find('.wccs-qv-description').html(description);
        $overlay.find('.wccs-qv-qty-display').text('1 pc');
        $overlay.find('.wccs-qv-minus').prop('disabled', true);
        $overlay.find('.wccs-qv-atc').prop('disabled', false).removeClass('wccs-qv-loading wccs-qv-added').text('Add to Cart');

        if (badgeText) {
            $overlay.find('.wccs-qv-badge').text(badgeText).css('background-color', badgeColor).show();
        } else {
            $overlay.find('.wccs-qv-badge').hide();
        }

        // Show
        $overlay.addClass('wccs-qv-active');
        $('body').addClass('wccs-qv-open');
        $overlay.find('.wccs-qv-close').trigger('focus');
    }

    function closePopup() {
        $('#' + POPUP_ID).removeClass('wccs-qv-active');
        $('body').removeClass('wccs-qv-open');
    }

    /* ─── Init: bind click on product cards ─── */
    function init() {
        buildOverlay();

        // Click on image or title opens popup
        $(document).on('click', '.wccs-product-card .wccs-product-image, .wccs-product-title a', function (e) {
            e.preventDefault();
            const $card = $(this).closest('.wccs-product-card');
            openPopup($card);
        });

        // Prevent "Add to Cart" button on card from opening popup
        $(document).on('click', '.wccs-product-card .wccs-add-to-cart', function (e) {
            e.stopPropagation();
        });
    }

    $(document).ready(init);

})(jQuery);