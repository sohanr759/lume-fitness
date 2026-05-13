import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const isNative = Platform.OS !== 'web';

export const impact = (style = Haptics.ImpactFeedbackStyle.Light) => {
  if (isNative) Haptics.impactAsync(style);
};

export const notify = (type = Haptics.NotificationFeedbackType.Success) => {
  if (isNative) Haptics.notificationAsync(type);
};
