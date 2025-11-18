// Capacitor Native Bridge for Mobile Features
// Import this in index.html BEFORE script.js

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';

// Detect if running as native app
const isNativeApp = () => {
    return typeof window.Capacitor !== 'undefined';
};

// Initialize native features
export async function initializeNativeFeatures() {
    if (!isNativeApp()) {
        console.log('Running as web app, native features disabled');
        return;
    }
    
    console.log('Initializing native mobile features...');
    
    // Setup status bar
    try {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#0a0e1a' });
    } catch (e) {
        console.log('StatusBar not available:', e);
    }
    
    // Request notification permissions
    await setupNotifications();
    
    console.log('Native features initialized!');
}

// ================================
// PUSH NOTIFICATIONS
// ================================

async function setupNotifications() {
    try {
        // Request permission
        const permission = await LocalNotifications.requestPermissions();
        
        if (permission.display === 'granted') {
            console.log('Notification permissions granted');
            
            // Setup push notifications if available
            try {
                await PushNotifications.requestPermissions();
                await PushNotifications.register();
                
                // Listen for push tokens
                PushNotifications.addListener('registration', (token) => {
                    console.log('Push registration success, token:', token.value);
                    localStorage.setItem('push-token', token.value);
                });
                
                PushNotifications.addListener('registrationError', (error) => {
                    console.error('Push registration error:', error);
                });
                
                // Handle received notifications
                PushNotifications.addListener('pushNotificationReceived', (notification) => {
                    console.log('Push received:', notification);
                    showToast(notification.title || 'Habit Reminder', 'info');
                });
                
                PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
                    console.log('Push action performed:', notification);
                    // User tapped notification - navigate to app
                    window.location.href = 'index.html';
                });
            } catch (e) {
                console.log('Push notifications not available:', e);
            }
        }
    } catch (e) {
        console.error('Error setting up notifications:', e);
    }
}

// Schedule local habit reminder
export async function scheduleHabitReminder(habit, time) {
    if (!isNativeApp()) {
        console.log('Web app - using browser notifications');
        return scheduleBrowserNotification(habit, time);
    }
    
    try {
        const permission = await LocalNotifications.checkPermissions();
        if (permission.display !== 'granted') {
            await LocalNotifications.requestPermissions();
        }
        
        // Parse time (HH:MM format)
        const [hours, minutes] = time.split(':').map(Number);
        const now = new Date();
        const scheduledTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
        
        // If time has passed today, schedule for tomorrow
        if (scheduledTime < now) {
            scheduledTime.setDate(scheduledTime.getDate() + 1);
        }
        
        await LocalNotifications.schedule({
            notifications: [
                {
                    title: `🎯 Time for ${habit.name}!`,
                    body: habit.identity 
                        ? `Show yourself you're a ${habit.identity}` 
                        : `Don't break the streak! ${habit.streak} days so far.`,
                    id: parseInt(habit.id, 36), // Convert habit ID to number
                    schedule: { at: scheduledTime, repeats: true, every: 'day' },
                    sound: 'default',
                    actionTypeId: 'HABIT_REMINDER',
                    extra: {
                        habitId: habit.id
                    }
                }
            ]
        });
        
        showToast(`Reminder set for ${time}`, 'success');
        return true;
    } catch (e) {
        console.error('Failed to schedule notification:', e);
        return false;
    }
}

// Cancel habit reminder
export async function cancelHabitReminder(habitId) {
    if (!isNativeApp()) return;
    
    try {
        const notificationId = parseInt(habitId, 36);
        await LocalNotifications.cancel({
            notifications: [{ id: notificationId }]
        });
    } catch (e) {
        console.error('Failed to cancel notification:', e);
    }
}

// ================================
// CAMERA (Photo Evidence)
// ================================

export async function capturePhoto() {
    if (!isNativeApp()) {
        // Fallback to web file input
        return capturePhotoWeb();
    }
    
    try {
        const image = await Camera.getPhoto({
            quality: 80,
            allowEditing: true,
            resultType: CameraResultType.DataUrl,
            source: CameraSource.Camera
        });
        
        // Haptic feedback
        await hapticImpact('medium');
        
        return image.dataUrl;
    } catch (e) {
        console.error('Camera error:', e);
        return null;
    }
}

export async function selectPhotoFromGallery() {
    if (!isNativeApp()) {
        return capturePhotoWeb();
    }
    
    try {
        const image = await Camera.getPhoto({
            quality: 80,
            allowEditing: true,
            resultType: CameraResultType.DataUrl,
            source: CameraSource.Photos
        });
        
        return image.dataUrl;
    } catch (e) {
        console.error('Gallery error:', e);
        return null;
    }
}

// Web fallback for camera
function capturePhotoWeb() {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'camera';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) {
                resolve(null);
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        };
        
        input.click();
    });
}

// ================================
// HAPTIC FEEDBACK
// ================================

export async function hapticImpact(style = 'medium') {
    if (!isNativeApp()) return;
    
    try {
        const styles = {
            light: ImpactStyle.Light,
            medium: ImpactStyle.Medium,
            heavy: ImpactStyle.Heavy
        };
        
        await Haptics.impact({ style: styles[style] || ImpactStyle.Medium });
    } catch (e) {
        // Haptics not available on all devices
    }
}

export async function hapticNotification(type = 'success') {
    if (!isNativeApp()) return;
    
    try {
        const types = {
            success: 'SUCCESS',
            warning: 'WARNING',
            error: 'ERROR'
        };
        
        await Haptics.notification({ type: types[type] || 'SUCCESS' });
    } catch (e) {
        // Haptics not available
    }
}

// ================================
// BROWSER NOTIFICATION FALLBACK
// ================================

function scheduleBrowserNotification(habit, time) {
    if (!('Notification' in window)) {
        console.log('Browser notifications not supported');
        return false;
    }
    
    if (Notification.permission === 'granted') {
        setupBrowserReminder(habit, time);
        return true;
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                setupBrowserReminder(habit, time);
            }
        });
    }
}

function setupBrowserReminder(habit, time) {
    // This is a simplified version - in production, use service workers
    const [hours, minutes] = time.split(':').map(Number);
    const now = new Date();
    const scheduledTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
    
    if (scheduledTime < now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
    }
    
    const timeout = scheduledTime.getTime() - now.getTime();
    
    setTimeout(() => {
        new Notification(`🎯 Time for ${habit.name}!`, {
            body: habit.identity 
                ? `Show yourself you're a ${habit.identity}` 
                : `Don't break the streak!`,
            icon: '/icon-192.png',
            badge: '/icon-badge.png',
            tag: habit.id,
            requireInteraction: true
        });
    }, timeout);
}

// ================================
// EXPORT FOR GLOBAL USE
// ================================

window.nativeApp = {
    isNative: isNativeApp,
    init: initializeNativeFeatures,
    scheduleReminder: scheduleHabitReminder,
    cancelReminder: cancelHabitReminder,
    capturePhoto,
    selectPhotoFromGallery,
    hapticImpact,
    hapticNotification
};

console.log('Capacitor bridge loaded');
