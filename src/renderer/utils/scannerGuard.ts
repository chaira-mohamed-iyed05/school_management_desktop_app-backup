/**
 * Global Keyboard & QR Scanner Guard
 * Ensures that scanner events and shortcuts never hijack normal typing in:
 * input, textarea, select, contenteditable, dialogs, search fields, notes, password fields.
 */

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable ||
    Boolean(target.closest('[contenteditable="true"]')) ||
    Boolean(target.closest('input, textarea, select, [role="dialog"]'))
  )
}
