import React, { useEffect, useId, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

/** A semantic card surface; screen classes control layout, never surface colors. */
export function Card({ as: Element = 'section', className = '', children, ...props }) {
  return <Element className={['ui-card', className].filter(Boolean).join(' ')} {...props}>{children}</Element>;
}

/** One accessible disclosure structure shared by Help and About.
 * Controlled by its owner so each screen decides which section is expanded.
 */
export function Disclosure({ as: Element = 'section', className = '', triggerClassName = '', icon: Icon, title, summary, open, onToggle, children, iconClassName = '', labelClassName = '', chevronClassName = '', contentClassName = '' }) {
  const contentId = useId();
  return <Card as={Element} className={[className, open ? 'is-open' : ''].filter(Boolean).join(' ')}>
    <button type="button" className={['ui-disclosure-trigger', triggerClassName].filter(Boolean).join(' ')} onClick={onToggle} aria-expanded={open} aria-controls={open ? contentId : undefined}>
      {Icon && <span className={iconClassName}><Icon size={18} aria-hidden="true" /></span>}
      <span className={labelClassName}><strong>{title}</strong><small>{summary}</small></span>
      <ChevronDown className={chevronClassName} size={18} aria-hidden="true" />
    </button>
    {open && <div id={contentId} className={contentClassName}>{children}</div>}
  </Card>;
}

/** Shared accessible dialog container; caller owns actions and close behavior. */
export function Dialog({ className = '', labelledBy, describedBy, children, onClose }) {
  const ref = useModalFocus(onClose);
  return <div ref={ref} tabIndex={-1} className={['ui-dialog', className].filter(Boolean).join(' ')} role="alertdialog" aria-modal="true" aria-labelledby={labelledBy} aria-describedby={describedBy}>{children}</div>;
}

/** Bottom sheet shell; feature owns its content, actions and dismissal policy. */
export function Sheet({ className = '', ariaLabel, children, onClose }) {
  const ref = useModalFocus(onClose);
  return <div ref={ref} tabIndex={-1} className={['ui-sheet', className].filter(Boolean).join(' ')} role="dialog" aria-modal="true" aria-label={ariaLabel}>{children}</div>;
}

function useModalFocus(onClose) {
  const ref = useRef(null);
  const dismiss = useRef(onClose);
  dismiss.current = onClose;
  useEffect(() => {
    const container = ref.current;
    const previous = document.activeElement;
    const controls = () => [...container.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')].filter(node => node.tabIndex >= 0 && node.getClientRects().length);
    if (!container.contains(document.activeElement)) (controls()[0] || container).focus();
    const keydown = event => {
      if (event.key === 'Escape' && !event.defaultPrevented && dismiss.current) { event.preventDefault(); dismiss.current(); }
      if (event.key !== 'Tab') return;
      const items = controls();
      const first = items[0] || container;
      const last = items.at(-1) || container;
      if (!items.length || (event.shiftKey ? document.activeElement === first : document.activeElement === last) || !container.contains(document.activeElement)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus(); };
  }, []);
  return ref;
}
