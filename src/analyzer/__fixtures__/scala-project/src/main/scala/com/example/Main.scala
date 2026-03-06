package com.example

import com.example.services.UserService
import com.example.models.User
// import com.example.Fake
/* import com.example.AlsoFake */

object Main extends App {
  val service = new UserService()
  service.run()
}
