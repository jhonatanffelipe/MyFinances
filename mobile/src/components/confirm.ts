import { Alert } from 'react-native';

/** Confirmação nativa (Sim/Cancelar) como Promise. */
export function confirm(title: string, message: string, confirmLabel = 'Excluir'): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
