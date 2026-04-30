package com.bigbike.bigbike_backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableAsync
public class BigbikeBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(BigbikeBackendApplication.class, args);
	}

}
