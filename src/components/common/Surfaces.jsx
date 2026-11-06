import React from 'react';
import { ChevronDown } from 'lucide-react';

/** A semantic card surface; screen classes control layout, never surface colors. */
export function Card({ as: Element = 'section', className = '', children, ...props }) {
  return <Element className={['ui-card', className].filter(Boolean).join(' ')} {...props}>{children}</Element>;
}

/** One accessible disclosure structure shared by Help and About.
 * Controlled by its owner so each screen decides which section is expanded.
 */
export function Disclosure({ as: Element = 'section', className = '', triggerClassName = '', icon: Icon, title, summary, open, onToggle, children, iconClassName = '', labelClassName = '', chevronClassName = '', contentClassName = '' }) {
  return <Card as={Element} className={[className, open ? 'is-open' : ''].filter(Boolean).join(' ')}>
    <button type="button" className={['ui-disclosure-trigger', triggerClassName].filter(Boolean).join(' ')} onClick={onToggle} aria-expanded={open}>
      {Icon && <span className={iconClassName}><Icon size={18} aria-hidden="true" /></span>}
      <span className={labelClassName}><strong>{title}</strong><small>{summary}</small></span>
      <ChevronDown className={chevronClassName} size={18} aria-hidden="true" />
    </button>
    {open && <div className={contentClassName}>{children}</div>}
  </Card>;
}

/** Shared accessible dialog container; caller owns actions and close behavior. */
export function Dialog({ className = '', labelledBy, describedBy, children }) {
  return <div className={['ui-dialog', className].filter(Boolean).join(' ')} role="alertdialog" aria-modal="true" aria-labelledby={labelledBy} aria-describedby={describedBy}>{children}</div>;
}

/** Bottom sheet shell; feature owns its content, actions and dismissal policy. */
export function Sheet({ className = '', ariaLabel, children }) {
  return <div className={['ui-sheet', className].filter(Boolean).join(' ')} role="dialog" aria-modal="true" aria-label={ariaLabel}>{children}</div>;
}
