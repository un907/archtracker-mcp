<?php
require 'src/Controllers/HomeController.php';
require 'src/Controllers/ApiController.php';

use function App\Controllers\someFunction;
use const App\Controllers\SOME_CONSTANT;
use App\Controllers\HomeController;

// require 'src/Controllers/FakeController.php';
/* require 'src/Controllers/AnotherFake.php'; */

$controller = new HomeController();
$controller->index();
