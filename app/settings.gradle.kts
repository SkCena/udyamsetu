// UdyamSetu — Android app (Phase 2). Package in.udyamsetu.app, minSdk 29.
// Build route: GitHub Actions only (local Gradle daemon IPC is blocked on
// this VM). See .github/workflows/build-apk.yml.
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "UdyamSetu"
include(":app")
