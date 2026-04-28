<?php
namespace WCCannabisShop\Admin;

class SettingsPage extends \WC_Settings_Page {

    public function __construct() {
        $this->id    = 'wccs';
        $this->label = __( 'Cannabis Shop', 'wc-cannabis-shop' );
        parent::__construct();
    }

    public function get_settings(): array {
        $min = (float) get_option( 'wccs_delivery_min_order', 100 );
        $fee = (float) get_option( 'wccs_delivery_fee', 50 );

        $summary = sprintf(
            'Under $%s → $%s delivery fee added &nbsp;|&nbsp; $%s+ → free delivery (no fee)',
            number_format( $min, 2 ),
            number_format( $fee, 2 ),
            number_format( $min, 2 )
        );

        return [
            [
                'type' => 'sectionend',
                'id'   => 'wccs_shortcode_section',
            ],

            [
                'title' => __( 'Delivery Rules', 'wc-cannabis-shop' ),
                'type'  => 'title',
                'desc'  => $summary,
                'id'    => 'wccs_delivery_section',
            ],
            [
                'title'   => __( 'Enable Delivery Rules', 'wc-cannabis-shop' ),
                'desc'    => __( 'Apply delivery fee rules on cart &amp; checkout', 'wc-cannabis-shop' ),
                'type'    => 'checkbox',
                'id'      => 'wccs_delivery_enabled',
                'default' => 'yes',
            ],
            [
                'title'             => __( 'Minimum Order Amount ($)', 'wc-cannabis-shop' ),
                'desc'              => __( 'Orders at or above this amount get free delivery. Orders below are charged the delivery fee.', 'wc-cannabis-shop' ),
                'type'              => 'number',
                'id'                => 'wccs_delivery_min_order',
                'default'           => '100',
                'css'               => 'width:90px;',
                'custom_attributes' => [ 'min' => '0', 'step' => '0.01' ],
            ],
            [
                'title'             => __( 'Delivery Fee ($)', 'wc-cannabis-shop' ),
                'desc'              => __( 'Fee charged when the order is below the minimum amount.', 'wc-cannabis-shop' ),
                'type'              => 'number',
                'id'                => 'wccs_delivery_fee',
                'default'           => '50',
                'css'               => 'width:90px;',
                'custom_attributes' => [ 'min' => '0', 'step' => '0.01' ],
            ],
            [
                'title'   => __( 'Add Order Note', 'wc-cannabis-shop' ),
                'desc'    => __( 'Automatically add a delivery note to each placed order', 'wc-cannabis-shop' ),
                'type'    => 'checkbox',
                'id'      => 'wccs_delivery_order_note',
                'default' => 'yes',
            ],
            [
                'type' => 'sectionend',
                'id'   => 'wccs_delivery_section',
            ],
        ];
    }
}
