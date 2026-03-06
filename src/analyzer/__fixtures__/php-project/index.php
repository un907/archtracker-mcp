<?php
require 'src/Controllers/HomeController.php';
require 'src/Controllers/ApiController.php';

// require 'src/Controllers/FakeController.php';
/* require 'src/Controllers/AnotherFake.php'; */

$controller = new HomeController();
$controller->index();
