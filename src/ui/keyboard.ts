import { useEffect, type RefObject } from 'react';
import { Keyboard, Platform, TextInput } from 'react-native';

/**
 * Android: closing the keyboard with Back (or the keyboard's own button)
 * leaves the field focused, and tapping a focused field does not open the
 * keyboard again. Blurring the field when the keyboard hides makes the next
 * tap focus it, so the keyboard always comes back. Mounted once at the root.
 */
export function useAndroidKeyboardRefocus() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      TextInput.State.currentlyFocusedInput()?.blur();
    });
    return () => sub.remove();
  }, []);
}

/** Focus a hidden input (OTP, pick-up code), re-opening the keyboard if it was already focused. */
export function refocus(input: { focus: () => void; blur: () => void; isFocused: () => boolean } | null) {
  if (!input) return;
  if (input.isFocused() && Platform.OS === 'android') {
    input.blur();
    setTimeout(() => input.focus(), 50);
    return;
  }
  input.focus();
}

/**
 * `autoFocus` while a screen is still sliding in is often ignored on Android
 * (the field gets focus, the keyboard stays closed). Focus once the
 * transition is over instead. Returns the value to pass as `autoFocus`.
 */
export function useDeferredAutoFocus(ref: RefObject<{ focus: () => void } | null>, enabled: boolean | undefined): boolean | undefined {
  useEffect(() => {
    if (!enabled || Platform.OS !== 'android') return;
    const t = setTimeout(() => ref.current?.focus(), 350);
    return () => clearTimeout(t);
  }, [enabled, ref]);
  return Platform.OS === 'android' ? false : enabled;
}
