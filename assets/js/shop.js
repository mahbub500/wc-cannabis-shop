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
        if ( btn.classList.contains( 'wccs-open-quickview' ) ) return;

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
                document.body.dispatchEvent( new CustomEvent( 'wccs_refresh_cart' ) );

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
                        <div class="wccs-qv-variations" style="display:none;"></div>
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
                    action:       'wccs_add_to_cart',
                    product_id:   productId,
                    variation_id: $overlay.data( 'variation-id' ) || 0,
                    quantity:     qty,
                    nonce:        wccs.cart_nonce,
                },
                success: function (res) {
                    if (res.success) {
                        $btn.removeClass('wccs-qv-loading').addClass('wccs-qv-added').text('✓ Added!');

                        // Trigger WooCommerce cart fragment refresh
                        $(document.body).trigger('wc_fragment_refresh');
                        $(document.body).trigger('added_to_cart');
                        document.body.dispatchEvent(new CustomEvent('wccs_refresh_cart'));

                        // Close popup after short delay
                        setTimeout(function () {
                            closePopup();
                            // Reset button state after popup closes
                            setTimeout(function () {
                                $btn.removeClass('wccs-qv-added').prop('disabled', false).text('Add to Cart');
                            }, 300);
                        }, 1200);
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

    /* ─── Variation helpers ─── */

    function fetchAndRenderVariations( $overlay, productId ) {
        const $varWrap = $overlay.find( '.wccs-qv-variations' );
        $varWrap.html( '<p class="wccs-qv-loading-vars">Loading options…</p>' ).show();

        $.ajax( {
            url:  wccs.ajax_url,
            type: 'POST',
            data: {
                action:     'wccs_get_variations',
                product_id: productId,
                nonce:      wccs.nonce,
            },
            success: function ( res ) {
                if ( res.success ) {
                    renderVariationSelectors( $overlay, res.data.attributes, productId );
                } else {
                    $varWrap.html( '<p class="wccs-qv-loading-vars">Could not load options.</p>' );
                }
            },
            error: function () {
                $varWrap.html( '<p class="wccs-qv-loading-vars">Error loading options.</p>' );
            },
        } );
    }

    function renderVariationSelectors( $overlay, attributes, productId ) {
        const $varWrap = $overlay.find( '.wccs-qv-variations' );

        const html = attributes.map( function ( attr ) {
            const id   = 'wccs-attr-' + attr.name;
            const opts = attr.options.map( function ( opt ) {
                return `<option value="${ opt.value }">${ opt.label }</option>`;
            } ).join( '' );
            return `<div class="wccs-qv-attr-group">
                        <label class="wccs-qv-attr-label" for="${ id }">${ attr.label }</label>
                        <select class="wccs-qv-attr-select" id="${ id }" data-attr="${ attr.name }">
                            <option value="">— Choose ${ attr.label } —</option>
                            ${ opts }
                        </select>
                    </div>`;
        } ).join( '' );

        $varWrap.html( html ).show();

        $varWrap.find( '.wccs-qv-attr-select' ).on( 'change', function () {
            matchVariationServer( $overlay, attributes, productId );
        } );
    }

    /* Send all selected attribute values to PHP for server-side matching.
       Uses WC_Data_Store::find_matching_product_variation() — handles every
       edge case (any-value attributes, slugs vs names, etc.) correctly. */
    function matchVariationServer( $overlay, attributes, productId ) {
        const $varWrap = $overlay.find( '.wccs-qv-variations' );
        const $atc     = $overlay.find( '.wccs-qv-atc' );
        const selected = {};

        attributes.forEach( function ( attr ) {
            const val = $varWrap.find( '[data-attr="' + attr.name + '"]' ).val();
            if ( val ) {
                selected[ 'attribute_' + attr.name ] = val;
            }
        } );

        const allSelected = attributes.length > 0 &&
            attributes.every( function ( attr ) {
                return !!selected[ 'attribute_' + attr.name ];
            } );

        if ( ! allSelected ) {
            $overlay.data( 'variation-id', null );
            $atc.prop( 'disabled', true ).text( 'Select options' );
            return;
        }

        $overlay.data( 'variation-id', null );
        $atc.prop( 'disabled', true ).text( 'Checking…' );

        $.ajax( {
            url:  wccs.ajax_url,
            type: 'POST',
            data: {
                action:     'wccs_match_variation',
                product_id: productId,
                nonce:      wccs.nonce,
                attributes: JSON.stringify( selected ),
            },
            success: function ( res ) {
                if ( res.success ) {
                    const v = res.data;
                    if ( v.is_in_stock && v.is_purchasable ) {
                        $overlay.data( 'variation-id', v.variation_id );
                        if ( v.price_html ) {
                            $overlay.find( '.wccs-qv-price' ).html( v.price_html );
                        }
                        $atc.prop( 'disabled', false )
                            .removeClass( 'wccs-qv-loading wccs-qv-added' )
                            .text( 'Add to Cart' );
                    } else {
                        $atc.prop( 'disabled', true ).text( 'Out of Stock' );
                    }
                } else {
                    $atc.prop( 'disabled', true ).text( 'Unavailable' );
                }
            },
            error: function () {
                $atc.prop( 'disabled', true ).text( 'Select options' );
            },
        } );
    }

    /* ─── Open popup with product data ─── */
    function openPopup($card) {
        const $overlay = $('#' + POPUP_ID);

        // Pull data from the card DOM
        const productId   = $card.data('product-id') || $card.find('[data-product-id]').data('product-id');
        const productType = $card.data( 'product-type' ) || 'simple';
        const title       = $card.find('.wccs-product-title').text().trim();
        const price       = $card.find('.wccs-price').html();
        const unit        = $card.find('.wccs-qty').text().trim();
        const imgSrc      = $card.find('.wccs-product-image img').attr('src') || '';
        const imgAlt      = $card.find('.wccs-product-image img').attr('alt') || title;
        const badgeText   = $card.find('.wccs-badge').text().trim();
        const badgeColor  = $card.find('.wccs-badge').css('background-color') || '';
        const description = $card.find('.wccs-product-description').html() || '';

        // Reset state
        $overlay.data( 'qty', 1 ).data( 'product-id', productId ).data( 'variation-id', null );

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

        // Variations — reset then load if variable
        $overlay.find( '.wccs-qv-variations' ).empty().hide();
        if ( productType === 'variable' ) {
            $overlay.find( '.wccs-qv-atc' ).prop( 'disabled', true ).text( 'Select options' );
            fetchAndRenderVariations( $overlay, productId );
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

        // Variable product "ADD TO CART" button opens quick view popup
        $(document).on('click', '.wccs-product-card .wccs-open-quickview', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const $card = $(this).closest('.wccs-product-card');
            openPopup($card);
        });

        // Prevent simple "Add to Cart" button on card from opening popup
        $(document).on('click', '.wccs-product-card .wccs-add-to-cart:not(.wccs-open-quickview)', function (e) {
            e.stopPropagation();
        });
    }

    $(document).ready(init);

})(jQuery);


/* ════════════════════════════════════════════════════════════
   WC Cannabis Shop — Persistent Cart Bar
════════════════════════════════════════════════════════════ */
( function () {
    'use strict';

    const cartBar      = document.getElementById( 'wccs-cart-bar' );
    const cartBtn      = document.getElementById( 'wccs-cart-bar-btn' );
    const cartSubtitle = document.getElementById( 'wccs-cart-bar-subtitle' );
    const popupWrap    = document.getElementById( 'wccs-cart-popup-wrap' );
    const closeBtn     = document.getElementById( 'wccs-cart-close' );
    const backdrop     = document.getElementById( 'wccs-cart-backdrop' );
    const cartItems    = document.getElementById( 'wccs-cart-items' );
    const footerTotal  = document.getElementById( 'wccs-cart-footer-total' );

    if ( ! cartBar || ! cartBtn ) return;

    // Add body class for padding
    document.body.classList.add( 'wccs-cart-active' );

    let isOpen = false;
    let hasItems = false;

    /* ── Open popup ── */
    function openCart() {
        isOpen = true;
        popupWrap.classList.add( 'wccs-cart-open' );
        document.body.style.overflow = 'hidden';
    }

    /* ── Close popup ── */
    function closeCart() {
        isOpen = false;
        popupWrap.classList.remove( 'wccs-cart-open' );
        document.body.style.overflow = '';
    }

    /* ── Toggle popup ── */
    cartBtn.addEventListener( 'click', function () {
        if ( isOpen ) {
            closeCart();
        } else {
            openCart();
        }
    } );

    /* ── Close on button click ── */
    if ( closeBtn ) {
        closeBtn.addEventListener( 'click', closeCart );
    }

    /* ── Close on backdrop click ── */
    if ( backdrop ) {
        backdrop.addEventListener( 'click', closeCart );
    }

    /* ── Close on Escape ── */
    document.addEventListener( 'keydown', function ( e ) {
        if ( e.key === 'Escape' && isOpen ) {
            closeCart();
        }
    } );

    /* ── Fetch cart data via AJAX ── */
    async function fetchCartData() {
        try {
            const res = await fetch( wccs.ajax_url, {
                method: 'POST',
                body: new URLSearchParams( {
                    action: 'wccs_get_cart_data',
                    nonce:  wccs.nonce,
                } ),
            } );
            const data = await res.json();

            if ( data.success ) {
                updateCartUI( data.data );
            }
        } catch ( err ) {
            console.error( 'WCCS cart fetch error', err );
        }
    }

    /* ── Update cart UI ── */
    function updateCartUI( cart ) {
        const count = cart.count || 0;
        const total = cart.total || '$0.00';
        const items = cart.items || [];

        const wasEmpty = ! hasItems;
        hasItems = count > 0;

        // Show/hide cart bar with animation
        if ( hasItems ) {
            cartBar.style.display = 'block';
            if ( wasEmpty ) {
                cartBar.style.animation = 'none';
                cartBar.offsetHeight; // trigger reflow
                cartBar.style.animation = '';
            }
        } else {
            cartBar.style.display = 'none';
            // Close popup if empty
            if ( isOpen ) {
                closeCart();
            }
        }

        // Update subtitle: "1 product ($15.00)" or "2 products ($30.00)"
        const label = count === 1 ? 'product' : 'products';
        cartSubtitle.textContent = count + ' ' + label + ' (' + total + ')';

        // Update footer total
        footerTotal.textContent = total;

        // Render items or empty state
        if ( ! items.length ) {
            cartItems.innerHTML = `
                <div class="wccs-cart-empty-state">
                    <svg viewBox="0 0 48 48" width="48" height="48" fill="none">
                        <circle cx="18" cy="42" r="3" fill="#ccc"/>
                        <circle cx="34" cy="42" r="3" fill="#ccc"/>
                        <path d="M2 2h6l3 18h26l3-18H10" stroke="#ccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <p>Your cart is empty</p>
                </div>
            `;
            return;
        }

        cartItems.innerHTML = items.map( function ( item ) {
            return `<div class="wccs-cart-item" data-key="${ item.key }">
                <img class="wccs-cart-item-image"
                     src="${ item.image }"
                     alt="${ item.name }"
                     loading="lazy">
                <div class="wccs-cart-item-info">
                    <div class="wccs-cart-item-name">${ item.name }</div>
                    <div class="wccs-cart-item-unit-price">${ item.unit_price } / pc</div>
                    <div class="wccs-cart-item-qty-row">
                        <button class="wccs-qty-btn wccs-qty-minus" data-key="${ item.key }" aria-label="Decrease quantity">
                            <svg width="12" height="12" viewBox="0 0 12 2" fill="none">
                                <rect width="12" height="2" rx="1" fill="currentColor"/>
                            </svg>
                        </button>
                        <span class="wccs-qty-display">${ item.qty }</span>
                        <button class="wccs-qty-btn wccs-qty-plus" data-key="${ item.key }" aria-label="Increase quantity">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M5 0h2v12H5zM0 5h12v2H0z" fill="currentColor"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="wccs-cart-item-price">${ item.price }</div>
                <button class="wccs-cart-item-remove"
                        data-key="${ item.key }"
                        aria-label="Remove ${ item.name }">
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                        <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>`;
        } ).join( '' );
    }

    /* ── Remove item from cart ── */
    cartItems.addEventListener( 'click', async function ( e ) {
        const btn = e.target.closest( '.wccs-cart-item-remove' );
        if ( ! btn ) return;

        e.preventDefault();
        e.stopPropagation();

        const key  = btn.dataset.key;
        const item = btn.closest( '.wccs-cart-item' );

        if ( item ) {
            item.style.opacity = '0.4';
            item.style.pointerEvents = 'none';
        }

        try {
            const res = await fetch( wccs.ajax_url, {
                method: 'POST',
                body: new URLSearchParams( {
                    action:   'wccs_remove_from_cart',
                    nonce:    wccs.nonce,
                    cart_key: key,
                } ),
            } );
            const data = await res.json();

            if ( data.success ) {
                updateCartUI( data.data );

                if ( typeof jQuery !== 'undefined' ) {
                    jQuery( document.body ).trigger( 'wc_fragment_refresh' );
                }
                document.body.dispatchEvent( new CustomEvent( 'wc_fragment_refresh' ) );
            }
        } catch ( err ) {
            console.error( 'WCCS remove cart error', err );
            if ( item ) {
                item.style.opacity = '1';
                item.style.pointerEvents = 'auto';
            }
        }
    } );

    /* ── Quantity +/- buttons ── */
    cartItems.addEventListener( 'click', async function ( e ) {
        const qtyBtn = e.target.closest( '.wccs-qty-btn' );
        if ( ! qtyBtn ) return;

        e.preventDefault();
        e.stopPropagation();

        const key      = qtyBtn.dataset.key;
        const isMinus  = qtyBtn.classList.contains( 'wccs-qty-minus' );
        const item     = qtyBtn.closest( '.wccs-cart-item' );
        const qtyEl    = item ? item.querySelector( '.wccs-qty-display' ) : null;
        const currentQty = qtyEl ? parseInt( qtyEl.textContent ) : 1;
        const newQty   = isMinus ? Math.max( 1, currentQty - 1 ) : currentQty + 1;

        // Skip if same quantity (already at 1)
        if ( newQty === currentQty ) return;

        if ( item ) {
            item.style.opacity = '0.5';
            item.style.pointerEvents = 'none';
        }

        try {
            const res = await fetch( wccs.ajax_url, {
                method: 'POST',
                body: new URLSearchParams( {
                    action:    'wccs_update_cart_qty',
                    nonce:     wccs.nonce,
                    cart_key:  key,
                    quantity:  newQty,
                } ),
            } );
            const data = await res.json();

            if ( data.success ) {
                updateCartUI( data.data );

                if ( typeof jQuery !== 'undefined' ) {
                    jQuery( document.body ).trigger( 'wc_fragment_refresh' );
                }
                document.body.dispatchEvent( new CustomEvent( 'wc_fragment_refresh' ) );
            }
        } catch ( err ) {
            console.error( 'WCCS update qty error', err );
            if ( item ) {
                item.style.opacity = '1';
                item.style.pointerEvents = 'auto';
            }
        }
    } );

    /* ── Global cart refresh event ── */
    document.body.addEventListener( 'wccs_refresh_cart', function () {
        fetchCartData();
    } );

    document.body.addEventListener( 'wc_fragment_refresh', function () {
        fetchCartData();
    } );

    /* ── Show mini toast notification ── */
    function showToast( message, type ) {
        type = type || 'success';
        var existing = document.querySelector( '.wccs-toast' );
        if ( existing ) existing.remove();

        var toast = document.createElement( 'div' );
        toast.className = 'wccs-toast wccs-toast-' + type;
        toast.innerHTML = message;
        document.body.appendChild( toast );

        requestAnimationFrame( function () {
            toast.classList.add( 'wccs-toast-enter' );
        } );

        setTimeout( function () {
            toast.classList.remove( 'wccs-toast-enter' );
            toast.classList.add( 'wccs-toast-leave' );
            setTimeout( function () {
                toast.remove();
            }, 300 );
        }, 2000 );
    }

    /* ── Clear Cart confirmation ── */
    const clearCartBtn    = document.getElementById( 'wccs-cart-clear-btn' );
    const confirmBox      = document.getElementById( 'wccs-cart-confirm' );
    const confirmNoBtn    = document.getElementById( 'wccs-cart-confirm-no' );
    const confirmYesBtn   = document.getElementById( 'wccs-cart-confirm-yes' );

    if ( clearCartBtn ) {
        clearCartBtn.addEventListener( 'click', function () {
            clearCartBtn.style.display = 'none';
            confirmBox.style.display = 'block';
        } );
    }

    if ( confirmNoBtn ) {
        confirmNoBtn.addEventListener( 'click', function () {
            confirmBox.style.display = 'none';
            clearCartBtn.style.display = 'flex';
        } );
    }

    if ( confirmYesBtn ) {
        confirmYesBtn.addEventListener( 'click', async function () {
            confirmYesBtn.disabled = true;
            confirmYesBtn.textContent = 'Clearing…';

            try {
                const res = await fetch( wccs.ajax_url, {
                    method: 'POST',
                    body: new URLSearchParams( {
                        action: 'wccs_clear_cart',
                        nonce:  wccs.nonce,
                    } ),
                } );
                const data = await res.json();

                if ( data.success ) {
                    updateCartUI( data.data );
                    closeCart();
                    showToast( '✓ Cart cleared' );

                    if ( typeof jQuery !== 'undefined' ) {
                        jQuery( document.body ).trigger( 'wc_fragment_refresh' );
                    }
                    document.body.dispatchEvent( new CustomEvent( 'wc_fragment_refresh' ) );
                }
            } catch ( err ) {
                console.error( 'WCCS clear cart error', err );
                showToast( '✕ Error clearing cart', 'error' );
            }

            confirmYesBtn.disabled = false;
            confirmYesBtn.textContent = 'Clear All';
            confirmBox.style.display = 'none';
            clearCartBtn.style.display = 'flex';
        } );
    }

    // Initial fetch on page load
    fetchCartData();

} )();