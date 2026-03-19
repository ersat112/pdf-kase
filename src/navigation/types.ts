import type {
  BottomTabNavigationProp,
  BottomTabScreenProps,
} from '@react-navigation/bottom-tabs';
import type {
  CompositeNavigationProp,
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';

export type ScanEntryLaunchMode =
  | 'camera'
  | 'import-images'
  | 'import-files'
  | 'id-card'
  | 'enhance-photo'
  | 'word'
  | 'question-set'
  | 'translate'
  | 'book'
  | 'smart-erase'
  | 'count-cam'
  | 'qr'
  | 'sign'
  | 'ocr'
  | 'excel'
  | 'timestamp'
  | 'id-photo'
  | 'slides';

export type AppTabParamList = {
  HomeTab: undefined;
  DocumentsTab: undefined;
  CameraTab: undefined;
  ToolsTab: undefined;
  MeTab: undefined;
};

export type RootStackParamList = {
  SplashGate: undefined;
  Login: undefined;
  Register: undefined;
  Home: NavigatorScreenParams<AppTabParamList> | undefined;
  ScanEntry: { initialMode?: ScanEntryLaunchMode } | undefined;
  Documents: undefined;
  DocumentDetail: { documentId: number };
  PdfEditor: { documentId: number };
  SignaturePad: { documentId: number; pageId: number };
  SmartErase: { documentId: number; pageId: number };
  StampManager: undefined;
  Pricing: undefined;
  Settings: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type RootNavigationProp<T extends keyof RootStackParamList> =
  NativeStackNavigationProp<RootStackParamList, T>;

export type AppTabScreenProps<T extends keyof AppTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<AppTabParamList, T>,
    NativeStackScreenProps<RootStackParamList>
  >;

export type AppTabNavigationProp<T extends keyof AppTabParamList> =
  CompositeNavigationProp<
    BottomTabNavigationProp<AppTabParamList, T>,
    NativeStackNavigationProp<RootStackParamList>
  >;