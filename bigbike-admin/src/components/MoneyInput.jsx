import { useState } from 'react'
import { Input } from '@/components/ui/input'
import {
  caretAfterSanitize,
  formatMoneyInput,
  normalizeMoneyDraft,
  parseMoneyInput,
} from '../lib/moneyInput'

function restoreCaret(target, position) {
  const restore = () => {
    if (document.activeElement !== target) return
    target.setSelectionRange(position, position)
  }
  if (typeof queueMicrotask === 'function') queueMicrotask(restore)
  else Promise.resolve().then(restore)
}

function selectAll(target) {
  const select = () => {
    if (document.activeElement !== target) return
    target.select()
  }
  if (typeof queueMicrotask === 'function') queueMicrotask(select)
  else Promise.resolve().then(select)
}

/**
 * Editable integer money input. It deliberately does not format while the
 * field is focused so typing, replacement, paste and deletion keep the caret.
 */
export function MoneyInput({
  value,
  onValueChange,
  locale = 'vi-VN',
  zeroAsEmpty = false,
  onBlur,
  onFocus,
  ...props
}) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState(() => normalizeMoneyDraft(value))

  function focus(event) {
    const nextDraft = normalizeMoneyDraft(value)
    setDraft(zeroAsEmpty && parseMoneyInput(nextDraft) === 0 ? '' : nextDraft)
    setFocused(true)
    selectAll(event.currentTarget)
    onFocus?.(event)
  }

  function change(event) {
    const target = event.currentTarget
    const nextDraft = normalizeMoneyDraft(target.value)
    const nextCaret = caretAfterSanitize(target.value, target.selectionStart)
    setDraft(nextDraft)
    onValueChange?.(nextDraft)
    restoreCaret(target, nextCaret)
  }

  function blur(event) {
    const nextDraft = normalizeMoneyDraft(draft)
    const committed = zeroAsEmpty && parseMoneyInput(nextDraft) === 0 ? '' : nextDraft
    setDraft(committed)
    setFocused(false)
    onValueChange?.(committed)
    onBlur?.(event)
  }

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      value={focused ? draft : formatMoneyInput(value, locale, { zeroAsEmpty })}
      onFocus={focus}
      onChange={change}
      onBlur={blur}
    />
  )
}
