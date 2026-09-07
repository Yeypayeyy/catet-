plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "dev.frlagee.catet"
    compileSdk = 35

    defaultConfig {
        applicationId = "dev.frlagee.catet"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1"
    }

    // BuildConfig.DEBUG dipakai untuk mengurung tombol uji dan penerimaan
    // notifikasi dari paket sendiri. Sejak AGP 8 harus diminta eksplisit.
    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            // Belum ada yang perlu disembunyikan, dan minify bikin stack trace
            // dari listener jadi tidak terbaca saat debugging di HP sendiri.
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // Dipakai mulai langkah 3.4 (pengiriman outbox). Dideklarasikan sekarang
    // supaya resolusi dependensi tidak jadi kejutan di tengah jalan.
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("androidx.work:work-runtime:2.10.0")
}
