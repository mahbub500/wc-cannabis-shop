/**
 * WC Cannabis Shop — Admin Settings
 * Requires: jQuery (WP bundled), Leaflet 1.9.x
 * Data injected by PHP via wp_localize_script as window.wccsData
 */
(function ($) {
    'use strict';

    var map, marker;

    /* =========================================================
       1. TAB SWITCHING
    ========================================================= */
    function initTabs() {
        $('.wccs-tab-btn').on('click', function () {
            var tab = $(this).data('tab');

            $('.wccs-tab-btn').removeClass('wccs-tab-active').attr('aria-selected', 'false');
            $('.wccs-tab-panel').removeClass('wccs-panel-active');

            $(this).addClass('wccs-tab-active').attr('aria-selected', 'true');
            $('#wccs-panel-' + tab).addClass('wccs-panel-active');

            // Leaflet needs a size refresh when its container becomes visible
            if (tab === 'settings' && map) {
                setTimeout(function () { map.invalidateSize(); }, 60);
            }
        });
    }

    /* =========================================================
       2. LEAFLET MAP
    ========================================================= */
    function initMap() {
        var el = document.getElementById('wccs-map');
        if (!el || typeof L === 'undefined') { return; }

        var d = window.wccsData || {};
        var lat = parseFloat(d.lat) || 23.8103;
        var lng = parseFloat(d.lng) || 90.4125;

        map = L.map('wccs-map').setView([lat, lng], d.hasLocation ? 14 : 10);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19
        }).addTo(map);

        // Create draggable marker
        marker = L.marker([lat, lng], { draggable: true }).addTo(map);

        if (!d.hasLocation) {
            marker.setOpacity(0.5); // dim until a real location is chosen
        }

        // Drag end → reverse geocode and update fields
        marker.on('dragend', function (e) {
            var ll = e.target.getLatLng();
            marker.setOpacity(1);
            reverseGeocode(ll.lat, ll.lng);
        });

        // Click on map → move pin + reverse geocode
        map.on('click', function (e) {
            marker.setLatLng(e.latlng).setOpacity(1);
            reverseGeocode(e.latlng.lat, e.latlng.lng);
        });

        // Search button
        $('#wccs-search-location-btn').on('click', function () {
            var q = $('#wccs_location').val().trim();
            if (!q) { return; }
            forwardGeocode(q);
        });

        // Enter key in search field
        $('#wccs_location').on('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                var q = $(this).val().trim();
                if (q) { forwardGeocode(q); }
            }
        });

        // My Location button
        $('#wccs-current-location-btn').on('click', function () {
            if (!navigator.geolocation) {
                alert('Geolocation is not supported by your browser.');
                return;
            }
            var $btn = $(this);
            $btn.text('Locating…').prop('disabled', true);
            navigator.geolocation.getCurrentPosition(
                function (pos) {
                    $btn.text('📍 My Location').prop('disabled', false);
                    var lt = pos.coords.latitude;
                    var ln = pos.coords.longitude;
                    marker.setLatLng([lt, ln]).setOpacity(1);
                    map.setView([lt, ln], 15);
                    reverseGeocode(lt, ln);
                },
                function () {
                    $btn.text('📍 My Location').prop('disabled', false);
                    alert('Could not get your location. Please check browser permissions.');
                }
            );
        });
    }

    /* -------------------------------------------------------
       Reverse geocode: lat/lng → address string
    ------------------------------------------------------- */
    function reverseGeocode(lat, lng) {
        setCoords(lat, lng);
        var url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng;
        $.getJSON(url)
            .done(function (data) {
                var label = data.display_name || (lat.toFixed(5) + ', ' + lng.toFixed(5));
                setLocationLabel(label);
            })
            .fail(function () {
                setLocationLabel(lat.toFixed(5) + ', ' + lng.toFixed(5));
            });
    }

    /* -------------------------------------------------------
       Forward geocode: address string → lat/lng
    ------------------------------------------------------- */
    function forwardGeocode(query) {
        var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(query);
        $.getJSON(url)
            .done(function (results) {
                if (!results || !results.length) {
                    alert('Location not found. Try a more specific search term.');
                    return;
                }
                var r  = results[0];
                var lt = parseFloat(r.lat);
                var ln = parseFloat(r.lon);
                marker.setLatLng([lt, ln]).setOpacity(1);
                map.setView([lt, ln], 15);
                setCoords(lt, ln);
                setLocationLabel(r.display_name);
            })
            .fail(function () {
                alert('Search failed. Please try again.');
            });
    }

    function setCoords(lat, lng) {
        $('#wccs_latitude').val(lat);
        $('#wccs_longitude').val(lng);
    }

    function setLocationLabel(label) {
        $('#wccs_location').val(label);
        $('#wccs-selected-location').text('📍 ' + label);
    }

    /* =========================================================
       3. TIME SLOTS — add / remove / reindex
    ========================================================= */
    function initTimeSlots() {
        // Add slot
        $('#wccs-add-slot-btn').on('click', function () {
            var label = $('#wccs-slot-label').val().trim();
            var start = $('#wccs-slot-start').val();
            var end   = $('#wccs-slot-end').val();

            if (!label || !start || !end) {
                alert('Please fill in all fields: label, start time, and end time.');
                return;
            }

            appendSlotRow(label, start, end);

            $('#wccs-slot-label').val('');
            $('#wccs-slot-start').val('');
            $('#wccs-slot-end').val('');
            $('#wccs-slot-label').focus();
        });

        // Remove — delegated so it works for dynamically added rows
        $('#wccs-time-slots-list').on('click', '.wccs-remove-slot-btn', function () {
            $(this).closest('.wccs-time-slot').remove();
            reindexSlots();
        });
    }

    function appendSlotRow(label, start, end) {
        var i      = $('#wccs-time-slots-list .wccs-time-slot').length;
        var optKey = 'wccs_settings';

        var $div = $('<div>').addClass('wccs-time-slot').attr('data-index', i);
        $div.append($('<input>').attr({ type: 'hidden', name: optKey + '[time_slots][' + i + '][label]' }).val(label));
        $div.append($('<input>').attr({ type: 'hidden', name: optKey + '[time_slots][' + i + '][start]' }).val(start));
        $div.append($('<input>').attr({ type: 'hidden', name: optKey + '[time_slots][' + i + '][end]'   }).val(end));
        $div.append(
            $('<span>').addClass('wccs-slot-display').html('<strong>' + escHtml(label) + '</strong> ' + escHtml(start) + ' – ' + escHtml(end))
        );
        $div.append($('<button>').attr({ type: 'button', 'aria-label': 'Remove slot' }).addClass('wccs-remove-slot-btn').text('×'));

        $('#wccs-time-slots-list').append($div);
    }

    function reindexSlots() {
        var optKey = 'wccs_settings';
        $('#wccs-time-slots-list .wccs-time-slot').each(function (i) {
            $(this).attr('data-index', i);
            $(this).find('input[type="hidden"]').each(function () {
                // Replace the numeric index inside brackets
                this.name = this.name.replace(/\[time_slots\]\[\d+\]/, '[time_slots][' + i + ']');
            });
        });
    }

    /* =========================================================
       4. AJAX SAVE
       Serialises the form, posts to admin-ajax.php, then
       updates Tab 2's table without a page reload.
    ========================================================= */
    function initAjaxSave() {
        $('#wccs-settings-form').on('submit', function (e) {
            e.preventDefault();

            var $btn     = $('#wccs-save-btn');
            var $spinner = $('#wccs-saving-spinner');

            $btn.prop('disabled', true);
            $spinner.css('visibility', 'visible');
            $('#wccs-save-notice, #wccs-save-error').hide();

            $.ajax({
                url:    wccsData.ajaxUrl,
                method: 'POST',
                data:   {
                    action:    'wccs_save_settings',
                    nonce:     wccsData.nonce,
                    form_data: $('#wccs-settings-form').serialize()
                },
                success: function (res) {
                    $btn.prop('disabled', false);
                    $spinner.css('visibility', 'hidden');

                    if (res.success) {
                        $('#wccs-save-notice').show().delay(3000).fadeOut(400);
                        refreshSlotsTable(res.data.time_slots || []);
                    } else {
                        var msg = (res.data && res.data.message) ? res.data.message : 'Unknown error.';
                        $('#wccs-save-error-msg').html('<strong>' + escHtml(msg) + '</strong>');
                        $('#wccs-save-error').show();
                    }
                },
                error: function () {
                    $btn.prop('disabled', false);
                    $spinner.css('visibility', 'hidden');
                    $('#wccs-save-error-msg').html('<strong>Network error. Please try again.</strong>');
                    $('#wccs-save-error').show();
                }
            });
        });
    }

    /* =========================================================
       5. REFRESH TAB 2 TABLE
       Called after a successful AJAX save with the fresh
       time_slots array returned by PHP.
    ========================================================= */
    function refreshSlotsTable(slots) {
        var $tbody     = $('#wccs-slots-tbody');
        var $table     = $('#wccs-slots-table');
        var $emptyMsg  = $('#wccs-slots-empty-msg');
        var $count     = $('#wccs-slot-count');

        $count.text(slots.length);

        if (!slots.length) {
            $table.hide();
            $emptyMsg.show();
            return;
        }

        $tbody.empty();
        $.each(slots, function (i, slot) {
            var $tr = $('<tr>');
            $tr.append($('<td>').text(i + 1));
            $tr.append($('<td>').append($('<span>').addClass('wccs-slot-badge').text(slot.label || '')));
            $tr.append($('<td>').addClass('wccs-slot-time').text((slot.start || '') + ' – ' + (slot.end || '')));
            $tbody.append($tr);
        });

        $emptyMsg.hide();
        $table.show();
    }

    /* =========================================================
       6. HELPERS
    ========================================================= */
    function escHtml(str) {
        return $('<div>').text(String(str)).html();
    }

    /* =========================================================
       7. BOOT
    ========================================================= */
    $(function () {
        initTabs();
        initMap();
        initTimeSlots();
        initAjaxSave();
    });

}(jQuery));