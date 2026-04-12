<?php defined( 'ABSPATH' ) || exit;
/**
 * Store Picker Widget Template
 *
 * Usage: include WCCS_DIR . 'templates/map.php';
 * The StorePicker is initialized via shop.js in the footer.
 * Store data is loaded via wp_add_inline_script() in Front.php.
 */
?>

<!-- =============================================
     STORE PICKER WIDGET (Map Overlay)
============================================= -->

<div class="sp-overlay" id="sp-overlay" role="dialog" aria-modal="true" aria-label="Select a store">

    <!-- Backdrop -->
    <div class="sp-backdrop" id="sp-backdrop"></div>

    <!-- Modal -->
    <div class="sp-modal" id="sp-modal">

        <!-- Close -->
        <button class="sp-close" id="sp-close" aria-label="Close store picker">
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none">
                <path d="M2.343 2.343L13.657 13.657" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M13.657 2.343L2.343 13.657" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
        </button>

        <!-- Left panel -->
        <div class="sp-panel">

            <!-- Store header (populated by JS) -->
            <div class="sp-store-header" id="sp-store-header">
                <div class="sp-store-logo" id="sp-store-logo"></div>
                <div class="sp-store-name" id="sp-store-name">Select a store</div>
            </div>

            <!-- Fulfillment tabs -->
            <div class="sp-tabs" id="sp-tabs" role="tablist">
                <button class="sp-tab active" data-tab="pickup" role="tab" aria-selected="true">Pickup</button>
                <button class="sp-tab" data-tab="delivery" role="tab" aria-selected="false">Delivery</button>
                <button class="sp-tab" data-tab="mail" role="tab" aria-selected="false">Mail</button>
            </div>

            <!-- Store list -->
            <div class="sp-store-list" id="sp-store-list" role="list">
                <!-- Populated by JS -->
            </div>

            <!-- CTA -->
            <div class="sp-cta-wrap">
                <button class="sp-cta" id="sp-cta" disabled>Show menu</button>
            </div>

        </div>

        <!-- Right panel: Map -->
        <div class="sp-map-wrap">
            <div class="sp-map" id="sp-map"></div>
            <div class="sp-map-placeholder" id="sp-map-placeholder">
                <svg viewBox="0 0 64 64" width="48" height="48" fill="none">
                    <circle cx="32" cy="28" r="14" stroke="currentColor" stroke-width="2"/>
                    <path d="M32 6C21.507 6 13 14.507 13 25c0 14.25 19 33 19 33s19-18.75 19-33C51 14.507 42.493 6 32 6z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                    <circle cx="32" cy="25" r="5" fill="currentColor"/>
                </svg>
                <span>Map loading…</span>
            </div>
        </div>

    </div>
</div>
