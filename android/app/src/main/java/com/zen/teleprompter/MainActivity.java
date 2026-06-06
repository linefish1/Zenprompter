package com.zen.teleprompter;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register the native mic permission plugin BEFORE super.onCreate()
        // so it's available when the WebView initializes.
        registerPlugin(MicPermissionPlugin.class);

        super.onCreate(savedInstanceState);

        // Bridge Android system permissions → WebView getUserMedia.
        // Without this, navigator.mediaDevices.getUserMedia() throws
        // NotAllowedError in the Capacitor WebView even when the app
        // holds RECORD_AUDIO at the system level.
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    boolean hasAudioPerm = ContextCompat.checkSelfPermission(
                        MainActivity.this,
                        Manifest.permission.RECORD_AUDIO
                    ) == PackageManager.PERMISSION_GRANTED;
                    boolean hasCameraPerm = ContextCompat.checkSelfPermission(
                        MainActivity.this,
                        Manifest.permission.CAMERA
                    ) == PackageManager.PERMISSION_GRANTED;

                    String[] resources = request.getResources();
                    boolean allGrantable = true;

                    for (String resource : resources) {
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                            if (!hasAudioPerm) allGrantable = false;
                        } else if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                            if (!hasCameraPerm) allGrantable = false;
                        }
                    }

                    if (allGrantable) {
                        request.grant(resources);
                    } else {
                        request.deny();
                    }
                }
            });
        }
    }
}
