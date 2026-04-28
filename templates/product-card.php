<?php
defined( 'ABSPATH' ) || exit;

/** @var WC_Product $product */

// Show only simple products for AJAX add-to-cart
if ( ! $product || ! $product instanceof WC_Product ) {
    return;
}

// OPTIONAL: If you truly want ONLY main products (simple only), uncomment below:
// if ( ! $product->is_type( 'simple' ) ) return;

$cats        = wp_get_post_terms( $product->get_id(), 'product_cat', [ 'fields' => 'names' ] );
$strain_attr = $product->get_attribute( 'pa_train_type' );
$sale_enabled = get_post_meta( $product->get_id(), '_wccs_sale_enabled', true );

$strain_map = [
    'indica'  => '#9b59b6',
    'sativa'  => '#3498db',
    'hybrid'  => '#e67e22',
    'cbd'     => '#27ae60',
];

$strain_slug = strtolower( $strain_attr );
$badge_color = $strain_map[ $strain_slug ] ?? '#888';

$product_id = $product->get_id();
$product_type = $product->get_type();
?>

<div class="wccs-product-card"
     data-cat="<?php echo esc_attr( implode( ',', wp_list_pluck( wp_get_post_terms( $product_id, 'product_cat' ), 'slug' ) ) ); ?>"
     data-strain="<?php echo esc_attr( $strain_slug ); ?>"
     data-product-id="<?php echo esc_attr( $product_id ); ?>"
     data-product-type="<?php echo esc_attr( $product_type ); ?>">

    <!-- Badge -->
    <?php if ( $sale_enabled === '1' ) : ?>
        <span class="wccs-badge" style="background:#E24B4A;">SALE</span>

    <?php elseif ( $strain_attr ) : ?>
        <span class="wccs-badge" style="background:<?php echo esc_attr( $badge_color ); ?>">
            <?php echo esc_html( strtoupper( $strain_attr ) ); ?>
        </span>
    <?php endif; ?>

    <!-- Image -->
    <a href="<?php echo esc_url( $product->get_permalink() ); ?>" class="wccs-product-image">
        <?php echo $product->get_image( 'woocommerce_thumbnail' ); ?>
    </a>

    <div class="wccs-product-info">

        <!-- Title -->
        <h3 class="wccs-product-title">
            <a href="<?php echo esc_url( $product->get_permalink() ); ?>">
                <?php echo esc_html( $product->get_name() ); ?>
            </a>
        </h3>

        <!-- Hidden Description -->
        <div class="wccs-product-description" style="display:none;">
            <?php
            echo wp_kses_post(
                wpautop(
                    $product->get_short_description() ?: $product->get_description()
                )
            );
            ?>
        </div>

        <!-- Price -->
        <div class="wccs-product-price">
            <span class="wccs-qty">1 pc</span>
            <span class="wccs-price"><?php echo $product->get_price_html(); ?></span>
        </div>

        <!-- Add to Cart / Variable Handling -->
        <?php if ( $product->is_type( 'simple' ) ) : ?>

            <button class="wccs-add-to-cart"
                    data-product-id="<?php echo esc_attr( $product_id ); ?>">
                ADD TO CART
            </button>

        <?php else : ?>

            <button class="wccs-add-to-cart wccs-open-quickview"
                    data-product-id="<?php echo esc_attr( $product_id ); ?>">
                ADD TO CART
            </button>

        <?php endif; ?>

    </div>
</div>