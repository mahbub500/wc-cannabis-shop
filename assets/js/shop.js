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
        category : '',
        strain   : '',
        search   : '',
        sort     : 'menu_order',
        paged    : 1,
        per_page : parseInt( shop.dataset.perPage, 10 ) || 12,
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
            action   : 'wccs_get_products',
            nonce    : wccs.nonce,
            category : state.category,
            strain   : state.strain,
            search   : state.search,
            per_page : state.per_page,
            paged    : state.paged,
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

    /* ---- Search ---- */

    const searchInput = shop.querySelector( '#wccs-search' );
    if ( searchInput ) {
        searchInput.addEventListener( 'input', () => {
            clearTimeout( debounceTimer );
            debounceTimer = setTimeout( () => {
                state.search = searchInput.value.trim();
                resetPage();
                fetchProducts();
            }, 350 );
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

    /* ---- Add to cart (AJAX) ---- */

    grid.addEventListener( 'click', async e => {
        const btn = e.target.closest( '.wccs-add-to-cart' );
        if ( ! btn ) return;

        btn.disabled    = true;
        btn.textContent = 'Adding…';

        const body = new URLSearchParams( {
            action        : 'woocommerce_add_to_cart',
            product_id    : btn.dataset.productId,
            quantity      : 1,
            add-to-cart   : btn.dataset.productId,
        } );

        try {
            await fetch( wccs.ajax_url, { method: 'POST', body } );
            btn.textContent = '✓ Added!';
            // Trigger WC fragments refresh
            document.body.dispatchEvent( new CustomEvent( 'wc_fragment_refresh' ) );
            setTimeout( () => {
                btn.disabled    = false;
                btn.textContent = 'ADD TO CART';
            }, 2000 );
        } catch {
            btn.disabled    = false;
            btn.textContent = 'ADD TO CART';
        }
    } );

} )();
