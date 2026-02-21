import { Capacitor } from '@capacitor/core';

export function getReaderDisplayMode({ fileType, preferNative = true } = {}) {
  if (!preferNative) return 'web';
  if (!fileType) return 'web';
  if (!Capacitor.isNativePlatform()) return 'web';

  if (fileType === 'pdf') {
    if (Capacitor.isPluginAvailable('FileViewer') && Capacitor.isPluginAvailable('Filesystem')) {
      return 'native-pdf';
    }
    return 'web';
  }

  if (fileType === 'epub') {
    if (Capacitor.isPluginAvailable('FolioReader')) {
      return 'native-epub';
    }
    return 'web';
  }

  return 'web';
}
