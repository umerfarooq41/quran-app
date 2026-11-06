import React from 'react';
import { Dialog } from '../../../components/common/Surfaces';

/** Accessible confirmation UI; deletion is owned by the caller. */
export default function DeleteLessonDialog({ onCancel, onConfirm }) {
  return <div className="reflect-delete-backdrop" role="presentation">
    <Dialog className="reflect-delete-dialog" labelledBy="reflect-delete-title" describedBy="reflect-delete-description">
      <h2 id="reflect-delete-title">Remove lesson?</h2>
      <p id="reflect-delete-description">This will permanently remove the saved lesson and its reflections.</p>
      <div className="reflect-delete-actions">
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="button" className="reflect-delete-confirm" onClick={onConfirm}>Remove</button>
      </div>
    </Dialog>
  </div>;
}
