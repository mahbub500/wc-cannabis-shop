/**
 * WC Cannabis Shop — Admin JS
 * File: assets/admin.js
 *
 * Depends on: jQuery, Leaflet (loaded by wp_enqueue_script)
 * Passed globals: wccAdmin.strings, wccAdmin.nonce
 */
( function ( $, L, wccAdmin ) {
    'use strict';

    /* =========================================================================
     * Helpers
     * ====================================================================== */

    /**
     * Reverse-geocode lat/lng via Nominatim and fill the address field.
     */
    function reverseGeocode( lat, lng ) {
        var url =
            'https://nominatim.openstreetmap.org/reverse?format=jsonv2' +
            '&lat=' + lat + '&lon=' + lng + '&accept-language=en';

        $.getJSON( url, function ( data ) {
            if ( data && data.display_name ) {
                $( '#wccs_address' ).val( data.display_name );
            }
        } );
    }

    /* =========================================================================
     * Map picker  (Add / Edit form)
     * ====================================================================== */

    var pickerMap    = null;
    var pickerMarker = null;

    function initPickerMap() {
        var $mapEl = $( '#wccs-map' );
        if ( ! $mapEl.length ) { return; }

        var savedLat = parseFloat( $mapEl.data( 'lat' ) ) || 0;
        var savedLng = parseFloat( $mapEl.data( 'lng' ) ) || 0;

        // Default center: world view unless a saved pin exists
        var center = ( savedLat !== 0 || savedLng !== 0 )
            ? [ savedLat, savedLng ]
            : [ 20, 0 ];
        var zoom   = ( savedLat !== 0 || savedLng !== 0 ) ? 14 : 2;

        pickerMap = L.map( 'wccs-map', { zoomControl: true } ).setView( center, zoom );

        L.tileLayer( 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
        } ).addTo( pickerMap );

        // Restore saved marker
        if ( savedLat !== 0 || savedLng !== 0 ) {
            pickerMarker = L.marker( [ savedLat, savedLng ], { draggable: true } ).addTo( pickerMap );
            bindMarkerDrag( pickerMarker );
        }

        // Click on map → place / move marker
        pickerMap.on( 'click', function ( e ) {
            placePickerMarker( e.latlng.lat, e.latlng.lng );
        } );
    }

    function placePickerMarker( lat, lng ) {
        if ( pickerMarker ) {
            pickerMarker.setLatLng( [ lat, lng ] );
        } else {
            pickerMarker = L.marker( [ lat, lng ], { draggable: true } ).addTo( pickerMap );
            bindMarkerDrag( pickerMarker );
        }
        updateHiddenFields( lat, lng );
        reverseGeocode( lat, lng );
        pickerMap.setView( [ lat, lng ], 15 );
    }

    function bindMarkerDrag( marker ) {
        marker.on( 'dragend', function () {
            var pos = marker.getLatLng();
            updateHiddenFields( pos.lat, pos.lng );
            reverseGeocode( pos.lat, pos.lng );
        } );
    }

    function updateHiddenFields( lat, lng ) {
        $( '#wccs_lat' ).val( lat );
        $( '#wccs_lng' ).val( lng );
    }

    /* ── "Use my location" button ─────────────────────────────────────────── */

    $( document ).on( 'click', '#wccs-locate-me', function () {
        if ( ! navigator.geolocation ) {
            alert( wccAdmin.strings.locError );
            return;
        }
        var $btn = $( this );
        $btn.prop( 'disabled', true ).text( '⏳ Locating…' );

        navigator.geolocation.getCurrentPosition(
            function ( position ) {
                var lat = position.coords.latitude;
                var lng = position.coords.longitude;

                if ( ! pickerMap ) {
                    $( '#wccs-map' ).data( 'lat', lat ).data( 'lng', lng );
                    initPickerMap();
                } else {
                    placePickerMarker( lat, lng );
                }

                $btn.prop( 'disabled', false ).html( '🎯 ' + ( wccAdmin.strings.myLocation || 'Use My Location' ) );
            },
            function () {
                alert( wccAdmin.strings.locError );
                $btn.prop( 'disabled', false ).html( '🎯 ' + ( wccAdmin.strings.myLocation || 'Use My Location' ) );
            },
            { timeout: 10000 }
        );
    } );

    /* =========================================================================
     * Preview map  (all locations overview)
     * ====================================================================== */

    function initPreviewMap() {
        var $mapEl = $( '#wccs-preview-map' );
        if ( ! $mapEl.length ) { return; }

        var locations = [];
        try {
            locations = JSON.parse( $mapEl.attr( 'data-locations' ) || '[]' );
        } catch ( e ) {
            return;
        }

        if ( ! locations.length ) { return; }

        var previewMap = L.map( 'wccs-preview-map', { zoomControl: true } ).setView( [ 20, 0 ], 2 );

        L.tileLayer( 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
        } ).addTo( previewMap );

        var bounds = [];

        $.each( locations, function ( i, loc ) {
            var lat = parseFloat( loc.lat );
            var lng = parseFloat( loc.lng );
            if ( isNaN( lat ) || isNaN( lng ) || ( lat === 0 && lng === 0 ) ) { return; }

            bounds.push( [ lat, lng ] );

            // Build popup HTML
            var slotsHtml = '';
            if ( loc.time_slots && loc.time_slots.length ) {
                var slotLabels = loc.time_slots.join( ', ' );
                slotsHtml = '<div class="wccs-popup-slots">🕐 ' + $( '<div>' ).text( slotLabels ).html() + '</div>';
            }

            var popupContent =
                '<div class="wccs-popup-title">📍 ' + $( '<div>' ).text( loc.title || '' ).html() + '</div>' +
                ( loc.address ? '<div>' + $( '<div>' ).text( loc.address ).html() + '</div>' : '' ) +
                slotLabels;

            L.marker( [ lat, lng ] )
                .addTo( previewMap )
                .bindPopup( popupContent );
        } );

        if ( bounds.length === 1 ) {
            previewMap.setView( bounds[0], 14 );
        } else if ( bounds.length > 1 ) {
            previewMap.fitBounds( bounds, { padding: [ 40, 40 ] } );
        }
    }

    /* =========================================================================
     * Init on DOM ready
     * ====================================================================== */

    $( function () {
        initPickerMap();
        initPreviewMap();
    } );

} )( jQuery, L, wccAdmin || {} );