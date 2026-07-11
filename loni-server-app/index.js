import { registerRootComponent } from 'expo';
import { ExpoRoot } from 'expo-router';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility } from '@notifee/react-native';

// Handle background messages
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Background message received:', remoteMessage);

  if (remoteMessage.data && remoteMessage.data.type === 'incoming_call') {
    const channelId = await notifee.createChannel({
      id: 'calls',
      name: 'Incoming Calls',
      vibration: true,
      importance: AndroidImportance.HIGH,
    });

    await notifee.displayNotification({
      title: 'Incoming Call',
      body: `${remoteMessage.data.caller_name || 'Someone'} is calling`,
      data: remoteMessage.data,
      android: {
        channelId,
        category: AndroidCategory.CALL,
        visibility: AndroidVisibility.PUBLIC,
        importance: AndroidImportance.HIGH,
        fullScreenAction: {
          id: 'default',
        },
        actions: [
          { title: 'Decline', pressAction: { id: 'decline' } },
          { title: 'Accept', pressAction: { id: 'accept' } },
        ],
      },
    });
  }
});

// Must be exported or Fast Refresh won't update the context
export function App() {
  const ctx = require.context('./app');
  return <ExpoRoot context={ctx} />;
}

registerRootComponent(App);
