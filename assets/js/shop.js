/**
 * WC Cannabis Shop — JS-powered live filtering
 * Compatible with updated template (potency value labels outside .wccs-range-slider)
 * No jQuery, pure vanilla ES6+
 */
( function () {
    'use strict';

    const shop = document.querySelector( '.wccs-shop' );
    if ( ! shop ) return;

    const grid     = shop.querySelector( '.wccs-grid' );
    const loading  = shop.querySelector( '.wccs-loading' );
    const noResult = shop.querySelector( '.wccs-no-results' );
    const countEl  = shop.querySelector( '.wccs-count strong' );
    const loadMore = shop.querySelector( '.wccs-load-more' );

    /* ---- Filter state ---- */
    const state = {
        category       : '',
        strain         : '',
        search         : '',
        sort           : 'menu_order',
        paged          : 1,
        per_page       : parseInt( shop.dataset.perPage, 10 ) || 12,
        sale_only      : false,
        price          : [],
        potency_thc_min: 0,
        potency_thc_max: 100,
        potency_cbd_min: 0,
        potency_cbd_max: 100,
    };

    let potencyUnit   = '%';
    let debounceTimer = null;

    /* ════════════════════════════════════════
       HELPERS
    ════════════════════════════════════════ */

    function setLoading( on ) {
        loading.style.display = on ? 'block' : 'none';
        grid.style.opacity    = on ? '.4'    : '1';
    }

    function updateCount( n ) {
        if ( countEl ) countEl.textContent = n;
    }

    function resetPage() { state.paged = 1; }

    /* ════════════════════════════════════════
       AJAX FETCH
    ════════════════════════════════════════ */

    async function fetchProducts( append = false ) {
        setLoading( true );
        noResult.style.display = 'none';

        const body = new URLSearchParams( {
            action          : 'wccs_get_products',
            nonce           : wccs.nonce,
            category        : state.category,
            strain          : state.strain,
            search          : state.search,
            per_page        : state.per_page,
            paged           : state.paged,
            sort            : state.sort,
            sale_only       : state.sale_only ? '1' : '0',
            price           : state.price.join( ',' ),
            potency_unit    : potencyUnit,
            potency_thc_min : state.potency_thc_min,
            potency_thc_max : state.potency_thc_max,
            potency_cbd_min : state.potency_cbd_min,
            potency_cbd_max : state.potency_cbd_max,
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

                if ( ! data.data.html || ! data.data.html.trim() ) {
                    noResult.style.display = 'block';
                }

                const loaded = grid.querySelectorAll( '.wccs-product-card' ).length;
                if ( loadMore ) {
                    loadMore.style.display = loaded < data.data.total ? 'block' : 'none';
                }
            }
        } catch ( e ) {
            console.error( 'WCCS fetch error', e );
        } finally {
            setLoading( false );
        }
    }

    /* ════════════════════════════════════════
       CATEGORY ICONS
    ════════════════════════════════════════ */

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

    /* ════════════════════════════════════════
       STRAIN BUTTONS (multi-select)
    ════════════════════════════════════════ */

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

    /* ════════════════════════════════════════
       POTENCY TYPE SWITCH (% / mg)
    ════════════════════════════════════════ */

    shop.querySelectorAll( '.wccs-potency-type-btn' ).forEach( btn => {
        btn.addEventListener( 'click', () => {
            shop.querySelectorAll( '.wccs-potency-type-btn' ).forEach( b => b.classList.remove( 'active' ) );
            btn.classList.add( 'active' );
            potencyUnit = btn.dataset.type;

            // Update all value pill labels with the new unit
            shop.querySelectorAll( '.wccs-potency-slider' ).forEach( block => {
                const valMin = block.querySelector( '.wccs-range-value-min' );
                const valMax = block.querySelector( '.wccs-range-value-max' );
                const slider = block.querySelector( '.wccs-range-slider' );
                if ( ! slider || ! valMin || ! valMax ) return;
                const inputMin = slider.querySelector( '.wccs-range-input-min' );
                const inputMax = slider.querySelector( '.wccs-range-input-max' );
                valMin.textContent = inputMin.value + potencyUnit;
                valMax.textContent = inputMax.value + potencyUnit;
            } );

            resetPage();
            fetchProducts();
        } );
    } );

    /* ════════════════════════════════════════
       DUAL RANGE SLIDERS
       Value labels live in .wccs-potency-values (parent .wccs-potency-slider),
       NOT inside .wccs-range-slider — so we walk up to find them.
    ════════════════════════════════════════ */

    function initRangeSlider( sliderEl ) {
        // The slider track lives inside .wccs-range-slider
        const track    = sliderEl.querySelector( '.wccs-range-track' );
        const fill     = sliderEl.querySelector( '.wccs-range-fill' );
        const thumbMin = sliderEl.querySelector( '.wccs-range-min' );
        const thumbMax = sliderEl.querySelector( '.wccs-range-max' );
        const inputMin = sliderEl.querySelector( '.wccs-range-input-min' );
        const inputMax = sliderEl.querySelector( '.wccs-range-input-max' );

        // Value labels live one level UP in .wccs-potency-slider > .wccs-potency-values
        const potBlock = sliderEl.closest( '.wccs-potency-slider' );
        const valMin   = potBlock ? potBlock.querySelector( '.wccs-range-value-min' ) : null;
        const valMax   = potBlock ? potBlock.querySelector( '.wccs-range-value-max' ) : null;

        let minVal   = 0;
        let maxVal   = 100;
        let dragging = null;

        function updateUI() {
            fill.style.left       = minVal + '%';
            fill.style.width      = ( maxVal - minVal ) + '%';
            thumbMin.style.left   = minVal + '%';
            thumbMax.style.left   = maxVal + '%';

            if ( valMin ) valMin.textContent = Math.round( minVal ) + potencyUnit;
            if ( valMax ) valMax.textContent = Math.round( maxVal ) + potencyUnit;

            inputMin.value = Math.round( minVal );
            inputMax.value = Math.round( maxVal );
        }

        function pctFromX( clientX ) {
            const rect = track.getBoundingClientRect();
            const pct  = ( ( clientX - rect.left ) / rect.width ) * 100;
            return Math.round( Math.max( 0, Math.min( 100, pct ) ) );
        }

        function onPointerDown( e ) {
            e.preventDefault();
            dragging = e.currentTarget.dataset.thumb;
            document.addEventListener( 'pointermove', onPointerMove );
            document.addEventListener( 'pointerup',   onPointerUp );
        }

        function onPointerMove( e ) {
            if ( ! dragging ) return;
            const v = pctFromX( e.clientX );
            if ( dragging === 'min' ) {
                minVal = Math.min( v, maxVal );
            } else {
                maxVal = Math.max( v, minVal );
            }
            updateUI();
        }

        function onPointerUp() {
            dragging = null;
            document.removeEventListener( 'pointermove', onPointerMove );
            document.removeEventListener( 'pointerup',   onPointerUp );

            clearTimeout( debounceTimer );
            debounceTimer = setTimeout( () => {
                const field = sliderEl.dataset.field; // 'thc' or 'cbd'
                state[ 'potency_' + field + '_min' ] = Math.round( minVal );
                state[ 'potency_' + field + '_max' ] = Math.round( maxVal );
                resetPage();
                fetchProducts();
            }, 300 );
        }

        thumbMin.addEventListener( 'pointerdown', onPointerDown );
        thumbMax.addEventListener( 'pointerdown', onPointerDown );

        // Draw initial state
        updateUI();

        // Expose a reset helper used by resetAllFilters()
        return {
            reset() {
                minVal = 0;
                maxVal = 100;
                updateUI();
            }
        };
    }

    // Init all sliders and keep references for reset
    const sliderInstances = [];
    shop.querySelectorAll( '.wccs-range-slider' ).forEach( sliderEl => {
        sliderInstances.push( initRangeSlider( sliderEl ) );
    } );

    /* ════════════════════════════════════════
       SALE ONLY CHECKBOX
    ════════════════════════════════════════ */

    const saleCheckbox = shop.querySelector( '#wccs-sale-only' );
    if ( saleCheckbox ) {
        saleCheckbox.addEventListener( 'change', () => {
            state.sale_only = saleCheckbox.checked;
            resetPage();
            fetchProducts();
        } );
    }

    /* ════════════════════════════════════════
       PRICE RANGE CHECKBOXES
    ════════════════════════════════════════ */

    shop.querySelectorAll( '.wccs-price-checkbox input' ).forEach( cb => {
        cb.addEventListener( 'change', () => {
            state.price = [ ...shop.querySelectorAll( '.wccs-price-checkbox input:checked' ) ]
                .map( c => c.value );
            resetPage();
            fetchProducts();
        } );
    } );

    /* ════════════════════════════════════════
       SEARCH
    ════════════════════════════════════════ */

    const searchInput = shop.querySelector( '#wccs-search' );
    const searchClear = shop.querySelector( '.wccs-search-clear' );

    if ( searchInput ) {
        searchInput.addEventListener( 'input', () => {
            clearTimeout( debounceTimer );
            debounceTimer = setTimeout( () => {
                state.search = searchInput.value.trim();
                if ( searchClear ) {
                    searchClear.classList.toggle( 'visible', searchInput.value.length > 0 );
                }
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

    /* ════════════════════════════════════════
       SORT
    ════════════════════════════════════════ */

    const sortSelect = shop.querySelector( '#wccs-sort' );
    if ( sortSelect ) {
        sortSelect.addEventListener( 'change', () => {
            state.sort = sortSelect.value;
            resetPage();
            fetchProducts();
        } );
    }

    /* ════════════════════════════════════════
       LOAD MORE
    ════════════════════════════════════════ */

    if ( loadMore ) {
        loadMore.addEventListener( 'click', () => {
            state.paged++;
            fetchProducts( true );
        } );
    }

    /* ════════════════════════════════════════
       CLEAR ALL FILTERS
    ════════════════════════════════════════ */

    function resetAllFilters() {
        // Reset state
        state.category        = '';
        state.strain          = '';
        state.search          = '';
        state.sale_only       = false;
        state.price           = [];
        state.potency_thc_min = 0;
        state.potency_thc_max = 100;
        state.potency_cbd_min = 0;
        state.potency_cbd_max = 100;
        potencyUnit           = '%';

        // Reset UI
        if ( searchInput ) searchInput.value = '';
        if ( searchClear ) searchClear.classList.remove( 'visible' );

        shop.querySelectorAll( '.wccs-cat-icon' ).forEach( b => b.classList.remove( 'active' ) );
        shop.querySelectorAll( '.wccs-strain-btn' ).forEach( b => b.classList.remove( 'active' ) );
        shop.querySelectorAll( '.wccs-price-checkbox input' ).forEach( cb => cb.checked = false );
        if ( saleCheckbox ) saleCheckbox.checked = false;

        // Reset potency unit switch
        shop.querySelectorAll( '.wccs-potency-type-btn' ).forEach( b => b.classList.remove( 'active' ) );
        const defaultUnitBtn = shop.querySelector( '.wccs-potency-type-btn[data-type="%"]' );
        if ( defaultUnitBtn ) defaultUnitBtn.classList.add( 'active' );

        // Reset sliders via stored instances (handles label updates correctly)
        sliderInstances.forEach( instance => instance.reset() );

        resetPage();
        fetchProducts();
    }

    const clearAllBtn = shop.querySelector( '#wccs-clear-all' );
    if ( clearAllBtn ) clearAllBtn.addEventListener( 'click', resetAllFilters );

    const clearFiltersTop = shop.querySelector( '#wccs-clear-filters-top' );
    if ( clearFiltersTop ) clearFiltersTop.addEventListener( 'click', resetAllFilters );

    /* ════════════════════════════════════════
       ADD TO CART — grid (AJAX, vanilla)
    ════════════════════════════════════════ */

    grid.addEventListener( 'click', async e => {
        const btn = e.target.closest( '.wccs-add-to-cart' );
        if ( ! btn ) return;

        e.preventDefault();
        e.stopPropagation();

        const originalText  = btn.textContent;
        btn.disabled        = true;
        btn.textContent     = 'Adding…';

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

                // Update mini-cart count
                if ( data.data && data.data.cart_count ) {
                    document.querySelectorAll( '.cart-count, .count' ).forEach( el => {
                        el.textContent = data.data.cart_count;
                    } );
                }

                // WooCommerce fragment refresh
                if ( typeof jQuery !== 'undefined' ) {
                    jQuery( document.body ).trigger( 'wc_fragment_refresh' );
                    jQuery( document.body ).trigger( 'added_to_cart' );
                }
                document.body.dispatchEvent( new CustomEvent( 'wc_fragment_refresh' ) );
                document.body.dispatchEvent( new CustomEvent( 'added_to_cart' ) );

                // Apply WC fragments from response
                if ( data.data && data.data.fragments ) {
                    Object.keys( data.data.fragments ).forEach( selector => {
                        const el = document.querySelector( selector );
                        if ( el ) el.outerHTML = data.data.fragments[ selector ];
                    } );
                }
            } else {
                btn.textContent = ( data.data && data.data.message ) ? data.data.message : 'Error';
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


/* ════════════════════════════════════════════════════════════
   WC Cannabis Shop — Quick-View Popup  (requires jQuery / WC)
════════════════════════════════════════════════════════════ */
( function ( $ ) {
    'use strict';

    const POPUP_ID = 'wccs-quickview-overlay';

    /* ---- Build overlay HTML once ---- */
    function buildOverlay() {
        if ( $( '#' + POPUP_ID ).length ) return;

        $( 'body' ).append( `
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
        </div>` );

        bindOverlayEvents();
    }

    /* ---- Events: close, qty, add to cart ---- */
    function bindOverlayEvents() {
        const $overlay = $( '#' + POPUP_ID );

        $overlay.on( 'click', '.wccs-qv-backdrop, .wccs-qv-close', closePopup );

        $( document ).on( 'keydown.wccs-qv', e => {
            if ( e.key === 'Escape' ) closePopup();
        } );

        // Quantity: minus
        $overlay.on( 'click', '.wccs-qv-minus', function () {
            let qty = parseInt( $overlay.data( 'qty' ) || 1 );
            if ( qty > 1 ) {
                qty--;
                $overlay.data( 'qty', qty );
                $overlay.find( '.wccs-qv-qty-display' ).text( qty + ' pc' );
                $overlay.find( '.wccs-qv-minus' ).prop( 'disabled', qty <= 1 );
            }
        } );

        // Quantity: plus
        $overlay.on( 'click', '.wccs-qv-plus', function () {
            let qty = parseInt( $overlay.data( 'qty' ) || 1 );
            qty++;
            $overlay.data( 'qty', qty );
            $overlay.find( '.wccs-qv-qty-display' ).text( qty + ' pc' );
            $overlay.find( '.wccs-qv-minus' ).prop( 'disabled', false );
        } );

        // Add to cart
        $overlay.on( 'click', '.wccs-qv-atc', function () {
            const productId = $overlay.data( 'product-id' );
            const qty       = parseInt( $overlay.data( 'qty' ) || 1 );
            const $btn      = $( this );

            if ( ! productId ) return;

            $btn.addClass( 'wccs-qv-loading' ).prop( 'disabled', true ).text( 'Adding…' );

            $.ajax( {
                url  : wccs.ajax_url,
                type : 'POST',
                data : {
                    action     : 'wccs_add_to_cart',
                    product_id : productId,
                    quantity   : qty,
                    nonce      : wccs.cart_nonce,
                },
                success( res ) {
                    if ( res.success ) {
                        $btn.removeClass( 'wccs-qv-loading' ).addClass( 'wccs-qv-added' ).text( '✓ Added!' );
                        $( document.body ).trigger( 'wc_fragment_refresh' );
                        $( document.body ).trigger( 'added_to_cart' );
                        setTimeout( () => {
                            closePopup();
                            setTimeout( () => {
                                $btn.removeClass( 'wccs-qv-added' ).prop( 'disabled', false ).text( 'Add to Cart' );
                            }, 300 );
                        }, 1200 );
                    } else {
                        $btn.removeClass( 'wccs-qv-loading' ).prop( 'disabled', false )
                            .text( res.data?.message || 'Error' );
                    }
                },
                error() {
                    $btn.removeClass( 'wccs-qv-loading' ).prop( 'disabled', false ).text( 'Error' );
                },
            } );
        } );
    }

    /* ---- Open popup ---- */
    function openPopup( $card ) {
        const $overlay = $( '#' + POPUP_ID );

        const productId   = $card.data( 'product-id' ) || $card.find( '[data-product-id]' ).data( 'product-id' );
        const title       = $card.find( '.wccs-product-title' ).text().trim();
        const price       = $card.find( '.wccs-price' ).html();
        const unit        = $card.find( '.wccs-qty' ).text().trim();
        const imgSrc      = $card.find( '.wccs-product-image img' ).attr( 'src' ) || '';
        const imgAlt      = $card.find( '.wccs-product-image img' ).attr( 'alt' ) || title;
        const badgeText   = $card.find( '.wccs-badge' ).text().trim();
        const badgeColor  = $card.find( '.wccs-badge' ).css( 'background-color' ) || '';
        const description = $card.find( '.wccs-product-description' ).html() || '';

        $overlay.data( 'qty', 1 ).data( 'product-id', productId );

        $overlay.find( '.wccs-qv-image' ).attr( { src: imgSrc, alt: imgAlt } );
        $overlay.find( '.wccs-qv-title' ).text( title );
        $overlay.find( '.wccs-qv-price' ).html( price );
        $overlay.find( '.wccs-qv-unit' ).text( unit ? '/ ' + unit : '' );
        $overlay.find( '.wccs-qv-description' ).html( description );
        $overlay.find( '.wccs-qv-qty-display' ).text( '1 pc' );
        $overlay.find( '.wccs-qv-minus' ).prop( 'disabled', true );
        $overlay.find( '.wccs-qv-atc' ).prop( 'disabled', false )
            .removeClass( 'wccs-qv-loading wccs-qv-added' ).text( 'Add to Cart' );

        if ( badgeText ) {
            $overlay.find( '.wccs-qv-badge' ).text( badgeText ).css( 'background-color', badgeColor ).show();
        } else {
            $overlay.find( '.wccs-qv-badge' ).hide();
        }

        $overlay.addClass( 'wccs-qv-active' );
        $( 'body' ).addClass( 'wccs-qv-open' );
        $overlay.find( '.wccs-qv-close' ).trigger( 'focus' );
    }

    /* ---- Close popup ---- */
    function closePopup() {
        $( '#' + POPUP_ID ).removeClass( 'wccs-qv-active' );
        $( 'body' ).removeClass( 'wccs-qv-open' );
    }

    /* ---- Init ---- */
    function init() {
        buildOverlay();

        // Image or title click → open popup
        $( document ).on( 'click', '.wccs-product-card .wccs-product-image, .wccs-product-title a', function ( e ) {
            e.preventDefault();
            openPopup( $( this ).closest( '.wccs-product-card' ) );
        } );

        // Prevent add-to-cart button from triggering popup
        $( document ).on( 'click', '.wccs-product-card .wccs-add-to-cart', function ( e ) {
            e.stopPropagation();
        } );
    }

    $( document ).ready( init );

} )( jQuery );


/* ════════════════════════════════════════════════════════════
   WC Cannabis Shop — Store Picker Init
════════════════════════════════════════════════════════════ */
( function () {
    'use strict';

    if ( typeof StorePicker === 'undefined' ) {
        console.warn( 'WCCS: StorePicker not loaded from map.js' );
        return;
    }
    if ( typeof WCCS_STORES === 'undefined' ) {
        console.warn( 'WCCS: WCCS_STORES not defined' );
        return;
    }

    console.log( 'WCCS: StorePicker initializing with', WCCS_STORES.length, 'stores' );

    StorePicker.init( WCCS_STORES, {
        // Optional Google Maps API key:
        // googleMapsApiKey: 'YOUR_KEY_HERE',
        onSelect: function( store, tab ) {
            console.log( 'Selected:', store.name, 'via', tab );
        },
        onClose: function() {
            console.log( 'Picker closed' );
        },
    } );

    const storeBtn = document.getElementById( 'wccs-store-btn' );
    if ( storeBtn ) {
        console.log( 'WCCS: Store button found, binding click' );
        storeBtn.addEventListener( 'click', function() {
            console.log( 'WCCS: Store button clicked' );
            StorePicker.open();
        } );
    } else {
        console.warn( 'WCCS: Store button NOT found' );
    }

} )();