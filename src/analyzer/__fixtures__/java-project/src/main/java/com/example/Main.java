package com.example;

import com.example.Service;
import com.example.Repository;

// import com.example.FakeClass;
/* import com.example.AnotherFake; */

public class Main {
    public static void main(String[] args) {
        new Service().run();
        new Repository().find();
    }
}
