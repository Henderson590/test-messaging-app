// services/NotificationService.js
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  constructor() {
    this.token = null;
  }

  async requestPermissions() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    const { status } = await Notifications.requestPermissionsAsync();
    
    if (status !== 'granted') {
      throw new Error('Permission not granted for push notifications');
    }
    
    return status === 'granted';
  }

  async getExpoPushToken() {
    try {
      // Request permissions first
      const hasPermission = await this.requestPermissions();
      
      if (!hasPermission) {
        throw new Error('Push notification permissions denied');
      }

      // Get the Expo push token
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: '5678c491-ba2c-4687-be29-7cb1993abbac', // Your EAS project ID
      });
      
      this.token = token.data;
      console.log('Expo Push Token:', this.token);
      return this.token;
    } catch (error) {
      console.error('Error getting push token:', error);
      throw error;
    }
  }

  async scheduleLocalNotification(title, body, data = {}) {
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
        },
        trigger: null, // Show immediately
      });
      return identifier;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      throw error;
    }
  }

  async sendPushNotification(expoPushToken, title, body, data = {}) {
    const message = {
      to: expoPushToken,
      sound: 'default',
      title,
      body,
      data,
    };

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const result = await response.json();
      console.log('Push notification sent:', result);
      return result;
    } catch (error) {
      console.error('Error sending push notification:', error);
      throw error;
    }
  }

  addNotificationReceivedListener(listener) {
    return Notifications.addNotificationReceivedListener(listener);
  }

  addNotificationResponseReceivedListener(listener) {
    return Notifications.addNotificationResponseReceivedListener(listener);
  }

  removeNotificationSubscription(subscription) {
    if (subscription) {
      Notifications.removeNotificationSubscription(subscription);
    }
  }
}

export default new NotificationService();
