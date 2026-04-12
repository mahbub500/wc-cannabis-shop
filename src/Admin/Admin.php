<?php
namespace WCCannabisShop\Admin;

class Admin {

    private const META_KEY_SALE     = '_wccs_sale_enabled';
    private const META_KEY_THC_PCT  = '_wccs_thc_pct';
    private const META_KEY_THC_MG   = '_wccs_thc_mg';
    private const META_KEY_CBD_PCT  = '_wccs_cbd_pct';
    private const META_KEY_CBD_MG   = '_wccs_cbd_mg';

    public function init(): void {
        add_action( 'admin_menu', [ $this, 'add_menu' ] );
        add_action( 'add_meta_boxes', [ $this, 'add_sale_meta_box' ] );
        add_action( 'add_meta_boxes', [ $this, 'add_potency_meta_box' ] );
        add_action( 'save_post_product', [ $this, 'save_sale_meta' ] );
        add_action( 'save_post_product', [ $this, 'save_potency_meta' ] );
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

    public function add_sale_meta_box(): void {
        add_meta_box(
            'wccs_sale_box',
            __( '🔥 10% Off Edibles', 'wc-cannabis-shop' ),
            [ $this, 'render_sale_meta_box' ],
            'product',
            'side',
            'default'
        );
    }

    public function render_sale_meta_box( \WP_Post $post ): void {
        wp_nonce_field( 'wccs_sale_meta', 'wccs_sale_nonce' );
        $checked = get_post_meta( $post->ID, self::META_KEY_SALE, true );
        ?>
        <label for="wccs_sale_enabled" style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <input type="checkbox" id="wccs_sale_enabled" name="wccs_sale_enabled" value="1" <?php checked( $checked, '1' ); ?>>
            <span><?php esc_html_e( 'Enable 10% off sale', 'wc-cannabis-shop' ); ?></span>
        </label>
        <p class="description"><?php esc_html_e( 'When checked, this product appears in the "10% off edibles" filtered view.', 'wc-cannabis-shop' ); ?></p>
        <?php
    }

    public function save_sale_meta( int $post_id ): void {
        if ( ! isset( $_POST['wccs_sale_nonce'] ) || ! wp_verify_nonce( $_POST['wccs_sale_nonce'], 'wccs_sale_meta' ) ) {
            return;
        }
        if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
            return;
        }
        if ( ! current_user_can( 'edit_post', $post_id ) ) {
            return;
        }

        $value = isset( $_POST['wccs_sale_enabled'] ) ? '1' : '0';
        update_post_meta( $post_id, self::META_KEY_SALE, $value );
    }

    public function add_potency_meta_box(): void {
        add_meta_box(
            'wccs_potency_box',
            __( '⚡ Potency', 'wc-cannabis-shop' ),
            [ $this, 'render_potency_meta_box' ],
            'product',
            'side',
            'default'
        );
    }

    public function render_potency_meta_box( \WP_Post $post ): void {
        wp_nonce_field( 'wccs_potency_meta', 'wccs_potency_nonce' );
        $thc_pct = get_post_meta( $post->ID, self::META_KEY_THC_PCT, true );
        $thc_mg  = get_post_meta( $post->ID, self::META_KEY_THC_MG, true );
        $cbd_pct = get_post_meta( $post->ID, self::META_KEY_CBD_PCT, true );
        $cbd_mg  = get_post_meta( $post->ID, self::META_KEY_CBD_MG, true );
        ?>
        <div style="display:flex;flex-direction:column;gap:12px;">
            <div>
                <label for="wccs_thc_pct" style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">
                    THC (%)
                </label>
                <input type="number" id="wccs_thc_pct" name="wccs_thc_pct" value="<?php echo esc_attr( $thc_pct ); ?>"
                       min="0" max="100" step="0.1" style="width:100%;" placeholder="e.g. 25">
            </div>
            <div>
                <label for="wccs_thc_mg" style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">
                    THC (mg)
                </label>
                <input type="number" id="wccs_thc_mg" name="wccs_thc_mg" value="<?php echo esc_attr( $thc_mg ); ?>"
                       min="0" step="0.1" style="width:100%;" placeholder="e.g. 10">
            </div>
            <div style="border-top:1px solid #ddd;padding-top:8px;margin-top:4px;">
                <label for="wccs_cbd_pct" style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">
                    CBD (%)
                </label>
                <input type="number" id="wccs_cbd_pct" name="wccs_cbd_pct" value="<?php echo esc_attr( $cbd_pct ); ?>"
                       min="0" max="100" step="0.1" style="width:100%;" placeholder="e.g. 10">
            </div>
            <div>
                <label for="wccs_cbd_mg" style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">
                    CBD (mg)
                </label>
                <input type="number" id="wccs_cbd_mg" name="wccs_cbd_mg" value="<?php echo esc_attr( $cbd_mg ); ?>"
                       min="0" step="0.1" style="width:100%;" placeholder="e.g. 25">
            </div>
        </div>
        <p class="description"><?php esc_html_e( 'Set THC and CBD potency values. Used for frontend filtering.', 'wc-cannabis-shop' ); ?></p>
        <?php
    }

    public function save_potency_meta( int $post_id ): void {
        if ( ! isset( $_POST['wccs_potency_nonce'] ) || ! wp_verify_nonce( $_POST['wccs_potency_nonce'], 'wccs_potency_meta' ) ) {
            return;
        }
        if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
            return;
        }
        if ( ! current_user_can( 'edit_post', $post_id ) ) {
            return;
        }

        update_post_meta( $post_id, self::META_KEY_THC_PCT, sanitize_text_field( wp_unslash( $_POST['wccs_thc_pct'] ?? '' ) ) );
        update_post_meta( $post_id, self::META_KEY_THC_MG, sanitize_text_field( wp_unslash( $_POST['wccs_thc_mg'] ?? '' ) ) );
        update_post_meta( $post_id, self::META_KEY_CBD_PCT, sanitize_text_field( wp_unslash( $_POST['wccs_cbd_pct'] ?? '' ) ) );
        update_post_meta( $post_id, self::META_KEY_CBD_MG, sanitize_text_field( wp_unslash( $_POST['wccs_cbd_mg'] ?? '' ) ) );
    }
}
