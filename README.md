# WC Cannabis Shop

A WordPress plugin that renders a WooCommerce product shop page via shortcode with live JS filtering — no page reloads.

## Requirements
- WordPress 5.8+
- WooCommerce 6+
- PHP 7.4+

## Installation

1. Upload the `wc-cannabis-shop` folder to `/wp-content/plugins/`
2. Run `composer install` inside the plugin folder (or use the bundled `vendor/` autoloader)
3. Activate in **Plugins > Installed Plugins**

## Usage

Place the shortcode on any page:

```
[cannabis_shop]
[cannabis_shop columns="4" per_page="16"]
[cannabis_shop category="flower"]
```

## Shortcode Parameters

| Param | Default | Description |
|-------|---------|-------------|
| `columns` | `3` | Grid columns |
| `per_page` | `12` | Products per page |
| `category` | _(all)_ | Limit to WC category slug |

## Strain / Attribute Filtering

Products need a **WooCommerce Product Attribute** named `strain-type` (slug: `pa_strain-type`) with values: `indica`, `sativa`, `hybrid`, `cbd`.

## File Structure

```
wc-cannabis-shop/
├── wc-cannabis-shop.php        # Plugin entry point
├── composer.json
├── vendor/                     # Autoloader (composer dump-autoload)
├── src/
│   ├── Core/Plugin.php         # Singleton bootstrap
│   ├── Admin/Admin.php         # Admin menu + settings
│   └── Front/
│       ├── Front.php           # Shortcode, assets, AJAX
│       ├── ProductQuery.php    # WP_Query wrapper
│       └── ShortcodeRenderer.php
├── templates/
│   ├── shop-wrapper.php        # Full shop layout
│   └── product-card.php       # Single product card
└── assets/
    ├── css/shop.css
    └── js/shop.js
```
# wc-cannabis-shop
