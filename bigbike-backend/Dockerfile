# syntax=docker/dockerfile:1.7
# ---- Build stage ----
FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /build
COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -q dependency:go-offline
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -q package -DskipTests && \
    cp target/bigbike-backend-0.0.1-SNAPSHOT.jar /build/app.jar

# ---- Runtime stage ----
FROM eclipse-temurin:17-jre-alpine AS runner
WORKDIR /app

RUN addgroup -S bigbike && adduser -S bigbike -G bigbike
USER bigbike

COPY --from=builder /build/app.jar app.jar

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
