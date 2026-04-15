<?php
/**
 * Plugin Name: WC Cannabis Shop
 * Description: WooCommerce product shop page via shortcode with JS-powered filters.
 * Version: 1.0.1
 * Requires PHP: 7.4
 * Text Domain: wc-cannabis-shop
 */

defined( 'ABSPATH' ) || exit;

define( 'WCCS_DIR', plugin_dir_path( __FILE__ ) );
define( 'WCCS_URL', plugin_dir_url( __FILE__ ) );
define( 'WCCS_VERSION', '1.0.1' ); 

// Composer autoload
if ( file_exists( WCCS_DIR . 'vendor/autoload.php' ) ) {
    require_once WCCS_DIR . 'vendor/autoload.php';
}

// Bootstrap
add_action( 'plugins_loaded', function () {
    \WCCannabisShop\Core\Plugin::instance()->init();
} );