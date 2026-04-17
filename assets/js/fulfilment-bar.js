/**
 * WC Cannabis Shop — Fulfilment Bar
 * File: assets/js/fulfilment-bar.js
 *
 * Depends on: jQuery, Leaflet
 * Global: wccsFul  (via wp_localize_script)
 */
( function ( $, L, cfg ) {
    'use strict';

    /* =========================================================================
     * State
     * ====================================================================== */
    var locations      = [];
    var pickupMap      = null;
    var allMarkers     = [];
    var selectedId     = null;
    var selectedSlot   = null;
    var mapInitialised = false;

    /* =========================================================================
     * Modal — open
     * ====================================================================== */
    $( document ).on( 'click', '#wccs-ful-open-btn', function () {
        $( '#wccs-ful-modal-overlay' ).addClass( 'is-open' );
        $( 'body' ).css( 'overflow', 'hidden' );

        // Always boot pickup tab if it's the active one
        if ( $( '#wccs-panel-pickup' ).hasClass( 'is-active' ) ) {
            bootPickup();
        }
    } );

    /* ── close ───────────────────────────────────────────────────────────── */
    $( document ).on( 'click', '#wccs-ful-close-btn', closeModal );

    $( document ).on( 'click', '#wccs-ful-modal-overlay', function ( e ) {
        if ( $( e.target ).is( '#wccs-ful-modal-overlay' ) ) { closeModal(); }
    } );

    $( document ).on( 'keydown', function ( e ) {
        if ( e.key === 'Escape' ) { closeModal(); }
    } );

    function closeModal() {
        $( '#wccs-ful-modal-overlay' ).removeClass( 'is-open' );
        $( 'body' ).css( 'overflow', '' );
    }

    /* =========================================================================
     * Tabs
     * ====================================================================== */
    $( document ).on( 'click', '.wccs-ful-tab', function () {
        var tab = $( this ).data( 'tab' );
        $( '.wccs-ful-tab' ).removeClass( 'is-active' );
        $( this ).addClass( 'is-active' );
        $( '.wccs-ful-panel' ).removeClass( 'is-active' );
        $( '#wccs-panel-' + tab ).addClass( 'is-active' );
        if ( tab === 'pickup' ) { bootPickup(); }
    } );

    /* =========================================================================
     * Boot the pickup tab
     * Always load locations if the list is still showing the spinner / empty
     * ====================================================================== */
    function bootPickup() {
        var $list    = $( '#wccs-pickup-list' );
        var hasItems = $list.find( '.wccs-pickup-item' ).length > 0;

        if ( ! hasItems ) {
            // Show spinner while loading
            $list.html(
                '<div class="wccs-pickup-list__loading">' +
                '<span class="wccs-spinner"></span> Loading locations…</div>'
            );
            loadLocations();
        } else {
            // List already rendered — just fix map size
            if ( pickupMap ) { setTimeout( function () { pickupMap.invalidateSize(); }, 100 ); }
        }
    }

    /* =========================================================================
     * AJAX — fetch locations from server
     * ====================================================================== */
    function loadLocations() {
        var postData = {
            action: 'wccs_get_locations',
        };

        // Attach nonce only if available
        if ( cfg.nonce ) {
            postData.nonce = cfg.nonce;
        }

        $.ajax( {
            url:    cfg.ajax_url,
            type:   'POST',
            data:   postData,
            dataType: 'json',
        } )
        .done( function ( res ) {
            if ( ! res || ! res.success ) {
                showListError( 'Server error. Please refresh.' );
                return;
            }

            if ( ! res.data || res.data.length === 0 ) {
                $( '#wccs-pickup-list' ).html(
                    '<p style="padding:16px;color:#6b7280;font-size:.85rem;">' +
                    'No pickup locations available yet.</p>'
                );
                return;
            }

            locations = res.data;
            renderList();

            // Init map then add markers — map must exist before markers
            initMap( function () {
                addMapMarkers();

                // Restore previously confirmed selection from session
                var saved = cfg.saved || {};
                if ( saved.mode === 'pickup' && saved.pickup_id !== undefined ) {
                    selectLocation( parseInt( saved.pickup_id, 10 ), saved.pickup_slot || null );
                }
            } );
        } )
        .fail( function ( xhr ) {
            showListError( 'Could not load locations (network error).' );
            console.error( '[wccs] locations AJAX failed', xhr.status, xhr.responseText );
        } );
    }

    function showListError( msg ) {
        $( '#wccs-pickup-list' ).html(
            '<p style="padding:16px;color:#dc2626;font-size:.85rem;">' + msg + '</p>'
        );
    }

    /* =========================================================================
     * Render the location list
     * ====================================================================== */
    function renderList() {
        var $list = $( '#wccs-pickup-list' ).empty();

        $.each( locations, function ( i, loc ) {
            var slotsHtml = '';
            if ( loc.time_slots && loc.time_slots.length ) {
                slotsHtml = '<div class="wccs-pickup-item__slots">';
                $.each( loc.time_slots, function ( si, slot ) {
                    slotsHtml +=
                        '<span class="wccs-pickup-slot-tag" data-slot="' + escAttr( slot ) + '">' +
                        esc( slot ) + '</span>';
                } );
                slotsHtml += '</div>';
            }

            $list.append(
                '<button class="wccs-pickup-item" type="button" data-id="' + i + '">' +
                  '<div class="wccs-pickup-item__title">📍 ' + esc( loc.title ) + '</div>' +
                  ( loc.address
                      ? '<div class="wccs-pickup-item__address">' + esc( loc.address ) + '</div>'
                      : '' ) +
                  slotsHtml +
                '</button>'
            );
        } );
    }

    /* =========================================================================
     * Leaflet map — init once, then just invalidate size on re-open
     * ====================================================================== */
    function initMap( onReady ) {
        if ( mapInitialised && pickupMap ) {
            setTimeout( function () {
                pickupMap.invalidateSize();
                if ( typeof onReady === 'function' ) { onReady(); }
            }, 150 );
            return;
        }

        mapInitialised = true;

        pickupMap = L.map( 'wccs-pickup-map', {
            center:      [ 20, 0 ],
            zoom:        2,
            zoomControl: true,
        } );

        L.tileLayer( 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom:     19,
        } ).addTo( pickupMap );

        // Wait for modal paint before invalidating + running callback
        setTimeout( function () {
            pickupMap.invalidateSize();
            if ( typeof onReady === 'function' ) { onReady(); }
        }, 300 );
    }

    /* =========================================================================
     * Add all location markers to the map
     * ====================================================================== */
    function addMapMarkers() {
        // Clear existing markers
        $.each( allMarkers, function ( i, m ) {
            if ( m ) { pickupMap.removeLayer( m ); }
        } );
        allMarkers = [];

        var validMarkers = [];

        $.each( locations, function ( i, loc ) {
            if ( ! loc.lat || ! loc.lng ) { return; }

            var slotText = ( loc.time_slots && loc.time_slots.length )
                ? '<br><small>🕐 ' + loc.time_slots.map( esc ).join( ', ' ) + '</small>'
                : '';

            var marker = L.marker( [ loc.lat, loc.lng ] )
                .addTo( pickupMap )
                .bindPopup(
                    '<strong>' + esc( loc.title ) + '</strong>' +
                    ( loc.address ? '<br><span style="font-size:.85em">' + esc( loc.address ) + '</span>' : '' ) +
                    slotText
                );

            marker.on( 'click', function () {
                selectLocation( i, null );
                scrollListTo( i );
            } );

            allMarkers[ i ] = marker;
            validMarkers.push( marker );
        } );

        // Fit map view to all markers
        if ( validMarkers.length > 1 ) {
            try {
                pickupMap.fitBounds(
                    L.featureGroup( validMarkers ).getBounds().pad( 0.4 )
                );
            } catch (e) {}
        } else if ( validMarkers.length === 1 ) {
            pickupMap.setView( validMarkers[0].getLatLng(), 13 );
            validMarkers[0].openPopup();
        }
    }

    /* =========================================================================
     * Select a location — highlight list row + pan map
     * ====================================================================== */
    function selectLocation( id, slot ) {
        selectedId   = id;
        selectedSlot = slot;

        var loc = locations[ id ];
        if ( ! loc ) { return; }

        $( '.wccs-pickup-item' ).removeClass( 'is-selected' );
        $( '.wccs-pickup-item[data-id="' + id + '"]' ).addClass( 'is-selected' );

        if ( slot ) {
            $( '.wccs-pickup-item[data-id="' + id + '"] .wccs-pickup-slot-tag' ).each( function () {
                $( this ).toggleClass( 'is-selected', $( this ).data( 'slot' ) === slot );
            } );
            $( '#wccs-pickup-save-btn' ).prop( 'disabled', false );
        } else {
            $( '.wccs-pickup-slot-tag' ).removeClass( 'is-selected' );
            $( '#wccs-pickup-save-btn' ).prop( 'disabled', true );
        }

        if ( loc.lat && loc.lng && pickupMap ) {
            $( '#wccs-map-placeholder' ).addClass( 'is-hidden' );
            pickupMap.setView( [ loc.lat, loc.lng ], 14 );
            if ( allMarkers[ id ] ) { allMarkers[ id ].openPopup(); }
        }
    }

    function scrollListTo( id ) {
        var el = $( '.wccs-pickup-item[data-id="' + id + '"]' ).get(0);
        if ( el ) { el.scrollIntoView( { behavior: 'smooth', block: 'nearest' } ); }
    }

    /* =========================================================================
     * List item click
     * ====================================================================== */
    $( document ).on( 'click', '.wccs-pickup-item', function ( e ) {
        if ( $( e.target ).hasClass( 'wccs-pickup-slot-tag' ) ) { return; }
        selectLocation( parseInt( $( this ).data( 'id' ), 10 ), null );
    } );

    /* ── Slot tag click ──────────────────────────────────────────────────── */
    $( document ).on( 'click', '.wccs-pickup-slot-tag', function ( e ) {
        e.stopPropagation();
        var id   = parseInt( $( this ).closest( '.wccs-pickup-item' ).data( 'id' ), 10 );
        var slot = String( $( this ).data( 'slot' ) );

        if ( selectedId !== id ) { selectLocation( id, null ); }

        $( '.wccs-pickup-item[data-id="' + id + '"] .wccs-pickup-slot-tag' )
            .removeClass( 'is-selected' );
        $( this ).addClass( 'is-selected' );
        selectedSlot = slot;
        $( '#wccs-pickup-save-btn' ).prop( 'disabled', false );
    } );

    /* =========================================================================
     * Confirm pickup
     * ====================================================================== */
    $( document ).on( 'click', '#wccs-pickup-save-btn', function () {
        var loc = locations[ selectedId ];
        if ( ! loc || ! selectedSlot ) { return; }

        var $btn = $( this ).prop( 'disabled', true ).text( '…' );

        $.post( cfg.ajax_url, {
            action:       'wccs_save_fulfilment',
            nonce:        cfg.nonce,
            mode:         'pickup',
            pickup_id:    selectedId,
            pickup_title: loc.title,
            pickup_slot:  selectedSlot,
            pickup_lat:   loc.lat,
            pickup_lng:   loc.lng,
        }, function ( res ) {
            if ( res && res.success ) {
                updateBarLabel( '📍 ' + loc.title );
                flashMsg( '#wccs-pickup-msg', '✓ Confirmed!' );
                setTimeout( closeModal, 900 );
            }
            $btn.prop( 'disabled', false ).text( '✅ Confirm Pickup' );
        } );
    } );

    /* =========================================================================
     * Delivery form
     * ====================================================================== */
    $( document ).on( 'submit', '#wccs-delivery-form', function ( e ) {
        e.preventDefault();
        var addr = $( this ).find( '[name="delivery_address"]' ).val().trim();
        if ( ! addr ) {
            $( this ).find( '[name="delivery_address"]' ).css( 'border-color', '#dc2626' );
            return;
        }
        $( this ).find( '[name="delivery_address"]' ).css( 'border-color', '' );

        var $btn = $( this ).find( '.wccs-ful-save-btn' ).prop( 'disabled', true ).text( '…' );
        $.post( cfg.ajax_url, {
            action: 'wccs_save_fulfilment', nonce: cfg.nonce,
            mode: 'delivery', delivery_address: addr,
        }, function ( res ) {
            $btn.prop( 'disabled', false ).html( '💾 Save & Close' );
            if ( res && res.success ) {
                updateBarLabel( '🚚 ' + addr );
                flashMsg( '#wccs-delivery-msg', '✓ Saved!' );
                setTimeout( closeModal, 900 );
            }
        } );
    } );

    /* =========================================================================
     * Mail form
     * ====================================================================== */
    $( document ).on( 'submit', '#wccs-mail-form', function ( e ) {
        e.preventDefault();
        var addr = $( this ).find( '[name="mail_address"]' ).val().trim();
        if ( ! addr ) {
            $( this ).find( '[name="mail_address"]' ).css( 'border-color', '#dc2626' );
            return;
        }
        $( this ).find( '[name="mail_address"]' ).css( 'border-color', '' );

        var $btn = $( this ).find( '.wccs-ful-save-btn' ).prop( 'disabled', true ).text( '…' );
        $.post( cfg.ajax_url, {
            action: 'wccs_save_fulfilment', nonce: cfg.nonce,
            mode: 'mail', mail_address: addr,
        }, function ( res ) {
            $btn.prop( 'disabled', false ).html( '💾 Save & Close' );
            if ( res && res.success ) {
                updateBarLabel( '✉️ ' + addr );
                flashMsg( '#wccs-mail-msg', '✓ Saved!' );
                setTimeout( closeModal, 900 );
            }
        } );
    } );

    /* =========================================================================
     * Helpers
     * ====================================================================== */
    function updateBarLabel( text ) {
        $( '#wccs-ful-btn-label' ).text( text.length > 38 ? text.substring( 0, 37 ) + '…' : text );
    }

    function flashMsg( selector, text, isError ) {
        var $el = $( selector );
        $el.text( text ).toggleClass( 'is-error', !! isError ).addClass( 'is-visible' );
        setTimeout( function () { $el.removeClass( 'is-visible is-error' ); }, 2800 );
    }

    function esc( s ) { return $( '<div>' ).text( String( s ) ).html(); }

    function escAttr( s ) {
        return String( s )
            .replace( /&/g, '&amp;' ).replace( /"/g, '&quot;' )
            .replace( /'/g, '&#39;' ).replace( /</g, '&lt;'  ).replace( />/g, '&gt;' );
    }

} )( jQuery, L, ( typeof wccsFul !== 'undefined' ? wccsFul : {} ) );