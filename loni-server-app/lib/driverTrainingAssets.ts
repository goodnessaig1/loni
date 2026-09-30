// Static require() map for driver-onboarding artwork. Metro needs literal
// require paths, so every asset the training flow can reference is listed here
// and looked up by the `icon` / `hero` keys the backend sends.
import type { ImageSourcePropType } from 'react-native';

export const driverTrainingImages: Record<string, ImageSourcePropType> = {
  'driver-training': require('../assets/images/onboarding-driver/driver-training.svg'),
  'understanding-icon': require('../assets/images/onboarding-driver/understanding-icon.svg'),
  'basic-rules-icon': require('../assets/images/onboarding-driver/basic-rules-icon.svg'),
  'supporting-a-mother-icon': require('../assets/images/onboarding-driver/supporting-a-mother-icon.svg'),
  'how-to-pick-a-mother-icon': require('../assets/images/onboarding-driver/how-to-pick-a-mother-icon.svg'),
  'payment-safety-icon': require('../assets/images/onboarding-driver/payment-safety-icon.svg'),
  module1: require('../assets/images/onboarding-driver/module1.svg'),
  module2: require('../assets/images/onboarding-driver/module2.svg'),
  module3: require('../assets/images/onboarding-driver/module3.svg'),
  module4: require('../assets/images/onboarding-driver/module4.svg'),
  module5: require('../assets/images/onboarding-driver/module5.svg'),
};

export const getDriverTrainingImage = (key?: string): ImageSourcePropType | undefined =>
  key ? driverTrainingImages[key] : undefined;
