<?php
class ComposerAutoloaderInitWCCannabisShop {
    public static function getLoader(): \Composer\Autoload\ClassLoader {
        require_once __DIR__ . '/ClassLoader.php';
        $loader = new \Composer\Autoload\ClassLoader();
        $loader->addPsr4('WCCannabisShop\\', dirname(__DIR__, 2) . '/src/');
        $loader->register(true);
        return $loader;
    }
}
