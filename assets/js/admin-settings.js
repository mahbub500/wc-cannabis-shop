/* =========================================================
   WC Cannabis Shop — Admin Settings JS
   ========================================================= */

(function () {
    'use strict';

    /* -------------------------------------------------------
       1. TAB SWITCHING
    ------------------------------------------------------- */
    function initTabs() {
        var buttons = document.querySelectorAll('.wccs-tab-btn');
        var panels  = document.querySelectorAll('.wccs-tab-panel');

        buttons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var target = btn.getAttribute('data-tab');

                buttons.forEach(function (b) { b.classList.remove('wccs-tab-active'); });
                panels.forEach(function (p)  { p.classList.remove('wccs-panel-active'); });

                btn.classList.add('wccs-tab-active');
                var panel = document.getElementById('wccs-panel-' + target);
                if (panel) { panel.classList.add('wccs-panel-active'); }

                // Refresh map when switching to the settings tab (tab1)
                if (target === 'settings' && window._wccsMap) {
                    setTimeout(function () { window._wccsMap.invalidateSize(); }, 50);
                }
            });
        });
    }

    /* -------------------------------------------------------
       2. LEAFLET MAP  (same logic as before, lifted here)
    ------------------------------------------------------- */
    function initMap() {
        var mapEl = document.getElementById('wccs-map');
        if (!mapEl || typeof L === 'undefined') { return; }

        var data = window.wccsMapData || { lat: 23.8103, lng: 90.4125, hasLocation: false };
        var map  = L.map('wccs-map').setView([data.lat, data.lng], data.hasLocation ? 14 : 10);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
        }).addTo(map);

        var marker = null;

        if (data.hasLocation) {
            marker = L.marker([data.lat, data.lng]).addTo(map);
        }

        function setLocation(lat, lng, label) {
            if (marker) { map.removeLayer(marker); }
            marker = L.marker([lat, lng]).addTo(map);
            map.setView([lat, lng], 15);

            document.getElementById('wccs_latitude').value  = lat;
            document.getElementById('wccs_longitude').value = lng;

            if (label) {
                document.getElementById('wccs_location').value          = label;
                document.getElementById('wccs-selected-location').textContent = 'Selected: ' + label;
            } else {
                var coord = lat.toFixed(5) + ', ' + lng.toFixed(5);
                document.getElementById('wccs-selected-location').textContent = 'Selected: ' + coord;
            }
        }

        map.on('click', function (e) {
            setLocation(e.latlng.lat, e.latlng.lng, null);
        });

        var searchBtn = document.getElementById('wccs-search-location-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', function () {
                var query = document.getElementById('wccs_location').value.trim();
                if (!query) { return; }

                fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(query))
                    .then(function (r) { return r.json(); })
                    .then(function (results) {
                        if (results && results.length > 0) {
                            var r = results[0];
                            setLocation(parseFloat(r.lat), parseFloat(r.lon), r.display_name);
                        } else {
                            alert('Location not found. Try a different search term.');
                        }
                    })
                    .catch(function () { alert('Search failed. Please try again.'); });
            });
        }

        window._wccsMap = map;
    }

    /* -------------------------------------------------------
       3. TIME SLOTS (add / remove)  +  sync to Tab 2 list
    ------------------------------------------------------- */
    function initTimeSlots() {
        var addBtn   = document.getElementById('wccs-add-slot-btn');
        var listWrap = document.getElementById('wccs-time-slots-list');

        if (!addBtn || !listWrap) { return; }

        addBtn.addEventListener('click', function () {
            var label = document.getElementById('wccs-slot-label').value.trim();
            var start = document.getElementById('wccs-slot-start').value;
            var end   = document.getElementById('wccs-slot-end').value;

            if (!label || !start || !end) {
                alert('Please fill in all slot fields (label, start time, end time).');
                return;
            }

            var index = listWrap.querySelectorAll('.wccs-time-slot').length;
            var optKey = 'wccs_settings'; // must match PHP const

            var div = document.createElement('div');
            div.className = 'wccs-time-slot';
            div.setAttribute('data-index', index);
            div.innerHTML =
                '<input type="hidden" name="' + optKey + '[time_slots][' + index + '][label]" value="' + escAttr(label) + '">' +
                '<input type="hidden" name="' + optKey + '[time_slots][' + index + '][start]" value="' + escAttr(start) + '">' +
                '<input type="hidden" name="' + optKey + '[time_slots][' + index + '][end]"   value="' + escAttr(end)   + '">' +
                '<span class="wccs-slot-display"><strong>' + escHtml(label) + '</strong> ' + escHtml(start) + ' - ' + escHtml(end) + '</span>' +
                '<button type="button" class="wccs-remove-slot-btn" aria-label="Remove slot">×</button>';

            listWrap.appendChild(div);
            bindRemove(div.querySelector('.wccs-remove-slot-btn'));
            refreshSlotsTable();

            // Clear inputs
            document.getElementById('wccs-slot-label').value = '';
            document.getElementById('wccs-slot-start').value = '';
            document.getElementById('wccs-slot-end').value   = '';
        });

        // Bind remove on pre-existing slots
        listWrap.querySelectorAll('.wccs-remove-slot-btn').forEach(bindRemove);
    }

    function bindRemove(btn) {
        btn.addEventListener('click', function () {
            var slot = btn.closest('.wccs-time-slot');
            if (slot) {
                slot.remove();
                reindexSlots();
                refreshSlotsTable();
            }
        });
    }

    function reindexSlots() {
        var listWrap = document.getElementById('wccs-time-slots-list');
        if (!listWrap) { return; }
        var optKey = 'wccs_settings';
        listWrap.querySelectorAll('.wccs-time-slot').forEach(function (div, i) {
            div.setAttribute('data-index', i);
            div.querySelectorAll('input[type="hidden"]').forEach(function (inp) {
                // Replace index in name attribute
                inp.name = inp.name.replace(/\[time_slots\]\[\d+\]/, '[time_slots][' + i + ']');
            });
        });
    }

    /* -------------------------------------------------------
       4. TAB 2  — refresh the All Slots table
    ------------------------------------------------------- */
    function refreshSlotsTable() {
        var tbody = document.getElementById('wccs-slots-tbody');
        if (!tbody) { return; }

        var slots = gatherSlots();
        tbody.innerHTML = '';

        if (slots.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="padding:16px;color:#9aa59a;font-style:italic;">No time slots added yet.</td></tr>';
            return;
        }

        slots.forEach(function (s, i) {
            var tr = document.createElement('tr');
            tr.innerHTML =
                '<td>' + (i + 1) + '</td>' +
                '<td><span class="wccs-slot-badge">' + escHtml(s.label) + '</span></td>' +
                '<td class="wccs-slot-time">' + escHtml(s.start) + ' &ndash; ' + escHtml(s.end) + '</td>';
            tbody.appendChild(tr);
        });
    }

    function gatherSlots() {
        var slots    = [];
        var listWrap = document.getElementById('wccs-time-slots-list');
        if (!listWrap) { return slots; }

        listWrap.querySelectorAll('.wccs-time-slot').forEach(function (div) {
            var label = (div.querySelector('input[name*="[label]"]') || {}).value || '';
            var start = (div.querySelector('input[name*="[start]"]') || {}).value || '';
            var end   = (div.querySelector('input[name*="[end]"]')   || {}).value || '';
            slots.push({ label: label, start: start, end: end });
        });

        return slots;
    }

    /* -------------------------------------------------------
       5. HELPERS
    ------------------------------------------------------- */
    function escAttr(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /* -------------------------------------------------------
       6. BOOT
    ------------------------------------------------------- */
    document.addEventListener('DOMContentLoaded', function () {
        initTabs();
        initMap();
        initTimeSlots();
        refreshSlotsTable(); // populate table from any server-rendered slots
    });

}());