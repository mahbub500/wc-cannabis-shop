<?php
/**
 * Custom PSR-4 Autoloader - Avoids Composer conflicts
 */

// Prevent direct access
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// Custom autoloader for WCCannabisShop namespace
spl_autoload_register( function ( $class ) {
    // Only handle our namespace
    $prefix = 'WCCannabisShop\\';
    $base_dir = WCCS_DIR . 'src/';
    
    // Check if class uses our namespace
    $len = strlen( $prefix );
    if ( strncmp( $prefix, $class, $len ) !== 0 ) {
        return;
    }
    
    // Get relative class name
    $relative_class = substr( $class, $len );
    
    // Replace namespace separators with directory separators
    $file = $base_dir . str_replace( '\\', '/', $relative_class ) . '.php';
    
    // If file exists, require it
    if ( file_exists( $file ) ) {
        require_once $file;
    }
} );
