// UdyamSetu app module — Kotlin + Jetpack Compose + Room, offline-first.
// Package in.udyamsetu.app, minSdk 29, targetSdk 34.
// iOS-future: business logic lives in the shared core (core/ + logic/),
// UI is separate — the core is pure Kotlin with no Android APIs, so it can
// be reused by a future iOS surface.
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
}

android {
    namespace = "in.udyamsetu.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "in.udyamsetu.app"
        minSdk = 29
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlin {
        compilerOptions {
            jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
        }
    }

    buildFeatures {
        compose = true
    }

    // Google auth jars (pulled in by the Drive backup dependencies) both
    // ship META-INF/INDEX.LIST — without this exclude, CI run #9 failed at
    // :app:mergeDebugJavaResource with DuplicateRelativeFileException.
    packaging {
        resources {
            excludes += "META-INF/INDEX.LIST"
        }
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)
    // Navigation Compose: every screen takes a NavHostController and
    // MainActivity builds a NavHost — the dependency was missing, so
    // compileDebugKotlin failed on every navigation import. See CI run #5.
    implementation(libs.androidx.navigation.compose)
    // by viewModels() (MainActivity) lives in activity-ktx, and
    // AndroidViewModel / viewModelScope (AppViewModel) in
    // lifecycle-viewmodel-ktx — both were only transitive before.
    implementation(libs.androidx.activity.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.ktx)
    // The XML Activity theme (res/values/themes.xml) uses
    // Theme.Material3.DayNight.NoActionBar + colorPrimary attrs — those are
    // resources of the Material Components library, not of Compose material3
    // (Compose material3 is Kotlin-only and ships no XML resources). Without
    // this dependency the resource linker fails on the theme. See CI run #1.
    implementation(libs.material)
    implementation(libs.androidx.datastore.preferences)
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    implementation(libs.androidx.work.runtime.ktx)
    ksp(libs.androidx.room.compiler)
    implementation(libs.kotlinx.coroutines.android)
    // Optional Drive backup (ui/BackupScreen.kt + data/DriveBackup.kt):
    // Google Sign-In + Drive API (appDataFolder scope). The backup screen
    // stays in "Setup pending" until the OAuth client id is filled in
    // res/values/drive_config.xml — without it, nothing here is called.
    implementation(libs.play.services.auth)
    implementation(libs.google.api.client.android)
    implementation(libs.google.api.services.drive)
    // AndroidHttp (com.google.api.client.extensions.android.http) no longer
    // ships in google-api-client-android 2.x — it lives in
    // google-http-client-android. Without this, CI run #8 failed on
    // "Unresolved reference 'extensions'" in DriveBackup.kt.
    implementation(libs.google.http.client.android)
    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.tooling)
}
