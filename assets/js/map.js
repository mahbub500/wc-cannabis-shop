/**
 * StorePicker — Dispensary location selector widget
 * Vanilla JS, no dependencies.
 *
 * Usage:
 *   StorePicker.init(stores, options);
 *   StorePicker.open();
 *   StorePicker.close();
 *
 * Store shape:
 *   { id, name, address, distance, hours, open, lat, lng, logo, color }
 *
 * Options:
 *   { googleMapsApiKey, onSelect(store, tab), onClose() }
 */

const StorePicker = ( function () {
    'use strict';

    /* ── Private state ── */
    let _stores      = [];
    let _options     = {};
    let _selected    = null;
    let _activeTab   = 'pickup';
    let _map         = null;   // Google Map instance
    let _markers     = [];     // Google Marker instances
    /* ── SVG map state ── */
    let _svgPins     = [];     // Fallback SVG pins (no Maps API)
    let _svgBounds   = null;   // Bounding box for SVG map
    let _svgContainer = null;  // Map container ref for repositioning
    let _positionPins = null;  // Exposed fn for repositioning
    let _mapReady    = false;
    let _initialized = false;

    /* ── DOM refs ── */
    const $ = id => document.getElementById( id );

    let overlay, backdrop, modal, closeBtn,
        storeHeader, storeLogo, storeName,
        tabs, storeList, cta,
        mapEl, mapPlaceholder;

    /* ════════════════════════════════════════
       PUBLIC API
    ════════════════════════════════════════ */

    function init( stores, options = {} ) {
        _stores  = stores  || [];
        _options = options || {};

        _bindDOM();
        _bindEvents();
        _renderStores();
        // Lazy map init — defer to first open()
        _initialized = true;
    }

    function open() {
        if ( ! _initialized ) {
            console.warn( 'StorePicker: call init() first.' );
            return;
        }

        // Lazy-init map on first open (overlay must be visible for dimensions)
        if ( ! _map && ! _svgPins.length ) {
            _initMap();
        }

        overlay.classList.add( 'sp-active' );
        document.body.classList.add( 'sp-open' );
        closeBtn.focus();

        // Reposition SVG pins after modal becomes visible
        if ( _svgPins.length && _positionPins ) {
            requestAnimationFrame( () => {
                requestAnimationFrame( () => {
                    _positionPins();
                } );
            } );
        }

        // Re-center map if already loaded
        if ( _map && _selected ) {
            _map.panTo( { lat: _selected.lat, lng: _selected.lng } );
        }
    }

    function close() {
        overlay.classList.remove( 'sp-active' );
        document.body.classList.remove( 'sp-open' );
        if ( typeof _options.onClose === 'function' ) {
            _options.onClose();
        }
    }

    /* ════════════════════════════════════════
       DOM BINDING
    ════════════════════════════════════════ */

    function _bindDOM() {
        overlay        = $( 'sp-overlay' );
        backdrop       = $( 'sp-backdrop' );
        modal          = $( 'sp-modal' );
        closeBtn       = $( 'sp-close' );
        storeHeader    = $( 'sp-store-header' );
        storeLogo      = $( 'sp-store-logo' );
        storeName      = $( 'sp-store-name' );
        tabs           = $( 'sp-tabs' );
        storeList      = $( 'sp-store-list' );
        cta            = $( 'sp-cta' );
        mapEl          = $( 'sp-map' );
        mapPlaceholder = $( 'sp-map-placeholder' );
    }

    function _bindEvents() {
        // Close
        closeBtn.addEventListener( 'click', close );
        backdrop.addEventListener( 'click', close );

        // Escape key
        document.addEventListener( 'keydown', e => {
            if ( e.key === 'Escape' && overlay.classList.contains( 'sp-active' ) ) {
                close();
            }
        } );

        // Prevent modal clicks from bubbling to backdrop
        modal.addEventListener( 'click', e => e.stopPropagation() );

        // Tabs
        tabs.addEventListener( 'click', e => {
            const btn = e.target.closest( '.sp-tab' );
            if ( ! btn ) return;
            _setTab( btn.dataset.tab );
        } );

        // CTA
        cta.addEventListener( 'click', () => {
            if ( ! _selected ) return;
            if ( typeof _options.onSelect === 'function' ) {
                _options.onSelect( _selected, _activeTab );
            }
            close();
        } );
    }

    /* ════════════════════════════════════════
       TAB LOGIC
    ════════════════════════════════════════ */

    function _setTab( tab ) {
        _activeTab = tab;
        tabs.querySelectorAll( '.sp-tab' ).forEach( btn => {
            const isActive = btn.dataset.tab === tab;
            btn.classList.toggle( 'active', isActive );
            btn.setAttribute( 'aria-selected', isActive );
        } );
    }

    /* ════════════════════════════════════════
       RENDER STORE LIST
    ════════════════════════════════════════ */

    function _renderStores() {
        storeList.innerHTML = '';

        _stores.forEach( store => {
            const item = document.createElement( 'div' );
            item.className   = 'sp-store-item';
            item.dataset.id  = store.id;
            item.role        = 'listitem';
            item.tabIndex    = 0;
            item.setAttribute( 'aria-label', store.name );

            item.innerHTML = `
                <div class="sp-store-check">
                    <svg viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l3 3 5-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="sp-store-distance">${ _esc( store.distance ) }</div>
                <div class="sp-store-item-name">${ _esc( store.name ) }</div>
                <div class="sp-store-address">${ _esc( store.address ) }</div>
                <div class="sp-store-hours">
                    <div class="sp-store-hours-dot ${ store.open ? '' : 'closed' }"></div>
                    Pickup time ${ _esc( store.hours ) }
                </div>
            `;

            item.addEventListener( 'click',  () => _selectStore( store.id ) );
            item.addEventListener( 'keydown', e => {
                if ( e.key === 'Enter' || e.key === ' ' ) {
                    e.preventDefault();
                    _selectStore( store.id );
                }
            } );

            storeList.appendChild( item );
        } );
    }

    /* ════════════════════════════════════════
       SELECT STORE
    ════════════════════════════════════════ */

    function _selectStore( id ) {
        const store = _stores.find( s => s.id === id );
        if ( ! store ) return;

        _selected = store;

        // Update store items
        storeList.querySelectorAll( '.sp-store-item' ).forEach( el => {
            el.classList.toggle( 'selected', el.dataset.id === id );
        } );

        // Update header
        storeName.textContent = store.name;
        storeLogo.innerHTML   = store.logo
            ? `<img src="${ _esc( store.logo ) }" alt="${ _esc( store.name ) }" loading="lazy">`
            : `<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="currentColor" opacity=".3"/><circle cx="12" cy="9" r="2.5" fill="currentColor"/></svg>`;

        // Enable CTA
        cta.disabled = false;

        // Map
        if ( _mapReady && _map ) {
            _focusGoogleMarker( id );
        } else if ( _svgPins.length ) {
            _focusSvgPin( id );
        }
    }

    /* ════════════════════════════════════════
       MAP — Google Maps
    ════════════════════════════════════════ */

    function _initMap() {
        if ( _options.googleMapsApiKey ) {
            _loadGoogleMaps( _options.googleMapsApiKey );
        } else {
            _initSvgMap();
        }
    }

    function _loadGoogleMaps( apiKey ) {
        if ( window.google && window.google.maps ) {
            _initGoogleMap();
            return;
        }

        const script = document.createElement( 'script' );
        script.src   = `https://maps.googleapis.com/maps/api/js?key=${ apiKey }&callback=__spGoogleMapsReady`;
        script.async = true;
        script.defer = true;

        window.__spGoogleMapsReady = () => {
            _initGoogleMap();
        };

        document.head.appendChild( script );
    }

    function _initGoogleMap() {
        if ( ! _stores.length ) return;

        const center = { lat: _stores[0].lat, lng: _stores[0].lng };

        _map = new google.maps.Map( mapEl, {
            center,
            zoom           : 11,
            disableDefaultUI: false,
            styles         : _mapStyles(),
        } );

        _mapReady = true;
        mapPlaceholder.classList.add( 'sp-hidden' );

        // Add markers
        _stores.forEach( store => {
            const marker = new google.maps.Marker( {
                position : { lat: store.lat, lng: store.lng },
                map      : _map,
                title    : store.name,
                icon     : _buildMarkerIcon( store.color || '#1bb98a' ),
            } );

            marker.addListener( 'click', () => _selectStore( store.id ) );
            _markers.push( { id: store.id, marker } );
        } );

        // Fit all markers
        const bounds = new google.maps.LatLngBounds();
        _stores.forEach( s => bounds.extend( { lat: s.lat, lng: s.lng } ) );
        _map.fitBounds( bounds );
    }

    function _buildMarkerIcon( color ) {
        const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 36 46">
            <path fill="${ color }" d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 28 18 28S36 31.5 36 18C36 8.06 27.94 0 18 0z"/>
            <circle cx="18" cy="18" r="9" fill="white" opacity=".9"/>
        </svg>`;
        return {
            url        : 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent( svg ),
            scaledSize : new google.maps.Size( 36, 46 ),
            anchor     : new google.maps.Point( 18, 46 ),
        };
    }

    function _focusGoogleMarker( id ) {
        const found = _markers.find( m => m.id === id );
        if ( ! found || ! _map ) return;
        _map.panTo( found.marker.getPosition() );
        _map.setZoom( 14 );
    }

    function _mapStyles() {
        return [
            { featureType: 'poi',   elementType: 'labels', stylers: [ { visibility: 'off' } ] },
            { featureType: 'transit', elementType: 'labels', stylers: [ { visibility: 'off' } ] },
            { elementType: 'geometry', stylers: [ { color: '#f0f2ef' } ] },
            { featureType: 'road',  elementType: 'geometry', stylers: [ { color: '#ffffff' } ] },
            { featureType: 'water', elementType: 'geometry', stylers: [ { color: '#c8d8c8' } ] },
        ];
    }

    /* ════════════════════════════════════════
       MAP — SVG Fallback (no API key)
    ════════════════════════════════════════ */

    function _initSvgMap() {
        if ( ! _stores.length ) return;

        // Find bounding box of store coords
        const lats = _stores.map( s => s.lat );
        const lngs = _stores.map( s => s.lng );
        const minLat = Math.min( ...lats );
        const maxLat = Math.max( ...lats );
        const minLng = Math.min( ...lngs );
        const maxLng = Math.max( ...lngs );

        // Add padding around the bounds
        const padLat = ( maxLat - minLat ) * 0.4 || 0.05;
        const padLng = ( maxLng - minLng ) * 0.4 || 0.05;

        _svgBounds = {
            minLat: minLat - padLat,
            maxLat: maxLat + padLat,
            minLng: minLng - padLng,
            maxLng: maxLng + padLng,
        };

        _svgContainer = mapEl;
        _svgContainer.style.position = 'absolute';
        _svgContainer.style.inset     = '0';
        _svgContainer.style.background = '#e8ede8';
        _svgContainer.style.overflow   = 'hidden';

        mapPlaceholder.classList.add( 'sp-hidden' );

        // Build SVG canvas
        const svg = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
        svg.setAttribute( 'width', '100%' );
        svg.setAttribute( 'height', '100%' );
        svg.style.position = 'absolute';
        svg.style.inset    = '0';

        // Grid lines for visual interest
        const defs   = document.createElementNS( 'http://www.w3.org/2000/svg', 'defs' );
        const pattern = document.createElementNS( 'http://www.w3.org/2000/svg', 'pattern' );
        pattern.setAttribute( 'id', 'sp-grid' );
        pattern.setAttribute( 'width', '40' );
        pattern.setAttribute( 'height', '40' );
        pattern.setAttribute( 'patternUnits', 'userSpaceOnUse' );
        const gridLine = document.createElementNS( 'http://www.w3.org/2000/svg', 'path' );
        gridLine.setAttribute( 'd', 'M 40 0 L 0 0 0 40' );
        gridLine.setAttribute( 'fill', 'none' );
        gridLine.setAttribute( 'stroke', '#dce2dc' );
        gridLine.setAttribute( 'stroke-width', '0.5' );
        pattern.appendChild( gridLine );
        defs.appendChild( pattern );
        svg.appendChild( defs );

        const bg = document.createElementNS( 'http://www.w3.org/2000/svg', 'rect' );
        bg.setAttribute( 'width', '100%' );
        bg.setAttribute( 'height', '100%' );
        bg.setAttribute( 'fill', 'url(#sp-grid)' );
        svg.appendChild( bg );
        _svgContainer.appendChild( svg );

        // Place pins as absolutely-positioned divs over the SVG
        _svgPins = [];
        _stores.forEach( store => {
            const pin = document.createElement( 'div' );
            pin.className      = 'sp-map-pin-svg';
            pin.dataset.id     = store.id;
            pin.title          = store.name;
            pin.style.position = 'absolute';
            pin.style.zIndex   = '1';
            pin.innerHTML      = _pinSVG( store.color || '#1bb98a', store.logo );

            pin.addEventListener( 'click', () => _selectStore( store.id ) );

            _svgContainer.appendChild( pin );
            _svgPins.push( { id: store.id, pin, lat: store.lat, lng: store.lng } );
        } );

        // Exposed position function for repositioning after modal opens
        _positionPins = function() {
            const w = _svgContainer.offsetWidth;
            const h = _svgContainer.offsetHeight;
            if ( ! w || ! h ) {
                console.warn( 'WCCS: SVG container has 0 dimensions, waiting for next frame' );
                return;
            }

            const { minLat: bMinLat, maxLat: bMaxLat, minLng: bMinLng, maxLng: bMaxLng } = _svgBounds;

            _svgPins.forEach( ( { pin, lat, lng } ) => {
                const x = ( ( lng - bMinLng ) / ( bMaxLng - bMinLng ) ) * w;
                const y = ( ( bMaxLat - lat ) / ( bMaxLat - bMinLat ) ) * h;
                pin.style.left = x + 'px';
                pin.style.top  = y + 'px';
            } );

            console.log( 'WCCS: Pins repositioned at', w + 'x' + h );
        };

        // Initial position (will be 0 if hidden, repositioned on open)
        const ro = new ResizeObserver( _positionPins );
        ro.observe( _svgContainer );
        _positionPins();

        console.log( 'WCCS: SVG map initialized with', _svgPins.length, 'pins' );
    }

    function _pinSVG( color, logoUrl ) {
        // Circular pin with optional logo
        if ( logoUrl ) {
            const id = 'sp-clip-' + Math.random().toString(36).slice(2);
            return `
            <svg width="52" height="66" viewBox="0 0 52 66" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <clipPath id="${id}">
                        <circle cx="26" cy="24" r="15"/>
                    </clipPath>
                    <filter id="sp-shadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.25)"/>
                    </filter>
                </defs>
                <g filter="url(#sp-shadow)">
                    <path fill-rule="evenodd" clip-rule="evenodd"
                        d="M26 2C14.954 2 6 10.954 6 22c0 4.193 1.254 8.09 3.41 11.334L26 58l16.59-24.666A19.928 19.928 0 0 0 46 22C46 10.954 37.046 2 26 2z"
                        fill="white"/>
                </g>
                <path d="M26 54L11 33.5h30L26 54z" fill="${ color }"/>
                <circle cx="26" cy="22" r="17" fill="white"/>
                <circle cx="26" cy="22" r="17" stroke="${ color }" stroke-width="2.5"/>
                <image href="${ logoUrl }" x="11" y="7" width="30" height="30" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>
            </svg>`;
        }
        return `
        <svg width="40" height="52" viewBox="0 0 40 52" fill="none">
            <defs>
                <filter id="sp-shadow2" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.25)"/>
                </filter>
            </defs>
            <g filter="url(#sp-shadow2)">
                <path fill-rule="evenodd" clip-rule="evenodd"
                    d="M20 2C10.059 2 2 10.059 2 20c0 4.03 1.3 7.76 3.5 10.8L20 48l14.5-17.2A17.93 17.93 0 0 0 38 20C38 10.059 29.941 2 20 2z"
                    fill="${ color }"/>
            </g>
            <circle cx="20" cy="19" r="7" fill="white" opacity=".9"/>
        </svg>`;
    }

    function _focusSvgPin( id ) {
        _svgPins.forEach( ( { pin } ) => pin.classList.remove( 'selected' ) );
        const found = _svgPins.find( p => p.id === id );
        if ( found ) found.pin.classList.add( 'selected' );
    }

    /* ════════════════════════════════════════
       UTILITIES
    ════════════════════════════════════════ */

    function _esc( str ) {
        if ( ! str ) return '';
        return String( str )
            .replace( /&/g,  '&amp;' )
            .replace( /</g,  '&lt;' )
            .replace( />/g,  '&gt;' )
            .replace( /"/g,  '&quot;' )
            .replace( /'/g,  '&#39;' );
    }

    /* ── Public interface ── */
    return { init, open, close };

} )();