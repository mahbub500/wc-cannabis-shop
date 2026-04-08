<?php
namespace WCCannabisShop\Admin;

class Admin {

    public function init(): void {
        add_action( 'admin_menu', [ $this, 'add_menu' ] );
    }

    public function add_menu(): void {
        add_options_page(
            'Cannabis Shop Settings',
            'Cannabis Shop',
            'manage_options',
            'wccs-settings',
            [ $this, 'render_settings' ]
        );
    }

    public function render_settings(): void {
        echo '<div class="wrap"><h1>Cannabis Shop Settings</h1>';
        echo '<p>Use shortcode <code>[cannabis_shop]</code> on any page.</p>';
        echo '<h3>Shortcode Options</h3>';
        echo '<ul>';
        echo '<li><code>columns="3"</code> — Number of product columns (default: 3)</li>';
        echo '<li><code>per_page="12"</code> — Products per page (default: 12)</li>';
        echo '<li><code>category=""</code> — Limit to a WC category slug</li>';
        echo '</ul>';
        echo '</div>';
    }
}
