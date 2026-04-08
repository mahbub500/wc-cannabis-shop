<?php
namespace Composer\Autoload;

class ClassLoader {
    private array $psr4 = [];

    public function addPsr4(string $prefix, string $path): void {
        $this->psr4[$prefix] = rtrim($path, '/');
    }

    public function register(bool $prepend = false): void {
        spl_autoload_register([$this, 'loadClass'], true, $prepend);
    }

    public function loadClass(string $class): bool {
        foreach ($this->psr4 as $prefix => $basePath) {
            if (str_starts_with($class, $prefix)) {
                $relative = substr($class, strlen($prefix));
                $file = $basePath . '/' . str_replace('\\', '/', $relative) . '.php';
                if (file_exists($file)) {
                    require $file;
                    return true;
                }
            }
        }
        return false;
    }
}
