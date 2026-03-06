mod utils;
mod models;

use crate::utils::helper;
use crate::models::{User, Config};

// use crate::fake_module::should_not_resolve;
/* use crate::another_fake::nope; */

fn main() {
    helper();
    let _u = User {};
    let _c = Config {};
}
