<?php
namespace WCCannabisShop\Core;

use WCCannabisShop\Admin\Admin;
use WCCannabisShop\Front\Front;

final class Plugin {

    private static ?Plugin $instance = null;

    public static function instance(): self {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {}

    public function init(): void {
        if ( ! function_exists( 'WC' ) ) {
            add_action( 'admin_notices', fn() => print '<div class="error"><p>WC Cannabis Shop requires WooCommerce.</p></div>' );
            return;
        }

        if ( is_admin() ) {
            ( new Admin() )->init();
        }

        ( new Front() )->init();
    }
}
