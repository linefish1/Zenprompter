package com.zen.teleprompter;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 麦克风权限原生诊断插件
 *
 * 直接使用 Android 原生 API，不依赖任何第三方 SDK。
 * 实现 mic-permission-diagnosis skill 中描述的两层诊断逻辑：
 *
 * 核心指标：shouldShowRequestPermissionRationale()
 * - DENIED + shouldShowRationale=false → ROM 系统拦截 (MIUI/ColorOS/HarmonyOS)
 * - DENIED + shouldShowRationale=true  → 用户主动拒绝
 * - GRANTED                             → 权限正常
 */
@CapacitorPlugin(name = "MicPermission")
public class MicPermissionPlugin extends Plugin {

    private static final String TAG = "MicPermission";
    private static final int REQUEST_CODE = 9001;

    private PluginCall pendingCall;

    /**
     * 详细权限诊断（不弹系统对话框，仅检查状态）
     *
     * 返回：
     * - state: "granted" | "denied" | "never_ask_again"
     * - shouldShowRationale: boolean
     * - romBlockSuspected: boolean  (DENIED + !shouldShowRationale → ROM 拦截)
     */
    @PluginMethod
    public void checkDetailed(PluginCall call) {
        int grantResult = ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.RECORD_AUDIO
        );

        boolean shouldShowRationale = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            shouldShowRationale = ActivityCompat.shouldShowRequestPermissionRationale(
                getActivity(),
                Manifest.permission.RECORD_AUDIO
            );
        }

        String state;
        boolean romBlockSuspected = false;

        if (grantResult == PackageManager.PERMISSION_GRANTED) {
            state = "granted";
        } else {
            state = shouldShowRationale ? "denied" : "never_ask_again";
            // DENIED + shouldShowRationale=false → 典型 ROM 拦截特征
            if (!shouldShowRationale) {
                romBlockSuspected = true;
            }
        }

        JSObject result = new JSObject();
        result.put("state", state);
        result.put("granted", grantResult == PackageManager.PERMISSION_GRANTED);
        result.put("shouldShowRationale", shouldShowRationale);
        result.put("romBlockSuspected", romBlockSuspected);

        Log.d(TAG, "checkDetailed: state=" + state
            + " shouldShowRationale=" + shouldShowRationale
            + " romBlockSuspected=" + romBlockSuspected);

        call.resolve(result);
    }

    /**
     * 请求麦克风权限并返回详细诊断结果
     *
     * 如果权限已授予 → 直接返回 granted
     * 如果权限未授予 → 弹出系统权限对话框 → 等待用户操作 → 返回结果
     */
    @PluginMethod
    public void requestWithDiagnostics(PluginCall call) {
        // Already granted?
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO)
                == PackageManager.PERMISSION_GRANTED) {
            JSObject result = new JSObject();
            result.put("state", "granted");
            result.put("granted", true);
            result.put("shouldShowRationale", false);
            result.put("romBlockSuspected", false);
            call.resolve(result);
            return;
        }

        // Save call for onRequestPermissionsResult
        pendingCall = call;

        // Request permission (shows system dialog)
        String[] permissions = { Manifest.permission.RECORD_AUDIO };
        ActivityCompat.requestPermissions(getActivity(), permissions, REQUEST_CODE);
    }

    /**
     * 处理系统权限对话框的结果
     */
    @Override
    protected void handleRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.handleRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode != REQUEST_CODE || pendingCall == null) return;

        int result = grantResults.length > 0 ? grantResults[0] : PackageManager.PERMISSION_DENIED;

        boolean shouldShowRationale = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            shouldShowRationale = ActivityCompat.shouldShowRequestPermissionRationale(
                getActivity(),
                Manifest.permission.RECORD_AUDIO
            );
        }

        boolean granted = result == PackageManager.PERMISSION_GRANTED;
        boolean romBlockSuspected = !granted && !shouldShowRationale;

        Log.d(TAG, "onRequestPermissionsResult: grantResult=" + result
            + " shouldShowRationale=" + shouldShowRationale
            + " romBlockSuspected=" + romBlockSuspected);

        JSObject res = new JSObject();
        res.put("state", granted ? "granted" : (shouldShowRationale ? "denied" : "never_ask_again"));
        res.put("granted", granted);
        res.put("shouldShowRationale", shouldShowRationale);
        res.put("romBlockSuspected", romBlockSuspected);
        res.put("diagnosis", granted
            ? "权限已授予，录音正常"
            : (romBlockSuspected
                ? "系统静默拦截（ROM 特征: DENIED + shouldShowRationale=false）。请到系统设置中手动开启麦克风权限。"
                : "用户在弹窗中点击了拒绝。请在系统设置中手动开启麦克风权限。"));

        pendingCall.resolve(res);
        pendingCall = null;
    }

    /**
     * 打开当前 App 的系统设置页面
     *
     * 引导用户手动修改权限（针对 ROM 拦截场景）
     */
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            Log.d(TAG, "Opened app settings");
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Failed to open app settings: " + e.getMessage());
            call.reject("无法打开系统设置: " + e.getMessage());
        }
    }
}
