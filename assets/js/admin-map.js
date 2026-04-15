/**
 * WC Cannabis Shop — Admin Map & Time Slots
 * Uses Leaflet + OpenStreetMap (no API key needed)
 */
( function () {
    'use strict';

    // Wait for DOM to be ready
    if ( document.readyState === 'loading' ) {
        document.addEventListener( 'DOMContentLoaded', init );
    } else {
        init();
    }

    function init() {
        var mapData = window.wccsMapData || {};
        var lat   = parseFloat( mapData.lat ) || 23.8103;
        var lng   = parseFloat( mapData.lng ) || 90.4125;
        var hasLocation = mapData.hasLocation || false;

        var mapEl = document.getElementById( 'wccs-map' );
        if ( ! mapEl ) return;

        // DOM elements
        var locationInput   = document.getElementById( 'wccs_location' );
        var latInput          = document.getElementById( 'wccs_latitude' );
        var lngInput          = document.getElementById( 'wccs_longitude' );
        var selectedLocation  = document.getElementById( 'wccs-selected-location' );
        var searchBtn         = document.getElementById( 'wccs-search-location-btn' );
        var addSlotBtn        = document.getElementById( 'wccs-add-slot-btn' );
        var slotLabelInput    = document.getElementById( 'wccs-slot-label' );
        var slotStartInput    = document.getElementById( 'wccs-slot-start' );
        var slotEndInput      = document.getElementById( 'wccs-slot-end' );
        var slotsList         = document.getElementById( 'wccs-time-slots-list' );

        /* ════════════════════════════════════════
           LEAFLET MAP
        ════════════════════════════════════════ */

        var map = L.map( 'wccs-map' ).setView( [ lat, lng ], 13 );

        L.tileLayer( 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19,
        } ).addTo( map );

        var marker = null;

        // Place marker if location exists
        if ( hasLocation ) {
            marker = L.marker( [ lat, lng ] ).addTo( map );
        }

        // Fix map rendering
        setTimeout( function() { map.invalidateSize(); }, 100 );

        // Click on map to set location
        map.on( 'click', function ( e ) {
            setMarker( e.latlng.lat, e.latlng.lng );
            reverseGeocode( e.latlng.lat, e.latlng.lng );
        } );

        function setMarker( latitude, longitude ) {
            if ( marker ) {
                marker.setLatLng( [ latitude, longitude ] );
            } else {
                marker = L.marker( [ latitude, longitude ] ).addTo( map );
            }

            latInput.value  = latitude.toFixed( 6 );
            lngInput.value  = longitude.toFixed( 6 );
            selectedLocation.textContent = 'Coordinates: ' + latitude.toFixed( 4 ) + ', ' + longitude.toFixed( 4 );
        }

        // Search location
        if ( searchBtn ) {
            searchBtn.addEventListener( 'click', searchLocation );
        }

        if ( locationInput ) {
            locationInput.addEventListener( 'keydown', function ( e ) {
                if ( e.key === 'Enter' ) {
                    e.preventDefault();
                    searchLocation();
                }
            } );
        }

        function searchLocation() {
            var query = locationInput.value.trim();
            if ( ! query ) return;

            searchBtn.textContent = 'Searching…';
            searchBtn.disabled = true;

            fetch( 'https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent( query ) + '&limit=1' )
                .then( function ( r ) { return r.json(); } )
                .then( function ( data ) {
                    if ( data.length > 0 ) {
                        var result = data[0];
                        var latitude  = parseFloat( result.lat );
                        var longitude = parseFloat( result.lon );

                        setMarker( latitude, longitude );
                        map.setView( [ latitude, longitude ], 15 );
                        locationInput.value = result.display_name;
                        selectedLocation.textContent = 'Selected: ' + result.display_name;
                    } else {
                        alert( 'Location not found. Try a different search term.' );
                    }
                } )
                .catch( function () {
                    alert( 'Search failed. Please try again.' );
                } )
                .finally( function () {
                    searchBtn.textContent = 'Search';
                    searchBtn.disabled = false;
                } );
        }

        function reverseGeocode( latitude, longitude ) {
            fetch( 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + latitude + '&lon=' + longitude )
                .then( function ( r ) { return r.json(); } )
                .then( function ( data ) {
                    if ( data && data.display_name ) {
                        locationInput.value = data.display_name;
                        selectedLocation.textContent = 'Selected: ' + data.display_name;
                    }
                } )
                .catch( function () {
                    selectedLocation.textContent = 'Coordinates set: ' + latitude.toFixed( 4 ) + ', ' + longitude.toFixed( 4 );
                } );
        }

        /* ════════════════════════════════════════
           TIME SLOTS
        ════════════════════════════════════════ */

        var slotIndex = slotsList ? slotsList.querySelectorAll( '.wccs-time-slot' ).length : 0;

        // Remove slot
        if ( slotsList ) {
            slotsList.addEventListener( 'click', function ( e ) {
                if ( e.target.classList.contains( 'wccs-remove-slot-btn' ) ) {
                    e.target.closest( '.wccs-time-slot' ).remove();
                    reindexSlots();
                }
            } );
        }

        // Add slot
        if ( addSlotBtn ) {
            addSlotBtn.addEventListener( 'click', function () {
                var label = slotLabelInput.value.trim();
                var start = slotStartInput.value;
                var end   = slotEndInput.value;

                if ( ! label || ! start || ! end ) {
                    alert( 'Please fill in all time slot fields.' );
                    return;
                }

                addSlotRow( label, start, end );

                // Clear inputs
                slotLabelInput.value = '';
                slotStartInput.value = '';
                slotEndInput.value = '';
            } );
        }

        function addSlotRow( label, start, end ) {
            var div = document.createElement( 'div' );
            div.className = 'wccs-time-slot';
            div.innerHTML =
                '<input type="hidden" name="wccs_settings[time_slots][' + slotIndex + '][label]" value="' + label + '">' +
                '<input type="hidden" name="wccs_settings[time_slots][' + slotIndex + '][start]" value="' + start + '">' +
                '<input type="hidden" name="wccs_settings[time_slots][' + slotIndex + '][end]" value="' + end + '">' +
                '<span class="wccs-slot-display"><strong>' + label + '</strong> ' + start + ' - ' + end + '</span>' +
                '<button type="button" class="wccs-remove-slot-btn">&times;</button>';

            slotsList.appendChild( div );
            slotIndex++;
        }

        function reindexSlots() {
            var slots = slotsList.querySelectorAll( '.wccs-time-slot' );
            slots.forEach( function ( el, i ) {
                el.setAttribute( 'data-index', i );
                var inputs = el.querySelectorAll( 'input[type="hidden"]' );
                if ( inputs[0] ) inputs[0].name = 'wccs_settings[time_slots][' + i + '][label]';
                if ( inputs[1] ) inputs[1].name = 'wccs_settings[time_slots][' + i + '][start]';
                if ( inputs[2] ) inputs[2].name = 'wccs_settings[time_slots][' + i + '][end]';
            } );
            slotIndex = slots.length;
        }
    }

} )();
